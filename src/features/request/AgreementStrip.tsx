import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { colors, layout, spacing, type } from '@/constants/theme';
import { agreementLabel } from '@/features/scope/AgreementView';
import type { Agreement } from '@/types/workspace';

/** Names the exact agreement version an analysis uses; expands to its requirements. */
export function AgreementStrip({ agreement }: { agreement: Agreement }) {
  const [expanded, setExpanded] = useState(false);
  const label = `Comparing against ${agreementLabel(agreement)}`;
  return (
    <View style={styles.strip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={expanded ? 'Hides the recorded requirements' : 'Shows the recorded requirements'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        android_ripple={{ color: colors.surfaceRaised }}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Icon name="lock" size={16} color={colors.primary} />
        <Text style={[type.mono, styles.label]}>{label}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>
      {expanded ? (
        <View style={styles.list}>
          {agreement.requirements.map(item => (
            <View key={item.id} style={styles.row}>
              <Text style={[type.mono, styles.id]}>{item.id}</Text>
              <Text style={[type.body, styles.text]}>{item.kind === 'exclusion' ? `Excluded: ${item.text}` : item.text}</Text>
            </View>
          ))}
          <Text style={type.support}>{`Revision terms: ${agreement.terms.revisionTerms ?? 'Not specified'}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.primary },
  toggle: { minHeight: layout.minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { flex: 1, color: colors.primary },
  list: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  id: { minWidth: 32, color: colors.primary },
  text: { flex: 1 },
});
