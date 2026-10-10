import { transaction } from '@/database/transaction';
import { repositories } from '@/database/repositories';
import * as initial from '@/database/migrations/001_initial';
import * as tax from '@/database/migrations/002_add_tax_treatment';
import * as integrity from '@/database/migrations/003_integrity_guards';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
import { ContractGeneratorService } from '@/services/contractGeneratorService';
import { createWorkflows } from '@/services/workflows';
import { validateFindings } from '@/safety/validateFindings';
import { getDatabaseAsync } from '@/database/client';
import { ScopeGuardService } from '@/services/scopeGuardService';
import { ExportService } from '@/services/exportService';
import { initializeBackendAsync } from '@/services/bootstrapService';

jest.mock('@/database/client', () => ({ getDatabaseAsync: jest.fn() }));

// Runs the real migrations, repositories and services on Node's built-in SQLite, through
// a small stand-in for the expo-sqlite calls they use. Skipped where Node has no SQLite.
type NodeSqlite = { DatabaseSync: new (path: string) => {
  close(): void;
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

function openDatabase(path = ':memory:', foreignKeys = true): SQLiteDatabase {
  const db = new nodeSqlite!.DatabaseSync(path);
  db.exec(foreignKeys ? 'PRAGMA foreign_keys = ON;' : 'PRAGMA foreign_keys = OFF;');
  const shim = {
    async closeAsync() { db.close(); },
    async execAsync(sql: string) { db.exec(sql); },
    async runAsync(sql: string, params: unknown[] = []) { const r = db.prepare(sql).run(...params); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; },
    async getFirstAsync(sql: string, params: unknown[] = []) { return db.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql: string, params: unknown[] = []) { return db.prepare(sql).all(...params); },
    async withExclusiveTransactionAsync(task: (tx: SQLiteDatabase) => Promise<void>) {
      if (path === ':memory:') await shim.withTransactionAsync(() => task(shim as unknown as SQLiteDatabase));
      else {
        // Match Expo: exclusive transactions get a new connection without inherited PRAGMAs.
        const tx = openDatabase(path, false);
        try { await tx.withTransactionAsync(() => task(tx)); } finally { await tx.closeAsync(); }
      }
    },
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
  function bind(db: SQLiteDatabase, inTransaction = false): BackendPorts {
    const repos = repositories(db, inTransaction);
    return {
    transaction: action => transaction(db, tx => action(bind(tx, true))),
    projects: new ProjectRepository(db),
    agreements: repos.agreement,
    scopeGuard: new ScopeGuardRepository(db),
    proposals: new ProposalRepository(db),
    settings: new SettingsRepository(db),
    vault: new KasunduanVaultService(repos.agreement),
    briefCraft: new BriefCraftService(engine),
    engine,
  };
  }
  const ports = bind(db);
  return { db, data: createBackendData(async () => ports), ai: createBackendAi(async () => ports), ports };
}

const engine = (output: string): LLMEngine => ({ isAvailable: async () => true, generate: async () => output });
const never = new AbortController().signal;

(nodeSqlite ? describe : describe.skip)('the screens on the real SQLite schema', () => {
  test('explicit development configuration overrides stale saved LM Studio settings without losing projects', async () => {
    const db = openDatabase();
    await migrateAsync(db);
    const projects = new ProjectRepository(db);
    await projects.create({ id: 'existing-project', title: 'Keep this project' });
    const settings = new SettingsRepository(db);
    await settings.set('lm_studio_url', 'http://old-computer:1234/v1');
    await settings.set('lm_studio_model', 'local-model');
    jest.mocked(getDatabaseAsync).mockResolvedValue(db);
    const originalUrl = process.env.EXPO_PUBLIC_LM_STUDIO_URL;
    const originalModel = process.env.EXPO_PUBLIC_LM_STUDIO_MODEL;
    process.env.EXPO_PUBLIC_LM_STUDIO_URL = 'http://configured-computer:1234/v1';
    process.env.EXPO_PUBLIC_LM_STUDIO_MODEL = 'qwen/qwen3.5-9b';
    const network = jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (url !== 'http://configured-computer:1234/v1/chat/completions' || body.model !== 'qwen/qwen3.5-9b') {
        return { ok: false, status: 400, text: async () => 'model_not_found' } as Response;
      }
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: 'Website', deliverables: [{ title: 'Contact form', description: '' }] }) } }] }) } as Response;
    });
    try {
      const [backend, concurrent] = await Promise.all([initializeBackendAsync(), initializeBackendAsync()]);
      expect(concurrent).toBe(backend);
      expect((await backend.services.briefCraft.extractBrief('Build a contact form.')).requirements).toEqual([
        { id: 'REQ-01', title: 'Contact form', description: 'Contact form', category: 'deliverable' },
      ]);
      expect((await projects.list()).map(project => project.id)).toEqual(['existing-project']);

      // Removing explicit overrides uses the existing saved settings again.
      delete process.env.EXPO_PUBLIC_LM_STUDIO_URL;
      delete process.env.EXPO_PUBLIC_LM_STUDIO_MODEL;
      network.mockImplementation(async (url, init) => {
        const body = JSON.parse(String(init?.body));
        if (url !== 'http://old-computer:1234/v1/chat/completions' || body.model !== 'local-model') throw new Error('Saved settings were not used');
        return { ok: true, json: async () => ({ choices: [{ message: { content: 'Saved settings used' } }] }) } as Response;
      });
      expect(await backend.llmEngine.generate([{ role: 'user', content: 'Test' }])).toBe('Saved settings used');
    } finally {
      network.mockRestore();
      if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_LM_STUDIO_URL; else process.env.EXPO_PUBLIC_LM_STUDIO_URL = originalUrl;
      if (originalModel === undefined) delete process.env.EXPO_PUBLIC_LM_STUDIO_MODEL; else process.env.EXPO_PUBLIC_LM_STUDIO_MODEL = originalModel;
    }
  });

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

const reviewedDraft = (projectId: string) => ({
  projectId, sourceText: 'Build a website.', origin: 'manual' as const,
  deliverables: [{ key: 'a', text: 'Website' }], exclusions: [],
  terms: { budgetAmount: 0, currency: 'PHP', timeline: null, revisionTerms: null },
  missingInformation: [], updatedAt: '2026-10-09T00:00:00.000Z',
});

(nodeSqlite ? describe : describe.skip)('storage failure recovery', () => {
  test('failed confirmation rolls back agreement and retains the saved draft for retry', async () => {
    const { db, data } = await realBackend(engine('{}'));
    const project = await data.createProject('Rollback');
    await data.saveDraft(reviewedDraft(project.id));
    const before = await data.getDraft(project.id);
    await db.execAsync(`CREATE TRIGGER fail_draft_clear BEFORE UPDATE ON app_settings
      WHEN NEW.value = '' BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    await expect(data.confirmScope(project.id, before!)).rejects.toMatchObject({ code: 'save_failed' });
    expect(await data.getAgreement(project.id)).toBeNull();
    expect(await data.getDraft(project.id)).toEqual(before);
    await db.execAsync('DROP TRIGGER fail_draft_clear;');
    expect(await data.confirmScope(project.id, before!)).toMatchObject({ version: 1 });
  });

  test('concurrent confirmations commit only Agreement v1', async () => {
    const { data, ports } = await realBackend(engine('{}'));
    const project = await data.createProject('Concurrent');
    const results = await Promise.allSettled([
      data.confirmScope(project.id, reviewedDraft(project.id)),
      data.confirmScope(project.id, reviewedDraft(project.id)),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await (ports.agreements as AgreementRepository).listByProjectId(project.id)).toHaveLength(1);
  });

  test('failed analysis rolls back its request and project timestamp', async () => {
    const { db, data, ports } = await realBackend(engine('{}'));
    const project = await data.createProject('Analysis rollback');
    const agreement = await data.confirmScope(project.id, reviewedDraft(project.id));
    const before = await data.getProject(project.id);
    await db.execAsync(`CREATE TRIGGER fail_analysis BEFORE INSERT ON scopeguard_analyses
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    await expect(data.saveAnalysis({ projectId: project.id, agreementId: agreement.id, agreementVersion: 1,
      requestText: 'Add booking', findings: [{ id: 'F1', requestedItem: 'Booking', classification: 'potential_additional', explanation: 'Extra', evidenceRequirementIds: [], clarificationQuestions: [] }]
    })).rejects.toMatchObject({ code: 'save_failed' });
    expect(await (ports.scopeGuard as ScopeGuardRepository).listRequestsByProjectId(project.id)).toEqual([]);
    expect(await data.getProject(project.id)).toEqual(before);
  });

  test('corrupt saved drafts report an integrity error without erasing data', async () => {
    const { data, ports } = await realBackend(engine('{}'));
    const project = await data.createProject('Corrupt draft');
    await ports.settings.set(`saklaw_scope_draft:${project.id}`, '{broken');
    await expect(data.getDraft(project.id)).rejects.toMatchObject({ code: 'data_integrity' });
    expect(await ports.settings.get(`saklaw_scope_draft:${project.id}`)).toBe('{broken');
  });

  test('malformed backups never leave a project behind', async () => {
    const { db, ports } = await realBackend(engine('{}'));
    const backup = new ExportService(db);
    await expect(backup.importProject(JSON.stringify({ project: {
      id: 'malformed-import', title: 'Broken', clientName: null, description: null,
      createdAt: '2026-10-09T00:00:00.000Z', updatedAt: '2026-10-09T00:00:00.000Z',
    }, agreements: [null], requests: [], analyses: [], proposals: [], exportedAt: '2026-10-09T00:00:00.000Z' }))).rejects.toThrow();
    expect(await ports.projects.getById('malformed-import')).toBeNull();
  });
});

(nodeSqlite ? describe : describe.skip)('portable project backups', () => {
  test('roundtrip preserves reviewed drafts and timestamps, and repeated import is idempotent', async () => {
    const source = await realBackend(engine('{}'));
    const project = await source.data.createProject('Draft backup');
    await source.data.saveDraft(reviewedDraft(project.id));
    const before = await source.data.getProject(project.id);
    const draft = await source.data.getDraft(project.id);
    const exported = await new ExportService(source.db).exportProject(project.id);
    expect(JSON.parse(exported)).toMatchObject({ formatVersion: 1, draft: { projectId: project.id } });
    const target = await realBackend(engine('{}'));
    const backups = new ExportService(target.db);
    await backups.importProject(exported);
    await backups.importProject(exported);
    expect(await target.data.getProject(project.id)).toEqual(before);
    expect(await target.data.getDraft(project.id)).toEqual(draft);
  });

  test('restores legacy unversioned complete backups and rejects changed records without overwriting', async () => {
    const source = await realBackend(engine('{}'));
    const exported = JSON.parse(await new ExportService(source.db).exportProject('proj_demo_website_01'));
    delete exported.formatVersion; delete exported.draft;
    const targetDb = openDatabase(); await migrateAsync(targetDb);
    const backups = new ExportService(targetDb);
    await backups.importProject(JSON.stringify(exported));
    expect(await new AgreementRepository(targetDb).getById('agmt_demo_v1_01')).toMatchObject({ budgetAmount: 15000 });
    expect(await new ProjectRepository(targetDb).getById(exported.project.id)).toEqual(exported.project);
    const changed = structuredClone(exported); changed.agreements[0].budgetAmount = 999;
    await expect(backups.importProject(JSON.stringify(changed))).rejects.toMatchObject({ code: 'conflict' });
    expect((await new AgreementRepository(targetDb).getById('agmt_demo_v1_01'))?.budgetAmount).toBe(15000);
  });

  test.each(['ownership', 'evidence', 'duplicate', 'version', 'fractional days'])('rejects invalid %s before any writes', async defect => {
    const source = await realBackend(engine('{}'));
    const payload = JSON.parse(await new ExportService(source.db).exportProject('proj_demo_website_01'));
    if (defect === 'ownership') payload.requests[0].projectId = 'other';
    if (defect === 'evidence') payload.analyses[0].findings[0].evidenceRequirementIds = ['INVENTED'];
    if (defect === 'duplicate') payload.agreements.push(payload.agreements[0]);
    if (defect === 'version') payload.formatVersion = 999;
    if (defect === 'fractional days') payload.proposals[0].freelancerDaysEstimate = 1.5;
    const targetDb = openDatabase(); await migrateAsync(targetDb);
    await expect(new ExportService(targetDb).importProject(JSON.stringify(payload))).rejects.toThrow();
    expect(await new ProjectRepository(targetDb).list()).toEqual([]);
  });

  test('late restore failure rolls back all records and succeeds on retry', async () => {
    const source = await realBackend(engine('{}'));
    const payload = await new ExportService(source.db).exportProject('proj_demo_website_01');
    const targetDb = openDatabase(); await migrateAsync(targetDb);
    await targetDb.execAsync(`CREATE TRIGGER fail_restore BEFORE INSERT ON change_proposals
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    await expect(new ExportService(targetDb).importProject(payload)).rejects.toThrow();
    expect(await new ProjectRepository(targetDb).list()).toEqual([]);
    expect(await new AgreementRepository(targetDb).listByProjectId('proj_demo_website_01')).toEqual([]);
    await targetDb.execAsync('DROP TRIGGER fail_restore;');
    await new ExportService(targetDb).importProject(payload);
    expect(await new ProposalRepository(targetDb).getById('prop_demo_proposal_01')).not.toBeNull();
  });
});

(nodeSqlite ? describe : describe.skip)('database integrity guards', () => {
  test.each(['agreement update', 'requirement update', 'request project', 'analysis agreement', 'proposal project', 'fractional days'])('rejects %s in SQL', async violation => {
    const { db, data } = await realBackend(engine('{}'));
    const other = await data.createProject('Other');
    const otherAgreement = await data.confirmScope(other.id, reviewedDraft(other.id));
    const statements: Record<string, [string, unknown[]]> = {
      'agreement update': ["UPDATE agreements SET title = 'changed' WHERE id = ?", ['agmt_demo_v1_01']],
      'requirement update': ["UPDATE requirements SET title = 'changed' WHERE agreement_id = ?", ['agmt_demo_v1_01']],
      'request project': ['UPDATE client_requests SET project_id = ? WHERE id = ?', [other.id, 'req_demo_request_01']],
      'analysis agreement': ['UPDATE scopeguard_analyses SET agreement_id = ? WHERE id = ?', [otherAgreement.id, 'ana_demo_analysis_01']],
      'proposal project': ['UPDATE change_proposals SET project_id = ? WHERE id = ?', [other.id, 'prop_demo_proposal_01']],
      'fractional days': ['UPDATE change_proposals SET freelancer_days_estimate = ? WHERE id = ?', [1.5, 'prop_demo_proposal_01']],
    };
    const [sql, params] = statements[violation];
    await expect(db.runAsync(sql, params as never)).rejects.toThrow();
  });

  test('client approval, request status and deletion are allowed while terms stay immutable', async () => {
    const { db } = await realBackend(engine('{}'));
    const agreements = new AgreementRepository(db);
    await agreements.recordClientApproval('agmt_demo_v1_01', 'Sarah');
    expect(await agreements.getById('agmt_demo_v1_01')).toMatchObject({ clientSignatoryName: 'Sarah', title: 'Website Design and Build Agreement v1' });
    await expect(db.runAsync("UPDATE agreements SET budget_amount = 1 WHERE id = ?", ['agmt_demo_v1_01'])).rejects.toThrow();

    const requests = new ScopeGuardRepository(db);
    await requests.updateRequestStatus('req_demo_request_01', 'accepted', '2026-10-10T00:00:00.000Z');
    expect(await requests.getRequestById('req_demo_request_01')).toMatchObject({ status: 'accepted', acceptedAt: '2026-10-10T00:00:00.000Z' });
    await expect(db.runAsync("UPDATE client_requests SET raw_text = 'changed' WHERE id = ?", ['req_demo_request_01'])).rejects.toThrow();
    await expect(db.runAsync("UPDATE scopeguard_analyses SET summary = 'changed' WHERE id = ?", ['ana_demo_analysis_01'])).rejects.toThrow();

    // The Settings reset clears and reseeds in one step.
    expect(await seedDemoDataAsync(db, true)).toBe(true);
    expect((await new ProjectRepository(db).list()).map(project => project.id)).toEqual(['proj_demo_website_01']);
    expect((await agreements.getById('agmt_demo_v1_01'))?.clientSignatoryName ?? null).toBeNull();
  });

  test('new mixed findings store clarification as the aggregate classification', async () => {
    const { data, ports } = await realBackend(engine('{}'));
    const project = await data.createProject('Mixed');
    const agreement = await data.confirmScope(project.id, reviewedDraft(project.id));
    const analysis = await data.saveAnalysis({ projectId: project.id, agreementId: agreement.id, agreementVersion: 1,
      requestText: 'Add booking and change style', findings: [
        { id: 'F1', requestedItem: 'Booking', classification: 'potential_additional', explanation: 'Extra', evidenceRequirementIds: [], clarificationQuestions: [] },
        { id: 'F2', requestedItem: 'Style', classification: 'needs_clarification', explanation: 'Unclear', evidenceRequirementIds: [], clarificationQuestions: ['Which style?'] },
      ] });
    expect((await ports.scopeGuard.getAnalysisById(analysis.id))?.classification).toBe('needs_clarification');
  });

  test('malformed stored proposal JSON reports integrity failure', async () => {
    const { db, data } = await realBackend(engine('{}'));
    await db.runAsync("UPDATE change_proposals SET selected_items_json = 'null' WHERE id = ?", ['prop_demo_proposal_01']);
    await expect(data.getProposal('proj_demo_website_01', 'prop_demo_proposal_01')).rejects.toMatchObject({ code: 'data_integrity' });
  });

  test('seeding is atomic and retryable after a late failure', async () => {
    const db = openDatabase(); await migrateAsync(db);
    await db.execAsync(`CREATE TRIGGER fail_seed BEFORE INSERT ON change_proposals BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    await expect(seedDemoDataAsync(db)).rejects.toThrow();
    expect(await new ProjectRepository(db).list()).toEqual([]);
    await db.execAsync('DROP TRIGGER fail_seed;');
    expect(await seedDemoDataAsync(db)).toBe(true);
    expect(await seedDemoDataAsync(db)).toBe(false);
  });
});

(nodeSqlite ? describe : describe.skip)('database upgrade and reopen', () => {
  test('additive migration preserves legacy fractional values and is applied once', async () => {
    const source = await realBackend(engine('{}'));
    const payload = JSON.parse(await new ExportService(source.db).exportProject('proj_demo_website_01'));
    const db = openDatabase();
    await initial.up(db); await tax.up(db);
    await db.runAsync('INSERT INTO projects (id, title, client_name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.project.id, payload.project.title, payload.project.clientName, payload.project.description, payload.project.createdAt, payload.project.updatedAt]);
    // Legacy format has no sealed column. Restore raw agreement/requirements through its old schema.
    const a = payload.agreements[0];
    await db.runAsync(`INSERT INTO agreements (id, project_id, version_number, title, budget_amount, budget_currency,
      budget_notes, duration_days, deadline, timeline_notes, revision_terms, exclusions_json, missing_info_json, tax_treatment, confirmed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.projectId, 1, a.title, 15000.25, a.budgetCurrency, a.budgetNotes, a.durationDays, a.deadline, a.timelineNotes,
        a.revisionTerms, JSON.stringify(a.exclusions), JSON.stringify(a.missingInformation), a.taxTreatment, a.confirmedAt]);
    for (const r of a.requirements) await db.runAsync('INSERT INTO requirements VALUES (?, ?, ?, ?, ?)', [r.id, a.id, r.title, r.description, r.category]);
    // The legacy schema has no request status columns, so the request is written with its old shape.
    const q = payload.requests[0];
    await db.runAsync('INSERT INTO client_requests (id, project_id, agreement_id, raw_text, created_at) VALUES (?, ?, ?, ?, ?)',
      [q.id, q.projectId, q.agreementId, q.rawText, q.createdAt]);
    await new ScopeGuardRepository(db).createAnalysis(payload.analyses[0]);
    // A historical fractional day value must survive upgrading; new values must be whole days.
    await db.runAsync(`INSERT INTO change_proposals (id, project_id, analysis_id, selected_items_json,
      freelancer_fee_estimate, freelancer_days_estimate, currency, draft_message, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['legacy-proposal', a.projectId, payload.analyses[0].id,
        '["Booking"]', 7000.50, 1.5, 'PHP', 'Keep this', 'draft', a.confirmedAt, a.confirmedAt]);
    await db.execAsync(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations VALUES (1, '2026-10-09T00:00:00.000Z'), (2, '2026-10-09T00:00:00.000Z');`);
    await migrateAsync(db); await migrateAsync(db);
    expect((await new AgreementRepository(db).getById(a.id))?.budgetAmount).toBe(15000.25);
    expect(await new ProposalRepository(db).getById('legacy-proposal')).toMatchObject({ freelancerFeeEstimate: 7000.5, freelancerDaysEstimate: 1.5, draftMessage: 'Keep this' });
    expect(await db.getAllAsync('SELECT version FROM schema_migrations ORDER BY version')).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
  });

  test.each(['integrity', 'draft'])('upgrades the %s branch migration 3 without losing records', async branch => {
    const db = openDatabase();
    try {
      await initial.up(db); await tax.up(db);
      const timestamp = '2026-10-09T00:00:00.000Z';
      await db.runAsync('INSERT INTO projects (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', ['keep', 'Keep', timestamp, timestamp]);
      if (branch === 'integrity') await integrity.up(db);
      else await db.execAsync('ALTER TABLE projects ADD COLUMN draft_scope_json TEXT;');
      await db.execAsync(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
        INSERT INTO schema_migrations VALUES (1, '${timestamp}'), (2, '${timestamp}'), (3, '${timestamp}');`);
      await migrateAsync(db); await migrateAsync(db);
      expect(await new ProjectRepository(db).getById('keep')).toMatchObject({ title: 'Keep', createdAt: timestamp, updatedAt: timestamp });
      expect((await db.getAllAsync<{ name: string }>('PRAGMA table_info(projects)')).some(column => column.name === 'draft_scope_json')).toBe(true);
      expect((await db.getAllAsync<{ name: string }>('PRAGMA table_info(agreements)')).some(column => column.name === 'sealed')).toBe(true);
      expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'agreements_no_update'")).not.toBeNull();
      expect(await db.getAllAsync('SELECT version FROM schema_migrations ORDER BY version')).toEqual([{ version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 }]);
    } finally { await db.closeAsync(); }
  });

  test('staging drafts survive backup/restore and reject malformed or duplicate requirements', async () => {
    const source = await realBackend(engine('{}'));
    const target = openDatabase();
    try {
      const draft = { title: 'Manual', requirements: [{ id: 'R1', title: 'Website', description: '', category: 'deliverable' }],
        budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: null, deadline: null,
        timelineNotes: null, revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified' };
      const project = await source.ports.projects.create({ id: 'staging-draft', title: 'Manual' });
      const repo = new ProjectRepository(source.db);
      await repo.update(project.id, { draftScopeJson: JSON.stringify(draft) });
      await expect(repo.update(project.id, { draftScopeJson: '{broken' })).rejects.toThrow();
      await expect(repo.update(project.id, { draftScopeJson: JSON.stringify({ ...draft, requirements: [draft.requirements[0], draft.requirements[0]] }) })).rejects.toThrow();
      const backup = await new ExportService(source.db).exportProject(project.id);
      await migrateAsync(target);
      await new ExportService(target).importProject(backup);
      expect((await new ProjectRepository(target).getById(project.id))?.draftScopeJson).toBe(JSON.stringify(draft));
    } finally { await source.db.closeAsync(); await target.closeAsync(); }
  });

  test.each([true, false])('extracted drafts persist and restore with AI provenance %s', async extractedWithAi => {
    const source = await realBackend(engine(JSON.stringify({
      title: 'Kape Luna Website', deliverables: [{ title: 'One-page café website', description: 'Menu, hours, location and Messenger link' }],
      budget: { amount: 18000, currency: 'PHP' }, timeline: { duration_days: 14 }, revision_terms: 'Two rounds of revisions',
      exclusions: ['Online ordering', 'Payments'],
    })));
    const target = openDatabase();
    try {
      await migrateAsync(target);
      const conversation = 'Build a café website for ₱18,000 within 14 days. Include two rounds of revisions.';
      const draft = extractedWithAi ? await source.ports.briefCraft.extractBrief(conversation)
        : new BriefCraftService(engine('{}')).extractBriefHeuristic(conversation, 'Kape Luna Website');
      expect(draft).toMatchObject({ sourceConversation: conversation, extractedWithAi });
      const repo = new ProjectRepository(source.db);
      const project = await repo.create({ id: 'extracted-draft', title: draft.title, draftScopeJson: JSON.stringify(draft) });
      expect(JSON.parse((await repo.getById(project.id))!.draftScopeJson!)).toEqual(draft);
      const edited = { ...draft, budgetAmount: 20000 };
      await repo.update(project.id, { draftScopeJson: JSON.stringify(edited) });
      expect(JSON.parse((await repo.list()).find(row => row.id === project.id)!.draftScopeJson!)).toEqual(edited);
      for (const invalid of [{ ...edited, extractedWithAi: 'true' }, { ...edited, sourceConversation: 'x'.repeat(15001) }, { ...edited, unexpected: true }]) {
        await expect(repo.update(project.id, { draftScopeJson: JSON.stringify(invalid) })).rejects.toThrow();
      }
      const backup = await new ExportService(source.db).exportProject(project.id);
      await new ExportService(target).importProject(backup);
      expect(JSON.parse((await new ProjectRepository(target).getById(project.id))!.draftScopeJson!)).toEqual(edited);
    } finally { await source.db.closeAsync(); await target.closeAsync(); }
  });

  test('migration failure rolls back schema changes without deleting user records', async () => {
    const db = openDatabase(); await initial.up(db); await tax.up(db);
    await db.execAsync("INSERT INTO projects (id, title, created_at, updated_at) VALUES ('keep', 'Keep', '2026-10-09T00:00:00.000Z', '2026-10-09T00:00:00.000Z');");
    // A conflicting trigger makes migration 3 fail after its ALTER TABLE.
    await db.execAsync("CREATE TRIGGER agreements_no_update BEFORE UPDATE ON agreements BEGIN SELECT RAISE(ABORT, 'conflict'); END;");
    await expect(db.withTransactionAsync(() => integrity.up(db))).rejects.toThrow();
    expect(await db.getFirstAsync("SELECT id FROM projects WHERE id = 'keep'")).toEqual({ id: 'keep' });
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(agreements)');
    expect(columns.some(c => c.name === 'sealed')).toBe(false);
    await db.execAsync('DROP TRIGGER agreements_no_update');
    await db.withTransactionAsync(() => integrity.up(db));
  });

  test('complete history and an unconfirmed draft survive a disk-backed close and reopen', async () => {
    const source = await realBackend(engine('{}'));
    const history = await new ExportService(source.db).exportProject('proj_demo_website_01');
    const dir = mkdtempSync(join(tmpdir(), 'saklaw-persistence-'));
    const path = join(dir, 'saklaw.db');
    let db = openDatabase(path);
    try {
      await migrateAsync(db);
      await new ExportService(db).importProject(history);
      const draftProject = await new ProjectRepository(db).create({ id: 'draft-persist', title: 'Draft survives' });
      await new SettingsRepository(db).set(`saklaw_scope_draft:${draftProject.id}`, JSON.stringify(reviewedDraft(draftProject.id)));
      await db.closeAsync(); db = openDatabase(path); await migrateAsync(db);
      const reopened = JSON.parse(await new ExportService(db).exportProject('proj_demo_website_01'));
      expect(reopened.project).toEqual(JSON.parse(history).project);
      expect(reopened.agreements).toEqual(JSON.parse(history).agreements);
      expect(reopened.requests).toEqual(JSON.parse(history).requests);
      expect(reopened.analyses).toEqual(JSON.parse(history).analyses);
      expect(reopened.proposals).toEqual(JSON.parse(history).proposals);
      const draft = JSON.parse(await new ExportService(db).exportProject('draft-persist')).draft;
      expect(draft).toMatchObject({ sourceText: 'Build a website.', deliverables: [{ key: 'a', text: 'Website' }] });
    } finally { await db.closeAsync(); rmSync(dir, { recursive: true, force: true }); }
  });
});

(nodeSqlite ? describe : describe.skip)('alternate backend writers', () => {
  test('accepted deliverables supersede matching exclusions in each new version', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const repo = new AgreementRepository(db);
      const vault = new KasunduanVaultService(repo);
      const template = (await repo.getById('agmt_demo_v1_01'))!;
      const project = await new ProjectRepository(db).create({ id: 'cafe-exclusions', title: 'Kape Luna' });
      const created = await vault.confirmScope(project.id, { ...template,
        exclusions: ['online ordering', 'payments', 'hosting fees'] });
      const first = (await repo.getById(created.id))!;
      const accepted = await vault.acceptScopeChange({ projectId: project.id, currentAgreement: first,
        additionalDeliverables: ['add online ordering'] });
      const second = (await repo.getById(accepted.id))!;
      expect(second.exclusions).toEqual(['payments', 'hosting fees']);
      const third = await vault.acceptScopeChange({ projectId: project.id, currentAgreement: second,
        additionalDeliverables: ['Payments'] });
      expect(third.exclusions).toEqual(['hosting fees']);
      expect(await repo.getById(first.id)).toEqual(first);
      expect(await repo.getById(second.id)).toEqual(second);
      expect((await repo.getLatestByProjectId(project.id))?.exclusions).toEqual(['hosting fees']);
      const html = ContractGeneratorService.generateContractHtml(third);
      expect(html).toContain('<li>hosting fees</li>');
      expect(html).not.toContain('<li>online ordering</li>');
      expect(html).not.toContain('<li>payments</li>');
    } finally { await db.closeAsync(); }
  });

  test('a confirmed correction repairs existing conflicts as a new version without rewriting signed history', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const repo = new AgreementRepository(db);
      const vault = new KasunduanVaultService(repo);
      const first = (await repo.getById('agmt_demo_v1_01'))!;
      const second = await repo.createRevision({ ...first, id: 'old-v2', versionNumber: 2,
        requirements: [...first.requirements, { id: 'REQ-04', title: 'add online ordering', description: '', category: 'deliverable' }],
        exclusions: ['online ordering', 'payments', 'hosting fees'] }, first.id);
      const third = await repo.createRevision({ ...second, id: 'old-v3', versionNumber: 3,
        requirements: [...second.requirements, { id: 'REQ-05', title: 'payments', description: '', category: 'deliverable' }],
        clientApprovedAt: '2026-10-10T00:00:00.000Z', clientSignatoryName: 'Mara', clientSignatureData: 'Signed v3' }, second.id);
      await db.execAsync("CREATE TRIGGER fail_correction BEFORE INSERT ON requirements BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
      await expect(vault.resolveExclusionConflicts(first.projectId, third)).rejects.toThrow('disk failure');
      expect(await repo.getLatestByProjectId(first.projectId)).toEqual(third);
      await db.execAsync('DROP TRIGGER fail_correction');
      const corrected = await vault.resolveExclusionConflicts(first.projectId, third);
      expect(corrected).toMatchObject({ versionNumber: 4, exclusions: ['hosting fees'], requirements: third.requirements,
        budgetAmount: third.budgetAmount, durationDays: third.durationDays, revisionTerms: third.revisionTerms,
        clientApprovedAt: null, clientSignatoryName: null, clientSignatureData: null });
      expect(await repo.getById(first.id)).toEqual(first);
      expect(await repo.getById(second.id)).toEqual(second);
      expect(await repo.getById(third.id)).toEqual(third);
      await expect(vault.resolveExclusionConflicts(first.projectId, third)).rejects.toMatchObject({ code: 'conflict' });
      await expect(vault.resolveExclusionConflicts(first.projectId, corrected)).rejects.toMatchObject({ code: 'invalid_input' });
      const backup = JSON.parse(await new ExportService(db).exportProject(first.projectId));
      expect(backup.agreements.find((a: { id: string }) => a.id === corrected.id).exclusions).toEqual(['hosting fees']);
      expect(backup.agreements.find((a: { id: string }) => a.id === third.id).exclusions).toEqual(third.exclusions);

      const fifth = await vault.acceptScopeChange({ projectId: first.projectId, currentAgreement: corrected,
        additionalDeliverables: ['hosting fees'] });
      expect(fifth).toMatchObject({ versionNumber: 5, exclusions: [] });
      expect((await repo.getById(fifth.id))?.exclusions).toEqual([]);
      expect((await db.getFirstAsync<{ exclusions_json: string }>('SELECT exclusions_json FROM agreements WHERE id = ?', [fifth.id]))?.exclusions_json).toBe('[]');
      expect(await repo.getById(corrected.id)).toEqual(corrected);
      const fifthBackup = await new ExportService(db).exportProject(first.projectId);
      const dir = mkdtempSync(join(tmpdir(), 'owlset-empty-exclusions-'));
      const path = join(dir, 'owlset.db');
      let restored = openDatabase(path);
      try {
        await migrateAsync(restored);
        await new ExportService(restored).importProject(fifthBackup);
        await restored.closeAsync();
        restored = openDatabase(path);
        await migrateAsync(restored);
        const latest = (await new AgreementRepository(restored).getLatestByProjectId(first.projectId))!;
        expect(latest).toMatchObject({ id: fifth.id, versionNumber: 5, exclusions: [] });
        const html = ContractGeneratorService.generateContractHtml(latest);
        expect(html).not.toContain('<li>hosting fees</li>');
        expect(html).not.toContain('<li>online ordering</li>');
        expect(html).not.toContain('<li>payments</li>');
      } finally { await restored.closeAsync(); rmSync(dir, { recursive: true, force: true }); }
    } finally { await db.closeAsync(); }
  });

  test('accepting scope changes seals v2 and v3 without changing previous agreements', async () => {
    const { db, ports } = await realBackend(engine('{}'));
    try {
      const repo = new AgreementRepository(db);
      const vault = new KasunduanVaultService(repo);
      const original = (await repo.getById('agmt_demo_v1_01'))!;
      const second = await vault.acceptScopeChange({ projectId: original.projectId, currentAgreement: original,
        additionalDeliverables: ['Online ordering'], additionalFee: 7000, additionalDays: 5,
        clientSignatoryName: 'Mara Santos', clientSignatureData: 'Agreed by phone' });
      expect(second).toMatchObject({ versionNumber: 2, budgetAmount: original.budgetAmount! + 7000,
        durationDays: original.durationDays! + 5, clientSignatoryName: 'Mara Santos', clientSignatureData: 'Agreed by phone' });
      expect(second.clientApprovedAt).toBeTruthy();
      expect(second.requirements).toEqual(expect.arrayContaining(original.requirements));
      expect(second.requirements.at(-1)?.title).toBe('Online ordering');
      const third = await vault.acceptScopeChange({ projectId: original.projectId, currentAgreement: second,
        additionalDeliverables: ['Staff dashboard'], additionalFee: 0, additionalDays: 0 });
      expect(third).toMatchObject({ versionNumber: 3, budgetAmount: second.budgetAmount, durationDays: second.durationDays });
      expect(third.requirements).toEqual(expect.arrayContaining(second.requirements));
      expect(third.clientApprovedAt ?? null).toBeNull();
      expect(await repo.getById(original.id)).toEqual(original);
      expect(await repo.getById(second.id)).toMatchObject(second);
      expect((await repo.listByProjectId(original.projectId)).map(a => a.versionNumber)).toEqual([3, 2, 1]);
      await expect(vault.acceptScopeChange({ projectId: original.projectId, currentAgreement: original,
        additionalDeliverables: ['Stale change'] })).rejects.toMatchObject({ code: 'conflict' });
      expect(await repo.listByProjectId(original.projectId)).toHaveLength(3);
    } finally { await db.closeAsync(); }
  });

  test('competing scope acceptances cannot fork the same agreement version', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const repo = new AgreementRepository(db);
      const vault = new KasunduanVaultService(repo);
      const original = (await repo.getById('agmt_demo_v1_01'))!;
      const results = await Promise.allSettled(['Booking', 'Dashboard'].map(item => vault.acceptScopeChange({
        projectId: original.projectId, currentAgreement: original, additionalDeliverables: [item],
      })));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect((await repo.listByProjectId(original.projectId)).map(a => a.versionNumber)).toEqual([2, 1]);
      expect(await repo.getById(original.id)).toEqual(original);
    } finally { await db.closeAsync(); }
  });

  test('failed request acceptance rolls back the new version and keeps the request retryable', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const original = (await new AgreementRepository(db).getById('agmt_demo_v1_01'))!;
      const before = await new ScopeGuardRepository(db).getRequestById('req_demo_request_01');
      await db.execAsync("CREATE TRIGGER fail_accept BEFORE UPDATE ON client_requests BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
      const accept = () => transaction(db, async tx => {
        const repos = repositories(tx, true);
        const next = await new KasunduanVaultService(repos.agreement).acceptScopeChange({
          projectId: original.projectId, currentAgreement: original, additionalDeliverables: ['Ordering'],
          clientSignatoryName: 'Mara Santos',
        });
        await repos.scopeGuard.updateRequestStatus(before!.id, 'accepted', next.confirmedAt);
        return next;
      });
      await expect(accept()).rejects.toThrow('disk failure');
      expect(await new AgreementRepository(db).listByProjectId(original.projectId)).toEqual([original]);
      expect(await new ScopeGuardRepository(db).getRequestById(before!.id)).toEqual(before);
      await db.execAsync('DROP TRIGGER fail_accept');
      expect(await accept()).toMatchObject({ versionNumber: 2, clientSignatoryName: 'Mara Santos' });
      expect(await new ScopeGuardRepository(db).getRequestById(before!.id)).toMatchObject({ status: 'accepted' });
    } finally { await db.closeAsync(); }
  });

  test('vault confirmation cannot create Agreement v2 on a repeated call', async () => {
    const { ports } = await realBackend(engine('{}'));
    const agreement = await ports.agreements.getById('agmt_demo_v1_01');
    const vault = new KasunduanVaultService(ports.agreements as AgreementRepository);
    await expect(vault.confirmScope(agreement!.projectId, agreement!)).rejects.toThrow();
    expect(await (ports.agreements as AgreementRepository).listByProjectId(agreement!.projectId)).toHaveLength(1);
  });

  test('plain requests persist in SQLite without inference or analysis records', async () => {
    const generate = jest.fn(async () => { throw new Error('AI unavailable'); });
    const { db, ports } = await realBackend({ isAvailable: async () => false, generate });
    try {
      const service = new ScopeGuardService(ports.engine, ports.agreements as AgreementRepository, ports.scopeGuard as ScopeGuardRepository);
      const saved = await service.saveRequest({ projectId: 'proj_demo_website_01', agreementId: 'agmt_demo_v1_01', requestText: '  Add a gallery  ' });
      const reopenedRepository = new ScopeGuardRepository(db);
      expect(await reopenedRepository.getRequestById(saved.id)).toEqual({ ...saved, acceptedAt: null });
      expect(await reopenedRepository.listRequestsByProjectId(saved.projectId)).toContainEqual({ ...saved, acceptedAt: null });
      expect(await reopenedRepository.getAnalysisByRequestId(saved.id)).toBeNull();
      expect(generate).not.toHaveBeenCalled();
      await expect(service.saveRequest({ projectId: 'other-project', agreementId: saved.agreementId, requestText: 'Add booking' })).rejects.toMatchObject({ code: 'not_found' });
      await expect(service.saveRequest({ projectId: saved.projectId, agreementId: saved.agreementId, requestText: '   ' })).rejects.toMatchObject({ code: 'invalid_input' });
    } finally { await db.closeAsync(); }
  });

  test('analysis of a stored request keeps its SQLite identity and never duplicates the message', async () => {
    const { db, ports } = await realBackend(engine(JSON.stringify({ overall_classification: 'potential_additional', summary: 'New work',
      findings: [{ item: 'Gallery', classification: 'potential_additional', explanation: 'New work', evidence_requirement_ids: [] }], clarification_questions: [] })));
    try {
      const service = new ScopeGuardService(ports.engine, ports.agreements as AgreementRepository, ports.scopeGuard as ScopeGuardRepository);
      const saved = await service.saveRequest({ projectId: 'proj_demo_website_01', agreementId: 'agmt_demo_v1_01', requestText: 'Add a gallery' });
      const before = await service.listRequests(saved.projectId);
      const options = { projectId: saved.projectId, agreementId: saved.agreementId, requestId: saved.id, requestText: saved.rawText };
      const analysis = await service.analyzeRequest(options);
      expect(analysis.requestId).toBe(saved.id);
      expect(await service.listRequests(saved.projectId)).toEqual(before);
      expect(await new ScopeGuardRepository(db).getAnalysisByRequestId(saved.id)).toEqual(analysis);
      await expect(service.analyzeRequest({ ...options, requestText: 'Different request' })).rejects.toMatchObject({ code: 'not_found' });
      await new ScopeGuardRepository(db).updateRequestStatus(saved.id, 'accepted', new Date().toISOString());
      await expect(service.analyzeRequest(options)).rejects.toMatchObject({ code: 'conflict' });
    } finally { await db.closeAsync(); }
  });

  test('legacy analysis service rolls back its request when analysis persistence fails', async () => {
    const { db, ports } = await realBackend(engine(JSON.stringify({ overall_classification: 'potential_additional', summary: 'Extra',
      findings: [{ item: 'Booking', classification: 'potential_additional', explanation: 'Extra', evidence_requirement_ids: [] }], clarification_questions: [] })));
    const before = await (ports.scopeGuard as ScopeGuardRepository).listRequestsByProjectId('proj_demo_website_01');
    await db.execAsync(`CREATE TRIGGER fail_legacy_analysis BEFORE INSERT ON scopeguard_analyses BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    const service = new ScopeGuardService(ports.engine, ports.agreements as AgreementRepository, ports.scopeGuard as ScopeGuardRepository);
    await expect(service.analyzeRequest({ projectId: 'proj_demo_website_01', agreementId: 'agmt_demo_v1_01', requestText: 'Add booking' })).rejects.toThrow();
    expect(await (ports.scopeGuard as ScopeGuardRepository).listRequestsByProjectId('proj_demo_website_01')).toEqual(before);
  });
});

(nodeSqlite ? describe : describe.skip)('atomic screen saves', () => {
  test('failed draft save keeps the old draft and project timestamp', async () => {
    const { db, data } = await realBackend(engine('{}'));
    const project = await data.createProject('Draft rollback');
    await data.saveDraft(reviewedDraft(project.id));
    const before = await data.getDraft(project.id); const beforeProject = await data.getProject(project.id);
    await db.execAsync(`CREATE TRIGGER fail_project BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    await expect(data.saveDraft({ ...before!, sourceText: 'Changed' })).rejects.toMatchObject({ code: 'save_failed' });
    expect(await data.getDraft(project.id)).toEqual(before);
    expect(await data.getProject(project.id)).toEqual(beforeProject);
  });
  test('failed proposal creation or edit keeps the previous saved state', async () => {
    const { db, data, ports } = await realBackend(engine('{}'));
    const before = await data.getProposal('proj_demo_website_01', 'prop_demo_proposal_01');
    const project = await data.getProject('proj_demo_website_01');
    await db.execAsync(`CREATE TRIGGER fail_project BEFORE UPDATE ON projects BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`);
    await expect(data.createProposal('proj_demo_website_01', 'ana_demo_analysis_01', ['Client login portal'])).rejects.toMatchObject({ code: 'save_failed' });
    expect(await ports.proposals.listByProjectId('proj_demo_website_01')).toHaveLength(1);
    await expect(data.saveProposal({ ...before!, message: 'Changed', extraWorkingDays: 0 })).rejects.toMatchObject({ code: 'save_failed' });
    expect(await data.getProposal('proj_demo_website_01', before!.id)).toEqual(before);
    expect(await data.getProject('proj_demo_website_01')).toEqual(project);
  });
  test('confirmation racing a draft save leaves one confirmed agreement and no lingering draft', async () => {
    const { data, ports } = await realBackend(engine('{}'));
    const project = await data.createProject('Racing draft');
    const draft = reviewedDraft(project.id);
    const results = await Promise.allSettled([data.confirmScope(project.id, draft), data.saveDraft(draft)]);
    expect(results[0].status).toBe('fulfilled'); expect(results[1].status).toBe('rejected');
    expect(await data.getDraft(project.id)).toBeNull();
    expect(await ports.settings.get(`saklaw_scope_draft:${project.id}`)).toBe('');
  });
  test('a separate transaction connection rejects foreign-key violations before commit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'saklaw-isolated-'));
    const db = openDatabase(join(dir, 'saklaw.db'));
    try {
      await migrateAsync(db);
      await expect(transaction(db, async tx => {
        await tx.runAsync(`INSERT INTO agreements (id, project_id, version_number, title, confirmed_at)
          VALUES ('orphan', 'missing', 1, 'Orphan', '2026-10-09T00:00:00.000Z')`);
      })).rejects.toMatchObject({ code: 'data_integrity' });
      expect(await db.getFirstAsync("SELECT id FROM agreements WHERE id = 'orphan'")).toBeNull();
    } finally { await db.closeAsync(); rmSync(dir, { recursive: true, force: true }); }
  });
});

(nodeSqlite ? describe : describe.skip)('database audit regressions', () => {
  test('failed project deletion preserves complete history for retry', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const exports = new ExportService(db);
      const before = JSON.parse(await exports.exportProject('proj_demo_website_01'));
      await db.execAsync("CREATE TRIGGER fail_project_delete BEFORE DELETE ON projects BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
      await expect(new ProjectRepository(db).delete('proj_demo_website_01')).rejects.toThrow('disk failure');
      const after = JSON.parse(await exports.exportProject('proj_demo_website_01'));
      expect({ ...after, exportedAt: before.exportedAt }).toEqual(before);
    } finally { await db.closeAsync(); }
  });

  test('project deletion cleans its own draft and source settings on an isolated connection', async () => {
    const source = await realBackend(engine('{}'));
    const backup = await new ExportService(source.db).exportProject('proj_demo_website_01');
    const dir = mkdtempSync(join(tmpdir(), 'owlset-delete-'));
    const db = openDatabase(join(dir, 'owlset.db'));
    try {
      await migrateAsync(db);
      await new ExportService(db).importProject(backup);
      const settings = new SettingsRepository(db);
      await settings.set('saklaw_source:proj_demo_website_01', 'Private conversation');
      await settings.set('saklaw_scope_draft:proj_demo_website_01', 'Old draft');
      await settings.set('saklaw_source:other-project', 'Keep me');
      await settings.set('freelancer_name', 'Alex');
      const projects = new ProjectRepository(db);
      await projects.create({ id: 'other-project', title: 'Another project' });
      expect(await projects.delete('proj_demo_website_01')).toBe(true);
      expect(await settings.get('saklaw_source:proj_demo_website_01')).toBeNull();
      expect(await settings.get('saklaw_scope_draft:proj_demo_website_01')).toBeNull();
      expect(await settings.get('saklaw_source:other-project')).toBe('Keep me');
      expect(await settings.get('freelancer_name')).toBe('Alex');
      expect((await projects.list()).map(row => row.id)).toEqual(['other-project']);
      expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
      expect(await projects.delete('proj_demo_website_01')).toBe(false);
    } finally { await source.db.closeAsync(); await db.closeAsync(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('request deletion removes dependent analyses and proposals atomically on an isolated connection', async () => {
    const source = await realBackend(engine('{}'));
    const backup = await new ExportService(source.db).exportProject('proj_demo_website_01');
    const dir = mkdtempSync(join(tmpdir(), 'owlset-request-delete-'));
    const db = openDatabase(join(dir, 'owlset.db'));
    try {
      await migrateAsync(db);
      await new ExportService(db).importProject(backup);
      const requests = new ScopeGuardRepository(db);
      const proposals = new ProposalRepository(db);
      await db.execAsync("CREATE TRIGGER fail_request_delete BEFORE DELETE ON client_requests BEGIN SELECT RAISE(ABORT, 'disk failure'); END;");
      await expect(requests.deleteRequest('req_demo_request_01')).rejects.toThrow('disk failure');
      expect(await proposals.getById('prop_demo_proposal_01')).not.toBeNull();
      expect(await requests.getAnalysisById('ana_demo_analysis_01')).not.toBeNull();
      await db.execAsync('DROP TRIGGER fail_request_delete');
      await requests.deleteRequest('req_demo_request_01');
      expect(await requests.getRequestById('req_demo_request_01')).toBeNull();
      expect(await requests.getAnalysisById('ana_demo_analysis_01')).toBeNull();
      expect(await proposals.getById('prop_demo_proposal_01')).toBeNull();
      expect(await new AgreementRepository(db).getById('agmt_demo_v1_01')).not.toBeNull();
      expect(await new ProjectRepository(db).getById('proj_demo_website_01')).not.toBeNull();
      expect(await db.getAllAsync('PRAGMA foreign_key_check')).toEqual([]);
    } finally { await source.db.closeAsync(); await db.closeAsync(); rmSync(dir, { recursive: true, force: true }); }
  });

  test('invalid client approval cannot make a confirmed agreement unreadable', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const repo = new AgreementRepository(db);
      const original = await repo.getById('agmt_demo_v1_01');
      await expect(repo.recordClientApproval('agmt_demo_v1_01', 'x'.repeat(2001))).rejects.toMatchObject({ code: 'invalid_input' });
      await expect(repo.recordClientApproval('agmt_demo_v1_01', '   ')).rejects.toMatchObject({ code: 'invalid_input' });
      await expect(repo.recordClientApproval('agmt_demo_v1_01', 'Alex', 'x'.repeat(2000001))).rejects.toMatchObject({ code: 'invalid_input' });
      expect(await repo.getById('agmt_demo_v1_01')).toEqual(original);
      await expect(repo.recordClientApproval('missing', 'Alex')).rejects.toMatchObject({ code: 'not_found' });
    } finally { await db.closeAsync(); }
  });

  test('invalid request status cannot poison saved request history', async () => {
    const { db } = await realBackend(engine('{}'));
    try {
      const repo = new ScopeGuardRepository(db);
      const original = await repo.getRequestById('req_demo_request_01');
      await expect(repo.updateRequestStatus('req_demo_request_01', 'invalid' as 'accepted')).rejects.toMatchObject({ code: 'invalid_input' });
      await expect(repo.updateRequestStatus('req_demo_request_01', 'accepted', 'yesterday')).rejects.toMatchObject({ code: 'invalid_input' });
      expect(await repo.getRequestById('req_demo_request_01')).toEqual(original);
      await expect(repo.updateRequestStatus('missing', 'analyzed')).rejects.toMatchObject({ code: 'not_found' });
    } finally { await db.closeAsync(); }
  });
});
