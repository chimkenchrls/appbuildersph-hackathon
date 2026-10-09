import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import type { AppServices } from '@/services/bootstrapService';
import type { Project } from '@/types/domain';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { hapticImpactLight, hapticSuccess } from '@/utils/haptics';

interface AttachedItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  uri: string;
  type: 'document' | 'image';
}

interface NewProjectScreenProps {
  services?: AppServices | null;
  existingProjects?: Project[];
  onBack: () => void;
  onCreateScopeDraft: (data: {
    projectName: string;
    projectField: string;
    conversation: string;
  }) => Promise<void>;
}

interface LlmStatus {
  checking: boolean;
  available: boolean;
  model: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function NewProjectScreen({
  services,
  existingProjects,
  onBack,
  onCreateScopeDraft,
}: NewProjectScreenProps) {
  const [projectName, setProjectName] = useState('');
  const [projectField, setProjectField] = useState('');
  const [conversation, setConversation] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [llmStatus, setLlmStatus] = useState<LlmStatus>({
    checking: true,
    available: false,
    model: 'local-model',
  });

  React.useEffect(() => {
    let active = true;
    async function checkLlm() {
      if (!services) {
        if (active) setLlmStatus({ checking: false, available: false, model: 'offline' });
        return;
      }
      try {
        const res = await services.llmEngine.checkConnection();
        if (active) {
          setLlmStatus({
            checking: false,
            available: res.available,
            model: res.activeModel || 'local-model',
          });
        }
      } catch {
        if (active) {
          setLlmStatus({ checking: false, available: false, model: 'offline' });
        }
      }
    }
    checkLlm();
    return () => {
      active = false;
    };
  }, [services]);

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newDoc: AttachedItem = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: asset.name || 'document.txt',
          size: asset.size,
          mimeType: asset.mimeType,
          uri: asset.uri,
          type: 'document',
        };

        setAttachedFiles((prev) => [...prev, newDoc]);
        setErrorMessage(null);

        // Attempt to read text content if plain text/markdown/json
        const lowerName = newDoc.name.toLowerCase();
        const isTextFile =
          (asset.mimeType && asset.mimeType.startsWith('text/')) ||
          lowerName.endsWith('.txt') ||
          lowerName.endsWith('.md') ||
          lowerName.endsWith('.json') ||
          lowerName.endsWith('.csv') ||
          lowerName.endsWith('.log');

        if (isTextFile) {
          try {
            const resp = await fetch(asset.uri);
            const textContent = await resp.text();
            if (textContent && textContent.trim().length > 0) {
              setConversation((prev) => {
                const trimmed = prev.trim();
                const fileHeader = `[File: ${newDoc.name}]\n${textContent.trim()}`;
                return trimmed ? `${trimmed}\n\n${fileHeader}` : fileHeader;
              });
            }
          } catch {
            // Keep attachment item intact even if direct text extraction fails
          }
        } else {
          // Document note tag for binary/PDF docs
          setConversation((prev) => {
            const trimmed = prev.trim();
            const tag = `[Attached document: ${newDoc.name}]`;
            if (trimmed.includes(tag)) return trimmed;
            return trimmed ? `${trimmed}\n\n${tag}` : tag;
          });
        }

        await hapticSuccess();
      } else {
        await hapticImpactLight();
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to select document');
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setErrorMessage('Photo gallery access is required to attach screenshots.');
        await hapticImpactLight();
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newImg: AttachedItem = {
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: asset.fileName || `screenshot_${Date.now()}.jpg`,
          size: asset.fileSize,
          mimeType: asset.mimeType || 'image/jpeg',
          uri: asset.uri,
          type: 'image',
        };

        setAttachedFiles((prev) => [...prev, newImg]);
        setErrorMessage(null);

        setConversation((prev) => {
          const trimmed = prev.trim();
          const tag = `[Attached screenshot: ${newImg.name}]`;
          if (trimmed.includes(tag)) return trimmed;
          return trimmed ? `${trimmed}\n\n${tag}` : tag;
        });

        await hapticSuccess();
      } else {
        await hapticImpactLight();
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to pick image');
    }
  };

  const handlePasteBrief = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.trim().length > 0) {
        setConversation((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed}\n\n${text.trim()}` : text.trim();
        });
        setErrorMessage(null);
        await hapticSuccess();
      } else {
        setErrorMessage('Clipboard is empty. Copy client messages or notes first.');
        await hapticImpactLight();
      }
    } catch {
      setErrorMessage('Could not access clipboard.');
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    await hapticImpactLight();
    setAttachedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCreateDraft = async () => {
    if (isSubmitting) return;

    const finalName = projectName.trim();
    const finalField = projectField.trim() || 'General';
    let finalConversation = conversation.trim();

    if (!finalName) {
      setErrorMessage('Please enter a project name.');
      await hapticImpactLight();
      return;
    }

    // Check for duplicate project name
    const normalizedName = finalName.toLowerCase();
    const isDuplicate = existingProjects?.some(
      (p) => p.title.trim().toLowerCase() === normalizedName,
    );
    if (isDuplicate) {
      setErrorMessage(`A project named "${finalName}" already exists. Please choose a different name.`);
      await hapticImpactLight();
      return;
    }

    if (!finalConversation && attachedFiles.length === 0) {
      setErrorMessage('Please paste client messages, enter requirements, or attach files.');
      await hapticImpactLight();
      return;
    }

    if (!finalConversation && attachedFiles.length > 0) {
      finalConversation = attachedFiles
        .map((f) => `[Attached ${f.type}: ${f.name}]`)
        .join('\n');
    }

    setIsSubmitting(true);
    await hapticImpactLight();
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
        {/* Eyebrow & Headline with Local AI status */}
        <View style={styles.headerSection}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>BRIEFCRAFT</Text>
            {llmStatus.checking ? (
              <View style={styles.aiPillChecking}>
                <ActivityIndicator size={10} color={colors.textSecondary} />
                <Text style={styles.aiPillCheckingText}>Checking Local AI...</Text>
              </View>
            ) : llmStatus.available ? (
              <View style={styles.aiPillReady}>
                <AppIcon name="sparkles" size={12} color="#15803D" />
                <Text style={styles.aiPillReadyText}>Local LLM Ready · {llmStatus.model}</Text>
              </View>
            ) : (
              <View style={styles.aiPillOffline}>
                <AppIcon name="alert-circle" size={12} color={colors.textSecondary} />
                <Text style={styles.aiPillOfflineText}>Local LLM Offline · Smart heuristic</Text>
              </View>
            )}
          </View>
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
                onChangeText={(text) => {
                  setProjectName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
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
                onChangeText={(text) => {
                  setConversation(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Paste client chat, message, or project brief here..."
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Attached Files List */}
              {attachedFiles.length > 0 && (
                <View style={styles.attachmentsContainer}>
                  {attachedFiles.map((file) => (
                    <View key={file.id} style={styles.attachmentChip}>
                      {file.type === 'image' && file.uri ? (
                        <Image source={{ uri: file.uri }} style={styles.attachmentThumb} />
                      ) : (
                        <View style={styles.attachmentDocIcon}>
                          <AppIcon name="paperclip" size={13} color={colors.textPrimary} />
                        </View>
                      )}
                      <Text
                        style={styles.attachmentName}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {file.name}
                      </Text>
                      {file.size ? (
                        <Text style={styles.attachmentSize}>
                          {formatFileSize(file.size)}
                        </Text>
                      ) : null}
                      <Pressable
                        style={styles.attachmentRemoveBtn}
                        onPress={() => handleRemoveAttachment(file.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove attachment ${file.name}`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <AppIcon name="x" size={12} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Box Toolbar: Three black icon buttons (attachment, image, clipboard), NO send icon */}
              <View style={styles.boxToolbar}>
                <View style={styles.toolIconsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.toolIconBtn,
                      pressed && styles.toolIconBtnPressed,
                    ]}
                    onPress={handlePickDocument}
                    accessibilityRole="button"
                    accessibilityLabel="Attach document or brief file"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="paperclip" size={20} color="#000000" />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.toolIconBtn,
                      pressed && styles.toolIconBtnPressed,
                    ]}
                    onPress={handlePickImage}
                    accessibilityRole="button"
                    accessibilityLabel="Attach screenshot or image"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="image" size={20} color="#000000" />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.toolIconBtn,
                      pressed && styles.toolIconBtnPressed,
                    ]}
                    onPress={handlePasteBrief}
                    accessibilityRole="button"
                    accessibilityLabel="Paste client chat from clipboard"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <AppIcon name="clipboard" size={19} color="#000000" />
                  </Pressable>
                </View>

                {/* Text indication placed under, not side to side */}
                <Text style={styles.toolbarHint}>
                  {conversation.length > 0
                    ? `${conversation.length} characters`
                    : 'Attach file · Image · Paste'}
                </Text>
              </View>
            </View>
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
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color={colors.onPrimary} />
                <Text style={styles.actionButtonText}>
                  {llmStatus.available
                    ? 'Extracting scope with Local LLM...'
                    : 'Extracting scope...'}
                </Text>
              </View>
            ) : (
              <View style={styles.submittingRow}>
                {llmStatus.available && (
                  <AppIcon name="sparkles" size={16} color={colors.onPrimary} />
                )}
                <Text style={styles.actionButtonText}>
                  {llmStatus.available
                    ? 'Create scope draft with Local LLM'
                    : 'Create scope draft'}
                </Text>
              </View>
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
  attachmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  attachmentThumb: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.cardBorder,
  },
  attachmentDocIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.cardBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    maxWidth: 140,
  },
  attachmentSize: {
    fontSize: 10.5,
    color: colors.textMuted,
  },
  attachmentRemoveBtn: {
    padding: 2,
    marginLeft: 2,
  },
  boxToolbar: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardDivider,
    marginTop: spacing.sm,
  },
  toolIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toolIconBtn: {
    padding: 6,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolIconBtnPressed: {
    backgroundColor: colors.surfaceRaised,
    opacity: 0.65,
  },
  toolbarHint: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
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
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  aiPillChecking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  aiPillCheckingText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  aiPillReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  aiPillReadyText: {
    fontSize: 10.5,
    color: '#15803D',
    fontWeight: '700',
  },
  aiPillOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  aiPillOfflineText: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontWeight: '500',
  },
});
