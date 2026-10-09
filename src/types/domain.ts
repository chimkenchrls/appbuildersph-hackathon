export type Classification = 'included' | 'potential_additional' | 'needs_clarification';

export type RequirementCategory = 'deliverable' | 'term' | 'exclusion';

export type ProposalStatus = 'draft' | 'copied' | 'sent';

export type TaxTreatment =
  | 'net_of_withholding'
  | 'inclusive'
  | 'subject_to_2307'
  | 'none_specified';

export interface ContractOptions {
  freelancerName?: string;
  freelancerTin?: string;
  freelancerAddress?: string;
  clientName?: string;
  clientTin?: string;
  clientAddress?: string;
  taxTreatment?: TaxTreatment;
  paymentMethod?: string;
}

export interface Requirement {
  id: string; // e.g. REQ-01
  title: string;
  description: string;
  category: RequirementCategory;
}

export interface ScopeDraft {
  title: string;
  requirements: Requirement[];
  budgetAmount: number | null; // In main units, e.g. 15000 PHP
  budgetCurrency: string;
  budgetNotes: string | null;
  durationDays: number | null;
  deadline: string | null;
  timelineNotes: string | null;
  revisionTerms: string | null;
  exclusions: string[];
  missingInformation: string[];
  taxTreatment?: TaxTreatment;
}

export interface Project {
  id: string;
  title: string;
  clientName: string | null;
  description: string | null;
  draftScopeJson?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agreement {
  id: string;
  projectId: string;
  versionNumber: number;
  title: string;
  requirements: Requirement[];
  budgetAmount: number | null;
  budgetCurrency: string;
  budgetNotes: string | null;
  durationDays: number | null;
  deadline: string | null;
  timelineNotes: string | null;
  revisionTerms: string | null;
  exclusions: string[];
  missingInformation: string[];
  taxTreatment?: TaxTreatment;
  confirmedAt: string;
}

export interface ClientRequest {
  id: string;
  projectId: string;
  agreementId: string;
  rawText: string;
  createdAt: string;
}

export interface Finding {
  item: string;
  classification: Classification;
  explanation: string;
  evidenceRequirementIds: string[];
}

export interface ScopeGuardAnalysis {
  id: string;
  requestId: string;
  agreementId: string;
  classification: Classification;
  summary: string;
  findings: Finding[];
  clarificationQuestions: string[];
  createdAt: string;
}

export interface ChangeProposal {
  id: string;
  projectId: string;
  analysisId: string;
  selectedItems: string[];
  freelancerFeeEstimate: number | null;
  freelancerDaysEstimate: number | null;
  currency: string;
  draftMessage: string;
  status: ProposalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppSetting {
  key: string;
  value: string;
}
