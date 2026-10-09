import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
} from 'react-native';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { CardWatermarkSvg } from '@/components/CardWatermarkSvg';
import type { Project, Agreement } from '@/types/domain';

export type ProjectFilter = 'all' | 'drafting' | 'accepted';

interface ProjectsScreenProps {
  projects: Project[];
  projectAgreements: Record<string, Agreement[]>;
  onSelectProject: (projectId: string) => void;
  onViewProjectOverview: (projectId: string) => void;
  onNewProject: () => void;
  onReleaseProject?: (projectId: string) => void;
}

export function ProjectsScreen({
  projects,
  projectAgreements,
  onSelectProject,
  onViewProjectOverview,
  onNewProject,
  onReleaseProject,
}: ProjectsScreenProps) {
  const [filter, setFilter] = React.useState<ProjectFilter>('all');

  const draftingCount = projects.filter(
    (p) => !(projectAgreements[p.id] && projectAgreements[p.id].length > 0),
  ).length;

  const acceptedCount = projects.filter(
    (p) => projectAgreements[p.id] && projectAgreements[p.id].length > 0,
  ).length;

  const filteredProjects = projects.filter((p) => {
    const isAccepted = projectAgreements[p.id] && projectAgreements[p.id].length > 0;
    if (filter === 'drafting') return !isAccepted;
    if (filter === 'accepted') return isAccepted;
    return true;
  });

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
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Clear scope.</Text>
          <Text style={styles.heroTitle}>Confident work.</Text>
          <Text style={styles.heroSubtitle}>
            Open a project to see what was confirmed.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.newProjectButton,
              pressed && styles.newProjectButtonPressed,
            ]}
            onPress={onNewProject}
            accessibilityRole="button"
            accessibilityLabel="Create a new project"
          >
            <Text style={styles.newProjectButtonText}>+  New Project</Text>
          </Pressable>
        </View>

        {/* Section Header: Your Projects & Filter Tabs */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your Projects</Text>
          <Text style={styles.totalCountText}>
            {filteredProjects.length} of {projects.length}
          </Text>
        </View>

        {/* Filter Controls: All | Drafting | Accepted */}
        <View style={styles.filterRow}>
          <Pressable
            style={[
              styles.filterPill,
              filter === 'all' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('all')}
            accessibilityRole="button"
            accessibilityLabel={`Filter all projects (${projects.length})`}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === 'all' && styles.filterPillTextActive,
              ]}
            >
              All ({projects.length})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              filter === 'drafting' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('drafting')}
            accessibilityRole="button"
            accessibilityLabel={`Filter drafting projects (${draftingCount})`}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === 'drafting' && styles.filterPillTextActive,
              ]}
            >
              Drafting ({draftingCount})
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filterPill,
              filter === 'accepted' && styles.filterPillActive,
            ]}
            onPress={() => setFilter('accepted')}
            accessibilityRole="button"
            accessibilityLabel={`Filter confirmed projects (${acceptedCount})`}
          >
            <Text
              style={[
                styles.filterPillText,
                filter === 'accepted' && styles.filterPillTextActive,
              ]}
            >
              Confirmed ({acceptedCount})
            </Text>
          </Pressable>
        </View>

        {/* Project Cards List */}
        <View style={styles.projectList}>
          {filteredProjects.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {filter === 'drafting'
                  ? 'No drafting projects'
                  : filter === 'accepted'
                    ? 'No confirmed projects yet'
                    : 'No projects yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'drafting'
                  ? 'All your projects have released baseline agreements.'
                  : filter === 'accepted'
                    ? 'Release a drafted project to seal an agreement baseline.'
                    : 'Create your first project to get started.'}
              </Text>
              <Pressable
                style={styles.emptyActionBtn}
                onPress={onNewProject}
                accessibilityRole="button"
                accessibilityLabel="Create project"
              >
                <Text style={styles.emptyActionBtnText}>+ Create Project</Text>
              </Pressable>
            </View>
          ) : (
            filteredProjects.map((project) => {
              const agreements = projectAgreements[project.id] || [];
              const hasConfirmed = agreements.length > 0;
              const latestAgmt = agreements[0];
              const statusText = hasConfirmed ? 'Confirmed' : 'Drafting';
              const agreementText = latestAgmt
                ? `Agreement v${latestAgmt.versionNumber}`
                : 'Draft · Not Released';

              return (
                <Pressable
                  key={project.id}
                  style={({ pressed }) => [
                    styles.projectCard,
                    pressed && styles.projectCardPressed,
                  ]}
                  onPress={() => onSelectProject(project.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open project ${project.title}`}
                >
                  {/* Subtle Corner Watermark SVG */}
                  <CardWatermarkSvg opacity={0.09} position="top-right" />

                  {/* Top row: Project title + status badge */}
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {project.title}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        hasConfirmed
                          ? styles.statusBadgeAccepted
                          : styles.statusBadgeDrafting,
                      ]}
                    >
                      <Text
                        style={[
                          styles.cardStatus,
                          hasConfirmed
                            ? styles.cardStatusAcceptedText
                            : styles.cardStatusDraftingText,
                        ]}
                      >
                        {statusText}
                      </Text>
                    </View>
                  </View>

                  {/* Second row: Client Name */}
                  <Text style={styles.cardClient} numberOfLines={2}>
                    {project.clientName || 'Client'}
                  </Text>

                  {/* Breathing space matching mockup */}
                  <View style={styles.cardSpacer} />

                  {/* Subtle divider line */}
                  <View style={styles.cardDivider} />

                  {/* Footer: Agreement / Draft + Action link */}
                  <View style={styles.cardFooter}>
                    <Text
                      style={[
                        styles.agreementIdText,
                        !hasConfirmed && styles.agreementDraftText,
                      ]}
                      numberOfLines={1}
                    >
                      {agreementText}
                    </Text>

                    {!hasConfirmed ? (
                      <Pressable
                        style={styles.actionContainer}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          if (onReleaseProject) {
                            onReleaseProject(project.id);
                          } else {
                            onSelectProject(project.id);
                          }
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Release scope for ${project.title}`}
                      >
                        <Text style={styles.releaseActionText}>
                          Release scope &gt;
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.actionContainer}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          onViewProjectOverview(project.id);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="link"
                        accessibilityLabel={`View project overview for ${project.title}`}
                      >
                        <Text style={styles.viewOverviewAction}>
                          View project overview &gt;
                        </Text>
                      </Pressable>
                    )}
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
    paddingBottom: spacing.xxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    paddingVertical: spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
    lineHeight: 20,
  },
  newProjectButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newProjectButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  newProjectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  totalCountText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: colors.onPrimary,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 8,
    ...shadows.card,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radii.button,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onPrimary,
  },
  projectList: {
    gap: spacing.lg,
  },
  projectCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 14,
    position: 'relative',
    ...shadows.card,
  },
  projectCardPressed: {
    backgroundColor: colors.surfaceRaised,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    zIndex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexShrink: 0,
    marginTop: 2,
  },
  statusBadgeAccepted: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  statusBadgeDrafting: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
  },
  cardStatus: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardStatusAcceptedText: {
    color: '#2E7D32',
  },
  cardStatusDraftingText: {
    color: '#E65100',
  },
  cardClient: {
    fontSize: 13.5,
    fontWeight: '400',
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
    zIndex: 1,
  },
  cardSpacer: {
    height: 24,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    zIndex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    gap: 12,
    zIndex: 1,
  },
  agreementIdText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: '400',
    flexShrink: 1,
  },
  agreementDraftText: {
    color: '#D97706',
    fontWeight: '500',
  },
  actionContainer: {
    flexShrink: 0,
  },
  viewOverviewAction: {
    fontSize: 12.5,
    color: colors.primary,
    fontWeight: '700',
  },
  releaseActionText: {
    fontSize: 12.5,
    color: colors.primary,
    fontWeight: '700',
  },
});
