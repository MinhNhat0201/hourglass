import type { Pose } from './types';

/**
 * "Up" vector in device coordinates, in g: the opposite of gravity. With the
 * phone upright in portrait, y ≈ +1; lying face up, z ≈ +1. Platform readings
 * are normalised to this convention by the sensor service.
 */
export interface MotionSample {
  x: number;
  y: number;
  z: number;
  /** Monotonic ms. */
  t: number;
}

export type DetectorEvent =
  | { type: 'flip'; pose: Pose; at: number }
  | { type: 'flat'; at: number }
  | { type: 'lift'; at: number };

export interface DetectorConfig {
  /** Angle from the current pose's axis that arms a flip. */
  flipEnterDeg: number;
  /** An armed flip is abandoned only when the angle drops back below this. */
  flipExitDeg: number;
  /** How long the new pose must hold before the flip counts. */
  flipStableMs: number;
  /** Tilt from horizontal below which the device counts as lying flat. */
  flatEnterDeg: number;
  flatExitDeg: number;
  flatStableMs: number;
  liftStableMs: number;
  /** Low-pass smoothing factor per sample (0..1, higher follows faster). */
  smoothing: number;
  /** Samples whose magnitude is outside this range (in g) are shaking, not gravity. */
  minMagnitude: number;
  maxMagnitude: number;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  flipEnterDeg: 135,
  flipExitDeg: 120,
  flipStableMs: 300,
  flatEnterDeg: 25,
  flatExitDeg: 35,
  flatStableMs: 2000,
  liftStableMs: 300,
  smoothing: 0.35,
  minMagnitude: 0.6,
  maxMagnitude: 1.4,
};

const DEG = 180 / Math.PI;

/** Angle (deg) between the up vector and the device's top edge (+y). 0 = upright, 180 = inverted. */
export function axisAngle(s: { x: number; y: number; z: number }): number {
  const m = Math.hypot(s.x, s.y, s.z) || 1;
  return Math.acos(Math.max(-1, Math.min(1, s.y / m))) * DEG;
}

/** Angle (deg) between the screen plane and the horizontal plane. 0 = lying flat. */
export function tiltFromHorizontal(s: { x: number; y: number; z: number }): number {
  const m = Math.hypot(s.x, s.y, s.z) || 1;
  return Math.acos(Math.min(1, Math.abs(s.z) / m)) * DEG;
}

/**
 * Recognises flips and lying flat from a stream of motion samples (spec §5.2),
 * with hysteresis (separate enter/exit angles) and debounce (stable time), so a
 * shaky hand neither flips nor pauses the hourglass.
 */
export class FlipDetector {
  private readonly cfg: DetectorConfig;
  private filtered: { x: number; y: number; z: number } | null = null;
  private _pose: Pose | null;
  private flipSince: number | null = null;
  private _flat = false;
  private flatSince: number | null = null;
  private liftSince: number | null = null;

  constructor(config: Partial<DetectorConfig> = {}, initialPose: Pose | null = null) {
    this.cfg = { ...DEFAULT_DETECTOR_CONFIG, ...config };
    this._pose = initialPose;
  }

  get pose(): Pose | null {
    return this._pose;
  }

  get isFlat(): boolean {
    return this._flat;
  }

  /** Smoothed up vector, for drawing the tilted sand surface. */
  get vector(): { x: number; y: number; z: number } | null {
    return this.filtered;
  }

  push(sample: MotionSample): DetectorEvent[] {
    const m = Math.hypot(sample.x, sample.y, sample.z);
    if (m < this.cfg.minMagnitude || m > this.cfg.maxMagnitude) return [];

    const a = this.cfg.smoothing;
    const f = this.filtered;
    this.filtered = f
      ? { x: f.x + a * (sample.x - f.x), y: f.y + a * (sample.y - f.y), z: f.z + a * (sample.z - f.z) }
      : { x: sample.x, y: sample.y, z: sample.z };

    return [...this.updatePose(sample.t), ...this.updateFlat(sample.t)];
  }

  private updatePose(t: number): DetectorEvent[] {
    const angle = axisAngle(this.filtered!);
    if (this._pose === null) {
      // Lying flat says nothing about which end is up; wait for a clear reading.
      if (angle < 90 - this.cfg.flatEnterDeg) this._pose = 'upright';
      else if (angle > 90 + this.cfg.flatEnterDeg) this._pose = 'inverted';
      return [];
    }
    // Angle away from the current pose's own axis.
    const away = this._pose === 'upright' ? angle : 180 - angle;
    if (this.flipSince === null) {
      if (away >= this.cfg.flipEnterDeg) this.flipSince = t;
      return [];
    }
    if (away < this.cfg.flipExitDeg) {
      this.flipSince = null;
      return [];
    }
    if (t - this.flipSince < this.cfg.flipStableMs) return [];
    this.flipSince = null;
    this._pose = this._pose === 'upright' ? 'inverted' : 'upright';
    return [{ type: 'flip', pose: this._pose, at: t }];
  }

  private updateFlat(t: number): DetectorEvent[] {
    const tilt = tiltFromHorizontal(this.filtered!);
    if (!this._flat) {
      if (tilt >= this.cfg.flatExitDeg) {
        this.flatSince = null;
        return [];
      }
      if (tilt < this.cfg.flatEnterDeg && this.flatSince === null) this.flatSince = t;
      if (this.flatSince === null || t - this.flatSince < this.cfg.flatStableMs) return [];
      this._flat = true;
      this.flatSince = null;
      return [{ type: 'flat', at: t }];
    }
    if (tilt < this.cfg.flatExitDeg) {
      this.liftSince = null;
      return [];
    }
    if (this.liftSince === null) this.liftSince = t;
    if (t - this.liftSince < this.cfg.liftStableMs) return [];
    this._flat = false;
    this.liftSince = null;
    return [{ type: 'lift', at: t }];
  }
}
