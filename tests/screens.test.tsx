import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DashboardScreen from '@/screens/DashboardScreen';
import WorkspaceScreen from '@/screens/WorkspaceScreen';
import ProposalScreen from '@/screens/ProposalScreen';
import ScopeGuardScreen from '@/screens/ScopeGuardScreen';
import MissingRecordScreen from '@/screens/MissingRecordScreen';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { data } from '@/services/active';
import { setFixtureControls } from '@/services/fixtures/fixtureControls';
import { sampleRequest, sampleScope } from '@/services/fixtures/scenario';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useFocusEffect: (effect: () => void) => { jest.requireActual('react').useEffect(effect, [effect]); },
  useNavigation: () => ({ dispatch: jest.fn() }),
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('@react-native-vector-icons/lucide', () => ({ Lucide: () => null }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

beforeEach(() => {
  jest.clearAllMocks();
  setFixtureControls({ unavailable: false, invalid: false, slow: false, saveFailure: false });
});

// The prepared AI fixture answers after about 1.6 s.
const aiWait = { timeout: 6000 };

async function confirmedProject(name: string) {
  const project = await data.createProject(name);
  const agreement = await data.confirmScope(project.id, {
    projectId: project.id, sourceText: '', origin: 'manual',
    deliverables: sampleScope.deliverables.map((text, index) => ({ key: `d${index}`, text })),
    exclusions: sampleScope.exclusions.map((text, index) => ({ key: `e${index}`, text })),
    terms: sampleScope.terms, missingInformation: [], updatedAt: new Date().toISOString(),
  });
  return { project, agreement };
}

async function draftProposal(name: string) {
  const { project, agreement } = await confirmedProject(name);
  const analysis = await data.saveAnalysis({
    projectId: project.id, agreementId: agreement.id, agreementVersion: agreement.version, requestText: 'Add booking',
    findings: [{ id: 'extra', requestedItem: 'Appointment booking', classification: 'potential_additional', explanation: 'Not recorded.', evidenceRequirementIds: [], clarificationQuestions: [] }],
  });
  const proposal = await data.createProposal(project.id, analysis.id, ['Appointment booking']);
  return { project, agreement, proposal };
}

test('dashboard discloses fixture resets and can create a project', async () => {
  await render(<DashboardScreen />);
  expect(await screen.findByText('Projects')).toBeTruthy();
  expect(screen.getByText(/resets when the app restarts/i)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'New project' }));
  await fireEvent.changeText(screen.getByLabelText('Project name'), 'My review project');
  await fireEvent.press(screen.getByRole('button', { name: 'Create project' }));
  await waitFor(async () => expect((await data.listProjects()).some(p => p.name === 'My review project')).toBe(true));
});

test('manual scope remains usable without AI and confirmation creates a fixed snapshot', async () => {
  const p = await data.createProject('Manual screen test');
  setFixtureControls({ unavailable: true });
  await render(<WorkspaceScreen projectId={p.id} />);
  await screen.findByText('Manual screen test');
  await fireEvent.press(screen.getByRole('button', { name: 'Enter scope manually' }));
  await fireEvent.changeText(screen.getByLabelText('Deliverable 1'), 'A reviewed contact form');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm scope' }));
  expect(screen.getByText(/does not record client approval/i)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm Agreement v1' }));
  await screen.findByText('A reviewed contact form');
  await waitFor(async () => expect((await data.getAgreement(p.id))?.requirements[0].text).toBe('A reviewed contact form'));
  expect(screen.queryByLabelText('Deliverable 1')).toBeNull();
});

test('a proposal belonging to another project reveals no proposal content', async () => {
  const wrong = await data.createProject('Other project route');
  await render(<ProposalScreen projectId={wrong.id} proposalId="missing-proposal" />);
  expect(await screen.findByText('Record unavailable')).toBeTruthy();
  expect(screen.queryByLabelText('Message')).toBeNull();
});

test('the seeded example is labeled as demo data inside a project', async () => {
  await render(<WorkspaceScreen projectId="demo-website" />);
  await screen.findByText('Studio North website');
  expect(screen.getByText('Demo data')).toBeTruthy();
  expect(screen.getByText('Draft')).toBeTruthy();
});

test('a request cannot be analyzed before a scope is confirmed', async () => {
  const project = await data.createProject('Unconfirmed request test');
  await render(<ScopeGuardScreen projectId={project.id} />);
  expect(await screen.findByText('No confirmed agreement yet')).toBeTruthy();
  expect(screen.queryByLabelText('New client request')).toBeNull();
});

test('analysis shows one finding per item with resolving evidence, and proposes only selected extras', async () => {
  const { project } = await confirmedProject('Analysis screen test');
  await render(<ScopeGuardScreen projectId={project.id} />);
  await fireEvent.changeText(await screen.findByLabelText('New client request'), sampleRequest);
  await fireEvent.press(screen.getByRole('button', { name: 'Analyze request' }));

  expect(await screen.findByText('Included in recorded scope', {}, aiWait)).toBeTruthy();
  expect(screen.getByText('Potential additional work')).toBeTruthy();
  expect(screen.getByText('Needs clarification')).toBeTruthy();
  expect(screen.getByText(/Not found in the recorded scope/)).toBeTruthy();
  // Only potential additional work can be proposed.
  expect(screen.getAllByRole('checkbox')).toHaveLength(1);

  // Evidence resolves to the clause stored in Agreement v1.
  expect(screen.queryByText('Contact form')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Evidence R2 · Agreement v1' }));
  expect(screen.getByText('Contact form')).toBeTruthy();

  expect(screen.getByRole('button', { name: 'Start proposal (0 selected)' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Include in proposal' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Start proposal (1 selected)' }));
  await waitFor(async () => expect(await data.listProposals(project.id)).toHaveLength(1));
  const [proposal] = await data.listProposals(project.id);
  expect(proposal).toMatchObject({ deliverables: ['Customer accounts and appointment booking'], feeAmount: null, extraWorkingDays: null, status: 'draft' });
  await waitFor(() => expect(router.push).toHaveBeenCalledWith({ pathname: '/project/[projectId]/proposal/[proposalId]', params: { projectId: project.id, proposalId: proposal.id } }));
}, 15000);

test('an invalid AI result shows no findings and saves nothing', async () => {
  const { project } = await confirmedProject('Invalid output screen test');
  setFixtureControls({ invalid: true });
  await render(<ScopeGuardScreen projectId={project.id} />);
  await fireEvent.changeText(await screen.findByLabelText('New client request'), sampleRequest);
  await fireEvent.press(screen.getByRole('button', { name: 'Analyze request' }));
  expect(await screen.findByText(/could not be verified against your agreement/i, {}, aiWait)).toBeTruthy();
  expect(screen.queryByText('Potential additional work')).toBeNull();
  expect(await data.listAnalyses(project.id)).toHaveLength(0);
  // The request text is kept for a retry.
  expect(screen.getByLabelText('New client request').props.value).toBe(sampleRequest);
}, 15000);

test('a proposal saves blank estimates as unspecified, copies the visible text, and leaves the agreement unchanged', async () => {
  const { project, agreement, proposal } = await draftProposal('Proposal screen test');
  await render(<ProposalScreen projectId={project.id} proposalId={proposal.id} />);
  await fireEvent.changeText(await screen.findByLabelText('Proposed fee (PHP)'), '7000');
  await fireEvent.changeText(screen.getByLabelText('Message'), 'Here is my proposal.');
  await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(async () => expect((await data.getProposal(project.id, proposal.id))?.message).toBe('Here is my proposal.'));
  expect(await data.getProposal(project.id, proposal.id)).toMatchObject({ feeAmount: 7000, extraWorkingDays: null, status: 'draft' });

  await fireEvent.press(screen.getByRole('button', { name: 'Copy text' }));
  expect(await screen.findByText('Copied. Not sent.')).toBeTruthy();
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Here is my proposal.');
  expect(await data.getAgreement(project.id)).toEqual(agreement);
});

test('an invalid estimate is explained and blocks saving', async () => {
  const { project, proposal } = await draftProposal('Invalid estimate screen test');
  await render(<ProposalScreen projectId={project.id} proposalId={proposal.id} />);
  await fireEvent.changeText(await screen.findByLabelText('Proposed fee (PHP)'), '-5');
  expect(screen.getByText(/Enter a non-negative amount/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
});

test('without local AI the message can still be written and saved by hand', async () => {
  const { project, proposal } = await draftProposal('No model proposal test');
  setFixtureControls({ unavailable: true });
  await render(<ProposalScreen projectId={project.id} proposalId={proposal.id} />);
  expect(await screen.findByRole('button', { name: 'Generate message' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Message'), 'Written by hand.');
  await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(async () => expect((await data.getProposal(project.id, proposal.id))?.message).toBe('Written by hand.'));
});

test('an invalid link shows no record and returns to the project list', async () => {
  await render(<MissingRecordScreen />);
  expect(screen.getByText('Record unavailable')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to projects' }));
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('a failed save keeps the proposal edits and can be retried without retyping', async () => {
  const { project, proposal } = await draftProposal('Save failure screen test');
  await render(<ProposalScreen projectId={project.id} proposalId={proposal.id} />);
  await fireEvent.changeText(await screen.findByLabelText('Message'), 'Kept through a failed save.');
  setFixtureControls({ saveFailure: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
  expect(await screen.findByText(/Could not save/)).toBeTruthy();
  expect(screen.getByText('Unsaved changes')).toBeTruthy();
  expect(screen.getByLabelText('Message').props.value).toBe('Kept through a failed save.');
  expect((await data.getProposal(project.id, proposal.id))?.message).toBe('');

  setFixtureControls({ saveFailure: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(async () => expect((await data.getProposal(project.id, proposal.id))?.message).toBe('Kept through a failed save.'));
  await waitFor(() => expect(screen.queryByText('Unsaved changes')).toBeNull());
});

test('a failed extraction keeps the pasted text and leaves one manual-entry action', async () => {
  const project = await data.createProject('Extraction failure screen test');
  setFixtureControls({ invalid: true });
  await render(<WorkspaceScreen projectId={project.id} />);
  await fireEvent.changeText(await screen.findByLabelText('Client conversation'), 'Client: five pages please.');
  await fireEvent.press(screen.getByRole('button', { name: 'Extract scope' }));
  expect(await screen.findByText(/could not be verified/i, {}, aiWait)).toBeTruthy();
  expect(screen.getByLabelText('Client conversation').props.value).toBe('Client: five pages please.');
  expect(screen.getAllByRole('button', { name: 'Enter scope manually' })).toHaveLength(1);
  expect(await data.getDraft(project.id)).toBeNull();
}, 15000);
