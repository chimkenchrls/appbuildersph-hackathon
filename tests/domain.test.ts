import { createFixtureData } from '@/services/fixtures/fixtureData';
import { setFixtureControls } from '@/services/fixtures/fixtureControls';
import { createWorkflows } from '@/services/workflows';
import { parseEstimate } from '@/safety/parseEstimate';
import { validateFindings } from '@/safety/validateFindings';
import type { SaklawAi } from '@/services/contracts';
import type { Agreement, Finding, ScopeDraft } from '@/types/workspace';

const draft = (projectId: string): ScopeDraft => ({
  projectId, sourceText: 'Five responsive pages and contact form.', origin: 'manual',
  deliverables: [{ key: 'd1', text: 'Five responsive pages' }, { key: 'd2', text: 'Contact form' }],
  exclusions: [{ key: 'e1', text: 'Hosting' }],
  terms: { budgetAmount: null, currency: 'PHP', timeline: null, revisionTerms: 'Two rounds' },
  missingInformation: [], updatedAt: '2026-10-09T00:00:00.000Z',
});
const finding: Finding = { id: 'f1', requestedItem: 'Accounts', classification: 'potential_additional', explanation: 'Not recorded.', evidenceRequirementIds: [], clarificationQuestions: [] };
const ai: SaklawAi = {
  getStatus: () => 'ready', subscribe: () => () => {},
  extractScope: async () => ({ deliverables: ['Five pages'], exclusions: [], terms: draft('').terms, missingInformation: ['Budget'] }),
  analyzeRequest: async () => [finding],
  draftProposalMessage: async input => `Proposed fee: ${input.currency} ${input.feeAmount}; ${input.extraWorkingDays} working days.`,
};
beforeEach(() => setFixtureControls({ unavailable: false, invalid: false, slow: false, saveFailure: false }));

async function setup() {
  const data = createFixtureData(false);
  const project = await data.createProject('Website');
  const scope = draft(project.id);
  const agreement = await data.confirmScope(project.id, scope);
  return { data, project, agreement, scope };
}

describe('estimate parsing', () => {
  test.each([['', null], ['  ', null], ['0', 0], ['7000.50', 7000.5], ['5', 5]])('%s has an explicit meaning', (input, expected) => {
    expect(parseEstimate(input)).toBe(expected);
  });
  test.each(['-1', 'Infinity', 'NaN', '1e5', '0x10', '1,000', '12abc', '9'.repeat(30)])('rejects malformed or unsafe %s', input => {
    expect(() => parseEstimate(input)).toThrow();
  });
});

describe('fixture storage invariants', () => {
  test('confirmation assigns stable IDs and cannot overwrite or mutate a snapshot', async () => {
    const { data, project, agreement, scope } = await setup();
    expect(agreement.requirements.map(item => item.id)).toEqual(['R1', 'R2', 'R3']);
    agreement.requirements[0].text = 'tampered';
    scope.deliverables[0].text = 'changed after confirmation';
    expect((await data.getAgreement(project.id))?.requirements[0].text).toBe('Five responsive pages');
    await expect(data.confirmScope(project.id, scope)).rejects.toThrow();
    await expect(data.saveDraft(scope)).rejects.toThrow();
    expect((await data.getProject(project.id))?.scopeStatus).toBe('confirmed');
  });
  test('invalid confirmation leaves the project unconfirmed', async () => {
    const data = createFixtureData(false);
    const p = await data.createProject('New');
    await expect(data.confirmScope(p.id, { ...draft(p.id), deliverables: [{ key: 'blank', text: ' ' }] })).rejects.toThrow();
    expect(await data.getAgreement(p.id)).toBeNull();
    expect((await data.getProject(p.id))?.scopeStatus).toBe('none');
  });
  test('scoped lookup and writes reject other projects and agreement versions', async () => {
    const { data, project, agreement } = await setup();
    const other = await data.createProject('Other');
    const input = { projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'Accounts', findings: [finding] };
    const analysis = await data.saveAnalysis(input);
    expect(await data.getAnalysis(other.id, analysis.id)).toBeNull();
    await expect(data.saveAnalysis({ ...input, projectId: other.id })).rejects.toThrow();
    await expect(data.saveAnalysis({ ...input, agreementVersion: 2 })).rejects.toThrow();
    await expect(data.createProposal(other.id, analysis.id, ['Accounts'])).rejects.toThrow();
    const proposal = await data.createProposal(project.id, analysis.id, ['Accounts']);
    expect(await data.getProposal(other.id, proposal.id)).toBeNull();
    await expect(data.saveProposal({ ...proposal, projectId: other.id })).rejects.toThrow();
    expect((await data.getProposal(project.id, proposal.id))?.projectId).toBe(project.id);
  });
  test('save failures are atomic and retry saves only one analysis', async () => {
    const { data, project, agreement } = await setup();
    const candidate = { projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'Accounts', findings: [finding] };
    setFixtureControls({ saveFailure: true });
    await expect(data.saveAnalysis(candidate)).rejects.toThrow();
    expect(await data.listAnalyses(project.id)).toHaveLength(0);
    setFixtureControls({ saveFailure: false });
    await data.saveAnalysis(candidate);
    expect(await data.listAnalyses(project.id)).toHaveLength(1);
  });
});

describe('validated workflow candidates', () => {
  test('extraction returns a candidate without replacing a saved edited draft', async () => {
    const data = createFixtureData(false);
    const p = await data.createProject('Draft');
    await data.saveDraft(draft(p.id));
    const candidate = await createWorkflows(data, ai).extractDraft(p.id, 'Sample messages', new AbortController().signal);
    expect(candidate.deliverables[0].text).toBe('Five pages');
    expect((await data.getDraft(p.id))?.deliverables[0].text).toBe('Five responsive pages');
  });
  test('analysis returns a version-bound candidate without writing', async () => {
    const { data, project, agreement } = await setup();
    const candidate = await createWorkflows(data, ai).analyzeRequest(project.id, 'Accounts', new AbortController().signal);
    expect(candidate).toMatchObject({ projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'Accounts' });
    expect(await data.listAnalyses(project.id)).toEqual([]);
  });
  test('invalid evidence and included-without-evidence cannot become findings', async () => {
    const { agreement } = await setup();
    expect(() => validateFindings([{ ...finding, evidenceRequirementIds: ['R99'] }], agreement)).toThrow();
    expect(() => validateFindings([{ ...finding, classification: 'included' }], agreement)).toThrow();
    expect(() => validateFindings([finding], agreement)).not.toThrow();
    expect(() => validateFindings([{ ...finding, classification: 'invented' }], agreement)).toThrow();
    expect(() => validateFindings([finding, finding], agreement)).toThrow();
  });
  test('proposal selection uses stored findings and generated text preserves entered estimates', async () => {
    const { data, project, agreement } = await setup();
    const analysis = await data.saveAnalysis({ projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'Accounts', findings: [finding] });
    const workflows = createWorkflows(data, ai);
    await expect(workflows.startProposal(project.id, analysis.id, ['unknown'])).rejects.toThrow();
    const proposal = await workflows.startProposal(project.id, analysis.id, ['f1']);
    const message = await workflows.generateMessage({ ...proposal, feeAmount: 7000, extraWorkingDays: 5 }, new AbortController().signal);
    expect(message).toContain('PHP 7000; 5 working days');
    expect((await data.getProposal(project.id, proposal.id))?.message).toBe('');
    expect(await data.getAgreement(project.id)).toEqual(agreement);
  });
  test('a late AI response after cancellation never returns a usable result', async () => {
    const { data, project } = await setup();
    const controller = new AbortController();
    const lateAi = { ...ai, analyzeRequest: async (_: Agreement, text: string) => { controller.abort(); return [finding]; } };
    await expect(createWorkflows(data, lateAi).analyzeRequest(project.id, 'Accounts', controller.signal)).rejects.toMatchObject({ code: 'cancelled' });
    expect(await data.listAnalyses(project.id)).toEqual([]);
  });
});
