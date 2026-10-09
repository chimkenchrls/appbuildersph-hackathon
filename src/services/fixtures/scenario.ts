import type { ExtractedScope } from '@/types/workspace';

export const sampleConversation = 'Client: I need five responsive website pages and a contact form. Our budget is PHP 15,000, with a two-week timeline and two revision rounds. Freelancer: Noted. Hosting and ongoing maintenance are not part of this project.';
export const sampleRequest = 'Could you adjust the contact form copy, add customer accounts and appointment booking, and make a few more revisions?';
export const sampleScope: ExtractedScope = {
  deliverables: ['Five responsive website pages', 'Contact form'],
  exclusions: ['Hosting and ongoing maintenance'],
  terms: { budgetAmount: 15000, currency: 'PHP', timeline: 'Two weeks', revisionTerms: 'Two revision rounds' },
  missingInformation: ['Confirm the page names and the project start date.'],
};
