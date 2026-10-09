import { overallClassification } from '@/safety/persistedSchemas';
import type * as Backend from '@/types/domain';
import type { Agreement, Analysis, ExtractedScope, Finding, Project, Proposal, Requirement, ScopeDraft, ScopeStatus, ScopeTerms } from '@/types/workspace';

// The backend stores a requirement as a title plus a description; the screens show one text.
const requirementText = (item: Backend.Requirement) => {
  const title = item.title.trim();
  const description = item.description.trim();
  return description && description !== title ? `${title}: ${description}` : title;
};

type BackendTimeline = Pick<Backend.Agreement, 'durationDays' | 'deadline' | 'timelineNotes'>;
function timelineText({ durationDays, deadline, timelineNotes }: BackendTimeline): string | null {
  const parts = [
    durationDays === null ? null : `${durationDays} days`,
    deadline ? `Deadline: ${deadline}` : null,
    timelineNotes?.trim() || null,
  ].filter(part => part !== null);
  return parts.length ? parts.join(' · ') : null;
}

// Recorded currencies are three-letter codes; anything else falls back to the project default.
const currencyCode = (value: string | null | undefined) => {
  const code = (value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'PHP';
};

const requirementId = (index: number) => `REQ-${String(index + 1).padStart(2, '0')}`;

export function toWorkspaceProject(project: Backend.Project, scopeStatus: ScopeStatus, agreementVersion: number | null): Project {
  return { id: project.id, name: project.title, scopeStatus, agreementVersion, createdAt: project.createdAt, updatedAt: project.updatedAt };
}

function toTerms(source: Backend.Agreement | Backend.ScopeDraft): ScopeTerms {
  return {
    budgetAmount: source.budgetAmount,
    currency: currencyCode(source.budgetCurrency),
    timeline: timelineText(source),
    revisionTerms: source.revisionTerms?.trim() || null,
  };
}

export function toWorkspaceAgreement(agreement: Backend.Agreement): Agreement {
  const requirements: Requirement[] = agreement.requirements.map(item => ({ id: item.id, kind: item.category, text: requirementText(item) }));
  // The backend keeps exclusions as plain strings. They get display ids of their own,
  // which the model is never shown and so cannot cite as evidence.
  const recorded = new Set(requirements.filter(item => item.kind === 'exclusion').map(item => item.text));
  agreement.exclusions.filter(text => !recorded.has(text)).forEach((text, index) => {
    requirements.push({ id: `EXC-${String(index + 1).padStart(2, '0')}`, kind: 'exclusion', text });
  });
  return {
    id: agreement.id,
    projectId: agreement.projectId,
    version: agreement.versionNumber,
    requirements,
    terms: toTerms(agreement),
    confirmedAt: agreement.confirmedAt,
  };
}

/** A reviewed draft in the backend's shape. `draft` must already be cleaned of empty rows. */
export function toBackendDraft(title: string, draft: ScopeDraft): Backend.ScopeDraft {
  const requirements: Backend.Requirement[] = draft.deliverables.map((item, index) => ({
    id: requirementId(index), title: item.text, description: '', category: 'deliverable',
  }));
  // Same convention as BriefCraft: recorded revision terms are a citable requirement.
  if (draft.terms.revisionTerms) {
    requirements.push({ id: requirementId(requirements.length), title: 'Revision allowances', description: draft.terms.revisionTerms, category: 'term' });
  }
  return {
    title,
    requirements,
    budgetAmount: draft.terms.budgetAmount,
    budgetCurrency: draft.terms.currency,
    budgetNotes: null,
    durationDays: null,
    deadline: null,
    timelineNotes: draft.terms.timeline,
    revisionTerms: draft.terms.revisionTerms,
    exclusions: draft.exclusions.map(item => item.text),
    missingInformation: draft.missingInformation,
    // The screens do not collect a tax treatment, so none is asserted.
    taxTreatment: 'none_specified',
  };
}

export function toExtractedScope(draft: Backend.ScopeDraft): ExtractedScope {
  return {
    deliverables: draft.requirements.filter(item => item.category === 'deliverable').map(requirementText),
    exclusions: draft.exclusions,
    terms: toTerms(draft),
    missingInformation: draft.missingInformation,
  };
}

/**
 * The backend records clarification questions once per analysis; the screens show them
 * on a finding. They attach to the first finding that is not `included`, or the first one.
 */
export function toWorkspaceFindings(findings: Backend.Finding[], questions: string[]): Finding[] {
  const mapped: Finding[] = findings.map((finding, index) => ({
    id: `F${index + 1}`,
    requestedItem: finding.item,
    classification: finding.classification,
    explanation: finding.explanation,
    evidenceRequirementIds: finding.evidenceRequirementIds ?? [],
    clarificationQuestions: [],
  }));
  if (mapped.length && questions.length) {
    const target = mapped.find(finding => finding.classification !== 'included') ?? mapped[0];
    target.clarificationQuestions = [...questions];
  }
  return mapped;
}

export function toWorkspaceAnalysis(analysis: Backend.ScopeGuardAnalysis, request: Backend.ClientRequest, agreement: Backend.Agreement): Analysis {
  return {
    id: analysis.id,
    projectId: request.projectId,
    agreementId: analysis.agreementId,
    agreementVersion: agreement.versionNumber,
    requestText: request.rawText,
    findings: toWorkspaceFindings(analysis.findings, analysis.clarificationQuestions),
    createdAt: analysis.createdAt,
  };
}

/** The backend's per-analysis fields, derived from the findings the freelancer was shown. */
export function toBackendAnalysisFields(findings: Finding[]) {
  const classification = overallClassification(findings);
  return {
    classification,
    summary: `Reviewed ${findings.length} requested ${findings.length === 1 ? 'item' : 'items'}.`,
    findings: findings.map(finding => ({
      item: finding.requestedItem,
      classification: finding.classification,
      explanation: finding.explanation,
      evidenceRequirementIds: finding.evidenceRequirementIds,
    })),
    clarificationQuestions: [...new Set(findings.flatMap(finding => finding.clarificationQuestions))],
  };
}

export function toWorkspaceProposal(proposal: Backend.ChangeProposal): Proposal {
  return {
    id: proposal.id,
    projectId: proposal.projectId,
    analysisId: proposal.analysisId,
    deliverables: proposal.selectedItems,
    feeAmount: proposal.freelancerFeeEstimate,
    currency: currencyCode(proposal.currency),
    extraWorkingDays: proposal.freelancerDaysEstimate,
    message: proposal.draftMessage,
    // The screens only ever save drafts; they have no sent or accepted state.
    status: 'draft',
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  };
}
