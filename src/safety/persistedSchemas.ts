import { z } from 'zod';
import { limits } from './validation';
import { ServiceError } from '@/services/errors';

const id = z.string().min(1).max(128);
const text = (max: number) => z.string().max(max);
const nonempty = (max: number) => text(max).refine(value => Boolean(value.trim()));
const date = z.iso.datetime();
const amount = z.number().finite().min(0).max(1e12).nullable();
const currency = z.string().regex(/^[A-Z]{3}$/);
const strings = z.array(nonempty(limits.item)).max(limits.items);
export const ClassificationSchema = z.enum(['included', 'potential_additional', 'needs_clarification']);
export const ProjectSchema = z.object({
  id, title: nonempty(limits.name), clientName: text(limits.item).nullable(), description: text(limits.source).nullable(),
  createdAt: date, updatedAt: date,
  draftScopeJson: z.string().max(200000).refine(value => {
    try { return PersistedDraftSchema.safeParse(JSON.parse(value)).success; } catch { return false; }
  }).nullable().optional(),
}).strict();
export const AgreementSchema = z.object({
  id, projectId: id, versionNumber: z.number().int().min(1).max(1e6), title: nonempty(limits.item),
  requirements: z.array(z.object({ id, title: nonempty(limits.item), description: text(limits.item),
    category: z.enum(['deliverable', 'term', 'exclusion']) }).strict()).min(1).max(limits.items + 1)
    .refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
  budgetAmount: amount, budgetCurrency: currency, budgetNotes: text(limits.item).nullable(),
  durationDays: amount, deadline: text(limits.item).nullable(), timelineNotes: text(limits.item).nullable(),
  revisionTerms: text(limits.item).nullable(), exclusions: strings, missingInformation: strings,
  taxTreatment: z.enum(['net_of_withholding', 'inclusive', 'subject_to_2307', 'none_specified']).default('net_of_withholding'),
  confirmedAt: date,
  // Recorded after confirmation; the agreement's terms above stay immutable.
  clientApprovedAt: date.nullable().optional(),
  clientSignatoryName: text(limits.item).nullable().optional(),
  clientSignatureData: z.string().max(2000000).nullable().optional(),
}).strict();
// Same field limits as confirmed agreements, while allowing an unfinished empty draft.
export const PersistedDraftSchema = AgreementSchema.omit({ id: true, projectId: true, versionNumber: true, confirmedAt: true, clientApprovedAt: true, clientSignatoryName: true, clientSignatureData: true }).extend({
  requirements: z.array(AgreementSchema.shape.requirements.element).max(limits.items + 1)
    .refine(rows => new Set(rows.map(row => row.id)).size === rows.length),
});
export const RequestSchema = z.object({ id, projectId: id, agreementId: id, rawText: nonempty(limits.request), createdAt: date,
  status: z.enum(['stored', 'analyzed', 'accepted']).optional(), acceptedAt: date.nullable().optional() }).strict();
export const AnalysisSchema = z.object({
  id, requestId: id, agreementId: id, classification: ClassificationSchema, summary: text(limits.message),
  findings: z.array(z.object({ item: nonempty(limits.item), classification: ClassificationSchema,
    explanation: nonempty(limits.item), evidenceRequirementIds: z.array(id).max(limits.items)
      .refine(ids => new Set(ids).size === ids.length) }).strict()).min(1).max(limits.items),
  clarificationQuestions: strings, createdAt: date,
}).strict();
export const ProposalSchema = z.object({
  id, projectId: id, analysisId: id, selectedItems: strings.min(1), freelancerFeeEstimate: amount,
  // Read old records without rounding them. New writes/imports impose whole days.
  freelancerDaysEstimate: amount, currency, draftMessage: text(limits.message),
  status: z.enum(['draft', 'copied', 'sent', 'accepted']), createdAt: date, updatedAt: date,
}).strict();

export function stored<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ServiceError('data_integrity');
  return parsed.data;
}

export function overallClassification(findings: { classification: z.infer<typeof ClassificationSchema> }[]): z.infer<typeof ClassificationSchema> {
  return findings.some(f => f.classification === 'needs_clarification') ? 'needs_clarification'
    : findings.some(f => f.classification === 'potential_additional') ? 'potential_additional' : 'included';
}

export function storedJson(value: string): unknown {
  try { return JSON.parse(value); } catch { throw new ServiceError('data_integrity'); }
}
