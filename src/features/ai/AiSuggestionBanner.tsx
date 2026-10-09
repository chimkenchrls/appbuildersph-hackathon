import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { colors, spacing, type } from '@/constants/theme';

type Props = { text?: string; children?: ReactNode };

/** The one treatment for AI output, used wherever a suggestion appears. */
export function AiSuggestionBanner({ text = 'AI suggestion. Review before using.', children }: Props) {
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Icon name="sparkles" size={18} color={colors.aiText} />
        <Text style={[type.label, styles.text]}>{text}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.aiSurface },
  row: { flexDirection: 'row', gap: spacing.sm },
  text: { flex: 1, color: colors.aiText },
});
