import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { spacing, type } from '@/constants/theme';

type Props = {
  expanded: boolean;
  onExpand: () => void;
  onKeepEditing: () => void;
  onConfirm: () => void;
  disabledReason?: string;
  busy: boolean;
};

/** Confirmation is two deliberate steps: open the explanation, then confirm. */
export function ConfirmBar({ expanded, onExpand, onKeepEditing, onConfirm, disabledReason, busy }: Props) {
  if (!expanded) {
    return <Button label="Confirm scope" icon="lock" disabled={Boolean(disabledReason)} disabledReason={disabledReason} onPress={onExpand} />;
  }
  return (
    <View style={styles.bar}>
      <Text style={type.body}>This saves a fixed snapshot you reviewed. It does not record client approval.</Text>
      <Button label="Confirm Agreement v1" icon="lock" busy={busy} disabled={Boolean(disabledReason)} disabledReason={disabledReason} onPress={onConfirm} />
      <Button label="Keep editing" variant="secondary" disabled={busy} onPress={onKeepEditing} />
    </View>
  );
}

const styles = StyleSheet.create({ bar: { gap: spacing.md } });
