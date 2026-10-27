export type Ms = number;

export interface Hourglass {
  id: string;
  name: string;
  durationMs: Ms;
  color: string;
  autoRepeat: boolean;
  createdAt: number;
}

export type Phase = 'idle' | 'running' | 'paused' | 'completed' | 'stopped';

export type EndReason = 'completed' | 'stopped';

export type SessionEventType = 'start' | 'flip' | 'pause' | 'resume' | 'complete' | 'stop';

export interface SessionEvent {
  type: SessionEventType;
  /** Wall-clock time (epoch ms), for display only. */
  at: number;
  upperMs: Ms;
  lowerMs: Ms;
  /** Why the session was paused, for `pause` events. */
  reason?: PauseReason;
}

export interface Session {
  id: string;
  hourglassId: string;
  hourglassName: string;
  color: string;
  startedAt: number;
  endedAt: number;
  durationMs: Ms;
  trackedMs: Ms;
  flipCount: number;
  endReason: EndReason;
  tag?: string;
  events: SessionEvent[];
}

export type PauseReason = 'user' | 'flat';

/** Physical pose of the device along the hourglass axis. */
export type Pose = 'upright' | 'inverted';

/**
 * A point in time read from both clocks. `mono` measures durations (never goes
 * backwards, keeps counting while the device sleeps); `wall` is epoch ms used for
 * display, notifications and for recovering after the process was killed.
 */
export interface Instant {
  mono: number;
  wall: number;
}

export interface RuntimeState {
  sessionId: string | null;
  hourglass: Hourglass;
  phase: Phase;
  upperMs: Ms;
  lowerMs: Ms;
  trackedMs: Ms;
  flipCount: number;
  pauseReason?: PauseReason;
  /** Clock readings when `upperMs`/`lowerMs` were last brought up to date. */
  lastMonoTs: number;
  lastWallTs: number;
  startedAt: number | null;
  endedAt: number | null;
  tag?: string;
  orientation: Pose;
  events: SessionEvent[];
}
