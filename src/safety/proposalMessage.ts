import { InvalidAIOutputError } from './scopeGuardValidation';

const NOT_SET = 'To be confirmed';

const COUNT = '(?:\\d[\\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|twenty|thirty)';
const UNIT = '(?:days?|weeks?|months?)\\b';

// Money or duration figures. The model must not write these; code adds the user's values.
const FIGURE = new RegExp(
  `(?:php|₱|\\$|usd|pesos?)\\s*\\d|\\d[\\d,.]*\\s*(?:php\\b|₱|pesos?\\b)|${COUNT}\\s+(?:(?:working|business|calendar)\\s+)?${UNIT}`,
  'i',
);

export interface ProposalFacts {
  deliverables: readonly string[];
  /** Fee in main units (for example 7000 for PHP 7,000). Null means not set. */
  feeAmount: number | null;
  currency: string;
  extraWorkingDays: number | null;
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError('Fee must be a non-negative number');
  }
  const [whole, fraction] = amount.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === '00' ? grouped : `${grouped}.${fraction}`;
}

export function formatFee(feeAmount: number | null, currency: string): string {
  return feeAmount === null ? NOT_SET : `${currency} ${formatAmount(feeAmount)}`;
}

export function formatDays(days: number | null): string {
  if (days === null) return NOT_SET;
  return `${days} working ${days === 1 ? 'day' : 'days'}`;
}

/** Rejects model text that states a price or duration, or is empty. */
export function assertNarrativeIsFigureFree(narrative: string): string {
  const text = narrative.trim();
  if (!text) {
    throw new InvalidAIOutputError('Proposal narrative is empty');
  }
  if (FIGURE.test(text)) {
    throw new InvalidAIOutputError('Proposal narrative states a price or duration, which only the user may set');
  }
  return text;
}

/**
 * Builds the editable proposal message. The model writes only the opening narrative;
 * deliverables, fee and days come from the user's fields, and unset values stay "To be confirmed".
 */
export function composeProposalMessage(narrative: string, facts: ProposalFacts): string {
  const intro = assertNarrativeIsFigureFree(narrative);
  return [
    intro,
    '',
    'Additional deliverables:',
    ...facts.deliverables.map((item) => `- ${item}`),
    '',
    `Estimated additional fee: ${formatFee(facts.feeAmount, facts.currency)}`,
    `Estimated additional time: ${formatDays(facts.extraWorkingDays)}`,
    '',
    'Please let me know if you would like to proceed with this additional scope.',
  ].join('\n');
}
