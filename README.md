# Diligent Dev

A minimal Expo + React Native + TypeScript starter sharing one codebase across
web, Android, and iOS. No project idea or backend is assumed yet.

## Start

Use Node.js 22.13 or newer and npm. From this folder:

```sh
npm install
npm run check:dependencies
npm run web
```

The first install creates `package-lock.json`; commit it to pin the team's dependencies.
Use `npm ci` for subsequent installs once that lockfile is committed.

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

## Installable Android and iPhone apps

Native build profiles are included; no native builds have been created yet.
When you are ready, log in to an Expo account and configure the project:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform ios --profile preview
```

Choose unique Android package and iOS bundle identifiers during configuration.
Android internal distribution produces an installable APK. Physical iPhone
internal distribution requires Apple signing credentials and registered devices.
EAS cloud builds can be started from Linux; local iOS builds require macOS.
Store releases use the `production` profile and require the corresponding
developer accounts, signing, and store submission.

## Setup verification

The starter files were created directly because the setup environment could not
resolve `registry.npmjs.org` (`EAI_AGAIN`). Dependencies were not installed, so
TypeScript checks, web export, and device execution still need to run after install.

Dependencies follow the official [Expo SDK 57 template](https://github.com/expo/expo/blob/sdk-57/templates/expo-template-blank-typescript/package.json)
and [compatible package versions](https://github.com/expo/expo/blob/sdk-57/packages/expo/bundledNativeModules.json).
See [Expo web](https://docs.expo.dev/workflow/web/) and
[EAS Build configuration](https://docs.expo.dev/build/eas-json/) for details.
