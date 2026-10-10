import { limits, textValue } from '@/safety/validation';
import { ServiceError } from './errors';
import type { LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildScopeGuardPrompt } from '@/llm/prompts/scopeGuardPrompt';
import { ScopeGuardRawOutputSchema } from '@/types/schemas';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import { validateScopeGuardFindings } from '@/safety/scopeGuardValidation';
import type { ScopeGuardAnalysis, ClientRequest } from '@/types/domain';

export class ScopeGuardService {
  constructor(
    private readonly engine: LLMEngine,
    private readonly agreementRepo: AgreementRepository,
    private readonly scopeGuardRepo: ScopeGuardRepository,
  ) {}

  /** Store a client message without requiring inference or creating a proposal. */
  async saveRequest(options: { projectId: string; agreementId: string; requestText: string }): Promise<ClientRequest> {
    const rawText = textValue(options.requestText, limits.request);
    const agreement = await this.agreementRepo.getById(options.agreementId);
    if (!agreement || agreement.projectId !== options.projectId) throw new ServiceError('not_found');
    return this.scopeGuardRepo.createRequest({
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      projectId: options.projectId,
      agreementId: agreement.id,
      rawText,
      createdAt: new Date().toISOString(),
      status: 'stored',
    });
  }

  async analyzeRequest(options: {
    projectId: string;
    agreementId: string;
    requestText: string;
    requestId?: string;
  }): Promise<ScopeGuardAnalysis> {
    const { projectId, agreementId } = options;
    const trimmed = textValue(options.requestText, limits.request);

    const agreement = await this.agreementRepo.getById(agreementId);
    if (!agreement || agreement.projectId !== projectId) {
      throw new ServiceError('not_found');
    }

    const existingRequest = options.requestId ? await this.scopeGuardRepo.getRequestById(options.requestId) : null;
    if (options.requestId && (!existingRequest || existingRequest.projectId !== projectId
      || existingRequest.agreementId !== agreementId || existingRequest.rawText !== trimmed)) throw new ServiceError('not_found');
    if (existingRequest?.status === 'accepted') throw new ServiceError('conflict');
    // A request has one analysis. Asking again returns it instead of running the model again
    // and failing on the stored record.
    if (existingRequest) {
      const previous = await this.scopeGuardRepo.getAnalysisByRequestId(existingRequest.id);
      if (previous) return previous;
    }

    const validRequirementIds = new Set(agreement.requirements.map((r) => r.id));

    const messages = buildScopeGuardPrompt(agreement, trimmed);
    const rawOutput = await this.engine.generate(messages, {
      temperature: 0.1,
      maxTokens: 1500,
    });

    const parsed = parseAndValidateJson(rawOutput, ScopeGuardRawOutputSchema);

    // Reject invalid evidence and derive the overall classification from the findings
    const { classification, findings } = validateScopeGuardFindings(parsed.findings, validRequirementIds);

    const now = new Date().toISOString();
    const requestId = existingRequest?.id ?? `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const analysisId = `ana_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Persist analysis record
    const analysis: ScopeGuardAnalysis = {
      id: analysisId,
      requestId,
      agreementId,
      classification,
      summary: parsed.summary,
      findings,
      clarificationQuestions: parsed.clarification_questions ?? [],
      createdAt: now,
    };

    if (existingRequest) return this.scopeGuardRepo.createAnalysis(analysis);
    return this.scopeGuardRepo.createRequestWithAnalysis({ id: requestId, projectId, agreementId, rawText: trimmed, createdAt: now, status: 'stored' }, analysis);
  }

  async getAnalysisByRequestId(requestId: string): Promise<ScopeGuardAnalysis | null> {
    return this.scopeGuardRepo.getAnalysisByRequestId(requestId);
  }

  async listAnalyses(projectId: string): Promise<ScopeGuardAnalysis[]> {
    return this.scopeGuardRepo.listAnalysesByProjectId(projectId);
  }

  async listRequests(projectId: string): Promise<ClientRequest[]> {
    return this.scopeGuardRepo.listRequestsByProjectId(projectId);
  }

  async deleteRequest(requestId: string): Promise<void> {
    return this.scopeGuardRepo.deleteRequest(requestId);
  }
}
