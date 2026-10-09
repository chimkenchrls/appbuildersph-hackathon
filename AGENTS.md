# Project instructions

## Purpose and sources of truth

Diligent Dev is a mobile-first React Native application built with Expo and
TypeScript. Android is the primary implementation, testing, and deployment target;
the release deliverable is an installable APK. Preserve iOS compatibility and the
existing web starter where practical, but neither is a gate for the Android release.

Read `ARCHITECTURE.md` before implementation for technical specifications,
directory layout, database schema, and security rules. Read `package.json`,
`app.json`, and `eas.json` before changing dependencies or configuration.

`ARCHITECTURE.md` defines an offline application with local SQLite data, private
files, and on-device LLM inference. These are architectural requirements, not
implemented starter features. The product domain, native inference binding,
baseline model, and supported device budget still need selection. Do not add
remote runtime dependencies. Record agreed decisions as the project develops;
keep this guide, the README, and configuration consistent.

## Current baseline and intended setup

The checked-in starter currently has:

- Expo `~57.0.27`, React Native `0.86.3`, React `19.2.3`, and strict TypeScript.
- Node.js `>=22.13.0` and npm with a committed `package-lock.json`.
- `expo-router/entry` as the entry point; thin routes under `src/app/` render screens
  from `src/screens/`.
- Safe-area support and Metro web bundling.
- EAS `development`, `preview`, and `apk` profiles, plus a `production` profile for
  future store builds. `preview` and `apk` explicitly produce Android APKs.
- Lint, type checking, Jest tests, Expo dependency checks, and web export in CI.
- No `ios/` or `android/` directories; they are ignored in Git.

Expo Router, ESLint, Jest, and the development-client dependency are installed.
The mobile screens currently run on labeled in-memory fixtures in
`src/services/fixtures/`; they are not evidence of persistence or local inference.
The setup steps below record how the starter was evolved. Do not claim that
development builds or offline inference work before configuring and verifying
them. Recheck the baseline whenever these files change.

## Verify Expo APIs against the installed SDK

Expo changes between SDK releases. Before writing code that touches Expo, EAS,
or React Native APIs:

1. Read the major version of `expo` in `package.json`; do not assume it remains 57.
2. Fetch the matching SDK reference at
   `https://docs.expo.dev/versions/v<major>.0.0/` and the relevant package page.
   The current reference is [SDK 57](https://docs.expo.dev/versions/v57.0.0/).
3. For routing, tooling, builds, or other topics, fetch
   [the Expo documentation index](https://docs.expo.dev/llms.txt), read its
   corrections, and follow its links to the specific documentation needed.
4. Verify API names, imports, platform support, permissions, and config plugins.
   Use the React Native documentation matching the installed React Native version
   when an API is provided by React Native itself.

Use the local Expo CLI. Do not use the deprecated global `expo-cli`, `expo eject`,
or instructions remembered from another SDK. Do not copy package API examples
from `versions/latest` without checking the installed SDK reference.

## Project setup with React Native and Expo

### 1. Install and start the existing starter

Use Node.js meeting the version in `package.json`. This repository currently uses
npm; use the lockfile for reproducible installation:

```sh
npm ci
npx expo install --check
npx expo-doctor
npx expo start
```

Scan the QR code on a physical phone using an SDK-compatible Expo Go client.
Use a development build when the required native modules are unavailable in
Expo Go. `npm run web` starts the companion web target. Android emulators need
the Android toolchain; the iOS simulator requires macOS and Xcode.

Do not scaffold another application over this repository. Keep the existing
lockfile and SDK unless the task explicitly includes a migration.

### 2. Migrate the starter to Expo Router

Follow [manual Router installation](https://docs.expo.dev/router/installation/)
for the installed SDK:

```sh
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
```

- Change `package.json`'s `main` to `expo-router/entry`.
- Create `src/app/_layout.tsx` for the root navigator and shared providers.
  Move the safe-area provider and status-bar setup out of `App.tsx` into this layout.
- Create `src/app/index.tsx` for the initial route. It can render the existing
  `HomeScreen` during migration.
- Retire the old `App.tsx`/`index.ts` registration after Router is working.
  Preserve any necessary initialization using the documented custom entry pattern.
- Configure a deep-link scheme and typed routes in `app.json`; verify any Router
  plugin requirements against the SDK docs. Keep the existing Metro web target.
- Keep `tsconfig.json` extending `expo/tsconfig.base` with `strict: true`.
  If adding `@/*` imports, map that alias to `./src/*`.
- Restart with `npx expo start --clear` after entry or bundler configuration changes.

### 3. Establish linting

Run `npx expo lint` during setup to install/configure Expo's ESLint integration
and generate the configuration. Commit its configuration, dependency, lockfile,
and script changes. Verify linting can subsequently run without setup prompts,
and add lint to `.github/workflows/ci.yml` alongside the existing checks.
See [Expo lint setup](https://docs.expo.dev/guides/using-eslint/).

### 4. Configure development builds

For custom native modules or native configuration, install the development client:

```sh
npx expo install expo-dev-client
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Preserve the existing profiles and ensure `eas.json` includes
`build.development` with `developmentClient: true` and `distribution: "internal"`.
Configure the actual Expo project identity, unique Android package, and iOS bundle
identifier; never invent account IDs or credentials.

```sh
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

Install the resulting build before starting its development session. Rebuild
after native dependency or native configuration changes. Cloud builds do not
require local Xcode or Android Studio; signing and physical iOS distribution
still require the appropriate Apple credentials and device registration.
See [development builds](https://docs.expo.dev/develop/development-builds/introduction/)
and [EAS profiles](https://docs.expo.dev/build/eas-json/).

## Directory layout and navigation

Use the canonical layout in `ARCHITECTURE.md` after the Router migration; create
directories as needed. The core frontend directories include:

```text
src/
  app/             # Routes and _layout.tsx navigators only
  components/      # Shared UI
  screens/         # Screen implementations composed by routes
  features/        # Feature-specific UI and business logic
  hooks/           # Shared React hooks
  database/        # SQLite migrations and repositories
  services/        # Bootstrap, storage, model lifecycle, and orchestration
  llm/             # Engine contracts, adapter, scheduler, and prompt building
  safety/          # Local policy and validation boundaries
  utils/           # Pure helpers
  constants/       # Shared design tokens and constants
  types/           # Shared TypeScript contracts
```

Use Expo Router for all navigation. Import `Link`, `router`, and
`useLocalSearchParams` from `expo-router`. Keep route components thin and keep
components, hooks, utilities, and tests outside `src/app/`. `_layout.tsx` files
define navigators; do not add a competing navigation root. Validate route
parameters before using them as identifiers or request inputs.
See [Router introduction](https://docs.expo.dev/router/introduction/).

## Mobile UI, performance, and compatibility

- Build shared UI with React Native primitives. Keep browser-only globals and
  HTML elements out of shared mobile screens.
- Account for safe areas, keyboard overlap, small screens, touch targets,
  accessibility labels, screen readers, and system font scaling.
- Use flexible layouts rather than fixed desktop dimensions. Verify Android back
  behavior, iOS navigation gestures, and deep links when navigation changes.
- Handle loading, empty, error, denied-permission, and disconnected states.
  Request permissions when the user invokes the feature that needs them.
- Virtualize long lists, paginate large datasets, size images appropriately, and
  avoid expensive work during rendering or on the JavaScript thread.
- Profile observed performance problems before adding memoization or dependencies.
  Clean up subscriptions, timers, and requests when their owners unmount.
- Isolate necessary platform differences in platform-specific modules outside
  the route directory. Keep shared behavior consistent across Android, iOS, and web.
- Prefer Expo modules and review relevant available skills before adding a library.
  Confirm SDK compatibility, native build requirements, and supported platforms.

## Dependencies and native configuration

Always add project packages through `npx expo install <package>` rather than
`npm install <package>` or another package manager's add command. Use
`npx expo install --fix` to resolve diagnosed SDK incompatibilities and inspect
the resulting changes. Keep React and React Native aligned with the Expo SDK.

If `bun.lock` is present and the project uses Bun, use `bun install --frozen-lockfile`
for locked installs, `bunx expo` instead of `npx expo`, `bunx tsc --noEmit`,
`bunx expo-doctor`, and `bunx eas-cli <command>`. Do not switch package managers or
add competing lockfiles as an incidental change.

This project uses Continuous Native Generation. Never create or edit `ios/` or
`android/` by hand. Configure native behavior through `app.json` (or an intentional
app config migration) and config plugins. Let Expo/EAS generate native projects
when building. Keep generated native directories ignored.

Local development builds may use `npx expo run:android` or `npx expo run:ios` when
the host supports the necessary native toolchain. Expo Go contains only its
bundled native modules; a newly installed native library outside that bundle
requires a development build.
See [Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/).

## Environment and security

Follow the local schema and security rules in `ARCHITECTURE.md`. Access SQLite
through repositories and inference through its adapter/scheduler. Bind SQL values
and validate imported files and generated output. Keep all core flows usable
offline, including first launch; do not add cloud inference, login, telemetry,
remote configuration, or required model downloads.

Document required variables in `.env.example` using non-secret examples. Keep
local `.env` files ignored. `EXPO_PUBLIC_*` values are embedded in the client and
must contain only public configuration. Never bundle private keys, administrative
credentials, signing material, or backend secrets. Use appropriate secure device
storage for sensitive session data and avoid logging tokens or personal data.
See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

## Android APK delivery

Use EAS for cloud building and signing. The primary delivery path is a signed,
standalone Android APK shared directly with testers or users.
Run EAS as `npx eas-cli@latest <command>` with npm or `bunx eas-cli <command>` with
Bun. Use `preview` for testing and `apk` for the release candidate:

```sh
npx eas-cli@latest build --platform android --profile preview
npx eas-cli@latest build --platform android --profile apk
```

Both profiles explicitly set `android.buildType: "apk"`. The `apk` profile inherits
production version incrementing and uses internal distribution. Keep the existing
`production` profile for a future Google Play AAB workflow. An AAB cannot be
installed directly like an APK; store submission is a separate delivery decision.
See [Expo APK builds](https://docs.expo.dev/build-reference/apk/).

Before the first cloud build, configure the team's Expo project, Android package
identifier, and signing credentials. Preserve the package identifier and signing
key across releases, and increase the Android version code for upgrades. Keep
credentials out of Git. Share the EAS artifact link and record the app version
and source commit used for each release.

Install the APK on physical Android devices and test without Metro or Expo Go.
Verify fresh installation, first launch, local model setup, inference, persistence,
and relaunch in airplane mode; also test upgrading an existing installation without
losing data. Follow the physical-device resource and network checks in
`ARCHITECTURE.md`. A development client is not the standalone release artifact.

Distribute offline upgrades as new APKs. Do not enable automatic EAS Update checks
or add an OTA runtime dependency under the current offline architecture. EAS is
build-time infrastructure; the installed app must work independently of it.

## Required verification and completion

Run lint and type checking before declaring any task done:

```sh
npx expo lint
npx tsc --noEmit
```

After dependency or config changes, also run `npx expo install --check` and
`npx expo-doctor`. Preserve the existing CI checks, including
`npm run build:web`; run web export when changes affect web or bundling.
Use focused tests for changed business logic and manually verify affected flows
on physical Android devices. Verify iOS when a change affects shared native
behavior and devices/builds are available, reporting any gaps. Android APK release
acceptance is mandatory; a web preview alone does not verify native behavior.

Report what changed and which checks passed. If dependencies, configuration,
credentials, or devices prevent a check, state the exact limitation and remaining
verification; never report an unrun or failed check as passing.
