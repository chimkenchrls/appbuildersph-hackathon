import { useExitGuard } from '@/hooks/useExitGuard';
import { parseEstimate, parseWorkingDays } from '@/safety/parseEstimate';
import { errorMessage } from '@/services/errors';
import { composeProposalMessage } from '@/safety/proposalMessage';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Share,
} from 'react-native';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import * as Clipboard from 'expo-clipboard';
import { hapticImpactLight, hapticSuccess } from '@/utils/haptics';
import type { Project, Agreement, ChangeProposal } from '@/types/domain';

export interface ProposalScreenProps {
  project: Project;
  agreement?: Agreement | null;
  proposal: ChangeProposal;
  availableItems?: string[];
  onBack: () => void;
  onSaveProposal?: (proposal: ChangeProposal) => Promise<void> | void;
  onAcceptProposal?: () => void;
}

export function ProposalEditorScreen({
  project,
  agreement,
  proposal,
  availableItems,
  onSaveProposal,
}: ProposalScreenProps) {
  // Determine available additions to list
  const defaultItems: string[] = [];
  const allAdditions = Array.from(
    new Set([
      ...(availableItems && availableItems.length > 0 ? availableItems : []),
      ...(proposal.selectedItems && proposal.selectedItems.length > 0 ? proposal.selectedItems : defaultItems),
    ]),
  );

  const [selectedItems, setSelectedItems] = useState<string[]>(
    proposal.selectedItems && proposal.selectedItems.length > 0
      ? proposal.selectedItems
      : allAdditions,
  );

  const [feeEstimate, setFeeEstimate] = useState<string>(
    proposal.freelancerFeeEstimate != null ? String(proposal.freelancerFeeEstimate) : '',
  );

  const [daysEstimate, setDaysEstimate] = useState<string>(
    proposal.freelancerDaysEstimate != null ? String(proposal.freelancerDaysEstimate) : '',
  );

  const [draftMessage, setDraftMessage] = useState<string>(
    proposal.draftMessage,
  );

  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Dynamic agreement label (e.g. Agreement v2)
  const agreementLabel = agreement
    ? `Agreement v${agreement.versionNumber}`
    : 'Agreement unavailable';

  const toggleItem = (item: string) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  const handleUpdateDraftFromEstimates = () => {
    try {
      setDraftMessage(composeProposalMessage('Please review the proposed additions to our recorded scope.', {
        deliverables: selectedItems, feeAmount: parseEstimate(feeEstimate), currency: proposal.currency,
        extraWorkingDays: parseWorkingDays(daysEstimate),
      }));
      setFeedback('Draft updated from your estimates.');
    } catch (reason) { setFeedback(errorMessage(reason)); }
  };

  const updatedProposal = (): ChangeProposal => ({ ...proposal, selectedItems, draftMessage,
    freelancerFeeEstimate: parseEstimate(feeEstimate), freelancerDaysEstimate: parseWorkingDays(daysEstimate),
    status: 'draft', updatedAt: new Date().toISOString() });

  const formKey = JSON.stringify([selectedItems, feeEstimate, daysEstimate, draftMessage]);
  const [savedKey, setSavedKey] = useState(formKey);
  const persist = async () => {
    try {
      if (!onSaveProposal) return false;
      await onSaveProposal(updatedProposal());
      setSavedKey(formKey);
      return true;
    } catch (reason) { setFeedback(errorMessage(reason)); return false; }
  };
  const guardedBack = useExitGuard({ blocked: isSaving || formKey !== savedKey, parent: '/', prepare: persist, retrySave: true });

  const handleSaveDraft = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (!onSaveProposal) throw new Error('Saving is unavailable.');
      await onSaveProposal(updatedProposal());
      setSavedKey(formKey);
      await hapticSuccess();
      setFeedback('Proposal draft saved successfully.');
    } catch (reason) { setFeedback(errorMessage(reason)); }
    finally { setIsSaving(false); }
  };

  const handleCopyMessage = async () => {
    try {
      await Clipboard.setStringAsync(draftMessage);
      await hapticSuccess();
      setFeedback('Proposal copied to clipboard!');
      if (onSaveProposal) {
        await onSaveProposal({ ...updatedProposal(), status: 'copied' });
      }
    } catch {
      setFeedback('Unable to copy to clipboard.');
    }
  };

  const handleShareMessage = async () => {
    try {
      await hapticImpactLight();
      const result = await Share.share({
        message: draftMessage,
        title: `Scope Change Proposal - ${project.title}`,
      });
      if (result.action === Share.sharedAction) {
        setFeedback('Proposal message shared.');
      } else {
        setFeedback(null);
      }
    } catch {
      setFeedback('Unable to launch share dialog.');
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title={project.title}
        subtitle={project.description || 'Website design & development'}
        showBack={true}
        onBack={guardedBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* CHANGEDESK Headline Block */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>CHANGEDESK</Text>
          <Text style={styles.headline}>Make the change clear</Text>
          <Text style={styles.subhead}>A friendly proposal, on your terms.</Text>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <AppIcon name="document" size={13} color={colors.textSecondary} />
            <Text style={styles.statusText}>Draft · Awaiting client review</Text>
          </View>
        </View>

        {/* Section: Additional deliverables */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Additional deliverables</Text>
            <Text style={styles.sectionSubtitle}>Select to include</Text>
          </View>

          <View style={styles.itemsList}>
            {allAdditions.map((item, idx) => {
              const isSelected = selectedItems.includes(item);
              return (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.deliverableCard,
                    isSelected && styles.deliverableCardSelected,
                    pressed && styles.deliverableCardPressed,
                  ]}
                  onPress={() => toggleItem(item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={`${item}, ${isSelected ? 'included' : 'not included'}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected ? (
                      <AppIcon name="check" size={13} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemTitle}>{item}</Text>
                    <Text style={styles.itemSubtitle}>
                      Potential addition to {agreementLabel}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Estimates (Two Columns) */}
        <View style={styles.estimatesContainer}>
          <View style={styles.estimatesRow}>
            <View style={styles.estimateCol}>
              <Text style={styles.estimateLabel}>Proposed fee (₱)</Text>
              <TextInput
                style={styles.estimateInput}
                value={feeEstimate}
                onChangeText={setFeeEstimate}
                placeholder="Optional"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                accessibilityLabel="Proposed fee in Philippine Pesos"
              />
            </View>

            <View style={styles.estimateCol}>
              <Text style={styles.estimateLabel}>Extra working days</Text>
              <TextInput
                style={styles.estimateInput}
                value={daysEstimate}
                onChangeText={setDaysEstimate}
                placeholder="Optional"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                accessibilityLabel="Extra working days"
              />
            </View>
          </View>

          <Text style={styles.estimatesHelper}>
            Your estimates. Saklaw does not set your rates.
          </Text>
        </View>

        {/* Section: Message to your client */}
        <View style={styles.messageSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Message to your client</Text>
            <Text style={styles.sectionSubtitle}>Editable</Text>
          </View>

          <Text style={styles.messageFieldLabel}>Proposal message</Text>

          <View style={styles.messageBox}>
            <TextInput
              style={styles.messageInput}
              multiline
              value={draftMessage}
              onChangeText={setDraftMessage}
              placeholder="Draft your proposal message to client..."
              placeholderTextColor={colors.placeholder}
              textAlignVertical="top"
              accessibilityLabel="Proposal message to client"
            />

            {/* Corner Resize Grip Accent */}
            <View style={styles.resizeGrip} pointerEvents="none">
              <View style={styles.resizeBarShort} />
              <View style={styles.resizeBarLong} />
            </View>
          </View>

          {/* Update Draft Action Link */}
          <Pressable
            style={({ pressed }) => [
              styles.sparkleAction,
              pressed && styles.sparkleActionPressed,
            ]}
            onPress={handleUpdateDraftFromEstimates}
            accessibilityRole="button"
            accessibilityLabel="Update draft from my estimates"
          >
            <AppIcon name="sparkles" size={15} color={colors.primary} />
            <Text style={styles.sparkleActionText}>
              Update draft from my estimates
            </Text>
          </Pressable>
        </View>

        {/* Feedback Alert Banner */}
        {feedback ? (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        {/* Primary and Secondary Action Buttons */}
        <View style={styles.actionsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
            ]}
            onPress={handleSaveDraft}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Save draft"
          >
            <AppIcon name="document" size={16} color={colors.onPrimary} />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save draft'}
            </Text>
          </Pressable>

          <View style={styles.shareRow}>
            <Pressable
              style={({ pressed }) => [
                styles.halfActionButton,
                pressed && styles.halfActionButtonPressed,
              ]}
              onPress={handleCopyMessage}
              accessibilityRole="button"
              accessibilityLabel="Copy message to clipboard"
            >
              <AppIcon name="copy" size={16} color={colors.primary} />
              <Text style={styles.halfActionButtonText}>Copy message</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.halfActionButton,
                pressed && styles.halfActionButtonPressed,
              ]}
              onPress={handleShareMessage}
              accessibilityRole="button"
              accessibilityLabel="Share message"
            >
              <AppIcon name="share" size={16} color={colors.primary} />
              <Text style={styles.halfActionButtonText}>Share message</Text>
            </Pressable>
          </View>
        </View>

        {/* Footnote Disclaimers */}
        <View style={styles.footerNoteContainer}>
          <Text style={styles.footerNoteText}>
            Saving or sharing does not change {agreementLabel}.
          </Text>
          <Text style={styles.footerNoteText}>
            Client approval is not recorded automatically.
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
    paddingBottom: spacing.xxxl + spacing.lg,
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
    letterSpacing: 1.2,
    color: '#374151',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subhead: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
  },
  sectionBlock: {
    gap: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  itemsList: {
    gap: 10,
  },
  deliverableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    ...shadows.subtle,
  },
  deliverableCardSelected: {
    borderColor: '#D1D5DB',
  },
  deliverableCardPressed: {
    backgroundColor: colors.surfaceSubtle,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  estimatesContainer: {
    gap: 6,
  },
  estimatesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  estimateCol: {
    flex: 1,
    gap: 6,
  },
  estimateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  estimateInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  estimatesHelper: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  messageSection: {
    gap: 6,
  },
  messageFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 2,
  },
  messageBox: {
    borderWidth: 1,
    borderColor: colors.controlBorder,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    minHeight: 150,
    position: 'relative',
    ...shadows.subtle,
  },
  messageInput: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
    minHeight: 120,
    padding: 0,
  },
  resizeGrip: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 14,
    height: 14,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  resizeBarLong: {
    width: 10,
    height: 1.5,
    backgroundColor: '#9CA3AF',
    transform: [{ rotate: '-45deg' }],
    marginBottom: 2,
    marginRight: 2,
  },
  resizeBarShort: {
    width: 6,
    height: 1.5,
    backgroundColor: '#9CA3AF',
    transform: [{ rotate: '-45deg' }],
    marginBottom: 2,
    marginRight: 2,
  },
  sparkleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  sparkleActionPressed: {
    opacity: 0.7,
  },
  sparkleActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  feedbackBanner: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.successText,
  },
  actionsContainer: {
    gap: 12,
    marginTop: spacing.xs,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfActionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  halfActionButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  halfActionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  shareButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
  footerNoteContainer: {
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  footerNoteText: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
