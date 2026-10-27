import { Accelerometer } from 'expo-sensors';
import { Platform } from 'react-native';

import type { MotionSample } from '../domain/flipDetector';

const INTERVAL_MS = 33;

/**
 * Raw accelerometer readings differ per platform: Android reports the reaction
 * to gravity (upright ≈ +y), iOS reports gravity itself (upright ≈ −y). Both are
 * normalised to the "up vector" convention the flip detector expects. On web the
 * module reports orientation angles rather than acceleration, so flipping is
 * unavailable there and the app runs on buttons only.
 */
const SIGN = Platform.OS === 'ios' ? -1 : 1;

export async function isMotionAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Accelerometer.isAvailableAsync();
  } catch {
    return false;
  }
}

export function subscribeMotion(listener: (sample: MotionSample) => void): () => void {
  Accelerometer.setUpdateInterval(INTERVAL_MS);
  const sub = Accelerometer.addListener(({ x, y, z }) => {
    listener({ x: SIGN * x, y: SIGN * y, z: SIGN * z, t: performance.now() });
  });
  return () => sub.remove();
}
