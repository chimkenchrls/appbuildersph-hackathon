import type { LLMMessage } from '../contracts';

export function buildChangeDeskPrompt(options: {
  agreementTitle: string;
  selectedItems: string[];
  feeEstimate: number | null;
  daysEstimate: number | null;
  currency: string;
}): LLMMessage[] {
  const { agreementTitle, selectedItems, feeEstimate, daysEstimate, currency } = options;

  const itemsList = selectedItems.map((item, index) => `${index + 1}. ${item}`).join('\n');
  const feeText = feeEstimate != null ? `${currency} ${feeEstimate.toLocaleString()}` : 'To be discussed';
  const daysText = daysEstimate != null ? `${daysEstimate} additional business days` : 'To be discussed';

  const systemInstruction = `You are ChangeDesk, a friendly and professional freelance business assistant.
Draft an editable message to a client explaining that their new requested items expand beyond the original agreement, and propose estimates for the additional scope.

Rules:
1. Tone must be collaborative, courteous, and positive. Never sound confrontational, rigid, or defensive.
2. Acknowledge the client's new request warmly.
3. Gently clarify that these specific items are additional to the confirmed "${agreementTitle}" scope.
4. Present the estimated additional fee (${feeText}) and estimated additional working timeline (${daysText}).
5. Invite the client to review the proposal and let you know if they would like to proceed with this expanded scope.
6. Return valid JSON only with a single "draft_message" field.

Output JSON format:
{
  "draft_message": "Friendly message text here..."
}`;

  const userContent = `Selected Additional Deliverables:
${itemsList}

Estimated Additional Fee: ${feeText}
Estimated Additional Timeline: ${daysText}

Please write the client proposal message.`;

  return [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: userContent },
  ];
}
