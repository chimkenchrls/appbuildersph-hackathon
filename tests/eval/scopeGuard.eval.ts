// Live check of ScopeGuard against a real model in LM Studio (the team's acceptance cases).
// Not part of `npm test`. Start the LM Studio server with a model loaded, then run:
//   npx jest --testMatch "**/tests/eval/*.eval.ts"
// Optional: EVAL_MODEL=<model id> (default qwen/qwen3.5-9b), EVAL_URL=<base url>.
import http from 'node:http';
import { LMStudioAdapter } from '@/llm/adapters/lmStudioAdapter';
import { parseAndValidateJson } from '@/llm/jsonParser';
import { buildScopeGuardPrompt } from '@/llm/prompts/scopeGuardPrompt';
import { validateScopeGuardFindings } from '@/safety/scopeGuardValidation';
import { ScopeGuardRawOutputSchema } from '@/types/schemas';
import type { Agreement, Classification } from '@/types/domain';

// The React Native jest preset replaces global fetch with a stub, so use a real HTTP client here.
globalThis.fetch = ((input: string, init: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {}) =>
  new Promise((resolve, reject) => {
    const request = http.request(input, { method: init.method ?? 'GET', headers: init.headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const status = response.statusCode ?? 0;
        resolve({ ok: status >= 200 && status < 300, status, text: async () => text, json: async () => JSON.parse(text) });
      });
    });
    request.on('error', reject);
    init.signal?.addEventListener('abort', () => request.destroy(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    request.end(init.body);
  })) as unknown as typeof fetch;

const engine = new LMStudioAdapter({
  getBaseUrl: async () => process.env.EVAL_URL ?? 'http://localhost:1234/v1',
  getModel: async () => process.env.EVAL_MODEL ?? 'qwen/qwen3.5-9b',
  timeoutMs: 240000,
});

// Fictional demo agreement.
const agreement: Agreement = {
  id: 'agr-eval',
  projectId: 'proj-eval',
  versionNumber: 1,
  title: 'Five-page responsive website',
  requirements: [
    { id: 'REQ-01', title: 'Home page', description: 'Responsive Home page', category: 'deliverable' },
    { id: 'REQ-02', title: 'About page', description: 'Responsive About page', category: 'deliverable' },
    { id: 'REQ-03', title: 'Services page', description: 'Responsive Services page', category: 'deliverable' },
    { id: 'REQ-04', title: 'Portfolio page', description: 'Responsive Portfolio page', category: 'deliverable' },
    { id: 'REQ-05', title: 'Contact page with contact form', description: 'Responsive Contact page that includes a contact form', category: 'deliverable' },
    { id: 'REQ-06', title: 'Revision allowances', description: 'Two rounds of revisions', category: 'term' },
  ],
  budgetAmount: 15000,
  budgetCurrency: 'PHP',
  budgetNotes: null,
  durationDays: 14,
  deadline: null,
  timelineNotes: 'Two weeks',
  revisionTerms: 'Two rounds of revisions',
  exclusions: [],
  missingInformation: [],
  confirmedAt: '2026-10-10T00:00:00.000Z',
};

const cases: { name: string; request: string; expected: Classification }[] = [
  { name: 'included', request: 'Can you change the contact form button text to "Send message"?', expected: 'included' },
  { name: 'additional', request: 'Can we add customer accounts and appointment booking?', expected: 'potential_additional' },
  { name: 'ambiguous', request: 'Make it more advanced.', expected: 'needs_clarification' },
  {
    name: 'mixed',
    request: 'Change the contact form button text and also add online payments.',
    expected: 'potential_additional',
  },
];

describe('ScopeGuard live model', () => {
  const validIds = new Set(agreement.requirements.map((r) => r.id));

  it.each(cases)('$name request', async ({ request, expected }) => {
    const started = Date.now();
    const raw = await engine.generate(buildScopeGuardPrompt(agreement, request), { temperature: 0.1, maxTokens: 1500 });
    const parsed = parseAndValidateJson(raw, ScopeGuardRawOutputSchema);
    const result = validateScopeGuardFindings(parsed.findings, validIds);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    process.stdout.write(
      `\n[${expected}] got ${result.classification} in ${seconds}s\n` +
        result.findings.map((f) => `  - ${f.classification}: ${f.item} [${f.evidenceRequirementIds.join(', ')}]`).join('\n') +
        '\n',
    );
    expect(result.classification).toBe(expected);
  }, 600000);
});
