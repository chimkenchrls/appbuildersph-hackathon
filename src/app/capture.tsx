import type { ComponentType } from 'react';

/**
 * Screenshot harness route. It exists only in a build made with EXPO_PUBLIC_APP_SCREENSHOTS=1
 * (see scripts/capture-app-screens.mjs); in every other build the branch below is removed, so
 * the screens are not bundled and this path renders nothing.
 */
let Capture: ComponentType | null = null;
if (process.env.EXPO_PUBLIC_APP_SCREENSHOTS === '1') {
  // A static import would bundle the screens into every build; this branch is removed unless the flag is set.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Capture = require('@/screens/CaptureScreen').CaptureScreen;
}

export default function CaptureRoute() {
  return Capture ? <Capture /> : null;
}
