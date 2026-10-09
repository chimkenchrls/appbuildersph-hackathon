import { z } from 'zod';

export const RequirementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  category: z.enum(['deliverable', 'term', 'exclusion']),
});

export const ScopeDraftSchema = z.object({
  title: z.string().min(1),
  requirements: z.array(RequirementSchema),
  budgetAmount: z.number().nullable().default(null),
  budgetCurrency: z.string().default('PHP'),
  budgetNotes: z.string().nullable().default(null),
  durationDays: z.number().int().nonnegative().nullable().default(null),
  deadline: z.string().nullable().default(null),
  timelineNotes: z.string().nullable().default(null),
  revisionTerms: z.string().nullable().default(null),
  exclusions: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  taxTreatment: z
    .enum(['net_of_withholding', 'inclusive', 'subject_to_2307', 'none_specified'])
    .default('none_specified'),
  sourceConversation: z.string().optional(),
  extractedWithAi: z.boolean().optional(),
});

export const BriefCraftRawOutputSchema = z.object({
  title: z.string().min(1).default('Project Scope'),
  deliverables: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().default(''),
      }),
    )
    .default([]),
  budget: z
    .object({
      amount: z.coerce.number().nullable().default(null),
      currency: z.string().nullable().default('PHP'),
      notes: z.string().nullable().default(null),
    })
    .default({ amount: null, currency: 'PHP', notes: null }),
  timeline: z
    .object({
      duration_days: z.coerce.number().nullable().default(null),
      deadline: z.string().nullable().default(null),
      notes: z.string().nullable().default(null),
    })
    .default({ duration_days: null, deadline: null, notes: null }),
  revision_terms: z.string().nullable().default(null),
  exclusions: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  tax_treatment: z
    .string()
    .nullable()
    .default(null)
    .transform((val) => {
      if (!val) return null;
      const lower = val.toLowerCase();
      if (lower.includes('net')) return 'net_of_withholding';
      if (lower.includes('inclusive')) return 'inclusive';
      if (lower.includes('2307')) return 'subject_to_2307';
      if (lower.includes('none')) return 'none_specified';
      return null;
    }),
});

export const FindingSchema = z.object({
  item: z.string().min(1),
  classification: z.enum(['included', 'potential_additional', 'needs_clarification']),
  explanation: z.string().min(1),
  evidenceRequirementIds: z.array(z.string()).default([]),
});

export const ScopeGuardRawOutputSchema = z.object({
  overall_classification: z.enum(['included', 'potential_additional', 'needs_clarification']),
  summary: z.string().min(1),
  findings: z.array(
    z.object({
      item: z.string().min(1),
      classification: z.enum(['included', 'potential_additional', 'needs_clarification']),
      explanation: z.string().min(1),
      evidence_requirement_ids: z.array(z.string()).default([]),
    }),
  ),
  clarification_questions: z.array(z.string()).default([]),
});

export const ChangeDeskRawOutputSchema = z.object({
  draft_message: z.string().min(1),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  clientName: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateProjectInputSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  clientName: z.string().optional(),
  description: z.string().optional(),
});
