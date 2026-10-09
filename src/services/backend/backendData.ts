import type { SaklawData } from '@/services/contracts';
import { ServiceError } from '@/services/errors';
import { cleanDraft, finiteEstimate, wholeWorkingDays, limits, textValue } from '@/safety/validation';
import { validateFindings } from '@/safety/validateFindings';
import type * as Backend from '@/types/domain';
import type { ScopeDraft, ScopeStatus } from '@/types/workspace';
import { toBackendAnalysisFields, toBackendDraft, toWorkspaceAgreement, toWorkspaceAnalysis, toWorkspaceProject, toWorkspaceProposal } from './mappers';
import { draftKey, parseStoredDraft } from '@/safety/scopeDraft';
import type { BackendPorts } from './ports';

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
    return parseStoredDraft(stored, projectId);
  }

  async function scopeState(ports: BackendPorts, projectId: string): Promise<{ status: ScopeStatus; version: number | null }> {
    const agreement = await ports.agreements.getLatestByProjectId(projectId);
    if (agreement) return { status: 'confirmed', version: agreement.versionNumber };
    return { status: (await readDraft(ports, projectId)) ? 'draft' : 'none', version: null };
  }

  /** A missing/foreign analysis is unavailable; broken stored links are an integrity error. */
  async function linkedAnalysis(ports: BackendPorts, projectId: string, analysisId: string) {
    const analysis = await ports.scopeGuard.getAnalysisById(analysisId);
    if (!analysis) return null;
    const request = await ports.scopeGuard.getRequestById(analysis.requestId);
    if (!request) throw new ServiceError('data_integrity');
    if (request.projectId !== projectId) return null;
    if (request.agreementId !== analysis.agreementId) throw new ServiceError('data_integrity');
    const agreement = await ports.agreements.getById(analysis.agreementId);
    if (!agreement || agreement.projectId !== projectId) throw new ServiceError('data_integrity');
    try { validateFindings(toWorkspaceAnalysis(analysis, request, agreement).findings, toWorkspaceAgreement(agreement)); }
    catch { throw new ServiceError('data_integrity'); }
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
      const root = await getPorts();
      return write(() => root.transaction(async ports => {
        await requireProject(ports, input.projectId);
        if (await ports.agreements.getLatestByProjectId(input.projectId)) throw new ServiceError('save_failed');
        const draft = { ...cleanDraft(input), updatedAt: new Date().toISOString() };

        await ports.settings.set(draftKey(input.projectId), JSON.stringify(draft));
        await ports.projects.update(input.projectId, {});
      }));
    },

    async confirmScope(projectId, input) {
      const root = await getPorts();
      return write(() => root.transaction(async ports => {
        const project = await requireProject(ports, projectId);
        if (input.projectId !== projectId) throw new ServiceError('not_found');
        // Keep the frontend confirmation guard within the same transaction as the save.
        if (await ports.agreements.getLatestByProjectId(projectId)) throw new ServiceError('save_failed');
        const draft = cleanDraft(input, true);
        const agreement = await ports.vault.confirmScope(projectId, toBackendDraft(project.title, draft));
        await ports.settings.set(draftKey(projectId), '');
        await ports.projects.update(projectId, {});
        return toWorkspaceAgreement(agreement);
      }));
    },

    async getAgreement(projectId) {
      const ports = await getPorts();
      await requireProject(ports, projectId);
      const agreement = await ports.agreements.getLatestByProjectId(projectId);
      return agreement ? toWorkspaceAgreement(agreement) : null;
    },

    async saveAnalysis(input) {
      const root = await getPorts();
      return write(() => root.transaction(async ports => {
        await requireProject(ports, input.projectId);
        const agreement = await ports.agreements.getById(input.agreementId);
        if (!agreement || agreement.projectId !== input.projectId || agreement.versionNumber !== input.agreementVersion) throw new ServiceError('not_found');
        const requestText = textValue(input.requestText, limits.request);
        validateFindings(input.findings, toWorkspaceAgreement(agreement));

        const createdAt = new Date().toISOString();
        const request: Backend.ClientRequest = { id: newId('req'), projectId: input.projectId, agreementId: agreement.id, rawText: requestText, createdAt };
        await ports.scopeGuard.createRequest(request);
        const analysis = await ports.scopeGuard.createAnalysis({
          id: newId('ana'), requestId: request.id, agreementId: agreement.id, createdAt, ...toBackendAnalysisFields(input.findings),
        });
        await ports.projects.update(input.projectId, {});
        return toWorkspaceAnalysis(analysis, request, agreement);
      }));
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
      const root = await getPorts();
      return write(() => root.transaction(async ports => {
        const entry = await linkedAnalysis(ports, projectId, analysisId);
        if (!entry) throw new ServiceError('not_found');
        const selectedItems = items(deliverables);
        const proposable = new Set(entry.analysis.findings.filter(finding => finding.classification === 'potential_additional').map(finding => finding.item));
        if (selectedItems.some(text => !proposable.has(text))) throw new ServiceError('invalid_input');

        const now = new Date().toISOString();
        const proposal = await ports.proposals.create({
          id: newId('prop'), projectId, analysisId, selectedItems,
          freelancerFeeEstimate: null, freelancerDaysEstimate: null,
          currency: toWorkspaceAgreement(entry.agreement).terms.currency,
          draftMessage: '', status: 'draft', createdAt: now, updatedAt: now,
        });
        await ports.projects.update(projectId, {});
        return toWorkspaceProposal(proposal);
      }));
    },

    async getProposal(projectId, id) {
      const ports = await getPorts();
      const proposal = await ports.proposals.getById(id);
      if (!proposal || proposal.projectId !== projectId) return null;
      if (!(await linkedAnalysis(ports, projectId, proposal.analysisId))) throw new ServiceError('data_integrity');
      return toWorkspaceProposal(proposal);
    },

    async saveProposal(input) {
      const root = await getPorts();
      return write(() => root.transaction(async ports => {
        const stored = await ports.proposals.getById(input.id);
        if (!stored || stored.projectId !== input.projectId || stored.analysisId !== input.analysisId) throw new ServiceError('not_found');
        if (!(await linkedAnalysis(ports, input.projectId, input.analysisId))) throw new ServiceError('not_found');
        const selectedItems = items(input.deliverables);
        if (input.status !== 'draft' || !finiteEstimate(input.feeAmount) || !wholeWorkingDays(input.extraWorkingDays)) throw new ServiceError('invalid_input');
        const draftMessage = textValue(input.message, limits.message, true);

        const updated = await ports.proposals.update(input.id, {
          draftMessage, selectedItems, freelancerFeeEstimate: input.feeAmount, freelancerDaysEstimate: input.extraWorkingDays,
        });
        if (!updated) throw new ServiceError('not_found');
        await ports.projects.update(input.projectId, {});
        return toWorkspaceProposal(updated);
      }));
    },

    async listProposals(projectId) {
      const ports = await getPorts();
      await requireProject(ports, projectId);
      const proposals = await ports.proposals.listByProjectId(projectId);
      return Promise.all(proposals.map(async proposal => {
        if (!(await linkedAnalysis(ports, projectId, proposal.analysisId))) throw new ServiceError('data_integrity');
        return toWorkspaceProposal(proposal);
      }));
    },
  };
}
