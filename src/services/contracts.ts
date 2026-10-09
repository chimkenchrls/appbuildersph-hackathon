import type { Agreement, AiStatus, Analysis, ExtractedScope, Finding, NewAnalysis, Project, Proposal, ProposalInput, ScopeDraft } from '@/types/workspace';

export interface SaklawData {
  listProjects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  getProject(id: string): Promise<Project | null>;
  getDraft(projectId: string): Promise<ScopeDraft | null>;
  saveDraft(draft: ScopeDraft): Promise<void>;
  confirmScope(projectId: string, draft: ScopeDraft): Promise<Agreement>;
  getAgreement(projectId: string): Promise<Agreement | null>;
  saveAnalysis(analysis: NewAnalysis): Promise<Analysis>;
  listAnalyses(projectId: string): Promise<Analysis[]>;
  getAnalysis(projectId: string, id: string): Promise<Analysis | null>;
  createProposal(projectId: string, analysisId: string, deliverables: string[]): Promise<Proposal>;
  getProposal(projectId: string, id: string): Promise<Proposal | null>;
  saveProposal(proposal: Proposal): Promise<Proposal>;
  listProposals(projectId: string): Promise<Proposal[]>;
}

export interface SaklawAi {
  getStatus(): AiStatus;
  subscribe(listener: () => void): () => void;
  extractScope(sourceText: string, signal: AbortSignal): Promise<ExtractedScope>;
  analyzeRequest(agreement: Agreement, requestText: string, signal: AbortSignal): Promise<Finding[]>;
  draftProposalMessage(input: ProposalInput, signal: AbortSignal): Promise<string>;
}
