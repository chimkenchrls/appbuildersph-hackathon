import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@/constants/theme';
import { Icon } from './Icon';

type Props = { message: string; children?: ReactNode };

/** A failure the user can act on. Children are its recovery actions. */
export function InlineError({ message, children }: Props) {
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.box}>
      <View style={styles.row}>
        <Icon name="circle-alert" size={18} color={colors.errorText} />
        <Text style={[type.body, styles.text]}>{message}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.errorSurface },
  row: { flexDirection: 'row', gap: spacing.sm },
  text: { flex: 1, color: colors.errorText },
});
