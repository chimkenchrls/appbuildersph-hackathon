import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';
import { Button } from './Button';

/** Screen-level loading text for the first data call. */
export function LoadingView({ label }: { label: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.box}>
      <ActivityIndicator color={colors.primary} />
      <Text style={type.support}>{label}</Text>
    </View>
  );
}

type MissingProps = { message: string; actionLabel: string; onAction: () => void };

/** Shown for unknown, invalid or mismatched records. Never shows unrelated content. */
export function MissingRecord({ message, actionLabel, onAction }: MissingProps) {
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={type.subheading}>Record unavailable</Text>
      <Text style={[type.support, styles.center]}>{message}</Text>
      <Button label={actionLabel} variant="secondary" onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: layout.gutter },
  center: { textAlign: 'center' },
});
