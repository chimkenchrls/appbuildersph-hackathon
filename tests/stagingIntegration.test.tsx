import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { initializeBackendAsync, type AppServices } from '@/services/domain/bootstrapService';
import { useMobileWorkspace } from '@/hooks/useMobileWorkspace';
import { ScopeDraftScreen } from '@/screens/workspace/ScopeDraftScreen';
import { ProposalEditorScreen } from '@/screens/workspace/ProposalEditorScreen';
import { ProjectOverviewScreen } from '@/screens/workspace/ProjectOverviewScreen';
import { LLMEngineUnavailableError } from '@/llm/contracts';
import type { ScopeDraft } from '@/types/domain';
import { AgreementSchema } from '@/safety/persistedSchemas';
import { ServiceError } from '@/services/errors';
import { hapticSuccess } from '@/utils/haptics';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  useNavigation: () => ({ dispatch: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/services/domain/bootstrapService', () => ({ initializeBackendAsync: jest.fn() }));
jest.mock('@/components/workspace/Icon', () => ({ AppIcon: () => null }));
jest.mock('@/utils/haptics', () => ({ hapticSuccess: jest.fn(), hapticImpactLight: jest.fn() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/services/domain/shareService', () => ({ ShareService: {} }));

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

test('an extracted draft confirms its terms while retaining provenance only in the draft', async () => {
  mockParams = { view: 'draft', projectId: project.id };
  const fake = backend();
  const extracted = { ...draft, sourceConversation: 'Build a website', extractedWithAi: true };
  fake.repositories.project.list.mockResolvedValue([Object.assign({}, project, { draftScopeJson: JSON.stringify(extracted) })]);
  fake.repositories.agreement.createInitial.mockImplementation(async input => AgreementSchema.parse(input));
  const hook = await renderHook(useMobileWorkspace);
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.draft).toEqual(extracted);
  await act(async () => { await hook.result.current.confirm(hook.result.current.draft!); });
  expect(fake.repositories.project.update).toHaveBeenCalledWith(project.id, { draftScopeJson: JSON.stringify(extracted) });
  expect(fake.repositories.agreement.createInitial).toHaveBeenCalledWith(expect.objectContaining({
    projectId: project.id, requirements: extracted.requirements, taxTreatment: 'none_specified', versionNumber: 1,
  }));
  const agreement = fake.repositories.agreement.createInitial.mock.calls[0][0];
  expect(agreement).not.toHaveProperty('sourceConversation');
  expect(agreement).not.toHaveProperty('extractedWithAi');
  expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ view: 'overview' }) }));
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

test('failed scope acceptance keeps proposal edits and reports the save failure', async () => {
  const accept = jest.fn(async () => { throw new ServiceError('save_failed'); });
  await render(<ProposalEditorScreen project={project} onBack={jest.fn()} onAcceptProposal={accept}
    proposal={{ id: 'prop1', projectId: project.id, analysisId: 'a1', selectedItems: ['Booking'],
      freelancerFeeEstimate: 7000.5, freelancerDaysEstimate: 5, currency: 'PHP', draftMessage: 'My reviewed text',
      status: 'draft', createdAt: date, updatedAt: date }} />);
  await fireEvent.press(screen.getByLabelText('Accept scope change and seal new agreement'));
  expect(accept).toHaveBeenCalledWith(['Booking'], 7000.5, 5);
  expect(screen.getByText(/Could not save. Your changes are still here/)).toBeTruthy();
  expect(screen.getByDisplayValue('My reviewed text')).toBeTruthy();
  expect(hapticSuccess).not.toHaveBeenCalled();
});

test('existing exclusion conflicts require review and failed correction stays visible', async () => {
  const repair = jest.fn(async () => { throw new ServiceError('save_failed'); });
  const agreement = { ...draft, id: 'v3', projectId: project.id, versionNumber: 3, confirmedAt: date,
    requirements: [...draft.requirements, { id: 'REQ-02', title: 'add online ordering', description: '', category: 'deliverable' as const }],
    exclusions: ['online ordering', 'hosting fees'] };
  await render(<ProjectOverviewScreen currentProject={project} allProjects={[project]} agreements={[agreement]}
    selectedAgreement={agreement} onBack={jest.fn()} onSelectProject={jest.fn()} onSelectAgreementVersion={jest.fn()}
    onNavigateToNewRequest={jest.fn()} onResolveExclusionConflicts={repair} />);
  expect(screen.getByText(/same work as both included and excluded/)).toBeTruthy();
  expect(repair).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Review conflicting exclusions'));
  expect(screen.getByText('Confirm correction as Agreement v4')).toBeTruthy();
  expect(repair).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Cancel exclusion correction'));
  expect(repair).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Review conflicting exclusions'));
  await fireEvent.press(screen.getByLabelText('Confirm exclusion correction'));
  expect(repair).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Could not save. Your changes are still here/)).toBeTruthy();
  expect(screen.getByLabelText('Confirm exclusion correction')).toBeTruthy();
  expect(hapticSuccess).not.toHaveBeenCalled();
});

test('v5 with no exclusions never restores the original draft exclusions in overview or contract preview', async () => {
  const originalDraft = { ...draft, exclusions: ['online ordering', 'payments', 'hosting fees'] };
  const savedProject = { ...project, draftScopeJson: JSON.stringify(originalDraft) };
  const fourth = { ...draft, id: 'v4', projectId: project.id, versionNumber: 4, confirmedAt: date,
    requirements: [...draft.requirements,
      { id: 'REQ-03', title: 'add online ordering', description: '', category: 'deliverable' as const },
      { id: 'REQ-04', title: 'payments', description: '', category: 'deliverable' as const }],
    exclusions: ['hosting fees'] };
  const fifth = { ...fourth, id: 'v5', versionNumber: 5, exclusions: [],
    requirements: [...fourth.requirements,
      { id: 'REQ-05', title: 'hosting fees', description: 'Added in Agreement v5', category: 'deliverable' as const }] };
  const props = { currentProject: savedProject, allProjects: [savedProject], onBack: jest.fn(),
    onSelectProject: jest.fn(), onSelectAgreementVersion: jest.fn(), onNavigateToNewRequest: jest.fn() };
  const view = await render(<ProjectOverviewScreen {...props} agreements={[fourth]} selectedAgreement={fourth} />);
  expect(screen.getAllByText(/^EXC-/)).toHaveLength(1);
  expect(screen.getByText('hosting fees')).toBeTruthy();
  await view.rerender(<ProjectOverviewScreen {...props} agreements={[fifth, fourth]} selectedAgreement={fifth} />);
  expect(screen.queryAllByText(/^EXC-/)).toHaveLength(0);
  expect(screen.queryByText('online ordering')).toBeNull();
  expect(screen.getAllByText('payments')).toHaveLength(1);
  expect(screen.getAllByText('hosting fees')).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText('View Legal Contract'));
  expect(screen.queryByText('SCOPEGUARD™ EXCLUSIONS')).toBeNull();
  // Selecting an earlier immutable version still shows its own exclusions.
  await view.rerender(<ProjectOverviewScreen {...props} agreements={[fifth, fourth]} selectedAgreement={fourth} />);
  expect(screen.getByText('SCOPEGUARD™ EXCLUSIONS')).toBeTruthy();
});

test('unconfirmed projects still show their draft exclusions', async () => {
  const savedProject = { ...project, draftScopeJson: JSON.stringify({ ...draft, exclusions: ['hosting fees'] }) };
  await render(<ProjectOverviewScreen currentProject={savedProject} allProjects={[savedProject]} agreements={[]}
    selectedAgreement={null} onBack={jest.fn()} onSelectProject={jest.fn()} onSelectAgreementVersion={jest.fn()}
    onNavigateToNewRequest={jest.fn()} />);
  expect(screen.getByText('EXC-01')).toBeTruthy();
  expect(screen.getByText('hosting fees')).toBeTruthy();
});
