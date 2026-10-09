import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@/constants/theme';
import { Icon, type IconName } from './Icon';

export type BadgeVariant =
  | 'included' | 'potential_additional' | 'needs_clarification'
  | 'none' | 'draft' | 'confirmed' | 'unsaved' | 'saved' | 'ai' | 'demo';

const variants: Record<BadgeVariant, { icon: IconName; text: string; surface: string; label: string }> = {
  included: { icon: 'circle-check', text: colors.successText, surface: colors.successSurface, label: 'Included in recorded scope' },
  potential_additional: { icon: 'triangle-alert', text: colors.warningText, surface: colors.warningSurface, label: 'Potential additional work' },
  needs_clarification: { icon: 'circle-help', text: colors.infoText, surface: colors.infoSurface, label: 'Needs clarification' },
  none: { icon: 'circle-alert', text: colors.textSecondary, surface: colors.surfaceRaised, label: 'No scope yet' },
  draft: { icon: 'pencil', text: colors.textPrimary, surface: colors.surfaceRaised, label: 'Draft' },
  confirmed: { icon: 'lock', text: colors.primary, surface: colors.surfaceRaised, label: 'Confirmed' },
  unsaved: { icon: 'triangle-alert', text: colors.warningText, surface: colors.warningSurface, label: 'Unsaved changes' },
  saved: { icon: 'save', text: colors.textPrimary, surface: colors.surfaceRaised, label: 'Saved' },
  ai: { icon: 'sparkles', text: colors.aiText, surface: colors.aiSurface, label: 'AI suggestion' },
  demo: { icon: 'flask-conical', text: colors.warningText, surface: colors.warningSurface, label: 'Demo data' },
};

type Props = { variant: BadgeVariant; label?: string };

/** Icon, text and color together; the text always carries the meaning. */
export function StatusBadge({ variant, label }: Props) {
  const v = variants[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.surface }]}>
      <Icon name={v.icon} size={14} color={v.text} />
      <Text style={[type.mono, styles.text, { color: v.text }]}>{label ?? v.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    maxWidth: '100%',
  },
  text: { flexShrink: 1 },
});
