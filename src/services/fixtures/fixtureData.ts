import type { SaklawData } from '@/services/contracts';
import { ServiceError } from '@/services/errors';
import { cleanDraft, finiteEstimate, limits, textValue } from '@/safety/validation';
import { validateFindings } from '@/safety/validateFindings';
import type { Agreement, Analysis, Project, Proposal, ScopeDraft } from '@/types/workspace';
import { newId } from '@/utils/ids';
import { getFixtureControls } from './fixtureControls';
import { sampleConversation, sampleScope } from './scenario';

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();

export function createFixtureData(seed = true): SaklawData {
  const projects = new Map<string, Project>();
  const drafts = new Map<string, ScopeDraft>();
  const agreements = new Map<string, Agreement>();
  const analyses = new Map<string, Analysis>();
  const proposals = new Map<string, Proposal>();
  const writable = () => { if (getFixtureControls().saveFailure) throw new ServiceError('save_failed'); };
  const project = (id: string) => {
    const found = projects.get(id);
    if (!found) throw new ServiceError('not_found');
    return found;
  };
  const agreementFor = (projectId: string, id: string, version: number) => {
    project(projectId);
    const found = agreements.get(projectId);
    if (!found || found.id !== id || found.version !== version) throw new ServiceError('not_found');
    return found;
  };
  const analysisFor = (projectId: string, id: string) => {
    const found = analyses.get(id);
    if (!found || found.projectId !== projectId) throw new ServiceError('not_found');
    agreementFor(projectId, found.agreementId, found.agreementVersion);
    return found;
  };
  const touch = (id: string) => { project(id).updatedAt = now(); };
  const strings = (value: string[]) => {
    if (!Array.isArray(value) || !value.length || value.length > limits.items) throw new ServiceError('invalid_input');
    return value.map(t => textValue(t, limits.item));
  };
  if (seed) {
    const id = 'demo-website';
    projects.set(id, { id, name: 'Studio North website', scopeStatus: 'draft', agreementVersion: null, createdAt: now(), updatedAt: now() });
    drafts.set(id, { projectId: id, sourceText: sampleConversation, origin: 'extracted', deliverables: sampleScope.deliverables.map(text => ({ key: newId(), text })), exclusions: sampleScope.exclusions.map(text => ({ key: newId(), text })), terms: copy(sampleScope.terms), missingInformation: [...sampleScope.missingInformation], updatedAt: now() });
  }
  return {
    async listProjects() { return copy([...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))); },
    async createProject(name) {
      const title = textValue(name, limits.name);
      writable();
      const p: Project = { id: newId('project'), name: title, scopeStatus: 'none', agreementVersion: null, createdAt: now(), updatedAt: now() };
      projects.set(p.id, p);
      return copy(p);
    },
    async getProject(id) { return copy(projects.get(id) ?? null); },
    async getDraft(id) { project(id); return copy(drafts.get(id) ?? null); },
    async saveDraft(input) {
      const p = project(input.projectId);
      if (p.scopeStatus === 'confirmed') throw new ServiceError('save_failed');
      const draft = cleanDraft(input);
      writable();
      drafts.set(p.id, copy({ ...draft, updatedAt: now() }));
      p.scopeStatus = 'draft'; touch(p.id);
    },
    async confirmScope(id, input) {
      const p = project(id);
      if (input.projectId !== id) throw new ServiceError('not_found');
      if (agreements.has(id)) throw new ServiceError('save_failed');
      const draft = cleanDraft(input, true);
      const agreement: Agreement = { id: newId('agreement'), projectId: id, version: 1, requirements: [...draft.deliverables.map(item => ({ kind: 'deliverable' as const, text: item.text })), ...draft.exclusions.map(item => ({ kind: 'exclusion' as const, text: item.text }))].map((item, i) => ({ ...item, id: `R${i + 1}` })), terms: copy(draft.terms), confirmedAt: now() };
      writable();
      agreements.set(id, agreement); drafts.delete(id);
      p.scopeStatus = 'confirmed'; p.agreementVersion = 1; touch(id);
      return copy(agreement);
    },
    async getAgreement(id) { project(id); return copy(agreements.get(id) ?? null); },
    async saveAnalysis(input) {
      const agreement = agreementFor(input.projectId, input.agreementId, input.agreementVersion);
      textValue(input.requestText, limits.request); validateFindings(input.findings, agreement);
      writable();
      const result = copy({ ...input, id: newId('analysis'), createdAt: now() });
      analyses.set(result.id, result); touch(input.projectId);
      return copy(result);
    },
    async listAnalyses(id) { project(id); return copy([...analyses.values()].filter(a => a.projectId === id).reverse()); },
    async getAnalysis(id, analysisId) {
      try { return copy(analysisFor(id, analysisId)); } catch { return null; }
    },
    async createProposal(id, analysisId, items) {
      const analysis = analysisFor(id, analysisId);
      const deliverables = strings(items);
      const allowed = new Set(analysis.findings.filter(f => f.classification === 'potential_additional').map(f => f.requestedItem));
      if (deliverables.some(text => !allowed.has(text))) throw new ServiceError('invalid_input');
      writable();
      const proposal: Proposal = { id: newId('proposal'), projectId: id, analysisId, deliverables, feeAmount: null, currency: agreementFor(id, analysis.agreementId, analysis.agreementVersion).terms.currency, extraWorkingDays: null, message: '', status: 'draft', createdAt: now(), updatedAt: now() };
      proposals.set(proposal.id, proposal); touch(id);
      return copy(proposal);
    },
    async getProposal(id, proposalId) {
      const value = proposals.get(proposalId);
      if (!value || value.projectId !== id) return null;
      try { analysisFor(id, value.analysisId); return copy(value); } catch { return null; }
    },
    async saveProposal(input) {
      const saved = proposals.get(input.id);
      if (!saved || saved.projectId !== input.projectId || saved.analysisId !== input.analysisId) throw new ServiceError('not_found');
      analysisFor(input.projectId, input.analysisId);
      const deliverables = strings(input.deliverables);
      if (input.status !== 'draft' || !finiteEstimate(input.feeAmount) || !finiteEstimate(input.extraWorkingDays) || !/^[A-Z]{3}$/.test(input.currency)) throw new ServiceError('invalid_input');
      textValue(input.message, limits.message, true);
      writable();
      const result = copy({ ...input, deliverables, createdAt: saved.createdAt, updatedAt: now() });
      proposals.set(input.id, result); touch(input.projectId);
      return copy(result);
    },
    async listProposals(id) { project(id); return copy([...proposals.values()].filter(p => p.projectId === id).reverse()); },
  };
}
