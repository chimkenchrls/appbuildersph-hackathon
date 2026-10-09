import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';
import type { DraftItem } from '@/types/workspace';
import { newId } from '@/utils/ids';
import { Button } from './Button';
import { Icon } from './Icon';
import { TextField } from './TextField';

type Props = {
  title: string;
  /** Singular noun for field labels: "Deliverable 1", "Deliverable 2". */
  itemLabel: string;
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  onBlur?: () => void;
  editable?: boolean;
  emptyText: string;
  error?: string;
  maxLength?: number;
};

/** Editable rows with Add and Remove, used for deliverables and exclusions. */
export function ItemListEditor({ title, itemLabel, items, onChange, onBlur, editable = true, emptyText, error, maxLength }: Props) {
  const setText = (key: string, text: string) => onChange(items.map(item => (item.key === key ? { ...item, text } : item)));
  const remove = (key: string) => { onChange(items.filter(item => item.key !== key)); onBlur?.(); };
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={type.subheading}>{title}</Text>
      {items.length === 0 ? <Text style={type.support}>{emptyText}</Text> : null}
      {items.map((item, index) => (
        <View key={item.key} style={styles.row}>
          <View style={styles.field}>
            <TextField
              label={`${itemLabel} ${index + 1}`}
              value={item.text}
              onChangeText={text => setText(item.key, text)}
              onBlur={onBlur}
              editable={editable}
              multiline
              minLines={1}
              maxLength={maxLength}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
            accessibilityState={{ disabled: !editable }}
            disabled={!editable}
            onPress={() => remove(item.key)}
            android_ripple={{ color: colors.surfaceRaised }}
            style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
          >
            <Icon name="trash-2" size={20} color={editable ? colors.textSecondary : colors.disabledText} />
          </Pressable>
        </View>
      ))}
      {error ? <Text accessibilityRole="alert" style={[type.support, styles.error]}>{error}</Text> : null}
      <Button
        label={`Add ${itemLabel.toLowerCase()}`}
        variant="secondary"
        icon="plus"
        disabled={!editable}
        onPress={() => onChange([...items, { key: newId(), text: '' }])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  field: { flex: 1 },
  remove: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: colors.surfaceRaised },
  error: { color: colors.errorText },
});
