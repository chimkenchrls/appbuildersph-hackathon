# Saklaw Frontend Implementation Handoff

**Date:** 2026-10-09
**Status:** The four screens run on the backend (SQLite and the AI engine). `origin/main` is merged in locally. Not pushed, not verified on a device.
**Working branch:** `pandesal-branch`
**Plan:** [2026-10-09 mobile frontend implementation plan](./plans/2026-10-09-saklaw-mobile-frontend.md)
**Design specification:** [Saklaw mobile frontend design](./specs/2026-10-09-saklaw-mobile-frontend-design.md)

**2026-10-10 persistence update:** See [the repair note](./PERSISTENCE-REPAIR-2026-10-10.md) for atomic saves, validation, migration 3, and device acceptance. Fresh checks: 119 tests in nine suites, lint, type checking, and web export passed. Money migration is deferred by user choice. Android testing belongs to the team; these changes are not device-verified. Earlier counts below are historical.

**Earlier verification and integration review:** See the
[2026-10-09 integration audit and Android test checklist](./INTEGRATION-AUDIT-2026-10-09.md).
It supersedes the historical verification counts below: 63 tests in seven suites,
lint, type checking, online dependency checks, Doctor, and web/Android JavaScript
exports passed on `10f3053`. Native builds, devices, and offline acceptance remain pending.

**Subsequent LM Studio fixes and live results:** See the
[LM Studio test note](./LM-STUDIO-TEST-2026-10-09.md). The current feature-branch
working tree has configuration precedence, model readiness, direct-answer requests,
and timeout feedback fixes. All 74 tests, lint, and type checking pass. Real Qwen
extraction, analysis, and proposal generation passed from Node over LAN; verification
inside the iPhone app remains pending. These fixes are uncommitted and unpushed.

## Instructions for the next agent

The front-end work, merge of `origin/main`, and backend routing are committed locally on
`pandesal-branch` (latest inspected commit `10f3053`). Do not push, merge to `main`, deploy, or
reset the checkout; the front-end owner reviews and tests first. Use the design
specification as the product authority. Fixtures stay labeled, and the app must not be
connected to the development FastAPI/LM Studio server as part of this review.
Normal backend mode currently selects the LM Studio HTTP adapter; the offline
release still requires a native engine.

## What exists now

- **Screens:** Dashboard, Project Workspace (no scope, draft, confirmed), ScopeGuard, and
  Change Proposal in `src/screens/`, with thin routes under `src/app/`. Each has loading,
  empty, missing-record, AI-unavailable, running, saving, cancelled, and failed states.
- **Theme and components:** Mint Slate tokens in `src/constants/theme.ts`; shared
  components in `src/components/ui/`; feature components in `src/features/`.
- **Web:** `/` renders a placeholder and the project routes redirect to it. The web bundle
  contains no fixture or service code.
- **Logic from the first session:** contracts, fixtures, validation, workflows, operation
  ownership, feature hooks, and the exit guard. Three lint errors in the hooks were fixed.
- **Tests:** 50 in 5 suites (`tests/`), covering domain rules, operations, hooks, the exit
  guard, and screen interactions.
- **Config and docs:** `app.json` is dark; `npm test` exists and runs in CI; `FRONTEND.md`,
  `README.md`, and the `AGENTS.md` baseline describe the current state.

## Verification state

Run on the final working tree:

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | 50 passed, 5 suites |
| `npm run lint` | clean |
| `npm run typecheck` | clean |
| `npm run check:dependencies` | up to date |
| `npx expo-doctor` | 21/21 |
| `npm run build:web` | exported; no mobile services in the bundle |
| `npx expo export --platform android` | bundled |

The screens were also rendered through React Native Web in headless Chromium at phone and
tablet widths using a temporary route, now deleted. That is a layout check only.

**Not verified:** anything on a physical device or emulator. That includes keyboard
avoidance, safe areas, hardware Back and the exit guard with a real navigator, TalkBack and
VoiceOver, large system text, clipboard, and icon rendering in a native build. No
independent code review has been run.

## Backend routing (third session)

`origin/main` is merged into `pandesal-branch`, and the screens now run on the backend.

- `src/services/active.ts` selects the implementations: the backend by default, the
  labeled fixtures under Jest or with `EXPO_PUBLIC_SAKLAW_FIXTURES=1`.
- `src/services/backend/` holds the adapters: `backendData.ts` (repositories and
  `KasunduanVaultService` behind `SaklawData`), `backendAi.ts` (the `LLMEngine`, prompts,
  and parser behind `SaklawAi`), `mappers.ts`, and `ports.ts`.
- The front-end contract types moved to `src/types/workspace.ts`, beside the backend's
  `src/types/domain.ts`.
- Unconfirmed scope drafts are stored as JSON in the backend's `app_settings` table under
  `saklaw_scope_draft:<projectId>`, because the schema has no drafts table.
- `ProposalRepository.update` gained an optional `selectedItems` so edited deliverables
  persist. This is the only change to a backend file.
- `tests/backendSqlite.test.ts` runs the real migrations, seed, repositories, and services
  on Node's built-in SQLite through a stand-in for the `expo-sqlite` calls. It is skipped
  where Node has no `node:sqlite`.

**Not verified:** `expo-sqlite` itself on a device, and inference against a running LM
Studio server. No device or emulator was available.

**Behavior that differs from the backend services**

- Evidence ids that do not resolve make the analysis fail (`invalid_output`).
  `ScopeGuardService` filters them out silently; the adapter does not use that method.
- Confirming a scope for a project that already has an agreement is refused.
  `KasunduanVaultService` on its own would create version 2.
- Agreements confirmed from the screens record `taxTreatment: 'none_specified'`, since
  the screens do not ask for one.
- The AI's overall classification and summary are not shown; the adapter stores values
  derived from the findings.

## Next steps

1. **Device pass** on a development build, using the list in `FRONTEND.md` section 11. A new
   build is required: `expo-clipboard` and the Lucide icon plugin are native additions.
2. **AI engine.** The engine is `LMStudioAdapter`, which needs a reachable LM Studio
   server. The seed stores `lm_studio_url` in settings on first launch, and that saved
   value then wins over the environment variable; there is no settings screen to change it.
   The project's offline requirement still needs an on-device engine behind `LLMEngine`.
3. **Independent review** of the full diff.
4. Check the blur-save window on real SQLite: `useWorkspace` ignores edits while a save is
   in flight (see the plan's execution notes).
5. Newly seeded SQLite sample projects have a Demo title. Existing sample projects are
   preserved, including their previous titles; partial historical seeds are not auto-repaired.

## Decisions made during implementation

Listed with their costs in the plan's "Second session" execution notes.
