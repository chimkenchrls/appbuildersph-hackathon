import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeDraft, Agreement, ContractOptions } from '@/types/domain';
import { ContractGeneratorService } from './contractGeneratorService';
import { ServiceError } from './errors';
import { finiteEstimate, wholeWorkingDays, limits, textValue } from '@/safety/validation';
import { conflictingExclusions } from '@/safety/scopeExclusions';

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
      currentAgreement: requestedAgreement,
      additionalDeliverables,
      additionalFee,
      additionalDays,
      customTitle,
      clientSignatoryName,
      clientSignatureData,
    } = options;

    const currentAgreement = await this.agreementRepo.getLatestByProjectId(projectId);
    if (!currentAgreement || requestedAgreement.projectId !== projectId || currentAgreement.id !== requestedAgreement.id) throw new ServiceError('conflict');
    if (!Array.isArray(additionalDeliverables) || !additionalDeliverables.length || additionalDeliverables.length > limits.items
      || !finiteEstimate(additionalFee ?? null) || !wholeWorkingDays(additionalDays ?? null)) throw new ServiceError('invalid_input');
    const nextVersion = currentAgreement.versionNumber + 1;

    // Build new requirements
    const currentRequirements = [...currentAgreement.requirements];
    let nextReqNum = currentRequirements.length + 1;
    const requirementIds = new Set(currentRequirements.map(requirement => requirement.id));

    const newRequirements = additionalDeliverables.map((item) => {
      while (requirementIds.has(`REQ-${String(nextReqNum).padStart(2, '0')}`)) nextReqNum++;
      const id = `REQ-${String(nextReqNum++).padStart(2, '0')}`;
      requirementIds.add(id);
      const title = textValue(typeof item === 'string' ? item : item?.title, limits.item);
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
    const conflicts = conflictingExclusions({ requirements: updatedRequirements, exclusions: currentAgreement.exclusions });
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
      exclusions: currentAgreement.exclusions.filter(item => !conflicts.includes(item)),
      missingInformation: currentAgreement.missingInformation,
      taxTreatment: currentAgreement.taxTreatment,
    };

    const now = new Date().toISOString();
    return this.agreementRepo.createRevision({
      ...draftToConfirm,
      id: `agmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      projectId, versionNumber: nextVersion,
      title: customTitle?.trim() || `${baseTitle} · Agreement v${nextVersion}`,
      confirmedAt: now,
      ...(clientSignatoryName ? { clientApprovedAt: now, clientSignatoryName, clientSignatureData: clientSignatureData ?? null } : {}),
    }, currentAgreement.id);
  }

  /** Correct a sealed scope by adding a version, keeping every earlier record intact. */
  async resolveExclusionConflicts(projectId: string, requestedAgreement: Agreement): Promise<Agreement> {
    const current = await this.agreementRepo.getLatestByProjectId(projectId);
    if (!current || requestedAgreement.projectId !== projectId || current.id !== requestedAgreement.id) throw new ServiceError('conflict');
    const conflicts = conflictingExclusions(current);
    if (!conflicts.length) throw new ServiceError('invalid_input');
    const nextVersion = current.versionNumber + 1;
    return this.agreementRepo.createRevision({
      ...current,
      id: `agmt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      versionNumber: nextVersion,
      title: `${current.title.split(' · ')[0]} · Agreement v${nextVersion}`,
      exclusions: current.exclusions.filter(item => !conflicts.includes(item)),
      confirmedAt: new Date().toISOString(),
      clientApprovedAt: null, clientSignatoryName: null, clientSignatureData: null,
    }, current.id);
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
