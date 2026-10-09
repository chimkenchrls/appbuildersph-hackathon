import type { Agreement } from '@/types/domain';

function itemKey(text: string): string {
  return text.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/^add /, '').replace(/[.!?]+$/, '').trim();
}

/** Match complete item names only; a narrower addition must not remove a broader exclusion. */
export function conflictingExclusions(scope: Pick<Agreement, 'requirements' | 'exclusions'>): string[] {
  const included = new Set(scope.requirements.filter(item => item.category === 'deliverable').map(item => itemKey(item.title)));
  return scope.exclusions.filter(item => included.has(itemKey(item)));
}
