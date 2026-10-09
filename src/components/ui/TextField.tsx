import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { colors, layout, spacing, type } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  helper?: string;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  /** Starting height of a multiline field, in body lines. It grows with its content. */
  minLines?: number;
  editable?: boolean;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

/** A labeled input. The label is always visible; the placeholder is only an example. */
export function TextField({ label, value, onChangeText, onBlur, helper, error, placeholder, multiline = false, minLines = 4, editable = true, keyboardType, maxLength, autoFocus, onSubmitEditing }: Props) {
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        accessibilityState={{ disabled: !editable }}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.disabledText}
        multiline={multiline}
        editable={editable}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
        returnKeyType={multiline ? 'default' : 'done'}
        textAlignVertical={multiline ? 'top' : 'center'}
        cursorColor={colors.primary}
        selectionColor={colors.primary}
        style={[
          type.body,
          styles.input,
          multiline && { minHeight: minLines * type.body.lineHeight + 2 * spacing.md },
          !editable && styles.readOnly,
          error ? styles.inputError : null,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[type.support, styles.error]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={type.support}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  input: {
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.controlBorder,
  },
  readOnly: { color: colors.textSecondary, borderColor: colors.border },
  inputError: { borderColor: colors.errorText },
  error: { color: colors.errorText },
});
