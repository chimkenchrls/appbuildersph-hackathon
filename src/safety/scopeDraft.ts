import { z } from 'zod';
import { ServiceError } from '@/services/errors';
import { cleanDraft, limits } from './validation';

export const draftKey = (projectId: string) => `saklaw_scope_draft:${projectId}`;
const row = z.object({ key: z.string().min(1).max(96), text: z.string().max(limits.item) }).strict();
export const ScopeDraftSchema = z.object({
  projectId: z.string().min(1).max(128), sourceText: z.string().max(limits.source), origin: z.enum(['manual', 'extracted']),
  deliverables: z.array(row).max(limits.items), exclusions: z.array(row).max(limits.items),
  terms: z.object({ budgetAmount: z.number().finite().min(0).max(1e12).nullable(), currency: z.string().regex(/^[A-Z]{3}$/),
    timeline: z.string().max(limits.item).nullable(), revisionTerms: z.string().max(limits.item).nullable() }).strict(),
  missingInformation: z.array(z.string().min(1).max(limits.item)).max(limits.items), updatedAt: z.iso.datetime(),
}).strict();

export function parseStoredDraft(stored: string, projectId: string) {
  try {
    const draft = ScopeDraftSchema.parse(JSON.parse(stored));
    if (draft.projectId !== projectId) throw new Error('Draft ownership mismatch');
    return cleanDraft(draft);
  } catch {
    throw new ServiceError('data_integrity');
  }
}
