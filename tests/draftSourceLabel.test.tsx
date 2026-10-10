import { render, screen } from '@testing-library/react-native';
import { ScopeDraftScreen } from '@/screens/workspace/ScopeDraftScreen';
import type { ScopeDraft } from '@/types/domain';

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

const date = '2026-10-10T00:00:00.000Z';
const project = { id: 'p1', title: 'Café website', clientName: null, description: null, createdAt: date, updatedAt: date };
const base: ScopeDraft = {
  title: project.title,
  requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: null, deadline: null, timelineNotes: null,
  revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified',
};

async function show(draft: ScopeDraft) {
  await render(<ScopeDraftScreen project={project} draft={draft} onBack={jest.fn()} onConfirmScope={jest.fn()} onSaveDraft={jest.fn()} />);
}

test('a draft the model wrote says so', async () => {
  await show({ ...base, sourceConversation: 'Client: five pages', extractedWithAi: true });
  expect(screen.getByText(/Drafted by AI/)).toBeTruthy();
  expect(screen.queryByText(/rule-based/i)).toBeNull();
});

test('a draft from the rule-based fallback is labelled as not AI', async () => {
  await show({ ...base, sourceConversation: 'Client: five pages', extractedWithAi: false });
  expect(screen.getByText(/rule-based fallback/i)).toBeTruthy();
  expect(screen.queryByText(/Drafted by AI/)).toBeNull();
});

test('a draft that did not come from a conversation shows no source label', async () => {
  await show(base);
  expect(screen.queryByText(/Drafted by AI/)).toBeNull();
  expect(screen.queryByText(/rule-based/i)).toBeNull();
});
