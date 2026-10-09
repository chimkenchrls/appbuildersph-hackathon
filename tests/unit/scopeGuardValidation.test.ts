import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  InvalidAIOutputError,
  InvalidEvidenceError,
  validateScopeGuardFindings,
  type RawScopeGuardFinding,
} from '../../src/safety/scopeGuardValidation.ts';

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

test('included request with a valid requirement ID is accepted', () => {
  const result = validateScopeGuardFindings([finding()], VALID_IDS);
  assert.equal(result.classification, 'included');
  assert.deepEqual(result.findings[0].evidenceRequirementIds, ['REQ-02']);
});

test('additional work with no cited requirement is accepted', () => {
  const result = validateScopeGuardFindings(
    [finding({ item: 'Appointment booking', classification: 'potential_additional', evidence_requirement_ids: [] })],
    VALID_IDS,
  );
  assert.equal(result.classification, 'potential_additional');
});

test('ambiguous request results in needs_clarification', () => {
  const result = validateScopeGuardFindings(
    [finding({ item: 'Make it more advanced', classification: 'needs_clarification', evidence_requirement_ids: [] })],
    VALID_IDS,
  );
  assert.equal(result.classification, 'needs_clarification');
});

test('mixed findings: any additional item makes the overall result potential_additional', () => {
  const result = validateScopeGuardFindings(
    [
      finding(),
      finding({ item: 'Customer accounts', classification: 'potential_additional', evidence_requirement_ids: [] }),
    ],
    VALID_IDS,
  );
  assert.equal(result.classification, 'potential_additional');
  assert.equal(result.findings.length, 2);
});

test('mixed findings: any ambiguous item takes precedence over additional', () => {
  const result = validateScopeGuardFindings(
    [
      finding({ classification: 'potential_additional', evidence_requirement_ids: [] }),
      finding({ classification: 'needs_clarification', evidence_requirement_ids: [] }),
    ],
    VALID_IDS,
  );
  assert.equal(result.classification, 'needs_clarification');
});

test('an invented requirement ID is rejected, not stripped', () => {
  assert.throws(
    () => validateScopeGuardFindings([finding({ evidence_requirement_ids: ['REQ-02', 'REQ-99'] })], VALID_IDS),
    (err: unknown) => err instanceof InvalidEvidenceError && err.code === 'INVALID_EVIDENCE' && err.message.includes('REQ-99'),
  );
});

test('an included finding without a supporting requirement is rejected', () => {
  assert.throws(
    () => validateScopeGuardFindings([finding({ evidence_requirement_ids: [] })], VALID_IDS),
    InvalidEvidenceError,
  );
});

test('duplicate evidence IDs within one finding are rejected', () => {
  assert.throws(
    () => validateScopeGuardFindings([finding({ evidence_requirement_ids: ['REQ-02', 'REQ-02'] })], VALID_IDS),
    InvalidEvidenceError,
  );
});

test('an empty findings list is rejected', () => {
  assert.throws(
    () => validateScopeGuardFindings([], VALID_IDS),
    (err: unknown) => err instanceof InvalidAIOutputError && err.code === 'INVALID_AI_OUTPUT',
  );
});
