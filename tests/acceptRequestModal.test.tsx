import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProjectOverviewScreen } from '@/screens/workspace/ProjectOverviewScreen';
import type { Agreement, ChangeProposal, ClientRequest, ScopeGuardAnalysis } from '@/types/domain';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  useNavigation: () => ({ dispatch: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/components/workspace/Icon', () => ({ AppIcon: () => null }));
jest.mock('@/utils/haptics', () => ({ hapticSuccess: jest.fn(), hapticImpactLight: jest.fn() }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }));
jest.mock('@/services/domain/shareService', () => ({ ShareService: {} }));

const date = '2026-10-10T00:00:00.000Z';
const project = { id: 'p1', title: 'Cafe site', clientName: 'Rina', description: null, createdAt: date, updatedAt: date };
const agreement: Agreement = { id: 'a1', projectId: 'p1', versionNumber: 1, title: 'Cafe site',
  requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified', confirmedAt: date };
const request = (rawText: string): ClientRequest => ({ id: 'rq1', projectId: 'p1', agreementId: 'a1', rawText, createdAt: date, status: 'stored' });
const analysis: ScopeGuardAnalysis = { id: 'an1', requestId: 'rq1', agreementId: 'a1', classification: 'potential_additional', summary: 's',
  findings: [{ item: 'Customer accounts', classification: 'potential_additional', explanation: 'x', evidenceRequirementIds: [] }],
  clarificationQuestions: [], createdAt: date };
const proposal = (fee: number | null, days: number | null): ChangeProposal => ({ id: 'pr1', projectId: 'p1', analysisId: 'an1',
  selectedItems: ['Customer accounts'], freelancerFeeEstimate: fee, freelancerDaysEstimate: days, currency: 'PHP', draftMessage: 'm',
  status: 'draft', createdAt: date, updatedAt: date });

async function open(rawText: string, extra: { analyses?: Record<string, ScopeGuardAnalysis>; proposals?: Record<string, ChangeProposal>; onAccept?: jest.Mock } = {}) {
  const onAcceptRequest = extra.onAccept ?? jest.fn(async () => undefined);
  await render(<ProjectOverviewScreen currentProject={project} allProjects={[project]} agreements={[agreement]} selectedAgreement={agreement}
    requests={[request(rawText)]} analyses={extra.analyses} proposals={extra.proposals} onBack={jest.fn()} onSelectProject={jest.fn()}
    onSelectAgreementVersion={jest.fn()} onNavigateToNewRequest={jest.fn()} onAcceptRequest={onAcceptRequest} />);
  await fireEvent.press(screen.getByLabelText('Accept request and update scope'));
  return { onAcceptRequest };
}

const confirmButton = () => screen.getByText(/Confirm & Seal Agreement v2/);

test('the fee and days start empty, and client approval is not pre-recorded', async () => {
  await open('Add online ordering');
  expect(screen.getByPlaceholderText('e.g. 7000').props.value).toBe('');
  expect(screen.getByPlaceholderText('e.g. 5').props.value).toBe('');
  expect(screen.queryByText('Client Signatory Name')).toBeNull();
});

test('a saved proposal supplies the estimates the freelancer already entered', async () => {
  await open('Add customer accounts', { analyses: { rq1: analysis }, proposals: { an1: proposal(7000.5, 5) } });
  expect(screen.getByPlaceholderText('e.g. 7000').props.value).toBe('7000.5');
  expect(screen.getByPlaceholderText('e.g. 5').props.value).toBe('5');
});

test('a short request becomes the deliverable as written, without a trailing ellipsis', async () => {
  await open('Add online ordering');
  expect(screen.getByText('Add online ordering')).toBeTruthy();
  expect(screen.queryByText(/Add online ordering\.\.\./)).toBeNull();
});

test('an amount with a thousands comma is refused with a message, not read as a different number', async () => {
  const { onAcceptRequest } = await open('Add online ordering');
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. 7000'), '7,000.50');
  await fireEvent.press(confirmButton());
  expect(onAcceptRequest).not.toHaveBeenCalled();
  expect(screen.getByText(/Enter the fee as a number/)).toBeTruthy();
});

test('a valid fee and whole days are passed through unchanged, and blank means unset', async () => {
  const { onAcceptRequest } = await open('Add online ordering');
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. 7000'), '7000.50');
  await fireEvent.changeText(screen.getByPlaceholderText('e.g. 5'), '5');
  await fireEvent.press(confirmButton());
  await waitFor(() => expect(onAcceptRequest).toHaveBeenCalledTimes(1));
  const call = onAcceptRequest.mock.calls[0];
  expect([call[2], call[3], call[4], call[5]]).toEqual([7000.5, 5, null, null]);
});

test('a refused acceptance explains why and keeps the form open', async () => {
  const onAccept = jest.fn(async () => { throw new Error('This request was already accepted.'); });
  await open('Add online ordering', { onAccept });
  await fireEvent.press(confirmButton());
  await waitFor(() => expect(screen.getByText('This request was already accepted.')).toBeTruthy());
  expect(confirmButton()).toBeTruthy();
});
