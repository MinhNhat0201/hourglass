import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { RINGTONES, type Language } from '../domain/settings';
import { useApp } from '../state/AppProvider';
import { previewRingtone } from '../services/alarm';
import { Button, Chip, Header, LinkButton, Muted, Screen, SectionTitle, ToggleRow } from '../ui/kit';
import { radius, space, useTheme } from '../ui/theme';

const LANGUAGES: Language[] = ['system', 'vi', 'en'];

export default function SettingsScreen() {
  const { t, settings, updateSettings, notificationsAllowed } = useApp();
  const theme = useTheme();
  const [tag, setTag] = useState('');

  const addTag = () => {
    const value = tag.trim();
    if (!value || settings.tags.includes(value)) return;
    updateSettings({ tags: [...settings.tags, value] });
    setTag('');
  };

  return (
    <Screen>
      <Header title={t('settings.title')} left={<LinkButton label={`‹ ${t('nav.back')}`} onPress={() => router.back()} />} />

      <SectionTitle>{t('settings.alarm')}</SectionTitle>
      <ToggleRow label={t('settings.sound')} value={settings.sound} onChange={(sound) => updateSettings({ sound })} />
      <ToggleRow label={t('settings.vibration')} value={settings.vibration} onChange={(vibration) => updateSettings({ vibration })} />
      <Muted style={{ marginTop: space.sm }}>{t('settings.ringtone')}</Muted>
      <View style={styles.wrap}>
        {RINGTONES.map((r) => (
          <Chip
            key={r}
            label={t(`settings.ringtone.${r}`)}
            selected={settings.ringtone === r}
            onPress={() => {
              updateSettings({ ringtone: r });
              previewRingtone(r);
            }}
          />
        ))}
      </View>
      {notificationsAllowed === false && <Muted style={{ color: theme.danger }}>{t('settings.notifDenied')}</Muted>}

      <SectionTitle>{t('settings.behavior')}</SectionTitle>
      <ToggleRow
        label={t('settings.pauseWhenFlat')}
        hint={t('settings.pauseWhenFlatHint')}
        value={settings.pauseWhenFlat}
        onChange={(pauseWhenFlat) => updateSettings({ pauseWhenFlat })}
      />
      <ToggleRow label={t('settings.showDigits')} value={settings.showDigits} onChange={(showDigits) => updateSettings({ showDigits })} />
      <ToggleRow label={t('settings.largeDigits')} value={settings.largeDigits} onChange={(largeDigits) => updateSettings({ largeDigits })} />

      <SectionTitle>{t('settings.language')}</SectionTitle>
      <View style={styles.wrap}>
        {LANGUAGES.map((l) => (
          <Chip key={l} label={t(`settings.language.${l}`)} selected={settings.language === l} onPress={() => updateSettings({ language: l })} />
        ))}
      </View>

      <SectionTitle>{t('settings.tags')}</SectionTitle>
      <View style={styles.wrap}>
        {settings.tags.map((x) => (
          <Chip key={x} label={`${x}  ✕`} onPress={() => updateSettings({ tags: settings.tags.filter((y) => y !== x) })} />
        ))}
      </View>
      <View style={styles.tagRow}>
        <TextInput
          value={tag}
          onChangeText={setTag}
          onSubmitEditing={addTag}
          placeholder={t('settings.tagPlaceholder')}
          placeholderTextColor={theme.textMuted}
          maxLength={24}
          returnKeyType="done"
          accessibilityLabel={t('settings.tagPlaceholder')}
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        />
        <Button label={t('settings.add')} onPress={addTag} disabled={!tag.trim()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm },
  tagRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, minWidth: 0, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: 50, fontSize: 16 },
});
