import { repositories, type Repositories } from '@/database/repositories';
import { transaction } from '@/database/transaction';
import { getDatabaseAsync } from '@/database/client';
import { migrateAsync } from '@/database/migrate';
import { seedDemoDataAsync } from '@/database/seed';
import { LMStudioAdapter } from '@/llm/adapters/lmStudioAdapter';
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
  llmEngine: LMStudioAdapter;
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

  // Explicit development configuration wins over defaults saved on first launch.
  // Keep saved settings as a fallback without rewriting existing projects or settings.
  const llmEngine = new LMStudioAdapter({
    getBaseUrl: async () => {
      return process.env.EXPO_PUBLIC_LM_STUDIO_URL || await settingsRepo.get('lm_studio_url') || 'http://10.0.2.2:1234/v1';
    },
    getModel: async () => {
      return process.env.EXPO_PUBLIC_LM_STUDIO_MODEL || await settingsRepo.get('lm_studio_model') || 'local-model';
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
