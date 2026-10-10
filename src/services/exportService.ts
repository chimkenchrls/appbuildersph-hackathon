import { z } from 'zod';
import type { SQLiteDatabase } from 'expo-sqlite';
import { repositories } from '@/database/repositories';
import { transaction } from '@/database/transaction';
import { ProjectSchema, AgreementSchema, RequestSchema, AnalysisSchema, ProposalSchema } from '@/safety/persistedSchemas';
import { draftKey, parseStoredDraft, ScopeDraftSchema } from '@/safety/scopeDraft';
import { cleanDraft } from '@/safety/validation';
import { ServiceError } from './errors';

const maxBackupLength = 5_000_000;
const records = <T extends z.ZodType>(schema: T) => z.array(schema).max(1000);
const fields = {
  project: ProjectSchema, agreements: records(AgreementSchema), requests: records(RequestSchema),
  analyses: records(AnalysisSchema), proposals: records(ProposalSchema).refine(rows =>
    rows.every(row => row.freelancerDaysEstimate === null || Number.isSafeInteger(row.freelancerDaysEstimate))),
  exportedAt: z.iso.datetime(),
};
const BackupSchema = z.union([
  z.object({ ...fields, formatVersion: z.literal(1), draft: ScopeDraftSchema.nullable() }).strict(),
  // Existing exports had no version or draft field. Absence never deletes a local draft.
  z.object(fields).strict(),
]);
export type ProjectExportData = z.infer<typeof BackupSchema>;

function unique<T>(rows: T[], key: (row: T) => string) {
  if (new Set(rows.map(key)).size !== rows.length) throw new ServiceError('invalid_input');
}
function validateLinks(data: ProjectExportData) {
  const { project, agreements, requests, analyses, proposals } = data;
  unique(agreements, row => row.id); unique(agreements, row => String(row.versionNumber));
  unique(requests, row => row.id); unique(analyses, row => row.id); unique(analyses, row => row.requestId);
  unique(proposals, row => row.id);
  const byAgreement = new Map(agreements.map(row => [row.id, row]));
  const byRequest = new Map(requests.map(row => [row.id, row]));
  const byAnalysis = new Map(analyses.map(row => [row.id, row]));
  if (agreements.some(row => row.projectId !== project.id)) throw new ServiceError('invalid_input');
  for (const request of requests) {
    if (request.projectId !== project.id || !byAgreement.has(request.agreementId)) throw new ServiceError('invalid_input');
  }
  for (const analysis of analyses) {
    const request = byRequest.get(analysis.requestId);
    const agreement = byAgreement.get(analysis.agreementId);
    if (!request || !agreement || request.agreementId !== agreement.id) throw new ServiceError('invalid_input');
    const ids = new Set(agreement.requirements.map(row => row.id));
    if (analysis.findings.some(f => f.evidenceRequirementIds.some(id => !ids.has(id)) ||
      (f.classification === 'included' && !f.evidenceRequirementIds.length))) throw new ServiceError('invalid_input');
  }
  if (proposals.some(row => row.projectId !== project.id || !byAnalysis.has(row.analysisId))) throw new ServiceError('invalid_input');
  if ('draft' in data && data.draft) {
    if (data.draft.projectId !== project.id || agreements.length) throw new ServiceError('invalid_input');
    cleanDraft(data.draft);
  }
}

// Object property order is insignificant; array order is retained except repository-sorted requirements.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
function equal(left: unknown, right: unknown) {
  const normalize = (value: unknown) => {
    if (value && typeof value === 'object' && 'requirements' in value && Array.isArray(value.requirements)) {
      return { ...value, requirements: [...value.requirements].sort((a, b) => a.id.localeCompare(b.id)) };
    }
    return value;
  };
  return canonical(normalize(left)) === canonical(normalize(right));
}

export class ExportService {
  constructor(private readonly db: SQLiteDatabase) {}

  async exportProject(projectId: string): Promise<string> {
    return transaction(this.db, async tx => {
      const repos = repositories(tx, true);
      const project = await repos.project.getById(projectId);
      if (!project) throw new ServiceError('not_found');
      const agreements = await repos.agreement.listByProjectId(projectId);
      // Once a scope is confirmed its working draft is superseded by the agreement, so an older
      // draft setting left behind by a previous version is not part of the backup.
      const saved = agreements.length ? null : await repos.settings.get(draftKey(projectId));
      const data = BackupSchema.parse({
        formatVersion: 1, project, draft: saved ? parseStoredDraft(saved, projectId) : null,
        agreements,
        requests: await repos.scopeGuard.listRequestsByProjectId(projectId),
        analyses: await repos.scopeGuard.listAnalysesByProjectId(projectId),
        proposals: await repos.proposal.listByProjectId(projectId), exportedAt: new Date().toISOString(),
      });
      validateLinks(data);
      const json = JSON.stringify(data, null, 2);
      if (json.length > maxBackupLength) throw new ServiceError('invalid_input');
      return json;
    });
  }

  async importProject(json: string) {
    let data: ProjectExportData;
    try {
      if (json.length > maxBackupLength) throw new Error('Backup too large');
      data = BackupSchema.parse(JSON.parse(json));
      validateLinks(data);
    } catch {
      throw new ServiceError('invalid_input', 'Invalid or unsupported project backup');
    }
    return transaction(this.db, async tx => {
      const repos = repositories(tx, true);
      async function restore<T>(value: T, get: () => Promise<T | null>, create: () => Promise<unknown>) {
        const existing = await get();
        if (existing) {
          if (!equal(existing, value)) throw new ServiceError('conflict');
        } else await create();
      }
      await restore(data.project, () => repos.project.getById(data.project.id), () => repos.project.restore(data.project));
      for (const row of data.agreements) await restore(row, () => repos.agreement.getById(row.id), () => repos.agreement.create(row));
      for (const row of data.requests) await restore(row, () => repos.scopeGuard.getRequestById(row.id), () => repos.scopeGuard.createRequest(row));
      for (const row of data.analyses) await restore(row, () => repos.scopeGuard.getAnalysisById(row.id), () => repos.scopeGuard.createAnalysis(row));
      for (const row of data.proposals) await restore(row, () => repos.proposal.getById(row.id), () => repos.proposal.create(row));
      if ('draft' in data) {
        const saved = await repos.settings.get(draftKey(data.project.id));
        const existing = saved ? parseStoredDraft(saved, data.project.id) : null;
        if (existing && !equal(existing, data.draft)) throw new ServiceError('conflict');
        if (data.draft) {
          if (await repos.agreement.getLatestByProjectId(data.project.id)) throw new ServiceError('conflict');
          await repos.settings.set(draftKey(data.project.id), JSON.stringify(data.draft));
        }
      }
      return data.project;
    });
  }
}
