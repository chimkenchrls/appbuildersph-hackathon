import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Platform } from 'react-native';

/**
 * Runs an asynchronous task (such as local LLM inference or heavy SQLite processing)
 * while keeping the device screen and CPU awake to prevent sleep throttling.
 */
export async function withKeepAwake<T>(
  action: () => Promise<T>,
  tag = 'diligent_inference',
): Promise<T> {
  if (Platform.OS === 'web') {
    return await action();
  }

  try {
    await activateKeepAwakeAsync(tag);
  } catch {
    // Graceful fallback if unsupported
  }

  try {
    return await action();
  } finally {
    try {
      deactivateKeepAwake(tag);
    } catch {
      // Graceful fallback
    }
  }
}
