import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { Ringtone, Settings } from '../domain/settings';
import { RINGTONES } from '../domain/settings';

/**
 * Local "time's up" notification (spec §5.4). It is scheduled for the expected
 * end time whenever the sand is running and rescheduled on every flip, so it fires
 * even if the app is in the background, the screen is locked or the process was
 * killed. While the app is in the foreground it is suppressed and the in-app alarm
 * plays instead.
 */

const supported = Platform.OS === 'ios' || Platform.OS === 'android';
let scheduledId: string | null = null;

function channelId(ringtone: Ringtone | 'silent', vibrate: boolean): string {
  return `alarm-${ringtone}-${vibrate ? 'v' : 'nv'}`;
}

export async function setupNotifications(): Promise<void> {
  if (!supported) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    // Android fixes sound and vibration per channel, so make one per combination.
    for (const tone of [...RINGTONES, 'silent'] as const) {
      for (const vibrate of [true, false]) {
        await Notifications.setNotificationChannelAsync(channelId(tone, vibrate), {
          name: `Hourglass – ${tone}${vibrate ? '' : ' (no vibration)'}`,
          importance: AndroidImportance.HIGH,
          sound: tone === 'silent' ? null : `${tone}.wav`,
          enableVibrate: vibrate,
          vibrationPattern: vibrate ? [0, 400, 200, 400] : undefined,
        });
      }
    }
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function scheduleEnd(endWall: number, content: { title: string; body: string }, settings: Settings): Promise<void> {
  if (!supported) return;
  await cancelEnd();
  const tone = settings.sound ? settings.ringtone : 'silent';
  scheduledId = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      sound: settings.sound ? `${settings.ringtone}.wav` : false,
      vibrate: settings.vibration ? [0, 400, 200, 400] : undefined,
      interruptionLevel: 'timeSensitive',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: endWall,
      channelId: channelId(tone, settings.vibration),
      delivery: 'alarmClock',
    },
  });
}

export async function cancelEnd(): Promise<void> {
  if (!supported) return;
  const id = scheduledId;
  scheduledId = null;
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
  // After a restart the id is gone; clear anything left over from the last run.
  else await Notifications.cancelAllScheduledNotificationsAsync();
}
