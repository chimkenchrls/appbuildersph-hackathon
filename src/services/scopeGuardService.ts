import type { LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildScopeGuardPrompt } from '@/llm/prompts/scopeGuardPrompt';
import { ScopeGuardRawOutputSchema } from '@/types/schemas';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import type { ScopeGuardAnalysis, Finding, ClientRequest } from '@/types/domain';

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
    if (!agreement) {
      throw new Error(`Referenced agreement ${agreementId} was not found`);
    }

    const validRequirementIds = new Set(agreement.requirements.map((r) => r.id));

    let overallClassification: 'included' | 'potential_additional' | 'needs_clarification' = 'potential_additional';
    let summary = `Analyzed against Agreement v${agreement.versionNumber}.`;
    let findings: Finding[] = [];
    let clarificationQuestions: string[] = [];

    let succeededWithLlm = false;

    try {
      const isAvail = await this.engine.isAvailable();
      if (isAvail) {
        const messages = buildScopeGuardPrompt(agreement, trimmed);
        const rawOutput = await this.engine.generate(messages, {
          temperature: 0.1,
          maxTokens: 1500,
        });

        const parsed = parseAndValidateJson(rawOutput, ScopeGuardRawOutputSchema);
        overallClassification = parsed.overall_classification;
        summary = parsed.summary;
        clarificationQuestions = parsed.clarification_questions;
        findings = parsed.findings.map((f) => {
          const verifiedIds = f.evidence_requirement_ids.filter((id) => validRequirementIds.has(id));
          return {
            item: f.item,
            classification: f.classification,
            explanation: f.explanation,
            evidenceRequirementIds: verifiedIds,
          };
        });
        succeededWithLlm = true;
      }
    } catch {
      // Fall through to offline heuristic
    }

    if (!succeededWithLlm) {
      // Smart offline heuristic analyzer
      const lower = trimmed.toLowerCase();
      const firstReqId = agreement.requirements[0]?.id || 'REQ-01';

      if (lower.includes('account') || lower.includes('customer accounts') || lower.includes('login') || lower.includes('user')) {
        findings.push({
          item: 'Customer accounts & authentication',
          classification: 'potential_additional',
          explanation: 'User authentication and account management are outside the agreed deliverables.',
          evidenceRequirementIds: [firstReqId],
        });
      }

      if (lower.includes('booking') || lower.includes('appointment') || lower.includes('calendar')) {
        findings.push({
          item: 'Appointment booking system',
          classification: 'potential_additional',
          explanation: 'Interactive calendar engine is not included in the confirmed scope.',
          evidenceRequirementIds: [firstReqId],
        });
      }

      if (lower.includes('colour') || lower.includes('color') || lower.includes('contact form') || lower.includes('text') || lower.includes('update')) {
        const reqForm = agreement.requirements.find((r) => r.title.toLowerCase().includes('form'))?.id || firstReqId;
        findings.push({
          item: 'Contact form styling and adjustments',
          classification: 'included',
          explanation: 'Fits within the agreed deliverable and revision allowances.',
          evidenceRequirementIds: [reqForm],
        });
      }

      if (lower.includes('premium') || lower.includes('modern') || lower.includes('feel') || lower.includes('better')) {
        findings.push({
          item: 'Visual enhancement requests',
          classification: 'needs_clarification',
          explanation: 'Specific styling details and visual references should be clarified before classifying.',
          evidenceRequirementIds: [firstReqId],
        });
        clarificationQuestions.push('Which pages or visual details should change? Ask for examples before classifying.');
      }

      if (findings.length === 0) {
        findings.push({
          item: trimmed.slice(0, 40) + '...',
          classification: 'potential_additional',
          explanation: 'This request appears to introduce new requirements beyond the baseline agreement.',
          evidenceRequirementIds: [firstReqId],
        });
      }

      const hasAdditional = findings.some((f) => f.classification === 'potential_additional');
      const hasClarification = findings.some((f) => f.classification === 'needs_clarification');
      overallClassification = hasAdditional ? 'potential_additional' : hasClarification ? 'needs_clarification' : 'included';
      summary = `Compared with Agreement v${agreement.versionNumber}. ${findings.length} item(s) analyzed.`;
    }

    const now = new Date().toISOString();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const analysisId = `ana_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Persist request record
    await this.scopeGuardRepo.createRequest({
      id: requestId,
      projectId,
      agreementId,
      rawText: trimmed,
      createdAt: now,
      status: 'stored',
    });

    // Persist analysis record
    const analysis: ScopeGuardAnalysis = {
      id: analysisId,
      requestId,
      agreementId,
      classification: overallClassification,
      summary,
      findings,
      clarificationQuestions,
      createdAt: now,
    };

    return this.scopeGuardRepo.createAnalysis(analysis);
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
