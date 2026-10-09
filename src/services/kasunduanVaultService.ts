import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeDraft, Agreement, ContractOptions } from '@/types/domain';
import { ContractGeneratorService } from './contractGeneratorService';

export class KasunduanVaultService {
  constructor(private readonly agreementRepo: AgreementRepository) {}

  async confirmScope(
    projectId: string,
    draft: ScopeDraft,
    customTitle?: string,
  ): Promise<Agreement> {
    if (!draft.requirements || draft.requirements.length === 0) {
      throw new Error('Cannot confirm an empty scope. At least one deliverable is required.');
    }

    const id = `agmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const title = customTitle?.trim() || `${draft.title}: Agreement v1`;

    const agreement: Agreement = {
      id,
      projectId,
      versionNumber: 1,
      title,
      requirements: draft.requirements,
      budgetAmount: draft.budgetAmount,
      budgetCurrency: draft.budgetCurrency,
      budgetNotes: draft.budgetNotes,
      durationDays: draft.durationDays,
      deadline: draft.deadline,
      timelineNotes: draft.timelineNotes,
      revisionTerms: draft.revisionTerms,
      exclusions: draft.exclusions,
      missingInformation: draft.missingInformation,
      taxTreatment: draft.taxTreatment || 'net_of_withholding',
      confirmedAt: now,
    };

    return this.agreementRepo.createInitial(agreement);
  }

  generateContract(agreement: Agreement, options?: ContractOptions): string {
    return ContractGeneratorService.generateContractText(agreement, options);
  }

  async getLatestAgreement(projectId: string): Promise<Agreement | null> {
    return this.agreementRepo.getLatestByProjectId(projectId);
  }

  async listAgreements(projectId: string): Promise<Agreement[]> {
    return this.agreementRepo.listByProjectId(projectId);
  }
}
