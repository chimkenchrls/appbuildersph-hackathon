import { act, render, waitFor } from '@testing-library/react-native';
import { NewRequestScreen } from '@/screens/NewRequestScreen';
import { ScopeGuardService } from '@/services/scopeGuardService';
import { HomeScreen } from '@/screens/HomeScreen';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { ProjectOverviewScreen } from '@/screens/ProjectOverviewScreen';
import { initializeBackendAsync, type AppServices } from '@/services/bootstrapService';
import { AgreementSchema } from '@/safety/persistedSchemas';
import type { Agreement } from '@/types/domain';

jest.mock('@/services/bootstrapService', () => ({ initializeBackendAsync: jest.fn() }));
jest.mock('@/database/client', () => ({ getDatabaseAsync: jest.fn() }));
jest.mock('@/components/SlideTransition', () => ({ SlideTransition: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/BottomNavBar', () => ({ BottomNavBar: () => null }));
jest.mock('@/screens/ProjectsScreen', () => ({ ProjectsScreen: jest.fn(() => null) }));
jest.mock('@/screens/ProjectOverviewScreen', () => ({ ProjectOverviewScreen: jest.fn(() => null) }));
jest.mock('@/screens/NewProjectScreen', () => ({ NewProjectScreen: () => null }));
jest.mock('@/screens/ScopeDraftScreen', () => ({ ScopeDraftScreen: () => null }));
jest.mock('@/screens/NewRequestScreen', () => ({ NewRequestScreen: jest.fn(() => null) }));
jest.mock('@/screens/ScopeReviewScreen', () => ({ ScopeReviewScreen: () => null }));
jest.mock('@/screens/ProposalEditorScreen', () => ({ ProposalEditorScreen: () => null }));
jest.mock('@/screens/AgreementsScreen', () => ({ AgreementsScreen: () => null }));
jest.mock('@/screens/SettingsScreen', () => ({ SettingsScreen: () => null }));
jest.mock('@/screens/OnboardingScreen', () => ({ OnboardingScreen: () => null }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const date = '2026-10-10T00:00:00.000Z';
const project = { id: 'p1', title: 'Café website', clientName: null, description: null, createdAt: date, updatedAt: date };
const initial: Agreement = { id: 'v1', projectId: project.id, versionNumber: 1, title: project.title,
  requirements: [{ id: 'REQ-01', title: 'One-page website', description: '', category: 'deliverable' }],
  budgetAmount: 18000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified', confirmedAt: date };
const request = { id: 'r1', projectId: project.id, agreementId: initial.id, rawText: 'Add ordering', createdAt: date };

function backend(currentAgreement = initial) {
  let agreements = [currentAgreement];
  let requests = [request];
  const repositories = {
    project: { cleanupDuplicates: jest.fn(), list: jest.fn(async () => [project]) },
    agreement: {
      getById: jest.fn(async () => agreements[0]), listByProjectId: jest.fn(async () => agreements), getLatestByProjectId: jest.fn(async () => agreements[0]),
      createRevision: jest.fn(async (input: Agreement) => {
        const checked = AgreementSchema.parse(input);
        agreements = [checked, ...agreements];
        return checked;
      }),
    },
    scopeGuard: { createRequest: jest.fn(async (input: typeof request) => { requests = [input, ...requests]; return input; }),
      listRequestsByProjectId: jest.fn(async () => requests), listAnalysesByProjectId: jest.fn(async () => []),
      getRequestById: jest.fn(async () => request), updateRequestStatus: jest.fn(async () => {}) },
    proposal: { listByProjectId: jest.fn(async () => []) },
    settings: { get: jest.fn(async (key: string) => key === 'onboarding_completed' ? 'true' : null) },
  };
  const transaction = jest.fn(async (action: (repos: typeof repositories) => Promise<unknown>) => action(repositories));
  const engine = { generate: jest.fn(async () => { throw new Error('AI unavailable'); }) };
  const scopeGuard = new ScopeGuardService(engine as unknown as ConstructorParameters<typeof ScopeGuardService>[0],
    repositories.agreement as unknown as ConstructorParameters<typeof ScopeGuardService>[1],
    repositories.scopeGuard as unknown as ConstructorParameters<typeof ScopeGuardService>[2]);
  jest.mocked(initializeBackendAsync).mockResolvedValue({ repositories, transaction, services: { scopeGuard } } as unknown as AppServices);
  return { repositories, transaction, engine };
}

beforeEach(() => jest.clearAllMocks());

async function openOverview() {
  await render(<HomeScreen />);
  await waitFor(() => expect(ProjectsScreen).toHaveBeenCalled());
  await act(async () => { jest.mocked(ProjectsScreen).mock.calls.at(-1)![0].onSelectProject(project.id); });
  return jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
}

test('opening the workspace preserves separate projects with the same title', async () => {
  const fake = backend();
  const sameTitle = { ...project, id: 'p2' };
  let savedProjects = [project, sameTitle];
  fake.repositories.project.list.mockImplementation(async () => savedProjects);
  fake.repositories.project.cleanupDuplicates.mockImplementation(async () => {
    savedProjects = [project];
  });
  await render(<HomeScreen />);
  await waitFor(() => expect(ProjectsScreen).toHaveBeenCalled());
  expect(jest.mocked(ProjectsScreen).mock.calls.at(-1)![0].projects.map(row => row.id)).toEqual(['p1', 'p2']);
});

test('native acceptance commits the request with v2 and selects the new version', async () => {
  const fake = backend();
  const overview = await openOverview();
  expect(overview.selectedAgreement?.versionNumber).toBe(1);
  await act(async () => { await overview.onAcceptRequest!(request, ['Online ordering'], 7000, 5); });
  expect(fake.transaction).toHaveBeenCalledTimes(1);
  expect(fake.repositories.scopeGuard.updateRequestStatus).toHaveBeenCalledWith(request.id, 'accepted', expect.any(String));
  const updated = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
  expect(updated.selectedAgreement).toMatchObject({ versionNumber: 2, budgetAmount: 25000, durationDays: 19 });
  expect(updated.agreements.map(a => a.versionNumber)).toEqual([2, 1]);
});

test('native acceptance propagates save failures and keeps v1 selected', async () => {
  const fake = backend();
  fake.repositories.agreement.createRevision.mockRejectedValueOnce(new Error('Disk full'));
  const overview = await openOverview();
  await expect(overview.onAcceptRequest!(request, ['Online ordering'], 7000, 5)).rejects.toMatchObject({ code: 'save_failed' });
  expect(fake.repositories.scopeGuard.updateRequestStatus).not.toHaveBeenCalled();
  expect(jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0].selectedAgreement).toEqual(initial);
});

test('native exclusion correction selects the corrected version and preserves the old scope', async () => {
  const oldScope = { ...initial, versionNumber: 3, requirements: [...initial.requirements,
    { id: 'REQ-02', title: 'add online ordering', description: '', category: 'deliverable' as const },
    { id: 'REQ-03', title: 'payments', description: '', category: 'deliverable' as const }],
    exclusions: ['online ordering', 'payments', 'hosting fees'] };
  backend(oldScope);
  const overview = await openOverview();
  await act(async () => { await overview.onResolveExclusionConflicts!(); });
  const updated = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
  expect(updated.selectedAgreement).toMatchObject({ versionNumber: 4, exclusions: ['hosting fees'], requirements: oldScope.requirements });
  expect(updated.agreements[1]).toEqual(oldScope);
});

async function openNewRequest() {
  const overview = await openOverview();
  await act(async () => { overview.onNavigateToNewRequest(); });
  return jest.mocked(NewRequestScreen).mock.calls.at(-1)![0];
}

test('saving a native request persists and displays it without AI, including after relaunch', async () => {
  const fake = backend();
  const screen = await openNewRequest();
  await act(async () => { await screen.onSaveRequest!('  Add a photo gallery  '); });
  expect(fake.engine.generate).not.toHaveBeenCalled();
  const saved = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0].requests![0];
  expect(saved).toMatchObject({ projectId: project.id, agreementId: initial.id, rawText: 'Add a photo gallery', status: 'stored' });
  expect(fake.repositories.scopeGuard.createRequest).toHaveBeenCalledWith(saved);
  const reopened = await openOverview();
  expect(reopened.requests).toContainEqual(saved);
  expect(reopened.selectedAgreement).toEqual(initial);
});

test('failed native request saves reject and keep the request screen open', async () => {
  const fake = backend();
  fake.repositories.scopeGuard.createRequest.mockRejectedValueOnce(new Error('Disk full'));
  const screen = await openNewRequest();
  const previousOverviewCalls = jest.mocked(ProjectOverviewScreen).mock.calls.length;
  await act(async () => { await expect(screen.onSaveRequest!('Add booking')).rejects.toThrow('Could not save'); });
  expect(jest.mocked(ProjectOverviewScreen).mock.calls).toHaveLength(previousOverviewCalls);
  expect(fake.engine.generate).not.toHaveBeenCalled();
});
