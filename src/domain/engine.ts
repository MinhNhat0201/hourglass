import type {
  Hourglass,
  Instant,
  PauseReason,
  Pose,
  RuntimeState,
  Session,
  SessionEvent,
  SessionEventType,
} from './types';

/**
 * Pure session engine (spec §3, §4). Every transition takes the current state and
 * an `Instant` and returns a new state; nothing here reads a clock or does I/O.
 */

export function createIdle(hourglass: Hourglass, now: Instant, orientation: Pose = 'upright'): RuntimeState {
  return {
    sessionId: null,
    hourglass,
    phase: 'idle',
    upperMs: hourglass.durationMs,
    lowerMs: 0,
    trackedMs: 0,
    flipCount: 0,
    lastMonoTs: now.mono,
    lastWallTs: now.wall,
    startedAt: null,
    endedAt: null,
    orientation,
    events: [],
  };
}

function pushEvent(s: RuntimeState, type: SessionEventType, at: number, reason?: PauseReason): RuntimeState {
  const event: SessionEvent = { type, at, upperMs: s.upperMs, lowerMs: s.lowerMs };
  if (reason) event.reason = reason;
  return { ...s, events: [...s.events, event] };
}

/**
 * Lets sand flow up to `now`. Completes the session when the upper chamber
 * empties; the completion is stamped at the moment the sand ran out, not `now`.
 */
export function advance(s: RuntimeState, now: Instant): RuntimeState {
  if (s.phase !== 'running') {
    return { ...s, lastMonoTs: now.mono, lastWallTs: now.wall };
  }
  const dt = Math.max(0, now.mono - s.lastMonoTs);
  const flow = Math.min(dt, s.upperMs);
  const next: RuntimeState = {
    ...s,
    upperMs: s.upperMs - flow,
    lowerMs: s.lowerMs + flow,
    trackedMs: s.trackedMs + flow,
    lastMonoTs: now.mono,
    lastWallTs: now.wall,
  };
  if (next.upperMs > 0) return next;
  const emptiedAt = now.wall - (dt - flow);
  return pushEvent({ ...next, phase: 'completed', endedAt: emptiedAt }, 'complete', emptiedAt);
}

/** Read-only view of `advance` for rendering frames between commits. */
export function project(s: RuntimeState, now: Instant): RuntimeState {
  return s.phase === 'running' ? advance(s, now) : s;
}

export function start(s: RuntimeState, now: Instant, sessionId: string): RuntimeState {
  if (s.phase !== 'idle') return s;
  const running: RuntimeState = {
    ...s,
    sessionId,
    phase: 'running',
    upperMs: s.hourglass.durationMs,
    lowerMs: 0,
    trackedMs: 0,
    flipCount: 0,
    pauseReason: undefined,
    lastMonoTs: now.mono,
    lastWallTs: now.wall,
    startedAt: now.wall,
    endedAt: null,
    events: [],
  };
  return pushEvent(running, 'start', now.wall);
}

/** Starts a new round from a finished one: a new session with a full upper chamber. */
export function repeat(s: RuntimeState, now: Instant, sessionId: string): RuntimeState {
  if (s.phase !== 'completed' && s.phase !== 'stopped') return s;
  const idle = createIdle(s.hourglass, now, s.orientation);
  return start({ ...idle, tag: s.tag }, now, sessionId);
}

/**
 * Flip (spec §3.3, §3.4, §12): swaps the chambers while running or paused; the
 * first flip from idle starts; a flip after completion starts a new round only
 * when the hourglass auto-repeats.
 */
export function flip(s: RuntimeState, now: Instant, newSessionId: () => string, orientation?: Pose): RuntimeState {
  const pose = orientation ?? s.orientation;
  switch (s.phase) {
    case 'idle':
      return start({ ...s, orientation: pose }, now, newSessionId());
    case 'completed':
      if (!s.hourglass.autoRepeat) return { ...s, orientation: pose };
      return repeat({ ...s, orientation: pose }, now, newSessionId());
    case 'stopped':
      return { ...s, orientation: pose };
    case 'running': {
      const advanced = advance(s, now);
      if (advanced.phase !== 'running') return flip(advanced, now, newSessionId, orientation);
      return swap(advanced, now, pose);
    }
    case 'paused':
      return swap(advance(s, now), now, pose);
  }
}

function swap(s: RuntimeState, now: Instant, pose: Pose): RuntimeState {
  const swapped: RuntimeState = {
    ...s,
    upperMs: s.lowerMs,
    lowerMs: s.upperMs,
    flipCount: s.flipCount + 1,
    orientation: pose,
  };
  return pushEvent(swapped, 'flip', now.wall);
}

export function pause(s: RuntimeState, now: Instant, reason: PauseReason): RuntimeState {
  if (s.phase !== 'running') return s;
  const advanced = advance(s, now);
  if (advanced.phase !== 'running') return advanced;
  return pushEvent({ ...advanced, phase: 'paused', pauseReason: reason }, 'pause', now.wall, reason);
}

/**
 * Resumes a paused session. A pause the user chose by button is only undone by a
 * button (`reason: 'user'`); standing the device back up only undoes a flat pause.
 */
export function resume(s: RuntimeState, now: Instant, by: PauseReason = 'user'): RuntimeState {
  if (s.phase !== 'paused') return s;
  if (by === 'flat' && s.pauseReason !== 'flat') return s;
  const resumed: RuntimeState = {
    ...s,
    phase: 'running',
    pauseReason: undefined,
    lastMonoTs: now.mono,
    lastWallTs: now.wall,
  };
  return pushEvent(resumed, 'resume', now.wall);
}

export function stop(s: RuntimeState, now: Instant): RuntimeState {
  if (s.phase !== 'running' && s.phase !== 'paused') return s;
  const advanced = advance(s, now);
  if (advanced.phase === 'completed') return advanced;
  return pushEvent({ ...advanced, phase: 'stopped', endedAt: now.wall }, 'stop', now.wall);
}

export function setTag(s: RuntimeState, tag: string | undefined): RuntimeState {
  return { ...s, tag };
}

/**
 * Rebuilds the runtime after the process was killed (spec §7). The monotonic clock
 * does not survive a restart, so elapsed time is taken from the wall clock (never
 * negative) and the state is re-anchored on the new process's monotonic clock.
 */
export function restore(saved: RuntimeState, now: Instant): RuntimeState {
  const elapsed = Math.max(0, now.wall - saved.lastWallTs);
  const rebased: RuntimeState = { ...saved, lastMonoTs: now.mono - elapsed, lastWallTs: now.wall - elapsed };
  return advance(rebased, now);
}

/** Wall-clock time the sand runs out if nothing changes, or null when not running. */
export function expectedEndWall(s: RuntimeState): number | null {
  return s.phase === 'running' ? s.lastWallTs + s.upperMs : null;
}

export function isFinished(s: RuntimeState): boolean {
  return s.phase === 'completed' || s.phase === 'stopped';
}

export function toSession(s: RuntimeState): Session | null {
  if (!isFinished(s) || !s.sessionId || s.startedAt === null || s.endedAt === null) return null;
  return {
    id: s.sessionId,
    hourglassId: s.hourglass.id,
    hourglassName: s.hourglass.name,
    color: s.hourglass.color,
    startedAt: Math.round(s.startedAt),
    endedAt: Math.round(s.endedAt),
    durationMs: s.hourglass.durationMs,
    trackedMs: Math.round(s.trackedMs),
    flipCount: s.flipCount,
    endReason: s.phase === 'completed' ? 'completed' : 'stopped',
    tag: s.tag,
    events: s.events,
  };
}
