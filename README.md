# Diligent Dev

A minimal Expo + React Native + TypeScript starter with Android APK delivery as
the priority. iOS compatibility and the existing web target are secondary.
`ARCHITECTURE.md` defines the intended offline local-data and on-device inference
architecture; those capabilities are not implemented in the starter yet.

## Start

Use Node.js 22.13 or newer and npm. From this folder:

```sh
npm ci
npm run check:dependencies
npm start
```

The committed `package-lock.json` pins the team's dependencies. Use `npm ci`
after pulling changes. Use `npm run web` for the companion web preview.

For a physical phone, install Expo Go, then run `npm start` and scan the QR code.
The phone and computer should be on the same network. Expo Go previews the project;
it is not a standalone installation of your app.

`npm run android` launches an Android emulator when the Android SDK is configured.
`npm run ios` launches the iOS simulator on macOS with Xcode; it does not work on Linux.
Physical iPhones can use Expo Go during development.

## Files

- `src/screens/HomeScreen.tsx`: starter screen; replace it when you choose an idea.
- `App.tsx`: shared root and safe-area provider.
- `index.ts`: Expo entry point.
- `app.json`: app name, platforms, and web configuration.
- `eas.json`: native preview and production build profiles.

Add reusable components under `src/components/` and business logic under
`src/features/` when the project needs them.

## Checks and web export

```sh
npm run typecheck
npm run check:dependencies
npm run build:web
```

The web export is written to `dist/` and can be hosted as a static website.

## Android APK builds and distribution

Native build profiles are included; no native builds have been created yet.
When you are ready, log in to an Expo account and configure the project:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile apk
```

Configure the team's Expo project and a unique Android package identifier before
building. Preserve the existing profiles when running build configuration.
`preview` produces a test APK; `apk` produces a standalone release candidate and
inherits production version incrementing. Both explicitly set
`android.buildType: "apk"`. The existing `production` profile remains available
for future Google Play AAB builds. See [Expo APK builds](https://docs.expo.dev/build-reference/apk/).

Share the EAS build artifact link and record its app version and source commit.
Download and install the APK on a physical Android device, allowing installation
from that source when Android prompts. Keep the Android package identifier and
signing key stable so later APKs can upgrade the installed app. Keep signing
credentials out of the repository.

The Android release must run without Expo Go or a development server. Once the
offline features are implemented, verify fresh installation and first launch,
local model setup, inference, saved data, and relaunch in airplane mode. Test
upgrading an existing installation without losing data. Follow the device and
resource acceptance requirements in `ARCHITECTURE.md`.

EAS is used at build time; the release must not depend on cloud services at
runtime. Deliver offline upgrades as new APKs. iOS builds and store submission
can be configured when those delivery targets are needed.

## Setup verification

The starter files were created directly because the setup environment could not
resolve `registry.npmjs.org` (`EAI_AGAIN`). Dependencies were not installed, so
TypeScript checks, web export, and device execution still need to run after install.

Dependencies follow the official [Expo SDK 57 template](https://github.com/expo/expo/blob/sdk-57/templates/expo-template-blank-typescript/package.json)
and [compatible package versions](https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json).
See [Expo web](https://docs.expo.dev/workflow/web/) and
[EAS Build configuration](https://docs.expo.dev/build/eas-json/) for details.
