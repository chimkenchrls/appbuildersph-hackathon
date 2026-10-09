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
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import * as Clipboard from 'expo-clipboard';
import { hapticImpactLight, hapticSuccess } from '@/utils/haptics';

interface NewProjectScreenProps {
  onBack: () => void;
  onCreateScopeDraft: (data: {
    projectName: string;
    projectField: string;
    conversation: string;
  }) => Promise<void>;
}

export function NewProjectScreen({
  onBack,
  onCreateScopeDraft,
}: NewProjectScreenProps) {
  const [projectName, setProjectName] = useState('');
  const [projectField, setProjectField] = useState('');
  const [conversation, setConversation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sampleConversations = [
    {
      label: 'Sample: Web Design Brief',
      projectName: 'Harbor Studio',
      projectField: 'Project field',
      conversation:
        'Client: Hi! We need a 5-page responsive website (Home, About, Services, Work, Contact) with a contact form. Our budget is ₱15,000 for 2 weeks turnaround, and we want 2 rounds of design revisions included.',
    },
    {
      label: 'Sample: Mobile App Branding',
      projectName: 'Metro Bites Food App',
      projectField: 'Brand Identity & Mobile Design',
      conversation:
        'Client: We are launching an artisan delivery app in Makati. We need complete brand guidelines, app icon, typography palette, and a 6-screen design system. Budget is ₱28,000 over 3 weeks.',
    },
  ];

  const handleFillSample = async (sample: (typeof sampleConversations)[0]) => {
    await hapticImpactLight();
    setProjectName(sample.projectName);
    setProjectField(sample.projectField);
    setConversation(sample.conversation);
    setErrorMessage(null);
  };

  const handlePasteBrief = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setConversation(text.trim());
        setErrorMessage(null);
        await hapticSuccess();
      } else {
        await hapticImpactLight();
      }
    } catch {
      // Graceful fallback
    }
  };

  const handleCreateDraft = async () => {
    const finalName = projectName.trim() || 'Harbor Studio';
    const finalField = projectField.trim() || 'Project field';
    const finalConversation =
      conversation.trim() ||
      'Client: We need a five-page responsive website with a contact form. Budget is ₱15,000 for 2 weeks turnaround with two revision rounds included.';

    await hapticImpactLight();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onCreateScopeDraft({
        projectName: finalName,
        projectField: finalField,
        conversation: finalConversation,
      });
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to create scope draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="New Project"
        subtitle="create new project scope"
        showBack={true}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Eyebrow & Headline */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>BRIEFCRAFT</Text>
          <Text style={styles.headline}>Start with{'\n'}the conversation</Text>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          {/* Field 1: Project Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Project Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={projectName}
                onChangeText={setProjectName}
                placeholder="Enter project name..."
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </View>

          {/* Field 2: Project Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Project Field</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={projectField}
                onChangeText={setProjectField}
                placeholder="Enter project field or domain..."
                placeholderTextColor={colors.placeholder}
              />
            </View>
          </View>

          {/* Field 3: Conversation or Attachments */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Conversation or Attachments</Text>
            <View style={styles.conversationBox}>
              <TextInput
                style={styles.conversationInput}
                value={conversation}
                onChangeText={setConversation}
                placeholder="Paste client chat, message, or project brief here..."
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Box Toolbar Matching Mockup */}
              <View style={styles.boxToolbar}>
                <View style={styles.toolIconsLeft}>
                  <Pressable
                    style={styles.toolIconBtn}
                    onPress={() => handleFillSample(sampleConversations[0])}
                    accessibilityRole="button"
                    accessibilityLabel="Attach sample web design chat"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="paperclip" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={styles.toolIconBtn}
                    onPress={() => handleFillSample(sampleConversations[1])}
                    accessibilityRole="button"
                    accessibilityLabel="Attach sample mobile brand brief"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="image" size={18} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    style={styles.toolIconBtn}
                    onPress={handlePasteBrief}
                    accessibilityRole="button"
                    accessibilityLabel="Paste client chat from clipboard"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="clipboard" size={17} color={colors.primary} />
                  </Pressable>
                </View>

                <Pressable
                  style={styles.sendIconBtn}
                  onPress={handleCreateDraft}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel="Submit conversation to create draft"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppIcon name="send" size={18} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Quick Helper Pill for Demo / Fast Evaluation */}
          <View style={styles.sampleChipsRow}>
            <Text style={styles.sampleChipsTitle}>Quick Fill:</Text>
            {sampleConversations.map((sample, idx) => (
              <Pressable
                key={idx}
                style={styles.sampleChip}
                onPress={() => handleFillSample(sample)}
              >
                <Text style={styles.sampleChipText}>{sample.label}</Text>
              </Pressable>
            ))}
          </View>

          {errorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Action Button: Create scope draft */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
              isSubmitting && styles.actionButtonDisabled,
            ]}
            onPress={handleCreateDraft}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Create scope draft"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>Create scope draft</Text>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  headerSection: {
    marginBottom: spacing.xl,
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
  formSection: {
    gap: spacing.lg,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inputWrapper: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    height: 48,
    justifyContent: 'center',
    ...shadows.subtle,
  },
  textInput: {
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  conversationBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.lg,
    padding: spacing.md,
    minHeight: 180,
    justifyContent: 'space-between',
    ...shadows.subtle,
  },
  conversationInput: {
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 110,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  boxToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardDivider,
    marginTop: spacing.sm,
  },
  toolIconsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toolIconBtn: {
    padding: 4,
  },
  sendIconBtn: {
    padding: 4,
  },
  sampleChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.xs,
  },
  sampleChipsTitle: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
  },
  sampleChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  sampleChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  errorBanner: {
    backgroundColor: colors.errorSurface,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: colors.errorText,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  actionButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
