import {
  advance,
  createIdle,
  expectedEndWall,
  flip,
  pause,
  project,
  repeat,
  restore,
  resume,
  start,
  stop,
  toSession,
} from '../engine';
import type { Hourglass, Instant, RuntimeState } from '../types';

const MIN = 60_000;
const T0 = 1_700_000_000_000;

function hourglass(durationMs: number, autoRepeat = false): Hourglass {
  return { id: 'h1', name: 'Focus', durationMs, color: '#d8c08a', autoRepeat, createdAt: T0 };
}

/** Both clocks advance together unless a test moves one on its own. */
const at = (ms: number): Instant => ({ mono: ms, wall: T0 + ms });

let ids = 0;
const nextId = () => `s${++ids}`;

function running(durationMs: number, autoRepeat = false): RuntimeState {
  return start(createIdle(hourglass(durationMs, autoRepeat), at(0)), at(0), nextId());
}

describe('time model (spec §3)', () => {
  it('flows one second of sand per real second and keeps A + B = D', () => {
    const s = advance(running(10 * MIN), at(90_000));
    expect(s.upperMs).toBe(10 * MIN - 90_000);
    expect(s.lowerMs).toBe(90_000);
    expect(s.upperMs + s.lowerMs).toBe(10 * MIN);
  });

  it('completes when the upper chamber empties, stamped at the moment it ran out', () => {
    const s = advance(running(MIN), at(75_000));
    expect(s.phase).toBe('completed');
    expect(s.upperMs).toBe(0);
    expect(s.lowerMs).toBe(MIN);
    expect(s.trackedMs).toBe(MIN);
    expect(s.endedAt).toBe(T0 + MIN);
    expect(s.events.map((e) => e.type)).toEqual(['start', 'complete']);
  });

  it('acceptance 1: 1-minute hourglass ends at 60 s', () => {
    const s = running(MIN);
    expect(expectedEndWall(s)).toBe(T0 + MIN);
    expect(advance(s, at(59_999)).phase).toBe('running');
    expect(advance(s, at(60_000)).phase).toBe('completed');
  });

  it('flip swaps the chambers instead of resetting (§3.3)', () => {
    const s = flip(running(25 * MIN), at(10 * MIN), nextId);
    expect(s.upperMs).toBe(10 * MIN);
    expect(s.lowerMs).toBe(15 * MIN);
    expect(s.flipCount).toBe(1);
    expect(s.phase).toBe('running');
  });

  it('acceptance 2: 10 min, flip at 4 min → 4:00 left, 8 min tracked at the end', () => {
    let s = flip(running(10 * MIN), at(4 * MIN), nextId);
    expect(s.upperMs).toBe(4 * MIN);
    s = advance(s, at(8 * MIN));
    expect(s.phase).toBe('completed');
    expect(s.trackedMs).toBe(8 * MIN);
    expect(s.flipCount).toBe(1);
  });

  it('flipping back sand does not reduce tracked time (§3.5)', () => {
    let s = running(10 * MIN);
    s = flip(s, at(3 * MIN), nextId);
    s = flip(s, at(4 * MIN), nextId);
    s = advance(s, at(5 * MIN));
    expect(s.trackedMs).toBe(5 * MIN);
    expect(s.upperMs + s.lowerMs).toBe(10 * MIN);
  });

  it('project() does not commit but matches advance()', () => {
    const s = running(MIN);
    const p = project(s, at(30_000));
    expect(p.upperMs).toBe(30_000);
    expect(s.upperMs).toBe(MIN);
  });
});

describe('state machine (spec §4)', () => {
  it('first flip from idle starts with a full upper chamber (§12.1)', () => {
    const s = flip(createIdle(hourglass(5 * MIN), at(0)), at(1000), nextId, 'inverted');
    expect(s.phase).toBe('running');
    expect(s.upperMs).toBe(5 * MIN);
    expect(s.flipCount).toBe(0);
    expect(s.orientation).toBe('inverted');
    expect(s.startedAt).toBe(T0 + 1000);
  });

  it('pause freezes the sand and resume continues it', () => {
    let s = pause(running(10 * MIN), at(MIN), 'user');
    expect(s.phase).toBe('paused');
    s = advance(s, at(5 * MIN));
    expect(s.upperMs).toBe(9 * MIN);
    s = resume(s, at(5 * MIN));
    s = advance(s, at(6 * MIN));
    expect(s.upperMs).toBe(8 * MIN);
    expect(s.trackedMs).toBe(2 * MIN);
  });

  it('standing the device up resumes only a flat pause, not a button pause', () => {
    const byUser = pause(running(MIN), at(1000), 'user');
    expect(resume(byUser, at(2000), 'flat').phase).toBe('paused');
    const byFlat = pause(running(MIN), at(1000), 'flat');
    expect(resume(byFlat, at(2000), 'flat').phase).toBe('running');
  });

  it('stop ends the session as stopped', () => {
    const s = stop(running(10 * MIN), at(3 * MIN));
    expect(s.phase).toBe('stopped');
    expect(toSession(s)).toMatchObject({ endReason: 'stopped', trackedMs: 3 * MIN, endedAt: T0 + 3 * MIN });
  });

  it('stop after the sand already ran out records completion instead', () => {
    const s = stop(running(MIN), at(2 * MIN));
    expect(s.phase).toBe('completed');
    expect(toSession(s)?.endReason).toBe('completed');
  });

  it('flip after completion starts a new round only with auto-repeat (§3.4)', () => {
    const done = advance(running(MIN), at(MIN));
    expect(flip(done, at(70_000), nextId).phase).toBe('completed');

    const doneRepeat = advance(running(MIN, true), at(MIN));
    const again = flip(doneRepeat, at(70_000), nextId);
    expect(again.phase).toBe('running');
    expect(again.upperMs).toBe(MIN);
    expect(again.sessionId).not.toBe(doneRepeat.sessionId);
  });

  it('a flip that arrives after the sand ran out completes first, then repeats', () => {
    const s = flip(running(MIN, true), at(90_000), nextId);
    expect(s.phase).toBe('running');
    expect(s.upperMs).toBe(MIN);
    expect(s.startedAt).toBe(T0 + 90_000);
  });

  it('repeat button starts a new round regardless of auto-repeat and keeps the tag', () => {
    const done = { ...advance(running(MIN), at(MIN)), tag: 'Học' };
    const again = repeat(done, at(MIN + 1), nextId());
    expect(again.phase).toBe('running');
    expect(again.tag).toBe('Học');
    expect(again.events.map((e) => e.type)).toEqual(['start']);
  });

  it('records every transition in the session log', () => {
    let s = running(10 * MIN);
    s = flip(s, at(MIN), nextId);
    s = pause(s, at(MIN + 30_000), 'flat');
    s = resume(s, at(3 * MIN), 'flat');
    s = stop(s, at(3 * MIN + 10_000));
    expect(s.events.map((e) => e.type)).toEqual(['start', 'flip', 'pause', 'resume', 'stop']);
    expect(s.events[2]).toMatchObject({ reason: 'flat', upperMs: 30_000, lowerMs: 9.5 * MIN });
  });
});

describe('edge cases (spec §7)', () => {
  it('restores a running session after the app was killed', () => {
    const saved = advance(running(10 * MIN), at(2 * MIN));
    // New process: monotonic clock restarted near zero, 3 minutes of wall time later.
    const s = restore(saved, { mono: 50, wall: T0 + 5 * MIN });
    expect(s.phase).toBe('running');
    expect(s.upperMs).toBe(5 * MIN);
    expect(s.trackedMs).toBe(5 * MIN);
    expect(advance(s, { mono: 50 + MIN, wall: T0 + 6 * MIN }).upperMs).toBe(4 * MIN);
  });

  it('marks an overdue restored session completed at the expected end time', () => {
    const saved = advance(running(10 * MIN), at(2 * MIN));
    const s = restore(saved, { mono: 0, wall: T0 + 60 * MIN });
    expect(s.phase).toBe('completed');
    expect(s.endedAt).toBe(T0 + 10 * MIN);
    expect(s.trackedMs).toBe(10 * MIN);
  });

  it('a restored paused session stays paused', () => {
    const saved = pause(running(10 * MIN), at(MIN), 'user');
    const s = restore(saved, { mono: 0, wall: T0 + 60 * MIN });
    expect(s.phase).toBe('paused');
    expect(s.upperMs).toBe(9 * MIN);
  });

  it('ignores a wall clock set backwards while killed', () => {
    const saved = advance(running(10 * MIN), at(2 * MIN));
    const s = restore(saved, { mono: 0, wall: T0 });
    expect(s.upperMs).toBe(8 * MIN);
  });

  it('uses the monotonic clock while alive, not the wall clock', () => {
    const s = advance(running(10 * MIN), { mono: MIN, wall: T0 - 3600_000 });
    expect(s.upperMs).toBe(9 * MIN);
  });
});
