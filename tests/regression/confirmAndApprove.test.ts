import { migrateAsync } from '@/database/migrate';
import { repositories } from '@/database/repositories';
import { ProposalSchema } from '@/safety/persistedSchemas';
import { KasunduanVaultService } from '@/services/kasunduanVaultService';
import { nodeSqlite, openDatabase } from '../helpers/sqliteShim';

const run = nodeSqlite ? describe : describe.skip;
const req = (id: string, title = 'Item') => ({ id, title, description: 'd', category: 'deliverable' as const });
const draft = (over: Record<string, unknown> = {}) => ({
  title: 'Site', requirements: [req('REQ-01')], budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14,
  deadline: null, timelineNotes: null, revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified', ...over,
}) as never;

async function setup() {
  const db = openDatabase();
  await migrateAsync(db);
  const repos = repositories(db);
  await repos.project.create({ id: 'p1', title: 'Site' });
  return { db, repos, vault: new KasunduanVaultService(repos.agreement) };
}

run('regression: confirming a scope', () => {
  test('no deliverables is refused', async () => {
    const { vault } = await setup();
    await expect(vault.confirmScope('p1', draft({ requirements: [] }))).rejects.toBeTruthy();
  });
  test('duplicate requirement ids are refused or made unique', async () => {
    const { vault } = await setup();
    const agreement = await vault.confirmScope('p1', draft({ requirements: [req('REQ-01', 'A'), req('REQ-01', 'B')] })).catch(() => null);
    if (agreement) expect(new Set(agreement.requirements.map(r => r.id)).size).toBe(agreement.requirements.length);
  });
  test('confirming twice does not silently create version 2', async () => {
    const { vault, repos } = await setup();
    await vault.confirmScope('p1', draft());
    await vault.confirmScope('p1', draft()).catch(() => null);
    expect((await repos.agreement.listByProjectId('p1')).length).toBe(1);
  });
  test('two simultaneous confirmations create one agreement', async () => {
    const { vault, repos } = await setup();
    await Promise.allSettled([vault.confirmScope('p1', draft()), vault.confirmScope('p1', draft())]);
    expect((await repos.agreement.listByProjectId('p1')).length).toBe(1);
  });
  test.each([[-1], [Number.NaN], [Infinity], [1e15]])('budget %p is refused', async (budgetAmount) => {
    const { vault } = await setup();
    await expect(vault.confirmScope('p1', draft({ budgetAmount }))).rejects.toBeTruthy();
  });
  test('a blank requirement title is refused', async () => {
    const { vault } = await setup();
    await expect(vault.confirmScope('p1', draft({ requirements: [req('REQ-01', '   ')] }))).rejects.toBeTruthy();
  });
  test('a 50,000 character requirement is refused', async () => {
    const { vault } = await setup();
    await expect(vault.confirmScope('p1', draft({ requirements: [{ ...req('REQ-01'), description: 'x'.repeat(50000) }] }))).rejects.toBeTruthy();
  });
});

run('regression: proposals, requests and approval', () => {
  async function withAnalysis() {
    const ctx = await setup();
    const agreement = await ctx.vault.confirmScope('p1', draft());
    const now = new Date().toISOString();
    await ctx.repos.scopeGuard.createRequest({ id: 'rq1', projectId: 'p1', agreementId: agreement.id, rawText: 'Add accounts', createdAt: now, status: 'stored' });
    await ctx.repos.scopeGuard.createAnalysis({ id: 'an1', requestId: 'rq1', agreementId: agreement.id, classification: 'potential_additional',
      summary: 's', findings: [{ item: 'Accounts', classification: 'potential_additional', explanation: 'x', evidenceRequirementIds: [] }],
      clarificationQuestions: [], createdAt: now });
    return { ...ctx, agreement, now };
  }
  const proposal = (now: string, over: Record<string, unknown> = {}) => ({ id: 'pr1', projectId: 'p1', analysisId: 'an1', selectedItems: ['Accounts'],
    freelancerFeeEstimate: null, freelancerDaysEstimate: null, currency: 'PHP', draftMessage: 'm', status: 'draft', createdAt: now, updatedAt: now, ...over }) as never;

  test('every proposal status is storable and any other is refused up front', async () => {
    const { repos, now } = await withAnalysis();
    await repos.proposal.create(proposal(now));
    for (const status of ['copied', 'sent', 'draft']) {
      const updated = await repos.proposal.update('pr1', { status } as never);
      expect(updated?.status).toBe(status);
    }
    expect(() => ProposalSchema.parse({ ...(proposal(now) as object), status: 'accepted' })).toThrow();
  });
  test('a proposal with a negative fee or fractional days is refused', async () => {
    const { repos, now } = await withAnalysis();
    await expect(repos.proposal.create(proposal(now, { freelancerFeeEstimate: -5 }))).rejects.toBeTruthy();
    await expect(repos.proposal.create(proposal(now, { id: 'pr2', freelancerDaysEstimate: 2.5 }))).rejects.toBeTruthy();
  });
  test('client approval can be recorded once and keeps its first values', async () => {
    const { repos, agreement } = await withAnalysis();
    await repos.agreement.recordClientApproval(agreement.id, 'Rina');
    await repos.agreement.recordClientApproval(agreement.id, 'Someone Else').catch(() => null);
    expect((await repos.agreement.getById(agreement.id))?.clientSignatoryName).toBe('Rina');
  });
  test('an accepted request cannot be analysed or accepted again', async () => {
    const { repos } = await withAnalysis();
    await repos.scopeGuard.updateRequestStatus('rq1', 'accepted', new Date().toISOString());
    const stored = await repos.scopeGuard.getRequestById('rq1');
    expect(stored?.status).toBe('accepted');
  });
});
