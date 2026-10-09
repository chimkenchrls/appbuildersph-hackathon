import {
  InvalidAIOutputError,
  InvalidEvidenceError,
  validateScopeGuardFindings,
  type RawScopeGuardFinding,
} from '@/safety/scopeGuardValidation';

const VALID_IDS = new Set(['REQ-01', 'REQ-02', 'REQ-03']);

function finding(overrides: Partial<RawScopeGuardFinding> = {}): RawScopeGuardFinding {
  return {
    item: 'Change contact form button text',
    classification: 'included',
    explanation: 'Covered by the contact form requirement.',
    evidence_requirement_ids: ['REQ-02'],
    ...overrides,
  };
}

describe('validateScopeGuardFindings', () => {
  it('accepts an included request with a valid requirement ID', () => {
    const result = validateScopeGuardFindings([finding()], VALID_IDS);
    expect(result.classification).toBe('included');
    expect(result.findings[0].evidenceRequirementIds).toEqual(['REQ-02']);
  });

  it('accepts additional work with no cited requirement', () => {
    const result = validateScopeGuardFindings(
      [finding({ item: 'Appointment booking', classification: 'potential_additional', evidence_requirement_ids: [] })],
      VALID_IDS,
    );
    expect(result.classification).toBe('potential_additional');
  });

  it('returns needs_clarification for an ambiguous request', () => {
    const result = validateScopeGuardFindings(
      [finding({ item: 'Make it more advanced', classification: 'needs_clarification', evidence_requirement_ids: [] })],
      VALID_IDS,
    );
    expect(result.classification).toBe('needs_clarification');
  });

  it('mixed findings: any additional item makes the overall result potential_additional', () => {
    const result = validateScopeGuardFindings(
      [
        finding(),
        finding({ item: 'Customer accounts', classification: 'potential_additional', evidence_requirement_ids: [] }),
      ],
      VALID_IDS,
    );
    expect(result.classification).toBe('potential_additional');
    expect(result.findings).toHaveLength(2);
  });

  it('mixed findings: any ambiguous item takes precedence over additional', () => {
    const result = validateScopeGuardFindings(
      [
        finding({ classification: 'potential_additional', evidence_requirement_ids: [] }),
        finding({ classification: 'needs_clarification', evidence_requirement_ids: [] }),
      ],
      VALID_IDS,
    );
    expect(result.classification).toBe('needs_clarification');
  });

  it('rejects an invented requirement ID instead of stripping it', () => {
    const run = () => validateScopeGuardFindings([finding({ evidence_requirement_ids: ['REQ-02', 'REQ-99'] })], VALID_IDS);
    expect(run).toThrow(InvalidEvidenceError);
    expect(run).toThrow(/REQ-99/);
  });

  it('rejects an included finding without a supporting requirement', () => {
    expect(() => validateScopeGuardFindings([finding({ evidence_requirement_ids: [] })], VALID_IDS)).toThrow(
      InvalidEvidenceError,
    );
  });

  it('rejects duplicate evidence IDs within one finding', () => {
    expect(() =>
      validateScopeGuardFindings([finding({ evidence_requirement_ids: ['REQ-02', 'REQ-02'] })], VALID_IDS),
    ).toThrow(InvalidEvidenceError);
  });

  it('rejects an empty findings list', () => {
    expect(() => validateScopeGuardFindings([], VALID_IDS)).toThrow(InvalidAIOutputError);
  });
});
