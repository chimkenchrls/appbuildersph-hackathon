import { act, render, waitFor } from '@testing-library/react-native';
import { NewRequestScreen } from '@/screens/NewRequestScreen';
import { ProposalEditorScreen } from '@/screens/ProposalEditorScreen';
import { ChangeDeskService } from '@/services/changeDeskService';
import { ScopeReviewScreen } from '@/screens/ScopeReviewScreen';
import { errorMessage, ServiceError } from '@/services/errors';
import { ScopeGuardService } from '@/services/scopeGuardService';
import { HomeScreen } from '@/screens/HomeScreen';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { ProjectOverviewScreen } from '@/screens/ProjectOverviewScreen';
import { initializeBackendAsync, type AppServices } from '@/services/bootstrapService';
import { AgreementSchema } from '@/safety/persistedSchemas';
import type { Agreement, ClientRequest, ScopeGuardAnalysis, ChangeProposal } from '@/types/domain';

jest.mock('@/services/bootstrapService', () => ({ initializeBackendAsync: jest.fn() }));
jest.mock('@/database/client', () => ({ getDatabaseAsync: jest.fn() }));
jest.mock('@/components/SlideTransition', () => ({ SlideTransition: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/BottomNavBar', () => ({ BottomNavBar: () => null }));
jest.mock('@/screens/ProjectsScreen', () => ({ ProjectsScreen: jest.fn(() => null) }));
jest.mock('@/screens/ProjectOverviewScreen', () => ({ ProjectOverviewScreen: jest.fn(() => null) }));
jest.mock('@/screens/NewProjectScreen', () => ({ NewProjectScreen: () => null }));
jest.mock('@/screens/ScopeDraftScreen', () => ({ ScopeDraftScreen: () => null }));
jest.mock('@/screens/NewRequestScreen', () => ({ NewRequestScreen: jest.fn(() => null) }));
jest.mock('@/screens/ScopeReviewScreen', () => ({ ScopeReviewScreen: jest.fn(() => null) }));
jest.mock('@/screens/ProposalEditorScreen', () => ({ ProposalEditorScreen: jest.fn(() => null) }));
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
  let requests: ClientRequest[] = [request];
  const analyses: ScopeGuardAnalysis[] = [];
  const proposals: ChangeProposal[] = [];
  const repositories = {
    project: { cleanupDuplicates: jest.fn(), list: jest.fn(async () => [project]) },
    agreement: {
      getById: jest.fn(async (id: string) => agreements.find(a => a.id === id) ?? null), listByProjectId: jest.fn(async () => agreements), getLatestByProjectId: jest.fn(async () => agreements[0]),
      createRevision: jest.fn(async (input: Agreement) => {
        const checked = AgreementSchema.parse(input);
        agreements = [checked, ...agreements];
        return checked;
      }),
    },
    scopeGuard: { createRequest: jest.fn(async (input: typeof request) => { requests = [input, ...requests]; return input; }),
      listRequestsByProjectId: jest.fn(async () => requests), listAnalysesByProjectId: jest.fn(async () => analyses),
      createRequestWithAnalysis: jest.fn(async (req: ClientRequest, analysis: ScopeGuardAnalysis) => {
        requests = [req, ...requests]; analyses.push(analysis); return analysis;
      }),
      createAnalysis: jest.fn(async (analysis: ScopeGuardAnalysis) => { analyses.push(analysis); return analysis; }),
      getAnalysisById: jest.fn(async (id: string) => analyses.find(a => a.id === id) ?? null),
      getAnalysisByRequestId: jest.fn(async (requestId: string) => analyses.find(a => a.requestId === requestId) ?? null),
      getRequestById: jest.fn(async (id: string) => requests.find(r => r.id === id) ?? null),
      updateRequestStatus: jest.fn(async (id: string, status: 'accepted', acceptedAt: string) => {
        requests = requests.map(r => r.id === id ? { ...r, status, acceptedAt } : r);
      }) },
    proposal: { listByProjectId: jest.fn(async () => proposals),
      create: jest.fn(async (proposal: ChangeProposal) => { proposals.push(proposal); return proposal; }) },
    settings: { get: jest.fn(async (key: string) => key === 'onboarding_completed' ? 'true' : null) },
  };
  const transaction = jest.fn(async (action: (repos: typeof repositories) => Promise<unknown>) => action(repositories));
  const engine = { generate: jest.fn(async (): Promise<string> => { throw new Error('AI unavailable'); }) };
  const scopeGuard = new ScopeGuardService(engine as unknown as ConstructorParameters<typeof ScopeGuardService>[0],
    repositories.agreement as unknown as ConstructorParameters<typeof ScopeGuardService>[1],
    repositories.scopeGuard as unknown as ConstructorParameters<typeof ScopeGuardService>[2]);
  const changeDesk = new ChangeDeskService(engine as unknown as ConstructorParameters<typeof ChangeDeskService>[0],
    repositories.agreement as unknown as ConstructorParameters<typeof ChangeDeskService>[1],
    repositories.scopeGuard as unknown as ConstructorParameters<typeof ChangeDeskService>[2],
    repositories.proposal as unknown as ConstructorParameters<typeof ChangeDeskService>[3]);
  jest.mocked(initializeBackendAsync).mockResolvedValue({ repositories, transaction, services: { scopeGuard, changeDesk } } as unknown as AppServices);
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


test('a failed new analysis stays on the request screen instead of opening a stale proposal', async () => {
  backend();
  const screen = await openNewRequest();
  const previousReviewCalls = jest.mocked(ScopeReviewScreen).mock.calls.length;
  await act(async () => { await expect(screen.onAnalyze('Add online payments')).rejects.toThrow('AI unavailable'); });
  expect(jest.mocked(ScopeReviewScreen).mock.calls).toHaveLength(previousReviewCalls);
});

test('agreement conflicts show recovery guidance without claiming a backup was imported', () => {
  const message = errorMessage(new ServiceError('conflict'));
  expect(message).toMatch(/latest agreement/i);
  expect(message).not.toMatch(/backup|import/i);
});


test('proposal acceptance progresses v1 to v2 to v3 and never reuses an accepted request after failed analysis', async () => {
  const fake = backend();
  await openOverview();
  for (const [index, item] of ['Online ordering', 'Online payments'].entries()) {
    const overview = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
    await act(async () => { overview.onNavigateToNewRequest(); });
    const requestScreen = jest.mocked(NewRequestScreen).mock.calls.at(-1)![0];
    const reviewCalls = jest.mocked(ScopeReviewScreen).mock.calls.length;
    // The next request must not inherit the previous accepted analysis on failure.
    await act(async () => { await expect(requestScreen.onAnalyze(item)).rejects.toThrow('AI unavailable'); });
    expect(jest.mocked(ScopeReviewScreen).mock.calls).toHaveLength(reviewCalls);
    fake.engine.generate.mockResolvedValueOnce(JSON.stringify({
      overall_classification: 'potential_additional', summary: 'New deliverable',
      findings: [{ item, classification: 'potential_additional', explanation: 'Additional work', evidence_requirement_ids: [] }],
      clarification_questions: [],
    })).mockResolvedValueOnce(JSON.stringify({ draft_message: `We can add ${item}.` }));
    await act(async () => { await requestScreen.onAnalyze(item); });
    const review = jest.mocked(ScopeReviewScreen).mock.calls.at(-1)![0];
    await act(async () => { review.onProceedToProposal(); });
    const proposalScreen = jest.mocked(ProposalEditorScreen).mock.calls.at(-1)![0];
    expect(proposalScreen.availableItems).toEqual([item]);
    await act(async () => { await proposalScreen.onAcceptProposal!([item], 7000, 5); });
    const updated = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
    expect(updated.selectedAgreement?.versionNumber).toBe(index + 2);
    expect(updated.requests?.find(r => r.id === review.analysis.requestId)?.status).toBe('accepted');
  }
  const last = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
  expect(last.agreements.map(a => a.versionNumber)).toEqual([3, 2, 1]);
  expect(last.selectedAgreement?.requirements.map(r => r.title)).toEqual(['One-page website', 'Online ordering', 'Online payments']);
});


test('reviewing a saved unanalyzed request creates its own proposal and accepts that same request as v3', async () => {
  const fake = backend();
  const overview = await openOverview();
  await act(async () => { await overview.onAcceptRequest!(request, ['Online ordering'], 7000, 5); });
  const current = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
  await act(async () => { current.onNavigateToNewRequest(); });
  await act(async () => { await jest.mocked(NewRequestScreen).mock.calls.at(-1)![0].onSaveRequest!('Add online payments'); });
  const savedOverview = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
  const saved = savedOverview.requests![0];
  fake.engine.generate.mockResolvedValueOnce(JSON.stringify({ overall_classification: 'potential_additional', summary: 'New work',
    findings: [{ item: 'Online payments', classification: 'potential_additional', explanation: 'New work', evidence_requirement_ids: [] }], clarification_questions: []
  })).mockResolvedValueOnce(JSON.stringify({ draft_message: 'We can add online payments.' }));
  await act(async () => { await savedOverview.onReviewRequest!(saved); });
  const review = jest.mocked(ScopeReviewScreen).mock.calls.at(-1)![0];
  expect(review.analysis.requestId).toBe(saved.id);
  await act(async () => { review.onProceedToProposal(); });
  await act(async () => { await jest.mocked(ProposalEditorScreen).mock.calls.at(-1)![0].onAcceptProposal!(['Online payments'], 1250.5, 2); });
  const final = jest.mocked(ProjectOverviewScreen).mock.calls.at(-1)![0];
  expect(final.selectedAgreement?.versionNumber).toBe(3);
  expect(final.requests?.find(r => r.id === saved.id)?.status).toBe('accepted');
  expect(final.requests).toHaveLength(2);
});
