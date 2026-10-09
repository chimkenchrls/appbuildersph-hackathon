import { KasunduanVaultService } from '@/services/kasunduanVaultService';
import { BriefCraftService } from '@/services/briefCraftService';
import { LLMEngineUnavailableError, LLMGenerationTimeoutError, type LLMEngine } from '@/llm/contracts';
import { errorMessage } from '@/services/errors';
import { createBackendAi } from '@/services/backend/backendAi';
import { createBackendData } from '@/services/backend/backendData';
import { toBackendDraft, toWorkspaceAgreement, toWorkspaceFindings } from '@/services/backend/mappers';
import type { BackendPorts } from '@/services/backend/ports';
import { createWorkflows } from '@/services/workflows';
import type { Agreement, ChangeProposal, ClientRequest, Project, ScopeGuardAnalysis } from '@/types/domain';
import type { ScopeDraft } from '@/types/workspace';

/** In-memory stand-ins for the SQLite repositories; the backend services on top are real. */
function fakePorts(engine: LLMEngine) {
  const projects = new Map<string, Project>();
  const agreements = new Map<string, Agreement>();
  const requests = new Map<string, ClientRequest>();
  const analyses = new Map<string, ScopeGuardAnalysis>();
  const proposals = new Map<string, ChangeProposal>();
  const settings = new Map<string, string>();
  const now = () => new Date().toISOString();
  const agreementRepo = {
    async createInitial(a: Agreement) {
      if ([...agreements.values()].some(existing => existing.projectId === a.projectId)) throw new Error('Already confirmed');
      agreements.set(a.id, a); return a;
    },
    async create(a: Agreement) { agreements.set(a.id, a); return a; },
    async getById(id: string) { return agreements.get(id) ?? null; },
    async getLatestByProjectId(projectId: string) {
      return [...agreements.values()].filter(a => a.projectId === projectId).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
    },
    async listByProjectId(projectId: string) {
      return [...agreements.values()].filter(a => a.projectId === projectId).sort((a, b) => b.versionNumber - a.versionNumber);
    },
  };
  const ports: BackendPorts = {
    transaction: action => action(ports),
    projects: {
      async create(input) { const p = { id: input.id, title: input.title, clientName: null, description: null, createdAt: now(), updatedAt: now() }; projects.set(p.id, p); return p; },
      async list() { return [...projects.values()]; },
      async getById(id) { return projects.get(id) ?? null; },
      async update(id) { const p = projects.get(id); if (!p) return null; p.updatedAt = now(); return p; },
    },
    agreements: agreementRepo,
    scopeGuard: {
      async createRequest(r) { requests.set(r.id, r); return r; },
      async getRequestById(id) { return requests.get(id) ?? null; },
      async createAnalysis(a) { analyses.set(a.id, a); return a; },
      async getAnalysisById(id) { return analyses.get(id) ?? null; },
      async listAnalysesByProjectId(projectId) { return [...analyses.values()].filter(a => requests.get(a.requestId)?.projectId === projectId); },
    },
    proposals: {
      async create(p) { proposals.set(p.id, p); return p; },
      async getById(id) { return proposals.get(id) ?? null; },
      async listByProjectId(projectId) { return [...proposals.values()].filter(p => p.projectId === projectId); },
      async update(id, updates) {
        const existing = proposals.get(id);
        if (!existing) return null;
        const next = { ...existing, ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)), updatedAt: now() } as ChangeProposal;
        proposals.set(id, next);
        return next;
      },
    },
    settings: {
      async get(key, fallback = null) { return settings.get(key) ?? fallback; },
      async set(key, value) { settings.set(key, value); },
    },
    vault: new KasunduanVaultService(agreementRepo as never),
    briefCraft: new BriefCraftService(engine),
    engine,
  };
  return { ports, stores: { agreements, analyses, requests, proposals, settings } };
}

const engineReturning = (output: string | (() => Promise<string>)): LLMEngine => ({
  isAvailable: async () => true,
  generate: typeof output === 'string' ? async () => output : output,
});

function manualDraft(projectId: string): ScopeDraft {
  return {
    projectId, sourceText: '', origin: 'manual',
    deliverables: [{ key: 'a', text: 'Five responsive website pages' }, { key: 'b', text: 'Contact form' }],
    exclusions: [{ key: 'c', text: 'Hosting and ongoing maintenance' }],
    terms: { budgetAmount: 15000, currency: 'PHP', timeline: 'Two weeks', revisionTerms: 'Two revision rounds' },
    missingInformation: [], updatedAt: new Date().toISOString(),
  };
}

const never = new AbortController().signal;

describe('mapping between the screens and the backend records', () => {
  test('a reviewed draft becomes backend requirements with REQ ids, without inventing tax or dates', () => {
    const draft = toBackendDraft('Studio North website', manualDraft('p1'));
    expect(draft.requirements).toEqual([
      { id: 'REQ-01', title: 'Five responsive website pages', description: '', category: 'deliverable' },
      { id: 'REQ-02', title: 'Contact form', description: '', category: 'deliverable' },
      { id: 'REQ-03', title: 'Revision allowances', description: 'Two revision rounds', category: 'term' },
    ]);
    expect(draft).toMatchObject({
      title: 'Studio North website', budgetAmount: 15000, budgetCurrency: 'PHP', timelineNotes: 'Two weeks',
      durationDays: null, deadline: null, exclusions: ['Hosting and ongoing maintenance'], taxTreatment: 'none_specified',
    });
  });

  test('a backend agreement keeps its requirement ids and gives exclusions display ids', () => {
    const agreement = toWorkspaceAgreement({
      id: 'agmt_1', projectId: 'p1', versionNumber: 1, title: 'Website v1',
      requirements: [
        { id: 'REQ-01', title: 'Five pages', description: 'Home, About, Services, Work, Contact', category: 'deliverable' },
        { id: 'REQ-02', title: 'Revision allowances', description: 'Two rounds', category: 'term' },
      ],
      budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
      revisionTerms: 'Two rounds', exclusions: ['Hosting'], missingInformation: [], confirmedAt: '2026-10-09T00:00:00.000Z',
    });
    expect(agreement.requirements).toEqual([
      { id: 'REQ-01', kind: 'deliverable', text: 'Five pages: Home, About, Services, Work, Contact' },
      { id: 'REQ-02', kind: 'term', text: 'Revision allowances: Two rounds' },
      { id: 'EXC-01', kind: 'exclusion', text: 'Hosting' },
    ]);
    expect(agreement).toMatchObject({ version: 1, terms: { budgetAmount: null, currency: 'PHP', timeline: '14 days', revisionTerms: 'Two rounds' } });
  });

  test('analysis-level questions attach to the first finding that is not included', () => {
    const findings = toWorkspaceFindings([
      { item: 'Copy tweak', classification: 'included', explanation: 'Covered.', evidenceRequirementIds: ['REQ-01'] },
      { item: 'Booking', classification: 'potential_additional', explanation: 'Not recorded.', evidenceRequirementIds: [] },
    ], ['Does booking need payments?']);
    expect(findings.map(f => f.id)).toEqual(['F1', 'F2']);
    expect(findings[0].clarificationQuestions).toEqual([]);
    expect(findings[1]).toMatchObject({ requestedItem: 'Booking', clarificationQuestions: ['Does booking need payments?'] });
  });
});

describe('data routed through the backend', () => {
  test('a project moves from no scope to draft to one fixed agreement', async () => {
    const { ports, stores } = fakePorts(engineReturning('{}'));
    const data = createBackendData(async () => ports);
    const project = await data.createProject('  Studio North website ');
    expect(project).toMatchObject({ name: 'Studio North website', scopeStatus: 'none', agreementVersion: null });

    await data.saveDraft(manualDraft(project.id));
    expect((await data.getProject(project.id))?.scopeStatus).toBe('draft');
    expect((await data.getDraft(project.id))?.deliverables.map(d => d.text)).toEqual(['Five responsive website pages', 'Contact form']);

    const agreement = await data.confirmScope(project.id, manualDraft(project.id));
    expect(agreement.version).toBe(1);
    expect(agreement.requirements.map(r => r.id)).toEqual(['REQ-01', 'REQ-02', 'REQ-03', 'EXC-01']);
    expect(await data.getProject(project.id)).toMatchObject({ scopeStatus: 'confirmed', agreementVersion: 1 });
    expect(await data.getDraft(project.id)).toBeNull();

    // Agreement v1 is fixed: no second confirmation and no draft over it.
    await expect(data.confirmScope(project.id, manualDraft(project.id))).rejects.toMatchObject({ code: 'save_failed' });
    await expect(data.saveDraft(manualDraft(project.id))).rejects.toMatchObject({ code: 'save_failed' });
    expect(stores.agreements.size).toBe(1);
  });

  test('analyses and proposals are stored through the repositories and scoped to their project', async () => {
    const { ports, stores } = fakePorts(engineReturning('{}'));
    const data = createBackendData(async () => ports);
    const project = await data.createProject('Scoped records');
    const other = await data.createProject('Another project');
    const agreement = await data.confirmScope(project.id, manualDraft(project.id));

    const analysis = await data.saveAnalysis({
      projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'Add booking and tweak the form copy',
      findings: [
        { id: 'F1', requestedItem: 'Form copy', classification: 'included', explanation: 'Covered.', evidenceRequirementIds: ['REQ-02'], clarificationQuestions: [] },
        { id: 'F2', requestedItem: 'Booking', classification: 'potential_additional', explanation: 'Not recorded.', evidenceRequirementIds: [], clarificationQuestions: ['Payments too?'] },
      ],
    });
    const stored = [...stores.analyses.values()][0];
    expect(stored).toMatchObject({ classification: 'potential_additional', clarificationQuestions: ['Payments too?'] });
    expect([...stores.requests.values()][0].rawText).toBe('Add booking and tweak the form copy');

    expect(await data.getAnalysis(project.id, analysis.id)).toMatchObject({
      requestText: 'Add booking and tweak the form copy', agreementId: agreement.id, agreementVersion: 1,
    });
    expect((await data.getAnalysis(project.id, analysis.id))?.findings[1].clarificationQuestions).toEqual(['Payments too?']);
    expect(await data.getAnalysis(other.id, analysis.id)).toBeNull();
    expect(await data.listAnalyses(project.id)).toHaveLength(1);

    // Evidence must resolve to a requirement of the agreement it was analyzed against.
    await expect(data.saveAnalysis({
      projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'x',
      findings: [{ id: 'F1', requestedItem: 'x', classification: 'included', explanation: 'x', evidenceRequirementIds: ['REQ-99'], clarificationQuestions: [] }],
    })).rejects.toMatchObject({ code: 'invalid_output' });

    const proposal = await data.createProposal(project.id, analysis.id, ['Booking']);
    expect(proposal).toMatchObject({ deliverables: ['Booking'], feeAmount: null, extraWorkingDays: null, message: '', status: 'draft', currency: 'PHP' });
    const saved = await data.saveProposal({ ...proposal, deliverables: ['Booking calendar'], feeAmount: 7000, message: 'Hello' });
    expect(saved).toMatchObject({ deliverables: ['Booking calendar'], feeAmount: 7000, extraWorkingDays: null, message: 'Hello' });
    expect([...stores.proposals.values()][0]).toMatchObject({ selectedItems: ['Booking calendar'], freelancerFeeEstimate: 7000, freelancerDaysEstimate: null, draftMessage: 'Hello', status: 'draft' });
    expect(await data.getProposal(other.id, proposal.id)).toBeNull();
    expect(await data.getAgreement(project.id)).toEqual(agreement);
  });
});

describe('AI routed through the backend engine', () => {
  const analysisJson = (ids: string[]) => JSON.stringify({
    overall_classification: 'potential_additional', summary: 'One extra.',
    findings: [
      { item: 'Form copy', classification: 'included', explanation: 'Covered.', evidence_requirement_ids: ids },
      { item: 'Booking', classification: 'potential_additional', explanation: 'Not recorded.', evidence_requirement_ids: [] },
    ],
    clarification_questions: ['Payments too?'],
  });

  async function confirmed(engine: LLMEngine) {
    const { ports } = fakePorts(engine);
    const data = createBackendData(async () => ports);
    const ai = createBackendAi(async () => ports);
    const project = await data.createProject('AI routing');
    const agreement = await data.confirmScope(project.id, manualDraft(project.id));
    return { data, ai, project, agreement };
  }

  test('status reports preparing, then ready or unavailable from the engine', async () => {
    const up = createBackendAi(async () => fakePorts(engineReturning('{}')).ports);
    expect(up.getStatus()).toBe('loading');
    const off = up.subscribe(() => {});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(up.getStatus()).toBe('ready');
    off();

    const down = createBackendAi(async () => fakePorts({ isAvailable: async () => false, generate: async () => '' }).ports);
    const offDown = down.subscribe(() => {});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(down.getStatus()).toBe('unavailable');
    offDown();
  });

  test('a valid analysis becomes findings the workflow accepts', async () => {
    const { data, ai, project } = await confirmed(engineReturning('```json\n' + analysisJson(['REQ-02']) + '\n```'));
    const result = await createWorkflows(data, ai).analyzeRequest(project.id, 'Tweak the form copy and add booking', never);
    expect(result.findings.map(f => [f.requestedItem, f.classification, f.evidenceRequirementIds])).toEqual([
      ['Form copy', 'included', ['REQ-02']], ['Booking', 'potential_additional', []],
    ]);
  });

  test('evidence citing an unknown requirement is a failed result, not a filtered one', async () => {
    const { data, ai, project } = await confirmed(engineReturning(analysisJson(['REQ-77'])));
    await expect(createWorkflows(data, ai).analyzeRequest(project.id, 'Tweak the form copy', never)).rejects.toMatchObject({ code: 'invalid_output' });
    expect(await data.listAnalyses(project.id)).toHaveLength(0);
  });

  test('engine failures map to the states the screens already handle', async () => {
    const unreachable = await confirmed({ isAvailable: async () => true, generate: async () => { throw new LLMEngineUnavailableError(); } });
    await expect(unreachable.ai.analyzeRequest(unreachable.agreement, 'x', never)).rejects.toMatchObject({ code: 'model_unavailable' });
    expect(unreachable.ai.getStatus()).toBe('unavailable');

    const garbled = await confirmed(engineReturning('Sure! Here is my answer.'));
    await expect(garbled.ai.analyzeRequest(garbled.agreement, 'x', never)).rejects.toMatchObject({ code: 'invalid_output' });
    await expect(garbled.ai.extractScope('Client: five pages', never)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  test('a generation timeout offers timeout feedback without marking a reachable model unavailable', async () => {
    const { ai, agreement } = await confirmed({
      isAvailable: async () => true,
      generate: async () => { throw new LLMGenerationTimeoutError(); },
    });
    const unsubscribe = ai.subscribe(() => {});
    try {
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(ai.getStatus()).toBe('ready');
      const failure = await ai.analyzeRequest(agreement, 'Keep this request', never).catch(error => error);
      expect(failure).toMatchObject({ code: 'generation_timeout' });
      expect(errorMessage(failure)).toMatch(/too long|timed out/i);
      expect(ai.getStatus()).toBe('ready');
    } finally { unsubscribe(); }
  });

  test('extraction and message drafting return plain values without saving anything', async () => {
    const brief = JSON.stringify({
      title: 'Website', deliverables: [{ title: 'Five pages', description: 'Responsive' }],
      budget: { amount: 15000, currency: 'php', notes: null }, timeline: { duration_days: 14, deadline: null, notes: null },
      revision_terms: 'Two rounds', exclusions: ['Hosting'], missing_information: ['Start date'],
    });
    const { ports, stores } = fakePorts(engineReturning(brief));
    const ai = createBackendAi(async () => ports);
    expect(await ai.extractScope('Client: five pages', never)).toEqual({
      deliverables: ['Five pages: Responsive'], exclusions: ['Hosting'],
      terms: { budgetAmount: 15000, currency: 'PHP', timeline: '14 days', revisionTerms: 'Two rounds' }, missingInformation: ['Start date'],
    });
    expect(stores.settings.size).toBe(0);

    const drafting = await confirmed(engineReturning('{"draft_message":"Hello, here is my proposal."}'));
    const message = await drafting.ai.draftProposalMessage({ agreement: drafting.agreement, requestText: 'x', deliverables: ['Booking'], feeAmount: 7000, currency: 'PHP', extraWorkingDays: 5 }, never);
    expect(message.startsWith('Hello, here is my proposal.')).toBe(true);
    expect(message).toContain('- Booking');
    expect(message).toContain('Estimated additional fee: PHP 7,000');
    expect(message).toContain('Estimated additional time: 5 working days');
  });

  test('Stop rejects at once, and the engine stays busy until its request really ends', async () => {
    let finish!: (value: string) => void;
    const { ai, agreement } = await confirmed({ isAvailable: async () => true, generate: () => new Promise<string>(resolve => { finish = resolve; }) });
    const controller = new AbortController();
    const running = ai.analyzeRequest(agreement, 'x', controller.signal);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ai.getStatus()).toBe('busy');
    controller.abort();
    await expect(running).rejects.toMatchObject({ code: 'cancelled' });
    expect(ai.getStatus()).toBe('busy');
    await expect(ai.analyzeRequest(agreement, 'again', never)).rejects.toMatchObject({ code: 'model_unavailable' });
    finish('{}');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ai.getStatus()).not.toBe('busy');
  });
});

test('a mismatched stored request/agreement reports integrity failure', async () => {
  const { ports, stores } = fakePorts(engineReturning('{}'));
  const data = createBackendData(async () => ports);
  const project = await data.createProject('Broken links');
  const agreement = await data.confirmScope(project.id, manualDraft(project.id));
  const analysis = await data.saveAnalysis({ projectId: project.id, agreementId: agreement.id, agreementVersion: 1,
    requestText: 'Add booking', findings: [{ id: 'F1', requestedItem: 'Booking', classification: 'potential_additional', explanation: 'Extra', evidenceRequirementIds: [], clarificationQuestions: [] }] });
  const request = [...stores.requests.values()][0]; request.agreementId = 'different-agreement';
  await expect(data.getAnalysis(project.id, analysis.id)).rejects.toMatchObject({ code: 'data_integrity' });
});
