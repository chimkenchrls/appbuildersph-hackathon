import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import { MarqueeText } from '@/components/MarqueeText';

interface HeaderBarProps {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  showBack?: boolean;
}

export function HeaderBar({
  title,
  subtitle,
  onBack,
  showBack = false,
}: HeaderBarProps) {
  const isRootBrand = !showBack && title === 'OwlSet';

  return (
    <View style={styles.container}>
      {isRootBrand ? (
        <View style={styles.rootBrandContent}>
          <Text style={styles.brandTitle}>OwlSet</Text>
          <Text style={styles.brandSubtitle}>
            {subtitle || 'Your Private Workspace'}
          </Text>
        </View>
      ) : (
        <View style={styles.subHeaderContent}>
          {showBack && onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <AppIcon name="back" size={20} color={colors.textPrimary} />
            </Pressable>
          ) : null}

          <View style={styles.titleColumn}>
            <MarqueeText
              text={title}
              style={styles.subHeaderTitle}
              speed={28}
              pauseDuration={1600}
            />
            {subtitle ? (
              <Text style={styles.subHeaderSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rootBrandContent: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 2,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  subHeaderContent: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  subHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  subHeaderSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
