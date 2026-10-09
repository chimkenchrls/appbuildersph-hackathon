import { Platform } from 'react-native';
import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import { LLMEngineUnavailableError } from '../contracts';

export interface LMStudioAdapterConfig {
  getBaseUrl?: () => Promise<string>;
  getModel?: () => Promise<string>;
  timeoutMs?: number;
}

export class LMStudioAdapter implements LLMEngine {
  private readonly timeoutMs: number;
  private readonly getBaseUrl: () => Promise<string>;
  private readonly getModel: () => Promise<string>;

  constructor(config: LMStudioAdapterConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? 60000;

    const defaultUrl = Platform.OS === 'android' ? 'http://10.0.2.2:1234/v1' : 'http://localhost:1234/v1';

    this.getBaseUrl = config.getBaseUrl ?? (async () => defaultUrl);
    this.getModel = config.getModel ?? (async () => 'local-model');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = await this.getBaseUrl();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  async generate(messages: LLMMessage[], options: GenerationOptions = {}): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const model = await this.getModel();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 1024,
          // Reasoning models (such as Qwen3.5) otherwise spend the whole token budget thinking
          // and return no JSON. LM Studio ignores this field for models without reasoning.
          reasoning_effort: 'none',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LM Studio returned HTTP ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };

      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('LM Studio response choices missing content');
      }

      return content;
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === 'AbortError') {
        throw new LLMEngineUnavailableError(`Request timed out after ${this.timeoutMs}ms`);
      }
      if (err instanceof LLMEngineUnavailableError) {
        throw err;
      }
      throw new LLMEngineUnavailableError(`Failed to communicate with LM Studio: ${(err as Error).message}`);
    }
  }
}
