import type { Ms, Session } from './types';

export const MIN_DURATION_MS = 10_000;
export const MAX_DURATION_MS = 12 * 3600_000;
export const PRESET_MINUTES = [5, 10, 15, 25, 45, 60] as const;
export const MAX_FAVORITES = 20;

export function clampDuration(ms: Ms): Ms {
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(ms / 1000) * 1000));
}

export function splitDuration(ms: Ms): { h: number; m: number; s: number } {
  const total = Math.round(ms / 1000);
  return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}

export function joinDuration(h: number, m: number, s: number): Ms {
  return ((h * 60 + m) * 60 + s) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Countdown display: `mm:ss`, or `h:mm:ss` from one hour up. Rounds up so the
 * display reads 0:00 only once the sand has actually run out.
 */
export function formatClock(ms: Ms): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Compact human duration like `1h 05m`, `25m`, `45s`. */
export function formatSpan(ms: Ms): string {
  const { h, m, s } = splitDuration(ms);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return s > 0 ? `${m}m ${pad(s)}s` : `${m}m`;
  return `${s}s`;
}

export function dayKey(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Monday 00:00 local time of the week containing `epochMs`. */
export function weekStart(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

export interface DayGroup {
  key: string;
  sessions: Session[];
  trackedMs: Ms;
}

/** Sessions grouped by local start day, newest day first. */
export function groupByDay(sessions: Session[]): DayGroup[] {
  const map = new Map<string, Session[]>();
  for (const s of [...sessions].sort((a, b) => b.startedAt - a.startedAt)) {
    const key = dayKey(s.startedAt);
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return [...map.entries()].map(([key, list]) => ({
    key,
    sessions: list,
    trackedMs: list.reduce((sum, s) => sum + s.trackedMs, 0),
  }));
}

export function totalsFor(sessions: Session[], now: number): { todayMs: Ms; weekMs: Ms } {
  const today = dayKey(now);
  const week = weekStart(now);
  let todayMs = 0;
  let weekMs = 0;
  for (const s of sessions) {
    if (dayKey(s.startedAt) === today) todayMs += s.trackedMs;
    if (s.startedAt >= week) weekMs += s.trackedMs;
  }
  return { todayMs, weekMs };
}
