import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';
import { Icon } from './Icon';

type Props = { requirementId: string; version: number; kind: 'deliverable' | 'exclusion' | 'term'; text: string };

const kindLabels = { deliverable: 'Recorded deliverable', exclusion: 'Recorded exclusion', term: 'Recorded term' } as const;

/** A reference to a stored requirement. Expanding shows the clause in full. */
export function EvidenceItem({ requirementId, version, kind, text }: Props) {
  const [expanded, setExpanded] = useState(false);
  const reference = `${requirementId} · Agreement v${version}`;
  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Evidence ${reference}`}
        accessibilityHint={expanded ? 'Hides the recorded clause' : 'Shows the recorded clause'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        android_ripple={{ color: colors.surfaceRaised }}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Icon name="lock" size={16} color={colors.primary} />
        <Text style={[type.mono, styles.reference]}>{reference}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>
      {expanded ? (
        <View style={styles.clause}>
          <Text style={type.support}>{kindLabels[kind]}</Text>
          <Text style={type.body}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { borderLeftWidth: 4, borderLeftColor: colors.primary, backgroundColor: colors.surface },
  toggle: { minHeight: layout.minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  pressed: { backgroundColor: colors.surfaceRaised },
  reference: { flex: 1, color: colors.primary },
  clause: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs },
});
