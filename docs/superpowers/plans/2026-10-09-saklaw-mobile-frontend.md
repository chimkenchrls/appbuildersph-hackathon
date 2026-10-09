# Saklaw Mobile Frontend Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Checkboxes record progress; the execution notes below retain decisions and evidence.

**Goal:** Implement the reviewed four-screen Android/iOS frontend with labeled in-memory data and prepared AI fixtures, ready for local review without pushing or merging.

**Architecture:** Thin Expo Router routes compose screens. Feature hooks own editable state and invoke validated application workflows and the two swappable service contracts. A shared non-scrolling shell provides accessible mobile layout; web renders only a placeholder.

**Tech Stack:** Expo 57, React Native 0.86.3, React 19.2.3, strict TypeScript, Lucide, Expo Clipboard, Jest Expo and React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-saklaw-mobile-frontend-design.md`

## Global constraints

- Work on existing `pandesal-branch`; preserve pre-existing modifications. Do not push, merge, deploy, or build with invented credentials.
- Shared Android/iOS UI; Android APK remains the release priority. Web does not load mobile services.
- Mint Slate dark theme, square corners, system fonts, 48-unit targets, safe areas and large text.
- Fixtures remain visibly labeled; data resets on restart and prepared output is not real inference.
- Agreement v1 is immutable; evidence resolves against its exact agreement; proposals remain drafts.
- Missing estimates are null; generated messages preserve user amounts and days.
- Protect edits on navigation, serialize saves, distinguish cancellable generation from non-cancellable persistence, validate project relationships.
- No remote runtime dependency or FastAPI integration. Real SQLite/native inference and APK signing are outside this frontend task.

## Review focus

1. Rapid Stop/retry or a late AI result must not change edits or save cancelled output (Task 2).
2. Older blur saves and failed exit saves must not discard the newest draft (Task 2).
3. Valid record IDs from a different project must not expose unrelated content or permit writes (Tasks 1 and 3).
4. Blank, malformed, enormous, and fractional numeric inputs must not become invented commitments (Tasks 1 and 3).
5. Keyboard, large text, fixture disclosures, and platform routing must remain usable and honest (Tasks 3 and 4).

## Task 1: Validated domain and fixture workflows

**Files:** `src/types/domain.ts`, `src/services/{contracts,errors,workflows,index}.ts`, `src/services/fixtures/*.ts`, `src/safety/*.ts`, `src/utils/{format,ids}.ts`, `tests/domain.test.ts`, `jest.config.js`, `package.json`.

**Interfaces:** Domain types and `SaklawData`/`SaklawAi` exactly as reviewed. `createFixtureData(seed?: boolean): SaklawData`, `createFixtureAi(): SaklawAi`, `createWorkflows(data, ai)` exposes the five spec workflows. Validation functions reject invalid shapes and references. Development controls expose unavailable, invalid, slow, and save-failure states.

- [x] Configure Jest Expo and install dev dependencies through Expo CLI.
- [x] Write and run failing tests for immutable confirmation, clone isolation, scoped relationships, null/invalid estimates, evidence rejection, candidate-only generation and preserved estimates.
- [x] Implement fixtures, validation, workflow glue and bounds. Run `npm test -- --runInBand tests/domain.test.ts`; expect all passing.

## Task 2: Operation and editing ownership

**Files:** `src/hooks/{useOperation,useExitGuard}.ts`, `src/services/operation.ts`, `src/features/{projects,scope,request,proposal,ai}/*`, `tests/operations.test.ts`, `tests/hooks.test.tsx`.

**Interfaces:** `useOperation` supplies signal/beginSave, a busy state, cancellation and settlement. `useWorkspace(projectId)`, `useRequestAnalysis(projectId, analysisId?)`, `useProposal(projectId, proposalId)` expose states/actions from the spec. `useExitGuard` intercepts native navigator removal and offers async save/discard recovery. Route parents are explicit for direct links.

- [x] Write failing tests for Stop before save versus after save starts, double run, cancelled late result, ordered draft saves, exit failure, and proposal generation locks.
- [x] Implement operation ownership and feature hooks; use current editable snapshots, scoped reads, retained failed-save candidates, and navigation guards.
- [x] Run focused tests and the entire suite; expect passing tests with no unhandled rejection.

## Task 3: Accessible four-screen UI and native routes

**Files:** `src/constants/theme.ts`, `src/components/ui/*`, `src/screens/*`, thin routes under `src/app/`, feature editors/cards, `tests/screens.test.tsx`, `app.json`.

**Interfaces:** Non-scrolling `Screen` contains each screen's own FlatList/ScrollView; shared labeled fields, buttons, badges, evidence, operation/error panels. Native dashboard, workspace, request and proposal routes use the scoped feature hooks. Web siblings redirect project routes to the placeholder.

- [x] Write failing interaction tests for manual project/scope flow, no-model manual editing, saved agreement immutability, proposal save/copy, invalid routes and fixture labeling. Test behavior, not style snapshots.
- [x] Implement Mint Slate shared screens, loading/empty/error states, explicit confirmation, selection, editable proposal, keyboard dismissal, screen-reader announcements and development failure controls.
- [x] Set dark app/status bar; retire the starter. Run interaction tests, full tests, lint and type checking.

## Task 4: Integration review and local testing handoff

**Files:** `README.md`, `FRONTEND.md`, `AGENTS.md` baseline notes, `.github/workflows/ci.yml`, `docs/superpowers/plans/2026-10-09-saklaw-mobile-frontend.md`.

- [x] Align documentation with actual behavior and approved theme; add the test command to CI.
- [x] Run `npm test -- --runInBand`, `npx expo lint`, `npx tsc --noEmit`, `npx expo install --check`, `npx expo-doctor`, web export and native Metro exports.
- [ ] Request an independent review using Superpowers' code-review skill; fix material findings and rerun affected checks.
- [x] Record exact native-device limitations and commands for user testing. Leave changes local on `pandesal-branch` for user review.

## Execution notes

- Ruling: use the existing feature branch with the user's reviewed uncommitted spec/config changes; a new worktree would omit that working state. No Git publication or automatic merge.
- Ruling: execute the approved design directly with a short plan and native execution, followed by a fresh reviewer; the user explicitly requested implementation now and will review/test the completed work.
- Baseline: lint/type checking passed before this implementation; only the placeholder screen existed.
- Documentation verified before implementation: Expo SDK 57 reference, Expo LLM index corrections, routing/stack, Clipboard and testing guides; React Native 0.86 keyboard and accessibility documentation.

### Second session (screens, routes, docs)

- Result: Tasks 1–3 complete; Task 4 complete except the independent review, which has
  not been run. Final checks on the working tree: `npm test -- --runInBand` 50/50 in 5
  suites; `npm run lint` clean; `npm run typecheck` clean; `npm run check:dependencies`
  up to date; `npx expo-doctor` 21/21; `npm run build:web` exported with no mobile
  services in the web bundle; `npx expo export --platform android` bundled.
- Visual check: the four screens were rendered through React Native Web at 400 × 860 and
  820 × 1100 in headless Chromium using a temporary route, since no device or emulator was
  available. That route is deleted. This is not native or device verification.
- Ruling: no commits — the user has not asked for one and the handoff says to leave the
  work local for review. Cost if wrong: one commit to make later.
- Ruling: ledger kept in this file, not `.superpowers/` — that directory is not
  git-ignored here and would add untracked files. Cost if wrong: none.
- Ruling: `Icon` imports Lucide from the package root, not `/static` as the pending test
  mocked — the root import also runs in Expo Go; `/static` needs a native build. Cost if
  wrong: the icon font ships twice in native builds (about 815 KB) until switched.
- Ruling: `src/screens/HomeScreen.tsx` left in place, unused, though the spec says delete —
  `origin/main` rewrote that file, so deleting it here would create a modify/delete
  conflict in the coming merge. Cost if wrong: one unused file.
- Ruling: draft fields are not locked during a save triggered by leaving a field — locking
  drops keyboard focus from the field just entered. Edits made during that save window are
  still ignored by `useWorkspace`; with in-memory fixtures the window is negligible, with
  real SQLite it needs a device check. Cost if wrong: a dropped keystroke while a blur
  save is in flight.
- Ruling: a failed operation shows one recovery action, not two — where the screen's own
  action button already retries (Extract scope, Analyze request, Save draft, Confirm), the
  error panel adds no second button. Cost if wrong: one extra tap target to restore.
- Ruling: `app.json` `userInterfaceStyle` set to `dark` without adding `expo-system-ui` —
  the app paints its own colors; only system surfaces such as alerts may follow the device
  theme on Android. Cost if wrong: one dependency to add after discussion.
- Ruling: lint errors in the existing hooks fixed by deriving loading state from a load key
  and mirroring a ref into state, instead of disabling the rules. Cost if wrong: none found;
  all prior hook tests still pass.
- Note: the exit-guard tests and the later screen tests were written against existing
  behavior, so they were not seen failing first. Two were mutation-checked (checkbox on
  every finding; evidence IDs unchecked) and failed as expected.
- Open: `origin/main` now has backend services whose types differ from `src/types/domain.ts`
  and whose files collide with `src/types/domain.ts`, `src/services/index.ts`,
  `package.json`, and the lockfile. Reconcile before merging.
