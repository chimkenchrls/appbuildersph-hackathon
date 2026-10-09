import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors, spacing, type } from '@/constants/theme';

/**
 * Simplified drawings of the app's screens for the landing page. They are concepts
 * with demo data, not captures of the shipped app, and the page labels them so.
 * Each is exposed to assistive technology as one described image.
 */
function ConceptPhone({ description, title, children }: { description: string; title: string; children: ReactNode }) {
  return (
    <View role="img" aria-label={description} style={styles.phone}>
      <View aria-hidden style={styles.inner}>
        <Text style={styles.screenTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

function Row({ id, text }: { id?: string; text: string }) {
  return (
    <View style={styles.row}>
      {id ? <Text style={styles.id}>{id}</Text> : null}
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.input}>
        <Text style={styles.rowText}>{value}</Text>
      </View>
    </View>
  );
}

function FakeButton({ label, secondary = false }: { label: string; secondary?: boolean }) {
  return (
    <View style={[styles.button, secondary ? styles.buttonSecondary : styles.buttonPrimary]}>
      <Text style={[styles.buttonLabel, { color: secondary ? colors.textPrimary : colors.onPrimary }]}>{label}</Text>
    </View>
  );
}

function Finding({ variant, text }: { variant: 'included' | 'potential_additional' | 'needs_clarification'; text: string }) {
  return (
    <View style={styles.finding}>
      <StatusBadge variant={variant} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

export function DraftConcept() {
  return (
    <ConceptPhone
      title="Café Amihan website"
      description="Concept mockup: a scope draft with editable deliverables, budget and timeline, marked as an AI suggestion, and a note that the start date is missing."
    >
      <View style={styles.badges}>
        <StatusBadge variant="draft" />
        <StatusBadge variant="ai" />
      </View>
      <Field label="Deliverable 1" value="Five responsive pages" />
      <Field label="Deliverable 2" value="Contact form" />
      <View style={styles.two}>
        <Field label="Budget" value="PHP 15,000" />
        <Field label="Timeline" value="Two weeks" />
      </View>
      <Text style={styles.note}>Missing: start date, payment schedule</Text>
      <FakeButton label="Confirm scope" />
    </ConceptPhone>
  );
}

export function AgreementConcept() {
  return (
    <ConceptPhone
      title="Café Amihan website"
      description="Concept mockup: Agreement version 1, confirmed and read-only, listing requirements R1 and R2 with the budget, timeline and revision terms."
    >
      <StatusBadge variant="confirmed" label="Agreement v1, confirmed" />
      <Row id="R1" text="Five responsive pages: Home, Menu, About, Gallery, Contact" />
      <Row id="R2" text="Contact form on the Contact page" />
      <Row text="PHP 15,000, two weeks, two revision rounds" />
      <Text style={styles.note}>Fixed snapshot. Client approval is not recorded.</Text>
      <FakeButton label="Analyze a new request" />
    </ConceptPhone>
  );
}

export function ScopeGuardConcept() {
  return (
    <ConceptPhone
      title="New request"
      description="Concept mockup: three findings for a new client request. Customer accounts is potential additional work, swapping the hero photo needs clarification, and the Menu page working on phones is included in the recorded scope."
    >
      <StatusBadge variant="ai" />
      <Finding variant="potential_additional" text="Customer accounts with login. Not found in R1 or R2." />
      <Finding variant="needs_clarification" text="Swap the hero photo. Is this a revision round?" />
      <Finding variant="included" text="Menu page works on phones. Covered by R1." />
      <FakeButton label="Start proposal" />
    </ConceptPhone>
  );
}

export function ProposalConcept() {
  return (
    <ConceptPhone
      title="Change proposal"
      description="Concept mockup: a draft change proposal with a fee of 7,000 pesos and five extra working days entered by the freelancer, an editable message, and Save draft and Copy text buttons."
    >
      <StatusBadge variant="draft" />
      <View style={styles.two}>
        <Field label="Fee" value="PHP 7,000" />
        <Field label="Extra days" value="5" />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Message to client</Text>
        <View style={[styles.input, styles.message]}>
          <Text style={styles.rowText}>
            Customer accounts are not part of what we recorded for the site, so I would treat them as additional work…
          </Text>
        </View>
      </View>
      <View style={styles.two}>
        <FakeButton label="Copy text" secondary />
        <FakeButton label="Save draft" />
      </View>
    </ConceptPhone>
  );
}

const small = { fontSize: 13, lineHeight: 18 } as const;

const styles = StyleSheet.create({
  phone: {
    width: 280,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: colors.controlBorder,
    backgroundColor: colors.background,
    padding: spacing.sm,
  },
  inner: { backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md },
  screenTitle: { ...type.subheading, fontSize: 16, lineHeight: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  id: { ...type.mono, ...small, color: colors.primary },
  rowText: { ...type.body, ...small, flex: 1 },
  field: { flex: 1, gap: spacing.xs },
  fieldLabel: { ...type.support, fontSize: 12, lineHeight: 16 },
  input: { borderWidth: 1, borderColor: colors.controlBorder, padding: spacing.sm },
  message: { minHeight: 72 },
  two: { flexDirection: 'row', gap: spacing.sm },
  note: { ...type.support, ...small },
  finding: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  button: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { borderWidth: 1, borderColor: colors.controlBorder },
  buttonLabel: { ...type.label, ...small },
});
