import { migrateAsync } from '@/database/migrate';
import { SettingsRepository } from '@/database/repositories/settingsRepository';
import { nodeSqlite, openDatabase } from './helpers/sqliteShim';

const run = nodeSqlite ? describe : describe.skip;

async function boot(settings: Record<string, string>, env: { url?: string; model?: string }) {
  jest.resetModules();
  const db = openDatabase();
  await migrateAsync(db);
  const repo = new SettingsRepository(db);
  for (const [key, value] of Object.entries(settings)) await repo.set(key, value);
  jest.doMock('@/database/client', () => ({ getDatabaseAsync: async () => db }));
  if (env.url === undefined) delete process.env.EXPO_PUBLIC_LM_STUDIO_URL; else process.env.EXPO_PUBLIC_LM_STUDIO_URL = env.url;
  if (env.model === undefined) delete process.env.EXPO_PUBLIC_LM_STUDIO_MODEL; else process.env.EXPO_PUBLIC_LM_STUDIO_MODEL = env.model;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initializeBackendAsync } = require('@/services/domain/bootstrapService');
  const backend = await initializeBackendAsync();
  return {
    url: await backend.llmEngine.networkAdapter.getEffectiveUrl(),
    model: await (backend.llmEngine.networkAdapter as unknown as { getModel(): Promise<string> }).getModel(),
  };
}

run('which server address the app uses', () => {
  const original = { url: process.env.EXPO_PUBLIC_LM_STUDIO_URL, model: process.env.EXPO_PUBLIC_LM_STUDIO_MODEL };
  afterEach(() => {
    if (original.url === undefined) delete process.env.EXPO_PUBLIC_LM_STUDIO_URL; else process.env.EXPO_PUBLIC_LM_STUDIO_URL = original.url;
    if (original.model === undefined) delete process.env.EXPO_PUBLIC_LM_STUDIO_MODEL; else process.env.EXPO_PUBLIC_LM_STUDIO_MODEL = original.model;
  });

  test('a build setting overrides a default saved on first launch', async () => {
    const result = await boot({ lm_studio_url: 'http://old:1234/v1', lm_studio_model: 'local-model' }, { url: 'http://build:1234/v1', model: 'qwen' });
    expect(result).toEqual({ url: 'http://build:1234/v1', model: 'qwen' });
  });

  test('an address the user saved in Settings overrides the build setting', async () => {
    const result = await boot({ lm_studio_url: 'http://mine:1234/v1', lm_studio_model: 'my-model', lm_studio_user_configured: '1' },
      { url: 'http://build:1234/v1', model: 'qwen' });
    expect(result).toEqual({ url: 'http://mine:1234/v1', model: 'my-model' });
  });

  test('with no build setting the saved address is used', async () => {
    const result = await boot({ lm_studio_url: 'http://saved:1234/v1', lm_studio_model: 'saved-model' }, {});
    expect(result).toEqual({ url: 'http://saved:1234/v1', model: 'saved-model' });
  });
});
