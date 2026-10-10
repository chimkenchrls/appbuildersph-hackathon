import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/InlineError';
import { Screen, useContentPadding } from '@/components/ui/Screen';
import { LoadingView, MissingRecord } from '@/components/ui/StateViews';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { colors, layout, spacing, type } from '@/constants/theme';
import { FixtureBadge } from '@/features/ai/FixtureNotice';
import { OperationPanel } from '@/features/ai/OperationPanel';
import { useAiStatus } from '@/features/ai/useAiStatus';
import { AgreementView, agreementLabel } from '@/features/scope/AgreementView';
import { ConfirmBar } from '@/features/scope/ConfirmBar';
import { DraftEditor } from '@/features/scope/DraftEditor';
import { useWorkspace } from '@/features/scope/useWorkspace';
import { useExitGuard } from '@/hooks/useExitGuard';
import { limits } from '@/safety/validation';
import { errorMessage, ServiceError } from '@/services/errors';
import type { AiStatus } from '@/types/workspace';
import { dateLabel, timeLabel } from '@/utils/format';

// What the shared operation is doing. A background save must not lock the
// fields: locking would drop focus from the field the user just moved to.
type Activity = 'extract' | 'confirm' | 'save' | 'background-save' | null;

type HistoryItem = { key: string; title: string; detail: string; open: () => void };

function aiBlockedReason(status: AiStatus) {
  if (status === 'unavailable') return 'Local AI is unavailable. You can still enter or edit the scope manually.';
  if (status === 'loading') return 'Local AI is still preparing.';
  if (status === 'busy') return 'Local AI is busy with another task.';
  return undefined;
}

export default function WorkspaceScreen({ projectId }: { projectId: string }) {
  const ws = useWorkspace(projectId);
  const { operation, draft, agreement } = ws;
  const aiStatus = useAiStatus();
  const padding = useContentPadding();
  const [activity, setActivity] = useState<Activity>(null);
  const [confirming, setConfirming] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [askReplace, setAskReplace] = useState(false);

  const hasUnextractedText = !draft && !agreement && Boolean(ws.sourceText.trim());
  const goBack = useExitGuard({
    blocked: ws.dirty || operation.busy || hasUnextractedText,
    parent: '/',
    prepare: ws.prepareExit,
    discard: ws.discard,
    retrySave: Boolean(draft),
  });

  const run = (kind: Activity, action: () => Promise<unknown>) => { setActivity(kind); void action(); };
  const saveOnBlur = () => {
    if (ws.dirty && !operation.busy && !ws.budgetError) run('background-save', ws.saveDraft);
  };
  const startExtract = () => { setAskReplace(false); setConfirming(false); run('extract', ws.extract); };

  const foreground = operation.busy && activity !== 'background-save';
  const locked = foreground;
  const errorCode = operation.error instanceof ServiceError ? operation.error.code : null;
  const aiReason = aiBlockedReason(aiStatus);

  if (ws.loading && !ws.project) {
    return <Screen title="Project" onBack={goBack}><LoadingView label="Loading project…" /></Screen>;
  }
  if (!ws.project) {
    return (
      <Screen title="Project" onBack={goBack}>
        <MissingRecord message={errorMessage(ws.error)} actionLabel="Back to projects" onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  // One status region, shown beside the actions so it is visible wherever the page is scrolled.
  let status: ReactNode = null;
  if (foreground && activity === 'extract' && operation.status === 'running') {
    status = <OperationPanel label="Reading the conversation…" onStop={operation.cancel} stopping={operation.cancelling} />;
  } else if (foreground) {
    status = <OperationPanel label={activity === 'confirm' ? 'Saving Agreement v1…' : 'Saving draft…'} />;
  } else if (operation.status === 'cancelled' && activity === 'extract') {
    status = <Text accessibilityLiveRegion="polite" style={type.support}>Extraction stopped. Your text has been kept.</Text>;
  } else if (operation.status === 'failed') {
    const retrySave = errorCode === 'save_failed' || activity === 'save' || activity === 'background-save';
    // Without a draft, Extract scope and Enter scope manually sit directly below as the
    // recovery actions. Confirmation is retried from the open confirm bar.
    status = (
      <InlineError message={errorMessage(operation.error)}>
        {!draft || activity === 'confirm' ? null : retrySave ? (
          <Button label="Retry save" variant="secondary" onPress={() => run('save', ws.saveDraft)} />
        ) : (
          <Button label="Retry" variant="secondary" disabled={Boolean(aiReason)} disabledReason={aiReason} onPress={startExtract} />
        )}
      </InlineError>
    );
  }

  const badges = (
    <>
      {agreement ? <StatusBadge variant="confirmed" label={agreementLabel(agreement)} /> : <StatusBadge variant={draft ? 'draft' : 'none'} />}
      {draft && ws.dirty ? <StatusBadge variant="unsaved" /> : null}
      <FixtureBadge />
    </>
  );
  const reloadError = ws.error ? (
    <InlineError message="The latest project data could not be loaded.">
      <Button label="Retry" variant="secondary" onPress={ws.reload} />
    </InlineError>
  ) : null;

  if (agreement) {
    const history: HistoryItem[] = [
      ...ws.proposals.map(proposal => ({
        key: proposal.id,
        title: `Proposal draft: ${proposal.deliverables[0] ?? 'No deliverables'}`,
        detail: `Draft · Saved ${dateLabel(proposal.updatedAt)} ${timeLabel(proposal.updatedAt)}`,
        open: () => router.push({ pathname: '/project/[projectId]/proposal/[proposalId]', params: { projectId, proposalId: proposal.id } }),
      })),
      ...ws.analyses.map(analysis => ({
        key: analysis.id,
        title: `Request: ${analysis.requestText}`,
        detail: `Analyzed ${dateLabel(analysis.createdAt)} against Agreement v${analysis.agreementVersion}`,
        open: () => router.push({ pathname: '/project/[projectId]/request', params: { projectId, analysisId: analysis.id } }),
      })),
    ];
    return (
      <Screen
        title={ws.project.name}
        onBack={goBack}
        status={badges}
        footer={<Button label="Analyze new request" icon="sparkles" onPress={() => router.push({ pathname: '/project/[projectId]/request', params: { projectId } })} />}
      >
        <FlatList
          data={history}
          keyExtractor={item => item.key}
          contentContainerStyle={[padding, styles.list]}
          ListHeaderComponent={
            <View style={styles.section}>
              {reloadError}
              <AgreementView agreement={agreement} />
              <Text accessibilityRole="header" style={type.subheading}>Requests and proposals</Text>
            </View>
          }
          ListEmptyComponent={<Text style={type.support}>Nothing yet. Analyze a new client request to compare it with this agreement.</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens the saved record"
              onPress={item.open}
              android_ripple={{ color: colors.surfaceRaised }}
              style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
            >
              <View style={styles.historyText}>
                <Text style={type.body} numberOfLines={2}>{item.title}</Text>
                <Text style={type.support}>{item.detail}</Text>
              </View>
              <Icon name="chevron-right" color={colors.textSecondary} />
            </Pressable>
          )}
        />
      </Screen>
    );
  }

  if (draft) {
    const hasDeliverable = draft.deliverables.some(item => item.text.trim());
    const confirmReason = !hasDeliverable ? 'Add at least one deliverable.' : ws.budgetError ? 'Fix the budget field first.' : undefined;
    return (
      <Screen
        title={ws.project.name}
        onBack={goBack}
        status={badges}
        footer={
          <View style={styles.section}>
            {status}
            {foreground && activity !== 'confirm' ? null : (
              <ConfirmBar
                expanded={confirming}
                onExpand={() => setConfirming(true)}
                onKeepEditing={() => setConfirming(false)}
                onConfirm={() => run('confirm', ws.confirm)}
                disabledReason={confirmReason}
                busy={foreground}
              />
            )}
          </View>
        }
      >
        <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
          {reloadError}
          {draft.sourceText ? (
            <View style={styles.section}>
              <Text accessibilityRole="header" style={type.subheading}>Source conversation</Text>
              <Text style={type.support} numberOfLines={showSource ? undefined : 1} selectable>{draft.sourceText}</Text>
              <Button
                label={showSource ? 'Hide conversation' : 'Show conversation'}
                variant="quiet"
                icon={showSource ? 'chevron-up' : 'chevron-down'}
                onPress={() => setShowSource(value => !value)}
              />
              {askReplace ? (
                <View style={styles.consent}>
                  <Text style={type.body}>Replace this draft with a new extraction? Your current draft is kept unless a complete new result arrives.</Text>
                  <Button label="Replace draft" onPress={startExtract} />
                  <Button label="Keep current draft" variant="secondary" onPress={() => setAskReplace(false)} />
                </View>
              ) : (
                <Button
                  label="Extract again"
                  variant="quiet"
                  icon="sparkles"
                  disabled={locked || Boolean(aiReason)}
                  disabledReason={aiReason}
                  onPress={() => setAskReplace(true)}
                />
              )}
            </View>
          ) : null}
          <DraftEditor
            draft={draft}
            budgetText={ws.budgetText}
            budgetError={ws.budgetError}
            onChange={ws.updateDraft}
            onBudget={ws.setBudget}
            onBlur={saveOnBlur}
            editable={!locked}
          />
        </ScrollView>
      </Screen>
    );
  }

  const extractReason = !ws.sourceText.trim() ? 'Paste the conversation first.' : aiReason;
  return (
    <Screen
      title={ws.project.name}
      onBack={goBack}
      status={badges}
      footer={
        <View style={styles.section}>
          {status}
          {foreground ? null : (
            <>
              <Button label="Extract scope" icon="sparkles" disabled={Boolean(extractReason)} disabledReason={extractReason} onPress={startExtract} />
              <Button label="Enter scope manually" variant="quiet" icon="pencil" onPress={ws.enterManual} />
            </>
          )}
        </View>
      }
    >
      <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
        {reloadError}
        <TextField
          label="Client conversation"
          value={ws.sourceText}
          onChangeText={ws.setSourceText}
          helper="Paste the messages that describe the work. Nothing is read from your clipboard or accounts automatically."
          editable={!locked}
          multiline
          maxLength={limits.source}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  list: { gap: spacing.md, flexGrow: 1 },
  consent: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceRaised },
  historyRow: {
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
  historyText: { flex: 1, gap: spacing.xs },
});
