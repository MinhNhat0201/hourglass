import type { Instant } from './types';

/** Slack before a wall-clock jump that the monotonic clock missed counts as sleep. */
const SLEEP_SLACK_MS = 1000;

/**
 * Monotonic clock that keeps counting while the device sleeps.
 *
 * JS `performance.now()` is monotonic and ignores wall-clock edits, but on both
 * iOS and Android it stops while the device is suspended (screen locked). The wall
 * clock keeps running then, but can be changed by the user or timezone sync.
 * We advance by the monotonic delta, and only when the wall clock moved forward
 * clearly more than it (the device slept) do we take the wall delta instead.
 * Setting the clock backwards is therefore ignored, and the result never decreases.
 */
export function createClock(perfNow: () => number, dateNow: () => number): () => Instant {
  let lastPerf = perfNow();
  let lastWall = dateNow();
  let mono = 0;
  return () => {
    const perf = perfNow();
    const wall = dateNow();
    const dPerf = Math.max(0, perf - lastPerf);
    const dWall = wall - lastWall;
    mono += dWall > dPerf + SLEEP_SLACK_MS ? dWall : dPerf;
    lastPerf = perf;
    lastWall = wall;
    return { mono, wall };
  };
}

export const systemClock = createClock(
  () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  () => Date.now(),
);
