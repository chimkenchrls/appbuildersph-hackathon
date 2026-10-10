import { LLMEngineUnavailableError, type LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildBriefCraftPrompt } from '@/llm/prompts/briefCraftPrompt';
import { BriefCraftRawOutputSchema } from '@/types/schemas';
import type { ScopeDraft, Requirement, TaxTreatment } from '@/types/domain';
import { findBudget, findDuration, findRevisionTerms } from '@/safety/conversationTerms';

export class BriefCraftService {
  constructor(private readonly engine: LLMEngine) {}

  async extractBrief(sourceText: string, fallbackTitle?: string): Promise<ScopeDraft> {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      throw new Error('Conversation text cannot be empty');
    }
    if (trimmed.length > 15000) {
      throw new Error('Input is too long. Please select up to 15,000 characters.');
    }

    // The model is asked directly, with no availability pre-check. Only an unreachable engine
    // falls back to the offline extractor; a timeout or an invalid answer is reported as such.
    try {
      {
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
          if (!item.title.trim()) continue;
          const id = `REQ-${String(counter).padStart(2, '0')}`;
          counter++;
          requirements.push({
            id,
            title: item.title.trim(),
            description: item.description.trim() || item.title.trim(),
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

        // If no deliverables were extracted by LLM, generate at least one from sourceText
        if (requirements.length === 0) {
          requirements.push({
            id: 'REQ-01',
            title: fallbackTitle || parsed.title || 'Project scope',
            description: trimmed.slice(0, 200) + (trimmed.length > 200 ? '...' : ''),
            category: 'deliverable',
          });
        }

        return {
          title: parsed.title || fallbackTitle || 'Project Scope',
          requirements,
          budgetAmount: parsed.budget.amount,
          budgetCurrency: parsed.budget.currency || 'PHP',
          budgetNotes: parsed.budget.notes,
          durationDays: parsed.timeline.duration_days,
          deadline: parsed.timeline.deadline,
          timelineNotes: parsed.timeline.notes,
          revisionTerms: parsed.revision_terms,
          exclusions: parsed.exclusions || [],
          missingInformation: parsed.missing_information || [],
          taxTreatment: (parsed.tax_treatment as TaxTreatment) || 'none_specified',
          sourceConversation: trimmed,
          extractedWithAi: true,
        };
      }
    } catch (error) {
      if (!(error instanceof LLMEngineUnavailableError)) throw error;
    }

    return this.extractBriefHeuristic(trimmed, fallbackTitle);
  }

  extractBriefHeuristic(sourceText: string, fallbackTitle?: string): ScopeDraft {
    const requirements: Requirement[] = [];
    let counter = 1;

    // 1 to 3. Budget, delivery time and revision allowance. Each is read only when the
    // conversation states it clearly; otherwise it stays null and is listed as missing.
    const budget = findBudget(sourceText);
    const budgetAmount: number | null = budget ? budget.amount : null;
    const budgetNotes: string | null = budget ? budget.note : null;

    const duration = findDuration(sourceText);
    const durationDays: number | null = duration ? duration.days : null;
    const timelineNotes: string | null = duration ? duration.note : null;

    const revisionTerms: string | null = findRevisionTerms(sourceText);

    // 4. Deliverables extraction from actual sourceText
    const lines = sourceText.split('\n').map((l) => l.trim()).filter(Boolean);
    const bulletLines = lines.filter((l) => /^[•\-\*\d+\.]\s+/.test(l));

    if (bulletLines.length > 0) {
      for (const b of bulletLines) {
        const clean = b.replace(/^[•\-\*\d+\.]\s+/, '').trim();
        if (clean.length > 0) {
          const colonIdx = clean.indexOf(':');
          const dashIdx = clean.indexOf(' - ');
          let title = clean;
          let desc = clean;

          if (colonIdx > 0 && colonIdx < 50) {
            title = clean.substring(0, colonIdx).trim();
            desc = clean.substring(colonIdx + 1).trim() || title;
          } else if (dashIdx > 0 && dashIdx < 50) {
            title = clean.substring(0, dashIdx).trim();
            desc = clean.substring(dashIdx + 3).trim() || title;
          }

          requirements.push({
            id: `REQ-${String(counter++).padStart(2, '0')}`,
            title,
            description: desc,
            category: 'deliverable',
          });
        }
      }
    } else if (lines.length > 1 && lines.length <= 8) {
      // Multiple distinct lines
      for (const line of lines) {
        if (line.length < 3) continue;
        const colonIdx = line.indexOf(':');
        let title = line;
        let desc = line;
        if (colonIdx > 0 && colonIdx < 40) {
          title = line.substring(0, colonIdx).trim();
          desc = line.substring(colonIdx + 1).trim() || title;
        } else if (line.length > 50) {
          title = line.substring(0, 40).trim() + '...';
        }
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title,
          description: desc,
          category: 'deliverable',
        });
      }
    } else {
      // Freeform single block: extract from sentences or key clauses
      const sentences = sourceText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 5);

      if (sentences.length > 1 && sentences.length <= 6) {
        for (const s of sentences) {
          requirements.push({
            id: `REQ-${String(counter++).padStart(2, '0')}`,
            title: s.length > 45 ? s.substring(0, 42).trim() + '...' : s,
            description: s,
            category: 'deliverable',
          });
        }
      } else {
        requirements.push({
          id: `REQ-01`,
          title: fallbackTitle || 'Project Deliverables',
          description: sourceText.slice(0, 300) + (sourceText.length > 300 ? '...' : ''),
          category: 'deliverable',
        });
        counter = 2;
      }
    }

    // Add revision terms requirement if explicitly detected
    if (revisionTerms) {
      requirements.push({
        id: `REQ-${String(counter++).padStart(2, '0')}`,
        title: 'Design revisions',
        description: revisionTerms,
        category: 'term',
      });
    }

    // 5. Exclusions extraction (explicitly stated out-of-scope items)
    const exclusions: string[] = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        lower.includes('not included') ||
        lower.includes('out of scope') ||
        lower.includes('exclude') ||
        lower.includes('excluding') ||
        lower.includes('does not include')
      ) {
        exclusions.push(line.replace(/^[•\-\*\d+\.]\s+/, '').trim());
      }
    }

    // 6. Missing information: dynamically detect unstated items
    const missingInformation: string[] = [];
    if (budgetAmount == null) {
      missingInformation.push('Budget amount is not specified in the conversation.');
    }
    if (durationDays == null) {
      missingInformation.push('Delivery timeline or deadline is not specified.');
    }
    if (!revisionTerms) {
      missingInformation.push('Revision round allowance is not specified.');
    }

    // 7. Tax treatment extraction
    let taxTreatment: TaxTreatment = 'none_specified';
    const lowerFull = sourceText.toLowerCase();
    if (lowerFull.includes('net of withholding') || lowerFull.includes('net withholding')) {
      taxTreatment = 'net_of_withholding';
    } else if (lowerFull.includes('tax inclusive') || lowerFull.includes('vat inclusive')) {
      taxTreatment = 'inclusive';
    } else if (lowerFull.includes('2307') || lowerFull.includes('bir form 2307')) {
      taxTreatment = 'subject_to_2307';
    }

    return {
      title: fallbackTitle || 'Project Scope',
      requirements,
      budgetAmount,
      budgetCurrency: 'PHP',
      budgetNotes,
      durationDays,
      deadline: null,
      timelineNotes,
      revisionTerms,
      exclusions,
      missingInformation,
      taxTreatment,
      sourceConversation: sourceText.trim(),
      extractedWithAi: false,
    };
  }
}
