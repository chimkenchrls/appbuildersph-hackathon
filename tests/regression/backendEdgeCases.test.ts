import { migrateAsync } from '@/database/migrate';
import { repositories } from '@/database/repositories';
import { ScopeGuardService } from '@/services/domain/scopeGuardService';
import { KasunduanVaultService } from '@/services/domain/kasunduanVaultService';
import { ExportService } from '@/services/domain/exportService';
import { BriefCraftService } from '@/services/domain/briefCraftService';
import { BriefCraftRawOutputSchema } from '@/types/schemas';
import { parseAndValidateJson } from '@/llm/jsonParser';
import type { LLMEngine } from '@/llm/contracts';
import { nodeSqlite, openDatabase } from '../helpers/sqliteShim';

const run = nodeSqlite ? describe : describe.skip;
const engineReturning = (out: string): LLMEngine => ({ isAvailable: async () => true, generate: async () => out });

async function fresh() {
  const db = openDatabase();
  await migrateAsync(db);
  const repos = repositories(db);
  await repos.project.create({ id: 'p1', title: 'Cafe site' });
  const vault = new KasunduanVaultService(repos.agreement);
  const agreement = await vault.confirmScope('p1', {
    title: 'Cafe site',
    requirements: [
      { id: 'REQ-01', title: 'Five pages', description: 'Home, About, Menu, Gallery, Contact', category: 'deliverable' },
      { id: 'REQ-02', title: 'Contact form', description: 'Inquiry form', category: 'deliverable' },
    ],
    budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
    revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified',
  } as never, 'Cafe site');
  return { db, repos, vault, agreement };
}

const analysisJson = JSON.stringify({
  overall_classification: 'included', summary: 'Covered.',
  findings: [{ item: 'Contact form text', classification: 'included', explanation: 'In REQ-02', evidence_requirement_ids: ['REQ-02'] }],
  clarification_questions: [],
});

run('regression: re-analysis, export, model output, money and fallback extraction', () => {
  test('analysing the same stored request twice', async () => {
    const { repos, agreement } = await fresh();
    const svc = new ScopeGuardService(engineReturning(analysisJson), repos.agreement, repos.scopeGuard);
    const saved = await svc.saveRequest({ projectId: 'p1', agreementId: agreement.id, requestText: 'Change contact form text' });
    const first = await svc.analyzeRequest({ projectId: 'p1', agreementId: agreement.id, requestText: saved.rawText, requestId: saved.id });
    expect(first.requestId).toBe(saved.id);
    // Desired: a second attempt must not surface a raw constraint failure.
    await expect(svc.analyzeRequest({ projectId: 'p1', agreementId: agreement.id, requestText: saved.rawText, requestId: saved.id }))
      .resolves.toBeTruthy();
  });

  test('export a confirmed project that still has a legacy draft setting', async () => {
    const { db, repos } = await fresh();
    const legacy = { sourceText: 'chat', deliverables: [{ key: 'a', text: 'Five pages' }], exclusions: [], missingInformation: [],
      terms: { budgetAmount: null, currency: 'PHP', timeline: null, revisionTerms: null }, origin: 'extracted', projectId: 'p1', updatedAt: '2026-10-10T00:00:00.000Z' };
    await repos.settings.set('saklaw_scope_draft:p1', JSON.stringify(legacy));
    const json = await new ExportService(db).exportProject('p1');
    expect(JSON.parse(json).agreements).toHaveLength(1);
  });

  test('raw model output: empty-string and comma amounts are not turned into 0 or rejected wholesale', () => {
    const base = { title: 'x', deliverables: [{ title: 'a', description: '' }] };
    const blank = parseAndValidateJson(JSON.stringify({ ...base, budget: { amount: '' } }), BriefCraftRawOutputSchema);
    expect(blank.budget.amount).toBeNull();
    const comma = parseAndValidateJson(JSON.stringify({ ...base, budget: { amount: '15,000' } }), BriefCraftRawOutputSchema);
    expect(comma.budget.amount).toBe(15000);
  });

  test('raw model output: fractional or negative days must not pass', () => {
    const base = { title: 'x', deliverables: [{ title: 'a', description: '' }] };
    expect(() => parseAndValidateJson(JSON.stringify({ ...base, timeline: { duration_days: -3 } }), BriefCraftRawOutputSchema)).toThrow();
    expect(() => parseAndValidateJson(JSON.stringify({ ...base, budget: { amount: -500 } }), BriefCraftRawOutputSchema)).toThrow();
  });

  test('accepting a change with cents does not leave float noise', async () => {
    const { repos, vault, agreement } = await fresh();
    const withCents = await repos.agreement.createRevision({ ...agreement, id: 'a2', versionNumber: 2, budgetAmount: 100.1 } as never, agreement.id);
    const next = await vault.acceptScopeChange({ projectId: 'p1', currentAgreement: withCents, additionalDeliverables: ['Extra'], additionalFee: 200.2, additionalDays: 1 });
    expect(next.budgetAmount).toBe(300.3);
  });

  test('heuristic reads "two revision rounds", word numbers and picks the total, not a deposit', () => {
    const svc = new BriefCraftService(engineReturning('{}'));
    const a = svc.extractBriefHeuristic('Five pages. PHP 15,000 total, two weeks, two revision rounds are included.');
    expect(a.revisionTerms).toMatch(/2 rounds/);
    expect(a.durationDays).toBe(14);
    const b = svc.extractBriefHeuristic('50% downpayment of PHP 7,500, balance on delivery. Total project fee is PHP 15,000. Payment terms: 30 days. Delivery in 3 weeks.');
    expect(b.budgetAmount).toBe(15000);
    expect(b.durationDays).toBe(21);
  });

  test('an analysis that cites a requirement twice is rejected, not silently saved', async () => {
    const { repos, agreement } = await fresh();
    const dup = JSON.stringify({ overall_classification: 'included', summary: 's',
      findings: [{ item: 'x', classification: 'included', explanation: 'e', evidence_requirement_ids: ['REQ-01', 'REQ-01'] }] });
    const svc = new ScopeGuardService(engineReturning(dup), repos.agreement, repos.scopeGuard);
    await expect(svc.analyzeRequest({ projectId: 'p1', agreementId: agreement.id, requestText: 'hello' })).rejects.toThrow();
  });
});

import { ContractGeneratorService } from '@/services/domain/contractGeneratorService';
import type { Agreement } from '@/types/domain';

run('regression: output safety and backup round trips', () => {
  const hostile = `<img src=x onerror="alert(1)"> & "quotes" 'single' <script>boom()</script>`;

  test('contract HTML escapes every user-controlled field', async () => {
    const { agreement } = await fresh();
    const a: Agreement = { ...agreement, title: hostile,
      requirements: [{ id: 'REQ-01', title: hostile, description: hostile, category: 'deliverable' }],
      exclusions: [hostile], revisionTerms: hostile, budgetNotes: hostile, timelineNotes: hostile };
    const html = ContractGeneratorService.generateContractHtml(a, { clientName: hostile, freelancerName: hostile, clientAddress: hostile, freelancerAddress: hostile, paymentMethod: hostile });
    expect(html).not.toMatch(/<script>boom/);
    expect(html).not.toMatch(/<img src=x onerror/);
  });

  test('contract text and HTML do not throw or print "null/undefined/NaN" for unspecified terms', async () => {
    const { agreement } = await fresh();
    const bare: Agreement = { ...agreement, budgetAmount: null, durationDays: null, revisionTerms: null, budgetNotes: null,
      timelineNotes: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified' };
    const text = ContractGeneratorService.generateContractText(bare);
    const html = ContractGeneratorService.generateContractHtml(bare);
    for (const out of [text, html]) expect(out).not.toMatch(/\b(null|undefined|NaN)\b/);
  });

  test('special characters, emoji and SQL syntax survive save, export and restore', async () => {
    const { db, repos } = await fresh();
    const title = `Robert'); DROP TABLE projects;-- 🦉 "Café" \\ %_`;
    await repos.project.create({ id: 'p2', title, clientName: `O'Neil & Sons`, description: '日本語 テスト' });
    const json = await new ExportService(db).exportProject('p2');
    const other = openDatabase();
    await migrateAsync(other);
    await new ExportService(other).importProject(json);
    const back = await repositories(other).project.getById('p2');
    expect(back?.title).toBe(title);
    expect(back?.clientName).toBe(`O'Neil & Sons`);
    expect(await repositories(other).project.list()).toHaveLength(1);
  });

  test('restore rejects tampered backups and leaves the database untouched', async () => {
    const { db } = await fresh();
    const good = JSON.parse(await new ExportService(db).exportProject('p1'));
    const target = openDatabase();
    await migrateAsync(target);
    const svc = new ExportService(target);
    const bad = [
      { ...good, formatVersion: 2 },
      { ...good, extra: 'field' },
      { ...good, agreements: [{ ...good.agreements[0], projectId: 'someone-else' }] },
      { ...good, requests: [{ id: 'r', projectId: 'p1', agreementId: 'missing', rawText: 'x', createdAt: good.exportedAt }] },
      { ...good, project: { ...good.project, title: '' } },
      '{"__proto__": {"polluted": true}}',
      'not json',
      '[]',
      'null',
    ];
    for (const payload of bad) {
      await expect(svc.importProject(typeof payload === 'string' ? payload : JSON.stringify(payload))).rejects.toBeTruthy();
    }
    expect(await repositories(target).project.list()).toHaveLength(0);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('deleting a project removes its records and a later export reports not found', async () => {
    const { db, repos } = await fresh();
    const svc = new ScopeGuardService(engineReturning(analysisJson), repos.agreement, repos.scopeGuard);
    const ag = await repos.agreement.getLatestByProjectId('p1');
    await svc.analyzeRequest({ projectId: 'p1', agreementId: ag!.id, requestText: 'hello' });
    expect(await repos.project.delete('p1')).toBe(true);
    await expect(new ExportService(db).exportProject('p1')).rejects.toMatchObject({ code: 'not_found' });
    const left = await db.getFirstAsync<{ n: number }>('SELECT (SELECT COUNT(*) FROM agreements) + (SELECT COUNT(*) FROM client_requests) + (SELECT COUNT(*) FROM scopeguard_analyses) + (SELECT COUNT(*) FROM requirements) AS n;');
    expect(left?.n).toBe(0);
  });
});

import { seedDemoDataAsync } from '@/database/seed';
import { normalizeLlmUrl } from '@/llm/adapters/lmStudioAdapter';

run('regression: startup seeding and configuration', () => {
  test('deleting every project does not bring the demo back or reset saved settings', async () => {
    const db = openDatabase();
    await migrateAsync(db);
    const repos = repositories(db);
    await seedDemoDataAsync(db);
    await repos.settings.set('lm_studio_url', 'http://my-laptop:1234/v1');
    for (const p of await repos.project.list()) await repos.project.delete(p.id);
    expect(await repos.project.list()).toHaveLength(0);
    await seedDemoDataAsync(db); // what every launch does
    expect(await repos.project.list()).toHaveLength(0);
    expect(await repos.settings.get('lm_studio_url')).toBe('http://my-laptop:1234/v1');
  });

  test.each([
    ['192.168.1.5', 'http://192.168.1.5/v1'],
    ['192.168.1.5:1234', 'http://192.168.1.5:1234/v1'],
    ['http://host:1234/', 'http://host:1234/v1'],
    ['http://host:1234/v1/', 'http://host:1234/v1'],
    ['  HTTP://Host:1234/V1  ', 'HTTP://Host:1234/V1'],
    ['https://example.com/openai/v1', 'https://example.com/openai/v1'],
  ])('normalizeLlmUrl(%p)', (input, expected) => {
    expect(normalizeLlmUrl(input)).toBe(expected);
  });
});
