import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import type { ConnectionStatus, LMStudioAdapter } from './lmStudioAdapter';
import type { NativeLlamaAdapter } from './nativeLlamaAdapter';

export type LlmEngineMode = 'on_device' | 'network' | 'auto';

export interface HybridLlmConfig {
  nativeAdapter: NativeLlamaAdapter;
  networkAdapter: LMStudioAdapter;
  getMode?: () => Promise<LlmEngineMode>;
  setMode?: (mode: LlmEngineMode) => Promise<void>;
}

/**
 * HybridLlmAdapter routes requests between on-device inference (llama.rn)
 * and network inference (LM Studio / Ollama).
 *
 * In 'on_device' mode: operates 100% offline using local device weights.
 * In 'network' mode: calls the local network HTTP endpoint.
 * In 'auto' mode: uses on-device inference if a model file is present,
 *                 otherwise gracefully falls back to the network server.
 */
export class HybridLlmAdapter implements LLMEngine {
  public readonly nativeAdapter: NativeLlamaAdapter;
  public readonly networkAdapter: LMStudioAdapter;
  private readonly getModeFn: () => Promise<LlmEngineMode>;
  private readonly setModeFn: (mode: LlmEngineMode) => Promise<void>;

  constructor(config: HybridLlmConfig) {
    this.nativeAdapter = config.nativeAdapter;
    this.networkAdapter = config.networkAdapter;
    this.getModeFn = config.getMode ?? (async () => 'auto');
    this.setModeFn = config.setMode ?? (async () => undefined);
  }

  async getMode(): Promise<LlmEngineMode> {
    return this.getModeFn();
  }

  async setMode(mode: LlmEngineMode): Promise<void> {
    await this.setModeFn(mode);
  }

  async getActiveEngineType(): Promise<'on_device' | 'network' | 'none'> {
    const mode = await this.getMode();
    if (mode === 'on_device') {
      return (await this.nativeAdapter.isAvailable()) ? 'on_device' : 'none';
    }
    if (mode === 'network') {
      return (await this.networkAdapter.isAvailable()) ? 'network' : 'none';
    }
    // auto
    if (await this.nativeAdapter.isAvailable()) {
      return 'on_device';
    }
    if (await this.networkAdapter.isAvailable()) {
      return 'network';
    }
    return 'none';
  }

  async isAvailable(): Promise<boolean> {
    const mode = await this.getMode();
    if (mode === 'on_device') {
      return this.nativeAdapter.isAvailable();
    }
    if (mode === 'network') {
      return this.networkAdapter.isAvailable();
    }
    // 'auto' mode: on-device preferred, network fallback
    if (await this.nativeAdapter.isAvailable()) {
      return true;
    }
    return this.networkAdapter.isAvailable();
  }

  async generate(messages: LLMMessage[], options?: GenerationOptions): Promise<string> {
    const mode = await this.getMode();
    if (mode === 'on_device') {
      return this.nativeAdapter.generate(messages, options);
    }
    if (mode === 'network') {
      return this.networkAdapter.generate(messages, options);
    }

    // 'auto' mode: prefer on-device if available
    if (await this.nativeAdapter.isAvailable()) {
      return this.nativeAdapter.generate(messages, options);
    }
    return this.networkAdapter.generate(messages, options);
  }

  async getEffectiveUrl(): Promise<string> {
    const mode = await this.getMode();
    if (mode === 'on_device') {
      return 'on-device://llama.rn';
    }
    return this.networkAdapter.getEffectiveUrl();
  }

  async checkConnection(): Promise<ConnectionStatus> {
    const mode = await this.getMode();

    if (mode === 'on_device') {
      const info = await this.nativeAdapter.getModelInfo();
      if (info.available && info.modelPath) {
        return {
          available: true,
          activeModel: `On-Device (${info.modelFilename ?? 'GGUF'} · ${info.fileSizeFormatted ?? 'Local'})`,
          models: [info.modelFilename || 'model.gguf'],
          url: 'on-device://llama.rn',
        };
      }
      return {
        available: false,
        error: info.error || 'On-device model file not found in storage. Please import a .gguf model in Settings.',
        activeModel: 'on-device-llama',
        models: [],
        url: 'on-device://llama.rn',
      };
    }

    if (mode === 'network') {
      return this.networkAdapter.checkConnection();
    }

    // mode === 'auto'
    const onDeviceInfo = await this.nativeAdapter.getModelInfo();
    if (onDeviceInfo.available && onDeviceInfo.modelPath) {
      return {
        available: true,
        activeModel: `On-Device (${onDeviceInfo.modelFilename ?? 'GGUF'} · ${onDeviceInfo.fileSizeFormatted ?? 'Local'})`,
        models: [onDeviceInfo.modelFilename || 'model.gguf'],
        url: 'on-device://llama.rn',
      };
    }

    // fallback to network in auto mode
    return this.networkAdapter.checkConnection();
  }
}
