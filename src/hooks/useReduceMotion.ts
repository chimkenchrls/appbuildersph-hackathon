import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True while the system's reduced-motion setting is on. */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      // react-native-web returns nothing here when the browser lacks matchMedia.
      subscription?.remove();
    };
  }, []);

  return reduceMotion;
}
