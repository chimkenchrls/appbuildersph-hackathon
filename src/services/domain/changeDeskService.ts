import type { LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildChangeDeskPrompt } from '@/llm/prompts/changeDeskPrompt';
import { composeProposalMessage } from '@/safety/proposalMessage';
import { ChangeDeskRawOutputSchema } from '@/types/schemas';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import type { ProposalRepository } from '@/database/repositories/proposalRepository';
import type { ChangeProposal, ProposalStatus } from '@/types/domain';

export class ChangeDeskService {
  constructor(
    private readonly engine: LLMEngine,
    private readonly agreementRepo: AgreementRepository,
    private readonly scopeGuardRepo: ScopeGuardRepository,
    private readonly proposalRepo: ProposalRepository,
  ) {}

  async draftProposal(options: {
    projectId: string;
    analysisId: string;
    selectedItems: string[];
    freelancerFeeEstimate: number | null;
    freelancerDaysEstimate: number | null;
    currency?: string;
  }): Promise<ChangeProposal> {
    const {
      projectId,
      analysisId,
      selectedItems,
      freelancerFeeEstimate,
      freelancerDaysEstimate,
      currency = 'PHP',
    } = options;

    if (!selectedItems || selectedItems.length === 0) {
      throw new Error('At least one additional item must be selected to draft a proposal');
    }

    const analysis = await this.scopeGuardRepo.getAnalysisById(analysisId);
    if (!analysis) {
      throw new Error(`Referenced analysis ${analysisId} was not found`);
    }

    const agreement = await this.agreementRepo.getById(analysis.agreementId);
    const agreementTitle = agreement ? agreement.title : 'Initial Agreement';

    const messages = buildChangeDeskPrompt({ agreementTitle, selectedItems });

    const rawOutput = await this.engine.generate(messages, {
      temperature: 0.4,
      maxTokens: 1000,
    });

    const parsed = parseAndValidateJson(rawOutput, ChangeDeskRawOutputSchema);

    const now = new Date().toISOString();
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const proposal: ChangeProposal = {
      id: proposalId,
      projectId,
      analysisId,
      selectedItems,
      freelancerFeeEstimate,
      freelancerDaysEstimate,
      currency,
      draftMessage: composeProposalMessage(parsed.draft_message, {
        deliverables: selectedItems,
        feeAmount: freelancerFeeEstimate,
        currency,
        extraWorkingDays: freelancerDaysEstimate,
      }),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    return this.proposalRepo.create(proposal);
  }

  async updateProposal(
    id: string,
    updates: {
      draftMessage?: string;
      status?: ProposalStatus;
      freelancerFeeEstimate?: number | null;
      freelancerDaysEstimate?: number | null;
    },
  ): Promise<ChangeProposal | null> {
    return this.proposalRepo.update(id, updates);
  }

  async getProposalById(id: string): Promise<ChangeProposal | null> {
    return this.proposalRepo.getById(id);
  }

  async listProposalsByProjectId(projectId: string): Promise<ChangeProposal[]> {
    return this.proposalRepo.listByProjectId(projectId);
  }
}
