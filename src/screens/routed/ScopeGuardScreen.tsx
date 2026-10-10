import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineError } from '@/components/ui/InlineError';
import { Screen, useContentPadding } from '@/components/ui/Screen';
import { LoadingView, MissingRecord } from '@/components/ui/StateViews';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { spacing, type } from '@/constants/theme';
import { AiSuggestionBanner } from '@/features/ai/AiSuggestionBanner';
import { FixtureBadge } from '@/features/ai/FixtureNotice';
import { OperationPanel } from '@/features/ai/OperationPanel';
import { useAiStatus } from '@/features/ai/useAiStatus';
import { AgreementStrip } from '@/features/request/AgreementStrip';
import { FindingCard } from '@/features/request/FindingCard';
import { useRequestAnalysis } from '@/features/request/useRequestAnalysis';
import { useExitGuard } from '@/hooks/useExitGuard';
import { limits } from '@/safety/validation';
import { errorMessage } from '@/services/errors';

type Activity = 'analyze' | 'save' | 'start' | null;
type Props = { projectId: string; analysisId?: string };

export default function ScopeGuardScreen({ projectId, analysisId }: Props) {
  const sg = useRequestAnalysis(projectId, analysisId);
  const { operation, agreement } = sg;
  const aiStatus = useAiStatus();
  const padding = useContentPadding();
  const [activity, setActivity] = useState<Activity>(null);

  const workspace: Href = { pathname: '/project/[projectId]', params: { projectId } };
  const goBack = useExitGuard({ blocked: sg.dirty || operation.busy, parent: workspace, prepare: sg.prepareExit });

  const run = (kind: Activity, action: () => Promise<unknown>) => { setActivity(kind); void action(); };
  const startProposal = async () => {
    const proposal = await sg.startProposal();
    if (proposal) router.push({ pathname: '/project/[projectId]/proposal/[proposalId]', params: { projectId, proposalId: proposal.id } });
  };

  if (sg.loading) {
    return <Screen title="ScopeGuard" onBack={goBack}><LoadingView label="Loading agreement…" /></Screen>;
  }
  if (sg.error) {
    return (
      <Screen title="ScopeGuard" onBack={goBack}>
        <MissingRecord message={errorMessage(sg.error)} actionLabel="Back to project" onAction={() => router.replace(workspace)} />
      </Screen>
    );
  }
  if (!agreement) {
    return (
      <Screen title="ScopeGuard" onBack={goBack} status={<FixtureBadge />}>
        <View style={padding}>
          <EmptyState
            title="No confirmed agreement yet"
            message="A request can only be compared with a scope you have confirmed. Review the draft and confirm it first."
            action={<Button label="Review scope draft" variant="secondary" onPress={goBack} />}
          />
        </View>
      </Screen>
    );
  }

  // A validated result is shown even while unsaved, but only a saved one can start a proposal.
  const result = sg.analysis ?? sg.candidate;
  const saved = Boolean(sg.analysis);
  const proposable = result?.findings.some(finding => finding.classification === 'potential_additional') ?? false;
  const selectedCount = sg.selectedIds.length;
  const aiReason =
    aiStatus === 'unavailable' ? 'Local AI is unavailable. Analysis needs the local model.'
    : aiStatus === 'loading' ? 'Local AI is still preparing.'
    : aiStatus === 'busy' ? 'Local AI is busy with another task.'
    : undefined;
  const analyzeReason = !sg.requestText.trim() ? 'Enter the client request first.' : aiReason;

  let status: ReactNode = null;
  if (operation.busy && activity === 'analyze' && operation.status === 'running') {
    status = <OperationPanel label={`Comparing request with Agreement v${agreement.version}…`} onStop={operation.cancel} stopping={operation.cancelling} />;
  } else if (operation.busy) {
    status = <OperationPanel label={activity === 'start' ? 'Creating proposal draft…' : 'Saving analysis…'} />;
  } else if (operation.status === 'cancelled') {
    status = <Text accessibilityLiveRegion="polite" style={type.support}>Analysis stopped. Your request has been kept.</Text>;
  } else if (operation.status === 'failed') {
    // A validated but unsaved result is retried here without rerunning AI. In every other
    // case the action button below (Analyze request or Start proposal) is the retry.
    status = (
      <InlineError message={errorMessage(operation.error)}>
        {sg.candidate ? <Button label="Retry save" variant="secondary" onPress={() => run('save', sg.retrySave)} /> : null}
      </InlineError>
    );
  }

  let action: ReactNode = null;
  if (!operation.busy) {
    if (saved) {
      const startReason = !proposable ? 'No potential additional work was found to propose.' : selectedCount === 0 ? 'Select at least one item.' : undefined;
      action = (
        <Button
          label={`Start proposal (${selectedCount} selected)`}
          disabled={Boolean(startReason)}
          disabledReason={startReason}
          onPress={() => run('start', startProposal)}
        />
      );
    } else if (!result) {
      action = <Button label="Analyze request" icon="sparkles" disabled={Boolean(analyzeReason)} disabledReason={analyzeReason} onPress={() => run('analyze', sg.analyze)} />;
    }
  }

  return (
    <Screen
      title="ScopeGuard"
      onBack={goBack}
      status={
        <>
          {result && !saved ? <StatusBadge variant="unsaved" label="Analysis not saved" /> : null}
          <FixtureBadge />
        </>
      }
      footer={status || action ? <View style={styles.section}>{status}{action}</View> : undefined}
    >
      <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
        <AgreementStrip agreement={agreement} />
        <TextField
          label="New client request"
          value={sg.requestText}
          onChangeText={sg.changeRequest}
          helper={analysisId ? 'Saved request. It cannot be edited.' : 'Paste or type what the client is asking for now.'}
          editable={!analysisId && !operation.busy}
          multiline
          maxLength={limits.request}
        />
        {result ? (
          <View style={styles.section}>
            <AiSuggestionBanner text="AI suggestion. Review each item before using it. This is not a verdict." />
            {saved && !analysisId ? (
              <Button
                label="Analyze again"
                variant="quiet"
                icon="sparkles"
                disabled={operation.busy || Boolean(analyzeReason)}
                disabledReason={analyzeReason}
                onPress={() => run('analyze', sg.analyze)}
              />
            ) : null}
            {result.findings.map(finding => (
              <FindingCard
                key={finding.id}
                finding={finding}
                agreement={agreement}
                selected={sg.selectedIds.includes(finding.id)}
                onToggle={() => sg.toggle(finding.id)}
                selectable={saved && !operation.busy}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: spacing.md } });
