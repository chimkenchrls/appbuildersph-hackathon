import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBar } from '@/components/workspace/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/workspace/Icon';
import { hapticSuccess, hapticImpactLight } from '@/utils/haptics';
import { useExitGuard } from '@/hooks/useExitGuard';
import { parseEstimate } from '@/safety/parseEstimate';
import { errorMessage } from '@/services/errors';
import { newId } from '@/utils/ids';
import type { Project, ScopeDraft, Requirement, TaxTreatment } from '@/types/domain';

interface ScopeDraftScreenProps {
  project: Project;
  draft: ScopeDraft;
  sourceConversation?: string;
  onSaveDraft: (draft: ScopeDraft) => Promise<void>;
  onBack: () => void;
  onConfirmScope: (updatedDraft: ScopeDraft) => Promise<void>;
}

export function ScopeDraftScreen({
  project,
  draft,
  sourceConversation = '',
  onConfirmScope,
  onSaveDraft,
}: ScopeDraftScreenProps) {
  const [budgetInvalid, setBudgetInvalid] = useState(false);
  const [savedKey, setSavedKey] = useState(JSON.stringify(draft));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  // Collapsible accordion for pasted source conversation
  const [conversationExpanded, setConversationExpanded] = useState(false);

  // Editable draft states
  const [title, setTitle] = useState(draft.title || project.title || 'Project Scope');
  const [budgetAmount, setBudgetAmount] = useState<number | null>(
    draft.budgetAmount != null ? draft.budgetAmount : null,
  );
  const [durationDays, setDurationDays] = useState<number | null>(
    draft.durationDays != null ? draft.durationDays : null,
  );
  const [timelineNotes, setTimelineNotes] = useState(
    draft.timelineNotes || '',
  );
  const [revisionTerms, setRevisionTerms] = useState(
    draft.revisionTerms || '',
  );
  const [deadline, setDeadline] = useState<string | null>(draft.deadline || null);
  const [taxTreatment, setTaxTreatment] = useState<TaxTreatment>(
    draft.taxTreatment || 'none_specified',
  );
  const [requirements, setRequirements] = useState<Requirement[]>(() => {
    if (draft.requirements && draft.requirements.length > 0) {
      return draft.requirements;
    }
    return [];
  });

  // Modal states for interactive editing
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null);
  const [editReqTitle, setEditReqTitle] = useState('');
  const [editReqDesc, setEditReqDesc] = useState('');

  const [deliveryModalVisible, setDeliveryModalVisible] = useState(false);
  const [customDeadlineInput, setCustomDeadlineInput] = useState('');

  const [termModalVisible, setTermModalVisible] = useState<
    'budget' | 'timeline' | 'revisions' | 'tax' | null
  >(null);
  const [tempBudgetInput, setTempBudgetInput] = useState('');
  const [tempTimelineInput, setTempTimelineInput] = useState('');
  const [tempRevisionsInput, setTempRevisionsInput] = useState('');

  const [manualEditModalVisible, setManualEditModalVisible] = useState(false);

  // Formatted display values
  const displayBudget = useMemo(() => {
    if (budgetAmount != null) {
      return `₱${budgetAmount.toLocaleString('en-US')}`;
    }
    return 'To be agreed';
  }, [budgetAmount]);

  const displayTimeline = useMemo(() => {
    if (timelineNotes && timelineNotes.trim()) {
      return timelineNotes;
    }
    if (durationDays != null) {
      if (durationDays % 7 === 0 && durationDays >= 7) {
        const weeks = durationDays / 7;
        return `${weeks} week${weeks === 1 ? '' : 's'}`;
      }
      return `${durationDays} day${durationDays === 1 ? '' : 's'}`;
    }
    return 'To be agreed';
  }, [durationDays, timelineNotes]);

  const displayRevisions = useMemo(() => {
    if (revisionTerms && revisionTerms.trim()) {
      return revisionTerms;
    }
    return 'To be agreed';
  }, [revisionTerms]);

  const displayTaxTreatment = useMemo(() => {
    switch (taxTreatment) {
      case 'net_of_withholding':
        return 'Net of withholding';
      case 'inclusive':
        return 'Tax inclusive';
      case 'subject_to_2307':
        return 'Subject to 2307';
      case 'none_specified':
      default:
        return 'To be agreed';
    }
  }, [taxTreatment]);

  const sourceConversationText = useMemo(() => {
    if (draft.sourceConversation && draft.sourceConversation.trim()) {
      return draft.sourceConversation.trim();
    }
    if (project.description && project.description.trim()) {
      return project.description.trim();
    }
    return 'No conversation text recorded for this draft.';
  }, [draft.sourceConversation, project.description]);

  // Handlers for single requirement editing
  const handleOpenEditRequirement = (req: Requirement) => {
    setEditingRequirement(req);
    setEditReqTitle(req.title);
    setEditReqDesc(req.description);
  };

  const handleSaveRequirement = () => {
    if (!editingRequirement) return;
    hapticImpactLight();
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === editingRequirement.id
          ? { ...r, title: editReqTitle.trim() || r.title, description: editReqDesc.trim() }
          : r,
      ),
    );
    setEditingRequirement(null);
  };

  const handleDeleteRequirement = () => {
    if (!editingRequirement) return;
    hapticImpactLight();
    setRequirements((prev) => prev.filter((r) => r.id !== editingRequirement.id));
    setEditingRequirement(null);
  };

  const handleAddNewRequirement = () => {
    hapticImpactLight();
    const nextId = newId('REQ');
    const newReq: Requirement = {
      id: nextId,
      title: 'New deliverable',
      description: 'Describe deliverable requirements and acceptance criteria.',
      category: 'deliverable',
    };
    setRequirements((prev) => [...prev, newReq]);
  };

  // Handlers for term edits
  const handleOpenEditBudget = () => {
    setTempBudgetInput(budgetAmount != null ? String(budgetAmount) : '');
    setTermModalVisible('budget');
  };

  const handleSaveBudget = () => {
    try {
      setBudgetAmount(parseEstimate(tempBudgetInput)); setBudgetInvalid(false);
      setTermModalVisible(null);
    } catch (reason) { setFeedback(errorMessage(reason)); }

  };

  const handleOpenEditTimeline = () => {
    setTempTimelineInput(displayTimeline);
    setTermModalVisible('timeline');
  };

  const handleSaveTimeline = () => {
    if (tempTimelineInput.trim()) {
      const trimmed = tempTimelineInput.trim();
      setTimelineNotes(trimmed);
      const numMatch = trimmed.match(/(\d+)\s*days?/i);
      const weekMatch = trimmed.match(/(\d+)\s*weeks?/i);
      if (numMatch && numMatch[1]) {
        setDurationDays(parseInt(numMatch[1], 10));
      } else if (weekMatch && weekMatch[1]) {
        setDurationDays(parseInt(weekMatch[1], 10) * 7);
      }
    }
    setTermModalVisible(null);
  };

  const handleOpenEditRevisions = () => {
    setTempRevisionsInput(displayRevisions);
    setTermModalVisible('revisions');
  };

  const handleSaveRevisions = () => {
    if (tempRevisionsInput.trim()) {
      setRevisionTerms(tempRevisionsInput.trim());
    }
    setTermModalVisible(null);
  };

  const handleOpenEditDeadline = () => {
    setCustomDeadlineInput(deadline || '');
    setDeliveryModalVisible(true);
  };

  const handleSetPresetDeadline = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const formatted = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    setDeadline(formatted);
    setDeliveryModalVisible(false);
  };

  const handleSaveCustomDeadline = () => {
    if (customDeadlineInput.trim()) {
      setDeadline(customDeadlineInput.trim());
    } else {
      setDeadline(null);
    }
    setDeliveryModalVisible(false);
  };

  const currentDraft: ScopeDraft = {
      ...draft,
      title: title.trim() || draft.title || project.title,
      budgetAmount: budgetAmount != null ? budgetAmount : null,
      budgetCurrency: draft.budgetCurrency || 'PHP',
      budgetNotes:
        draft.budgetNotes ||
        (budgetAmount != null ? `Fixed price: ₱${budgetAmount.toLocaleString('en-US')}` : null),
      durationDays: durationDays != null ? durationDays : null,
      deadline: deadline || null,
      timelineNotes: timelineNotes || (durationDays ? `${durationDays} days turnaround` : null),
      revisionTerms: revisionTerms || null,
      exclusions: draft.exclusions || [],
      missingInformation: [
        ...(budgetAmount == null ? ['Agreed budget is not specified.'] : []),
        ...(!deadline && !durationDays ? ['Delivery deadline or timeline is not specified.'] : []),
        ...(!revisionTerms ? ['Revision allowance is not specified.'] : []),
      ],
      taxTreatment,
      requirements,
    };
  const persist = async () => {
    try {
      if (budgetInvalid) return false;
      await onSaveDraft(currentDraft);
      setSavedKey(JSON.stringify(currentDraft));
      return true;
    } catch (reason) { setFeedback(errorMessage(reason)); return false; }
  };
  const guardedBack = useExitGuard({ blocked: saving || JSON.stringify(currentDraft) !== savedKey,
    parent: '/', prepare: persist, retrySave: true });

  // Confirm Scope handler
  const handleConfirm = async () => {
    if (saving || budgetInvalid) return;
    setSaving(true); setFeedback(null);

    try { await onConfirmScope(currentDraft); await hapticSuccess(); }
    catch (reason) { setFeedback(errorMessage(reason)); }
    finally { setSaving(false); }
  };

  const headerSubtitle =
    project.description && project.description !== 'Website design & development'
      ? project.description
      : 'Project field';

  return (
    <View style={styles.container}>
      {/* Top Header matching exact mockup */}
      <HeaderBar
        title={project.title || 'Project Scope'}
        subtitle={headerSubtitle}
        showBack={true}
        onBack={guardedBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {feedback && <Text accessibilityRole="alert" style={{ color: colors.errorText }}>{feedback}</Text>}
        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>BRIEFCRAFT</Text>
          <Text style={styles.headline}>Review your scope</Text>
          <Text style={styles.subhead}>
            A draft from your conversation.{'\n'}Check each detail before you confirm.
          </Text>
        </View>

        {/* View pasted conversation Card (Accordion) */}
        <View style={styles.conversationCard}>
          <Pressable
            style={({ pressed }) => [
              styles.conversationHeader,
              pressed && styles.cardHeaderPressed,
            ]}
            onPress={() => setConversationExpanded(!conversationExpanded)}
            accessibilityRole="button"
            accessibilityLabel="Toggle pasted conversation"
          >
            <View style={styles.conversationLeftCol}>
              <View style={styles.conversationIconWrap}>
                <AppIcon name="message" size={20} color={colors.primary} />
              </View>
              <View style={styles.conversationTextCol}>
                <Text style={styles.conversationTitle}>View pasted conversation</Text>
                <Text style={styles.conversationSubtitle}>Source for this draft</Text>
              </View>
            </View>
            <AppIcon
              name={conversationExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>

          {conversationExpanded && (
            <View style={styles.conversationBody}>
              <View style={styles.conversationDivider} />
              <Text style={styles.conversationText}>{sourceConversationText}</Text>
            </View>
          )}
        </View>

        {/* Deliverables Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Deliverables</Text>
          <Text style={styles.sectionCount}>
            {requirements.length} item{requirements.length === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.deliverablesCard}>
          {requirements.map((req, index) => (
            <React.Fragment key={req.id}>
              <View style={styles.deliverableRow}>
                {/* ID Badge */}
                <View style={styles.reqBadge}>
                  <Text style={styles.reqBadgeText}>{req.id}</Text>
                </View>

                {/* Title & Description */}
                <View style={styles.reqContentCol}>
                  <Text style={styles.reqTitleText}>{req.title}</Text>
                  {req.description ? (
                    <Text style={styles.reqDescText}>{req.description}</Text>
                  ) : null}
                </View>

                {/* Edit Pencil Icon Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.editIconBtn,
                    pressed && styles.editIconBtnPressed,
                  ]}
                  onPress={() => handleOpenEditRequirement(req)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${req.title}`}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <AppIcon name="pencil" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>

              {index < requirements.length - 1 && (
                <View style={styles.deliverableDivider} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* Project Terms Section */}
        <Text style={styles.termsSectionTitle}>Project terms</Text>

        <View style={styles.termsGrid}>
          {/* Row 1: Budget and Timeline */}
          <View style={styles.termsRow}>
            {/* Budget Box */}
            <Pressable
              style={({ pressed }) => [
                styles.termCard,
                pressed && styles.termCardPressed,
              ]}
              onPress={handleOpenEditBudget}
              accessibilityRole="button"
              accessibilityLabel="Edit budget"
            >
              <Text style={styles.termLabel}>Budget</Text>
              <Text style={styles.termValue}>{displayBudget}</Text>
            </Pressable>

            {/* Timeline Box */}
            <Pressable
              style={({ pressed }) => [
                styles.termCard,
                pressed && styles.termCardPressed,
              ]}
              onPress={handleOpenEditTimeline}
              accessibilityRole="button"
              accessibilityLabel="Edit timeline"
            >
              <Text style={styles.termLabel}>Timeline</Text>
              <Text style={styles.termValue}>{displayTimeline}</Text>
            </Pressable>
          </View>

          {/* Row 2: Revisions and Delivery */}
          <View style={styles.termsRow}>
            {/* Revisions Box */}
            <Pressable
              style={({ pressed }) => [
                styles.termCard,
                pressed && styles.termCardPressed,
              ]}
              onPress={handleOpenEditRevisions}
              accessibilityRole="button"
              accessibilityLabel="Edit revisions"
            >
              <Text style={styles.termLabel}>Revisions</Text>
              <Text style={styles.termValue}>{displayRevisions}</Text>
            </Pressable>

            {/* Delivery Box */}
            <Pressable
              style={({ pressed }) => [
                styles.termCard,
                pressed && styles.termCardPressed,
              ]}
              onPress={handleOpenEditDeadline}
              accessibilityRole="button"
              accessibilityLabel="Set delivery date"
            >
              <Text style={styles.termLabel}>Delivery</Text>
              <Text style={styles.termValue}>{deadline || 'Not set'}</Text>
            </Pressable>
          </View>

          {/* Row 3: Tax treatment (Full Width Box) */}
          <Pressable
            style={({ pressed }) => [
              styles.termCardFull,
              pressed && styles.termCardPressed,
            ]}
            onPress={() => setTermModalVisible('tax')}
            accessibilityRole="button"
            accessibilityLabel="Edit tax treatment"
          >
            <Text style={styles.termLabel}>Tax treatment</Text>
            <Text style={styles.termValue}>{displayTaxTreatment}</Text>
          </Pressable>
        </View>

        {/* Warning / Missing Info Banner */}
        {!deadline && (
          <Pressable
            style={({ pressed }) => [
              styles.noticeBanner,
              pressed && styles.noticeBannerPressed,
            ]}
            onPress={handleOpenEditDeadline}
            accessibilityRole="button"
            accessibilityLabel="Set missing delivery date"
          >
            <AppIcon name="info" size={18} color="#4A6060" />
            <View style={styles.noticeTextCol}>
              <Text style={styles.noticeTitle}>Delivery date is missing</Text>
              <Text style={styles.noticeSubtitle}>
                Add the agreed date before confirming.
              </Text>
            </View>
          </Pressable>
        )}

        {/* Action Buttons */}
        <Pressable
          style={({ pressed }) => [
            styles.confirmBtn,
            pressed && styles.confirmBtnPressed,
          ]}
          disabled={saving}
          onPress={handleConfirm}
          accessibilityRole="button"
          accessibilityLabel="Release and confirm scope"
        >
          <AppIcon name="lock" size={17} color="#FFFFFF" />
          <Text style={styles.confirmBtnText}>{saving ? 'Saving…' : 'Release & Confirm Scope'}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.manualEditBtn,
            pressed && styles.manualEditBtnPressed,
          ]}
          onPress={() => setManualEditModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit manually"
        >
          <AppIcon name="pencil" size={14} color={colors.primary} />
          <Text style={styles.manualEditBtnText}>Edit manually</Text>
        </Pressable>

        {/* Footnote Disclaimers */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>Confirmation records your review.</Text>
          <Text style={styles.disclaimerText}>Client approval is recorded separately.</Text>
        </View>
      </ScrollView>

      {/* MODAL 1: Edit Single Requirement */}
      <Modal
        visible={editingRequirement !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingRequirement(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditingRequirement(null)}
        >
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                Edit Deliverable ({editingRequirement?.id})
              </Text>
              <Pressable
                onPress={() => setEditingRequirement(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalInputLabel}>Deliverable Title</Text>
              <TextInput
                style={styles.modalTextInput}
                value={editReqTitle}
                onChangeText={setEditReqTitle}
                placeholder="e.g. Five responsive pages..."
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalInputLabel}>Description</Text>
              <TextInput
                style={[styles.modalTextInput, styles.modalTextArea]}
                value={editReqDesc}
                onChangeText={setEditReqDesc}
                placeholder="e.g. Home, About, Services, Work and Contact..."
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalButtonRow}>
              {requirements.length > 1 && (
                <Pressable
                  style={styles.modalDeleteBtn}
                  onPress={handleDeleteRequirement}
                >
                  <Text style={styles.modalDeleteBtnText}>Delete</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.modalSaveBtn}
                onPress={handleSaveRequirement}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 2: Set Delivery Date */}
      <Modal
        visible={deliveryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeliveryModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setDeliveryModalVisible(false)}
        >
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Delivery Target</Text>
              <Pressable onPress={() => setDeliveryModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.modalHelpText}>
              Set the delivery date or turnaround target for this project scope.
            </Text>

            <View style={styles.quickOptionsRow}>
              <Pressable
                style={styles.quickOptionPill}
                onPress={() => handleSetPresetDeadline(14)}
              >
                <Text style={styles.quickOptionText}>+ 2 weeks</Text>
              </Pressable>
              <Pressable
                style={styles.quickOptionPill}
                onPress={() => handleSetPresetDeadline(30)}
              >
                <Text style={styles.quickOptionText}>+ 1 month</Text>
              </Pressable>
              <Pressable
                style={styles.quickOptionPill}
                onPress={() => {
                  setDeadline(null);
                  setDeliveryModalVisible(false);
                }}
              >
                <Text style={styles.quickOptionText}>Clear (Not set)</Text>
              </Pressable>
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalInputLabel}>Or enter custom date / target</Text>
              <TextInput
                style={styles.modalTextInput}
                value={customDeadlineInput}
                onChangeText={setCustomDeadlineInput}
                placeholder="e.g. 24 Oct 2026 or 2 weeks turnaround"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <Pressable
                style={styles.modalSecondaryBtn}
                onPress={() => setDeliveryModalVisible(false)}
              >
                <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalSaveBtn}
                onPress={handleSaveCustomDeadline}
              >
                <Text style={styles.modalSaveBtnText}>Set Delivery</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 3: Term Quick Edits (Budget / Timeline / Revisions / Tax) */}
      <Modal
        visible={termModalVisible !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTermModalVisible(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTermModalVisible(null)}
        >
          <Pressable style={styles.modalDialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {termModalVisible === 'budget' && 'Edit Budget (PHP)'}
                {termModalVisible === 'timeline' && 'Edit Timeline'}
                {termModalVisible === 'revisions' && 'Edit Revisions'}
                {termModalVisible === 'tax' && 'Select Tax Treatment'}
              </Text>
              <Pressable onPress={() => setTermModalVisible(null)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {termModalVisible === 'budget' && (
              <>
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalInputLabel}>Agreed Amount (₱)</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={tempBudgetInput}
                    onChangeText={setTempBudgetInput}
                    keyboardType="numeric"
                    placeholder="15000"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <View style={styles.modalButtonRow}>
                  <Pressable
                    style={styles.modalSaveBtn}
                    onPress={handleSaveBudget}
                  >
                    <Text style={styles.modalSaveBtnText}>Save Budget</Text>
                  </Pressable>
                </View>
              </>
            )}

            {termModalVisible === 'timeline' && (
              <>
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalInputLabel}>Turnaround / Timeline</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={tempTimelineInput}
                    onChangeText={setTempTimelineInput}
                    placeholder="e.g. 2 weeks"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <View style={styles.modalButtonRow}>
                  <Pressable
                    style={styles.modalSaveBtn}
                    onPress={handleSaveTimeline}
                  >
                    <Text style={styles.modalSaveBtnText}>Save Timeline</Text>
                  </Pressable>
                </View>
              </>
            )}

            {termModalVisible === 'revisions' && (
              <>
                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalInputLabel}>Revision Policy</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    value={tempRevisionsInput}
                    onChangeText={setTempRevisionsInput}
                    placeholder="e.g. 2 rounds"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <View style={styles.modalButtonRow}>
                  <Pressable
                    style={styles.modalSaveBtn}
                    onPress={handleSaveRevisions}
                  >
                    <Text style={styles.modalSaveBtnText}>Save Revisions</Text>
                  </Pressable>
                </View>
              </>
            )}

            {termModalVisible === 'tax' && (
              <View style={styles.taxOptionsList}>
                {(
                  [
                    { key: 'none_specified', label: 'To be agreed' },
                    { key: 'net_of_withholding', label: 'Net of withholding (BIR 2307)' },
                    { key: 'inclusive', label: 'Tax inclusive' },
                    { key: 'subject_to_2307', label: 'Subject to 2307' },
                  ] as const
                ).map((opt) => (
                  <Pressable
                    key={opt.key}
                    style={[
                      styles.taxOptionItem,
                      taxTreatment === opt.key && styles.taxOptionItemSelected,
                    ]}
                    onPress={() => {
                      setTaxTreatment(opt.key);
                      setTermModalVisible(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.taxOptionText,
                        taxTreatment === opt.key && styles.taxOptionTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {taxTreatment === opt.key ? (
                      <AppIcon name="check" size={16} color={colors.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL 4: Full Manual Edit Modal */}
      <Modal
        visible={manualEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualEditModalVisible(false)}
        statusBarTranslucent
      >
        <View
          style={[
            styles.fullModalContainer,
            {
              paddingTop: Math.max(insets.top + 8, 44),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.fullModalHeader}>
            <Text style={styles.fullModalTitle}>Edit Scope Manually</Text>
            <Pressable
              onPress={() => setManualEditModalVisible(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.fullModalScroll}
            contentContainerStyle={styles.fullModalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalInputLabel}>Scope Title</Text>
              <TextInput
                style={styles.modalTextInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Scope Title..."
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.termsRow}>
              <View style={[styles.modalFieldGroup, { flex: 1 }]}>
                <Text style={styles.modalInputLabel}>Budget (₱)</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={budgetAmount != null ? String(budgetAmount) : ''}
                  onChangeText={(val) => {
                    try { setBudgetAmount(parseEstimate(val)); setBudgetInvalid(false); }
                    catch (reason) { setBudgetInvalid(true); setFeedback(errorMessage(reason)); }
                  }}
                  keyboardType="numeric"
                  placeholder="15000"
                  placeholderTextColor={colors.placeholder}
                />
              </View>

              <View style={[styles.modalFieldGroup, { flex: 1 }]}>
                <Text style={styles.modalInputLabel}>Timeline</Text>
                <TextInput
                  style={styles.modalTextInput}
                  value={timelineNotes}
                  onChangeText={setTimelineNotes}
                  placeholder="2 weeks"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalInputLabel}>Delivery Target Date</Text>
              <TextInput
                style={styles.modalTextInput}
                value={deadline || ''}
                onChangeText={setDeadline}
                placeholder="e.g. 24 Oct 2026 (or leave blank for Not set)"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.modalFieldGroup}>
              <Text style={styles.modalInputLabel}>Revision Terms</Text>
              <TextInput
                style={styles.modalTextInput}
                value={revisionTerms}
                onChangeText={setRevisionTerms}
                placeholder="Two rounds of revisions included..."
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Deliverables</Text>
              <Pressable
                onPress={handleAddNewRequirement}
                style={styles.addReqPill}
              >
                <Text style={styles.addReqPillText}>+ Add</Text>
              </Pressable>
            </View>

            {requirements.map((req, idx) => (
              <View key={req.id} style={styles.manualReqRow}>
                <View style={styles.manualReqBadge}>
                  <Text style={styles.reqBadgeText}>{req.id}</Text>
                </View>
                <View style={styles.manualReqInputs}>
                  <TextInput
                    style={styles.manualReqTitleInput}
                    value={req.title}
                    onChangeText={(newTitle) => {
                      setRequirements((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, title: newTitle } : r)),
                      );
                    }}
                    placeholder="Deliverable title"
                    placeholderTextColor={colors.placeholder}
                  />
                  <TextInput
                    style={styles.manualReqDescInput}
                    value={req.description}
                    onChangeText={(newDesc) => {
                      setRequirements((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, description: newDesc } : r)),
                      );
                    }}
                    placeholder="Deliverable description"
                    placeholderTextColor={colors.placeholder}
                    multiline
                  />
                </View>
              </View>
            ))}

            <Pressable
              style={styles.modalSaveBtn}
              onPress={() => setManualEditModalVisible(false)}
            >
              <Text style={styles.modalSaveBtnText}>Save & Return to Review</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// Named alias for backwards compatibility
export { ScopeDraftScreen as ReviewScopeScreen };

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
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#111827',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subhead: {
    fontSize: 13.5,
    color: '#4B5563',
    lineHeight: 19,
  },
  conversationCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    marginBottom: 20,
    ...shadows.card,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardHeaderPressed: {
    backgroundColor: '#F8FAFA',
  },
  conversationLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  conversationIconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationTextCol: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  conversationSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  conversationBody: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  conversationDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 10,
  },
  conversationText: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sectionCount: {
    fontSize: 12,
    color: '#64748B',
  },
  deliverablesCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    marginBottom: 20,
    ...shadows.card,
  },
  deliverableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 12,
  },
  reqBadge: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    marginTop: 1,
  },
  reqBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  reqContentCol: {
    flex: 1,
  },
  reqTitleText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 19,
  },
  reqDescText: {
    fontSize: 12.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 18,
  },
  editIconBtn: {
    padding: 4,
    borderRadius: 6,
    marginTop: 1,
  },
  editIconBtnPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  deliverableDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  termsSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  termsGrid: {
    gap: 10,
    marginBottom: 14,
  },
  termsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  termCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  termCardFull: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  termCardPressed: {
    backgroundColor: '#F7FAFA',
  },
  termLabel: {
    fontSize: 11.5,
    fontWeight: '400',
    color: '#64748B',
  },
  termValue: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  noticeBanner: {
    backgroundColor: '#EAF2F1',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  noticeBannerPressed: {
    backgroundColor: '#DFECEB',
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  noticeSubtitle: {
    fontSize: 12,
    color: '#4A6060',
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnPressed: {
    backgroundColor: colors.primaryPressed,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  manualEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
  },
  manualEditBtnPressed: {
    opacity: 0.7,
  },
  manualEditBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  disclaimerContainer: {
    marginTop: 18,
    marginBottom: 28,
    alignItems: 'center',
    gap: 2,
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseText: {
    fontSize: 16,
    color: colors.textSecondary,
    padding: 4,
  },
  modalHelpText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  modalFieldGroup: {
    marginBottom: 14,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  modalTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSecondaryBtn: {
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  modalDeleteBtn: {
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
  },
  modalDeleteBtnText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
  },
  quickOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickOptionPill: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  quickOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  taxOptionsList: {
    gap: 8,
    marginVertical: 8,
  },
  taxOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  taxOptionItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F4F9F9',
  },
  taxOptionText: {
    fontSize: 14,
    color: '#111827',
  },
  taxOptionTextSelected: {
    fontWeight: '700',
    color: colors.primary,
  },
  // Full modal styling
  fullModalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  fullModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  fullModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  fullModalScroll: {
    flex: 1,
  },
  fullModalScrollContent: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  addReqPill: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
  },
  addReqPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  manualReqRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  manualReqBadge: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 6,
  },
  manualReqInputs: {
    flex: 1,
    gap: 6,
  },
  manualReqTitleInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  manualReqDescInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#475569',
  },
});
