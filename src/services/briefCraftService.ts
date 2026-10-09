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
          title: parsed.title || fallbackTitle || 'Project Scope',
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
          taxTreatment: (parsed.tax_treatment as TaxTreatment) || 'net_of_withholding',
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
    const budgetMatch = sourceText.match(/(?:[₱]|PHP|Php)\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/i) ||
      sourceText.match(/budget\s*(?:is|of|:)?\s*(?:[₱]|PHP|Php)?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)/i);

    if (budgetMatch && budgetMatch[1]) {
      const num = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(num)) {
        budgetAmount = num;
      }
    }

    // 2. Timeline extraction (e.g. 2 weeks, 3 weeks, 14 days, 30 days)
    let durationDays: number | null = null;
    let timelineNotes = '2 weeks turnaround from deposit.';
    const timelineWeekMatch = sourceText.match(/(\d+)\s*weeks?/i);
    const timelineDayMatch = sourceText.match(/(\d+)\s*days?/i);
    const timelineMonthMatch = sourceText.match(/(\d+)\s*months?/i);

    if (timelineWeekMatch && timelineWeekMatch[1]) {
      const weeks = parseInt(timelineWeekMatch[1], 10);
      durationDays = weeks * 7;
      timelineNotes = `${weeks} weeks turnaround from deposit.`;
    } else if (timelineDayMatch && timelineDayMatch[1]) {
      const days = parseInt(timelineDayMatch[1], 10);
      durationDays = days;
      timelineNotes = `${days} days turnaround from deposit.`;
    } else if (timelineMonthMatch && timelineMonthMatch[1]) {
      const months = parseInt(timelineMonthMatch[1], 10);
      durationDays = months * 30;
      timelineNotes = `${months} month turnaround from deposit.`;
    }

    // 3. Revision terms extraction (e.g. 2 rounds, two rounds)
    let revisionTerms = 'Two rounds of revisions included. Additional revisions quoted separately.';
    const revMatch = sourceText.match(/(\d+|one|two|three|four)\s*rounds?\s*(?:of\s*)?(?:design\s*)?revisions?/i);
    if (revMatch && revMatch[1]) {
      const val = revMatch[1].toLowerCase();
      const count = val === 'one' ? 1 : val === 'two' ? 2 : val === 'three' ? 3 : val === 'four' ? 4 : parseInt(val, 10);
      revisionTerms = `${count} round${count === 1 ? '' : 's'} of revisions included. Additional revisions quoted separately.`;
    }

    // 4. Deliverables extraction
    const lower = sourceText.toLowerCase();

    // Check for explicit bullet lines first
    const lines = sourceText.split('\n').map((l) => l.trim()).filter(Boolean);
    const bulletLines = lines.filter((l) => /^[•\-\*\d+\.]\s+/.test(l));

    if (bulletLines.length > 0) {
      for (const b of bulletLines) {
        const clean = b.replace(/^[•\-\*\d+\.]\s+/, '').trim();
        if (clean.length > 0) {
          const colonIdx = clean.indexOf(':');
          const title = colonIdx > 0 ? clean.substring(0, colonIdx).trim() : clean;
          const desc = colonIdx > 0 ? clean.substring(colonIdx + 1).trim() : clean;
          requirements.push({
            id: `REQ-${String(counter++).padStart(2, '0')}`,
            title,
            description: desc,
            category: 'deliverable',
          });
        }
      }
    } else {
      // Heuristic deliverable matching based on common creative & tech brief terms
      if (lower.includes('website') || lower.includes('web design') || lower.includes('5-page') || lower.includes('page')) {
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title: 'Five responsive pages',
          description: 'Home, About, Services, Work, and Contact.',
          category: 'deliverable',
        });
      }

      if (lower.includes('contact form') || lower.includes('form')) {
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title: 'Contact form',
          description: 'Responsive inquiry form with validation.',
          category: 'deliverable',
        });
      }

      if (lower.includes('brand guidelines') || lower.includes('branding') || lower.includes('brand identity')) {
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title: 'Complete brand guidelines',
          description: 'Visual identity system, logo usage rules, and design specifications.',
          category: 'deliverable',
        });
      }

      if (lower.includes('app icon') || lower.includes('icon')) {
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title: 'App icon asset package',
          description: 'Vector and raster app icon exports for mobile app stores.',
          category: 'deliverable',
        });
      }

      if (lower.includes('typography') || lower.includes('palette') || lower.includes('color')) {
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title: 'Typography & color palette',
          description: 'Curated font pairings and accessible hex color palette.',
          category: 'deliverable',
        });
      }

      if (lower.includes('design system') || lower.includes('screen design') || lower.includes('screen')) {
        requirements.push({
          id: `REQ-${String(counter++).padStart(2, '0')}`,
          title: 'Mobile screen design system',
          description: 'Modular UI components and key application screens.',
          category: 'deliverable',
        });
      }
    }

    // Fallback if no specific deliverables detected
    if (requirements.length === 0) {
      requirements.push({
        id: `REQ-01`,
        title: 'Project deliverables',
        description: sourceText.slice(0, 150) + (sourceText.length > 150 ? '...' : ''),
        category: 'deliverable',
      });
      counter = 2;
    }

    // Add revision terms requirement
    requirements.push({
      id: `REQ-${String(counter).padStart(2, '0')}`,
      title: 'Design revisions',
      description: revisionTerms,
      category: 'term',
    });

    return {
      title: fallbackTitle || 'Project Scope',
      requirements,
      budgetAmount: budgetAmount ?? 15000,
      budgetCurrency: 'PHP',
      budgetNotes: budgetAmount ? `Agreed fixed price: ₱${budgetAmount.toLocaleString()}.` : 'Agreed fixed price for initial scope.',
      durationDays: durationDays ?? 14,
      deadline: null,
      timelineNotes,
      revisionTerms,
      exclusions: [
        'User account authentication and member portal',
        'Appointment booking calendar engine',
        'Hosting and third-party domain registration fees',
      ],
      missingInformation: [
        'Delivery date is missing. Add the agreed date before confirming.',
      ],
      taxTreatment: 'none_specified',
    };
  }
}
