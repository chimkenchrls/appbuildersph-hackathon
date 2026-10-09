import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Platform } from 'react-native';

let sequence = 0;

/**
 * Runs an asynchronous task (such as local LLM inference or heavy SQLite processing)
 * while preventing the display from sleeping. This does not guarantee CPU scheduling.
 */
export async function withKeepAwake<T>(
  action: () => Promise<T>,
  tag = `diligent_inference_${++sequence}`,
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
      await deactivateKeepAwake(tag);
    } catch {
      // Graceful fallback
    }
  }
}
