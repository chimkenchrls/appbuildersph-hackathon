import { Alert, Platform } from 'react-native';

/** Tells the user that an action did not happen, instead of failing silently. */
export function notifyError(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
