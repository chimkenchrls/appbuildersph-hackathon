/**
 * The one fictional agreement the landing page uses everywhere. It is demo data,
 * and every surface that shows it says so.
 */
export const PROJECT_NAME = 'Café Amihan website';

export const CLAUSES = [
  { id: 'R1', text: 'Five responsive pages: Home, Menu, About, Gallery, Contact', said: '5 pages, right? Home, Menu, About, Gallery, Contact' },
  { id: 'R2', text: 'Contact form on the Contact page', said: 'and a contact form so people can message us' },
  { id: 'T1', text: 'Budget: PHP 15,000', said: 'PHP 15,000 ok' },
  { id: 'T2', text: 'Timeline: two weeks', said: 'two weeks?' },
  { id: 'T3', text: 'Two rounds of revisions', said: 'two rounds of revisions is fine' },
] as const;

export type ClauseId = (typeof CLAUSES)[number]['id'];

export type FindingKind = 'included' | 'potential_additional' | 'needs_clarification';

/** Prepared results for the demo. Nothing on the page runs AI. */
export const REQUESTS: { ask: string; kind: FindingKind; why: string; cites: ClauseId[]; question?: string }[] = [
  {
    ask: 'Can you add customer accounts so regulars can log in?',
    kind: 'potential_additional',
    why: 'Not found in the recorded scope. R1 and R2 cover pages and a contact form. Nothing recorded excludes accounts either, so this is yours to review.',
    cites: ['R1', 'R2'],
  },
  {
    ask: 'Please make sure the Menu page works on phones.',
    kind: 'included',
    why: 'R1 records the Menu page as one of five responsive pages.',
    cites: ['R1'],
  },
  {
    ask: 'Could you swap the hero photo on the Home page?',
    kind: 'needs_clarification',
    why: 'This may fall under the recorded revision terms, but the request does not say so.',
    cites: ['R1', 'T3'],
    question: 'Ask the client: is this one of the two agreed revision rounds?',
  },
];
