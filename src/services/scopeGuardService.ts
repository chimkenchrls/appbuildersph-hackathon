import type { LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildScopeGuardPrompt } from '@/llm/prompts/scopeGuardPrompt';
import { ScopeGuardRawOutputSchema } from '@/types/schemas';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import { validateScopeGuardFindings } from '@/safety/scopeGuardValidation';
import type { ScopeGuardAnalysis } from '@/types/domain';

export class ScopeGuardService {
  constructor(
    private readonly engine: LLMEngine,
    private readonly agreementRepo: AgreementRepository,
    private readonly scopeGuardRepo: ScopeGuardRepository,
  ) {}

  async analyzeRequest(options: {
    projectId: string;
    agreementId: string;
    requestText: string;
  }): Promise<ScopeGuardAnalysis> {
    const { projectId, agreementId, requestText } = options;
    const trimmed = requestText.trim();
    if (!trimmed) {
      throw new Error('Request text cannot be empty');
    }

    const agreement = await this.agreementRepo.getById(agreementId);
    if (!agreement || agreement.projectId !== projectId) {
      throw new Error(`Referenced agreement ${agreementId} was not found`);
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
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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

    return this.scopeGuardRepo.createRequestWithAnalysis({ id: requestId, projectId, agreementId, rawText: trimmed, createdAt: now }, analysis);
  }

  async getAnalysisByRequestId(requestId: string): Promise<ScopeGuardAnalysis | null> {
    return this.scopeGuardRepo.getAnalysisByRequestId(requestId);
  }

  async listAnalyses(projectId: string): Promise<ScopeGuardAnalysis[]> {
    return this.scopeGuardRepo.listAnalysesByProjectId(projectId);
  }
}
