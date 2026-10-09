import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { initializeBackendAsync, type AppServices } from '@/services/bootstrapService';
import { useMobileWorkspace } from '@/hooks/useMobileWorkspace';
import { ScopeDraftScreen } from '@/screens/ScopeDraftScreen';
import { ProposalEditorScreen } from '@/screens/ProposalEditorScreen';
import { LLMEngineUnavailableError } from '@/llm/contracts';
import type { ScopeDraft } from '@/types/domain';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  useNavigation: () => ({ dispatch: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/services/bootstrapService', () => ({ initializeBackendAsync: jest.fn() }));
jest.mock('@/components/Icon', () => ({ AppIcon: () => null }));
jest.mock('@/utils/haptics', () => ({ hapticSuccess: jest.fn(), hapticImpactLight: jest.fn() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));

const date = '2026-10-09T00:00:00.000Z';
const project = { id: 'p1', title: 'Actual project', clientName: null, description: null, createdAt: date, updatedAt: date };
const draft: ScopeDraft = { title: project.title, requirements: [{ id: 'R1', title: 'Actual deliverable', description: '', category: 'deliverable' }],
  budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: null, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: ['Confirm the date'], taxTreatment: 'none_specified' };

function backend() {
  const repositories = {
    project: { list: jest.fn(async () => [project]), create: jest.fn(async input => ({ ...project, ...input })), update: jest.fn(async () => project) },
    agreement: { listByProjectId: jest.fn(async () => []), createInitial: jest.fn() },
    settings: { get: jest.fn(async () => null), set: jest.fn() },
    scopeGuard: { getAnalysisById: jest.fn(async () => null) },
    proposal: { getById: jest.fn(async () => null), create: jest.fn(), update: jest.fn() },
  };
  const services = { briefCraft: { extractBrief: jest.fn(async () => { throw new LLMEngineUnavailableError(); }) } };
  jest.mocked(initializeBackendAsync).mockResolvedValue({ repositories, services,
    transaction: async (action: (repos: typeof repositories) => unknown) => action(repositories),
  } as unknown as AppServices);
  return { repositories, services };
}

beforeEach(() => { jest.clearAllMocks(); mockParams = {}; });

test('AI failure cannot save an invented draft or advance navigation', async () => {
  const fake = backend();
  const hook = await renderHook(useMobileWorkspace);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await expect(hook.result.current.createDraft({ projectName: 'Real', projectField: '', conversation: 'Build a contact form' })).rejects.toMatchObject({ code: 'model_unavailable' });
  expect(fake.repositories.project.create).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});

test('manual creation persists an unspecified scope and uses Expo Router without calling AI', async () => {
  const fake = backend();
  const hook = await renderHook(useMobileWorkspace);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { await hook.result.current.createDraft({ projectName: 'Offline', projectField: '', conversation: '' }, true); });
  expect(fake.services.briefCraft.extractBrief).not.toHaveBeenCalled();
  const input = fake.repositories.project.create.mock.calls[0][0];
  expect(JSON.parse(input.draftScopeJson)).toMatchObject({ requirements: [], budgetAmount: null, durationDays: null, revisionTerms: null, taxTreatment: 'none_specified' });
  expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/', params: expect.objectContaining({ view: 'draft', projectId: input.id }) }));
});

test('a proposal from another project cannot be loaded by changing route identifiers', async () => {
  mockParams = { view: 'proposal', projectId: 'p1', proposalId: 'foreign' };
  const fake = backend();
  fake.repositories.proposal.getById.mockResolvedValue({ id: 'foreign', projectId: 'p2', analysisId: 'a2' } as never);
  const hook = await renderHook(useMobileWorkspace);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toMatch(/unavailable in this project/);
  expect(hook.result.current.proposal).toBeNull();
});

test('the new scope screen keeps absent terms unspecified and failed confirmation visible', async () => {
  const confirm = jest.fn(async (_draft: ScopeDraft) => { throw new Error('Database unavailable'); });
  await render(<ScopeDraftScreen project={project} draft={draft} onBack={jest.fn()} onConfirmScope={confirm} onSaveDraft={jest.fn()} />);
  expect(screen.getAllByText('To be agreed').length).toBeGreaterThanOrEqual(3);
  expect(screen.queryByText('₱15,000')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Release and confirm scope'));
  await waitFor(() => expect(confirm).toHaveBeenCalled());
  expect(confirm.mock.calls[0][0]).toMatchObject({ budgetAmount: null, durationDays: null, revisionTerms: null,
    missingInformation: ['Agreed budget is not specified.', 'Delivery deadline or timeline is not specified.', 'Revision allowance is not specified.'] });
  expect(screen.getByText(/Your edits are still here/)).toBeTruthy();
});

test('proposal save failure is never presented as saved locally', async () => {
  const save = jest.fn(async () => { throw new Error('Disk full'); });
  await render(<ProposalEditorScreen project={project} onBack={jest.fn()} onSaveProposal={save} proposal={{ id: 'prop1', projectId: project.id,
    analysisId: 'a1', selectedItems: ['Booking'], freelancerFeeEstimate: null, freelancerDaysEstimate: null, currency: 'PHP',
    draftMessage: 'My reviewed text', status: 'draft', createdAt: date, updatedAt: date }} />);
  await fireEvent.press(screen.getByLabelText('Save draft'));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(screen.getByText(/Your edits are still here/)).toBeTruthy();
  expect(screen.queryByText('Draft saved locally.')).toBeNull();
});
