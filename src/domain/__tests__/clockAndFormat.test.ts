import { createClock } from '../clock';
import { clampDuration, formatClock, formatSpan, groupByDay, totalsFor } from '../format';
import type { Session } from '../types';

describe('createClock', () => {
  function fake() {
    const t = { perf: 0, wall: 1_000_000 };
    const clock = createClock(() => t.perf, () => t.wall);
    return { t, clock };
  }

  it('follows the monotonic clock while awake', () => {
    const { t, clock } = fake();
    t.perf += 5000;
    t.wall += 5000;
    expect(clock().mono).toBe(5000);
  });

  it('ignores the wall clock being set backwards', () => {
    const { t, clock } = fake();
    t.perf += 5000;
    t.wall -= 3600_000;
    expect(clock().mono).toBe(5000);
  });

  it('counts time the device slept, when the monotonic clock stood still', () => {
    const { t, clock } = fake();
    t.perf += 100;
    t.wall += 10 * 60_000;
    expect(clock().mono).toBe(10 * 60_000);
  });

  it('never decreases', () => {
    const { t, clock } = fake();
    t.perf -= 50;
    t.wall -= 50;
    expect(clock().mono).toBe(0);
  });
});

describe('format', () => {
  it('clamps durations to 10 s – 12 h', () => {
    expect(clampDuration(1000)).toBe(10_000);
    expect(clampDuration(13 * 3600_000)).toBe(12 * 3600_000);
  });

  it('formats the countdown rounding up', () => {
    expect(formatClock(60_000)).toBe('01:00');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(1)).toBe('00:01');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(3600_000 + 5000)).toBe('1:00:05');
  });

  it('formats spans', () => {
    expect(formatSpan(25 * 60_000)).toBe('25m');
    expect(formatSpan(90_000)).toBe('1m 30s');
    expect(formatSpan(3900_000)).toBe('1h 05m');
    expect(formatSpan(45_000)).toBe('45s');
  });

  it('groups sessions by day and totals today and this week', () => {
    const day = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
    const mk = (id: string, startedAt: number, trackedMs: number): Session => ({
      id,
      hourglassId: 'h',
      hourglassName: 'x',
      color: '#000',
      startedAt,
      endedAt: startedAt + trackedMs,
      durationMs: trackedMs,
      trackedMs,
      flipCount: 0,
      endReason: 'completed',
      events: [],
    });
    // 2026-10-27 is a Tuesday; the week starts Monday 26th.
    const sessions = [mk('a', day(27, 9), 1000), mk('b', day(27, 15), 2000), mk('c', day(26, 9), 4000), mk('d', day(25, 9), 8000)];
    const groups = groupByDay(sessions);
    expect(groups.map((g) => [g.key, g.trackedMs])).toEqual([
      ['2026-10-27', 3000],
      ['2026-10-26', 4000],
      ['2026-10-25', 8000],
    ]);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(['b', 'a']);
    expect(totalsFor(sessions, day(27, 20))).toEqual({ todayMs: 3000, weekMs: 7000 });
  });
});
