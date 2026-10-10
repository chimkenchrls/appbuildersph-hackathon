import { fireEvent, render, screen } from '@testing-library/react-native';
import { NewRequestScreen } from '@/screens/NewRequestScreen';
import type { Agreement } from '@/types/domain';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => void) => jest.requireActual('react').useEffect(effect, [effect]),
  useNavigation: () => ({ dispatch: jest.fn() }),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/components/Icon', () => ({ AppIcon: () => null }));
jest.mock('@/utils/haptics', () => ({ hapticSuccess: jest.fn(), hapticImpactLight: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(), requestMediaLibraryPermissionsAsync: jest.fn() }));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => '') }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const date = '2026-10-10T00:00:00.000Z';
const project = { id: 'p1', title: 'Cafe site', clientName: null, description: null, createdAt: date, updatedAt: date };
const agreement: Agreement = { id: 'a1', projectId: 'p1', versionNumber: 1, title: 'Cafe site',
  requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 14, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified', confirmedAt: date };

async function show() {
  const onAnalyze = jest.fn(async () => undefined);
  const onSaveRequest = jest.fn(async () => undefined);
  await render(<NewRequestScreen project={project} agreement={agreement} onBack={jest.fn()} onAnalyze={onAnalyze}
    onSaveRequest={onSaveRequest} onViewConfirmedScope={jest.fn()} />);
  const input = screen.getByPlaceholderText('Paste message from client or attach files...');
  return { onAnalyze, onSaveRequest, input };
}

test.each([
  ['analyze', 'Analyze request and prepare proposal', 'onAnalyze'],
  ['save', 'Save request to project', 'onSaveRequest'],
] as const)('a request over the limit is refused on %s with the limit named', async (_name, label, handler) => {
  const mocks = await show();
  await fireEvent.changeText(mocks.input, 'x'.repeat(8001));
  await fireEvent.press(screen.getByLabelText(label));
  expect(mocks[handler]).not.toHaveBeenCalled();
  expect(screen.getByText(/too long.*8,000/i)).toBeTruthy();
});

test.each([
  ['analyze', 'Analyze request and prepare proposal', 'onAnalyze'],
  ['save', 'Save request to project', 'onSaveRequest'],
] as const)('a request that is only an attachment tag is refused on %s', async (_name, label, handler) => {
  const mocks = await show();
  await fireEvent.changeText(mocks.input, '[Attached document: brief.pdf]');
  await fireEvent.press(screen.getByLabelText(label));
  expect(mocks[handler]).not.toHaveBeenCalled();
  expect(screen.getByText(/Attached files cannot be read yet/)).toBeTruthy();
});

test('a normal request is passed through trimmed', async () => {
  const mocks = await show();
  await fireEvent.changeText(mocks.input, '  Add online ordering  ');
  await fireEvent.press(screen.getByLabelText('Analyze request and prepare proposal'));
  expect(mocks.onAnalyze).toHaveBeenCalledWith('Add online ordering');
});
