import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive';
type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  /** Shown under the button while it is disabled, so the reason is never hidden. */
  disabledReason?: string;
  accessibilityLabel?: string;
};

const foreground: Record<Variant, string> = {
  primary: colors.onPrimary,
  secondary: colors.textPrimary,
  quiet: colors.primary,
  destructive: colors.onDestructive,
};

export function Button({ label, onPress, variant = 'primary', icon, disabled = false, busy = false, disabledReason, accessibilityLabel }: Props) {
  const inactive = disabled || busy;
  const color = disabled ? colors.disabledText : foreground[variant];
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={disabled ? disabledReason : undefined}
        accessibilityState={{ disabled: inactive, busy }}
        disabled={inactive}
        onPress={onPress}
        android_ripple={{ color: colors.surfaceRaised }}
        style={({ pressed }) => [
          styles.base,
          styles[variant],
          disabled && styles.disabled,
          pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        ]}
      >
        {/* The slot is always present so the label does not shift when busy. */}
        <View style={styles.slot}>
          {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <Icon name={icon} size={18} color={color} /> : null}
        </View>
        <Text style={[type.label, styles.label, { color }]}>{label}</Text>
        <View style={styles.slot} />
      </Pressable>
      {disabled && disabledReason ? <Text style={[type.support, styles.reason]}>{disabledReason}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  base: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  slot: { width: 20, alignItems: 'center' },
  label: { flexShrink: 1, textAlign: 'center' },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: 'transparent', borderColor: colors.controlBorder },
  quiet: { backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.destructive },
  pressed: { backgroundColor: colors.surfaceRaised },
  disabled: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  reason: { textAlign: 'center' },
});
