import type { LLMMessage } from '../contracts';

export function buildBriefCraftPrompt(sourceText: string): LLMMessage[] {
  const systemInstruction = `You are an expert contract analyst for freelance projects.
Analyze the provided client conversation or notes and extract the project scope.

Rules:
1. Extract explicit deliverables as discrete items with title and concise description.
2. Extract terms including agreed budget, currency (default PHP if in Philippines or unstated), deadline, and revision allowances.
3. If an item is not mentioned in the source text, set its value to null. Do not invent or assume details.
4. List items that are clearly omitted or need clarification in missing_information.
5. Return valid JSON only. Do not include markdown code fences or conversational text.

Output JSON format:
{
  "title": "Short descriptive project title",
  "deliverables": [
    { "title": "Deliverable title", "description": "Brief description" }
  ],
  "budget": {
    "amount": 15000,
    "currency": "PHP",
    "notes": "Agreed price from notes"
  },
  "timeline": {
    "duration_days": 14,
    "deadline": null,
    "notes": "Two-week turnaround"
  },
  "revision_terms": "Two rounds of revisions",
  "exclusions": ["Items explicitly excluded or out of initial discussions"],
  "missing_information": ["Critical items that were unstated, like hosting or assets"]
}`;

  return [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: `Client Conversation / Notes:\n"""\n${sourceText.trim()}\n"""` },
  ];
}
