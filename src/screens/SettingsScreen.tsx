import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import type { AppServices } from '@/services/bootstrapService';

interface SettingsScreenProps {
  services: AppServices | null;
  onDataReset: () => Promise<void>;
}

export function SettingsScreen({ services, onDataReset }: SettingsScreenProps) {
  const [resetting, setResetting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const handleReset = async () => {
    setResetting(true);
    setFeedbackMessage(null);
    try {
      await onDataReset();
      setFeedbackMessage('Workspace sample data reseeded successfully.');
    } catch (err) {
      setFeedbackMessage((err as Error).message || 'Failed to reseed database.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="Saklaw"
        subtitle="Your Private Workspace"
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>SYSTEM & VAULT</Text>
          <Text style={styles.headline}>Workspace Settings</Text>
          <Text style={styles.subhead}>
            Zero telemetry, local encrypted storage, and offline inference controls.
          </Text>
        </View>

        {/* Card 1: Privacy Architecture */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Offline Architecture</Text>
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>Active</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            All scopes, contracts, and proposals stay strictly on this device.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>SQLite on-device database</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>Zero remote analytics or tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>EOPT RA 11976 tax treatment engine</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>LM Studio / Local offline inference ready</Text>
            </View>
          </View>
        </View>

        {/* Card 2: Legal Engine & Tax Compliance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Philippine Legal Standard</Text>
          <Text style={styles.cardSubtitle}>
            Contracts and proposals are generated compliant with Philippine commercial statutes.
          </Text>

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>RA 11976 (EOPT)</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>BIR Form 2307</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>RA 8293 IP Code</Text>
            </View>
          </View>
        </View>

        {/* Card 3: Storage & Maintenance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Maintenance</Text>
          <Text style={styles.cardSubtitle}>
            Reset workspace to default demo baseline with Harbor Studio sample contract.
          </Text>

          {feedbackMessage ? (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedbackMessage}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.resetButtonPressed,
              resetting && styles.resetButtonDisabled,
            ]}
            onPress={handleReset}
            disabled={resetting}
            accessibilityRole="button"
            accessibilityLabel="Reseed sample workspace data"
          >
            {resetting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.resetButtonText}>Reseed Sample Workspace</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  subhead: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  badgeSuccess: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
  },
  featureList: {
    gap: 8,
    marginTop: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  feedbackBanner: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  feedbackText: {
    fontSize: 13,
    color: colors.successText,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  resetButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
});
