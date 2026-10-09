import { KasunduanVaultService } from '@/services/kasunduanVaultService';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import { AgreementSchema } from '@/safety/persistedSchemas';
import type { Agreement } from '@/types/domain';

const original: Agreement = {
  id: 'v1', projectId: 'p1', versionNumber: 1, title: 'Website',
  requirements: [{ id: 'REQ-01', title: 'Website', description: '', category: 'deliverable' }],
  budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: null,
  deadline: null, timelineNotes: null, revisionTerms: null, exclusions: [],
  missingInformation: ['Budget amount is not specified.', 'Duration is not specified.', 'Client assets needed.'],
  taxTreatment: 'none_specified', confirmedAt: '2026-10-10T00:00:00.000Z',
};

function vaultFor(baseline: Agreement) {
  let saved = baseline;
  const repository: Pick<AgreementRepository, 'getLatestByProjectId' | 'createRevision'> = {
    getLatestByProjectId: async () => saved,
    createRevision: async (next: Agreement) => { saved = AgreementSchema.parse(next); return saved; },
  };
  return new KasunduanVaultService(repository as unknown as AgreementRepository);
}

test('null budget plus fee remains unspecified and records the exact agreed addition', async () => {
  const baseline = { ...original, budgetNotes: 'Base price awaits agreement' };
  const next = await vaultFor(baseline).acceptScopeChange({ projectId: 'p1', currentAgreement: baseline,
    additionalDeliverables: ['Ordering'], additionalFee: 7000.12345 });
  expect(next.budgetAmount).toBeNull();
  expect(next.budgetNotes).toBe('Base price awaits agreement\nAdditional PHP 7,000.12345 agreed in v2');
  expect(next.missingInformation).toEqual(original.missingInformation);
  expect(baseline.budgetNotes).toBe('Base price awaits agreement');
});

test('null duration plus days records the addition without inventing total or extension text', async () => {
  const baseline = { ...original, timelineNotes: 'Start after assets arrive' };
  const next = await vaultFor(baseline).acceptScopeChange({ projectId: 'p1', currentAgreement: baseline,
    additionalDeliverables: ['Ordering'], additionalDays: 5 });
  expect(next.durationDays).toBeNull();
  expect(next.timelineNotes).toBe('Start after assets arrive\nAdditional 5 working days agreed in v2');
  expect(next.timelineNotes).not.toContain('extended by');
  expect(next.missingInformation).toEqual(original.missingInformation);
});

test('known budget and duration retain existing addition behaviour', async () => {
  const baseline = { ...original, budgetAmount: 18000, durationDays: 14, budgetNotes: 'Fixed price',
    timelineNotes: 'Two weeks', missingInformation: ['Client assets needed.'] };
  const next = await vaultFor(baseline).acceptScopeChange({ projectId: 'p1', currentAgreement: baseline,
    additionalDeliverables: ['Ordering'], additionalFee: 7000, additionalDays: 5 });
  expect(next).toMatchObject({ budgetAmount: 25000, budgetNotes: 'Fixed price', durationDays: 19,
    timelineNotes: '19 days (extended by 5 days for additions)', missingInformation: ['Client assets needed.'] });
});

test('known zero budget and duration are totals and receive the additions', async () => {
  const baseline = { ...original, budgetAmount: 0, durationDays: 0, missingInformation: [] };
  const next = await vaultFor(baseline).acceptScopeChange({ projectId: 'p1', currentAgreement: baseline,
    additionalDeliverables: ['Ordering'], additionalFee: 7000, additionalDays: 5 });
  expect(next).toMatchObject({ budgetAmount: 7000, budgetNotes: null, durationDays: 5,
    timelineNotes: '5 days (extended by 5 days for additions)', missingInformation: [] });
});

test.each([null, 0, 18000])('accepting work with no fee or day additions preserves base %s and its notes', async amount => {
  const baseline = { ...original, budgetAmount: amount, durationDays: amount,
    budgetNotes: 'Original budget notes', timelineNotes: 'Original timeline notes',
    missingInformation: amount === null ? original.missingInformation : ['Client assets needed.'] };
  const next = await vaultFor(baseline).acceptScopeChange({ projectId: 'p1', currentAgreement: baseline,
    additionalDeliverables: ['Ordering'] });
  expect(next).toMatchObject({ budgetAmount: amount, durationDays: amount, budgetNotes: 'Original budget notes',
    timelineNotes: 'Original timeline notes', missingInformation: baseline.missingInformation });
});

test('explicit zero additions to unknown totals are recorded without replacing null', async () => {
  const next = await vaultFor(original).acceptScopeChange({ projectId: 'p1', currentAgreement: original,
    additionalDeliverables: ['Ordering'], additionalFee: 0, additionalDays: 0 });
  expect(next).toMatchObject({ budgetAmount: null, durationDays: null,
    budgetNotes: 'Additional PHP 0 agreed in v2', timelineNotes: 'Additional 0 working days agreed in v2',
    missingInformation: original.missingInformation });
});

test('successive revisions keep unknown totals and append their separately agreed additions', async () => {
  const vault = vaultFor(original);
  const second = await vault.acceptScopeChange({ projectId: 'p1', currentAgreement: original,
    additionalDeliverables: ['Ordering'], additionalFee: 7000, additionalDays: 5 });
  const third = await vault.acceptScopeChange({ projectId: 'p1', currentAgreement: second,
    additionalDeliverables: ['Payments'], additionalFee: 1250.5, additionalDays: 2 });
  expect(third).toMatchObject({ budgetAmount: null, durationDays: null,
    budgetNotes: 'Additional PHP 7,000 agreed in v2\nAdditional PHP 1,250.5 agreed in v3',
    timelineNotes: 'Additional 5 working days agreed in v2\nAdditional 2 working days agreed in v3',
    missingInformation: original.missingInformation });
});
