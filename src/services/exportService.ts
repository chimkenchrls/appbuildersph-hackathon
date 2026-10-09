import { z } from 'zod';
import type { ProjectRepository } from '@/database/repositories/projectRepository';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import type { ProposalRepository } from '@/database/repositories/proposalRepository';
import type { Project, Agreement, ClientRequest, ScopeGuardAnalysis, ChangeProposal } from '@/types/domain';

export interface ProjectExportData {
  project: Project;
  agreements: Agreement[];
  requests: ClientRequest[];
  analyses: ScopeGuardAnalysis[];
  proposals: ChangeProposal[];
  exportedAt: string;
}

const ProjectExportSchema = z.object({
  project: z.object({
    id: z.string(),
    title: z.string(),
    clientName: z.string().nullable(),
    description: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  agreements: z.array(z.any()),
  requests: z.array(z.any()),
  analyses: z.array(z.any()),
  proposals: z.array(z.any()),
  exportedAt: z.string(),
});

export class ExportService {
  constructor(
    private readonly projectRepo: ProjectRepository,
    private readonly agreementRepo: AgreementRepository,
    private readonly scopeGuardRepo: ScopeGuardRepository,
    private readonly proposalRepo: ProposalRepository,
  ) {}

  async exportProject(projectId: string): Promise<string> {
    const project = await this.projectRepo.getById(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const agreements = await this.agreementRepo.listByProjectId(projectId);
    const requests = await this.scopeGuardRepo.listRequestsByProjectId(projectId);
    const analyses = await this.scopeGuardRepo.listAnalysesByProjectId(projectId);
    const proposals = await this.proposalRepo.listByProjectId(projectId);

    const exportData: ProjectExportData = {
      project,
      agreements,
      requests,
      analyses,
      proposals,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  async importProject(jsonString: string): Promise<Project> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format for project import');
    }

    const validated = ProjectExportSchema.parse(parsed) as ProjectExportData;

    // Save project if not existing
    const existing = await this.projectRepo.getById(validated.project.id);
    if (!existing) {
      await this.projectRepo.create(validated.project);
    }

    // Restore agreements
    for (const agmt of validated.agreements) {
      const existingAgmt = await this.agreementRepo.getById(agmt.id);
      if (!existingAgmt) {
        await this.agreementRepo.create(agmt);
      }
    }

    // Restore requests
    for (const req of validated.requests) {
      const existingReq = await this.scopeGuardRepo.getRequestById(req.id);
      if (!existingReq) {
        await this.scopeGuardRepo.createRequest(req);
      }
    }

    // Restore analyses
    for (const ana of validated.analyses) {
      const existingAna = await this.scopeGuardRepo.getAnalysisById(ana.id);
      if (!existingAna) {
        await this.scopeGuardRepo.createAnalysis(ana);
      }
    }

    // Restore proposals
    for (const prop of validated.proposals) {
      const existingProp = await this.proposalRepo.getById(prop.id);
      if (!existingProp) {
        await this.proposalRepo.create(prop);
      }
    }

    return validated.project;
  }
}
