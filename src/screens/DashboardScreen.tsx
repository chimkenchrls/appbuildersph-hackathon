import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/InlineError';
import { Screen, useContentPadding } from '@/components/ui/Screen';
import { LoadingView } from '@/components/ui/StateViews';
import { StatusBadge, type BadgeVariant } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { colors, layout, spacing, type } from '@/constants/theme';
import { FixtureControlsPanel, FixtureNotice } from '@/features/ai/FixtureNotice';
import { useAiStatus } from '@/features/ai/useAiStatus';
import { useProjects } from '@/features/projects/useProjects';
import { limits } from '@/safety/validation';
import { errorMessage } from '@/services/errors';
import type { AiStatus, Project } from '@/types/workspace';
import { dateLabel } from '@/utils/format';

const aiLabels: Record<AiStatus, string> = {
  ready: 'Local AI: Ready',
  busy: 'Local AI: Working',
  loading: 'Local AI: Preparing',
  unavailable: 'Local AI: Unavailable. You can still work manually.',
};

function scopeBadge(project: Project): { variant: BadgeVariant; label?: string } {
  if (project.scopeStatus === 'confirmed') return { variant: 'confirmed', label: `Agreement v${project.agreementVersion ?? 1} confirmed` };
  return { variant: project.scopeStatus };
}

function ProjectRow({ project }: { project: Project }) {
  const badge = scopeBadge(project);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens the project"
      onPress={() => router.push({ pathname: '/project/[projectId]', params: { projectId: project.id } })}
      android_ripple={{ color: colors.surfaceRaised }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text style={type.subheading}>{project.name}</Text>
        <StatusBadge variant={badge.variant} label={badge.label} />
        <Text style={type.support}>{`Updated ${dateLabel(project.updatedAt)}`}</Text>
      </View>
      <Icon name="chevron-right" color={colors.textSecondary} />
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { projects, loading, error, reload, create, operation } = useProjects();
  const aiStatus = useAiStatus();
  const padding = useContentPadding();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  const closeForm = () => { setCreating(false); setName(''); setNameError(''); operation.clearError(); };
  const submit = async () => {
    if (!name.trim()) { setNameError('Enter a project name.'); return; }
    setNameError('');
    const project = await create(name);
    if (!project) return;
    closeForm();
    router.push({ pathname: '/project/[projectId]', params: { projectId: project.id } });
  };
  const createError = nameError || (operation.status === 'failed' ? errorMessage(operation.error) : '');

  const footer = creating ? (
    <View style={styles.form}>
      <TextField
        label="Project name"
        value={name}
        onChangeText={setName}
        error={createError || undefined}
        editable={!operation.busy}
        maxLength={limits.name}
        autoFocus
        onSubmitEditing={() => void submit()}
      />
      <Button label="Create project" icon="plus" busy={operation.busy} onPress={() => void submit()} />
      <Button label="Cancel" variant="secondary" disabled={operation.busy} onPress={closeForm} />
    </View>
  ) : (
    <Button label="New project" icon="plus" onPress={() => setCreating(true)} />
  );

  return (
    <Screen title="Projects" footer={footer}>
      <FlatList
        data={projects}
        keyExtractor={project => project.id}
        renderItem={({ item }) => <ProjectRow project={item} />}
        contentContainerStyle={[padding, styles.list]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={type.support}>{aiLabels[aiStatus]}</Text>
            <FixtureNotice />
            {error ? (
              <InlineError message="Projects could not be loaded.">
                <Button label="Retry" variant="secondary" onPress={() => void reload()} />
              </InlineError>
            ) : null}
          </View>
        }
        ListFooterComponent={<FixtureControlsPanel />}
        ListEmptyComponent={
          loading ? (
            <LoadingView label="Loading projects…" />
          ) : error ? null : (
            <EmptyState
              title="No projects yet"
              message="Create a project, paste the client conversation, and confirm the scope you reviewed."
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, flexGrow: 1 },
  header: { gap: spacing.md },
  row: {
    minHeight: layout.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  rowText: { flex: 1, gap: spacing.sm },
  form: { gap: spacing.md },
});
