import type { Agreement, Finding } from '@/types/workspace';
import { ServiceError } from '@/services/errors';
import { limits, textValue } from './validation';

export function validateFindings(value: unknown, agreement: Agreement): asserts value is Finding[] {
  try {
    if (!Array.isArray(value) || !value.length || value.length > limits.items) throw new Error();
    const ids = new Set<string>();
    const requirements = new Set(agreement.requirements.map(item => item.id));
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') throw new Error();
      textValue(entry.id, 96);
      if (ids.has(entry.id)) throw new Error();
      ids.add(entry.id);
      textValue(entry.requestedItem, limits.item);
      textValue(entry.explanation, limits.item);
      if (!['included', 'potential_additional', 'needs_clarification'].includes(entry.classification)) throw new Error();
      if (!Array.isArray(entry.evidenceRequirementIds) || entry.evidenceRequirementIds.length > limits.items || entry.evidenceRequirementIds.some((id: unknown) => typeof id !== 'string' || !requirements.has(id))) throw new Error();
      if (entry.classification === 'included' && !entry.evidenceRequirementIds.length) throw new Error();
      if (!Array.isArray(entry.clarificationQuestions) || entry.clarificationQuestions.length > limits.items) throw new Error();
      entry.clarificationQuestions.forEach((question: unknown) => textValue(question, limits.item));
    }
  } catch { throw new ServiceError('invalid_output'); }
}
