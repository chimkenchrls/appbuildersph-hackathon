import { withKeepAwake } from '@/utils/keepAwake';
import { Platform } from 'react-native';
import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import { LLMEngineUnavailableError, LLMGenerationTimeoutError } from '../contracts';

export interface LMStudioAdapterConfig {
  getBaseUrl?: () => Promise<string>;
  getModel?: () => Promise<string>;
  timeoutMs?: number;
}

export interface ConnectionStatus {
  available: boolean;
  error?: string;
  models: string[];
  activeModel: string;
  url: string;
}

export function normalizeLlmUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (!trimmed) {
    return Platform.OS === 'android' ? 'http://10.0.2.2:1234/v1' : 'http://localhost:1234/v1';
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`;
  }
  trimmed = trimmed.replace(/\/+$/, '');
  if (!/\/v1$/i.test(trimmed)) {
    trimmed = `${trimmed}/v1`;
  }
  return trimmed;
}

export class LMStudioAdapter implements LLMEngine {
  private readonly timeoutMs: number;
  private readonly getBaseUrl: () => Promise<string>;
  private readonly getModel: () => Promise<string>;

  constructor(config: LMStudioAdapterConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? 120000;

    const defaultUrl = Platform.OS === 'android' ? 'http://10.0.2.2:1234/v1' : 'http://localhost:1234/v1';

    this.getBaseUrl = config.getBaseUrl ?? (async () => defaultUrl);
    this.getModel = config.getModel ?? (async () => 'local-model');
  }

  async getEffectiveUrl(): Promise<string> {
    const raw = await this.getBaseUrl();
    return normalizeLlmUrl(raw);
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const baseUrl = await this.getEffectiveUrl();
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

  async checkConnection(): Promise<ConnectionStatus> {
    const baseUrl = await this.getEffectiveUrl();
    const activeModel = await this.getModel();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return {
          available: false,
          error: `Server responded with HTTP ${response.status}`,
          models: [],
          activeModel,
          url: baseUrl,
        };
      }

      const data = (await response.json()) as { data?: { id?: string }[] };
      const modelList = Array.isArray(data.data)
        ? data.data.map((m) => m.id).filter((id): id is string => typeof id === 'string')
        : [];

      return {
        available: true,
        models: modelList,
        activeModel: modelList.length > 0 && activeModel === 'local-model' ? modelList[0] : activeModel,
        url: baseUrl,
      };
    } catch (err) {
      return {
        available: false,
        error: (err as Error).message || 'Connection refused or timed out',
        models: [],
        activeModel,
        url: baseUrl,
      };
    }
  }

  async generate(messages: LLMMessage[], options: GenerationOptions = {}): Promise<string> {
    return withKeepAwake(() => this.generateResponse(messages, options));
  }

  private async generateResponse(messages: LLMMessage[], options: GenerationOptions): Promise<string> {
    const baseUrl = await this.getEffectiveUrl();
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
