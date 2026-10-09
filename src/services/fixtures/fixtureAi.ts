import type { SaklawAi } from '@/services/contracts';
import { checkCancelled, ServiceError } from '@/services/errors';
import type { AiStatus } from '@/types/workspace';
import { getFixtureControls, subscribeFixtureControls } from './fixtureControls';
import { sampleScope } from './scenario';

export function createFixtureAi(): SaklawAi {
  let busy = false;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(fn => fn());
  const getStatus = (): AiStatus => getFixtureControls().unavailable ? 'unavailable' : busy ? 'busy' : 'ready';
  async function run<T>(signal: AbortSignal, result: () => T): Promise<T> {
    checkCancelled(signal);
    if (getStatus() !== 'ready') throw new ServiceError('model_unavailable');
    busy = true; emit();
    try {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); };
        const abort = () => { cleanup(); reject(new ServiceError('cancelled')); };
        const timer = setTimeout(() => { cleanup(); resolve(); }, getFixtureControls().slow ? 12000 : 1600);
        signal.addEventListener('abort', abort, { once: true });
      });
      checkCancelled(signal);
      if (getFixtureControls().invalid) throw new ServiceError('invalid_output');
      return result();
    } finally { busy = false; emit(); }
  }
  return {
    getStatus,
    subscribe(listener) { listeners.add(listener); const off = subscribeFixtureControls(listener); return () => { listeners.delete(listener); off(); }; },
    extractScope: (_, signal) => run(signal, () => JSON.parse(JSON.stringify(sampleScope))),
    analyzeRequest: (agreement, _, signal) => run(signal, () => {
      const contact = agreement.requirements.find(r => r.kind === 'deliverable' && /contact form/i.test(r.text));
      return [
        { id: 'sample-copy', requestedItem: 'Adjust the contact form copy', classification: contact ? 'included' as const : 'needs_clarification' as const, explanation: contact ? 'The recorded scope includes a contact form. Review whether this wording adjustment fits your revision terms.' : 'The sample request needs a matching recorded deliverable before it can be classified.', evidenceRequirementIds: contact ? [contact.id] : [], clarificationQuestions: contact ? [] : ['Is a contact form part of the intended deliverables?'] },
        { id: 'sample-accounts', requestedItem: 'Customer accounts and appointment booking', classification: 'potential_additional' as const, explanation: 'In the prepared website example, these features are not explicitly included. Review them before proposing additional work.', evidenceRequirementIds: [], clarificationQuestions: [] },
        { id: 'sample-revisions', requestedItem: 'A few more revisions', classification: 'needs_clarification' as const, explanation: `Clarify what will change and compare it with the recorded revision terms: ${agreement.terms.revisionTerms ?? 'Not specified'}.`, evidenceRequirementIds: [], clarificationQuestions: ['Which changes are requested, and how do they relate to the agreed revision rounds?'] },
      ];
    }),
    draftProposalMessage: (input, signal) => run(signal, () => {
      const fee = input.feeAmount === null ? 'The additional fee is still to be agreed.' : `My proposed additional fee is ${input.currency} ${input.feeAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })}.`;
      const days = input.extraWorkingDays === null ? 'The additional timeline is still to be agreed.' : `I propose ${input.extraWorkingDays} additional working days.`;
      return `Thanks for sharing your request. I would like to propose the following additions for your review:\n\n${input.deliverables.map(text => `• ${text}`).join('\n')}\n\n${fee} ${days}\n\nPlease let me know if this works for you. This is a draft proposal; the confirmed scope remains unchanged until we separately agree on any changes.`;
    }),
  };
}
