import type { ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radius, space, useTheme } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top', 'bottom']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.column, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>{left}</View>
      <Text style={[styles.headerTitle, { color: theme.text }]} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function LinkButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}>
      {({ pressed }) => <Text style={[styles.link, { color: theme.accent, opacity: pressed ? 0.5 : 1 }]}>{label}</Text>}
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  kind = 'secondary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const bg = kind === 'primary' ? theme.accent : theme.surface;
  const fg = kind === 'primary' ? theme.accentText : kind === 'danger' ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: kind === 'primary' ? bg : theme.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress: () => void; color?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.chip,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.chipLabel, { color: selected ? theme.accentText : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.section, { color: theme.textMuted }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: space.md }}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        {hint && <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: theme.accent, false: theme.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<any> }) {
  const theme = useTheme();
  return <Text style={[styles.hint, { color: theme.textMuted }, style]}>{children}</Text>;
}

/** Yes/no prompt that also works in the web preview, where Alert has no buttons. */
export function confirm(title: string, message: string, ok: string, cancel: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, paddingHorizontal: space.lg, paddingBottom: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, minHeight: 52 },
  headerSide: { width: 96 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  link: { fontSize: 16, fontWeight: '500' },
  button: {
    minHeight: 50,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: space.md + 2,
    borderRadius: radius.pill,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipLabel: { fontSize: 15, fontWeight: '500' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: space.sm },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, padding: space.lg },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: space.sm },
  rowLabel: { fontSize: 16 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
