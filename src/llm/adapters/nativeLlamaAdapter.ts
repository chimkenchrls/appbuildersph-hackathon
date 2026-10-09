import * as FileSystem from 'expo-file-system/legacy';
import { withKeepAwake } from '@/utils/keepAwake';
import type { LLMEngine, LLMMessage, GenerationOptions } from '../contracts';
import { LLMContextOverflowError, LLMEngineUnavailableError, LLMGenerationTimeoutError } from '../contracts';

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

/** The smallest answer worth generating. A prompt that leaves less room than this is rejected. */
const OUTPUT_FLOOR_TOKENS = 256;
/** Chat-template tokens and counting error that the prompt estimate does not see. */
const PROMPT_SLACK_TOKENS = 32;
const TOKENS_PER_MESSAGE = 8;
/** A conservative estimate used when the model's own tokenizer is unavailable: English is nearer 4. */
const CHARS_PER_TOKEN_ESTIMATE = 3;
/** Free space kept after an import, on top of the model itself. */
const IMPORT_FREE_SPACE_MARGIN_BYTES = 256 * 1024 * 1024;
/** How long to wait for native generation to stop after a timeout before the next request may run. */
const STOP_GRACE_MS = 5000;
const GGUF_MAGIC_BASE64_PREFIX = 'R0dVRg'; // "GGUF"
const SAFE_MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,100}\.gguf$/i;

/** Keeps only a plain file name inside the app's folder. Anything else becomes model.gguf. */
export function safeModelFilename(name: string | undefined): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  return SAFE_MODEL_NAME.test(base) && !base.includes('..') ? base : 'model.gguf';
}

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

  // One owner for the native context. Loading, generating, importing and releasing run one at a
  // time, so two callers can never load the model twice or touch it while another call is using it.
  private queueTail: Promise<unknown> = Promise.resolve();

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queueTail.then(task, task);
    this.queueTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /**
   * Initializes and caches the LlamaContext on device.
   * If already loaded, reuses the existing context.
   */
  async loadModel(onProgress?: (progress: number) => void): Promise<LlamaContextInstance> {
    return this.serialized(() => this.ensureLoaded(onProgress));
  }

  private async ensureLoaded(onProgress?: (progress: number) => void): Promise<LlamaContextInstance> {
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
   * Counts the prompt with the model's own tokenizer when the runtime offers one, and with a
   * deliberately high character estimate otherwise.
   */
  private async countPromptTokens(context: LlamaContextInstance, messages: LLMMessage[]): Promise<number> {
    const tokenizer = (context as unknown as { tokenize?: (text: string) => Promise<{ tokens?: unknown[] }> }).tokenize;
    let total = PROMPT_SLACK_TOKENS;
    for (const message of messages) {
      let count: number | null = null;
      if (typeof tokenizer === 'function') {
        try {
          const result = await tokenizer.call(context, message.content);
          if (Array.isArray(result?.tokens)) count = result.tokens.length;
        } catch {
          count = null;
        }
      }
      total += (count ?? Math.ceil(message.content.length / CHARS_PER_TOKEN_ESTIMATE)) + TOKENS_PER_MESSAGE;
    }
    return total;
  }

  /**
   * Performs text completion with messages and generation options.
   * Rejects a prompt that cannot fit the context, and trims the answer allowance so that
   * prompt plus answer always fit. Nothing is silently dropped from the prompt.
   */
  async generate(messages: LLMMessage[], options: GenerationOptions = {}): Promise<string> {
    return this.serialized(() =>
      withKeepAwake(async () => {
        const context = await this.ensureLoaded();

        const nCtx = this.config.nCtx ?? 2048;
        const promptTokens = await this.countPromptTokens(context, messages);
        const room = nCtx - promptTokens;
        if (room < OUTPUT_FLOOR_TOKENS) {
          throw new LLMContextOverflowError(promptTokens, nCtx);
        }
        const nPredict = Math.min(options.maxTokens ?? 1500, room);

        const timeoutMs = this.config.timeoutMs ?? 120000;
        let timedOut = false;

        const completionPromise = context.completion({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          n_predict: nPredict,
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
            // Hold the queue until native generation has really stopped, so the next request
            // does not start on a context that is still busy.
            let grace: ReturnType<typeof setTimeout> | undefined;
            await Promise.race([
              completionPromise.then(
                () => undefined,
                () => undefined,
              ),
              new Promise<void>((resolve) => {
                grace = setTimeout(resolve, STOP_GRACE_MS);
              }),
            ]);
            if (grace) clearTimeout(grace);
            throw new LLMGenerationTimeoutError(`On-device generation timed out after ${timeoutMs}ms`);
          }
          throw err;
        } finally {
          if (timer) clearTimeout(timer);
        }
      }),
    );
  }

  /**
   * Tests inference with a quick sample prompt and returns timing & tokens/sec diagnostics.
   */
  async testInference(prompt?: string): Promise<OnDeviceInferenceResult> {
    return this.serialized(() =>
      withKeepAwake(async () => {
        const start = Date.now();
        const context = await this.ensureLoaded();

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
      }),
    );
  }

  /**
   * Imports a .gguf file from any device location into the app's document directory.
   *
   * The file is staged beside its destination, checked, and only then replaces the current
   * model, so a failed copy or a wrong file leaves the installed model untouched.
   * Checks: free space, a complete copy, and the GGUF header. This is not a digest check, and
   * the model is not smoke-tested before it replaces the old one.
   */
  async importModel(sourceUri: string, filename?: string): Promise<{ path: string; size: number }> {
    return this.serialized(async () => {
      const targetDir = FileSystem.documentDirectory;
      if (!targetDir) {
        throw new Error('App document directory is not accessible.');
      }

      const destUri = `${targetDir}${safeModelFilename(filename)}`;
      const stagingUri = `${destUri}.partial`;

      if (sourceUri === destUri) {
        const own = await FileSystem.getInfoAsync(destUri);
        if (!own.exists || (own.size ?? 0) === 0) {
          throw new Error('Imported model file is empty or missing.');
        }
        return { path: destUri, size: own.size ?? 0 };
      }

      const source = await FileSystem.getInfoAsync(sourceUri);
      const sourceSize = source.exists && !source.isDirectory ? (source.size ?? 0) : 0;
      if (sourceSize === 0) {
        throw new Error('The selected model file is empty or unavailable on this device.');
      }

      // The staged copy and the current model briefly exist together.
      if (typeof FileSystem.getFreeDiskStorageAsync === 'function') {
        const free = await FileSystem.getFreeDiskStorageAsync();
        if (free < sourceSize + IMPORT_FREE_SPACE_MARGIN_BYTES) {
          throw new Error('Not enough free storage to import this model. Free some space and try again.');
        }
      }

      const discard = (uri: string) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
      await discard(stagingUri);
      try {
        await FileSystem.copyAsync({ from: sourceUri, to: stagingUri });

        const staged = await FileSystem.getInfoAsync(stagingUri);
        if (!staged.exists || (staged.size ?? 0) !== sourceSize) {
          throw new Error('The model copy is incomplete. Try importing it again.');
        }
        const header = await FileSystem.readAsStringAsync(stagingUri, {
          encoding: 'base64' as FileSystem.EncodingType,
          position: 0,
          length: 4,
        });
        if (!header.startsWith(GGUF_MAGIC_BASE64_PREFIX)) {
          throw new Error('The selected file is not a GGUF model.');
        }

        // Only now is the installed model replaced.
        await this.releaseNow();
        await discard(destUri);
        await FileSystem.moveAsync({ from: stagingUri, to: destUri });
      } catch (error) {
        await discard(stagingUri);
        throw error;
      }

      // The picker's cache copy is no longer needed and is as large as the model.
      if (FileSystem.cacheDirectory && sourceUri.startsWith(FileSystem.cacheDirectory)) {
        await discard(sourceUri);
      }

      this.activeModelPath = destUri;
      const info = await FileSystem.getInfoAsync(destUri);
      if (!info.exists || (info.size ?? 0) === 0) {
        throw new Error('Imported model file is empty or missing after copy.');
      }
      return { path: destUri, size: info.size ?? 0 };
    });
  }

  /**
   * Releases context from memory.
   */
  async release(): Promise<void> {
    return this.serialized(() => this.releaseNow());
  }

  private async releaseNow(): Promise<void> {
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
