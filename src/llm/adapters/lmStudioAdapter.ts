import { Platform } from 'react-native';
import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import { LLMEngineUnavailableError, LLMGenerationTimeoutError } from '../contracts';

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const baseUrl = await this.getBaseUrl();
      const model = await this.getModel();

      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) return false;
      const listing = await response.json() as { data?: unknown } | null;
      return Array.isArray(listing?.data) && listing.data.some((entry: unknown) =>
        entry !== null && typeof entry === 'object' && 'id' in entry && entry.id === model,
      );
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
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
          // Saklaw needs the final structured answer within its token/time budget.
          reasoning_effort: 'none',
        }),
        signal: controller.signal,
      });

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
      if (controller.signal.aborted) {
        throw new LLMGenerationTimeoutError(`Request timed out after ${this.timeoutMs}ms`);
      }
      if (err instanceof LLMEngineUnavailableError) {
        throw err;
      }
      throw new LLMEngineUnavailableError(`Failed to communicate with LM Studio: ${(err as Error).message}`);
    } finally {
      // Keep the deadline active until the entire response has been consumed.
      clearTimeout(timer);
    }
  }
}
