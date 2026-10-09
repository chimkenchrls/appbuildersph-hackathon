import { conflictingExclusions } from '@/safety/scopeExclusions';
import type { Requirement } from '@/types/domain';

const deliverable = (title: string): Requirement => ({ id: title, title, description: '', category: 'deliverable' });

test('matches complete exclusion names with case, spacing and the add action prefix', () => {
  expect(conflictingExclusions({ requirements: [deliverable('Add  Online Ordering.'), deliverable('PAYMENTS')],
    exclusions: ['online ordering', ' payments ', 'hosting fees'] })).toEqual(['online ordering', ' payments ']);
});

test('preserves broader, qualified and unrelated exclusions and ignores terms', () => {
  expect(conflictingExclusions({ requirements: [deliverable('Payment button'), deliverable('Hosting'),
    { ...deliverable('Maintenance'), category: 'term' }],
    exclusions: ['Payment processing', 'Hosting fees', 'Maintenance', 'No online ordering'] })).toEqual([]);
});
