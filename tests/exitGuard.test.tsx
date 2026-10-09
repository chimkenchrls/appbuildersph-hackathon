import { act, renderHook } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { useExitGuard } from '@/hooks/useExitGuard';

type PreventCallback = (event: { data: { action: unknown } }) => void;
const mockDispatch = jest.fn();
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
let mockPrevent: { blocked: boolean; callback: PreventCallback };

jest.mock('expo-router', () => ({
  router: { back: () => mockRouter.back(), replace: (href: unknown) => mockRouter.replace(href), canGoBack: () => mockRouter.canGoBack() },
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock('expo-router/react-navigation', () => ({
  usePreventRemove: (blocked: boolean, callback: PreventCallback) => { mockPrevent = { blocked, callback }; },
}));

const action = { type: 'GO_BACK' };
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

/** Presses a button on the most recent unsaved-changes alert. */
async function choose(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.calls.at(-1)?.[2] as AlertButton[];
  const button = buttons.find(item => item.text === text);
  if (!button) throw new Error(`No "${text}" button; offered: ${buttons.map(item => item.text).join(', ')}`);
  await act(async () => { button.onPress?.(); });
  await flush();
}

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.canGoBack.mockReturnValue(true);
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => alert.mockRestore());

test('a successful exit save replays the prevented navigation once without asking', async () => {
  const prepare = jest.fn(async () => true);
  await renderHook(() => useExitGuard({ blocked: true, parent: '/', prepare }));
  await act(async () => { mockPrevent.callback({ data: { action } }); });
  await flush();
  expect(alert).not.toHaveBeenCalled();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledWith(action);
});

test('Keep editing stays on the screen and discards nothing', async () => {
  const prepare = jest.fn(async () => false);
  const discard = jest.fn(async () => {});
  await renderHook(() => useExitGuard({ blocked: true, parent: '/', prepare, discard }));
  await act(async () => { mockPrevent.callback({ data: { action } }); });
  await flush();
  expect(alert).toHaveBeenCalledTimes(1);
  await choose(alert, 'Keep editing');
  expect(discard).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
});

test('Discard runs the discard step and then leaves', async () => {
  const prepare = jest.fn(async () => false);
  const discard = jest.fn(async () => {});
  await renderHook(() => useExitGuard({ blocked: true, parent: '/', prepare, discard }));
  await act(async () => { mockPrevent.callback({ data: { action } }); });
  await flush();
  await choose(alert, 'Discard unsaved changes');
  expect(discard).toHaveBeenCalledTimes(1);
  expect(mockDispatch).toHaveBeenCalledTimes(1);
});

test('Retry save is offered only when requested and leaves once the save succeeds', async () => {
  const prepare = jest.fn<Promise<boolean>, []>().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await renderHook(() => useExitGuard({ blocked: true, parent: '/', prepare, retrySave: true }));
  await act(async () => { mockPrevent.callback({ data: { action } }); });
  await flush();
  expect(mockDispatch).not.toHaveBeenCalled();
  await choose(alert, 'Retry save and leave');
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(mockDispatch).toHaveBeenCalledTimes(1);
});

test('without retrySave the alert offers only Keep editing and Discard', async () => {
  await renderHook(() => useExitGuard({ blocked: true, parent: '/', prepare: async () => false }));
  await act(async () => { mockPrevent.callback({ data: { action } }); });
  await flush();
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  expect(buttons.map(item => item.text)).toEqual(['Keep editing', 'Discard unsaved changes']);
});

test('a second exit attempt while the first is being handled is ignored', async () => {
  let finish!: (value: boolean) => void;
  const prepare = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
  await renderHook(() => useExitGuard({ blocked: true, parent: '/', prepare }));
  await act(async () => { mockPrevent.callback({ data: { action } }); mockPrevent.callback({ data: { action } }); });
  expect(prepare).toHaveBeenCalledTimes(1);
  await act(async () => { finish(true); });
  await flush();
  expect(mockDispatch).toHaveBeenCalledTimes(1);
});

test('header Back uses the navigator when it can, and the parent route otherwise', async () => {
  const hook = await renderHook(() => useExitGuard({ blocked: false, parent: '/', prepare: async () => true }));
  await act(async () => { hook.result.current(); });
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  mockRouter.canGoBack.mockReturnValue(false);
  await act(async () => { hook.result.current(); });
  expect(mockRouter.replace).toHaveBeenCalledWith('/');
});
