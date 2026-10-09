import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { colors, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  /** Omit once saving has started: a write in progress cannot be stopped. */
  onStop?: () => void;
  stopping?: boolean;
};

/** Says what is running. Progress is indeterminate; nothing here depends on animation. */
export function OperationPanel({ label, onStop, stopping = false }: Props) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.panel}>
      <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.row}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[type.body, styles.text]}>{label}</Text>
      </View>
      {onStop ? <Button label={stopping ? 'Stopping…' : 'Stop'} variant="secondary" icon="x" disabled={stopping} onPress={onStop} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
});
