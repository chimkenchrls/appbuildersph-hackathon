import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/workspace/Icon';
import { hapticSuccess, hapticWarning, hapticImpactLight } from '@/utils/haptics';

interface OnboardingScreenProps {
  onComplete: (profile: { name: string; role: string }) => Promise<void>;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleNext = async () => {
    await hapticImpactLight();
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleBack = async () => {
    await hapticImpactLight();
    if (currentStep > 0) {
      setError(null);
      setCurrentStep((prev) => (prev - 1) as 0 | 1);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your name for contract generation');
      await hapticWarning();
      return;
    }

    if (trimmedName.length < 2) {
      setError('Name must be at least 2 characters');
      await hapticWarning();
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onComplete({
        name: trimmedName,
        role: role.trim() || 'Independent Professional',
      });
      await hapticSuccess();
    } catch (err) {
      setError((err as Error).message || 'Failed to complete setup');
      setSubmitting(false);
    }
  };

  const progressPercentage = `${((currentStep + 1) / 3) * 100}%` as const;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header & Progress Bar */}
        <View style={styles.topBar}>
          {currentStep > 0 ? (
            <Pressable
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back to previous step"
            >
              <AppIcon name="back" size={20} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}

          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: progressPercentage }]} />
          </View>

          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{currentStep + 1}/3</Text>
          </View>
        </View>

        {/* Scrollable Content Container */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 0: Welcome & Mission */}
          {currentStep === 0 && (
            <View style={styles.stepContainer}>
              <View style={styles.mascotWrapper}>
                <Image
                  source={require('../../../assets/owl_mascot.png')}
                  style={styles.mascotImage}
                  resizeMode="contain"
                  accessibilityLabel="OwlSet Mascot"
                />
              </View>

              <Text style={styles.headline}>Say goodbye to unpaid scope creep.</Text>
              <Text style={styles.subtitle}>
                OwlSet is your private on-device assistant. We turn vague client requests into
                binding agreements and protect your billable hours.
              </Text>

              <View style={styles.quoteCard}>
                <View style={styles.quoteIconBox}>
                  <AppIcon name="shield" size={18} color={colors.primary} />
                </View>
                <Text style={styles.quoteText}>
                  Built specifically for independent developers and digital contractors in the
                  Philippines.
                </Text>
              </View>
            </View>
          )}

          {/* STEP 1: Core Superpowers */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.mascotWrapperSmall}>
                <Image
                  source={require('../../../assets/owl_mascot.png')}
                  style={styles.mascotImageSmall}
                  resizeMode="contain"
                  accessibilityLabel="OwlSet Mascot"
                />
              </View>

              <Text style={styles.headline}>Your scope. Your rules.</Text>
              <Text style={styles.subtitle}>
                Three essential tools designed to defend your freelance business from day one:
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureRow}>
                  <View style={styles.featureIconContainer}>
                    <AppIcon name="shield" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>ScopeGuard AI Defense</Text>
                    <Text style={styles.featureDesc}>
                      Audits incoming client messages against agreed deliverables to catch unpaid work.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconContainer}>
                    <AppIcon name="document" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>Kasunduan Contract & PDF Export</Text>
                    <Text style={styles.featureDesc}>
                      Generates commercial agreements compliant with RA 11976 and exports signed PDFs.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <View style={styles.featureIconContainer}>
                    <AppIcon name="lock" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.featureTextWrapper}>
                    <Text style={styles.featureTitle}>100% On-Device Privacy</Text>
                    <Text style={styles.featureDesc}>
                      Zero remote tracking. All client data stays secure in your encrypted local SQLite database.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: Profile Creation */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.mascotWrapperSmall}>
                <Image
                  source={require('../../../assets/owl_mascot.png')}
                  style={styles.mascotImageSmall}
                  resizeMode="contain"
                  accessibilityLabel="OwlSet Mascot"
                />
              </View>

              <Text style={styles.headline}>Time to create a profile!</Text>
              <Text style={styles.subtitle}>
                Enter your name so it can be stamped as the Independent Contractor on generated
                contracts and PDF exports.
              </Text>

              <View style={styles.formCard}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Full Legal Name <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View style={[styles.inputWrapper, error && styles.inputWrapperError]}>
                    <AppIcon name="user" size={18} color={colors.textMuted} />
                    <TextInput
                      style={styles.textInput}
                      value={name}
                      onChangeText={(val) => {
                        setName(val);
                        if (error) setError(null);
                      }}
                      placeholder="e.g. Maria Santos or Juan Dela Cruz"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="words"
                      autoCorrect={false}
                      accessibilityLabel="Freelancer Full Name"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Professional Role or Title</Text>
                  <View style={styles.inputWrapper}>
                    <AppIcon name="edit" size={18} color={colors.textMuted} />
                    <TextInput
                      style={styles.textInput}
                      value={role}
                      onChangeText={setRole}
                      placeholder="e.g. Full-Stack Developer or UI/UX Designer"
                      placeholderTextColor={colors.placeholder}
                      autoCapitalize="words"
                      autoCorrect={false}
                      accessibilityLabel="Freelancer Professional Role"
                    />
                  </View>
                </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <AppIcon name="alert-circle" size={15} color={colors.errorText} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions Dock */}
        <View style={styles.bottomDock}>
          {currentStep < 2 ? (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleNext}
              accessibilityRole="button"
              accessibilityLabel="Continue to next step"
            >
              <Text style={styles.primaryButtonText}>CONTINUE</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                submitting && styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Create Profile and Enter Workspace"
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>CREATE PROFILE</Text>
              )}
            </Pressable>
          )}

          {currentStep > 0 && (
            <Pressable
              onPress={handleBack}
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.secondaryButtonText}>BACK</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 32,
  },
  progressBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.full,
  },
  stepBadge: {
    paddingHorizontal: spacing.xs,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
  },
  mascotWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 3,
    borderColor: colors.primaryMuted,
    ...shadows.card,
  },
  mascotImage: {
    width: 110,
    height: 110,
  },
  mascotWrapperSmall: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primaryMuted,
    ...shadows.card,
  },
  mascotImageSmall: {
    width: 86,
    height: 86,
  },
  headline: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.xl,
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
    maxWidth: 340,
  },
  quoteIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  featureList: {
    width: '100%',
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  formCard: {
    width: '100%',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  requiredStar: {
    color: colors.errorText,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    height: 48,
    gap: spacing.sm,
  },
  inputWrapperError: {
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorSurface,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: colors.errorText,
    fontWeight: '500',
  },
  bottomDock: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  secondaryButton: {
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
