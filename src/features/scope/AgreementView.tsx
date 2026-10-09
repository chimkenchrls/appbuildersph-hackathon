import { StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, type } from '@/constants/theme';
import type { Agreement, Requirement } from '@/types/workspace';
import { dateLabel, money, timeLabel } from '@/utils/format';

export const agreementLabel = (agreement: Agreement) => `Agreement v${agreement.version} · Confirmed ${dateLabel(agreement.confirmedAt)}`;

function Requirements({ title, items }: { title: string; items: Requirement[] }) {
  if (!items.length) return null;
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={type.label}>{title}</Text>
      {items.map(item => (
        <View key={item.id} style={styles.requirement}>
          <Text style={[type.mono, styles.id]}>{item.id}</Text>
          <Text style={[type.body, styles.text]}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

function Term({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.term}>
      <Text style={type.support}>{label}</Text>
      <Text style={type.body}>{value ?? 'Not specified'}</Text>
    </View>
  );
}

/** The confirmed snapshot. Read-only: no input outlines, a fixed left edge and a lock. */
export function AgreementView({ agreement }: { agreement: Agreement }) {
  return (
    <View style={styles.block}>
      <StatusBadge variant="confirmed" label={agreementLabel(agreement)} />
      <Text style={type.support}>
        {`Fixed snapshot you reviewed at ${timeLabel(agreement.confirmedAt)}. Client approval is not recorded here.`}
      </Text>
      <Requirements title="Deliverables" items={agreement.requirements.filter(item => item.kind === 'deliverable')} />
      <Requirements title="Recorded terms" items={agreement.requirements.filter(item => item.kind === 'term')} />
      <Requirements title="Exclusions" items={agreement.requirements.filter(item => item.kind === 'exclusion')} />
      <View style={styles.group}>
        <Text accessibilityRole="header" style={type.label}>Terms</Text>
        <Term label="Budget" value={agreement.terms.budgetAmount === null ? null : money(agreement.terms.budgetAmount, agreement.terms.currency)} />
        <Term label="Timeline" value={agreement.terms.timeline} />
        <Term label="Revision terms" value={agreement.terms.revisionTerms} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.lg, padding: spacing.md, backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.primary },
  group: { gap: spacing.sm },
  requirement: { flexDirection: 'row', gap: spacing.md },
  id: { minWidth: 32, color: colors.primary },
  text: { flex: 1 },
  term: { gap: 0 },
});
