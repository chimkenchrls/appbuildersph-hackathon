import { StyleSheet, Text, View } from 'react-native';
import { CheckRow } from '@/components/ui/CheckRow';
import { EvidenceItem } from '@/components/ui/EvidenceItem';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, type } from '@/constants/theme';
import type { Agreement, Finding } from '@/types/workspace';

type Props = {
  finding: Finding;
  agreement: Agreement;
  selected: boolean;
  onToggle: () => void;
  /** False while the analysis is unsaved or an operation is running. */
  selectable: boolean;
};

/** One requested item: classification, explanation, evidence and open questions. */
export function FindingCard({ finding, agreement, selected, onToggle, selectable }: Props) {
  const evidence = finding.evidenceRequirementIds
    .map(id => agreement.requirements.find(item => item.id === id))
    .filter(item => item !== undefined);
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={type.subheading}>{finding.requestedItem}</Text>
      <StatusBadge variant={finding.classification} />
      <Text style={type.body}>{finding.explanation}</Text>
      {evidence.map(item => (
        <EvidenceItem key={item.id} requirementId={item.id} version={agreement.version} kind={item.kind} text={item.text} />
      ))}
      {evidence.length === 0 && finding.classification === 'potential_additional' ? (
        <Text style={type.support}>Not found in the recorded scope. This is not an explicit exclusion.</Text>
      ) : null}
      {finding.clarificationQuestions.length > 0 ? (
        <View style={styles.questions}>
          <Text style={type.label}>Questions to ask</Text>
          {finding.clarificationQuestions.map((question, index) => (
            <Text key={index} style={type.body}>{`• ${question}`}</Text>
          ))}
        </View>
      ) : null}
      {finding.classification === 'needs_clarification' ? (
        <Text style={type.support}>Nothing to include yet. Ask your client to clarify, then enter their answer as a new request.</Text>
      ) : null}
      {finding.classification === 'potential_additional' ? (
        <CheckRow label="Include in proposal" checked={selected} onToggle={onToggle} disabled={!selectable} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  questions: { gap: spacing.xs },
});
