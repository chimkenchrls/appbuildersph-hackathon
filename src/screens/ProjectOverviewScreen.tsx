import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import { ContractGeneratorService } from '@/services/contractGeneratorService';
import { ShareService } from '@/services/shareService';
import { hapticSuccess, hapticImpactLight } from '@/utils/haptics';
import type { Project, Agreement, ScopeDraft } from '@/types/domain';

interface ProjectOverviewScreenProps {
  currentProject: Project;
  allProjects: Project[];
  agreements: Agreement[];
  selectedAgreement: Agreement | null;
  onSelectProject: (projectId: string) => void;
  onSelectAgreementVersion: (agreement: Agreement) => void;
  onNavigateToNewRequest: () => void;
  onBack: () => void;
  onReleaseScope?: () => void;
  onEditScopeDraft?: () => void;
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
  onSelectAgreementVersion,
  onNavigateToNewRequest,
  onBack,
  onReleaseScope,
  onEditScopeDraft,
}: ProjectOverviewScreenProps) {
  const insets = useSafeAreaInsets();
  const [versionPickerOpen, setVersionPickerOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isDrafting = agreements.length === 0;

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

  const contractText = activeAgreement
    ? ContractGeneratorService.generateContractText(activeAgreement, {
        freelancerName: 'Independent Developer',
        clientName: currentProject.clientName || 'Client',
        paymentMethod: 'Bank Transfer / GCash / Maya',
      })
    : '';

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleShareContractPdf = async () => {
    if (!activeAgreement) return;
    await hapticImpactLight();
    setIsExportingPdf(true);
    try {
      const shared = await ShareService.shareContractPdf(activeAgreement, {
        freelancerName: 'Independent Developer',
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
        freelancerName: 'Independent Developer',
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
    const rawExclusions: string[] =
      activeAgreement?.exclusions?.length
        ? activeAgreement.exclusions
        : draftScope?.exclusions?.length
          ? draftScope.exclusions
          : [];

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
          /* Primary CTA: Review a new request */
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={onNavigateToNewRequest}
            accessibilityRole="button"
            accessibilityLabel="Review a new request"
          >
            <Text style={styles.primaryButtonText}>Review a new request</Text>
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
              <ClientPendingIcon size={18} />
              <Text style={styles.checkTextSecondary}>
                {isDrafting
                  ? 'Baseline release: Pending release'
                  : 'Client Approval: not recorded'}
              </Text>
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
      </ScrollView>

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

            <View style={styles.contractCodeBox}>
              <Text style={styles.contractCodeText}>{contractText}</Text>
            </View>
          </ScrollView>
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
  contractCodeBox: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  contractCodeText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: colors.textPrimary,
    lineHeight: 16,
  },
});
