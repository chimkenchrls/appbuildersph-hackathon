import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { HeaderBar } from '@/components/workspace/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/workspace/Icon';
import { ShareService } from '@/services/domain/shareService';
import { hapticSuccess, hapticImpactLight } from '@/utils/haptics';
import { conflictingExclusions } from '@/safety/scopeExclusions';
import { errorMessage } from '@/services/errors';
import type {
  Project,
  Agreement,
  ScopeDraft,
  ClientRequest,
  ScopeGuardAnalysis,
  ChangeProposal,
} from '@/types/domain';

interface ProjectOverviewScreenProps {
  currentProject: Project;
  allProjects: Project[];
  agreements: Agreement[];
  selectedAgreement: Agreement | null;
  requests?: ClientRequest[];
  analyses?: Record<string, ScopeGuardAnalysis>;
  proposals?: Record<string, ChangeProposal>;
  onSelectProject: (projectId: string) => void;
  onSelectAgreementVersion: (agreement: Agreement) => void;
  onNavigateToNewRequest: () => void;
  onReviewRequest?: (request: ClientRequest) => void | Promise<void>;
  onAcceptRequest?: (
    request: ClientRequest,
    additions: string[],
    additionalFee: number | null,
    additionalDays: number | null,
    signatoryName?: string | null,
    approvalNotes?: string | null,
  ) => Promise<void> | void;
  onRecordClientApproval?: (
    agreementId: string,
    signatoryName: string,
    signatureNotes?: string,
  ) => Promise<void> | void;
  onResolveExclusionConflicts?: () => Promise<void>;
  onDeleteRequest?: (requestId: string) => Promise<void> | void;
  onDeleteProject?: (projectId: string) => Promise<void> | void;
  onBack: () => void;
  onReleaseScope?: () => void;
  onEditScopeDraft?: () => void;
  freelancerName?: string;
  freelancerRole?: string;
}

function FreelancerCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="10" r="8" stroke="#1A1A1A" strokeWidth="1.6" />
      <Path
        d="M6.8 10.2L8.9 12.3L13.2 8"
        stroke="#1A1A1A"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClientPendingIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle
        cx="10"
        cy="10"
        r="8"
        stroke="#6B7280"
        strokeWidth="1.5"
        strokeDasharray="2.5 2.5"
      />
    </Svg>
  );
}

function ChevronDownIcon({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path
        d="M2.5 4.5L6 8L9.5 4.5"
        stroke="#1A1A1A"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function formatDeliveryDate(deadline: string | null | undefined): string {
  if (!deadline) return 'Not specified';
  const date = new Date(deadline);
  if (isNaN(date.getTime())) return deadline;
  const day = date.getDate();
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatTurnaround(
  timelineNotes: string | null | undefined,
  durationDays: number | null | undefined,
): string {
  if (timelineNotes && timelineNotes.trim().length <= 15) {
    return timelineNotes.trim();
  }
  if (durationDays) {
    if (durationDays % 7 === 0) {
      const weeks = durationDays / 7;
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
    }
    return `${durationDays} days`;
  }
  return timelineNotes || 'Not specified';
}

function formatRevisionLimit(revisionTerms: string | null | undefined): string {
  if (!revisionTerms) return 'Not specified';
  const lower = revisionTerms.toLowerCase();
  if (lower.includes('2 round') || lower.includes('two round')) {
    return '2 rounds';
  }
  if (lower.includes('1 round') || lower.includes('one round')) {
    return '1 round';
  }
  if (lower.includes('3 round') || lower.includes('three round')) {
    return '3 rounds';
  }
  if (revisionTerms.trim().length <= 15) {
    return revisionTerms.trim();
  }
  return revisionTerms;
}

function formatTaxTreatment(taxTreatment: string | null | undefined): string {
  if (!taxTreatment || taxTreatment === 'none_specified' || taxTreatment === 'to_be_agreed') {
    return 'To be agreed';
  }
  if (taxTreatment === 'net_of_withholding') {
    return 'Net of withholding';
  }
  if (taxTreatment === 'inclusive') {
    return 'Inclusive of VAT';
  }
  if (taxTreatment === 'subject_to_2307') {
    return 'Subject to BIR 2307';
  }
  return 'To be agreed';
}

export function ProjectOverviewScreen({
  currentProject,
  agreements,
  selectedAgreement,
  requests = [],
  analyses = {},
  proposals = {},
  onSelectAgreementVersion,
  onNavigateToNewRequest,
  onReviewRequest,
  onAcceptRequest,
  onRecordClientApproval,
  onResolveExclusionConflicts,
  onDeleteRequest,
  onDeleteProject,
  onBack,
  onReleaseScope,
  onEditScopeDraft,
  freelancerName = 'Independent Developer',
  freelancerRole = 'Independent Professional',
}: ProjectOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const handleConfirmDeleteProject = () => {
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        window.confirm(
          `Are you sure you want to delete "${currentProject.title}"? This cannot be undone.`,
        )
      ) {
        onDeleteProject?.(currentProject.id);
      }
    } else {
      Alert.alert(
        'Delete Project',
        `Are you sure you want to delete "${currentProject.title}"? This will permanently delete all associated agreements, requests, and proposals.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDeleteProject?.(currentProject.id),
          },
        ],
      );
    }
  };

  // Standalone client approval modal states
  const [clientApprovalModalOpen, setClientApprovalModalOpen] = useState(false);
  const [standaloneSignatory, setStandaloneSignatory] = useState('');
  const [standaloneNotes, setStandaloneNotes] = useState('');

  // Accept Scope Change modal states
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [targetRequest, setTargetRequest] = useState<ClientRequest | null>(null);
  const [selectedAdditions, setSelectedAdditions] = useState<string[]>([]);
  const [customAdditionText, setCustomAdditionText] = useState('');
  const [extraFee, setExtraFee] = useState('7000');
  const [extraDays, setExtraDays] = useState('5');
  const [recordClientApprovalCheckbox, setRecordClientApprovalCheckbox] = useState(true);
  const [signatoryName, setSignatoryName] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmittingAccept, setIsSubmittingAccept] = useState(false);

  const isDrafting = agreements.length === 0;

  const projectRequests = useMemo(() => {
    return requests || [];
  }, [requests]);

  const draftScope = useMemo<ScopeDraft | null>(() => {
    if (!currentProject.draftScopeJson) return null;
    try {
      return JSON.parse(currentProject.draftScopeJson) as ScopeDraft;
    } catch {
      return null;
    }
  }, [currentProject.draftScopeJson]);

  const activeAgreement = selectedAgreement || agreements[0] || null;
  const isLatest =
    agreements.length > 0 && activeAgreement?.id === agreements[0].id;
  const exclusionConflicts = activeAgreement ? conflictingExclusions(activeAgreement) : [];

  const confirmExclusionCorrection = async () => {
    if (!onResolveExclusionConflicts || correcting) return;
    setCorrecting(true);
    setCorrectionError(null);
    try {
      await onResolveExclusionConflicts();
      setCorrectionOpen(false);
      await hapticSuccess();
    } catch (reason) { setCorrectionError(errorMessage(reason)); }
    finally { setCorrecting(false); }
  };

  const handleOpenAcceptModal = (req: ClientRequest) => {
    setTargetRequest(req);
    const reqAnalysis = analyses?.[req.id];
    const detectedAdditions = reqAnalysis
      ? reqAnalysis.findings
          .filter((f) => f.classification === 'potential_additional')
          .map((f) => f.item)
      : [];

    setSelectedAdditions(
      detectedAdditions.length > 0
        ? detectedAdditions
        : [req.rawText.slice(0, 35) + '...'],
    );
    setCustomAdditionText('');
    setExtraFee('7000');
    setExtraDays('5');
    setRecordClientApprovalCheckbox(true);
    setSignatoryName(currentProject.clientName || 'Client');
    setApprovalNotes('Agreed offline via direct conversation');
    setAcceptModalOpen(true);
  };

  const handleToggleAddition = (item: string) => {
    setSelectedAdditions((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item],
    );
  };

  const handleAddCustomAddition = () => {
    if (customAdditionText.trim()) {
      const trimmed = customAdditionText.trim();
      if (!selectedAdditions.includes(trimmed)) {
        setSelectedAdditions((prev) => [...prev, trimmed]);
      }
      setCustomAdditionText('');
    }
  };

  const handleConfirmAcceptRequest = async () => {
    if (!targetRequest || !onAcceptRequest) return;
    const items = [...selectedAdditions];
    if (customAdditionText.trim() && !items.includes(customAdditionText.trim())) {
      items.push(customAdditionText.trim());
    }

    if (items.length === 0) {
      Alert.alert(
        'Deliverable required',
        'Please select or enter at least one deliverable to add.',
      );
      return;
    }

    setIsSubmittingAccept(true);
    try {
      const feeNum = extraFee.trim()
        ? parseInt(extraFee.replace(/[^0-9]/g, ''), 10)
        : null;
      const daysNum = extraDays.trim()
        ? parseInt(extraDays.replace(/[^0-9]/g, ''), 10)
        : null;

      await onAcceptRequest(
        targetRequest,
        items,
        feeNum,
        daysNum,
        recordClientApprovalCheckbox
          ? signatoryName.trim() || currentProject.clientName || 'Client'
          : null,
        recordClientApprovalCheckbox
          ? approvalNotes.trim() || 'Offline agreement'
          : null,
      );

      await hapticSuccess();
      setAcceptModalOpen(false);
      setTargetRequest(null);
    } catch {
      Alert.alert('Error', 'Unable to accept request.');
    } finally {
      setIsSubmittingAccept(false);
    }
  };

  const handleRecordStandaloneClientApproval = async () => {
    if (!activeAgreement || !onRecordClientApproval) return;
    const signatory =
      standaloneSignatory.trim() || currentProject.clientName || 'Client';
    await hapticSuccess();
    try {
      await onRecordClientApproval(
        activeAgreement.id,
        signatory,
        standaloneNotes.trim() || 'Offline agreement',
      );
      setClientApprovalModalOpen(false);
    } catch {
      Alert.alert('Error', 'Unable to record client approval.');
    }
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleShareContractPdf = async () => {
    if (!activeAgreement) return;
    await hapticImpactLight();
    setIsExportingPdf(true);
    try {
      const shared = await ShareService.shareContractPdf(activeAgreement, {
        freelancerName: freelancerName || 'Independent Developer',
        clientName: currentProject.clientName || 'Client',
        paymentMethod: 'Bank Transfer / GCash / Maya',
      });
      if (shared) {
        await hapticSuccess();
        setShareFeedback('Contract PDF generated & ready to share.');
      } else {
        setShareFeedback('PDF export dialog dismissed.');
      }
    } catch {
      setShareFeedback('Unable to generate or share PDF contract.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleShareContract = async () => {
    if (!activeAgreement) return;
    await hapticImpactLight();
    try {
      const shared = await ShareService.shareContract(activeAgreement, {
        freelancerName: freelancerName || 'Independent Developer',
        clientName: currentProject.clientName || 'Client',
        paymentMethod: 'Bank Transfer / GCash / Maya',
      });
      if (shared) await hapticSuccess();
      setShareFeedback(
        shared ? 'Contract shared successfully.' : 'Share dialog dismissed.',
      );
    } catch {
      setShareFeedback('Unable to launch share dialog.');
    }
  };

  const displayDeliverables: { id: string; title: string; description: string }[] = useMemo(() => {
    if (activeAgreement?.requirements?.length) {
      return activeAgreement.requirements.map((req) => ({
        id: req.id,
        title: req.title,
        description: req.description,
      }));
    }
    if (draftScope?.requirements?.length) {
      return draftScope.requirements.map((req) => ({
        id: req.id,
        title: req.title,
        description: req.description,
      }));
    }
    return [];
  }, [activeAgreement, draftScope]);

  const displayExclusions = useMemo(() => {
    // An empty confirmed list is authoritative; the original draft may still contain old exclusions.
    const rawExclusions: string[] =
      activeAgreement
        ? activeAgreement.exclusions
        : draftScope?.exclusions ?? [];

    return rawExclusions.map((exc, idx) => {
      const excId = `EXC-${String(idx + 1).padStart(2, '0')}`;
      let title = exc;
      let description = '';
      if (exc.includes(':')) {
        const parts = exc.split(':');
        title = parts[0].trim();
        description = parts.slice(1).join(':').trim();
      } else if (exc.includes(' - ')) {
        const parts = exc.split(' - ');
        title = parts[0].trim();
        description = parts.slice(1).join(' - ').trim();
      }
      return { id: excId, title, description };
    });
  }, [activeAgreement, draftScope]);

  const budgetCurrency =
    activeAgreement?.budgetCurrency || draftScope?.budgetCurrency || 'PHP';

  const effectiveBudget =
    activeAgreement ? activeAgreement.budgetAmount : draftScope?.budgetAmount;

  const budgetFormatted =
    effectiveBudget != null
      ? `₱${effectiveBudget.toLocaleString()}`
      : 'Not specified';

  const turnaroundFormatted = formatTurnaround(
    activeAgreement ? activeAgreement.timelineNotes : draftScope?.timelineNotes,
    activeAgreement ? activeAgreement.durationDays : draftScope?.durationDays,
  );

  const deliveryDateFormatted = formatDeliveryDate(
    activeAgreement ? activeAgreement.deadline : draftScope?.deadline,
  );
  const revisionFormatted = formatRevisionLimit(
    activeAgreement ? activeAgreement.revisionTerms : draftScope?.revisionTerms,
  );
  const taxTreatmentFormatted = formatTaxTreatment(
    activeAgreement?.taxTreatment ?? draftScope?.taxTreatment,
  );

  const projectSubtitle =
    currentProject.description ||
    currentProject.clientName ||
    'Website design & development';

  return (
    <View style={styles.container}>
      {/* Top Header Bar matching UI Design */}
      <HeaderBar
        title={currentProject.title}
        subtitle={projectSubtitle}
        showBack={true}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Confirmed / Drafting Workspace Header */}
        <View style={styles.headingSection}>
          <Text style={styles.eyebrow}>
            {isDrafting ? 'DRAFT SCOPE · PENDING RELEASE' : 'CONFIRMED WORKSPACE'}
          </Text>
          <Text style={styles.headline}>Project overview</Text>
          <Text style={styles.subhead}>
            {isDrafting
              ? 'This scope is drafted. Release it to seal the confirmed baseline.'
              : 'Your confirmed project scope, ready for daily reference.'}
          </Text>
        </View>

        {/* Primary CTA Area */}
        {isDrafting ? (
          <View style={styles.draftActionsCol}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                styles.releaseButton,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={onReleaseScope}
              accessibilityRole="button"
              accessibilityLabel="Release scope and confirm baseline"
            >
              <Text style={styles.primaryButtonText}>Release Scope</Text>
            </Pressable>

            {onEditScopeDraft ? (
              <Pressable
                style={({ pressed }) => [
                  styles.editDraftButton,
                  pressed && styles.editDraftButtonPressed,
                ]}
                onPress={onEditScopeDraft}
                accessibilityRole="button"
                accessibilityLabel="Edit scope draft"
              >
                <AppIcon name="pencil" size={15} color={colors.primary} />
                <Text style={styles.editDraftButtonText}>Edit Scope Draft</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          /* Primary CTA: Add new client request */
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={onNavigateToNewRequest}
            accessibilityRole="button"
            accessibilityLabel="Add new client request"
          >
            <Text style={styles.primaryButtonText}>+ Add new client request</Text>
          </Pressable>
        )}

        {/* Workspace Card */}
        <View style={styles.confirmedCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderLeft}>
              <Text style={styles.projectTitle} numberOfLines={1}>
                {currentProject.title}
              </Text>
              <Text style={styles.projectSubtitle} numberOfLines={1}>
                {projectSubtitle}
              </Text>
            </View>
            <View style={styles.cardHeaderRight}>
              <Text
                style={
                  isDrafting
                    ? styles.statusDraftingText
                    : styles.statusConfirmed
                }
              >
                {isDrafting ? 'Drafting' : 'Confirmed'}
              </Text>
              <Text style={styles.clientConfirmed} numberOfLines={1}>
                {currentProject.clientName || currentProject.title}
              </Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.checklist}>
            <View style={styles.checkItem}>
              <FreelancerCheckIcon size={18} />
              <Text style={styles.checkText}>
                {isDrafting ? 'Scope drafted: created' : 'Confirmed by: freelancer'}
              </Text>
            </View>
            <View style={styles.checkItem}>
              {activeAgreement?.clientApprovedAt ? (
                <FreelancerCheckIcon size={18} />
              ) : (
                <ClientPendingIcon size={18} />
              )}
              <View style={styles.checkApprovalRow}>
                <Text
                  style={
                    activeAgreement?.clientApprovedAt
                      ? styles.checkText
                      : styles.checkTextSecondary
                  }
                >
                  {isDrafting
                    ? 'Baseline release: Pending release'
                    : activeAgreement?.clientApprovedAt
                      ? `Client Approval: Approved by ${activeAgreement.clientSignatoryName || currentProject.clientName || 'Client'}`
                      : 'Client Approval: Not recorded yet'}
                </Text>
                {!isDrafting && !activeAgreement?.clientApprovedAt && onRecordClientApproval && (
                  <Pressable
                    style={styles.recordBadgeBtn}
                    onPress={() => {
                      setStandaloneSignatory(currentProject.clientName || 'Client');
                      setStandaloneNotes('Agreed offline via direct conversation');
                      setClientApprovalModalOpen(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Record client approval"
                  >
                    <Text style={styles.recordBadgeBtnText}>Record</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Agreement History Selector or Drafting Notice */}
        {!isDrafting ? (
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>Agreement history</Text>
            <Pressable
              style={styles.versionPickerButton}
              onPress={() => setVersionPickerOpen(true)}
              accessibilityRole="combobox"
              accessibilityLabel={`Select agreement version. Currently v${activeAgreement?.versionNumber || 2}`}
            >
              <Text style={styles.versionPickerText}>
                v{activeAgreement?.versionNumber || 2} · {isLatest ? 'Current' : 'Historical'}
              </Text>
              <ChevronDownIcon size={12} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.draftNoticeBanner}>
            <AppIcon name="info" size={16} color="#B45309" />
            <Text style={styles.draftNoticeText}>
              Click <Text style={styles.boldText}>Release Scope</Text> above to lock Agreement v1.
            </Text>
          </View>
        )}

        {/* Stored Client Requests Section */}
        {!isDrafting && (
          <View style={styles.requestsSection}>
            <View style={styles.requestsSectionHeader}>
              <View style={styles.requestsHeaderTitleCol}>
                <Text style={styles.sectionTitle}>Client Requests</Text>
                <Text style={styles.requestsSectionSub}>
                  Stored offline ({projectRequests.length}) · Talk with client to agree
                </Text>
              </View>
              <Pressable
                style={styles.addRequestSmallBtn}
                onPress={onNavigateToNewRequest}
                accessibilityRole="button"
                accessibilityLabel="Add client request"
              >
                <AppIcon name="plus" size={13} color={colors.primary} />
                <Text style={styles.addRequestSmallBtnText}>Add Request</Text>
              </Pressable>
            </View>

            {projectRequests.length === 0 ? (
              <View style={styles.emptyRequestsCard}>
                <AppIcon name="document" size={20} color={colors.textSecondary} />
                <View style={styles.emptyRequestsTextCol}>
                  <Text style={styles.emptyRequestsTitle}>No client requests stored</Text>
                  <Text style={styles.emptyRequestsDesc}>
                    When your client asks for changes, paste their message here to store offline.
                  </Text>
                </View>
                <Pressable
                  style={styles.emptyAddBtn}
                  onPress={onNavigateToNewRequest}
                >
                  <Text style={styles.emptyAddBtnText}>+ Add</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.requestsList}>
                {projectRequests.map((req) => {
                  const reqAnalysis = analyses?.[req.id] || null;
                  const isAccepted = req.status === 'accepted';
                  const additions = reqAnalysis?.findings.filter(
                    (f) => f.classification === 'potential_additional',
                  ) || [];
                  const included = reqAnalysis?.findings.filter(
                    (f) => f.classification === 'included',
                  ) || [];

                  return (
                    <View key={req.id} style={styles.requestCard}>
                      <View style={styles.requestCardHeader}>
                        <Text style={styles.requestDate}>
                          {new Date(req.createdAt).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                        <View
                          style={[
                            styles.requestStatusBadge,
                            isAccepted
                              ? styles.requestStatusBadgeAccepted
                              : styles.requestStatusBadgePending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.requestStatusText,
                              isAccepted
                                ? styles.requestStatusTextAccepted
                                : styles.requestStatusTextPending,
                            ]}
                          >
                            {isAccepted
                              ? '✓ Accepted in Scope'
                              : 'Stored · Pending client talk'}
                          </Text>
                        </View>
                      </View>

                      {/* Raw text quote */}
                      <View style={styles.requestQuoteBox}>
                        <Text style={styles.requestQuoteText} numberOfLines={3}>
                          &ldquo;{req.rawText}&rdquo;
                        </Text>
                      </View>

                      {/* Detected Findings Badges */}
                      {(additions.length > 0 || included.length > 0) && (
                        <View style={styles.findingsPillsRow}>
                          {additions.map((item, idx) => (
                            <View key={`add-${idx}`} style={styles.additionPill}>
                              <Text style={styles.additionPillText}>
                                + {item.item}
                              </Text>
                            </View>
                          ))}
                          {included.map((item, idx) => (
                            <View key={`inc-${idx}`} style={styles.includedPill}>
                              <Text style={styles.includedPillText}>
                                ✓ {item.item}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Action buttons */}
                      <View style={styles.requestActionsRow}>
                        {!isAccepted ? (
                          <>
                            {onAcceptRequest && (
                              <Pressable
                                style={({ pressed }) => [
                                  styles.acceptRequestBtn,
                                  pressed && styles.acceptRequestBtnPressed,
                                ]}
                                onPress={() => handleOpenAcceptModal(req)}
                                accessibilityRole="button"
                                accessibilityLabel="Accept request and update scope"
                              >
                                <AppIcon name="check" size={13} color="#FFFFFF" />
                                <Text style={styles.acceptRequestBtnText}>
                                  Accept Request
                                </Text>
                              </Pressable>
                            )}

                            {onReviewRequest && (
                              <Pressable
                                style={({ pressed }) => [
                                  styles.reviewRequestBtn,
                                  pressed && styles.reviewRequestBtnPressed,
                                ]}
                                onPress={async () => {
                                  try { await onReviewRequest(req); }
                                  catch (reason) { Alert.alert('Could not review request', reason instanceof Error ? reason.message : errorMessage(reason)); }
                                }}
                                accessibilityRole="button"
                                accessibilityLabel="Review request & proposal"
                              >
                                <AppIcon name="sparkles" size={13} color={colors.primary} />
                                <Text style={styles.reviewRequestBtnText}>
                                  Review &amp; Proposal
                                </Text>
                              </Pressable>
                            )}

                            {onDeleteRequest && (
                              <Pressable
                                style={styles.deleteRequestBtn}
                                onPress={() => onDeleteRequest(req.id)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Delete request"
                              >
                                <AppIcon name="trash" size={14} color={colors.textMuted} />
                              </Pressable>
                            )}
                          </>
                        ) : (
                          <View style={styles.acceptedNoticeRow}>
                            <FreelancerCheckIcon size={14} />
                            <Text style={styles.acceptedNoticeText}>
                              Agreed offline with client · Sealed into baseline
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Included Deliverables Section */}
        <Text style={styles.sectionTitle}>Included Deliverables</Text>
        <View style={styles.groupCard}>
          {displayDeliverables.map((item: { id: string; title: string; description: string }, index: number) => (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={styles.itemDivider} />}
              <View style={styles.itemRow}>
                <View style={styles.badgeBox}>
                  <Text style={styles.badgeText}>{item.id}</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Explicit Exclusions Section */}
        <Text style={styles.sectionTitle}>Explicit Exclusions</Text>
        {exclusionConflicts.length > 0 && (
          <View style={styles.groupCard}>
            <Text style={styles.itemDescription} accessibilityRole="alert">
              This version lists the same work as both included and excluded: {exclusionConflicts.join(', ')}.
            </Text>
            {isLatest && onResolveExclusionConflicts && (
              <Pressable style={styles.primaryButton} accessibilityRole="button"
                accessibilityLabel="Review conflicting exclusions"
                onPress={() => { setCorrectionError(null); setCorrectionOpen(true); }}>
                <Text style={styles.primaryButtonText}>Review exclusion correction</Text>
              </Pressable>
            )}
          </View>
        )}
        <View style={styles.groupCard}>
          {displayExclusions.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={styles.itemDivider} />}
              <View style={styles.itemRow}>
                <View style={styles.badgeBox}>
                  <Text style={styles.badgeText}>{item.id}</Text>
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                </View>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Commercial & timeline terms Section */}
        <Text style={styles.sectionTitle}>Commercial & timeline terms</Text>
        <View style={styles.termsGrid}>
          <View style={styles.termsRow}>
            <View style={styles.termCard}>
              <Text style={styles.termLabel}>Project budget · {budgetCurrency}</Text>
              <Text style={styles.termValue}>{budgetFormatted}</Text>
            </View>
            <View style={styles.termCard}>
              <Text style={styles.termLabel}>Turnaround</Text>
              <Text style={styles.termValue}>{turnaroundFormatted}</Text>
            </View>
          </View>
          <View style={styles.termsRow}>
            <View style={styles.termCard}>
              <Text style={styles.termLabel}>Delivery date</Text>
              <Text style={styles.termValue}>{deliveryDateFormatted}</Text>
            </View>
            <View style={styles.termCard}>
              <Text style={styles.termLabel}>Revision limit</Text>
              <Text style={styles.termValue}>{revisionFormatted}</Text>
            </View>
          </View>
          <View style={styles.termCardFull}>
            <Text style={styles.termLabel}>Tax Treatment</Text>
            <Text style={styles.termValue}>{taxTreatmentFormatted}</Text>
          </View>
        </View>

        {/* Bottom CTA: Legal Contract */}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            styles.legalContractButton,
          ]}
          onPress={() => setContractModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="View Legal Contract"
        >
          <Text style={styles.primaryButtonText}>Legal Contract</Text>
        </Pressable>

        {/* Delete Project Action */}
        {onDeleteProject && (
          <Pressable
            style={({ pressed }) => [
              styles.deleteProjectOutlineBtn,
              pressed && styles.deleteProjectOutlineBtnPressed,
            ]}
            onPress={handleConfirmDeleteProject}
            accessibilityRole="button"
            accessibilityLabel={`Delete project ${currentProject.title}`}
          >
            <AppIcon name="trash" size={15} color={colors.errorText} />
            <Text style={styles.deleteProjectOutlineText}>Delete Project</Text>
          </Pressable>
        )}
      </ScrollView>

      <Modal visible={correctionOpen} transparent animationType="fade"
        onRequestClose={() => { if (!correcting) setCorrectionOpen(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalDialog, { maxHeight: '90%' }]}>
            <ScrollView>
              <Text style={styles.approvalModalTitle}>Correct conflicting exclusions</Text>
              <Text style={styles.approvalModalDesc}>
                These deliverables are already included. Remove their exclusions in Agreement v{(activeAgreement?.versionNumber ?? 0) + 1}:
              </Text>
              <Text style={styles.itemDescription}>{exclusionConflicts.join('\n')}</Text>
              <Text style={styles.approvalModalDesc}>
                Fees, timeline and deliverables stay the same. Earlier versions stay in history. Record client approval separately for the corrected version.
              </Text>
              {correctionError && <Text style={styles.itemDescription} accessibilityRole="alert">{correctionError}</Text>}
              <Pressable style={[styles.primaryButton, correcting && styles.buttonDisabled]}
                accessibilityRole="button" accessibilityLabel="Confirm exclusion correction"
                disabled={correcting} onPress={() => void confirmExclusionCorrection()}>
                <Text style={styles.primaryButtonText}>{correcting ? 'Saving correction...' : `Confirm correction as Agreement v${(activeAgreement?.versionNumber ?? 0) + 1}`}</Text>
              </Pressable>
              <Pressable style={styles.dialogCancelBtn} accessibilityRole="button"
                accessibilityLabel="Cancel exclusion correction" disabled={correcting}
                onPress={() => setCorrectionOpen(false)}>
                <Text style={styles.dialogCancelBtnText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Version History Picker Modal */}
      <Modal
        visible={versionPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setVersionPickerOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setVersionPickerOpen(false)}
        >
          <View style={styles.modalDialog}>
            <Text style={styles.modalHeading}>Agreement Version History</Text>
            {agreements.map((agmt, idx) => (
              <Pressable
                key={agmt.id}
                style={[
                  styles.modalItem,
                  agmt.id === activeAgreement?.id && styles.modalItemActive,
                ]}
                onPress={() => {
                  onSelectAgreementVersion(agmt);
                  setVersionPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemTitle,
                    agmt.id === activeAgreement?.id &&
                      styles.modalItemTitleActive,
                  ]}
                >
                  v{agmt.versionNumber} · {agmt.title}
                </Text>
                <Text style={styles.modalItemSub}>
                  {idx === 0 ? 'Current baseline' : 'Historical baseline'} ·
                  Confirmed {new Date(agmt.confirmedAt).toLocaleDateString()}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Legal Contract Modal */}
      <Modal
        visible={contractModalOpen}
        animationType="slide"
        onRequestClose={() => setContractModalOpen(false)}
        statusBarTranslucent
      >
        <View
          style={[
            styles.contractModalContainer,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <HeaderBar
            title="Legal Contract"
            subtitle={`${currentProject.title} · v${activeAgreement?.versionNumber || 1}`}
            showBack
            onBack={() => setContractModalOpen(false)}
          />

          <ScrollView
            contentContainerStyle={styles.contractModalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.contractNotice}>
              Auto-generated contract enforceable under Philippine commercial law,
              Ease of Paying Taxes Act (RA 11976), BIR Form 2307 withholding rules,
              and RA 8293 IP Code.
            </Text>

            <View style={styles.pillContainer}>
              <View style={styles.legalPill}>
                <Text style={styles.legalPillText}>EOPT RA 11976</Text>
              </View>
              <View style={styles.legalPill}>
                <Text style={styles.legalPillText}>BIR Form 2307</Text>
              </View>
              <View style={styles.legalPill}>
                <Text style={styles.legalPillText}>RA 8293 IP Code</Text>
              </View>
              <View style={styles.legalPill}>
                <Text style={styles.legalPillText}>RA 10173 Privacy</Text>
              </View>
            </View>

            <View style={styles.contractModalActionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.shareButton,
                  styles.pdfModalButton,
                  pressed && styles.shareButtonPressed,
                ]}
                onPress={handleShareContractPdf}
                disabled={isExportingPdf}
                accessibilityRole="button"
                accessibilityLabel="Share contract PDF"
              >
                <AppIcon name="document" size={16} color={colors.onPrimary} />
                <Text style={styles.shareButtonText}>
                  {isExportingPdf ? 'Generating PDF...' : 'Share Contract PDF'}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.textModalButton,
                  pressed && styles.textModalButtonPressed,
                ]}
                onPress={handleShareContract}
                accessibilityRole="button"
                accessibilityLabel="Share contract as text"
              >
                <AppIcon name="share" size={15} color={colors.primary} />
                <Text style={styles.textModalButtonText}>Share Text</Text>
              </Pressable>
            </View>

            {shareFeedback ? (
              <Text style={styles.shareFeedback}>{shareFeedback}</Text>
            ) : null}

            <View style={styles.contractPreviewCard}>
              <View style={styles.previewHeader}>
                <View style={styles.previewHeaderLeft}>
                  <Text style={styles.previewEyebrow}>KASUNDUAN VAULT · BASELINE</Text>
                  <Text style={styles.previewDocTitle}>Freelance Service Agreement</Text>
                  <Text style={styles.previewProjectName}>{currentProject.title}</Text>
                </View>
                <View style={styles.previewVersionBadge}>
                  <Text style={styles.previewVersionText}>
                    v{activeAgreement?.versionNumber || 1}.0 Confirmed
                  </Text>
                </View>
              </View>

              <View style={styles.previewDivider} />

              {/* Parties */}
              <View style={styles.previewPartiesRow}>
                <View style={styles.previewPartyCol}>
                  <Text style={styles.previewSectionMini}>CLIENT</Text>
                  <Text style={styles.previewPartyName}>{currentProject.clientName || 'Client'}</Text>
                  <Text style={styles.previewPartySub}>Principal</Text>
                </View>
                <View style={styles.previewPartyCol}>
                  <Text style={styles.previewSectionMini}>FREELANCER</Text>
                  <Text style={styles.previewPartyName}>{freelancerName || 'Independent Developer'}</Text>
                  <Text style={styles.previewPartySub}>{freelancerRole || 'Contractor'}</Text>
                </View>
              </View>

              <View style={styles.previewDivider} />

              {/* Agreed Commercial Terms */}
              <Text style={styles.previewSectionMini}>AGREED COMMERCIAL TERMS</Text>
              <View style={styles.previewTermsGrid}>
                <View style={styles.previewTermItem}>
                  <Text style={styles.previewTermLabel}>Total Compensation</Text>
                  <Text style={styles.previewTermValue}>{budgetFormatted} {budgetCurrency}</Text>
                </View>
                <View style={styles.previewTermItem}>
                  <Text style={styles.previewTermLabel}>Timeline</Text>
                  <Text style={styles.previewTermValue}>{turnaroundFormatted}</Text>
                </View>
                <View style={styles.previewTermItem}>
                  <Text style={styles.previewTermLabel}>Payment Method</Text>
                  <Text style={styles.previewTermValue}>Bank Transfer / GCash / Maya</Text>
                </View>
                <View style={styles.previewTermItem}>
                  <Text style={styles.previewTermLabel}>Revisions Included</Text>
                  <Text style={styles.previewTermValue}>{revisionFormatted}</Text>
                </View>
              </View>

              {/* Tax Compliance Callout */}
              <View style={styles.previewTaxBox}>
                <Text style={styles.previewTaxTitle}>EOPT Act (RA 11976) &amp; BIR Tax Compliance</Text>
                <Text style={styles.previewTaxText}>
                  {taxTreatmentFormatted}. Official BIR invoice issued upon milestone settlement.
                </Text>
              </View>

              <View style={styles.previewDivider} />

              {/* Confirmed Deliverables */}
              <Text style={styles.previewSectionMini}>
                CONFIRMED DELIVERABLES ({displayDeliverables.length})
              </Text>
              <View style={styles.previewDeliverablesList}>
                {displayDeliverables.map((item) => (
                  <View key={item.id} style={styles.previewDeliverableRow}>
                    <View style={styles.previewReqBadge}>
                      <Text style={styles.previewReqBadgeText}>{item.id}</Text>
                    </View>
                    <View style={styles.previewDelivContent}>
                      <Text style={styles.previewDelivTitle}>{item.title}</Text>
                      {item.description ? (
                        <Text style={styles.previewDelivDesc} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>

              {/* ScopeGuard Exclusions */}
              {displayExclusions.length > 0 ? (
                <>
                  <View style={styles.previewDivider} />
                  <Text style={styles.previewSectionMini}>SCOPEGUARD™ EXCLUSIONS</Text>
                  <View style={styles.previewExclusionsList}>
                    {displayExclusions.map((exc) => (
                      <View key={exc.id} style={styles.previewExclusionRow}>
                        <Text style={styles.previewBullet}>•</Text>
                        <Text style={styles.previewExclusionText}>{exc.title}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <View style={styles.previewDivider} />

              {/* Statutory Legal Protections */}
              <Text style={styles.previewSectionMini}>STATUTORY LEGAL PROTECTIONS</Text>
              <View style={styles.previewStatutoryBox}>
                <Text style={styles.previewStatutoryText}>
                  • <Text style={styles.previewBold}>RA 8293 IP Code:</Text> Deliverable copyrights transfer to Client solely upon 100% full payment settlement.
                </Text>
                <Text style={styles.previewStatutoryText}>
                  • <Text style={styles.previewBold}>ScopeGuard™ Protocol:</Text> Any out-of-scope requests require a mutually signed Change Order prior to work.
                </Text>
                <Text style={styles.previewStatutoryText}>
                  • <Text style={styles.previewBold}>RA 10173 Data Privacy:</Text> Proprietary data, source assets, and communications strictly protected.
                </Text>
              </View>

              {/* Signatures Status */}
              <View style={styles.previewSignaturesBox}>
                <View style={styles.previewSigCol}>
                  <Text style={styles.previewSigLabel}>FREELANCER</Text>
                  <Text style={styles.previewSigStatus}>Confirmed by {freelancerName || 'Freelancer'}</Text>
                </View>
                <View style={styles.previewSigCol}>
                  <Text style={styles.previewSigLabel}>CLIENT</Text>
                  {activeAgreement?.clientApprovedAt ? (
                    <Text style={styles.previewSigStatus}>
                      ✓ Approved by {activeAgreement.clientSignatoryName || currentProject.clientName || 'Client'}
                    </Text>
                  ) : (
                    <View style={styles.pendingSigCol}>
                      <Text style={styles.previewSigStatusPending}>
                        Pending Signature
                      </Text>
                      {onRecordClientApproval && (
                        <Pressable
                          style={styles.recordSigSmallBtn}
                          onPress={() => {
                            setContractModalOpen(false);
                            setStandaloneSignatory(
                              currentProject.clientName || 'Client',
                            );
                            setStandaloneNotes('Signed in person / PDF copy');
                            setClientApprovalModalOpen(true);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Record client signature"
                        >
                          <Text style={styles.recordSigSmallBtnText}>
                            Record Signature
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Document ID footer note */}
              <Text style={styles.previewDocRef}>
                Ref: {activeAgreement?.id || currentProject.id} · Offline Vault Sealed Baseline
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Standalone Client Approval Modal */}
      <Modal
        visible={clientApprovalModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setClientApprovalModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setClientApprovalModalOpen(false)}
        >
          <Pressable
            style={styles.approvalDialog}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.approvalModalHeader}>
              <View>
                <Text style={styles.approvalEyebrow}>KASUNDUAN VAULT · SIGNATURE</Text>
                <Text style={styles.approvalModalTitle}>Record Client Approval</Text>
              </View>
              <Pressable
                onPress={() => setClientApprovalModalOpen(false)}
                hitSlop={8}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.approvalModalDesc}>
              Did your client approve Agreement v{activeAgreement?.versionNumber || 1}? Record it here to verify client sign-off offline.
            </Text>

            <View style={styles.inputFieldGroup}>
              <Text style={styles.inputFieldLabel}>Client Signatory Name</Text>
              <TextInput
                style={styles.textInputBox}
                value={standaloneSignatory}
                onChangeText={setStandaloneSignatory}
                placeholder="e.g. Maria Santos / Company Name"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.inputFieldGroup}>
              <Text style={styles.inputFieldLabel}>Approval Method / Notes</Text>
              <TextInput
                style={styles.textInputBox}
                value={standaloneNotes}
                onChangeText={setStandaloneNotes}
                placeholder="e.g. Signed contract PDF / Verbal confirmation / Viber chat"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.dialogActionRow}>
              <Pressable
                style={styles.dialogCancelBtn}
                onPress={() => setClientApprovalModalOpen(false)}
              >
                <Text style={styles.dialogCancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.dialogConfirmBtn}
                onPress={handleRecordStandaloneClientApproval}
              >
                <AppIcon name="check" size={15} color="#FFFFFF" />
                <Text style={styles.dialogConfirmBtnText}>Record Approval</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Accept Scope Change Modal */}
      <Modal
        visible={acceptModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAcceptModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.acceptModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.approvalModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.approvalEyebrow}>SCOPE CHANGE APPROVAL</Text>
                <Text style={styles.approvalModalTitle}>
                  Accept Scope Change
                </Text>
                <Text style={styles.acceptModalSub}>
                  Agreed with client offline? Confirm additions to seal Agreement v{((activeAgreement?.versionNumber || 1) + 1)}.
                </Text>
              </View>
              <Pressable
                onPress={() => setAcceptModalOpen(false)}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.acceptModalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Client request text quote */}
              {targetRequest && (
                <View style={styles.acceptQuoteBox}>
                  <Text style={styles.acceptQuoteLabel}>Client&apos;s request:</Text>
                  <Text style={styles.acceptQuoteText}>
                    &ldquo;{targetRequest.rawText}&rdquo;
                  </Text>
                </View>
              )}

              {/* Deliverables to add */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>
                  Deliverables to Add to Baseline
                </Text>
                <View style={styles.additionsChecklist}>
                  {selectedAdditions.map((item, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.additionCheckRow}
                      onPress={() => handleToggleAddition(item)}
                    >
                      <View style={styles.checkboxBoxChecked}>
                        <AppIcon name="check" size={12} color="#FFFFFF" />
                      </View>
                      <Text style={styles.additionCheckText}>{item}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Add custom deliverable item */}
                <View style={styles.customAddRow}>
                  <TextInput
                    style={styles.customAddInput}
                    value={customAdditionText}
                    onChangeText={setCustomAdditionText}
                    placeholder="Add deliverable name..."
                    placeholderTextColor={colors.placeholder}
                    onSubmitEditing={handleAddCustomAddition}
                  />
                  <Pressable
                    style={styles.customAddBtn}
                    onPress={handleAddCustomAddition}
                  >
                    <Text style={styles.customAddBtnText}>+ Add</Text>
                  </Pressable>
                </View>
              </View>

              {/* Commercial Adjustments */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Commercial Adjustments</Text>
                <View style={styles.adjustmentsRow}>
                  <View style={styles.adjCol}>
                    <Text style={styles.adjLabel}>Additional Fee (₱)</Text>
                    <TextInput
                      style={styles.adjInput}
                      value={extraFee}
                      onChangeText={setExtraFee}
                      keyboardType="numeric"
                      placeholder="e.g. 7000"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>

                  <View style={styles.adjCol}>
                    <Text style={styles.adjLabel}>Extra Working Days</Text>
                    <TextInput
                      style={styles.adjInput}
                      value={extraDays}
                      onChangeText={setExtraDays}
                      keyboardType="numeric"
                      placeholder="e.g. 5"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>
              </View>

              {/* Optional Client Approval / Signature */}
              <View style={styles.modalSection}>
                <Pressable
                  style={styles.toggleApprovalRow}
                  onPress={() =>
                    setRecordClientApprovalCheckbox(!recordClientApprovalCheckbox)
                  }
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      recordClientApprovalCheckbox && styles.checkboxBoxChecked,
                    ]}
                  >
                    {recordClientApprovalCheckbox ? (
                      <AppIcon name="check" size={12} color="#FFFFFF" />
                    ) : null}
                  </View>
                  <Text style={styles.toggleApprovalText}>
                    Record client approval &amp; signature for this agreement
                  </Text>
                </Pressable>

                {recordClientApprovalCheckbox && (
                  <View style={styles.approvalFieldsBox}>
                    <View style={styles.inputFieldGroup}>
                      <Text style={styles.inputFieldLabel}>
                        Client Signatory Name
                      </Text>
                      <TextInput
                        style={styles.textInputBox}
                        value={signatoryName}
                        onChangeText={setSignatoryName}
                        placeholder="Client signatory name"
                        placeholderTextColor={colors.placeholder}
                      />
                    </View>

                    <View style={styles.inputFieldGroup}>
                      <Text style={styles.inputFieldLabel}>
                        Approval Method / Notes
                      </Text>
                      <TextInput
                        style={styles.textInputBox}
                        value={approvalNotes}
                        onChangeText={setApprovalNotes}
                        placeholder="e.g. Agreed via WhatsApp / Signed copy"
                        placeholderTextColor={colors.placeholder}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Legal Notice */}
              <View style={styles.modalLegalNotice}>
                <AppIcon name="shield" size={14} color="#1E40AF" />
                <Text style={styles.modalLegalNoticeText}>
                  Creates Agreement v{((activeAgreement?.versionNumber || 1) + 1)} in your local SQLite vault enforceable under Philippine commercial law.
                </Text>
              </View>

              <View style={styles.acceptActionsCol}>
                <Pressable
                  style={({ pressed }) => [
                    styles.acceptConfirmBtn,
                    pressed && styles.acceptConfirmBtnPressed,
                    isSubmittingAccept && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirmAcceptRequest}
                  disabled={isSubmittingAccept}
                >
                  <AppIcon name="check" size={16} color="#FFFFFF" />
                  <Text style={styles.acceptConfirmBtnText}>
                    {isSubmittingAccept
                      ? 'Sealing agreement...'
                      : `Confirm & Seal Agreement v${((activeAgreement?.versionNumber || 1) + 1)}`}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.acceptCancelBtn}
                  onPress={() => setAcceptModalOpen(false)}
                  disabled={isSubmittingAccept}
                >
                  <Text style={styles.acceptCancelBtnText}>Cancel</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </View>
      </Modal>
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
  headingSection: {
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textPrimary,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  subhead: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  draftActionsCol: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  releaseButton: {
    marginBottom: 0,
    backgroundColor: '#1E40AF',
  },
  editDraftButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.subtle,
  },
  editDraftButtonPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  editDraftButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  draftNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  draftNoticeText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
  },
  legalContractButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  confirmedCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  projectSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusConfirmed: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusDraftingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  clientConfirmed: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  checklist: {
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  checkTextSecondary: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  historyLabel: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  versionPickerButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    ...shadows.subtle,
  },
  versionPickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  badgeBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  itemContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 3,
  },
  itemDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  termsGrid: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  termsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  termCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    padding: spacing.md + 2,
    ...shadows.card,
  },
  termCardFull: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    padding: spacing.md + 2,
    ...shadows.card,
  },
  termLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  termValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalDialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    gap: spacing.md,
    ...shadows.modal,
  },
  modalHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemActive: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
  },
  modalItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalItemTitleActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  modalItemSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contractModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contractModalScrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  contractNotice: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  legalPill: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  legalPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  contractModalActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pdfModalButton: {
    flex: 1.5,
  },
  textModalButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  textModalButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  textModalButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  shareButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  shareFeedback: {
    fontSize: 12,
    color: colors.successText,
    textAlign: 'center',
  },
  contractPreviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  previewHeaderLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  previewEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  previewDocTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.3,
  },
  previewProjectName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  previewVersionBadge: {
    backgroundColor: colors.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  previewVersionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  previewDivider: {
    height: 1,
    backgroundColor: colors.cardDivider,
    marginVertical: 2,
  },
  previewPartiesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewPartyCol: {
    flex: 1,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  previewSectionMini: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  previewPartyName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewPartySub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  previewTermsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewTermItem: {
    width: '48%',
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  previewTermLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewTermValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  previewTaxBox: {
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: 2,
  },
  previewTaxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewTaxText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  previewDeliverablesList: {
    gap: spacing.sm,
  },
  previewDeliverableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  previewReqBadge: {
    backgroundColor: colors.badgeBg,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  previewReqBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  previewDelivContent: {
    flex: 1,
  },
  previewDelivTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewDelivDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  previewExclusionsList: {
    gap: 4,
  },
  previewExclusionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  previewBullet: {
    fontSize: 12,
    color: colors.warningText,
    fontWeight: '700',
  },
  previewExclusionText: {
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
  },
  previewStatutoryBox: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 4,
  },
  previewStatutoryText: {
    fontSize: 10.5,
    color: colors.textSecondary,
    lineHeight: 15,
  },
  previewBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewSignaturesBox: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  previewSigCol: {
    flex: 1,
  },
  previewSigLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
  previewSigStatus: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
    marginTop: 2,
  },
  previewSigStatusPending: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warningText,
    marginTop: 2,
  },
  previewDocRef: {
    fontSize: 9.5,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Client Requests Section
  requestsSection: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  requestsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  requestsHeaderTitleCol: {
    flex: 1,
  },
  requestsSectionSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addRequestSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  addRequestSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyRequestsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.subtle,
  },
  emptyRequestsTextCol: {
    flex: 1,
  },
  emptyRequestsTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyRequestsDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyAddBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  emptyAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  requestsList: {
    gap: spacing.sm,
  },
  requestCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    padding: spacing.md + 2,
    gap: spacing.xs + 2,
    ...shadows.subtle,
  },
  requestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestDate: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  requestStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  requestStatusBadgeAccepted: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  requestStatusBadgePending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  requestStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requestStatusTextAccepted: {
    color: '#15803D',
  },
  requestStatusTextPending: {
    color: '#B45309',
  },
  requestQuoteBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  requestQuoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  findingsPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  additionPill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radii.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  additionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  includedPill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radii.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  includedPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  requestActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  acceptRequestBtn: {
    backgroundColor: '#15803D',
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  acceptRequestBtnPressed: {
    backgroundColor: '#166534',
  },
  acceptRequestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reviewRequestBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reviewRequestBtnPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  reviewRequestBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  deleteRequestBtn: {
    padding: 6,
    marginLeft: 'auto',
  },
  acceptedNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  acceptedNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803D',
  },
  checkApprovalRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordBadgeBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  recordBadgeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  pendingSigCol: {
    gap: 4,
  },
  recordSigSmallBtn: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  recordSigSmallBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  // Standalone Approval Dialog
  approvalDialog: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 380,
    gap: spacing.md,
    ...shadows.modal,
  },
  approvalModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  approvalEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  approvalModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 2,
  },
  modalCloseIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
    padding: 4,
  },
  approvalModalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  inputFieldGroup: {
    gap: 4,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  textInputBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  dialogActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  dialogCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dialogConfirmBtn: {
    backgroundColor: '#15803D',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dialogConfirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Accept Scope Change Modal
  acceptModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    ...shadows.modal,
  },
  acceptModalSub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  acceptModalScroll: {
    marginVertical: spacing.sm,
  },
  acceptQuoteBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    marginBottom: spacing.md,
  },
  acceptQuoteLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  acceptQuoteText: {
    fontSize: 12.5,
    fontStyle: 'italic',
    color: colors.textPrimary,
    lineHeight: 17,
  },
  modalSection: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  additionsChecklist: {
    gap: 6,
  },
  additionCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#15803D',
    borderColor: '#15803D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionCheckText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  customAddRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  customAddInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12.5,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  customAddBtn: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  customAddBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  adjustmentsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adjCol: {
    flex: 1,
    gap: 2,
  },
  adjLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  adjInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  toggleApprovalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  toggleApprovalText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  approvalFieldsBox: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: spacing.xs,
    marginTop: 4,
  },
  modalLegalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  modalLegalNoticeText: {
    fontSize: 11,
    color: '#1E40AF',
    flex: 1,
    lineHeight: 15,
  },
  acceptActionsCol: {
    gap: 6,
  },
  acceptConfirmBtn: {
    backgroundColor: '#15803D',
    borderRadius: radii.button,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptConfirmBtnPressed: {
    backgroundColor: '#166534',
  },
  acceptConfirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  acceptCancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  acceptCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deleteProjectOutlineBtn: {
    borderWidth: 1,
    borderColor: colors.errorBorder || '#FCA5A5',
    backgroundColor: colors.surface,
    borderRadius: radii.button,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: -spacing.sm,
    marginBottom: spacing.xl,
  },
  deleteProjectOutlineBtnPressed: {
    backgroundColor: '#FEF2F2',
  },
  deleteProjectOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.errorText,
  },
});
