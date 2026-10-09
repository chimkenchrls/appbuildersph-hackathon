import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { Operation } from '@/services/operation';

export function useOperation() {
  const [owner] = useState(() => new Operation());
  const state = useSyncExternalStore(owner.subscribe, owner.getSnapshot, owner.getSnapshot);
  useEffect(() => {
    owner.activate();
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') owner.cancel(); });
    return () => { listener.remove(); owner.dispose(); };
  }, [owner]);
  return { ...state, busy: state.status === 'running' || state.status === 'saving', run: owner.run, cancel: owner.cancel, settle: owner.settle, clearError: owner.clearError };
}
