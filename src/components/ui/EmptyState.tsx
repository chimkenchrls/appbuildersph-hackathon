import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, type } from '@/constants/theme';

type Props = { title: string; message: string; action?: ReactNode };

export function EmptyState({ title, message, action }: Props) {
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={type.subheading}>{title}</Text>
      <Text style={type.support}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.md, paddingVertical: spacing.xl } });
