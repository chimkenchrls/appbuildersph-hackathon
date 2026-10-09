export type ScopeStatus = 'none' | 'draft' | 'confirmed';
export type Classification = 'included' | 'potential_additional' | 'needs_clarification';
export type AiStatus = 'unavailable' | 'loading' | 'ready' | 'busy';

export interface Project {
  id: string;
  name: string;
  scopeStatus: ScopeStatus;
  agreementVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScopeTerms {
  budgetAmount: number | null;
  currency: string;            // 'PHP' by default; recorded user data
  timeline: string | null;     // free text, e.g. "two weeks"
  revisionTerms: string | null;
}

export interface DraftItem { key: string; text: string }   // key is a local list key

export interface ScopeDraft {
  projectId: string;
  sourceText: string;          // pasted conversation; '' for manual entry
  origin: 'extracted' | 'manual';
  deliverables: DraftItem[];
  exclusions: DraftItem[];
  terms: ScopeTerms;
  missingInformation: string[];
  updatedAt: string;
}

export interface ExtractedScope {                          // what the AI returns
  deliverables: string[];
  exclusions: string[];
  terms: ScopeTerms;
  missingInformation: string[];
}

export interface Requirement {
  id: string;                  // stable within an agreement: 'R1', 'R2', ...
  kind: 'deliverable' | 'exclusion';
  text: string;
}

export interface Agreement {
  id: string;
  projectId: string;
  version: number;             // 1 for the MVP
  requirements: Requirement[];
  terms: ScopeTerms;
  confirmedAt: string;
}

export interface Finding {
  id: string;
  requestedItem: string;
  classification: Classification;
  explanation: string;
  evidenceRequirementIds: string[];
  clarificationQuestions: string[];
}

export interface Analysis {
  id: string;
  projectId: string;
  agreementId: string;
  agreementVersion: number;
  requestText: string;
  findings: Finding[];
  createdAt: string;
}
export type NewAnalysis = Omit<Analysis, 'id' | 'createdAt'>;

export interface Proposal {
  id: string;
  projectId: string;
  analysisId: string;
  deliverables: string[];
  feeAmount: number | null;
  currency: string;
  extraWorkingDays: number | null;
  message: string;
  status: 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface ProposalInput {
  agreement: Agreement;
  requestText: string;
  deliverables: string[];
  feeAmount: number | null;
  currency: string;
  extraWorkingDays: number | null;
}
