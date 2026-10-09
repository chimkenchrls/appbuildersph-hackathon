# Saklaw Frontend Implementation Handoff

**Date:** 2026-10-09
**Status:** The four screens run on labeled fixtures. Not committed, not merged, not verified on a device.
**Working branch:** `pandesal-branch`
**Plan:** [2026-10-09 mobile frontend implementation plan](./plans/2026-10-09-saklaw-mobile-frontend.md)
**Design specification:** [Saklaw mobile frontend design](./specs/2026-10-09-saklaw-mobile-frontend-design.md)

## Instructions for the next agent

Everything is uncommitted on `pandesal-branch`. Do not push, merge to `main`, deploy, or
reset the checkout; the front-end owner reviews and tests first. Use the design
specification as the product authority. Fixtures stay labeled, and the app must not be
connected to the development FastAPI/LM Studio server.

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

## Next steps

1. **Reconcile with `origin/main` before merging.** It now contains the backend workflow's
   SQLite repositories, services, and types. Its files collide with `src/types/domain.ts`,
   `src/services/index.ts`, `package.json`, and the lockfile, and its shapes differ
   (requirement IDs `REQ-01` here `R1`; proposal status `draft | copied | sent` here
   `draft`; separate `ClientRequest` and `ScopeGuardAnalysis` here one `Analysis`). The
   screens depend only on `SaklawData` and `SaklawAi` in `src/services/contracts.ts`, so
   the expected route is an adapter over the backend services behind those two interfaces.
2. **Device pass** on a development build, using the list in `FRONTEND.md` section 11. A new
   build is required: `expo-clipboard` and the Lucide icon plugin are native additions.
3. **Independent review** of the full diff.
4. Check the blur-save window on real SQLite: `useWorkspace` ignores edits while a save is
   in flight (see the plan's execution notes).

## Decisions made during implementation

Listed with their costs in the plan's "Second session" execution notes.
