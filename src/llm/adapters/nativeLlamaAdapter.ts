import * as FileSystem from 'expo-file-system/legacy';
import { withKeepAwake } from '@/utils/keepAwake';
import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import { LLMEngineUnavailableError, LLMGenerationTimeoutError } from '../contracts';

export interface NativeLlamaConfig {
  getModelPath?: () => Promise<string | null>;
  nCtx?: number;
  nGpuLayers?: number;
  useMlock?: boolean;
  timeoutMs?: number;
  llamaModule?: LlamaModule;
}

export interface NativeModelInfo {
  available: boolean;
  modelPath: string | null;
  modelFilename: string | null;
  fileSizeBytes: number | null;
  fileSizeFormatted: string | null;
  isLoaded: boolean;
  isNativeModuleLoaded: boolean;
  error?: string;
}

export interface OnDeviceInferenceResult {
  text: string;
  durationMs: number;
  predictedTokens?: number;
  tokensPerSecond?: number;
  promptTokensPerSecond?: number;
}

type LlamaModule = typeof import('llama.rn');
type LlamaContextInstance = Awaited<ReturnType<LlamaModule['initLlama']>>;

export class NativeLlamaAdapter implements LLMEngine {
  private context: LlamaContextInstance | null = null;
  private readonly config: NativeLlamaConfig;
  private llamaModuleCache: LlamaModule | null | undefined = undefined;
  private activeModelPath: string | null = null;

  constructor(config: NativeLlamaConfig = {}) {
    this.config = {
      nCtx: 2048,
      nGpuLayers: 0,
      useMlock: false,
      timeoutMs: 120000,
      ...config,
    };
    if (config.llamaModule) {
      this.llamaModuleCache = config.llamaModule;
    }
  }

  /**
   * Lazily loads the llama.rn module. Gracefully returns null if the native binary
   * is not linked or unavailable in this environment (e.g. Jest, web, Expo Go).
   */
  private async getLlamaModule(): Promise<LlamaModule | null> {
    if (this.llamaModuleCache !== undefined) {
      return this.llamaModuleCache;
    }
    try {
      const module = await import('llama.rn');
      this.llamaModuleCache = module;
      return module;
    } catch {
      this.llamaModuleCache = null;
      return null;
    }
  }

  private async checkFileExists(uri: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists && !info.isDirectory && (info.size ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Resolves the active model file on the device.
   * Priority:
   * 1. Explicitly configured path in settings
   * 2. Standard document path: ${documentDirectory}model.gguf
   * 3. First .gguf file found in documentDirectory
   */
  async resolveModelPath(): Promise<string | null> {
    if (this.activeModelPath && (await this.checkFileExists(this.activeModelPath))) {
      return this.activeModelPath;
    }

    if (this.config.getModelPath) {
      const configured = await this.config.getModelPath();
      if (configured && (await this.checkFileExists(configured))) {
        this.activeModelPath = configured;
        return configured;
      }
    }

    const docDir = FileSystem.documentDirectory;
    if (docDir) {
      const defaultDocModel = `${docDir}model.gguf`;
      if (await this.checkFileExists(defaultDocModel)) {
        this.activeModelPath = defaultDocModel;
        return defaultDocModel;
      }

      try {
        const files = await FileSystem.readDirectoryAsync(docDir);
        const gguf = files.find((f) => f.toLowerCase().endsWith('.gguf'));
        if (gguf) {
          const candidate = `${docDir}${gguf}`;
          if (await this.checkFileExists(candidate)) {
            this.activeModelPath = candidate;
            return candidate;
          }
        }
      } catch {
        // directory scan not available or empty
      }
    }

    return null;
  }

  /**
   * Checks whether on-device inference is available:
   * Requires both the native module and a valid .gguf model file on device.
   */
  async isAvailable(): Promise<boolean> {
    const llama = await this.getLlamaModule();
    if (!llama) return false;
    const modelPath = await this.resolveModelPath();
    return modelPath !== null;
  }

  /**
   * Retrieves diagnostic status of the on-device model and engine.
   */
  async getModelInfo(): Promise<NativeModelInfo> {
    const llama = await this.getLlamaModule();
    const isNativeModuleLoaded = llama !== null;
    const modelPath = await this.resolveModelPath();

    if (!modelPath) {
      return {
        available: false,
        modelPath: null,
        modelFilename: null,
        fileSizeBytes: null,
        fileSizeFormatted: null,
        isLoaded: this.context !== null,
        isNativeModuleLoaded,
        error: isNativeModuleLoaded
          ? 'No .gguf model found in app storage. Please import a model.'
          : 'Native llama.rn runtime is not available in this environment.',
      };
    }

    let fileSizeBytes: number | null = null;
    try {
      const info = await FileSystem.getInfoAsync(modelPath);
      if (info.exists) {
        fileSizeBytes = info.size ?? null;
      }
    } catch {
      // ignore
    }

    const fileSizeFormatted = fileSizeBytes
      ? fileSizeBytes >= 1024 * 1024 * 1024
        ? `${(fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : null;

    const filename = modelPath.split('/').pop() || 'model.gguf';

    return {
      available: isNativeModuleLoaded,
      modelPath,
      modelFilename: filename,
      fileSizeBytes,
      fileSizeFormatted,
      isLoaded: this.context !== null,
      isNativeModuleLoaded,
      error: isNativeModuleLoaded ? undefined : 'Native llama.rn runtime is not available in this build.',
    };
  }

  /**
   * Initializes and caches the LlamaContext on device.
   * If already loaded, reuses the existing context.
   */
  async loadModel(onProgress?: (progress: number) => void): Promise<LlamaContextInstance> {
    if (this.context) {
      return this.context;
    }

    const modelPath = await this.resolveModelPath();
    if (!modelPath) {
      throw new LLMEngineUnavailableError('No on-device .gguf model found. Please import a model in Settings.');
    }

    const llama = await this.getLlamaModule();
    if (!llama) {
      throw new LLMEngineUnavailableError('Native llama.rn runtime is not available on this device.');
    }

    const cleanPath = modelPath.startsWith('file://') ? modelPath.slice(7) : modelPath;

    this.context = await llama.initLlama(
      {
        model: cleanPath,
        n_ctx: this.config.nCtx ?? 2048,
        n_gpu_layers: this.config.nGpuLayers ?? 0,
        use_mlock: this.config.useMlock ?? false,
      },
      onProgress,
    );

    return this.context;
  }

  /**
   * Performs text completion with messages and generation options.
   */
  async generate(messages: LLMMessage[], options: GenerationOptions = {}): Promise<string> {
    return withKeepAwake(async () => {
      const context = await this.loadModel();

      const timeoutMs = this.config.timeoutMs ?? 120000;
      let timedOut = false;

      const completionPromise = context.completion({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        n_predict: options.maxTokens ?? 1500,
        temperature: options.temperature ?? 0.1,
        stop: [
          '<|im_end|>',
          '<|end_of_text|>',
          '<|eot_id|>',
          '</s>',
          '<end_of_turn>',
          '\n\nHuman:',
          '\n\nUser:',
        ],
        enable_thinking: false,
      });

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          try {
            void context.stopCompletion();
          } catch {
            // ignore
          }
          reject(new LLMGenerationTimeoutError(`On-device generation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([completionPromise, timeoutPromise]);
        if (!result || typeof result.text !== 'string') {
          throw new Error('On-device model returned empty completion');
        }
        return result.text;
      } catch (err) {
        if (timedOut) {
          throw new LLMGenerationTimeoutError(`On-device generation timed out after ${timeoutMs}ms`);
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    });
  }

  /**
   * Tests inference with a quick sample prompt and returns timing & tokens/sec diagnostics.
   */
  async testInference(prompt?: string): Promise<OnDeviceInferenceResult> {
    return withKeepAwake(async () => {
      const start = Date.now();
      const context = await this.loadModel();

      const testMessages = prompt
        ? [{ role: 'user' as const, content: prompt }]
        : [
            {
              role: 'system' as const,
              content: 'You are OwlSet local AI assistant. Output a valid JSON object only.',
            },
            {
              role: 'user' as const,
              content: 'Extract project: "Website for 15,000 PHP with 2 weeks deadline".',
            },
          ];

      const result = await context.completion({
        messages: testMessages,
        n_predict: 256,
        temperature: 0.1,
        enable_thinking: false,
      });

      const durationMs = Date.now() - start;
      return {
        text: result.text,
        durationMs,
        predictedTokens: result.timings?.predicted_n,
        tokensPerSecond: result.timings?.predicted_per_second,
        promptTokensPerSecond: result.timings?.prompt_per_second,
      };
    });
  }

  /**
   * Imports a .gguf file from any device location into the app's document directory.
   */
  async importModel(sourceUri: string, filename?: string): Promise<{ path: string; size: number }> {
    const targetFilename =
      filename && filename.toLowerCase().endsWith('.gguf') ? filename : 'model.gguf';

    const targetDir = FileSystem.documentDirectory;
    if (!targetDir) {
      throw new Error('App document directory is not accessible.');
    }

    const destUri = `${targetDir}${targetFilename}`;

    if (sourceUri !== destUri) {
      try {
        const existing = await FileSystem.getInfoAsync(destUri);
        if (existing.exists) {
          await FileSystem.deleteAsync(destUri, { idempotent: true });
        }
      } catch {
        // ignore
      }

      await FileSystem.copyAsync({
        from: sourceUri,
        to: destUri,
      });
    }

    const info = await FileSystem.getInfoAsync(destUri);
    if (!info.exists || (info.size ?? 0) === 0) {
      throw new Error('Imported model file is empty or missing after copy.');
    }

    // Release any currently loaded context since model file changed
    await this.release();

    return {
      path: destUri,
      size: info.size ?? 0,
    };
  }

  /**
   * Releases context from memory.
   */
  async release(): Promise<void> {
    if (this.context) {
      try {
        await this.context.release();
      } catch {
        // ignore
      } finally {
        this.context = null;
      }
    }
  }

  getLoadedContext(): LlamaContextInstance | null {
    return this.context;
  }
}
