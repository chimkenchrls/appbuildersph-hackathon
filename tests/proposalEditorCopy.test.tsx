import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { ProposalEditorScreen } from '@/screens/ProposalEditorScreen';
import type { Agreement, ChangeProposal } from '@/types/domain';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  useNavigation: () => ({ dispatch: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/components/Icon', () => ({ AppIcon: () => null }));
jest.mock('@/utils/haptics', () => ({ hapticSuccess: jest.fn(), hapticImpactLight: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const date = '2026-10-10T00:00:00.000Z';
const project = { id: 'p1', title: 'Cafe site', clientName: null, description: null, createdAt: date, updatedAt: date };
const agreement: Agreement = { id: 'a1', projectId: 'p1', versionNumber: 1, title: 'Cafe site',
  requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified', confirmedAt: date };
const proposal: ChangeProposal = { id: 'pr1', projectId: 'p1', analysisId: 'an1', selectedItems: ['Customer accounts'],
  freelancerFeeEstimate: null, freelancerDaysEstimate: null, currency: 'PHP', draftMessage: 'Hello', status: 'draft', createdAt: date, updatedAt: date };

test('a copy that worked is not reported as failed when saving its status fails', async () => {
  const onSaveProposal = jest.fn(async () => { throw new Error('disk full'); });
  await render(<ProposalEditorScreen project={project} agreement={agreement} proposal={proposal} availableItems={['Customer accounts']}
    onBack={jest.fn()} onSaveProposal={onSaveProposal} onAcceptProposal={jest.fn()} />);
  await fireEvent.press(screen.getByText('Copy message'));
  await waitFor(() => expect(onSaveProposal).toHaveBeenCalled());
  expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Hello');
  await waitFor(() => expect(screen.getByText(/Copied, but/)).toBeTruthy());
  expect(screen.queryByText('Unable to copy to clipboard.')).toBeNull();
});
