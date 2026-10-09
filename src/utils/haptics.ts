import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Safe, platform-guarded haptic feedback helpers.
 * Suppresses errors on web or unsupported platforms gracefully.
 */

export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Graceful fallback if device haptics are unavailable
  }
}

export async function hapticWarning(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Graceful fallback
  }
}

export async function hapticError(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Graceful fallback
  }
}

export async function hapticImpactLight(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Graceful fallback
  }
}

export async function hapticImpactMedium(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Graceful fallback
  }
}

export async function hapticSelection(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Graceful fallback
  }
}
