/**
 * Plain-text readers for the rule-based fallback extractor. They only report what the
 * conversation states, and answer null when it is missing or unclear: a wrong budget or
 * deadline is worse than an empty field that the freelancer fills in.
 */

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30,
};
const NUMBER = `(\\d+(?:\\.\\d+)?|${Object.keys(WORD_NUMBERS).join('|')})`;

function toNumber(token: string): number {
  const lower = token.toLowerCase();
  return lower in WORD_NUMBERS ? WORD_NUMBERS[lower] : Number(lower);
}

function around(text: string, start: number, end: number, before: number, after: number): { before: string; after: string } {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = text.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? text.length : lineEndIndex;
  // Context never crosses a sentence boundary, so a deposit in one sentence says nothing
  // about the total in the next.
  let left = text.slice(Math.max(lineStart, start - before), start);
  let right = text.slice(end, Math.min(lineEnd, end + after));
  const lastBreak = [...left.matchAll(/[.!?]\s+/g)].pop();
  if (lastBreak) left = left.slice((lastBreak.index ?? 0) + lastBreak[0].length);
  const firstBreak = right.match(/[.!?](?:\s|$)/);
  if (firstBreak) right = right.slice(0, firstBreak.index ?? 0);
  return { before: left.toLowerCase(), after: right.toLowerCase() };
}

// ---- Budget ----

const PREFIXED = /(?:₱|\bphp|\busd|\$|\bp(?=\d))\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(\s*k\b)?/gi;
const SUFFIXED = /(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?(\s*k\b)?\s*(?:php\b|pesos?\b|₱)/gi;
const TOTAL_WORDS = /\b(total|budget|project (?:fee|cost|price)|fixed|flat|whole project|all[- ]in|quote|quoted|overall|package|fee is|cost is|price is)\b/;
const PARTIAL_WORDS = /(deposit|down\s?payment|advance|retainer|balance|instal?lment|milestone|per hour|hourly|\/hr|per month|monthly|hosting|domain|%|percent|\bhalf\b)/;

export interface BudgetFinding {
  amount: number;
  note: string;
}

export function findBudget(text: string): BudgetFinding | null {
  const found = new Map<number, { amount: number; score: number }>();
  for (const pattern of [PREFIXED, SUFFIXED]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      let amount = Number(`${match[1].replace(/,/g, '')}${match[2] ?? ''}`);
      if (match[3]) amount *= 1000;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const { before, after } = around(text, index, index + match[0].length, 60, 50);
      const context = `${before} ${after}`;
      const score = (TOTAL_WORDS.test(context) ? 2 : 0) - (PARTIAL_WORDS.test(context) ? 3 : 0);
      if (!found.has(index)) found.set(index, { amount: Math.round(amount * 100) / 100, score });
    }
  }
  const candidates = [...found.values()];
  if (!candidates.length) return null;

  const best = Math.max(...candidates.map(c => c.score));
  if (best < 0) return null; // only deposits, instalments or rates were mentioned
  const top = candidates.filter(c => c.score === best);
  const amounts = new Set(top.map(c => c.amount));
  // Several different figures with nothing to tell them apart: leave it for the freelancer.
  if (amounts.size !== 1) return null;
  const amount = top[0].amount;
  return { amount, note: `Extracted from conversation: ₱${amount.toLocaleString('en-US')}.` };
}

// ---- Delivery time ----

const DURATION = new RegExp(
  `\\b${NUMBER}(?:\\s*(?:-|to)\\s*${NUMBER})?[\\s-]*(?:(?:working|business|calendar)\\s+)?(day|week|month)s?\\b`,
  'gi',
);
const NOT_DELIVERY = /(payment|pay\b|paid|due\b|\bnet\b|invoice|warranty|support|maintenance|hosting|valid|expires?|refund|per\b|each\b|every\b)/;
const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };

export interface DurationFinding {
  days: number;
  note: string;
}

export function findDuration(text: string): DurationFinding | null {
  if (/\bfortnight\b/i.test(text) && !DURATION.test(text)) {
    DURATION.lastIndex = 0;
    return { days: 14, note: '2 weeks turnaround.' };
  }
  DURATION.lastIndex = 0;
  for (const match of text.matchAll(DURATION)) {
    const index = match.index ?? 0;
    const { before, after } = around(text, index, index + match[0].length, 30, 22);
    if (NOT_DELIVERY.test(before) || NOT_DELIVERY.test(after)) continue;
    const low = toNumber(match[1]);
    const high = match[2] ? toNumber(match[2]) : low;
    const count = Math.max(low, high);
    if (!Number.isFinite(count) || count <= 0) continue;
    const unit = match[3].toLowerCase();
    const days = Math.round(count * UNIT_DAYS[unit]);
    const label = Number.isInteger(count) ? String(count) : String(count);
    return { days, note: `${label} ${unit}${count === 1 ? '' : 's'} turnaround.` };
  }
  return null;
}

// ---- Revisions ----

const REVISIONS_A = new RegExp(`\\b${NUMBER}\\s+(?:rounds?\\s+of\\s+)?(?:[a-z]+\\s+)?(?:revisions?|revision\\s+rounds?)\\b`, 'i');
const REVISIONS_B = new RegExp(`\\b${NUMBER}\\s+rounds?\\s+of\\s+(?:changes|edits|amendments|revisions?)\\b`, 'i');
const UNLIMITED = /\bunlimited\s+(?:revisions?|changes|edits)\b/i;

export function findRevisionTerms(text: string): string | null {
  if (UNLIMITED.test(text)) return 'Unlimited revisions included.';
  const match = text.match(REVISIONS_B) ?? text.match(REVISIONS_A);
  if (!match) return null;
  const count = toNumber(match[1]);
  if (!Number.isInteger(count) || count < 1) return null;
  return `${count} round${count === 1 ? '' : 's'} of revisions included.`;
}
