import { Lucide } from '@react-native-vector-icons/lucide';
import { colors } from '@/constants/theme';

// The closed list of icons the app uses, so the icon set can be swapped here.
export type IconName =
  | 'arrow-left' | 'check' | 'chevron-down' | 'chevron-right' | 'chevron-up'
  | 'circle-alert' | 'circle-check' | 'circle-help' | 'copy' | 'flask-conical'
  | 'lock' | 'pencil' | 'plus' | 'save' | 'sparkles' | 'square' | 'square-check'
  | 'trash-2' | 'triangle-alert' | 'x';

type Props = { name: IconName; size?: number; color?: string };

/** Decorative by default: the adjacent text or the parent's label carries the meaning. */
export function Icon({ name, size = 20, color = colors.textPrimary }: Props) {
  return (
    <Lucide
      name={name}
      size={size}
      color={color}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
