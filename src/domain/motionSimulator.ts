import type { MotionSample } from './flipDetector';

/**
 * Synthetic sensor input for exercising the flip detector without a device.
 * Angles are rotation about the device's x axis: 0° upright, 180° inverted,
 * 90° lying face up.
 */

const RAD = Math.PI / 180;

export function sampleAt(angleDeg: number, t: number, noise: { x?: number; y?: number; z?: number } = {}): MotionSample {
  return {
    x: noise.x ?? 0,
    y: Math.cos(angleDeg * RAD) + (noise.y ?? 0),
    z: Math.sin(angleDeg * RAD) + (noise.z ?? 0),
    t,
  };
}

export interface Segment {
  /** Angle to move to (linearly) over `ms`, then hold. */
  to: number;
  ms: number;
}

/** Samples a path of rotations starting at `from`, every `stepMs`. */
export function simulate(from: number, segments: Segment[], stepMs = 20, startT = 0): MotionSample[] {
  const out: MotionSample[] = [];
  let angle = from;
  let t = startT;
  out.push(sampleAt(angle, t));
  for (const seg of segments) {
    const steps = Math.max(1, Math.round(seg.ms / stepMs));
    const start = angle;
    for (let i = 1; i <= steps; i++) {
      t += stepMs;
      angle = start + ((seg.to - start) * i) / steps;
      out.push(sampleAt(angle, t));
    }
  }
  return out;
}

/** Deterministic hand tremor: small sinusoidal wobble around `baseDeg`. */
export function tremor(baseDeg: number, amplitudeDeg: number, ms: number, stepMs = 20, startT = 0): MotionSample[] {
  const out: MotionSample[] = [];
  for (let t = 0; t <= ms; t += stepMs) {
    const wobble = amplitudeDeg * Math.sin(t / 37) * Math.cos(t / 91);
    out.push(sampleAt(baseDeg + wobble, startT + t, { x: 0.05 * Math.sin(t / 13) }));
  }
  return out;
}
