import { NativeLlamaAdapter, type NativeLlamaConfig } from '@/llm/adapters/nativeLlamaAdapter';
import { HybridLlmAdapter } from '@/llm/adapters/hybridLlmAdapter';
import { LMStudioAdapter } from '@/llm/adapters/lmStudioAdapter';
import { LLMEngineUnavailableError } from '@/llm/contracts';

jest.mock('expo-file-system/legacy', () => {
  let mockFiles: Record<string, { size: number; exists: boolean }> = {};
  return {
    documentDirectory: 'file:///mock/documents/',
    getInfoAsync: jest.fn(async (uri: string) => {
      if (mockFiles[uri]) {
        return { exists: true, size: mockFiles[uri].size, isDirectory: false };
      }
      return { exists: false, isDirectory: false };
    }),
    readDirectoryAsync: jest.fn(async (dirUri: string) => {
      return Object.keys(mockFiles)
        .filter((k) => k.startsWith(dirUri))
        .map((k) => k.replace(dirUri, ''));
    }),
    copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      mockFiles[to] = mockFiles[from] || { size: 1024 * 1024 * 500, exists: true };
    }),
    deleteAsync: jest.fn(async (uri: string) => {
      delete mockFiles[uri];
    }),
    __setMockFiles: (files: Record<string, { size: number; exists: boolean }>) => {
      mockFiles = { ...files };
    },
    __clearMockFiles: () => {
      mockFiles = {};
    },
  };
});

// Mock llama.rn
const mockRelease = jest.fn(async () => undefined);
const mockStopCompletion = jest.fn(async () => undefined);
const mockCompletion = jest.fn(async () => ({
  text: '{"title":"Test Project"}',
  timings: {
    predicted_n: 20,
    predicted_per_second: 15.5,
    prompt_per_second: 30.0,
  },
}));

const mockInitLlama = jest.fn(async () => ({
  completion: mockCompletion,
  release: mockRelease,
  stopCompletion: mockStopCompletion,
}));

const mockLlamaModule = {
  initLlama: mockInitLlama,
  releaseAllLlama: jest.fn(async () => undefined),
};

function createAdapter(config: Partial<NativeLlamaConfig> = {}) {
  return new NativeLlamaAdapter({
    llamaModule: mockLlamaModule as any,
    ...config,
  });
}

describe('NativeLlamaAdapter', () => {
  const fsMock = require('expo-file-system/legacy');

  beforeEach(() => {
    jest.clearAllMocks();
    fsMock.__clearMockFiles();
  });

  test('isAvailable returns false when no model exists on device', async () => {
    const adapter = createAdapter();
    expect(await adapter.isAvailable()).toBe(false);

    const info = await adapter.getModelInfo();
    expect(info.available).toBe(false);
    expect(info.modelPath).toBeNull();
  });

  test('resolves default model.gguf when present in documentDirectory', async () => {
    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 800, exists: true },
    });

    const adapter = createAdapter();
    expect(await adapter.isAvailable()).toBe(true);

    const info = await adapter.getModelInfo();
    expect(info.available).toBe(true);
    expect(info.modelFilename).toBe('model.gguf');
    expect(info.fileSizeFormatted).toBe('800.0 MB');
  });

  test('resolves custom .gguf file discovered in directory scan', async () => {
    fsMock.__setMockFiles({
      'file:///mock/documents/qwen2.5-coder-1.5b.gguf': {
        size: 1024 * 1024 * 1024 * 1.5,
        exists: true,
      },
    });

    const adapter = createAdapter();
    expect(await adapter.isAvailable()).toBe(true);

    const info = await adapter.getModelInfo();
    expect(info.available).toBe(true);
    expect(info.modelFilename).toBe('qwen2.5-coder-1.5b.gguf');
    expect(info.fileSizeFormatted).toBe('1.50 GB');
  });

  test('generate loads model and returns completion text', async () => {
    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 500, exists: true },
    });

    const adapter = createAdapter();
    const result = await adapter.generate([
      { role: 'user', content: 'Extract requirements from: website PHP 15000' },
    ]);

    expect(mockInitLlama).toHaveBeenCalledTimes(1);
    expect(mockCompletion).toHaveBeenCalledTimes(1);
    expect(result).toBe('{"title":"Test Project"}');

    // Second call reuses context without re-initializing model
    await adapter.generate([{ role: 'user', content: 'Follow up' }]);
    expect(mockInitLlama).toHaveBeenCalledTimes(1);
  });

  test('generate throws LLMEngineUnavailableError when no model file exists', async () => {
    const adapter = createAdapter();
    await expect(
      adapter.generate([{ role: 'user', content: 'Hello' }]),
    ).rejects.toThrow(LLMEngineUnavailableError);
  });

  test('testInference returns diagnostics and tokens per second', async () => {
    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 500, exists: true },
    });

    const adapter = createAdapter();
    const testDiag = await adapter.testInference();

    expect(testDiag.text).toBe('{"title":"Test Project"}');
    expect(testDiag.tokensPerSecond).toBe(15.5);
    expect(testDiag.predictedTokens).toBe(20);
    expect(testDiag.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('importModel copies file to document directory and resets loaded context', async () => {
    fsMock.__setMockFiles({
      'file:///mock/cache/qwen-imported.gguf': { size: 1024 * 1024 * 600, exists: true },
    });

    const adapter = createAdapter();
    const imported = await adapter.importModel(
      'file:///mock/cache/qwen-imported.gguf',
      'qwen-imported.gguf',
    );

    expect(imported.path).toBe('file:///mock/documents/qwen-imported.gguf');
    expect(imported.size).toBe(1024 * 1024 * 600);

    const info = await adapter.getModelInfo();
    expect(info.modelFilename).toBe('qwen-imported.gguf');
  });

  test('release unloads model context from memory', async () => {
    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 500, exists: true },
    });

    const adapter = createAdapter();
    await adapter.loadModel();
    expect(adapter.getLoadedContext()).not.toBeNull();

    await adapter.release();
    expect(mockRelease).toHaveBeenCalledTimes(1);
    expect(adapter.getLoadedContext()).toBeNull();
  });
});

describe('HybridLlmAdapter', () => {
  const fsMock = require('expo-file-system/legacy');

  let nativeAdapter: NativeLlamaAdapter;
  let networkAdapter: LMStudioAdapter;
  let hybridAdapter: HybridLlmAdapter;
  let currentMode: 'on_device' | 'network' | 'auto';

  beforeEach(() => {
    jest.clearAllMocks();
    fsMock.__clearMockFiles();
    currentMode = 'auto';

    nativeAdapter = createAdapter();
    networkAdapter = new LMStudioAdapter();
    // Mock network adapter methods
    jest.spyOn(networkAdapter, 'isAvailable').mockImplementation(async () => true);
    jest.spyOn(networkAdapter, 'generate').mockImplementation(async () => 'Network Output');

    hybridAdapter = new HybridLlmAdapter({
      nativeAdapter,
      networkAdapter,
      getMode: async () => currentMode,
      setMode: async (mode) => {
        currentMode = mode;
      },
    });
  });

  test('auto mode falls back to network when on-device model is missing', async () => {
    expect(await hybridAdapter.getActiveEngineType()).toBe('network');
    expect(await hybridAdapter.isAvailable()).toBe(true);

    const res = await hybridAdapter.generate([{ role: 'user', content: 'test' }]);
    expect(res).toBe('Network Output');
  });

  test('auto mode uses on-device inference when model is present', async () => {
    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 500, exists: true },
    });

    expect(await hybridAdapter.getActiveEngineType()).toBe('on_device');
    const res = await hybridAdapter.generate([{ role: 'user', content: 'test' }]);
    expect(res).toBe('{"title":"Test Project"}');
    expect(mockCompletion).toHaveBeenCalledTimes(1);
  });

  test('on_device mode exclusively uses native adapter', async () => {
    currentMode = 'on_device';

    // Model missing
    expect(await hybridAdapter.isAvailable()).toBe(false);
    expect(await hybridAdapter.getActiveEngineType()).toBe('none');

    // Add model
    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 500, exists: true },
    });

    expect(await hybridAdapter.isAvailable()).toBe(true);
    expect(await hybridAdapter.getActiveEngineType()).toBe('on_device');

    const status = await hybridAdapter.checkConnection();
    expect(status.available).toBe(true);
    expect(status.activeModel).toContain('On-Device');
    expect(status.url).toBe('on-device://llama.rn');
  });

  test('network mode exclusively uses network adapter', async () => {
    currentMode = 'network';

    fsMock.__setMockFiles({
      'file:///mock/documents/model.gguf': { size: 1024 * 1024 * 500, exists: true },
    });

    expect(await hybridAdapter.getActiveEngineType()).toBe('network');
    const res = await hybridAdapter.generate([{ role: 'user', content: 'test' }]);
    expect(res).toBe('Network Output');
  });

  test('setMode updates configuration', async () => {
    await hybridAdapter.setMode('on_device');
    expect(currentMode).toBe('on_device');
    expect(await hybridAdapter.getMode()).toBe('on_device');
  });
});
