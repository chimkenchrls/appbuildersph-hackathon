import { ServiceError } from '@/services/errors';
import type { ScopeDraft, ScopeTerms } from '@/types/workspace';

export const limits = { name: 120, source: 30000, request: 8000, item: 2000, message: 12000, items: 80 } as const;

export function textValue(value: unknown, maximum: number, allowBlank = false): string {
  if (typeof value !== 'string' || value.length > maximum || (!allowBlank && !value.trim())) throw new ServiceError('invalid_input');
  return value.trim();
}
export function finiteEstimate(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000);
}
export function validateTerms(value: ScopeTerms): ScopeTerms {
  if (!value || !finiteEstimate(value.budgetAmount) || !/^[A-Z]{3}$/.test(value.currency)) throw new ServiceError('invalid_input');
  return {
    budgetAmount: value.budgetAmount, currency: value.currency,
    timeline: value.timeline === null ? null : textValue(value.timeline, limits.item, true) || null,
    revisionTerms: value.revisionTerms === null ? null : textValue(value.revisionTerms, limits.item, true) || null,
  };
}
export function cleanDraft(draft: ScopeDraft, confirm = false): ScopeDraft {
  if (!draft || !['manual', 'extracted'].includes(draft.origin)) throw new ServiceError('invalid_input');
  const clean = (items: ScopeDraft['deliverables']) => {
    if (!Array.isArray(items) || items.length > limits.items) throw new ServiceError('invalid_input');
    const keys = new Set<string>();
    return items.map(item => {
      const key = textValue(item.key, 96);
      if (keys.has(key)) throw new ServiceError('invalid_input');
      keys.add(key);
      return { key, text: textValue(item.text, limits.item, true) };
    }).filter(item => item.text);
  };
  const deliverables = clean(draft.deliverables);
  if (confirm && !deliverables.length) throw new ServiceError('invalid_input');
  if (!Array.isArray(draft.missingInformation) || draft.missingInformation.length > limits.items) throw new ServiceError('invalid_input');
  return { ...draft, sourceText: textValue(draft.sourceText, limits.source, true), deliverables, exclusions: clean(draft.exclusions), terms: validateTerms(draft.terms), missingInformation: draft.missingInformation.map(t => textValue(t, limits.item)) };
}
