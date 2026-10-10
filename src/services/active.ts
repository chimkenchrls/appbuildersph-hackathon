import { createBackendAi } from './backend/backendAi';
import { createBackendData } from './backend/backendData';
import { portsFrom, type BackendPorts } from './backend/ports';
import type { SaklawAi, SaklawData } from './contracts';
import { createFixtureAi } from './fixtures/fixtureAi';
import { createFixtureData } from './fixtures/fixtureData';
import { createWorkflows } from './workflows';

// The screens run on the backend's SQLite repositories and AI engine. Tests, and a run
// started with EXPO_PUBLIC_SAKLAW_FIXTURES=1, use the labeled in-memory fixtures instead.
const useFixtures = process.env.NODE_ENV === 'test' || process.env.EXPO_PUBLIC_SAKLAW_FIXTURES === '1';

let backend: Promise<BackendPorts> | null = null;
/** Opens the database, runs migrations and builds the services on first use. */
function getBackend(): Promise<BackendPorts> {
  // Imported on demand so a fixture run never loads SQLite.
  backend ??= import('./domain/bootstrapService')
    .then(async module => portsFrom(await module.initializeBackendAsync()))
    .catch(error => {
      // Let the next call retry instead of caching the failure.
      backend = null;
      throw error;
    });
  return backend;
}

export const data: SaklawData = useFixtures ? createFixtureData() : createBackendData(getBackend);
export const ai: SaklawAi = useFixtures ? createFixtureAi() : createBackendAi(getBackend);
export const workflows = createWorkflows(data, ai);
export const isFixtureData = useFixtures;
export const isFixtureAi = useFixtures;
