import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

import type { Ringtone, Settings } from '../domain/settings';

const SOURCES: Record<Ringtone, number> = {
  chime: require('../../assets/sounds/chime.wav'),
  bell: require('../../assets/sounds/bell.wav'),
  soft: require('../../assets/sounds/soft.wav'),
};

let player: AudioPlayer | null = null;
let modeSet = false;

/** In-app alarm when the sand runs out while the app is open. */
export async function playAlarm(settings: Settings): Promise<void> {
  if (settings.vibration) {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Vibration.vibrate([0, 400, 200, 400]);
    }
  }
  if (!settings.sound) return;
  try {
    if (!modeSet) {
      // Respect the silent switch: haptics stand in for sound when muted.
      await setAudioModeAsync({ playsInSilentMode: false });
      modeSet = true;
    }
    previewStop();
    player = createAudioPlayer(SOURCES[settings.ringtone]);
    player.play();
  } catch {
    // Sound is best effort; the visual state and haptics already signal the end.
  }
}

export function previewStop(): void {
  player?.release();
  player = null;
}

export async function previewRingtone(ringtone: Ringtone): Promise<void> {
  await playAlarm({ sound: true, vibration: false, ringtone } as Settings);
}

/** Light tick on flip / start so the gesture feels physical. */
export function tapHaptic(settings: Settings): void {
  if (!settings.vibration || Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
