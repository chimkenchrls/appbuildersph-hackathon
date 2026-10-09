import { Platform } from 'react-native';
import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import { LLMEngineUnavailableError } from '../contracts';
import { withKeepAwake } from '@/utils/keepAwake';

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
    this.timeoutMs = config.timeoutMs ?? 45000;

    const defaultUrl = Platform.OS === 'android' ? 'http://10.0.2.2:1234/v1' : 'http://localhost:1234/v1';

    this.getBaseUrl = config.getBaseUrl ?? (async () => defaultUrl);
    this.getModel = config.getModel ?? (async () => 'local-model');
  }

  async getEffectiveUrl(): Promise<string> {
    const raw = await this.getBaseUrl();
    return normalizeLlmUrl(raw);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = await this.getEffectiveUrl();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);

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
    return await withKeepAwake(async () => {
      const baseUrl = await this.getEffectiveUrl();
      let model = await this.getModel();

      // Check models if local-model is placeholder
      if (model === 'local-model') {
        try {
          const status = await this.checkConnection();
          if (status.models.length > 0) {
            model = status.models[0];
          }
        } catch {
          // keep fallback
        }
      }

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
            max_tokens: options.maxTokens ?? 1500,
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
        throw new LLMEngineUnavailableError(`Failed to communicate with Local LLM at ${baseUrl}: ${(err as Error).message}`);
      }
    }, 'lmstudio_inference');
  }
}
