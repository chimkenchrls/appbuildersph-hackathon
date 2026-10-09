# OwlSet

Clear agreements. Controlled revisions. Confident freelancing.

OwlSet is an offline-first mobile workspace for freelance developers and designers. It turns client conversations into structured, confirmed project scopes, compares new client requests against established agreements to prevent scope creep, generates legally compliant service contracts under Philippine law, and prepares professional change proposals with one-tap native sharing.

---

## Core capabilities

* **BriefCraft:** Extracts deliverables, budget, timeline, revision allowances, exclusions, and BIR withholding tax treatment from raw client chat messages or notes.
* **Kasunduan Vault:** Stores immutable, versioned agreements with stable requirement IDs (`REQ-01`, `REQ-02`, etc.) in a local SQLite database.
* **ScopeGuard:** Evaluates new client requests against confirmed agreement deliverables using local on-device inference, classifying work into `included`, `potential_additional`, or `needs_clarification` with evidence citations.
* **ChangeDesk:** Compiles scope additions into clear change proposals with freelancer-estimated pricing and delivery time adjustments.
* **Legal Contract Generator:** Automatically produces formal, print-ready freelance service agreements compliant with Philippine commercial law:
  * Republic Act No. 11976 (Ease of Paying Taxes / EOPT Act) commercial invoicing rules.
  * Bureau of Internal Revenue (BIR) Form 2307 creditable withholding tax clauses (5% or 10%).
  * Republic Act No. 8293 (Intellectual Property Code) withholding IP transfer until full compensation settlement.
  * Republic Act No. 10173 (Data Privacy Act of 2012) confidentiality standards.
  * Ready-to-sign mutual signature blocks.
* **Native Sharing Service:** Summons the native device share sheet via `Share.share()` for offline dispatch to messaging apps, email, or cloud storage without third-party servers or API keys.
* **Portable Offline Backup:** Full project backup and restore via self-contained JSON exports (`ExportService`).

---

## Technical stack

* **Runtime & Framework:** React Native `0.86.3` with Expo SDK 57 and TypeScript (strict mode).
* **Navigation:** Expo Router (`src/app/`).
* **Local Database:** `expo-sqlite` with write-ahead logging (WAL mode) and sequential versioned migrations (`src/database/migrations/`).
* **Validation:** Zod schema validation for all domain records and LLM outputs (`src/types/schemas.ts`).
* **Inference Engine:** On-device local LLM engine via LM Studio HTTP bridge (`LMStudioAdapter`), connecting via `http://10.0.2.2:1234/v1` on Android and `http://127.0.0.1:1234/v1` on iOS and Web.

---

## Getting started

### Prerequisites

* Node.js 22 (`>=22.13.0 <23`), the version CI and the web deployment build with
* npm (lockfile committed)
* (Optional for live AI inference) LM Studio running locally with a local model loaded and the local server started on port 1234.

### Installation

```sh
npm ci
npx expo install --check
npx expo-doctor
```

### Running the application

* **Metro bundler & Expo Go:**
  ```sh
  npx expo start
  ```
* **Web preview:**
  ```sh
  npm run web
  ```
* **Android emulator:**
  ```sh
  npm run android
  ```

---

## Codebase architecture

```text
src/
  app/                    # Expo Router route definitions and root layout
  components/ui/          # Shared UI components (Screen, Button, TextField, StatusBadge, ...)
  constants/theme.ts      # Mint Teal design tokens
  database/
    client.ts             # SQLite connection and foreign key pragmas
    migrate.ts            # Migration execution runner
    seed.ts               # Idempotent demo project seeder
    migrations/           # Ordered database migrations (001_initial, 002_add_tax_treatment)
    repositories/         # SQLite repositories (Project, Agreement, ScopeGuard, Proposal, Settings)
  llm/
    contracts.ts          # Engine interfaces and error classes
    jsonParser.ts         # Fence stripping and Zod validation
    adapters/             # LLM adapters (LMStudioAdapter)
    prompts/              # BriefCraft, ScopeGuard, and ChangeDesk prompt builders
  services/
    briefCraftService.ts  # Scope extraction from conversation
    kasunduanVaultService.ts # Immutable agreement confirmation
    scopeGuardService.ts  # Request analysis against confirmed scope
    changeDeskService.ts  # Change proposal generation
    contractGeneratorService.ts # Philippine law compliant contract generation
    shareService.ts       # Native OS share sheet dispatcher
    exportService.ts      # Offline JSON import and export
    bootstrapService.ts   # Database migration, seeding, and engine initialization
    contracts.ts          # SaklawData and SaklawAi: the two interfaces the mobile screens call
    active.ts             # The implementations the screens use: the backend, or fixtures in tests
    backend/              # Adapters from the backend repositories, services, and AI engine to the contracts
    workflows.ts          # Extraction, confirmation, analysis, and proposal glue for the screens
    fixtures/             # In-memory data and prepared AI output for tests and EXPO_PUBLIC_SAKLAW_FIXTURES=1
  features/               # Feature hooks and components (projects, scope, request, proposal, ai)
  hooks/                  # useOperation, useExitGuard
  safety/                 # Evidence, estimate, and draft validation used by the screens
  screens/                # Dashboard, workspace, ScopeGuard, and proposal screens;
                          # .web.tsx siblings keep the web export to a placeholder
    HomeScreen.tsx        # Diagnostics and live contract sharing screen (not routed)
  types/
    domain.ts             # TypeScript domain interfaces
    workspace.ts          # Contract types used by the mobile screens
    schemas.ts            # Zod validation schemas
```

---

## Verification commands

Run these checks before committing code:

```sh
npm run lint
npm run typecheck
npm test
npm run check:dependencies
npx expo-doctor
npm run build:web
```

---

## Web deployment on Vercel

The web target is OwlSet's landing page. It is published to Vercel by GitHub Actions, and only
for a commit that CI has verified on `main`: `.github/workflows/cd.yml` rebuilds that commit,
publishes it, and smoke-checks the live site. Vercel's own deployments from Git are switched
off in `vercel.json`.

The root `vercel.json` configures a locked npm install, `npm run build:web`, the `dist` output
directory, and a routing fallback for direct links. Fonts and mascot assets are included in the export.

Setup, the required GitHub environment secrets, failure recovery and rollback are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The landing page needs no environment variables or running AI server. Keep local
generation credentials out of Vercel. Publishing the website does not deliver the
Android application; standalone APK builds are separate.

## Standalone Android APK builds

Standalone Android APKs are configured using EAS Build profiles:

```sh
# Test build
npx eas-cli@latest build --platform android --profile preview

# Release candidate build
npx eas-cli@latest build --platform android --profile apk
```

Both profiles output standalone `.apk` packages that install directly on physical Android hardware for 100% offline use.
