import { createFixtureAi } from './fixtures/fixtureAi';
import { createFixtureData } from './fixtures/fixtureData';
import { createWorkflows } from './workflows';

export const data = createFixtureData();
export const ai = createFixtureAi();
export const workflows = createWorkflows(data, ai);
export const isFixtureData = true;
export const isFixtureAi = true;
