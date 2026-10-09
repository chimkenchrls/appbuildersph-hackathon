import { useSyncExternalStore } from 'react';
import { ai } from '@/services/active';
export function useAiStatus() { return useSyncExternalStore(ai.subscribe, ai.getStatus, ai.getStatus); }
