import type { SaklawAi, SaklawData } from './contracts';
import { checkCancelled, ServiceError } from './errors';
import { cleanDraft, limits, textValue } from '@/safety/validation';
import { validateFindings } from '@/safety/validateFindings';
import type { NewAnalysis, Proposal, ScopeDraft } from '@/types/workspace';
import { newId } from '@/utils/ids';

export function createWorkflows(data: SaklawData, ai: SaklawAi) {
  async function boundAnalysis(projectId: string, analysisId: string) {
    const analysis = await data.getAnalysis(projectId, analysisId);
    const agreement = await data.getAgreement(projectId);
    if (!analysis || !agreement || analysis.projectId !== projectId || agreement.projectId !== projectId || analysis.agreementId !== agreement.id || analysis.agreementVersion !== agreement.version) throw new ServiceError('not_found');
    validateFindings(analysis.findings, agreement);
    return { analysis, agreement };
  }
  return {
    async extractDraft(projectId: string, sourceText: string, signal: AbortSignal): Promise<ScopeDraft> {
      checkCancelled(signal); textValue(sourceText, limits.source);
      if (!(await data.getProject(projectId))) throw new ServiceError('not_found');
      checkCancelled(signal);
      const output = await ai.extractScope(sourceText, signal);
      checkCancelled(signal);
      try {
        return cleanDraft({ projectId, sourceText, origin: 'extracted', deliverables: output.deliverables.map(text => ({ key: newId(), text })), exclusions: output.exclusions.map(text => ({ key: newId(), text })), terms: output.terms, missingInformation: output.missingInformation, updatedAt: new Date().toISOString() }, true);
      } catch { throw new ServiceError('invalid_output'); }
    },
    confirmDraft: (projectId: string, draft: ScopeDraft) => data.confirmScope(projectId, cleanDraft(draft, true)),
    async analyzeRequest(projectId: string, requestText: string, signal: AbortSignal): Promise<NewAnalysis> {
      checkCancelled(signal); textValue(requestText, limits.request);
      const agreement = await data.getAgreement(projectId);
      if (!agreement || agreement.projectId !== projectId) throw new ServiceError('not_found');
      checkCancelled(signal);
      const findings = await ai.analyzeRequest(agreement, requestText, signal);
      checkCancelled(signal); validateFindings(findings, agreement);
      return { projectId, agreementId: agreement.id, agreementVersion: agreement.version, requestText, findings };
    },
    async startProposal(projectId: string, analysisId: string, selectedFindingIds: string[]) {
      const { analysis } = await boundAnalysis(projectId, analysisId);
      const selected = [...new Set(selectedFindingIds)].map(id => analysis.findings.find(f => f.id === id));
      if (!selected.length || selected.some(f => !f || f.classification !== 'potential_additional')) throw new ServiceError('invalid_input');
      return data.createProposal(projectId, analysisId, selected.map(f => f!.requestedItem));
    },
    async generateMessage(proposal: Proposal, signal: AbortSignal) {
      checkCancelled(signal);
      const stored = await data.getProposal(proposal.projectId, proposal.id);
      if (!stored || stored.analysisId !== proposal.analysisId || stored.projectId !== proposal.projectId) throw new ServiceError('not_found');
      checkCancelled(signal);
      const { analysis, agreement } = await boundAnalysis(proposal.projectId, proposal.analysisId);
      checkCancelled(signal);
      const message = await ai.draftProposalMessage({ agreement, requestText: analysis.requestText, deliverables: [...proposal.deliverables], feeAmount: proposal.feeAmount, currency: proposal.currency, extraWorkingDays: proposal.extraWorkingDays }, signal);
      checkCancelled(signal);
      try { return textValue(message, limits.message); } catch { throw new ServiceError('invalid_output'); }
    },
  };
}
