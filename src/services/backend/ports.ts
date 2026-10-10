import { KasunduanVaultService as Vault } from '@/services/domain/kasunduanVaultService';
import type { Repositories } from '@/database/repositories';
import type { AgreementRepository } from '@/database/repositories/agreementRepository';
import type { ProjectRepository } from '@/database/repositories/projectRepository';
import type { ProposalRepository } from '@/database/repositories/proposalRepository';
import type { ScopeGuardRepository } from '@/database/repositories/scopeGuardRepository';
import type { SettingsRepository } from '@/database/repositories/settingsRepository';
import type { LLMEngine } from '@/llm/contracts';
import type { AppServices } from '@/services/domain/bootstrapService';
import type { BriefCraftService } from '@/services/domain/briefCraftService';
import type { KasunduanVaultService } from '@/services/domain/kasunduanVaultService';

/** The parts of the backend the screens' adapters call. Tests supply in-memory versions. */
export interface BackendPorts {
  transaction<T>(action: (ports: BackendPorts) => Promise<T>): Promise<T>;
  projects: Pick<ProjectRepository, 'create' | 'list' | 'getById' | 'update'>;
  agreements: Pick<AgreementRepository, 'getById' | 'getLatestByProjectId'>;
  scopeGuard: Pick<ScopeGuardRepository, 'createRequest' | 'getRequestById' | 'createAnalysis' | 'getAnalysisById' | 'listAnalysesByProjectId'>;
  proposals: Pick<ProposalRepository, 'create' | 'getById' | 'listByProjectId' | 'update'>;
  settings: Pick<SettingsRepository, 'get' | 'set'>;
  vault: Pick<KasunduanVaultService, 'confirmScope'>;
  briefCraft: Pick<BriefCraftService, 'extractBrief'>;
  engine: LLMEngine;
}

export function portsFrom(backend: AppServices): BackendPorts {
  function bind(repos: Repositories): BackendPorts {
    return {
      transaction: action => backend.transaction(tx => action(bind(tx))),
      projects: repos.project,
      agreements: repos.agreement,
      scopeGuard: repos.scopeGuard,
      proposals: repos.proposal,
      settings: repos.settings,
      vault: new Vault(repos.agreement),
      briefCraft: backend.services.briefCraft,
      engine: backend.llmEngine,
    };
  }
  return bind(backend.repositories);
}
