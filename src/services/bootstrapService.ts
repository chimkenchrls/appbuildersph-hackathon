import { getDatabaseAsync } from '@/database/client';
import { migrateAsync } from '@/database/migrate';
import { seedDemoDataAsync } from '@/database/seed';
import { ProjectRepository } from '@/database/repositories/projectRepository';
import { AgreementRepository } from '@/database/repositories/agreementRepository';
import { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import { ProposalRepository } from '@/database/repositories/proposalRepository';
import { SettingsRepository } from '@/database/repositories/settingsRepository';
import { LMStudioAdapter } from '@/llm/adapters/lmStudioAdapter';
import { BriefCraftService } from './briefCraftService';
import { KasunduanVaultService } from './kasunduanVaultService';
import { ScopeGuardService } from './scopeGuardService';
import { ChangeDeskService } from './changeDeskService';
import { ExportService } from './exportService';

export interface AppServices {
  repositories: {
    project: ProjectRepository;
    agreement: AgreementRepository;
    scopeGuard: ScopeGuardRepository;
    proposal: ProposalRepository;
    settings: SettingsRepository;
  };
  services: {
    briefCraft: BriefCraftService;
    kasunduanVault: KasunduanVaultService;
    scopeGuard: ScopeGuardService;
    changeDesk: ChangeDeskService;
    export: ExportService;
  };
  llmEngine: LMStudioAdapter;
}

let servicesInstance: AppServices | null = null;

export async function initializeBackendAsync(): Promise<AppServices> {
  if (servicesInstance) {
    return servicesInstance;
  }

  const db = await getDatabaseAsync();

  // 1. Run migrations
  await migrateAsync(db);

  // 2. Seed demo project if empty
  await seedDemoDataAsync(db);

  // 3. Initialize Repositories
  const projectRepo = new ProjectRepository(db);
  const agreementRepo = new AgreementRepository(db);
  const scopeGuardRepo = new ScopeGuardRepository(db);
  const proposalRepo = new ProposalRepository(db);
  const settingsRepo = new SettingsRepository(db);

  // 4. Initialize LLM Adapter with dynamic settings lookup
  const llmEngine = new LMStudioAdapter({
    getBaseUrl: async () => {
      const saved = await settingsRepo.get('lm_studio_url');
      return saved || process.env.EXPO_PUBLIC_LM_STUDIO_URL || 'http://10.0.2.2:1234/v1';
    },
    getModel: async () => {
      const saved = await settingsRepo.get('lm_studio_model');
      return saved || process.env.EXPO_PUBLIC_LM_STUDIO_MODEL || 'local-model';
    },
  });

  // 5. Initialize Services
  const briefCraft = new BriefCraftService(llmEngine);
  const kasunduanVault = new KasunduanVaultService(agreementRepo);
  const scopeGuard = new ScopeGuardService(llmEngine, agreementRepo, scopeGuardRepo);
  const changeDesk = new ChangeDeskService(llmEngine, agreementRepo, scopeGuardRepo, proposalRepo);
  const exportService = new ExportService(projectRepo, agreementRepo, scopeGuardRepo, proposalRepo);

  servicesInstance = {
    repositories: {
      project: projectRepo,
      agreement: agreementRepo,
      scopeGuard: scopeGuardRepo,
      proposal: proposalRepo,
      settings: settingsRepo,
    },
    services: {
      briefCraft,
      kasunduanVault,
      scopeGuard,
      changeDesk,
      export: exportService,
    },
    llmEngine,
  };

  return servicesInstance;
}
