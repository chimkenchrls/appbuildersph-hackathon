import type { LLMMessage } from '../contracts';
import type { Agreement } from '@/types/domain';

export function buildScopeGuardPrompt(agreement: Agreement, requestText: string): LLMMessage[] {
  const reqList = agreement.requirements
    .map((r) => `[${r.id}] ${r.title} (${r.category}): ${r.description}`)
    .join('\n');

  const exclusionsList = agreement.exclusions.length > 0 ? agreement.exclusions.join(', ') : 'None explicitly recorded';

  const systemInstruction = `You are ScopeGuard, an impartial contract reviewer for freelance projects.
Compare the incoming client request against the confirmed agreement.

Rules:
1. Break down the incoming request into specific requested items.
2. Classify each item as:
   - "included": clearly covered by an existing requirement.
   - "potential_additional": work beyond or different from the recorded scope.
   - "needs_clarification": ambiguous or partially covered.
3. Cite the exact requirement ID (e.g. "REQ-01") in evidence_requirement_ids when an existing requirement relates to the finding. If no requirement exists, leave the array empty.
4. If the request involves revisions, compare against the confirmed revision terms.
5. Provide clarification questions for any ambiguous requests.
6. The overall_classification must be:
   - "included" ONLY if every item is included.
   - "potential_additional" if any requested item is new or beyond scope.
   - "needs_clarification" if major items cannot be assessed due to ambiguity.
7. Return valid JSON only. Do not include markdown code fences or conversational text.

Output JSON format:
{
  "overall_classification": "potential_additional",
  "summary": "Concise summary of findings",
  "findings": [
    {
      "item": "Requested feature or change",
      "classification": "potential_additional",
      "explanation": "Why this is or is not covered",
      "evidence_requirement_ids": ["REQ-02"]
    }
  ],
  "clarification_questions": ["Question to ask client if ambiguous"]
}`;

  const userContent = `Confirmed Agreement:
Title: ${agreement.title}
Version: ${agreement.versionNumber}
Confirmed Deliverables & Terms:
${reqList}

Revision Terms: ${agreement.revisionTerms || 'None specified'}
Recorded Exclusions: ${exclusionsList}

Incoming Client Request:
"""
${requestText.trim()}
"""`;

  return [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userContent },
  ];
}
