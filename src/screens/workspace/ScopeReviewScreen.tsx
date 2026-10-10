import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import { HeaderBar } from '@/components/workspace/HeaderBar';
import { colors, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/workspace/Icon';
import { hapticWarning, hapticSuccess, hapticImpactLight } from '@/utils/haptics';
import type { Project, Agreement, ScopeGuardAnalysis, Finding } from '@/types/domain';

interface ScopeReviewScreenProps {
  project: Project;
  agreement?: Agreement | null;
  analysis: ScopeGuardAnalysis;
  onBack: () => void;
  onProceedToProposal: () => void;
}

interface EvidenceModalState {
  visible: boolean;
  groupTitle: string;
  citedIds: string[];
}

export function ScopeReviewScreen({
  project,
  agreement,
  analysis,
  onBack,
  onProceedToProposal,
}: ScopeReviewScreenProps) {
  const [evidenceModal, setEvidenceModal] = useState<EvidenceModalState>({
    visible: false,
    groupTitle: '',
    citedIds: [],
  });

  const potentialAdditions = analysis.findings.filter(
    (f) => f.classification === 'potential_additional',
  );

  useEffect(() => {
    if (potentialAdditions.length > 0) {
      hapticWarning();
    } else {
      hapticSuccess();
    }
  }, [potentialAdditions.length]);
  const includedItems = analysis.findings.filter(
    (f) => f.classification === 'included',
  );
  const needsClarification = analysis.findings.filter(
    (f) => f.classification === 'needs_clarification',
  );

  const agreementVersionLabel = agreement?.versionNumber
    ? `Agreement v${agreement.versionNumber}`
    : 'Agreement unavailable';

  const formatEvidenceIds = (
    findings: Finding[],
  ): string[] => {
    const ids = Array.from(
      new Set(findings.flatMap((f) => f.evidenceRequirementIds || [])),
    ).filter(Boolean);
    return ids;
  };

  const handleOpenEvidence = (groupTitle: string, citedIds: string[]) => {
    setEvidenceModal({
      visible: true,
      groupTitle,
      citedIds,
    });
  };

  const potentialEvidenceIds = formatEvidenceIds(potentialAdditions);
  const includedEvidenceIds = formatEvidenceIds(includedItems);
  const clarificationEvidenceIds = formatEvidenceIds(needsClarification);

  const formatItemTitle = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('"') || trimmed.startsWith('“')) {
      const stripped = trimmed.replace(/^["'“]|["'”]$/g, '');
      return `“${stripped}”`;
    }
    return trimmed;
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
      >
        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>SCOPEGUARD</Text>
          <Text style={styles.headline}>Review the request</Text>
          <Text style={styles.subhead}>
            Compared with {agreementVersionLabel}. You decide what belongs in scope.
          </Text>

          {/* AI suggestions Badge */}
          <View style={styles.aiBadge}>
            <AppIcon name="sparkles" size={14} color={colors.badgeText} />
            <Text style={styles.aiText}>AI suggestions · Review required</Text>
          </View>
        </View>

        {/* Group 1: Potential additions */}
        {potentialAdditions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <AppIcon name="plus" size={16} color={colors.textPrimary} />
                <Text style={styles.cardHeaderTitle}>Potential additions</Text>
              </View>
              <Text style={styles.cardHeaderCount}>
                {potentialAdditions.length} item{potentialAdditions.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.cardBody}>
              {potentialAdditions.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.itemBlock,
                    index > 0 && styles.itemSpacing,
                  ]}
                >
                  <Text style={styles.itemTitle}>{item.item}</Text>
                  <Text style={styles.itemDescription}>{item.explanation}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <Pressable
                style={({ pressed }) => [
                  styles.evidenceRow,
                  pressed && styles.evidenceRowPressed,
                ]}
                onPress={() =>
                  handleOpenEvidence('Potential additions', potentialEvidenceIds)
                }
                accessibilityRole="button"
                accessibilityLabel={`View scope evidence: ${potentialEvidenceIds.join(', ')}`}
              >
                <AppIcon name="play" size={10} color={colors.primary} />
                <Text style={styles.evidenceText}>
                  View scope evidence · {potentialEvidenceIds.join(', ')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Group 2: Included */}
        {includedItems.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <AppIcon name="check" size={16} color={colors.textPrimary} />
                <Text style={styles.cardHeaderTitle}>Included</Text>
              </View>
              <Text style={styles.cardHeaderCount}>
                {includedItems.length} item{includedItems.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.cardBody}>
              {includedItems.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.itemBlock,
                    index > 0 && styles.itemSpacing,
                  ]}
                >
                  <Text style={styles.itemTitle}>{item.item}</Text>
                  <Text style={styles.itemDescription}>{item.explanation}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <Pressable
                style={({ pressed }) => [
                  styles.evidenceRow,
                  pressed && styles.evidenceRowPressed,
                ]}
                onPress={() =>
                  handleOpenEvidence('Included items', includedEvidenceIds)
                }
                accessibilityRole="button"
                accessibilityLabel={`View scope evidence: ${includedEvidenceIds.join(', ')}`}
              >
                <AppIcon name="play" size={10} color={colors.primary} />
                <Text style={styles.evidenceText}>
                  View scope evidence · {includedEvidenceIds.join(', ')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Group 3: Needs clarification */}
        {needsClarification.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <AppIcon name="help-circle" size={16} color={colors.textPrimary} />
                <Text style={styles.cardHeaderTitle}>Needs clarification</Text>
              </View>
              <Text style={styles.cardHeaderCount}>
                {needsClarification.length} item{needsClarification.length === 1 ? '' : 's'}
              </Text>
            </View>

            <View style={styles.cardBody}>
              {needsClarification.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.itemBlock,
                    index > 0 && styles.itemSpacing,
                  ]}
                >
                  <Text style={styles.itemTitle}>{formatItemTitle(item.item)}</Text>
                  <Text style={styles.itemDescription}>{item.explanation}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <Pressable
                style={({ pressed }) => [
                  styles.evidenceRow,
                  pressed && styles.evidenceRowPressed,
                ]}
                onPress={() =>
                  handleOpenEvidence('Needs clarification', clarificationEvidenceIds)
                }
                accessibilityRole="button"
                accessibilityLabel={`View scope evidence: ${clarificationEvidenceIds.join(', ')}`}
              >
                <AppIcon name="play" size={10} color={colors.primary} />
                <Text style={styles.evidenceText}>
                  View scope evidence · {clarificationEvidenceIds.join(', ')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Bottom Button */}
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionButtonPressed,
          ]}
          onPress={async () => {
            await hapticImpactLight();
            onProceedToProposal();
          }}
          accessibilityRole="button"
          accessibilityLabel="Prepare change proposal"
        >
          <Text style={styles.actionButtonText}>
            Prepare change proposal →
          </Text>
        </Pressable>

        {/* Footnote Disclaimers */}
        <View style={styles.footerNoteContainer}>
          <Text style={styles.footerNoteText}>
            A potential addition is a review prompt.
          </Text>
          <Text style={styles.footerNoteText}>
            It does not establish a contract breach.
          </Text>
        </View>
      </ScrollView>

      {/* Scope Evidence Modal */}
      <Modal
        visible={evidenceModal.visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() =>
          setEvidenceModal((prev) => ({ ...prev, visible: false }))
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>SCOPE EVIDENCE</Text>
                <Text style={styles.modalTitle}>
                  {evidenceModal.groupTitle}
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() =>
                  setEvidenceModal((prev) => ({ ...prev, visible: false }))
                }
                accessibilityRole="button"
                accessibilityLabel="Close evidence modal"
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScrollView}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.modalSectionHeading}>
                Referenced in {agreementVersionLabel}:
              </Text>

              {evidenceModal.citedIds.map((id) => {
                const req = agreement?.requirements.find((r) => r.id === id);
                return (
                  <View key={id} style={styles.evidenceClauseCard}>
                    <View style={styles.evidenceClauseHeader}>
                      <View style={styles.reqIdPill}>
                        <Text style={styles.reqIdPillText}>{id}</Text>
                      </View>
                      <Text style={styles.reqClauseTitle} numberOfLines={2}>
                        {req?.title || 'Unavailable clause'}
                      </Text>
                    </View>
                    <Text style={styles.reqClauseDesc}>
                      {req?.description ||
                        'No description recorded.'}
                    </Text>
                  </View>
                );
              })}

              {agreement?.exclusions && agreement.exclusions.length > 0 ? (
                <View style={styles.exclusionContainer}>
                  <Text style={styles.exclusionHeader}>
                    Confirmed Exclusions in Baseline:
                  </Text>
                  {agreement.exclusions.map((ex, idx) => (
                    <View key={idx} style={styles.exclusionItemRow}>
                      <Text style={styles.exclusionBullet}>•</Text>
                      <Text style={styles.exclusionText}>{ex}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            <Pressable
              style={styles.modalActionButton}
              onPress={() =>
                setEvidenceModal((prev) => ({ ...prev, visible: false }))
              }
              accessibilityRole="button"
              accessibilityLabel="Dismiss evidence view"
            >
              <Text style={styles.modalActionButtonText}>Close evidence</Text>
            </Pressable>
          </View>
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
    paddingBottom: spacing.xxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  headerSection: {
    marginBottom: spacing.lg,
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
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.badgeBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9999,
    gap: 6,
  },
  aiText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.badgeText,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  cardHeader: {
    backgroundColor: colors.cardHeaderBg,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardHeaderCount: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textMuted,
  },
  cardBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  itemBlock: {
    gap: 4,
  },
  itemSpacing: {
    marginTop: spacing.md,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  itemDescription: {
    fontSize: 13.5,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardDivider,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  evidenceRowPressed: {
    opacity: 0.7,
  },
  evidenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  actionButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  actionButtonText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: -0.1,
  },
  footerNoteContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: 2,
  },
  footerNoteText: {
    fontSize: 12.5,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    padding: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardDivider,
    paddingBottom: spacing.sm,
  },
  modalEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '600',
  },
  modalScrollView: {
    marginVertical: spacing.sm,
  },
  modalSectionHeading: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  evidenceClauseCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  evidenceClauseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  reqIdPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reqIdPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  reqClauseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  reqClauseDesc: {
    fontSize: 12.5,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  exclusionContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
  },
  exclusionHeader: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: spacing.xs,
  },
  exclusionItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  exclusionBullet: {
    fontSize: 12,
    color: '#92400E',
  },
  exclusionText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 16,
  },
  modalActionButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
