import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/InlineError';
import { ItemListEditor } from '@/components/ui/ItemListEditor';
import { Screen, useContentPadding } from '@/components/ui/Screen';
import { LoadingView, MissingRecord } from '@/components/ui/StateViews';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextField } from '@/components/ui/TextField';
import { colors, spacing, type } from '@/constants/theme';
import { FixtureBadge } from '@/features/ai/FixtureNotice';
import { OperationPanel } from '@/features/ai/OperationPanel';
import { useAiStatus } from '@/features/ai/useAiStatus';
import { useProposal } from '@/features/proposal/useProposal';
import { useExitGuard } from '@/hooks/useExitGuard';
import { limits } from '@/safety/validation';
import { errorMessage } from '@/services/errors';
import { timeLabel } from '@/utils/format';

type Activity = 'generate' | 'save' | null;
type Props = { projectId: string; proposalId: string };

export default function ProposalScreen({ projectId, proposalId }: Props) {
  const p = useProposal(projectId, proposalId);
  const { operation, form, proposal } = p;
  const aiStatus = useAiStatus();
  const padding = useContentPadding();
  const [activity, setActivity] = useState<Activity>(null);
  const [askReplace, setAskReplace] = useState(false);

  const workspace: Href = { pathname: '/project/[projectId]', params: { projectId } };
  const goBack = useExitGuard({ blocked: p.dirty || operation.busy, parent: workspace, prepare: p.prepareExit, discard: p.discard });

  // iOS does not announce live regions, so the copy result is announced explicitly.
  useEffect(() => {
    if (p.copyState) AccessibilityInfo.announceForAccessibility(p.copyState);
  }, [p.copyState]);

  if (p.loading) {
    return <Screen title="Change proposal" onBack={goBack}><LoadingView label="Loading proposal…" /></Screen>;
  }
  if (p.error || !form || !proposal) {
    return (
      <Screen title="Change proposal" onBack={goBack}>
        <MissingRecord message={errorMessage(p.error)} actionLabel="Back to project" onAction={() => router.replace(workspace)} />
      </Screen>
    );
  }

  const run = (kind: Activity, action: () => Promise<unknown>) => { setActivity(kind); void action(); };
  const startGenerate = () => { setAskReplace(false); run('generate', p.generate); };
  const requestGenerate = () => {
    if (p.manuallyEdited && form.message.trim()) setAskReplace(true);
    else startGenerate();
  };

  const locked = operation.busy;
  const hasErrors = Boolean(p.errors.fee || p.errors.days || p.errors.deliverables);
  const fieldReason = hasErrors ? 'Fix the highlighted fields first.' : undefined;
  const aiReason =
    aiStatus === 'unavailable' ? 'Local AI is unavailable. You can still write the message yourself.'
    : aiStatus === 'loading' ? 'Local AI is still preparing.'
    : aiStatus === 'busy' ? 'Local AI is busy with another task.'
    : undefined;
  const copyReason = form.message.trim() ? undefined : 'Write or generate a message first.';

  let status: ReactNode = null;
  if (operation.busy && activity === 'generate' && operation.status === 'running') {
    status = <OperationPanel label="Drafting the message…" onStop={operation.cancel} stopping={operation.cancelling} />;
  } else if (operation.busy) {
    status = <OperationPanel label="Saving draft…" />;
  } else if (operation.status === 'cancelled') {
    status = <Text accessibilityLiveRegion="polite" style={type.support}>Generation stopped. Your message is unchanged.</Text>;
  } else if (operation.status === 'failed') {
    // A failed save is retried with Save draft, directly below.
    status = (
      <InlineError message={errorMessage(operation.error)}>
        {activity === 'save' ? null : (
          <Button label="Retry" variant="secondary" disabled={Boolean(fieldReason ?? aiReason)} disabledReason={fieldReason ?? aiReason} onPress={startGenerate} />
        )}
      </InlineError>
    );
  }

  return (
    <Screen
      title="Change proposal"
      onBack={goBack}
      status={
        <>
          {p.dirty ? <StatusBadge variant="unsaved" /> : <StatusBadge variant="saved" label={`Draft · Saved ${timeLabel(proposal.updatedAt)}`} />}
          <FixtureBadge />
        </>
      }
      footer={
        <View style={styles.section}>
          {status}
          {p.copyState ? <Text accessibilityLiveRegion="polite" style={[type.label, styles.copied]}>{p.copyState}</Text> : null}
          {operation.busy ? null : (
            // The header badge already says when there is nothing to save.
            <Button label="Save draft" icon="save" disabled={hasErrors || !p.dirty} disabledReason={fieldReason} onPress={() => run('save', p.save)} />
          )}
          <Button label="Copy text" variant="secondary" icon="copy" disabled={Boolean(copyReason)} disabledReason={copyReason} onPress={() => void p.copy()} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={padding} keyboardShouldPersistTaps="handled">
        <Text style={type.support}>This is a draft for you to send yourself. Saving or copying it does not change Agreement v1 or record client acceptance.</Text>
        <ItemListEditor
          title="Additional deliverables"
          itemLabel="Deliverable"
          items={form.deliverables}
          onChange={deliverables => p.update({ deliverables })}
          editable={!locked}
          emptyText="No deliverables selected."
          error={p.errors.deliverables}
          maxLength={limits.item}
        />
        <View style={styles.section}>
          <Text accessibilityRole="header" style={type.subheading}>Your estimates</Text>
          <TextField
            label={`Proposed fee (${proposal.currency})`}
            value={form.fee}
            onChangeText={fee => p.update({ fee })}
            editable={!locked}
            keyboardType="decimal-pad"
            helper="Leave blank if not decided. Nothing is suggested for you."
            error={p.errors.fee}
            maxLength={16}
          />
          <TextField
            label="Extra working days"
            value={form.days}
            onChangeText={days => p.update({ days })}
            editable={!locked}
            keyboardType="decimal-pad"
            helper="Leave blank if not decided."
            error={p.errors.days}
            maxLength={8}
          />
        </View>
        <View style={styles.section}>
          <Text accessibilityRole="header" style={type.subheading}>Message to the client</Text>
          {askReplace ? (
            <View style={styles.consent}>
              <Text style={type.body}>Replace your edited message? Your message is kept unless a complete new draft arrives.</Text>
              <Button label="Replace" onPress={startGenerate} />
              <Button label="Keep mine" variant="secondary" onPress={() => setAskReplace(false)} />
            </View>
          ) : (
            <Button
              label="Generate message"
              variant="secondary"
              icon="sparkles"
              disabled={locked || Boolean(fieldReason ?? aiReason)}
              disabledReason={fieldReason ?? aiReason}
              onPress={requestGenerate}
            />
          )}
          <TextField
            label="Message"
            value={form.message}
            onChangeText={message => p.update({ message })}
            editable={!locked}
            multiline
            helper="Edit freely. Nothing is sent from this app."
            maxLength={limits.message}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  consent: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceRaised },
  copied: { color: colors.successText },
});
