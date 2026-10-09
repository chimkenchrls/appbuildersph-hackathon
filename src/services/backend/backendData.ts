import type { SaklawData } from '@/services/contracts';
import { ServiceError } from '@/services/errors';
import { cleanDraft, finiteEstimate, limits, textValue } from '@/safety/validation';
import { validateFindings } from '@/safety/validateFindings';
import type * as Backend from '@/types/domain';
import type { ScopeDraft, ScopeStatus } from '@/types/workspace';
import { toBackendAnalysisFields, toBackendDraft, toWorkspaceAgreement, toWorkspaceAnalysis, toWorkspaceProject, toWorkspaceProposal } from './mappers';
import type { BackendPorts } from './ports';

// The backend has no table for an unconfirmed scope draft, so the reviewed draft is kept
// as JSON in its settings store. An empty value means there is no draft.
const draftKey = (projectId: string) => `saklaw_scope_draft:${projectId}`;

// Same shape as the ids the backend services generate.
const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

/** Runs a write; anything that is not already a ServiceError becomes a save failure. */
async function write<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError('save_failed', error instanceof Error ? error.message : undefined);
  }
}

function items(value: string[]): string[] {
  if (!Array.isArray(value) || !value.length || value.length > limits.items) throw new ServiceError('invalid_input');
  return value.map(text => textValue(text, limits.item));
}

/** SaklawData over the backend's SQLite repositories and services. */
export function createBackendData(getPorts: () => Promise<BackendPorts>): SaklawData {
  async function requireProject(ports: BackendPorts, id: string) {
    const project = await ports.projects.getById(id);
    if (!project) throw new ServiceError('not_found');
    return project;
  }

  async function readDraft(ports: BackendPorts, projectId: string): Promise<ScopeDraft | null> {
    const stored = await ports.settings.get(draftKey(projectId));
    if (!stored) return null;
    try {
      return cleanDraft(JSON.parse(stored) as ScopeDraft);
    } catch {
      return null;
    }
  }

  async function scopeState(ports: BackendPorts, projectId: string): Promise<{ status: ScopeStatus; version: number | null }> {
    const agreement = await ports.agreements.getLatestByProjectId(projectId);
    if (agreement) return { status: 'confirmed', version: agreement.versionNumber };
    return { status: (await readDraft(ports, projectId)) ? 'draft' : 'none', version: null };
  }

  /** An analysis with the request and agreement it belongs to, or null if any link is missing. */
  async function linkedAnalysis(ports: BackendPorts, projectId: string, analysisId: string) {
    const analysis = await ports.scopeGuard.getAnalysisById(analysisId);
    if (!analysis) return null;
    const request = await ports.scopeGuard.getRequestById(analysis.requestId);
    if (!request || request.projectId !== projectId) return null;
    const agreement = await ports.agreements.getById(analysis.agreementId);
    if (!agreement || agreement.projectId !== projectId) return null;
    return { analysis, request, agreement };
  }

  return {
    async listProjects() {
      const ports = await getPorts();
      const projects = await ports.projects.list();
      return Promise.all(projects.map(async project => {
        const state = await scopeState(ports, project.id);
        return toWorkspaceProject(project, state.status, state.version);
      }));
    },

    async createProject(name) {
      const title = textValue(name, limits.name);
      const ports = await getPorts();
      const project = await write(() => ports.projects.create({ id: newId('proj'), title }));
      return toWorkspaceProject(project, 'none', null);
    },

    async getProject(id) {
      const ports = await getPorts();
      const project = await ports.projects.getById(id);
      if (!project) return null;
      const state = await scopeState(ports, id);
      return toWorkspaceProject(project, state.status, state.version);
    },

    async getDraft(projectId) {
      const ports = await getPorts();
      await requireProject(ports, projectId);
      // A confirmed project has no draft, whatever is left in the settings store.
      if (await ports.agreements.getLatestByProjectId(projectId)) return null;
      return readDraft(ports, projectId);
    },

    async saveDraft(input) {
      const ports = await getPorts();
      await requireProject(ports, input.projectId);
      if (await ports.agreements.getLatestByProjectId(input.projectId)) throw new ServiceError('save_failed');
      const draft = { ...cleanDraft(input), updatedAt: new Date().toISOString() };
      await write(async () => {
        await ports.settings.set(draftKey(input.projectId), JSON.stringify(draft));
        await ports.projects.update(input.projectId, {});
      });
    },

    async confirmScope(projectId, input) {
      const ports = await getPorts();
      const project = await requireProject(ports, projectId);
      if (input.projectId !== projectId) throw new ServiceError('not_found');
      // Agreement v1 is fixed. The backend would otherwise create a version 2.
      if (await ports.agreements.getLatestByProjectId(projectId)) throw new ServiceError('save_failed');
      const draft = cleanDraft(input, true);
      return write(async () => {
        const agreement = await ports.vault.confirmScope(projectId, toBackendDraft(project.title, draft));
        await ports.settings.set(draftKey(projectId), '');
        await ports.projects.update(projectId, {});
        return toWorkspaceAgreement(agreement);
      });
    },

    async getAgreement(projectId) {
      const ports = await getPorts();
      await requireProject(ports, projectId);
      const agreement = await ports.agreements.getLatestByProjectId(projectId);
      return agreement ? toWorkspaceAgreement(agreement) : null;
    },

    async saveAnalysis(input) {
      const ports = await getPorts();
      await requireProject(ports, input.projectId);
      const agreement = await ports.agreements.getById(input.agreementId);
      if (!agreement || agreement.projectId !== input.projectId || agreement.versionNumber !== input.agreementVersion) throw new ServiceError('not_found');
      const requestText = textValue(input.requestText, limits.request);
      validateFindings(input.findings, toWorkspaceAgreement(agreement));
      return write(async () => {
        const createdAt = new Date().toISOString();
        const request: Backend.ClientRequest = { id: newId('req'), projectId: input.projectId, agreementId: agreement.id, rawText: requestText, createdAt };
        await ports.scopeGuard.createRequest(request);
        const analysis = await ports.scopeGuard.createAnalysis({
          id: newId('ana'), requestId: request.id, agreementId: agreement.id, createdAt, ...toBackendAnalysisFields(input.findings),
        });
        await ports.projects.update(input.projectId, {});
        return toWorkspaceAnalysis(analysis, request, agreement);
      });
    },

    async listAnalyses(projectId) {
      const ports = await getPorts();
      await requireProject(ports, projectId);
      const analyses = await ports.scopeGuard.listAnalysesByProjectId(projectId);
      const linked = await Promise.all(analyses.map(analysis => linkedAnalysis(ports, projectId, analysis.id)));
      return linked.filter(entry => entry !== null).map(entry => toWorkspaceAnalysis(entry.analysis, entry.request, entry.agreement));
    },

    async getAnalysis(projectId, id) {
      const ports = await getPorts();
      const entry = await linkedAnalysis(ports, projectId, id);
      return entry ? toWorkspaceAnalysis(entry.analysis, entry.request, entry.agreement) : null;
    },

    async createProposal(projectId, analysisId, deliverables) {
      const ports = await getPorts();
      const entry = await linkedAnalysis(ports, projectId, analysisId);
      if (!entry) throw new ServiceError('not_found');
      const selectedItems = items(deliverables);
      const proposable = new Set(entry.analysis.findings.filter(finding => finding.classification === 'potential_additional').map(finding => finding.item));
      if (selectedItems.some(text => !proposable.has(text))) throw new ServiceError('invalid_input');
      return write(async () => {
        const now = new Date().toISOString();
        const proposal = await ports.proposals.create({
          id: newId('prop'), projectId, analysisId, selectedItems,
          freelancerFeeEstimate: null, freelancerDaysEstimate: null,
          currency: toWorkspaceAgreement(entry.agreement).terms.currency,
          draftMessage: '', status: 'draft', createdAt: now, updatedAt: now,
        });
        await ports.projects.update(projectId, {});
        return toWorkspaceProposal(proposal);
      });
    },

    async getProposal(projectId, id) {
      const ports = await getPorts();
      const proposal = await ports.proposals.getById(id);
      if (!proposal || proposal.projectId !== projectId) return null;
      if (!(await linkedAnalysis(ports, projectId, proposal.analysisId))) return null;
      return toWorkspaceProposal(proposal);
    },

    async saveProposal(input) {
      const ports = await getPorts();
      const stored = await ports.proposals.getById(input.id);
      if (!stored || stored.projectId !== input.projectId || stored.analysisId !== input.analysisId) throw new ServiceError('not_found');
      if (!(await linkedAnalysis(ports, input.projectId, input.analysisId))) throw new ServiceError('not_found');
      const selectedItems = items(input.deliverables);
      if (input.status !== 'draft' || !finiteEstimate(input.feeAmount) || !finiteEstimate(input.extraWorkingDays)) throw new ServiceError('invalid_input');
      const draftMessage = textValue(input.message, limits.message, true);
      return write(async () => {
        const updated = await ports.proposals.update(input.id, {
          draftMessage, selectedItems, freelancerFeeEstimate: input.feeAmount, freelancerDaysEstimate: input.extraWorkingDays,
        });
        if (!updated) throw new ServiceError('not_found');
        await ports.projects.update(input.projectId, {});
        return toWorkspaceProposal(updated);
      });
    },

    async listProposals(projectId) {
      const ports = await getPorts();
      await requireProject(ports, projectId);
      return (await ports.proposals.listByProjectId(projectId)).map(toWorkspaceProposal);
    },
  };
}
