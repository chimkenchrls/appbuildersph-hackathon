import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';
import { Icon } from './Icon';

type Props = { label: string; checked: boolean; onToggle: () => void; disabled?: boolean };

export function CheckRow({ label, checked, onToggle, disabled = false }: Props) {
  const color = disabled ? colors.disabledText : checked ? colors.primary : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onToggle}
      android_ripple={{ color: colors.surfaceRaised }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Icon name={checked ? 'square-check' : 'square'} size={22} color={color} />
      <Text style={[type.body, styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: layout.minTouch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { flex: 1 },
});
