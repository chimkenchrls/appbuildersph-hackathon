import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ScopeDraftScreen } from '@/screens/workspace/ScopeDraftScreen';
import { ServiceError } from '@/services/errors';
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
const project = { id: 'p1', title: 'Cafe site', clientName: null, description: null, createdAt: date, updatedAt: date };
const draft: ScopeDraft = {
  title: 'Cafe site',
  requirements: [{ id: 'REQ-01', title: 'Five pages', description: '', category: 'deliverable' }],
  budgetAmount: 15000, budgetCurrency: 'PHP', budgetNotes: null, durationDays: 30, deadline: null,
  timelineNotes: '30 days turnaround.', revisionTerms: '2 rounds of revisions included.', exclusions: [],
  missingInformation: [], taxTreatment: 'none_specified',
};

async function confirmWith(edit: () => Promise<void>) {
  const onConfirmScope = jest.fn(async (_d: ScopeDraft) => undefined);
  await render(<ScopeDraftScreen project={project} draft={draft} onBack={jest.fn()} onConfirmScope={onConfirmScope} onSaveDraft={jest.fn()} />);
  await edit();
  await fireEvent.press(screen.getByLabelText('Release and confirm scope'));
  await waitFor(() => expect(onConfirmScope).toHaveBeenCalled());
  return onConfirmScope.mock.calls[0][0];
}

test('a new timeline in words replaces the old day count', async () => {
  const saved = await confirmWith(async () => {
    await fireEvent.press(screen.getByLabelText('Edit timeline'));
    await fireEvent.changeText(screen.getByDisplayValue('30 days turnaround.'), 'Two weeks');
    await fireEvent.press(screen.getByText('Save Timeline'));
  });
  expect(saved.timelineNotes).toBe('Two weeks');
  expect(saved.durationDays).toBe(14);
});

test('a timeline with no readable length does not keep the old day count', async () => {
  const saved = await confirmWith(async () => {
    await fireEvent.press(screen.getByLabelText('Edit timeline'));
    await fireEvent.changeText(screen.getByDisplayValue('30 days turnaround.'), 'End of November');
    await fireEvent.press(screen.getByText('Save Timeline'));
  });
  expect(saved.timelineNotes).toBe('End of November');
  expect(saved.durationDays).toBeNull();
  expect(saved.missingInformation).not.toContain('Delivery deadline or timeline is not specified.');
});

test('the timeline can be cleared', async () => {
  const saved = await confirmWith(async () => {
    await fireEvent.press(screen.getByLabelText('Edit timeline'));
    await fireEvent.changeText(screen.getByDisplayValue('30 days turnaround.'), '   ');
    await fireEvent.press(screen.getByText('Save Timeline'));
  });
  expect(saved.timelineNotes).toBeNull();
  expect(saved.durationDays).toBeNull();
  expect(saved.missingInformation).toContain('Delivery deadline or timeline is not specified.');
});

test('the revision terms can be cleared', async () => {
  const saved = await confirmWith(async () => {
    await fireEvent.press(screen.getByLabelText('Edit revisions'));
    await fireEvent.changeText(screen.getByDisplayValue('2 rounds of revisions included.'), '');
    await fireEvent.press(screen.getByText('Save Revisions'));
  });
  expect(saved.revisionTerms).toBeNull();
});

test('a failed confirmation shows the specific reason, not a generic message', async () => {
  const onConfirmScope = jest.fn(async () => { throw new ServiceError('save_failed'); });
  await render(<ScopeDraftScreen project={project} draft={draft} onBack={jest.fn()} onConfirmScope={onConfirmScope} onSaveDraft={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Release and confirm scope'));
  await waitFor(() => expect(screen.getByText(/Could not save\. Your changes are still here\. Try saving again\./)).toBeTruthy());
  expect(screen.queryByText(/Something went wrong/)).toBeNull();
});

test('a scope with no deliverables is refused with a clear message before anything is sent', async () => {
  const onConfirmScope = jest.fn(async () => undefined);
  await render(<ScopeDraftScreen project={project} draft={{ ...draft, requirements: [] }} onBack={jest.fn()}
    onConfirmScope={onConfirmScope} onSaveDraft={jest.fn()} />);
  await fireEvent.press(screen.getByLabelText('Release and confirm scope'));
  await waitFor(() => expect(screen.getByText(/Add at least one deliverable/)).toBeTruthy());
  expect(onConfirmScope).not.toHaveBeenCalled();
});
