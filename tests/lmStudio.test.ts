import { LMStudioAdapter } from '@/llm/adapters/lmStudioAdapter';

const model = 'qwen/qwen3.5-9b';
const messages = [{ role: 'user' as const, content: 'Reply only OK.' }];

describe('LM Studio model readiness', () => {
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  test('a reachable server is unavailable when the selected model is absent', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ object: 'list', data: [{ id: model, object: 'model', owned_by: 'local' }] }),
    } as Response);
    const engine = new LMStudioAdapter({ getModel: async () => 'local-model' });

    expect(await engine.isAvailable()).toBe(false);
  });

  test('the selected model is ready and can receive generation requests', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      if (String(url).endsWith('/models')) {
        return { ok: true, json: async () => ({ object: 'list', data: [{ id: model, object: 'model', owned_by: 'local' }] }) } as Response;
      }
      const body = JSON.parse(String(init?.body));
      return body.model === model
        ? { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }] }) } as Response
        : { ok: false, status: 400, text: async () => 'model_not_found' } as Response;
    });
    const engine = new LMStudioAdapter({ getModel: async () => model });

    expect(await engine.isAvailable()).toBe(true);
    expect(await engine.generate(messages)).toBe('OK');
  });

  test.each([{}, { data: [] }, { data: [{ id: 123 }] }, { data: null }])(
    'invalid or empty model listings cannot advertise readiness: %j', async listing => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => listing } as Response);
      expect(await new LMStudioAdapter({ getModel: async () => model }).isAvailable()).toBe(false);
    },
  );

  test('requests a direct answer rather than spending the response budget on reasoning', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const answer = body.reasoning_effort === 'none' ? 'OK' : '';
      return { ok: true, json: async () => ({ choices: [{ message: { role: 'assistant', content: answer, reasoning_content: answer ? '' : 'Thinking Process...' } }] }) } as Response;
    });
    expect(await new LMStudioAdapter({ getModel: async () => model }).generate(messages)).toBe('OK');
  });

  test.each(['headers', 'body'])('generation deadline covers stalled response %s and reports a timeout', async phase => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const stalled = () => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true });
      });
      if (phase === 'headers') return stalled();
      return { ok: true, json: stalled } as unknown as Response;
    });
    let failure: unknown;
    const running = new LMStudioAdapter({ timeoutMs: 10 }).generate(messages).catch(error => { failure = error; });
    await jest.advanceTimersByTimeAsync(10);
    expect(failure).toBeDefined();
    expect(failure).toMatchObject({ name: 'LLMGenerationTimeoutError' });
    await running;
  });
});
