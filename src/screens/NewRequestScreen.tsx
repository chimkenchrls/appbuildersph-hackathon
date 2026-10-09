import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import { hapticImpactLight, hapticSuccess } from '@/utils/haptics';
import type { Project, Agreement } from '@/types/domain';

interface NewRequestScreenProps {
  project: Project;
  agreement: Agreement | null;
  onBack: () => void;
  onAnalyze: (requestText: string) => Promise<void>;
  onViewConfirmedScope: () => void;
}

export function NewRequestScreen({
  project,
  agreement,
  onBack,
  onAnalyze,
  onViewConfirmedScope,
}: NewRequestScreenProps) {
  const [requestText, setRequestText] = useState(
    'Can we also add customer accounts and appointment booking? Please update the contact form colours too. And make the site feel more premium.',
  );
  const [analyzing, setAnalyzing] = useState(false);

  const handlePasteFromClipboard = async () => {
    try {
      const copied = await Clipboard.getStringAsync();
      if (copied && copied.trim().length > 0) {
        setRequestText(copied.trim());
        await hapticSuccess();
      } else {
        await hapticImpactLight();
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleAnalyzePress = async () => {
    if (!requestText.trim()) return;
    await hapticImpactLight();
    setAnalyzing(true);
    try {
      await onAnalyze(requestText.trim());
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title={project.title}
        subtitle={project.description || 'Website design & development'}
        showBack={true}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>SCOPEGUARD</Text>
          <Text style={styles.headline}>What’s changed?</Text>
          <Text style={styles.subhead}>
            Paste the new message.{'\n'}Review it against your confirmed scope.
          </Text>
        </View>

        {/* Confirmed Baseline Card */}
        <Pressable
          style={({ pressed }) => [
            styles.scopeReferenceCard,
            pressed && styles.scopeReferenceCardPressed,
          ]}
          onPress={onViewConfirmedScope}
          accessibilityRole="button"
          accessibilityLabel={`Agreement v${agreement?.versionNumber || 2}, Confirmed scope, Read-only`}
        >
          <View style={styles.scopeReferenceLeft}>
            <AppIcon name="lock" size={18} color={colors.textPrimary} />
            <View style={styles.scopeReferenceTextCol}>
              <Text style={styles.scopeReferenceTitle}>
                Agreement v{agreement?.versionNumber || 2}
              </Text>
              <Text style={styles.scopeReferenceSub}>
                Confirmed scope · Read-only
              </Text>
            </View>
          </View>
          <AppIcon name="chevron-right" size={18} color={colors.textSecondary} />
        </Pressable>

        {/* Input Form */}
        <View style={styles.inputSection}>
          <View style={styles.inputHeaderRow}>
            <Text style={styles.inputLabel}>Client&apos;s new request</Text>
            <Pressable
              style={({ pressed }) => [
                styles.pasteButton,
                pressed && styles.pasteButtonPressed,
              ]}
              onPress={handlePasteFromClipboard}
              accessibilityRole="button"
              accessibilityLabel="Paste from clipboard"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppIcon name="clipboard" size={14} color={colors.primary} />
              <Text style={styles.pasteButtonText}>Paste</Text>
            </Pressable>
          </View>
          <View style={styles.textAreaBox}>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              value={requestText}
              onChangeText={setRequestText}
              placeholder="Paste message from client..."
              placeholderTextColor={colors.placeholder}
              textAlignVertical="top"
            />
            <View style={styles.resizeHandleContainer} pointerEvents="none">
              <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <Line
                  x1="11"
                  y1="3"
                  x2="3"
                  y2="11"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <Line
                  x1="11"
                  y1="7"
                  x2="7"
                  y2="11"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </Svg>
            </View>
          </View>
          <Text style={styles.charCount}>{requestText.length} characters</Text>
        </View>

        {/* Evidence Callout */}
        <View style={styles.calloutCard}>
          <View style={styles.calloutIconCol}>
            <AppIcon name="link" size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.calloutContent}>
            <Text style={styles.calloutTitle}>Evidence comes first</Text>
            <Text style={styles.calloutSubtitle}>
              Findings reference the requirements you confirmed.
            </Text>
          </View>
        </View>

        {/* CTA Button */}
        <Pressable
          style={({ pressed }) => [
            styles.analyzeButton,
            pressed && styles.analyzeButtonPressed,
            (analyzing || !requestText.trim()) && styles.buttonDisabled,
          ]}
          onPress={handleAnalyzePress}
          disabled={analyzing || !requestText.trim()}
          accessibilityRole="button"
          accessibilityLabel="Analyze request"
        >
          {analyzing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <>
              <AppIcon name="scan-text" size={18} color={colors.onPrimary} />
              <Text style={styles.analyzeButtonText}>Analyze request</Text>
            </>
          )}
        </Pressable>

        {/* Footnote */}
        <View style={styles.footnoteSection}>
          <Text style={styles.footnote}>Analysis runs on your device.</Text>
          <Text style={styles.footnote}>
            AI suggestions always need your review.
          </Text>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.xs,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 34,
    letterSpacing: -0.4,
    marginBottom: spacing.xs,
  },
  subhead: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  scopeReferenceCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.card,
  },
  scopeReferenceCardPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  scopeReferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  scopeReferenceTextCol: {
    flex: 1,
  },
  scopeReferenceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scopeReferenceSub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inputSection: {
    gap: spacing.xs,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pasteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pasteButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  pasteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  textAreaBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.lg,
    minHeight: 160,
    position: 'relative',
    ...shadows.subtle,
  },
  textArea: {
    fontSize: 14.5,
    color: colors.textPrimary,
    lineHeight: 21,
    minHeight: 120,
    padding: 0,
  },
  resizeHandleContainer: {
    position: 'absolute',
    right: 8,
    bottom: 8,
  },
  charCount: {
    fontSize: 11.5,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  calloutCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  calloutIconCol: {
    marginTop: 2,
  },
  calloutContent: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  calloutSubtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  analyzeButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  analyzeButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  footnoteSection: {
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xs,
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
