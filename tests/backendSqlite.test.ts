import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateAsync } from '@/database/migrate';
import { AgreementRepository } from '@/database/repositories/agreementRepository';
import { ProjectRepository } from '@/database/repositories/projectRepository';
import { ProposalRepository } from '@/database/repositories/proposalRepository';
import { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import { SettingsRepository } from '@/database/repositories/settingsRepository';
import { seedDemoDataAsync } from '@/database/seed';
import type { LLMEngine } from '@/llm/contracts';
import { createBackendAi } from '@/services/backend/backendAi';
import { createBackendData } from '@/services/backend/backendData';
import type { BackendPorts } from '@/services/backend/ports';
import { BriefCraftService } from '@/services/briefCraftService';
import { KasunduanVaultService } from '@/services/kasunduanVaultService';
import { createWorkflows } from '@/services/workflows';
import { validateFindings } from '@/safety/validateFindings';

// Runs the real migrations, repositories and services on Node's built-in SQLite, through
// a small stand-in for the expo-sqlite calls they use. Skipped where Node has no SQLite.
type NodeSqlite = { DatabaseSync: new (path: string) => {
  exec(sql: string): void;
  prepare(sql: string): { run(...p: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint }; get(...p: unknown[]): unknown; all(...p: unknown[]): unknown[] };
} };
const nodeSqlite = (() => {
  try {
    return (process as unknown as { getBuiltinModule?: (id: string) => NodeSqlite | undefined }).getBuiltinModule?.('node:sqlite');
  } catch {
    return undefined;
  }
})();

function openDatabase(): SQLiteDatabase {
  const db = new nodeSqlite!.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const shim = {
    async execAsync(sql: string) { db.exec(sql); },
    async runAsync(sql: string, params: unknown[] = []) { const r = db.prepare(sql).run(...params); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; },
    async getFirstAsync(sql: string, params: unknown[] = []) { return db.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...params); },
    async withTransactionAsync(task: () => Promise<void>) {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return shim as unknown as SQLiteDatabase;
}

async function realBackend(engine: LLMEngine) {
  const db = openDatabase();
  await migrateAsync(db);
  await seedDemoDataAsync(db);
  const agreements = new AgreementRepository(db);
  const ports: BackendPorts = {
    projects: new ProjectRepository(db),
    agreements,
    scopeGuard: new ScopeGuardRepository(db),
    proposals: new ProposalRepository(db),
    settings: new SettingsRepository(db),
    vault: new KasunduanVaultService(agreements),
    briefCraft: new BriefCraftService(engine),
    engine,
  };
  return { data: createBackendData(async () => ports), ai: createBackendAi(async () => ports), ports };
}

const engine = (output: string): LLMEngine => ({ isAvailable: async () => true, generate: async () => output });
const never = new AbortController().signal;

(nodeSqlite ? describe : describe.skip)('the screens on the real SQLite schema', () => {
  test('the seeded demo project opens as a confirmed agreement with usable history', async () => {
    const { data } = await realBackend(engine('{}'));
    const [project] = await data.listProjects();
    expect(project).toMatchObject({ scopeStatus: 'confirmed', agreementVersion: 1 });

    const agreement = await data.getAgreement(project.id);
    expect(agreement?.requirements.map(r => r.id)).toEqual(expect.arrayContaining(['REQ-01', 'REQ-02', 'REQ-03']));

    const [analysis] = await data.listAnalyses(project.id);
    expect(analysis).toMatchObject({ projectId: project.id, agreementId: agreement!.id, agreementVersion: 1 });
    // The stored evidence resolves against the stored agreement, so the screen can show it.
    expect(() => validateFindings(analysis.findings, agreement!)).not.toThrow();

    const [proposal] = await data.listProposals(project.id);
    expect(await data.getProposal(project.id, proposal.id)).toMatchObject({ analysisId: analysis.id, status: 'draft' });
  });

  test('the whole flow persists: project, draft, Agreement v1, analysis, proposal', async () => {
    const analysisJson = JSON.stringify({
      overall_classification: 'potential_additional', summary: 'One extra.',
      findings: [
        { item: 'Contact form copy', classification: 'included', explanation: 'Covered.', evidence_requirement_ids: ['REQ-02'] },
        { item: 'Appointment booking', classification: 'potential_additional', explanation: 'Not recorded.', evidence_requirement_ids: [] },
      ],
      clarification_questions: ['Does booking need payments?'],
    });
    const { data, ai } = await realBackend(engine(analysisJson));
    const workflows = createWorkflows(data, ai);

    const project = await data.createProject('Studio North website');
    const draft = {
      projectId: project.id, sourceText: 'Client: five pages and a contact form.', origin: 'manual' as const,
      deliverables: [{ key: 'a', text: 'Five responsive website pages' }, { key: 'b', text: 'Contact form' }],
      exclusions: [{ key: 'c', text: 'Hosting' }],
      terms: { budgetAmount: 15000, currency: 'PHP', timeline: 'Two weeks', revisionTerms: 'Two revision rounds' },
      missingInformation: [], updatedAt: new Date().toISOString(),
    };
    await data.saveDraft(draft);
    expect(await data.getProject(project.id)).toMatchObject({ scopeStatus: 'draft' });
    expect((await data.getDraft(project.id))?.terms).toEqual(draft.terms);

    const agreement = await workflows.confirmDraft(project.id, draft);
    expect(agreement.requirements).toEqual([
      { id: 'REQ-01', kind: 'deliverable', text: 'Five responsive website pages' },
      { id: 'REQ-02', kind: 'deliverable', text: 'Contact form' },
      { id: 'REQ-03', kind: 'term', text: 'Revision allowances: Two revision rounds' },
      { id: 'EXC-01', kind: 'exclusion', text: 'Hosting' },
    ]);
    expect(agreement.terms).toEqual(draft.terms);
    expect(await data.getAgreement(project.id)).toEqual(agreement);
    expect(await data.getDraft(project.id)).toBeNull();
    await expect(workflows.confirmDraft(project.id, draft)).rejects.toMatchObject({ code: 'save_failed' });

    const candidate = await workflows.analyzeRequest(project.id, 'Tweak the form copy and add booking', never);
    const analysis = await data.saveAnalysis(candidate);
    expect(await data.getAnalysis(project.id, analysis.id)).toEqual(analysis);
    expect(analysis.findings[1].clarificationQuestions).toEqual(['Does booking need payments?']);

    const proposal = await workflows.startProposal(project.id, analysis.id, [analysis.findings[1].id]);
    expect(proposal).toMatchObject({ deliverables: ['Appointment booking'], feeAmount: null, extraWorkingDays: null, message: '' });
    await data.saveProposal({ ...proposal, deliverables: ['Appointment booking calendar'], feeAmount: 7000, extraWorkingDays: 5, message: 'Hello' });
    expect(await data.getProposal(project.id, proposal.id)).toMatchObject({
      deliverables: ['Appointment booking calendar'], feeAmount: 7000, extraWorkingDays: 5, message: 'Hello', status: 'draft',
    });

    // Saving a proposal never changes the agreement, and the new project sorts first.
    expect(await data.getAgreement(project.id)).toEqual(agreement);
    expect((await data.listProjects())[0].id).toBe(project.id);
  });
});
