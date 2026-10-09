import type { SQLiteDatabase } from 'expo-sqlite';
import { ProjectRepository } from './projectRepository';
import { AgreementRepository } from './agreementRepository';
import { ScopeGuardRepository } from './scopeGuardRepository';
import { ProposalRepository } from './proposalRepository';
import { SettingsRepository } from './settingsRepository';

export function repositories(db: SQLiteDatabase, inTransaction = false) {
  return {
    project: new ProjectRepository(db),
    agreement: new AgreementRepository(db, inTransaction),
    scopeGuard: new ScopeGuardRepository(db, inTransaction),
    proposal: new ProposalRepository(db),
    settings: new SettingsRepository(db),
  };
}
export type Repositories = ReturnType<typeof repositories>;
