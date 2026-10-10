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
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import { hapticImpactLight, hapticSuccess } from '@/utils/haptics';
import type { Project, Agreement } from '@/types/domain';

interface AttachedItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  uri: string;
  type: 'document' | 'image';
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface NewRequestScreenProps {
  project: Project;
  agreement: Agreement | null;
  onBack: () => void;
  onSaveRequest?: (requestText: string) => Promise<void>;
  onAnalyze: (requestText: string) => Promise<void>;
  onViewConfirmedScope: () => void;
}

export function NewRequestScreen({
  project,
  agreement,
  onBack,
  onSaveRequest,
  onAnalyze,
  onViewConfirmedScope,
}: NewRequestScreenProps) {
  const [requestText, setRequestText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

        // Attempt to read text content if plain text/markdown/json/csv/log
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
              setRequestText((prev) => {
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
          setRequestText((prev) => {
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

        setRequestText((prev) => {
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

  const handlePasteFromClipboard = async () => {
    try {
      const copied = await Clipboard.getStringAsync();
      if (copied && copied.trim().length > 0) {
        setRequestText((prev) => {
          const trimmed = prev.trim();
          return trimmed ? `${trimmed}\n\n${copied.trim()}` : copied.trim();
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

  const getPreparedRequestText = (): string => {
    let finalRequest = requestText.trim();
    if (!finalRequest && attachedFiles.length > 0) {
      finalRequest = attachedFiles
        .map((f) => `[Attached ${f.type}: ${f.name}]`)
        .join('\n');
    }
    return finalRequest;
  };

  const hasContent = requestText.trim().length > 0 || attachedFiles.length > 0;

  const handleSavePress = async () => {
    const textToSave = getPreparedRequestText();
    if (!textToSave) {
      setErrorMessage('Please enter a request, paste from clipboard, or attach files.');
      await hapticImpactLight();
      return;
    }
    await hapticImpactLight();
    setIsSaving(true);
    setErrorMessage(null);
    try {
      if (onSaveRequest) {
        await onSaveRequest(textToSave);
      }
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to save request');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzePress = async () => {
    const textToAnalyze = getPreparedRequestText();
    if (!textToAnalyze) {
      setErrorMessage('Please enter a request, paste from clipboard, or attach files.');
      await hapticImpactLight();
      return;
    }
    await hapticImpactLight();
    setAnalyzing(true);
    setErrorMessage(null);
    try {
      await onAnalyze(textToAnalyze);
    } catch (err) {
      setErrorMessage((err as Error).message || 'Failed to analyze request');
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
            Paste the new message or attach files.{'\n'}Review them against your confirmed scope.
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
          accessibilityLabel={`Agreement v${agreement?.versionNumber ?? '?'}, Confirmed scope, Read-only`}
        >
          <View style={styles.scopeReferenceLeft}>
            <AppIcon name="lock" size={18} color={colors.textPrimary} />
            <View style={styles.scopeReferenceTextCol}>
              <Text style={styles.scopeReferenceTitle}>
                Agreement v{agreement?.versionNumber ?? '?'}
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
          <Text style={styles.inputLabel}>Client&apos;s new request</Text>
          <View style={styles.textAreaBox}>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={6}
              value={requestText}
              onChangeText={(text) => {
                setRequestText(text);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Paste message from client or attach files..."
              placeholderTextColor={colors.placeholder}
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
                  accessibilityLabel="Attach document or client file"
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
                  onPress={handlePasteFromClipboard}
                  accessibilityRole="button"
                  accessibilityLabel="Paste client message from clipboard"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AppIcon name="clipboard" size={19} color="#000000" />
                </Pressable>
              </View>

              {/* Text indication placed under, not side to side */}
              <Text style={styles.toolbarHint}>
                {requestText.length > 0
                  ? `${requestText.length} characters`
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

        {/* Offline Storage Callout */}
        <View style={styles.calloutCard}>
          <View style={styles.calloutIconCol}>
            <AppIcon name="lock" size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.calloutContent}>
            <Text style={styles.calloutTitle}>Offline storage · No client connection</Text>
            <Text style={styles.calloutSubtitle}>
              Saving stores this message in your local project workspace. Talk to your client directly, then record approval when agreed.
            </Text>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.actionsContainer}>
          {/* Primary CTA: Save Request */}
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              (isSaving || analyzing || !hasContent) && styles.buttonDisabled,
            ]}
            onPress={handleSavePress}
            disabled={isSaving || analyzing || !hasContent}
            accessibilityRole="button"
            accessibilityLabel="Save request to project"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <AppIcon name="document" size={18} color={colors.onPrimary} />
                <Text style={styles.saveButtonText}>Save request</Text>
              </>
            )}
          </Pressable>

          {/* Secondary CTA: Analyze & Draft Proposal */}
          <Pressable
            style={({ pressed }) => [
              styles.analyzeButtonSecondary,
              pressed && styles.analyzeButtonSecondaryPressed,
              (isSaving || analyzing || !hasContent) && styles.buttonDisabled,
            ]}
            onPress={handleAnalyzePress}
            disabled={isSaving || analyzing || !hasContent}
            accessibilityRole="button"
            accessibilityLabel="Analyze request and prepare proposal"
          >
            {analyzing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <AppIcon name="sparkles" size={16} color={colors.primary} />
                <Text style={styles.analyzeButtonSecondaryText}>
                  Analyze & draft proposal
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Footnote */}
        <View style={styles.footnoteSection}>
          <Text style={styles.footnote}>
            Saved on your device. Never alters your agreed baseline automatically.
          </Text>
          <Text style={styles.footnote}>
            You accept changes yourself after speaking with your client.
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
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  textAreaBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.md,
    minHeight: 180,
    justifyContent: 'space-between',
    ...shadows.subtle,
  },
  textArea: {
    fontSize: 14.5,
    color: colors.textPrimary,
    lineHeight: 21,
    minHeight: 110,
    padding: 0,
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
  actionsContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  analyzeButtonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.subtle,
  },
  analyzeButtonSecondaryPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  analyzeButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
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
