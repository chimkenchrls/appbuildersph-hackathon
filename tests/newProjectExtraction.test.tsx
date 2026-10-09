import { act, render, waitFor } from '@testing-library/react-native';
import { HomeScreen } from '@/screens/HomeScreen';
import { NewProjectScreen } from '@/screens/NewProjectScreen';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { initializeBackendAsync, type AppServices } from '@/services/bootstrapService';
import { LLMContextOverflowError, LLMGenerationTimeoutError, LLMParseError } from '@/llm/contracts';
import type { ScopeDraft } from '@/types/domain';

jest.mock('@/services/bootstrapService', () => ({ initializeBackendAsync: jest.fn() }));
jest.mock('@/database/client', () => ({ getDatabaseAsync: jest.fn() }));
jest.mock('@/components/SlideTransition', () => ({ SlideTransition: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/BottomNavBar', () => ({ BottomNavBar: () => null }));
jest.mock('@/screens/ProjectsScreen', () => ({ ProjectsScreen: jest.fn(() => null) }));
jest.mock('@/screens/NewProjectScreen', () => ({ NewProjectScreen: jest.fn(() => null) }));
jest.mock('@/screens/ProjectOverviewScreen', () => ({ ProjectOverviewScreen: () => null }));
jest.mock('@/screens/ScopeDraftScreen', () => ({ ScopeDraftScreen: () => null }));
jest.mock('@/screens/NewRequestScreen', () => ({ NewRequestScreen: () => null }));
jest.mock('@/screens/ScopeReviewScreen', () => ({ ScopeReviewScreen: () => null }));
jest.mock('@/screens/ProposalEditorScreen', () => ({ ProposalEditorScreen: () => null }));
jest.mock('@/screens/AgreementsScreen', () => ({ AgreementsScreen: () => null }));
jest.mock('@/screens/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('@/screens/OnboardingScreen', () => ({ OnboardingScreen: () => null }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const date = '2026-10-10T00:00:00.000Z';
const aiDraft: ScopeDraft = {
  title: 'x', requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified',
  sourceConversation: 'chat', extractedWithAi: true,
};

function setup(extractBrief: jest.Mock) {
  const extractBriefHeuristic = jest.fn();
  const repositories = {
    project: {
      list: jest.fn(async () => []),
      create: jest.fn(async (input: { id: string; title: string; draftScopeJson?: string | null }) => ({ ...input, clientName: null, description: null, createdAt: date, updatedAt: date })),
      update: jest.fn(),
    },
    agreement: { listByProjectId: jest.fn(async () => []) },
    scopeGuard: { listRequestsByProjectId: jest.fn(async () => []), listAnalysesByProjectId: jest.fn(async () => []) },
    proposal: { listByProjectId: jest.fn(async () => []) },
    settings: { get: jest.fn(async (key: string) => (key === 'onboarding_completed' ? 'true' : null)) },
  };
  jest.mocked(initializeBackendAsync).mockResolvedValue({
    repositories,
    transaction: jest.fn(),
    services: { briefCraft: { extractBrief, extractBriefHeuristic } },
  } as unknown as AppServices);
  return { repositories, extractBriefHeuristic };
}

async function createDraftHandler() {
  await render(<HomeScreen />);
  await waitFor(() => expect(ProjectsScreen).toHaveBeenCalled());
  await act(async () => { jest.mocked(ProjectsScreen).mock.calls.at(-1)![0].onNewProject(); });
  await waitFor(() => expect(NewProjectScreen).toHaveBeenCalled());
  return jest.mocked(NewProjectScreen).mock.calls.at(-1)![0].onCreateScopeDraft;
}

const input = { projectName: 'Cafe site', projectField: 'Web', conversation: 'Client wants five pages for PHP 15,000.' };

beforeEach(() => jest.clearAllMocks());

test.each([
  ['an input too long for the model', new LLMContextOverflowError(5000, 2048), /too long for the on-device model/],
  ['a generation timeout', new LLMGenerationTimeoutError('timed out'), /took too long/],
  ['an answer that cannot be verified', new LLMParseError('bad json', '{}'), /could not be verified/],
])('%s is shown to the user and no rule-based draft or project is saved', async (_name, failure, message) => {
  const { repositories, extractBriefHeuristic } = setup(jest.fn(async () => { throw failure; }));
  const create = await createDraftHandler();

  await expect(create(input)).rejects.toThrow(message);
  expect(extractBriefHeuristic).not.toHaveBeenCalled();
  expect(repositories.project.create).not.toHaveBeenCalled();
});

test('a model-written draft is saved with its source flag', async () => {
  const { repositories, extractBriefHeuristic } = setup(jest.fn(async () => ({ ...aiDraft })));
  const create = await createDraftHandler();

  await act(async () => { await create(input); });
  expect(extractBriefHeuristic).not.toHaveBeenCalled();
  expect(repositories.project.create).toHaveBeenCalledTimes(1);
  const saved = JSON.parse(repositories.project.create.mock.calls[0][0].draftScopeJson as string);
  expect(saved).toMatchObject({ extractedWithAi: true, sourceConversation: input.conversation });
});
