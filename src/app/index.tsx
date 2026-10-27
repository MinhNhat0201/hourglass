import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { systemClock } from '../domain/clock';
import { project } from '../domain/engine';
import { formatClock, formatSpan, MAX_FAVORITES, PRESET_MINUTES, totalsFor } from '../domain/format';
import { SAND_COLORS } from '../domain/settings';
import type { Hourglass } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { Card, Chip, confirm, Header, LinkButton, Muted, Screen, SectionTitle } from '../ui/kit';
import { radius, space, useTheme } from '../ui/theme';

function presetHourglass(minutes: number, name: string): Hourglass {
  return { id: `preset-${minutes}`, name, durationMs: minutes * 60_000, color: SAND_COLORS[0], autoRepeat: false, createdAt: 0 };
}

export default function Home() {
  const app = useApp();
  const { t, runtime, hourglasses, sessions } = app;
  const theme = useTheme();

  // A session restored after the app was killed opens straight on the timer.
  const routedRestore = useRef(false);
  useEffect(() => {
    if (!app.ready || routedRestore.current) return;
    routedRestore.current = true;
    if (runtime && runtime.phase !== 'idle') router.push('/timer');
  }, [app.ready, runtime]);

  const live = runtime && (runtime.phase === 'running' || runtime.phase === 'paused');

  const openTimer = async (h: Hourglass) => {
    if (live && runtime.hourglass.id !== h.id) {
      const ok = await confirm(t('home.replaceTitle'), t('home.replaceBody', { name: runtime.hourglass.name }), t('home.replaceOk'), t('common.cancel'));
      if (!ok) return;
    }
    app.open(h);
    router.push('/timer');
  };

  const [now] = useState(() => Date.now());
  const totals = totalsFor(sessions, now);
  const full = hourglasses.length >= MAX_FAVORITES;

  return (
    <Screen>
      <Header
        title={t('app.title')}
        left={<LinkButton label={t('nav.history')} onPress={() => router.push('/history')} />}
        right={<LinkButton label={t('nav.settings')} onPress={() => router.push('/settings')} />}
      />

      {live && <LiveBanner />}

      <View style={styles.stats}>
        <Stat label={t('home.today')} value={formatSpan(totals.todayMs)} />
        <Stat label={t('home.week')} value={formatSpan(totals.weekMs)} />
      </View>

      <SectionTitle>{t('home.quick')}</SectionTitle>
      <View style={styles.wrap}>
        {PRESET_MINUTES.map((m) => (
          <Chip key={m} label={t('preset.name', { n: m })} onPress={() => openTimer(presetHourglass(m, t('preset.name', { n: m })))} />
        ))}
      </View>

      <View style={styles.sectionRow}>
        <SectionTitle>{t('home.mine')}</SectionTitle>
        <LinkButton label={`+ ${t('home.new')}`} onPress={() => (full ? undefined : router.push('/editor'))} />
      </View>
      {full && <Muted>{t('home.limit', { n: MAX_FAVORITES })}</Muted>}
      {hourglasses.length === 0 ? (
        <Card>
          <Muted>{t('home.empty')}</Muted>
        </Card>
      ) : (
        hourglasses.map((h) => (
          <Pressable
            key={h.id}
            onPress={() => openTimer(h)}
            onLongPress={() => router.push({ pathname: '/editor', params: { id: h.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${h.name}, ${formatSpan(h.durationMs)}`}
            accessibilityHint={t('editor.edit')}
            style={({ pressed }) => [styles.item, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.swatch, { backgroundColor: h.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                {h.name}
              </Text>
              <Muted>
                {formatSpan(h.durationMs)}
                {h.autoRepeat ? ` · ${t('editor.autoRepeat')}` : ''}
              </Muted>
            </View>
            <LinkButton label={t('common.edit')} onPress={() => router.push({ pathname: '/editor', params: { id: h.id } })} />
          </Pressable>
        ))
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Muted>{label}</Muted>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function LiveBanner() {
  const { runtime, t } = useApp();
  const theme = useTheme();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  if (!runtime) return null;
  const view = project(runtime, systemClock());
  return (
    <Pressable
      onPress={() => router.push('/timer')}
      accessibilityRole="button"
      style={({ pressed }) => [styles.banner, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.swatch, { backgroundColor: runtime.hourglass.color, borderColor: theme.accentText, borderWidth: 1 }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerLabel, { color: theme.accentText }]}>
          {runtime.phase === 'paused' ? t('home.paused') : t('home.running')} · {runtime.hourglass.name}
        </Text>
      </View>
      <Text style={[styles.bannerTime, { color: theme.accentText }]}>{formatClock(view.upperMs)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  stat: { flex: 1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.md },
  statValue: { fontSize: 24, fontWeight: '300', marginTop: 2, fontVariant: ['tabular-nums'] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: space.md,
    marginBottom: space.sm,
    minHeight: 64,
  },
  swatch: { width: 28, height: 28, borderRadius: 14, marginRight: space.md },
  itemName: { fontSize: 17, fontWeight: '500' },
  banner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  bannerLabel: { fontSize: 15, fontWeight: '600' },
  bannerTime: { fontSize: 20, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
