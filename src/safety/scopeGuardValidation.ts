import type { Classification, Finding } from '@/types/domain';

export class InvalidAIOutputError extends Error {
  readonly code = 'INVALID_AI_OUTPUT';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidAIOutputError';
  }
}

export class InvalidEvidenceError extends Error {
  readonly code = 'INVALID_EVIDENCE';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidEvidenceError';
  }
}

export interface RawScopeGuardFinding {
  item: string;
  classification: Classification;
  explanation: string;
  evidence_requirement_ids?: string[];
}

export interface ValidatedScopeGuardResult {
  classification: Classification;
  findings: Finding[];
}

/** Overall result is derived from the findings; the model's own overall label is never trusted. */
export function computeOverallClassification(findings: { classification: Classification }[]): Classification {
  if (findings.some((f) => f.classification === 'needs_clarification')) {
    return 'needs_clarification';
  }
  if (findings.some((f) => f.classification === 'potential_additional')) {
    return 'potential_additional';
  }
  return 'included';
}

/**
 * Validates parsed ScopeGuard findings against the requirement IDs of the agreement
 * that was supplied to the model. Throws instead of repairing invalid output so that
 * a bad response is never saved as a successful analysis.
 */
export function validateScopeGuardFindings(
  rawFindings: RawScopeGuardFinding[],
  validRequirementIds: ReadonlySet<string>,
): ValidatedScopeGuardResult {
  if (rawFindings.length === 0) {
    throw new InvalidAIOutputError('Comparison returned no findings');
  }

  const findings: Finding[] = rawFindings.map((raw) => {
    const ids = raw.evidence_requirement_ids ?? [];

    const unknown = ids.filter((id) => !validRequirementIds.has(id));
    if (unknown.length > 0) {
      throw new InvalidEvidenceError(`Finding "${raw.item}" cites unknown requirement IDs: ${unknown.join(', ')}`);
    }

    if (new Set(ids).size !== ids.length) {
      throw new InvalidEvidenceError(`Finding "${raw.item}" cites the same requirement ID more than once`);
    }

    if (raw.classification === 'included' && ids.length === 0) {
      throw new InvalidEvidenceError(`Finding "${raw.item}" is marked included without a supporting requirement`);
    }

    return {
      item: raw.item,
      classification: raw.classification,
      explanation: raw.explanation,
      evidenceRequirementIds: ids,
    };
  });

  return { classification: computeOverallClassification(findings), findings };
}
