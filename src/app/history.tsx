import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatSpan, groupByDay, totalsFor } from '../domain/format';
import type { Session } from '../domain/types';
import type { Locale } from '../i18n';
import { useApp } from '../state/AppProvider';
import { Button, Card, Chip, confirm, Header, LinkButton, Muted, Screen, SectionTitle } from '../ui/kit';
import { radius, space, useTheme } from '../ui/theme';

const intlLocale = (l: Locale) => (l === 'vi' ? 'vi-VN' : 'en-US');

function formatDay(key: string, locale: Locale): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(intlLocale(locale), { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(ms: number, locale: Locale): string {
  return new Date(ms).toLocaleTimeString(intlLocale(locale), { hour: '2-digit', minute: '2-digit' });
}

export default function History() {
  const { t, sessions, locale } = useApp();
  const theme = useTheme();
  const groups = groupByDay(sessions);
  const [now] = useState(() => Date.now());
  const totals = totalsFor(sessions, now);

  return (
    <Screen>
      <Header title={t('history.title')} left={<LinkButton label={`‹ ${t('nav.back')}`} onPress={() => router.back()} />} />

      <View style={styles.totals}>
        <Card style={styles.total}>
          <Muted>{t('history.today')}</Muted>
          <Text style={[styles.totalValue, { color: theme.text }]}>{formatSpan(totals.todayMs)}</Text>
        </Card>
        <Card style={styles.total}>
          <Muted>{t('history.week')}</Muted>
          <Text style={[styles.totalValue, { color: theme.text }]}>{formatSpan(totals.weekMs)}</Text>
        </Card>
      </View>

      {groups.length === 0 && (
        <Card style={{ marginTop: space.xl }}>
          <Muted>{t('history.empty')}</Muted>
        </Card>
      )}

      {groups.map((g) => (
        <View key={g.key}>
          <View style={styles.dayRow}>
            <SectionTitle>{formatDay(g.key, locale)}</SectionTitle>
            <Text style={[styles.dayTotal, { color: theme.textMuted }]}>{formatSpan(g.trackedMs)}</Text>
          </View>
          {g.sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </View>
      ))}
    </Screen>
  );
}

function SessionRow({ session: s }: { session: Session }) {
  const { t, locale, settings, setSessionTag, deleteSession } = useApp();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const completed = s.endReason === 'completed';

  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={[styles.item, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.itemTop}>
        <View style={[styles.dot, { backgroundColor: s.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {s.hourglassName}
            {s.tag ? <Text style={{ color: theme.accent }}>{`  #${s.tag}`}</Text> : null}
          </Text>
          <Muted>
            {formatTime(s.startedAt, locale)}–{formatTime(s.endedAt, locale)} · {t('history.flips', { n: s.flipCount })}
          </Muted>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.tracked, { color: theme.text }]}>{formatSpan(s.trackedMs)}</Text>
          <Text style={[styles.badge, { color: completed ? theme.accent : theme.textMuted }]}>
            {completed ? t('history.completed') : t('history.stopped')}
          </Text>
        </View>
      </View>
      {open && (
        <View style={styles.details}>
          <Muted>{t('history.of', { total: formatSpan(s.durationMs) })}</Muted>
          {settings.tags.length > 0 && (
            <View style={styles.wrap}>
              <Chip label={t('timer.noTag')} selected={!s.tag} onPress={() => setSessionTag(s.id, undefined)} />
              {settings.tags.map((tag) => (
                <Chip key={tag} label={tag} selected={s.tag === tag} onPress={() => setSessionTag(s.id, tag)} />
              ))}
            </View>
          )}
          <Button
            kind="danger"
            label={t('history.deleteOk')}
            onPress={async () => {
              if (await confirm(t('history.delete'), s.hourglassName, t('history.deleteOk'), t('common.cancel'))) deleteSession(s.id);
            }}
            style={{ marginTop: space.sm }}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: space.md, marginTop: space.sm },
  total: { flex: 1, padding: space.md },
  totalValue: { fontSize: 26, fontWeight: '300', fontVariant: ['tabular-nums'] },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dayTotal: { fontSize: 14, marginBottom: space.sm, fontVariant: ['tabular-nums'] },
  item: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.md, marginBottom: space.sm },
  itemTop: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: space.md },
  name: { fontSize: 16, fontWeight: '500' },
  tracked: { fontSize: 17, fontVariant: ['tabular-nums'] },
  badge: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  details: { marginTop: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
});
