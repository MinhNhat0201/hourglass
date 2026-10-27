/**
 * Shape of the hourglass and where the sand surfaces sit for a given amount of
 * sand. Everything is in canvas pixels; y grows downwards. The glass is
 * symmetric about its neck so the sand can be drawn in either orientation.
 */

export interface Layout {
  width: number;
  height: number;
  cx: number;
  capHeight: number;
  capRadius: number;
  baseRadius: number;
  capRy: number;
  glassTop: number;
  glassBottom: number;
  neckY: number;
  /** Half height of one chamber (neck to cap). */
  half: number;
  maxRadius: number;
  neckRadius: number;
}

export function makeLayout(width: number, height: number): Layout {
  const capHeight = height * 0.07;
  const capRy = width * 0.085;
  const glassTop = capHeight + capRy;
  const glassBottom = height - capHeight - capRy;
  return {
    width,
    height,
    cx: width / 2,
    capHeight,
    capRadius: width * 0.42,
    baseRadius: width * 0.45,
    capRy,
    glassTop,
    glassBottom,
    neckY: (glassTop + glassBottom) / 2,
    half: (glassBottom - glassTop) / 2,
    maxRadius: width * 0.34,
    neckRadius: width * 0.022,
  };
}

const PEAK = 0.56;

/** Bulb profile: 0 at the neck, 1 at the widest point, easing in again at the cap. */
export function profile(u: number): number {
  const v = Math.min(1, Math.max(0, u));
  if (v <= PEAK) return Math.pow(Math.sin((Math.PI / 2) * (v / PEAK)), 1.25);
  const k = (v - PEAK) / (1 - PEAK);
  return 1 - 0.2 * k * k;
}

/** Half-width of the glass at distance `u` (0 = neck, 1 = cap) from the neck. */
export function radiusAt(l: Layout, u: number): number {
  return l.neckRadius + (l.maxRadius - l.neckRadius) * profile(u);
}

const STEPS = 200;

/** Cumulative volume from the neck outwards, sampled at STEPS+1 points. */
function volumeTable(l: Layout): number[] {
  const table = [0];
  for (let i = 1; i <= STEPS; i++) {
    const r = radiusAt(l, (i - 0.5) / STEPS);
    table.push(table[i - 1] + r * r);
  }
  return table;
}

const cache = new WeakMap<Layout, number[]>();
function volumes(l: Layout): number[] {
  let v = cache.get(l);
  if (!v) {
    v = volumeTable(l);
    cache.set(l, v);
  }
  return v;
}

/** Share of a chamber's volume that a full charge of sand occupies. */
const CAPACITY = 0.72;

function uForVolume(table: number[], volume: number): number {
  let lo = 0;
  let hi = STEPS;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (table[mid] < volume) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return 0;
  const prev = table[lo - 1];
  const step = table[lo] - prev || 1;
  return (lo - 1 + (volume - prev) / step) / STEPS;
}

/**
 * Distance from the neck (0..1 of a chamber) of the sand surface in the upper
 * chamber, which drains from the top down towards the neck.
 */
export function upperLevel(l: Layout, fraction: number): number {
  const table = volumes(l);
  return uForVolume(table, Math.max(0, Math.min(1, fraction)) * CAPACITY * table[STEPS]);
}

/** Distance from the neck of the sand surface in the lower chamber, which fills from the cap up. */
export function lowerLevel(l: Layout, fraction: number): number {
  const table = volumes(l);
  const total = table[STEPS];
  return uForVolume(table, total - Math.max(0, Math.min(1, fraction)) * CAPACITY * total);
}

/** Outline of the glass as a closed polygon. */
export function glassOutline(l: Layout, samples = 64): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= samples; i++) {
    const y = l.glassTop + (2 * l.half * i) / samples;
    pts.push([l.cx - radiusAt(l, Math.abs(y - l.neckY) / l.half), y]);
  }
  for (let i = samples; i >= 0; i--) {
    const y = l.glassTop + (2 * l.half * i) / samples;
    pts.push([l.cx + radiusAt(l, Math.abs(y - l.neckY) / l.half), y]);
  }
  return pts;
}
