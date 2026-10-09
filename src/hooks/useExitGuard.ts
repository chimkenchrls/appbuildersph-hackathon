import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { router, useNavigation, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';

type Options = {
  blocked: boolean;
  parent: Href;
  prepare: () => Promise<boolean>;
  discard?: () => Promise<void>;
  retrySave?: boolean;
};

/** One exit path for header Back, hardware Back, and native removal gestures. */
export function useExitGuard({ blocked, parent, prepare, discard, retrySave = false }: Options) {
  const navigation = useNavigation();
  const active = useRef(false);
  const approved = useRef(false);
  const handle = useCallback(async (leave: () => void) => {
    if (active.current) return;
    active.current = true;
    try {
      while (true) {
        if (await prepare()) { approved.current = true; leave(); return; }
        const choice = await new Promise<'keep' | 'discard' | 'retry'>(resolve => {
          Alert.alert('Unsaved changes', 'Your changes have not been saved. Keep editing or explicitly discard them.', [
            { text: 'Keep editing', style: 'cancel', onPress: () => resolve('keep') },
            ...(retrySave ? [{ text: 'Retry save and leave', onPress: () => resolve('retry') }] : []),
            { text: 'Discard unsaved changes', style: 'destructive', onPress: () => resolve('discard') },
          ], { cancelable: true, onDismiss: () => resolve('keep') });
        });
        if (choice === 'keep') return;
        if (choice === 'retry') continue;
        await discard?.(); approved.current = true; leave(); return;
      }
    } finally { active.current = false; }
  }, [prepare, discard, retrySave]);
  usePreventRemove(blocked, ({ data }) => {
    if (approved.current) { approved.current = false; navigation.dispatch(data.action); return; }
    void handle(() => navigation.dispatch(data.action));
  });
  return () => {
    if (router.canGoBack()) router.back();
    else if (blocked) void handle(() => router.replace(parent));
    else router.replace(parent);
  };
}
