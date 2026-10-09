import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useWorkspace } from '@/features/scope/useWorkspace';
import { useProposal } from '@/features/proposal/useProposal';
import { data, ai } from '@/services/active';
import { setFixtureControls } from '@/services/fixtures/fixtureControls';

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => { jest.requireActual('react').useEffect(effect, [effect]); },
}));

beforeEach(() => setFixtureControls({ unavailable: false, invalid: false, slow: false, saveFailure: false }));

test('workspace exit save failure preserves edited fields and succeeds on retry', async () => {
  const project = await data.createProject('Exit test');
  const hook = await renderHook(() => useWorkspace(project.id));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { hook.result.current.enterManual(); });
  await act(async () => { hook.result.current.updateDraft(d => ({ ...d, deliverables: [{ key: 'one', text: 'Reviewed deliverable' }] })); });
  setFixtureControls({ saveFailure: true });
  let allowed = true;
  await act(async () => { allowed = await hook.result.current.prepareExit(); });
  expect(allowed).toBe(false);
  expect(hook.result.current.draft?.deliverables[0].text).toBe('Reviewed deliverable');
  expect(hook.result.current.dirty).toBe(true);
  setFixtureControls({ saveFailure: false });
  await act(async () => { allowed = await hook.result.current.prepareExit(); });
  expect(allowed).toBe(true);
  expect((await data.getDraft(project.id))?.deliverables[0].text).toBe('Reviewed deliverable');
  await hook.unmount();
});

test('proposal generation locks edits and preserves the existing message on cancellation', async () => {
  const project = await data.createProject('Proposal test');
  const agreement = await data.confirmScope(project.id, { projectId: project.id, sourceText: '', origin: 'manual', deliverables: [{ key: 'd', text: 'Website' }], exclusions: [], terms: { budgetAmount: null, currency: 'PHP', timeline: null, revisionTerms: null }, missingInformation: [], updatedAt: new Date().toISOString() });
  const analysis = await data.saveAnalysis({ projectId: project.id, agreementId: agreement.id, agreementVersion: 1, requestText: 'Add booking', findings: [{ id: 'extra', requestedItem: 'Booking', classification: 'potential_additional', explanation: 'Not recorded', evidenceRequirementIds: [], clarificationQuestions: [] }] });
  const proposal = await data.createProposal(project.id, analysis.id, ['Booking']);
  const hook = await renderHook(() => useProposal(project.id, proposal.id));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  await act(async () => { hook.result.current.update({ message: 'My own message', fee: '7000', days: '5' }); });
  let finish!: (value: string) => void;
  const spy = jest.spyOn(ai, 'draftProposalMessage').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  let running!: Promise<void>;
  await act(async () => { running = hook.result.current.generate(); });
  expect(hook.result.current.operation.busy).toBe(true);
  await act(async () => { hook.result.current.update({ message: 'Late typing' }); });
  expect(hook.result.current.form?.message).toBe('My own message');
  await act(async () => { hook.result.current.operation.cancel(); finish('Late generated output'); await running; });
  expect(hook.result.current.form?.message).toBe('My own message');
  expect(hook.result.current.form?.fee).toBe('7000');
  expect((await data.getProposal(project.id, proposal.id))?.message).toBe('');
  spy.mockRestore();
  await hook.unmount();
});
