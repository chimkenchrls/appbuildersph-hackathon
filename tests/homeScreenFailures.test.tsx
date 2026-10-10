import { Alert } from 'react-native';
import { act, render, waitFor } from '@testing-library/react-native';
import { BottomNavBar } from '@/components/workspace/BottomNavBar';
import { HomeScreen } from '@/screens/workspace/HomeScreen';
import { ProjectsScreen } from '@/screens/workspace/ProjectsScreen';
import { ProjectOverviewScreen } from '@/screens/workspace/ProjectOverviewScreen';
import { ScopeDraftScreen } from '@/screens/workspace/ScopeDraftScreen';
import { NewRequestScreen } from '@/screens/workspace/NewRequestScreen';
import { NewProjectScreen } from '@/screens/workspace/NewProjectScreen';
import { SettingsScreen } from '@/screens/workspace/SettingsScreen';
import { ScopeReviewScreen } from '@/screens/workspace/ScopeReviewScreen';
import { ProposalEditorScreen } from '@/screens/workspace/ProposalEditorScreen';
import { initializeBackendAsync, type AppServices } from '@/services/domain/bootstrapService';
import { seedDemoDataAsync } from '@/database/seed';
import type { Agreement, ChangeProposal, ScopeGuardAnalysis } from '@/types/domain';

jest.mock('@/services/domain/bootstrapService', () => ({ initializeBackendAsync: jest.fn() }));
jest.mock('@/database/client', () => ({ getDatabaseAsync: jest.fn(async () => ({})) }));
jest.mock('@/database/seed', () => ({ seedDemoDataAsync: jest.fn() }));
jest.mock('@/components/workspace/SlideTransition', () => ({ SlideTransition: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/workspace/BottomNavBar', () => ({ BottomNavBar: jest.fn(() => null) }));
jest.mock('@/screens/workspace/ProjectsScreen', () => ({ ProjectsScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/ProjectOverviewScreen', () => ({ ProjectOverviewScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/ScopeDraftScreen', () => ({ ScopeDraftScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/NewRequestScreen', () => ({ NewRequestScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/NewProjectScreen', () => ({ NewProjectScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/SettingsScreen', () => ({ SettingsScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/ScopeReviewScreen', () => ({ ScopeReviewScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/ProposalEditorScreen', () => ({ ProposalEditorScreen: jest.fn(() => null) }));
jest.mock('@/screens/workspace/AgreementsScreen', () => ({ AgreementsScreen: () => null }));
jest.mock('@/screens/workspace/OnboardingScreen', () => ({ OnboardingScreen: () => null }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const date = '2026-10-10T00:00:00.000Z';
const draftJson = JSON.stringify({
  title: 'Cafe site', requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: null, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified',
});
const project = { id: 'p1', title: 'Cafe site', clientName: null, description: null, draftScopeJson: draftJson, createdAt: date, updatedAt: date };
const agreement: Agreement = { id: 'a1', projectId: 'p1', versionNumber: 1, title: 'Cafe site',
  requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified', confirmedAt: date };

const analysisWithAddition: ScopeGuardAnalysis = { id: 'an1', requestId: 'rq1', agreementId: 'a1', classification: 'potential_additional',
  summary: 's', findings: [{ item: 'Customer accounts', classification: 'potential_additional', explanation: 'x', evidenceRequirementIds: [] }],
  clarificationQuestions: [], createdAt: date };

interface Options { projects?: Array<typeof project>; agreements?: Agreement[]; confirmScope?: jest.Mock; analyzeRequest?: jest.Mock; draftProposal?: jest.Mock;
  existingProposals?: ChangeProposal[]; deleteProject?: jest.Mock; savedProposal?: ChangeProposal; updateProposal?: jest.Mock }

function setup(options: Options = {}) {
  const confirmScope = options.confirmScope ?? jest.fn(async () => agreement);
  const analyzeRequest = options.analyzeRequest ?? jest.fn(async () => analysisWithAddition);
  const draftProposal = options.draftProposal ?? jest.fn(async (input: { analysisId: string }) => ({
    id: 'pr1', projectId: 'p1', analysisId: input.analysisId, selectedItems: ['Customer accounts'], freelancerFeeEstimate: null,
    freelancerDaysEstimate: null, currency: 'PHP', draftMessage: 'm', status: 'draft', createdAt: date, updatedAt: date }));
  const repositories = {
    project: { list: jest.fn(async () => options.projects ?? [project]), update: jest.fn(async () => project), create: jest.fn(),
      delete: options.deleteProject ?? jest.fn(async () => true) },
    agreement: { listByProjectId: jest.fn(async () => options.agreements ?? [agreement]), getById: jest.fn(async () => agreement) },
    scopeGuard: { listRequestsByProjectId: jest.fn(async () => []), listAnalysesByProjectId: jest.fn(async () => []),
      getRequestById: jest.fn(async () => null) },
    proposal: { listByProjectId: jest.fn(async () => options.existingProposals ?? []),
      getById: jest.fn(async () => options.savedProposal ?? null),
      update: options.updateProposal ?? jest.fn(async (_id: string, changes: object) => ({ ...(options.savedProposal as object), ...changes })),
      create: jest.fn(async (p: ChangeProposal) => p) },
    settings: { get: jest.fn(async (key: string) => (key === 'onboarding_completed' ? 'true' : null)), set: jest.fn() },
  };
  jest.mocked(initializeBackendAsync).mockResolvedValue({
    repositories, transaction: jest.fn(),
    services: {
      briefCraft: { extractBrief: jest.fn(), extractBriefHeuristic: jest.fn() },
      kasunduanVault: { confirmScope, recordClientApproval: jest.fn() },
      scopeGuard: { analyzeRequest, saveRequest: jest.fn(), deleteRequest: jest.fn() },
      changeDesk: { draftProposal },
    },
  } as unknown as AppServices);
  return { repositories, confirmScope, analyzeRequest, draftProposal };
}

const last = <T,>(mock: jest.Mock | jest.MockedFunction<never>) => (mock as jest.Mock).mock.calls.at(-1)![0] as T;

async function openOverview() {
  await render(<HomeScreen />);
  await waitFor(() => expect(ProjectsScreen).toHaveBeenCalled());
  await act(async () => { last<{ onSelectProject: (id: string) => void }>(ProjectsScreen as never).onSelectProject('p1'); });
  await waitFor(() => expect(ProjectOverviewScreen).toHaveBeenCalled());
}

beforeEach(() => jest.clearAllMocks());

test('a failed confirmation is reported on the draft screen and does not open the overview', async () => {
  const failure = new Error('Database is locked');
  setup({ agreements: [], confirmScope: jest.fn(async () => { throw failure; }) });
  await openOverview();
  await act(async () => { last<{ onEditScopeDraft: () => void }>(ProjectOverviewScreen as never).onEditScopeDraft(); });
  await waitFor(() => expect(ScopeDraftScreen).toHaveBeenCalled());
  const overviewCalls = jest.mocked(ProjectOverviewScreen).mock.calls.length;

  const confirm = last<{ onConfirmScope: (d: unknown) => Promise<void> }>(ScopeDraftScreen as never).onConfirmScope;
  await expect(confirm(JSON.parse(draftJson))).rejects.toThrow();
  // Still on the draft screen: the overview was not rendered again.
  expect(jest.mocked(ProjectOverviewScreen).mock.calls.length).toBe(overviewCalls);
});

test('analysing a request leaves the proposal fee and days unset, not zero', async () => {
  const { draftProposal } = setup();
  await openOverview();
  await act(async () => { last<{ onNavigateToNewRequest: () => void }>(ProjectOverviewScreen as never).onNavigateToNewRequest(); });
  await waitFor(() => expect(NewRequestScreen).toHaveBeenCalled());
  await act(async () => { await last<{ onAnalyze: (t: string) => Promise<void> }>(NewRequestScreen as never).onAnalyze('Add customer accounts'); });

  expect(draftProposal).toHaveBeenCalledTimes(1);
  expect(draftProposal.mock.calls[0][0]).toMatchObject({ freelancerFeeEstimate: null, freelancerDaysEstimate: null });
});

test('a failed project delete is reported instead of ignored', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  setup({ deleteProject: jest.fn(async () => { throw new Error('locked'); }) });
  await openOverview();
  await act(async () => { await last<{ onDeleteProject: (id: string) => Promise<void> }>(ProjectOverviewScreen as never).onDeleteProject('p1'); });
  expect(alert).toHaveBeenCalledWith('Could not delete the project', expect.stringMatching(/save|try again/i));
  alert.mockRestore();
});

test('the settings reset cannot wipe confirmed work', async () => {
  setup();
  await render(<HomeScreen />);
  await waitFor(() => expect(BottomNavBar).toHaveBeenCalled());
  await act(async () => { last<{ onSelectTab: (tab: string) => void }>(BottomNavBar as never).onSelectTab('settings'); });
  await waitFor(() => expect(SettingsScreen).toHaveBeenCalled());
  const { onDataReset } = last<{ onDataReset: () => Promise<void> }>(SettingsScreen as never);

  await expect(onDataReset()).rejects.toThrow(/turned off/i);
  expect(seedDemoDataAsync).not.toHaveBeenCalled();
});

test('an over-long conversation and an attachment-only submission are refused before the model runs', async () => {
  setup();
  await render(<HomeScreen />);
  await waitFor(() => expect(ProjectsScreen).toHaveBeenCalled());
  await act(async () => { last<{ onNewProject: () => void }>(ProjectsScreen as never).onNewProject(); });
  await waitFor(() => expect(NewProjectScreen).toHaveBeenCalled());
  const create = last<{ onCreateScopeDraft: (d: { projectName: string; projectField: string; conversation: string }) => Promise<void> }>(NewProjectScreen as never).onCreateScopeDraft;

  await expect(create({ projectName: 'Big', projectField: 'Web', conversation: 'x'.repeat(15001) })).rejects.toThrow(/too long|15,000/i);
  await expect(create({ projectName: 'Files', projectField: 'Web', conversation: '[Attached document: brief.pdf]' })).rejects.toThrow(/paste|text/i);
});

async function reachReview() {
  await openOverview();
  await act(async () => { last<{ onNavigateToNewRequest: () => void }>(ProjectOverviewScreen as never).onNavigateToNewRequest(); });
  await waitFor(() => expect(NewRequestScreen).toHaveBeenCalled());
  await act(async () => { await last<{ onAnalyze: (t: string) => Promise<void> }>(NewRequestScreen as never).onAnalyze('Add customer accounts'); });
  await waitFor(() => expect(ScopeReviewScreen).toHaveBeenCalled());
}

test('a failed proposal save is reported to the editor and nothing is shown as saved', async () => {
  const saved: ChangeProposal = { id: 'pr1', projectId: 'p1', analysisId: 'an1', selectedItems: ['Customer accounts'], freelancerFeeEstimate: null,
    freelancerDaysEstimate: null, currency: 'PHP', draftMessage: 'm', status: 'draft', createdAt: date, updatedAt: date };
  setup({ savedProposal: saved, updateProposal: jest.fn(async () => { throw new Error('disk full'); }) });
  await reachReview();
  await act(async () => { last<{ onProceedToProposal: () => void }>(ScopeReviewScreen as never).onProceedToProposal(); });
  await waitFor(() => expect(ProposalEditorScreen).toHaveBeenCalled());
  const { onSaveProposal } = last<{ onSaveProposal: (p: ChangeProposal) => Promise<void> }>(ProposalEditorScreen as never);
  await expect(onSaveProposal({ ...saved, draftMessage: 'edited' })).rejects.toThrow();
});

test('the freelancer\'s selected deliverables are what gets saved', async () => {
  const saved: ChangeProposal = { id: 'pr1', projectId: 'p1', analysisId: 'an1', selectedItems: ['A', 'B'], freelancerFeeEstimate: null,
    freelancerDaysEstimate: null, currency: 'PHP', draftMessage: 'm', status: 'draft', createdAt: date, updatedAt: date };
  const update = jest.fn(async (_id: string, changes: object) => ({ ...saved, ...changes }));
  setup({ savedProposal: saved, updateProposal: update });
  await reachReview();
  await act(async () => { last<{ onProceedToProposal: () => void }>(ScopeReviewScreen as never).onProceedToProposal(); });
  await waitFor(() => expect(ProposalEditorScreen).toHaveBeenCalled());
  const { onSaveProposal } = last<{ onSaveProposal: (p: ChangeProposal) => Promise<void> }>(ProposalEditorScreen as never);
  await act(async () => { await onSaveProposal({ ...saved, selectedItems: ['A'] }); });
  expect(update.mock.calls[0][1]).toMatchObject({ selectedItems: ['A'] });
});

test('there is no proposal screen for a request with no additional work', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const onlyIncluded = { ...analysisWithAddition, classification: 'included' as const,
    findings: [{ item: 'Contact form', classification: 'included' as const, explanation: 'x', evidenceRequirementIds: ['REQ-01'] }] };
  setup({ analyzeRequest: jest.fn(async () => onlyIncluded) });
  await reachReview();
  await act(async () => { last<{ onProceedToProposal: () => void }>(ScopeReviewScreen as never).onProceedToProposal(); });
  expect(alert).toHaveBeenCalledWith('No additional work to propose', expect.any(String));
  expect(ProposalEditorScreen).not.toHaveBeenCalled();
  alert.mockRestore();
});

test('opening a project without a saved draft does not show the previous project\'s draft', async () => {
  const other = { ...project, id: 'p2', title: 'Other site', draftScopeJson: null as unknown as string };
  setup({ projects: [project, other], agreements: [] });
  await render(<HomeScreen />);
  await waitFor(() => expect(ProjectsScreen).toHaveBeenCalled());
  const select = last<{ onSelectProject: (id: string) => void }>(ProjectsScreen as never).onSelectProject;
  await act(async () => { select('p1'); });
  await waitFor(() => expect(ProjectOverviewScreen).toHaveBeenCalled());
  await act(async () => { last<{ onBack: () => void }>(ProjectOverviewScreen as never).onBack(); });
  await act(async () => { select('p2'); });
  await act(async () => { last<{ onEditScopeDraft: () => void }>(ProjectOverviewScreen as never).onEditScopeDraft(); });
  await waitFor(() => expect(ScopeDraftScreen).toHaveBeenCalled());
  const shown = last<{ draft: { requirements: unknown[] } }>(ScopeDraftScreen as never).draft;
  expect(shown.requirements).toEqual([]);
});
