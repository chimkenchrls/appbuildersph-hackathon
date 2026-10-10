# OwlSet

Clear agreements. Controlled revisions. Confident freelancing.

OwlSet is an offline-first mobile workspace for freelance developers and designers. It turns client conversations into structured, confirmed project scopes, compares new client requests against established agreements to prevent scope creep, generates legally compliant service contracts under Philippine law, and prepares professional change proposals with one-tap native sharing.

---

## Using the Android app: first-time setup

OwlSet runs its AI on the phone, and the model file is **not** inside the APK. Do this once
after installing. It takes about five minutes and needs no internet.

**You need**
* An Android phone with about 8 GB RAM and free storage of roughly **twice the model file's
  size** (the picker makes a temporary copy while importing).
* The model file: `Qwen2.5-3B-Instruct` in GGUF format, `Q4_K_M` quantization (about 2 GB). Any
  `.gguf` chat model works, but this is the one OwlSet was tested with.
* The file must be saved **on the phone** (Downloads is fine). A file that only exists in a cloud
  drive will not import.

**Steps**
1. Install the APK and open OwlSet. Finish the short welcome screen (your name and role).
2. Open **Settings**. Under **AI Inference Engine**, choose the **On-Device** tab.
3. Tap **Import .gguf Model** and pick the file. Keep the app open until it says the model was
   imported and activated. The file name and size are then shown.
4. Tap **Test On-Device**. A passing test shows the time it took. The first run is the slowest.
5. Go back to **Projects** and tap **New Project**. Paste a client conversation and create the
   draft. The draft screen should say **"Drafted by AI"**.

**What to expect**
* Each AI step takes roughly 10 to 20 seconds on a recent phone. "Analyze request and prepare
  proposal" makes two model calls, so it can take about twice that.
* Once imported, the model stays on the phone across restarts and works in airplane mode.
* Conversations over about 15,000 characters, or very long requests, are refused with a message.
  Paste only the relevant messages.
* Without a model the app still opens and runs. Project drafts then use a simple rule-based
  reader and are labelled **"Drafted by the rule-based fallback, not AI"**. Scope checks and
  change proposals need the model and will show an error until one is imported.

**If something goes wrong**
* *"Not a GGUF model" on import:* the file is not a GGUF, or it was only partly downloaded.
  Download it again.
* *"Not enough free storage":* free up space and try again. Your previous model is kept.
* *The app is slow or closes:* open Settings, tap **Free Model RAM**, and close other apps. A
  smaller model (for example a 1.5B) uses less memory.

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
* **Portable Offline Backup:** Versioned, validated JSON snapshots include reviewed drafts and preserve timestamps. Restore is atomic and rejects conflicting saved records (`ExportService`; not exposed by the four-screen UI yet).

---

## Technical stack

* **Runtime & Framework:** React Native `0.86.3` with Expo SDK 57 and TypeScript (strict mode).
* **Navigation:** Expo Router (`src/app/`).
* **Local Database:** `expo-sqlite` with write-ahead logging (WAL mode) and sequential versioned migrations (`src/database/migrations/`).
* **Validation:** Zod schema validation for all domain records and LLM outputs (`src/types/schemas.ts`).
* **Inference Engine:** on-device `llama.rn` with a user-imported GGUF model (`NativeLlamaAdapter`), or an LM Studio HTTP server on the local network (`LMStudioAdapter`) for development. `HybridLlmAdapter` chooses between them (On-Device, Auto or Network in Settings).

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

For LM Studio testing, set `EXPO_PUBLIC_LM_STUDIO_URL` to the server's `/v1`
address and `EXPO_PUBLIC_LM_STUDIO_MODEL` to an exact ID listed by `/v1/models`.
On a physical iPhone or Android phone, enable LM Studio's local-network server
binding and use the computer's LAN IP, not the phone's localhost. Keep fixtures
disabled for real inference.

Precedence for the server address: a value the user saved in Settings wins, then the
build's `EXPO_PUBLIC_*` value, then the default saved on first launch. Restart
Metro with `npx expo start --clear` and reload the app after changing `.env`.
Existing project data does not need to be deleted. The Ready state checks that
the configured model is listed by the server; it does not guarantee generation
speed or output quality. LM Studio requests use `reasoning_effort: "none"` to
reserve the output budget for the final answer; this was verified against Qwen
3.5 9B on the development server. The adapter's 60-second deadline covers the
complete response. A generation timeout offers retry guidance without treating
the server as unreachable. Avoid loading duplicate large model instances on
memory-constrained development machines.

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

Both profiles output standalone `.apk` packages for physical Android installation. Offline inference and standalone APK acceptance still require device verification.

Persistence repairs are documented in [the 2026-10-10 repair note](docs/superpowers/PERSISTENCE-REPAIR-2026-10-10.md), including migration compatibility and the team's device checklist. Related screen saves now commit atomically, confirmed clauses are protected, and new proposal days must be whole numbers. Money remains in main units pending a separate centavo migration. Existing fractional days are kept; explicitly correct them before resaving or exporting that project. Native upgrade/relaunch and standalone APK acceptance still require team testing.

The staging mobile UI integration is recorded in [the integration decision](docs/decisions/2026-10-10-staging-integration.md). It keeps the existing web landing page, APK identity and validated backend; new native dependencies require a development/APK rebuild.
