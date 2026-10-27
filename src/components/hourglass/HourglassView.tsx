import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Oval,
  Path,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import { glassOutline, lowerLevel, makeLayout, radiusAt, upperLevel, type Layout } from './geometry';

export interface HourglassViewProps {
  width: number;
  height: number;
  /** Sand in the physically upper chamber, 0..1 of the full charge. */
  upper: number;
  /** Sand in the physically lower chamber, 0..1. */
  lower: number;
  /** Sand is falling through the neck. */
  flowing: boolean;
  color: string;
  /** Device held upside down: the upper chamber is at the bottom of the screen. */
  inverted: boolean;
  /** Slope of the sand surface (dy/dx in screen space) from the device's tilt. */
  slope: number;
  /** Extra rotation (deg) of the whole hourglass, for the button-flip animation. */
  spin: number;
  /** Animation clock (ms) driving the falling grains. */
  time: number;
}

const WOOD = {
  edgeDark: '#8E6436',
  edge: '#B58552',
  light: '#DDB98A',
  face: '#E3C394',
  faceDark: '#C99E68',
  grain: 'rgba(120, 78, 36, 0.18)',
};

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const mix = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function polygon(points: [number, number][]): SkPath {
  const p = Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.close();
  return p.detach();
}

/** A wooden disc: the side band plus the top face, seen slightly from above. */
function WoodDisc({ cx, top, radius, ry, thickness }: { cx: number; top: number; radius: number; ry: number; thickness: number }) {
  const side = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(cx - radius, top + ry);
    p.lineTo(cx - radius, top + ry + thickness);
    p.arcToOval(Skia.XYWHRect(cx - radius, top + thickness, radius * 2, ry * 2), 180, -180, false);
    p.lineTo(cx + radius, top + ry);
    p.close();
    return p.detach();
  }, [cx, top, radius, ry, thickness]);
  const rings = [0.78, 0.55, 0.3];
  return (
    <Group>
      <Path path={side}>
        <LinearGradient
          start={vec(cx - radius, 0)}
          end={vec(cx + radius, 0)}
          colors={[WOOD.edgeDark, WOOD.edge, WOOD.light, WOOD.edge, WOOD.edgeDark]}
          positions={[0, 0.18, 0.45, 0.82, 1]}
        />
      </Path>
      <Oval x={cx - radius} y={top} width={radius * 2} height={ry * 2}>
        <LinearGradient start={vec(cx, top)} end={vec(cx, top + ry * 2)} colors={[WOOD.face, WOOD.faceDark]} />
      </Oval>
      {rings.map((k) => (
        <Oval
          key={k}
          x={cx - radius * k}
          y={top + ry * (1 - k)}
          width={radius * 2 * k}
          height={ry * 2 * k}
          style="stroke"
          strokeWidth={1}
          color={WOOD.grain}
        />
      ))}
    </Group>
  );
}

/** Sand surface sampled across the glass, with a dip or a mound in the middle. */
function surface(l: Layout, y: number, slope: number, bump: number, radius: number): [number, number][] {
  const pts: [number, number][] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const dx = -radius + (2 * radius * i) / n;
    // Smooth bell: a rounded heap below, a soft funnel above.
    const k = Math.min(1, Math.abs(dx) / Math.max(radius * 0.85, 1));
    const shape = 0.5 * (1 + Math.cos(Math.PI * k));
    pts.push([l.cx + dx, y + slope * dx + bump * shape]);
  }
  return pts;
}

function SandAndStream({ l, upper, lower, flowing, color, slope, time }: { l: Layout } & Omit<HourglassViewProps, 'width' | 'height' | 'inverted' | 'spin'>) {
  const dark = shade(color, -0.22);
  const light = shade(color, 0.18);
  const reach = l.maxRadius * 1.1;

  const uUp = upperLevel(l, upper);
  const uLow = lowerLevel(l, lower);
  const upperY = l.neckY - uUp * l.half;
  const lowerY = l.neckY + uLow * l.half;

  // Upper surface dips towards the neck while draining; lower one heaps into a cone.
  const dip = flowing && upper > 0 ? Math.min(l.half * 0.07, uUp * l.half * 0.45) : 0;
  const mound = lower > 0 ? Math.min(l.half * 0.12, (1 - uLow) * l.half * 0.6) : 0;

  const upperPath = useMemo(() => {
    if (upper <= 0) return null;
    return polygon([...surface(l, upperY, slope, dip, reach), [l.cx + reach, l.neckY + 2], [l.cx - reach, l.neckY + 2]]);
  }, [l, upper, upperY, slope, dip, reach]);

  const lowerPath = useMemo(() => {
    if (lower <= 0) return null;
    return polygon([...surface(l, lowerY, slope, -mound, reach), [l.cx + reach, l.glassBottom + 2], [l.cx - reach, l.glassBottom + 2]]);
  }, [l, lower, lowerY, slope, mound, reach]);

  const stream = flowing && upper > 0;
  const streamEnd = lower > 0 ? lowerY - mound : l.glassBottom;
  const streamLen = Math.max(0, streamEnd - l.neckY);
  const grains = stream ? 7 : 0;

  return (
    <Group>
      {upperPath && (
        <Path path={upperPath}>
          <LinearGradient start={vec(l.cx, upperY)} end={vec(l.cx, l.neckY)} colors={[light, color, dark]} />
        </Path>
      )}
      {lowerPath && (
        <Path path={lowerPath}>
          <LinearGradient start={vec(l.cx, lowerY - mound)} end={vec(l.cx, l.glassBottom)} colors={[light, color, dark]} />
        </Path>
      )}
      {stream && (
        <Path
          path={`M ${l.cx} ${l.neckY - 2} L ${l.cx + slope * -streamLen * 0.15} ${streamEnd}`}
          style="stroke"
          strokeWidth={Math.max(1.5, l.neckRadius * 0.7)}
          strokeCap="round"
          color={color}
        />
      )}
      {Array.from({ length: grains }, (_, i) => {
        const p = ((time / 900 + i / grains) % 1 + 1) % 1;
        const side = i % 2 === 0 ? 1 : -1;
        return (
          <Circle
            key={i}
            cx={l.cx + side * l.neckRadius * 0.5 * Math.sin(i * 1.7 + time / 300)}
            cy={l.neckY + p * streamLen}
            r={Math.max(1, l.neckRadius * 0.38)}
            color={dark}
          />
        );
      })}
    </Group>
  );
}

function HourglassViewImpl(props: HourglassViewProps) {
  const { width, height, inverted, spin } = props;
  const l = useMemo(() => makeLayout(width, height), [width, height]);
  const glass = useMemo(() => polygon(glassOutline(l)), [l]);

  const highlight = useMemo(() => {
    // A curved reflection along the left side of each bulb.
    const p = Skia.PathBuilder.Make();
    for (const dir of [-1, 1]) {
      const n = 20;
      for (let i = 0; i <= n; i++) {
        const u = 0.25 + (0.6 * i) / n;
        const x = l.cx - radiusAt(l, u) * 0.72;
        const y = l.neckY + dir * u * l.half;
        if (i === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
    }
    return p.detach();
  }, [l]);

  const capTop = 0;
  const baseTop = height - l.capHeight - l.capRy * 2;

  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ rotate: (spin * Math.PI) / 180 }]} origin={vec(l.cx, l.neckY)}>
        <Oval x={l.cx - l.baseRadius * 0.95} y={height - l.capRy * 1.2} width={l.baseRadius * 1.9} height={l.capRy * 1.2} color="rgba(60, 40, 20, 0.22)">
          <BlurMask blur={10} style="normal" />
        </Oval>
        <WoodDisc cx={l.cx} top={baseTop} radius={l.baseRadius} ry={l.capRy} thickness={l.capHeight} />

        <Path path={glass} color="rgba(255, 255, 255, 0.18)" />
        <Group clip={glass}>
          <Group transform={inverted ? [{ rotate: Math.PI }] : []} origin={vec(l.cx, l.neckY)}>
            <SandAndStream l={l} {...props} />
          </Group>
          <Path path={glass} style="stroke" strokeWidth={l.width * 0.05} color="rgba(255, 255, 255, 0.12)" />
        </Group>
        <Path path={highlight} style="stroke" strokeWidth={l.width * 0.028} strokeCap="round" color="rgba(255, 255, 255, 0.55)">
          <BlurMask blur={2} style="normal" />
        </Path>
        <Path path={glass} style="stroke" strokeWidth={1.5} color="rgba(110, 120, 130, 0.45)" />

        <WoodDisc cx={l.cx} top={capTop} radius={l.capRadius} ry={l.capRy} thickness={l.capHeight} />
      </Group>
    </Canvas>
  );
}

export const HourglassView = memo(HourglassViewImpl);
