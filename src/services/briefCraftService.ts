import type { LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildBriefCraftPrompt } from '@/llm/prompts/briefCraftPrompt';
import { BriefCraftRawOutputSchema } from '@/types/schemas';
import type { ScopeDraft, Requirement } from '@/types/domain';

export class BriefCraftService {
  constructor(private readonly engine: LLMEngine) {}

  async extractBrief(sourceText: string): Promise<ScopeDraft> {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      throw new Error('Conversation text cannot be empty');
    }
    if (trimmed.length > 15000) {
      throw new Error('Input is too long. Please select up to 15,000 characters.');
    }

    const messages = buildBriefCraftPrompt(trimmed);
    const rawOutput = await this.engine.generate(messages, {
      temperature: 0.1,
      maxTokens: 1500,
    });

    const parsed = parseAndValidateJson(rawOutput, BriefCraftRawOutputSchema);

    // Map extracted items to sequential stable IDs (REQ-01, REQ-02...)
    let counter = 1;
    const requirements: Requirement[] = [];

    for (const item of parsed.deliverables) {
      const id = `REQ-${String(counter).padStart(2, '0')}`;
      counter++;
      requirements.push({
        id,
        title: item.title,
        description: item.description,
        category: 'deliverable',
      });
    }

    if (parsed.revision_terms) {
      const id = `REQ-${String(counter).padStart(2, '0')}`;
      counter++;
      requirements.push({
        id,
        title: 'Revision allowances',
        description: parsed.revision_terms,
        category: 'term',
      });
    }

    return {
      title: parsed.title,
      requirements,
      budgetAmount: parsed.budget.amount,
      budgetCurrency: parsed.budget.currency || 'PHP',
      budgetNotes: parsed.budget.notes,
      durationDays: parsed.timeline.duration_days,
      deadline: parsed.timeline.deadline,
      timelineNotes: parsed.timeline.notes,
      revisionTerms: parsed.revision_terms,
      exclusions: parsed.exclusions,
      missingInformation: parsed.missing_information,
    };
  }
}
