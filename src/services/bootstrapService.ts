import { repositories, type Repositories } from '@/database/repositories';
import { transaction } from '@/database/transaction';
import { getDatabaseAsync } from '@/database/client';
import { migrateAsync } from '@/database/migrate';
import { seedDemoDataAsync } from '@/database/seed';
import { USER_CONFIGURED_KEY } from '@/database/settingKeys';
import { LMStudioAdapter } from '@/llm/adapters/lmStudioAdapter';
import { NativeLlamaAdapter } from '@/llm/adapters/nativeLlamaAdapter';
import { HybridLlmAdapter } from '@/llm/adapters/hybridLlmAdapter';
import { BriefCraftService } from './briefCraftService';
import { KasunduanVaultService } from './kasunduanVaultService';
import { ScopeGuardService } from './scopeGuardService';
import { ChangeDeskService } from './changeDeskService';
import { ExportService } from './exportService';

export interface AppServices {
  transaction<T>(action: (repos: Repositories) => Promise<T>): Promise<T>;
  repositories: Repositories;
  services: {
    briefCraft: BriefCraftService;
    kasunduanVault: KasunduanVaultService;
    scopeGuard: ScopeGuardService;
    changeDesk: ChangeDeskService;
    export: ExportService;
  };
  llmEngine: HybridLlmAdapter;
}

let initialization: Promise<AppServices> | null = null;

export function initializeBackendAsync(): Promise<AppServices> {
  if (!initialization) initialization = initialize().catch(error => { initialization = null; throw error; });
  return initialization;
}

async function initialize(): Promise<AppServices> {
  const db = await getDatabaseAsync();

  // 1. Run migrations
  await migrateAsync(db);

  // 2. Seed demo project if empty
  await seedDemoDataAsync(db);

  // 3. Initialize Repositories
  const repos = repositories(db);
  const { agreement: agreementRepo, scopeGuard: scopeGuardRepo, proposal: proposalRepo, settings: settingsRepo } = repos;

  // Precedence: an address the user saved in Settings, then the build's configuration, then the
  // default saved on first launch. Saved settings are never rewritten here.
  const networkEngine = new LMStudioAdapter({
    getBaseUrl: async () => {
      const saved = await settingsRepo.get('lm_studio_url');
      if (saved && await settingsRepo.get(USER_CONFIGURED_KEY)) return saved;
      return process.env.EXPO_PUBLIC_LM_STUDIO_URL || saved || 'http://10.0.2.2:1234/v1';
    },
    getModel: async () => {
      const saved = await settingsRepo.get('lm_studio_model');
      if (saved && await settingsRepo.get(USER_CONFIGURED_KEY)) return saved;
      return process.env.EXPO_PUBLIC_LM_STUDIO_MODEL || saved || 'local-model';
    },
  });

  const nativeEngine = new NativeLlamaAdapter({
    getModelPath: async () => {
      return await settingsRepo.get('on_device_model_path');
    },
  });

  const llmEngine = new HybridLlmAdapter({
    nativeAdapter: nativeEngine,
    networkAdapter: networkEngine,
    getMode: async () => {
      const mode = await settingsRepo.get('llm_mode');
      return (mode === 'on_device' || mode === 'network' || mode === 'auto') ? mode : 'auto';
    },
    setMode: async (mode) => {
      await settingsRepo.set('llm_mode', mode);
    },
  });

  // 5. Initialize Services
  const briefCraft = new BriefCraftService(llmEngine);
  const kasunduanVault = new KasunduanVaultService(agreementRepo);
  const scopeGuard = new ScopeGuardService(llmEngine, agreementRepo, scopeGuardRepo);
  const changeDesk = new ChangeDeskService(llmEngine, agreementRepo, scopeGuardRepo, proposalRepo);
  const exportService = new ExportService(db);

  return {
    transaction: action => transaction(db, tx => action(repositories(tx, true))),
    repositories: repos,
    services: {
      briefCraft,
      kasunduanVault,
      scopeGuard,
      changeDesk,
      export: exportService,
    },
    llmEngine,
  };
}
