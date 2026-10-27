import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { clampDuration, joinDuration, MAX_DURATION_MS, MIN_DURATION_MS, PRESET_MINUTES, splitDuration } from '../domain/format';
import { SAND_COLORS } from '../domain/settings';
import type { Hourglass } from '../domain/types';
import { newId, useApp } from '../state/AppProvider';
import { Button, Chip, confirm, Header, LinkButton, Muted, Screen, SectionTitle, ToggleRow } from '../ui/kit';
import { radius, space, useTheme } from '../ui/theme';

export default function Editor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const app = useApp();
  const { t } = app;
  const theme = useTheme();
  const existing = app.hourglasses.find((h) => h.id === id);

  const initial = splitDuration(existing?.durationMs ?? 25 * 60_000);
  const [name, setName] = useState(existing?.name ?? '');
  const [h, setH] = useState(initial.h);
  const [m, setM] = useState(initial.m);
  const [s, setS] = useState(initial.s);
  const [color, setColor] = useState(existing?.color ?? SAND_COLORS[0]);
  const [autoRepeat, setAutoRepeat] = useState(existing?.autoRepeat ?? false);

  const raw = joinDuration(h, m, s);
  const valid = raw >= MIN_DURATION_MS && raw <= MAX_DURATION_MS;

  const setMinutes = (total: number) => {
    const parts = splitDuration(total * 60_000);
    setH(parts.h);
    setM(parts.m);
    setS(0);
  };

  const save = async () => {
    const hourglass: Hourglass = {
      id: existing?.id ?? newId(),
      name: name.trim() || t('editor.defaultName'),
      durationMs: clampDuration(raw),
      color,
      autoRepeat,
      createdAt: existing?.createdAt ?? Date.now(),
    };
    await app.saveHourglass(hourglass);
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm(t('editor.delete'), t('editor.deleteConfirm', { name: existing.name }), t('history.deleteOk'), t('common.cancel'));
    if (!ok) return;
    await app.deleteHourglass(existing.id);
    router.back();
  };

  return (
    <Screen>
      <Header
        title={existing ? t('editor.edit') : t('editor.new')}
        left={<LinkButton label={t('common.cancel')} onPress={() => router.back()} />}
        right={valid ? <LinkButton label={t('editor.save')} onPress={save} /> : null}
      />

      <SectionTitle>{t('editor.name')}</SectionTitle>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t('editor.namePlaceholder')}
        placeholderTextColor={theme.textMuted}
        maxLength={40}
        accessibilityLabel={t('editor.name')}
        style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />

      <SectionTitle>{t('editor.duration')}</SectionTitle>
      <View style={styles.wrap}>
        {PRESET_MINUTES.map((min) => (
          <Chip key={min} label={t('preset.name', { n: min })} selected={raw === min * 60_000} onPress={() => setMinutes(min)} />
        ))}
      </View>
      <View style={styles.picker}>
        <Field label={t('editor.hours')} value={h} max={12} onChange={setH} />
        <Field label={t('editor.minutes')} value={m} max={59} onChange={setM} />
        <Field label={t('editor.seconds')} value={s} max={59} onChange={setS} />
      </View>
      <Muted style={!valid && { color: theme.danger }}>{t('editor.range')}</Muted>

      <SectionTitle>{t('editor.color')}</SectionTitle>
      <View style={styles.wrap}>
        {SAND_COLORS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColor(c)}
            accessibilityRole="radio"
            accessibilityState={{ selected: c === color }}
            accessibilityLabel={c}
            style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? theme.text : 'transparent' }]}
          />
        ))}
      </View>

      <ToggleRow label={t('editor.autoRepeat')} hint={t('editor.autoRepeatHint')} value={autoRepeat} onChange={setAutoRepeat} />

      <Button kind="primary" label={t('editor.save')} onPress={save} disabled={!valid} style={{ marginTop: space.xl }} />
      {existing && <Button kind="danger" label={t('editor.delete')} onPress={remove} style={{ marginTop: space.md }} />}
    </Screen>
  );
}

function Field({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  const theme = useTheme();
  const set = (v: number) => onChange(Math.max(0, Math.min(max, v)));
  return (
    <View style={[styles.field, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Stepper label="+" onPress={() => set(value + 1)} a11y={`${label} +1`} />
      <TextInput
        value={String(value).padStart(2, '0')}
        onChangeText={(text) => set(parseInt(text.replace(/\D/g, '') || '0', 10))}
        keyboardType="number-pad"
        selectTextOnFocus
        maxLength={2}
        accessibilityLabel={label}
        style={[styles.fieldValue, { color: theme.text }]}
      />
      <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
      <Stepper label="−" onPress={() => set(value - 1)} a11y={`${label} −1`} />
    </View>
  );
}

function Stepper({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6} style={styles.stepper}>
      {({ pressed }) => <Text style={[styles.stepperLabel, { color: theme.accent, opacity: pressed ? 0.4 : 1 }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 50, fontSize: 17 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  picker: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, marginBottom: space.sm },
  field: { flex: 1, alignItems: 'center', borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingVertical: space.xs },
  fieldValue: { fontSize: 34, fontWeight: '300', textAlign: 'center', minWidth: 64, fontVariant: ['tabular-nums'], paddingVertical: 0 },
  fieldLabel: { fontSize: 13 },
  stepper: { width: '100%', alignItems: 'center', paddingVertical: space.xs, minHeight: 40, justifyContent: 'center' },
  stepperLabel: { fontSize: 26, fontWeight: '400' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, marginRight: space.sm, marginBottom: space.sm },
});
