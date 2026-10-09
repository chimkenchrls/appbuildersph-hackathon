import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, type } from '@/constants/theme';
import { Button } from './Button';
import { Icon } from './Icon';

type Props = {
  title: string;
  /** Omit on the root screen. */
  onBack?: () => void;
  /** Header content under the title, such as a status badge. */
  status?: ReactNode;
  /** Bottom action bar. Stays above the keyboard and inside the safe area. */
  footer?: ReactNode;
  /** The screen's single scroll owner: one ScrollView or one FlatList. */
  children: ReactNode;
};

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return visible;
}

/** Non-scrolling shell: header, content viewport and action bar, with insets applied once. */
export function Screen({ title, onBack, status, footer, children }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const side = { paddingLeft: insets.left + layout.gutter, paddingRight: insets.right + layout.gutter };
  // With the keyboard open, it covers the bottom inset already.
  const bottomInset = keyboardVisible ? 0 : insets.bottom;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, side, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.column}>
          <View style={styles.titleRow}>
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onBack}
                android_ripple={{ color: colors.surfaceRaised }}
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              >
                <Icon name="arrow-left" size={24} />
              </Pressable>
            ) : null}
            <Text accessibilityRole="header" style={[onBack ? type.heading : type.title, styles.title]}>{title}</Text>
          </View>
          {status ? <View style={styles.status}>{status}</View> : null}
        </View>
      </View>
      <View style={styles.viewport}>{children}</View>
      {footer || keyboardVisible ? (
        <View style={[styles.footer, side, { paddingBottom: bottomInset + spacing.md }]}>
          <View style={styles.column}>
            {/* Numeric keyboards have no Return key, so dismissal is always offered. */}
            {keyboardVisible ? <Button label="Hide keyboard" variant="quiet" onPress={Keyboard.dismiss} /> : null}
            {footer}
          </View>
        </View>
      ) : (
        <View style={{ height: insets.bottom }} />
      )}
    </KeyboardAvoidingView>
  );
}

/** Padding for the scroll owner inside a Screen, including landscape side insets. */
export function useContentPadding() {
  const insets = useSafeAreaInsets();
  return {
    paddingLeft: insets.left + layout.gutter,
    paddingRight: insets.right + layout.gutter,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth + insets.left + insets.right + 2 * layout.gutter,
    alignSelf: 'center',
  } as const;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: spacing.sm },
  header: { paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.md },
  pressed: { backgroundColor: colors.surfaceRaised },
  title: { flex: 1 },
  status: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  viewport: { flex: 1 },
  footer: { paddingTop: spacing.md, backgroundColor: colors.surfaceRaised, borderTopWidth: 1, borderTopColor: colors.border },
});
