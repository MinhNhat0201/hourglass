import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HourglassView } from '../components/hourglass/HourglassView';
import { systemClock } from '../domain/clock';
import { project } from '../domain/engine';
import { formatClock, formatSpan } from '../domain/format';
import type { MessageKey } from '../i18n';
import { useApp } from '../state/AppProvider';
import { Button, Chip, Header, LinkButton, Muted } from '../ui/kit';
import { space, useTheme } from '../ui/theme';

const SPIN_MS = 450;
const MAX_SLOPE = 0.8;

/** Re-renders every animation frame while `active`. */
function useFrame(active: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    let id = 0;
    const loop = () => {
      setNow(performance.now());
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [active]);
  return now;
}

export default function Timer() {
  const app = useApp();
  const { t, runtime, settings, motion } = app;
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [showDigits, setShowDigits] = useState(settings.showDigits);
  const [spinStart, setSpinStart] = useState<number | null>(null);

  const running = runtime?.phase === 'running';
  const spinning = spinStart !== null;
  const frame = useFrame(!!runtime && (running || spinning || motion.available));

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (running) activateKeepAwakeAsync('timer').catch(() => {});
    else deactivateKeepAwake('timer').catch(() => {});
    return () => {
      deactivateKeepAwake('timer').catch(() => {});
    };
  }, [running]);

  if (!runtime) return <Redirect href="/" />;

  const view = project(runtime, systemClock());
  const d = view.hourglass.durationMs;
  const inverted = motion.available && motion.pose === 'inverted';

  const v = motion.vectorRef.current;
  const slope = v && Math.abs(v.y) > 0.35 ? Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, v.x / v.y)) : 0;

  const p = spinStart === null ? 1 : Math.min(1, (frame - spinStart) / SPIN_MS);
  const spin = spinStart === null ? 0 : 180 * (1 - (1 - Math.pow(1 - p, 3)));

  const canvasH = Math.min(height * 0.58, 560);
  const canvasW = Math.min(width - space.lg * 2, canvasH / 1.55);

  const phase = view.phase;
  const hintKey: MessageKey =
    phase === 'idle'
      ? motion.available
        ? 'timer.hintIdle'
        : 'timer.hintIdleButtons'
      : phase === 'running'
        ? motion.available
          ? 'timer.hintRunning'
          : 'timer.hintPaused'
        : phase === 'paused'
          ? view.pauseReason === 'flat'
            ? 'timer.hintFlat'
            : 'timer.hintPaused'
          : phase === 'completed'
            ? view.hourglass.autoRepeat && motion.available
              ? 'timer.hintCompletedRepeat'
              : 'timer.hintCompleted'
            : 'timer.hintStopped';
  const hint = phase === 'running' && !motion.available ? '' : t(hintKey);

  /** Spins the drawing half a turn so a button flip reads like turning the glass over. */
  const animateFlip = () => {
    setSpinStart(performance.now());
    setTimeout(() => setSpinStart(null), SPIN_MS);
  };

  const flipByButton = () => {
    animateFlip();
    app.flip();
  };

  const time = formatClock(view.upperMs);
  const a11yState = t(`a11y.${phase}`, { time });
  const finished = phase === 'completed' || phase === 'stopped';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom']}>
      <View style={styles.column}>
        <Header
          title={view.hourglass.name}
          left={<LinkButton label={`‹ ${t('nav.back')}`} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
          right={<LinkButton label={showDigits ? t('timer.hideDigits') : t('timer.showDigits')} onPress={() => setShowDigits((s) => !s)} />}
        />

        <View
          style={styles.stage}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${t('a11y.hourglass', { name: view.hourglass.name })}. ${a11yState}`}
        >
          <HourglassView
            width={canvasW}
            height={canvasW * 1.55}
            upper={view.upperMs / d}
            lower={view.lowerMs / d}
            flowing={phase === 'running'}
            color={view.hourglass.color}
            inverted={inverted}
            slope={slope}
            spin={spin}
            time={frame}
          />
        </View>

        <View style={[styles.readout, inverted && styles.upsideDown]}>
          {showDigits && (
            <Text
              style={[styles.digits, { color: theme.text, fontSize: settings.largeDigits ? 72 : 48 }]}
              accessibilityLabel={a11yState}
              allowFontScaling
            >
              {time}
            </Text>
          )}
          {!!hint && <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>}
          {finished && (
            <Muted style={styles.center}>
              {t('timer.summary', { time: formatSpan(view.trackedMs), flips: view.flipCount })}
            </Muted>
          )}
        </View>

        {settings.tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tags} contentContainerStyle={{ paddingRight: space.lg }}>
            <Chip label={t('timer.noTag')} selected={!view.tag} onPress={() => app.setTag(undefined)} />
            {settings.tags.map((tag) => (
              <Chip key={tag} label={tag} selected={view.tag === tag} onPress={() => app.setTag(tag)} />
            ))}
          </ScrollView>
        )}

        <View style={styles.controls}>
          {phase === 'idle' && <Button kind="primary" label={t('timer.start')} onPress={app.start} style={styles.wide} />}
          {(phase === 'running' || phase === 'paused') && (
            <>
              {phase === 'running' ? (
                <Button kind="primary" label={t('timer.pause')} onPress={app.pause} style={styles.flex} />
              ) : (
                <Button kind="primary" label={t('timer.resume')} onPress={app.resume} style={styles.flex} />
              )}
              <Button label={`⟲ ${t('timer.flip')}`} onPress={flipByButton} style={styles.flex} />
              <Button kind="danger" label={t('timer.stop')} onPress={app.stop} style={styles.flex} />
            </>
          )}
          {finished && (
            <>
              <Button
                kind="primary"
                label={t('timer.repeat')}
                onPress={() => {
                  animateFlip();
                  app.repeat();
                }}
                style={styles.flex}
              />
              <Button
                label={t('timer.close')}
                onPress={() => {
                  app.close();
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}
                style={styles.flex}
              />
            </>
          )}
        </View>
        {!motion.available && Platform.OS !== 'web' && <Muted style={styles.center}>{t('timer.noSensor')}</Muted>}
        {app.notificationsAllowed === false && <Muted style={styles.center}>{t('settings.notifDenied')}</Muted>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 },
  readout: { alignItems: 'center', minHeight: 72, justifyContent: 'center' },
  upsideDown: { transform: [{ rotate: '180deg' }] },
  digits: { fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  hint: { fontSize: 15, textAlign: 'center', marginTop: space.xs },
  center: { textAlign: 'center', marginTop: space.xs },
  tags: { flexGrow: 0, marginTop: space.md },
  controls: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  flex: { flex: 1 },
  wide: { flex: 1 },
});
