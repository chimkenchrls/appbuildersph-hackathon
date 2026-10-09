import type { LLMEngine } from '@/llm/contracts';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildBriefCraftPrompt } from '@/llm/prompts/briefCraftPrompt';
import { BriefCraftRawOutputSchema } from '@/types/schemas';
import type { ScopeDraft, Requirement, TaxTreatment } from '@/types/domain';

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

    try {
      const available = await this.engine.isAvailable();
      if (available) {
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
    } catch {
      // Local LLM engine failed or timed out — seamlessly use smart offline heuristic extractor
    }

    return this.extractBriefHeuristic(trimmed, fallbackTitle);
  }

  extractBriefHeuristic(sourceText: string, fallbackTitle?: string): ScopeDraft {
    const requirements: Requirement[] = [];
    let counter = 1;

    // 1. Budget extraction (e.g. ₱15,000, ₱28,000, 15000 PHP, etc.)
    let budgetAmount: number | null = null;
    let budgetNotes: string | null = null;
    const budgetMatch =
      sourceText.match(/(?:[₱]|PHP|Php|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/i) ||
      sourceText.match(/budget\s*(?:is|of|:)?\s*(?:[₱]|PHP|Php|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/i);

    if (budgetMatch && budgetMatch[1]) {
      const num = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(num)) {
        budgetAmount = num;
        budgetNotes = `Extracted from conversation: ₱${num.toLocaleString('en-US')}.`;
      }
    }

    // 2. Timeline extraction (e.g. 2 weeks, 3 weeks, 14 days, 30 days)
    let durationDays: number | null = null;
    let timelineNotes: string | null = null;
    const timelineWeekMatch = sourceText.match(/(\d+)\s*weeks?/i);
    const timelineDayMatch = sourceText.match(/(\d+)\s*days?/i);
    const timelineMonthMatch = sourceText.match(/(\d+)\s*months?/i);

    if (timelineWeekMatch && timelineWeekMatch[1]) {
      const weeks = parseInt(timelineWeekMatch[1], 10);
      durationDays = weeks * 7;
      timelineNotes = `${weeks} week${weeks === 1 ? '' : 's'} turnaround.`;
    } else if (timelineDayMatch && timelineDayMatch[1]) {
      const days = parseInt(timelineDayMatch[1], 10);
      durationDays = days;
      timelineNotes = `${days} day${days === 1 ? '' : 's'} turnaround.`;
    } else if (timelineMonthMatch && timelineMonthMatch[1]) {
      const months = parseInt(timelineMonthMatch[1], 10);
      durationDays = months * 30;
      timelineNotes = `${months} month${months === 1 ? '' : 's'} turnaround.`;
    }

    // 3. Revision terms extraction (e.g. 2 rounds, two rounds)
    let revisionTerms: string | null = null;
    const revMatch = sourceText.match(/(\d+|one|two|three|four)\s*rounds?\s*(?:of\s*)?(?:design\s*)?revisions?/i);
    if (revMatch && revMatch[1]) {
      const val = revMatch[1].toLowerCase();
      const count = val === 'one' ? 1 : val === 'two' ? 2 : val === 'three' ? 3 : val === 'four' ? 4 : parseInt(val, 10);
      revisionTerms = `${count} round${count === 1 ? '' : 's'} of revisions included.`;
    }

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
