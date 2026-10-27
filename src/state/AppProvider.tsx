import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';

import { systemClock } from '../domain/clock';
import * as engine from '../domain/engine';
import { FlipDetector } from '../domain/flipDetector';
import { formatClock } from '../domain/format';
import { DEFAULT_SETTINGS, type Settings } from '../domain/settings';
import type { Hourglass, Pose, RuntimeState, Session } from '../domain/types';
import { resolveLocale, translator, type Locale, type Translate } from '../i18n';
import { playAlarm, tapHaptic } from '../services/alarm';
import { cancelEnd, ensureNotificationPermission, scheduleEnd, setupNotifications } from '../services/notifications';
import { isMotionAvailable, subscribeMotion } from '../services/sensors';
import { openRepository } from '../services/storage';
import type { Repository } from '../services/storage/repository';

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** An in-app alarm only plays if the sand ran out moments ago, not while we were away. */
const ALARM_GRACE_MS = 5000;

export interface MotionState {
  available: boolean;
  /** Smoothed up vector for drawing; read every frame, so not React state. */
  vectorRef: { current: { x: number; y: number; z: number } | null };
  pose: Pose;
}

interface AppContextValue {
  ready: boolean;
  locale: Locale;
  t: Translate;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  notificationsAllowed: boolean | null;

  hourglasses: Hourglass[];
  saveHourglass: (h: Hourglass) => Promise<void>;
  deleteHourglass: (id: string) => Promise<void>;

  sessions: Session[];
  deleteSession: (id: string) => Promise<void>;
  setSessionTag: (id: string, tag: string | undefined) => Promise<void>;

  runtime: RuntimeState | null;
  /** Opens an hourglass on the timer (idle). Replaces any finished runtime. */
  open: (h: Hourglass) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  flip: () => void;
  stop: () => void;
  repeat: () => void;
  close: () => void;
  setTag: (tag: string | undefined) => void;

  motion: MotionState;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repository | null>(null);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hourglasses, setHourglasses] = useState<Hourglass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean | null>(null);
  const [motionAvailable, setMotionAvailable] = useState(false);
  const [pose, setPose] = useState<Pose>('upright');
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  const runtimeRef = useRef<RuntimeState | null>(null);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const vectorRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const savedSessions = useRef(new Set<string>());

  const locale = resolveLocale(settings.language);
  const t = useMemo(() => translator(locale), [locale]);

  /** Applies an engine transition to the latest runtime. */
  const commit = useCallback((fn: (r: RuntimeState) => RuntimeState) => {
    const current = runtimeRef.current;
    if (!current) return;
    const next = fn(current);
    if (next === current) return;
    runtimeRef.current = next;
    setRuntime(next);
  }, []);

  // ── Boot: open storage, load data, restore a session that was running when the app died.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const repo = await openRepository();
      repoRef.current = repo;
      const [hs, ss, stored, saved] = await Promise.all([
        repo.listHourglasses(),
        repo.listSessions(),
        repo.loadSettings(),
        repo.loadRuntime(),
      ]);
      if (cancelled) return;
      for (const s of ss) savedSessions.current.add(s.id);
      setHourglasses(hs);
      setSessions(ss);
      setSettings({ ...DEFAULT_SETTINGS, ...stored });
      if (saved) {
        const restored = engine.restore(saved, systemClock());
        runtimeRef.current = restored;
        setRuntime(restored);
      }
      setMotionAvailable(await isMotionAvailable());
      await setupNotifications().catch(() => {});
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
      if (state === 'active') commit((r) => engine.advance(r, systemClock()));
    });
    return () => sub.remove();
  }, [commit]);

  /** Saves a finished session once. Returns true the first time. */
  const recordSession = useCallback((r: RuntimeState): boolean => {
    const session = engine.toSession(r);
    if (!session || savedSessions.current.has(session.id)) return false;
    savedSessions.current.add(session.id);
    repoRef.current?.saveSession(session).catch(() => {});
    setSessions((list) => [session, ...list.filter((s) => s.id !== session.id)]);
    return true;
  }, []);

  // ── React to every committed runtime: persist, notify, record the session.
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    const repo = repoRef.current;
    if (!ready || !repo) return;
    const r = runtime;
    const live = r && (r.phase === 'running' || r.phase === 'paused');
    repo.saveRuntime(live ? r : null).catch(() => {});

    const endWall = r ? engine.expectedEndWall(r) : null;
    if (r && endWall !== null) {
      scheduleEnd(
        endWall,
        { title: t('notif.title'), body: t('notif.body', { name: r.hourglass.name }) },
        settingsRef.current,
      ).catch(() => {});
    } else {
      cancelEnd().catch(() => {});
    }

    if (r && recordSession(r) && r.phase === 'completed' && r.endedAt !== null) {
      if (Date.now() - r.endedAt < ALARM_GRACE_MS && AppState.currentState === 'active') playAlarm(settingsRef.current);
    }

    const phaseKey = r ? `${r.sessionId}:${r.phase}` : null;
    if (r && phaseKey !== prevPhase.current && prevPhase.current !== null) {
      const time = formatClock(r.upperMs);
      AccessibilityInfo.announceForAccessibility(t(`a11y.${r.phase}`, { time }));
    }
    prevPhase.current = phaseKey;
  }, [runtime, ready, t, recordSession]);

  // ── While running, wake exactly when the sand runs out to complete the session.
  useEffect(() => {
    if (!runtime || runtime.phase !== 'running') return;
    const endWall = engine.expectedEndWall(runtime)!;
    const timer = setTimeout(() => commit((r) => engine.advance(r, systemClock())), Math.max(0, endWall - Date.now()) + 5);
    return () => clearTimeout(timer);
  }, [runtime, commit]);

  // ── Motion: flips and lying flat drive the state machine.
  const hasRuntime = runtime !== null;
  useEffect(() => {
    if (!motionAvailable || !hasRuntime || !appActive) return;
    const detector = new FlipDetector({}, runtimeRef.current?.orientation ?? null);
    const unsubscribe = subscribeMotion((sample) => {
      const events = detector.push(sample);
      vectorRef.current = detector.vector;
      if (detector.pose) setPose(detector.pose);
      for (const e of events) {
        const now = systemClock();
        if (e.type === 'flip') {
          tapHaptic(settingsRef.current);
          commit((r) => engine.flip(r, now, newId, e.pose));
        } else if (e.type === 'flat' && settingsRef.current.pauseWhenFlat) {
          commit((r) => engine.pause(r, now, 'flat'));
        } else if (e.type === 'lift') {
          commit((r) => engine.resume(r, now, 'flat'));
        }
      }
    });
    return () => {
      unsubscribe();
      vectorRef.current = null;
    };
  }, [motionAvailable, hasRuntime, appActive, commit]);

  const askPermissionOnce = useRef(false);
  const ensurePermission = useCallback(() => {
    if (askPermissionOnce.current || Platform.OS === 'web') return;
    askPermissionOnce.current = true;
    ensureNotificationPermission()
      .then(setNotificationsAllowed)
      .catch(() => setNotificationsAllowed(false));
  }, []);

  const value = useMemo<AppContextValue>(() => {
    const now = () => systemClock();
    return {
      ready,
      locale,
      t,
      settings,
      notificationsAllowed,
      updateSettings(patch) {
        setSettings((s) => {
          const next = { ...s, ...patch };
          repoRef.current?.saveSettings(next).catch(() => {});
          return next;
        });
      },

      hourglasses,
      async saveHourglass(h) {
        await repoRef.current?.saveHourglass(h);
        setHourglasses((list) => {
          const i = list.findIndex((x) => x.id === h.id);
          return i < 0 ? [...list, h] : list.map((x) => (x.id === h.id ? h : x));
        });
        // Keep an idle timer showing this hourglass in sync with its edits.
        commit((r) => (r.phase === 'idle' && r.hourglass.id === h.id ? engine.createIdle(h, now(), r.orientation) : r));
      },
      async deleteHourglass(id) {
        await repoRef.current?.deleteHourglass(id);
        setHourglasses((list) => list.filter((x) => x.id !== id));
      },

      sessions,
      async deleteSession(id) {
        await repoRef.current?.deleteSession(id);
        setSessions((list) => list.filter((s) => s.id !== id));
      },
      async setSessionTag(id, tag) {
        const s = sessions.find((x) => x.id === id);
        if (!s) return;
        const next = { ...s, tag };
        await repoRef.current?.saveSession(next);
        setSessions((list) => list.map((x) => (x.id === id ? next : x)));
      },

      runtime,
      open(h) {
        const current = runtimeRef.current;
        if (current && (current.phase === 'running' || current.phase === 'paused')) {
          if (current.hourglass.id === h.id) return;
          recordSession(engine.stop(current, now()));
        }
        const idle = engine.createIdle(h, now(), pose);
        runtimeRef.current = idle;
        setRuntime(idle);
      },
      start() {
        ensurePermission();
        tapHaptic(settings);
        commit((r) => engine.start(r, now(), newId()));
      },
      pause: () => commit((r) => engine.pause(r, now(), 'user')),
      resume: () => commit((r) => engine.resume(r, now(), 'user')),
      flip() {
        ensurePermission();
        tapHaptic(settings);
        commit((r) => (r.phase === 'completed' ? engine.repeat(r, now(), newId()) : engine.flip(r, now(), newId)));
      },
      stop: () => commit((r) => engine.stop(r, now())),
      repeat() {
        tapHaptic(settings);
        commit((r) => engine.repeat(r, now(), newId()));
      },
      close() {
        const current = runtimeRef.current;
        if (current && (current.phase === 'running' || current.phase === 'paused')) return;
        runtimeRef.current = null;
        setRuntime(null);
      },
      setTag: (tag) => commit((r) => engine.setTag(r, tag)),

      motion: { available: motionAvailable, vectorRef, pose },
    };
  }, [ready, locale, t, settings, notificationsAllowed, hourglasses, sessions, runtime, motionAvailable, pose, commit, ensurePermission, recordSession]);

  // A session that finishes keeps the tag chosen on the timer; persist edits made after it ended.
  useEffect(() => {
    if (!runtime || !engine.isFinished(runtime) || !runtime.sessionId) return;
    const saved = sessions.find((s) => s.id === runtime.sessionId);
    if (saved && saved.tag !== runtime.tag) value.setSessionTag(saved.id, runtime.tag);
  }, [runtime, sessions, value]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
