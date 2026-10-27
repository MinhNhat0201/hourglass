import { FlipDetector, type DetectorEvent } from '../flipDetector';
import { sampleAt, simulate, tremor } from '../motionSimulator';

function run(detector: FlipDetector, samples: ReturnType<typeof simulate>): DetectorEvent[] {
  return samples.flatMap((s) => detector.push(s));
}

const flips = (events: DetectorEvent[]) => events.filter((e) => e.type === 'flip');

describe('FlipDetector', () => {
  it('learns the initial pose without emitting a flip', () => {
    const d = new FlipDetector();
    expect(run(d, simulate(0, [{ to: 0, ms: 200 }]))).toEqual([]);
    expect(d.pose).toBe('upright');
  });

  it('detects a flip once the inverted pose holds for 300 ms', () => {
    const d = new FlipDetector();
    const events = run(d, simulate(0, [{ to: 180, ms: 400 }, { to: 180, ms: 500 }]));
    expect(flips(events)).toHaveLength(1);
    expect(flips(events)[0]).toMatchObject({ type: 'flip', pose: 'inverted' });
    expect(d.pose).toBe('inverted');
  });

  it('reports the flip within 500 ms of the device settling (spec §9)', () => {
    const d = new FlipDetector();
    const samples = simulate(0, [{ to: 180, ms: 400 }, { to: 180, ms: 1000 }]);
    const settledAt = 400;
    const events = run(d, samples);
    expect(flips(events)[0].at - settledAt).toBeLessThanOrEqual(500);
  });

  it('ignores a rotation that comes back before it is stable', () => {
    const d = new FlipDetector();
    const events = run(d, simulate(0, [{ to: 170, ms: 200 }, { to: 170, ms: 100 }, { to: 0, ms: 200 }, { to: 0, ms: 600 }]));
    expect(flips(events)).toHaveLength(0);
    expect(d.pose).toBe('upright');
  });

  it('does not flip on a tilt that stays below the 135° threshold', () => {
    const d = new FlipDetector();
    const events = run(d, simulate(0, [{ to: 120, ms: 300 }, { to: 120, ms: 2000 }]));
    expect(flips(events)).toHaveLength(0);
  });

  it('acceptance 5: hand tremor does not flip or pause', () => {
    const d = new FlipDetector();
    run(d, simulate(0, [{ to: 0, ms: 100 }]));
    const events = run(d, tremor(10, 25, 10_000, 20, 120));
    expect(events).toEqual([]);
  });

  it('hysteresis: wobbling around the threshold while inverted does not re-arm', () => {
    const d = new FlipDetector();
    run(d, simulate(0, [{ to: 180, ms: 300 }, { to: 180, ms: 400 }]));
    const events = run(d, tremor(140, 8, 5000, 20, 800));
    expect(flips(events)).toHaveLength(0);
    expect(d.pose).toBe('inverted');
  });

  it('counts rapid consecutive flips once each', () => {
    const d = new FlipDetector();
    const events = run(
      d,
      simulate(0, [
        { to: 180, ms: 250 },
        { to: 180, ms: 350 },
        { to: 0, ms: 250 },
        { to: 0, ms: 350 },
        { to: 180, ms: 250 },
        { to: 180, ms: 350 },
      ]),
    );
    expect(flips(events).map((e) => e.type === 'flip' && e.pose)).toEqual(['inverted', 'upright', 'inverted']);
  });

  it('ignores violent shaking (magnitude far from 1 g)', () => {
    const d = new FlipDetector({}, 'upright');
    const events = run(
      d,
      Array.from({ length: 50 }, (_, i) => ({ x: 0, y: -2.5, z: 0, t: i * 20 })),
    );
    expect(events).toEqual([]);
  });

  it('reports lying flat after 2 s and lifting after it stands up again', () => {
    const d = new FlipDetector();
    const events = run(d, simulate(0, [{ to: 90, ms: 300 }, { to: 90, ms: 2500 }, { to: 0, ms: 300 }, { to: 0, ms: 600 }]));
    expect(events.map((e) => e.type)).toEqual(['flat', 'lift']);
    expect(events[0].at).toBeGreaterThanOrEqual(2000);
  });

  it('does not report flat for a brief rest under 2 s', () => {
    const d = new FlipDetector();
    const events = run(d, simulate(0, [{ to: 90, ms: 200 }, { to: 90, ms: 1500 }, { to: 0, ms: 200 }, { to: 0, ms: 500 }]));
    expect(events).toEqual([]);
  });

  it('waits for a clear reading when it starts lying flat', () => {
    const d = new FlipDetector();
    d.push(sampleAt(90, 0));
    expect(d.pose).toBeNull();
    run(d, simulate(90, [{ to: 180, ms: 300 }]));
    expect(d.pose).toBe('inverted');
  });
});
