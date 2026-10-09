import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { CardWatermarkSvg } from '@/components/CardWatermarkSvg';
import type { Project, Agreement } from '@/types/domain';

interface AgreementsScreenProps {
  projects: Project[];
  projectAgreements: Record<string, Agreement[]>;
  onSelectProjectAgreement: (projectId: string, agreement: Agreement) => void;
  onNewProject: () => void;
}

export function AgreementsScreen({
  projects,
  projectAgreements,
  onSelectProjectAgreement,
  onNewProject,
}: AgreementsScreenProps) {
  // Aggregate all agreements across all projects
  const allAgreementsWithProject: { project: Project; agreement: Agreement }[] = [];

  for (const project of projects) {
    const agmts = projectAgreements[project.id] || [];
    for (const agmt of agmts) {
      allAgreementsWithProject.push({ project, agreement: agmt });
    }
  }

  // Sort by confirmed date descending
  allAgreementsWithProject.sort(
    (a, b) =>
      new Date(b.agreement.confirmedAt).getTime() -
      new Date(a.agreement.confirmedAt).getTime(),
  );

  return (
    <View style={styles.container}>
      <HeaderBar
        title="OwlSet"
        subtitle="Your Private Workspace"
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>KASUNDUAN VAULT</Text>
          <Text style={styles.headline}>Confirmed Agreements</Text>
          <Text style={styles.subhead}>
            Immutable baselines protected by local SQLite and Philippine commercial law.
          </Text>
        </View>

        {/* Agreements List */}
        <View style={styles.list}>
          {allAgreementsWithProject.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>No sealed agreements</Text>
                <Text style={styles.cardStatus}>0 records</Text>
              </View>
              <Text style={styles.cardClient}>Create a project to seal an agreement</Text>
              <View style={styles.cardSpacer} />
              <View style={styles.cardDivider} />
              <View style={styles.cardFooter}>
                <View style={styles.agreementIdBadge}>
                  <Text style={styles.agreementIdText}>Vault Empty</Text>
                </View>
                <Pressable onPress={onNewProject} style={styles.actionContainer}>
                  <Text style={styles.viewOverviewAction}>+ New Project &gt;</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            allAgreementsWithProject.map(({ project, agreement }) => {
              const agreementIdFormatted = agreement.id
                .toUpperCase()
                .replace('AGMT_', 'AGMT-');

              return (
                <Pressable
                  key={agreement.id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => onSelectProjectAgreement(project.id, agreement)}
                  accessibilityRole="button"
                  accessibilityLabel={`View agreement for ${project.title}`}
                >
                  <CardWatermarkSvg opacity={0.09} position="top-right" />
                  {/* Top row */}
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {project.title}
                    </Text>
                    <View style={styles.versionBadge}>
                      <Text style={styles.versionBadgeText}>
                        v{agreement.versionNumber} Confirmed
                      </Text>
                    </View>
                  </View>

                  {/* Second row: Client */}
                  <Text style={styles.cardClient} numberOfLines={2}>
                    Client · {project.clientName || 'Direct'}
                  </Text>

                  {/* Meta Details */}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      ₱{agreement.budgetAmount?.toLocaleString() || '0'} {agreement.budgetCurrency}
                    </Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{agreement.durationDays || 14} days</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>
                      {agreement.requirements.length} deliverables
                    </Text>
                  </View>

                  {/* Spacer */}
                  <View style={styles.cardSpacer} />

                  {/* Divider */}
                  <View style={styles.cardDivider} />

                  {/* Footer */}
                  <View style={styles.cardFooter}>
                    <View style={styles.agreementIdBadge}>
                      <Text
                        style={styles.agreementIdText}
                        numberOfLines={1}
                        ellipsizeMode="middle"
                      >
                        {agreementIdFormatted}
                      </Text>
                    </View>
                    <View style={styles.actionContainer}>
                      <Text style={styles.viewOverviewAction}>
                        View scope & contract &gt;
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  headerSection: {
    marginBottom: spacing.xxl,
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
  subhead: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  list: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    position: 'relative',
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 24,
  },
  versionBadge: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    flexShrink: 0,
    marginTop: 2,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
  },
  cardStatus: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  cardClient: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardSpacer: {
    height: 18,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.cardDivider,
    width: '100%',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    gap: 12,
  },
  agreementIdBadge: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.cardBorderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 1,
    maxWidth: '52%',
  },
  agreementIdText: {
    fontSize: 11.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  actionContainer: {
    flexShrink: 0,
  },
  viewOverviewAction: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },
});
