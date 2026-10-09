import type { LLMMessage } from '../contracts';

export function buildBriefCraftPrompt(sourceText: string): LLMMessage[] {
  const systemInstruction = `You are an expert contract analyst for freelance projects.
Analyze the provided client conversation or notes and extract the project scope.

Rules:
1. Extract ONLY what is explicitly stated in the conversation or notes.
2. Deliverables: Extract discrete deliverables with title and concise description directly from what was discussed.
3. Budget: Set "amount" to the exact numeric amount found in the text, or null if not mentioned. Do NOT invent prices.
4. Timeline: Set "duration_days" to the number of days mentioned (e.g. 14 for 2 weeks), or null if not mentioned. Do NOT invent timelines.
5. Revision terms: Set revision terms if explicitly mentioned, or null if not mentioned.
6. Exclusions: List ONLY items explicitly stated as excluded or out-of-scope. If none are stated, return [].
7. Missing information: List vital details that are unstated (e.g., "Agreed budget is not specified", "Deadline is not specified").
8. Tax treatment: Set to "net_of_withholding", "inclusive", "subject_to_2307", or "none_specified" if tax is mentioned; otherwise null.
9. Return strictly valid JSON only. No explanations, no markdown fences.

Output JSON format:
{
  "title": "Short descriptive project title",
  "deliverables": [
    { "title": "Deliverable title", "description": "Concise description" }
  ],
  "budget": {
    "amount": null,
    "currency": "PHP",
    "notes": null
  },
  "timeline": {
    "duration_days": null,
    "deadline": null,
    "notes": null
  },
  "revision_terms": null,
  "exclusions": [],
  "missing_information": [],
  "tax_treatment": null
}`;

  return [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: `Client Conversation / Notes:\n"""\n${sourceText.trim()}\n"""` },
  ];
}
