import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SkiaGate } from '../skia/SkiaGate';
import { AppProvider } from '../state/AppProvider';
import { useTheme } from '../ui/theme';

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    // The UI stays portrait-up; the sand follows gravity instead of the screen rotating (spec §5.2).
    if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <SkiaGate>
        <AppProvider>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }} />
        </AppProvider>
      </SkiaGate>
    </SafeAreaProvider>
  );
}
