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

    const existingAgreements = await this.agreementRepo.listByProjectId(projectId);
    const nextVersion = existingAgreements.length > 0 ? existingAgreements[0].versionNumber + 1 : 1;

    const id = `agmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const title = customTitle?.trim() || `${draft.title}: Agreement v${nextVersion}`;

    const agreement: Agreement = {
      id,
      projectId,
      versionNumber: nextVersion,
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

    return this.agreementRepo.create(agreement);
  }

  async acceptScopeChange(options: {
    projectId: string;
    currentAgreement: Agreement;
    additionalDeliverables: (string | { title: string; description?: string })[];
    additionalFee?: number | null;
    additionalDays?: number | null;
    customTitle?: string;
    clientSignatoryName?: string;
    clientSignatureData?: string;
  }): Promise<Agreement> {
    const {
      projectId,
      currentAgreement,
      additionalDeliverables,
      additionalFee,
      additionalDays,
      customTitle,
      clientSignatoryName,
      clientSignatureData,
    } = options;

    const existingAgreements = await this.agreementRepo.listByProjectId(projectId);
    const nextVersion =
      existingAgreements.length > 0
        ? existingAgreements[0].versionNumber + 1
        : currentAgreement.versionNumber + 1;

    // Build new requirements
    const currentRequirements = [...currentAgreement.requirements];
    let nextReqNum = currentRequirements.length + 1;

    const newRequirements = additionalDeliverables.map((item) => {
      const id = `REQ-${String(nextReqNum++).padStart(2, '0')}`;
      const title = typeof item === 'string' ? item : item.title;
      const description =
        (typeof item === 'object' && item.description) ||
        `Agreed deliverable addition incorporated into Agreement v${nextVersion}.`;
      return {
        id,
        title,
        description,
        category: 'deliverable' as const,
      };
    });

    const updatedRequirements = [...currentRequirements, ...newRequirements];
    const updatedBudget = (currentAgreement.budgetAmount || 0) + (additionalFee || 0);
    const updatedDays = (currentAgreement.durationDays || 0) + (additionalDays || 0);

    const baseTitle = currentAgreement.title.split(' · ')[0] || 'Project Scope';

    const draftToConfirm: ScopeDraft = {
      title: baseTitle,
      requirements: updatedRequirements,
      budgetAmount: updatedBudget > 0 ? updatedBudget : currentAgreement.budgetAmount,
      budgetCurrency: currentAgreement.budgetCurrency,
      budgetNotes: currentAgreement.budgetNotes,
      durationDays: updatedDays > 0 ? updatedDays : currentAgreement.durationDays,
      deadline: currentAgreement.deadline,
      timelineNotes: additionalDays
        ? `${updatedDays} days (extended by ${additionalDays} days for additions)`
        : currentAgreement.timelineNotes,
      revisionTerms: currentAgreement.revisionTerms,
      exclusions: currentAgreement.exclusions,
      missingInformation: currentAgreement.missingInformation,
      taxTreatment: currentAgreement.taxTreatment,
    };

    const newAgmt = await this.confirmScope(
      projectId,
      draftToConfirm,
      customTitle || `${baseTitle} · Agreement v${nextVersion}`,
    );

    if (clientSignatoryName) {
      await this.agreementRepo.recordClientApproval(
        newAgmt.id,
        clientSignatoryName,
        clientSignatureData,
      );
      const withApproval = await this.agreementRepo.getById(newAgmt.id);
      if (withApproval) return withApproval;
    }

    return newAgmt;
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

  async recordClientApproval(
    agreementId: string,
    signatoryName: string,
    signatureData?: string,
  ): Promise<Agreement | null> {
    await this.agreementRepo.recordClientApproval(agreementId, signatoryName, signatureData);
    return this.agreementRepo.getById(agreementId);
  }
}
