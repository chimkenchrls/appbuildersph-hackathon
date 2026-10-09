# Saklaw integration audit and Android test checklist

Follow-up: [2026-10-10 persistence repairs](./PERSISTENCE-REPAIR-2026-10-10.md) address atomic saves, backup integrity, whole days, new aggregate classifications, and startup safety. Findings below describe the original audit state.

Date: 2026-10-09. Reviewed source: `pandesal-branch`, `10f3053`.
Scope: automated baseline, persistence and AI integration review, device test preparation.
Application source, dependencies, configuration, and Git history were not changed.
No push, merge, EAS build, or device test was performed.

## Fresh verification

Environment: Node `v26.10.0`; installed dependencies, not a fresh `npm ci` installation.
CI uses Node 22, so this run does not establish CI-environment equivalence.

| Command | Observed result | What it proves |
| --- | --- | --- |
| `npm test -- --runInBand` | 63 tests passed, seven suites, none skipped | Existing automated expectations pass; engine responses are faked. |
| `npx expo lint` | Exit 0 | Source lint passes. |
| `npx tsc --noEmit` | Exit 0 | Strict TypeScript check passes. |
| `npx expo install --check` | Exit 0, dependencies up to date on online retry | Installed SDK dependency compatibility check passes. |
| `npx expo-doctor` | 21/21 passed on network-enabled retry | Doctor configuration/dependency checks pass. |
| `npm run build:web` | Exit 0; export in `dist/` | Web placeholder bundles. |
| `npx expo export --platform android --output-dir /tmp/saklaw-audit-android` | Exit 0; Android bundle exported | Android JavaScript/assets bundle; not a native build or APK. |

The first dependency check used the local SDK map with an offline reliability warning.
The first Doctor attempt failed resolving `registry.npmjs.org`. Both were retried
with network access; the successful results above are from those retries.

`tests/backendSqlite.test.ts` executed both tests using Node SQLite and a small
Expo API shim. It covers successful persistence and seeded history, but not
actual `expo-sqlite`, disk-backed relaunch, transaction concurrency, rollback
under failure, or native inference. Screen/hook tests use labeled fixture services.

## Findings and repair order

### 1. Agreement confirmation can commit and still report failure

`src/services/backend/backendData.ts`, `confirmScope`, commits through the vault,
then clears the settings draft and updates the project in separate writes.
`AgreementRepository.create` correctly groups the agreement and requirements,
but its transaction ends before those remaining writes.

Reproduced with real repositories over Node SQLite: inject a settings write error
after saving a valid draft; confirmation rejects with `save_failed`, yet Agreement v1
exists. Repeating confirmation rejects again. The UI offers a retry for an operation
that has already committed. Analysis and proposal saves likewise separate their main
writes from the project timestamp update; analysis additionally separates request
creation from analysis creation.

Required invariant: the UI result must match committed state. Put the related writes
and confirmation guard in a short transaction owned by the persistence/application
layer, with a defined safe retry result. Account for the existing repository transaction
when choosing transaction ownership; do not simply nest transactions. Add failure
injection and duplicate-confirmation tests before changing implementation.

### 2. Inference serialization has an asynchronous race

`src/services/backend/backendAi.ts:50` checks `running` before awaiting `getPorts`,
then increments it afterward. Two calls entering together both pass the guard.
Reproduced by starting two `analyzeRequest` calls in the same tick with a deferred
engine: both invoked `engine.generate` before either completed. Existing tests cover
a second call after the first is already busy, which misses this window.

Required invariant: reserve one generation slot before asynchronous initialization;
release it on every terminal path. Keep this ownership in the adapter/scheduler,
independent of individual screen operation guards. This is especially important
before integrating a native engine with shared memory and model state.

### 3. Backup restoration lacks validation and atomicity

`src/services/exportService.ts:17` accepts arbitrary agreement/request/analysis/proposal
arrays with `z.any()` and restores records sequentially. Reproduced using a backup
containing `agreements: [null]`: the schema accepts it, a project is inserted, then
restoration throws a `TypeError`. The project remains in SQLite.

Restore also skips existing IDs without comparing their contents or ownership.
Foreign keys ensure referenced rows exist, but do not ensure all references belong
to the imported project and exact agreement. Project creation replaces exported
timestamps with current timestamps. Export omits unconfirmed scope drafts stored
in `app_settings`. These services are not exposed by the current four-screen workflow.

Before exposing restore, define a versioned, bounded schema; validate the complete
record graph and ID conflicts before writing; restore atomically; preserve record
timestamps and scope drafts. Test malformed, truncated, conflicting, cross-project,
and mid-restore failure cases. A transaction alone does not validate imported data.

### 4. Domain rules differ from the backend requirements

`BACKEND.md:56` requires integer minor-unit money and integer working days;
`BACKEND.md:278` gives clarification precedence over additional work. Current behavior:

- Money stays in main-unit numbers and SQLite `REAL`. Any migration must explicitly
  convert existing amounts; changing labels/types alone risks a 100-fold error.
- `parseEstimate('1.5')` returns `1.5`; proposal days use that parser and the same
  finite-number guard as money. SQLite `INTEGER` affinity alone does not enforce integers.
- `toBackendAnalysisFields` returns `potential_additional` for findings containing
  both `needs_clarification` and `potential_additional`; reproduced directly.
- Proposal generation checks only that the resulting text is nonempty and bounded.
  Estimates enter the prompt, but application code does not ensure the message keeps
  those estimates. The existing test accepts a message that omits them entirely.

The older backend design spec explicitly uses `REAL` money, while `BACKEND.md`
requires minor units. Align the documents and implementation around the agreed domain
rules before a data migration. Generated-message estimates need a reliable application
boundary; model instructions alone cannot enforce them.

### 5. Release readiness and documentation still need correction

Bootstrap always instantiates `LMStudioAdapter`, which calls HTTP, and seeds an
unlabeled demo into normal SQLite mode. Stop rejects the UI caller while HTTP work
continues. No installed native inference binding or bundled model is configured.
`AppServices.llmEngine` is typed as the concrete HTTP adapter rather than `LLMEngine`.

`README.md` and `BACKEND.md` overstate offline/on-device verification and legal
compliance. Template generation is not proof of legal compliance. This audit records
actual status; it does not certify those claims. The previous handoff's 50-test count
and uncommitted-backend status are historical and superseded here.

## Proposed AI integration contract — pending teammate agreement

No teammate has been contacted and no engine/model decision has been made here.
Use the existing `SaklawAi`/`LLMEngine` seams; avoid redesigning screens for one engine.

| Boundary | Required behavior for integration |
| --- | --- |
| Readiness | Map to existing `loading`, `ready`, `busy`, `unavailable`; ready means usable local model. Failed/missing model leaves manual scope and proposal editing available. |
| Generation ownership | One shared slot reserved before any await. Duplicate submissions do not start a second native generation. |
| Stop | Propagate cancellation into native work; emit one terminal result; retain inputs; never save a late cancelled result. Remain busy until native work releases its slot. |
| Background/unmount | Cancel owned inference on background/unmount; define when the model unloads and how foreground recovery checks readiness. |
| Validation/persistence | Adapter returns data; workflows validate shape, evidence and agreement binding before saving. No database writes from native engine callbacks. |
| Resource/error handling | Team records model/binding/license, packaged or local-import first launch, context/output limits, device baseline, memory budget, and cancellation target. No HTTP fallback in offline release. |

Add a focused fake-engine contract test for simultaneous start, Stop/late completion,
initialization failure, malformed output, and background interruption. Measure real
cancellation and resources on devices rather than inferring them from fake-engine tests.

## Android build preparation

Current `app.json` has no `android.package`, `ios.bundleIdentifier`, or EAS project ID.
Team-owned identifiers, Expo project/account access and signing credentials are still
needed. Preserve signing identity across upgrades; never invent identifiers or commit
credentials. EAS development profile exists; preview/apk profiles produce APKs.
Neither `adb` nor `emulator` is available on this host's PATH; no physical device
was supplied. No build was requested or submitted during this audit.

After identifiers and native engine/config are ready, follow the installed SDK docs
and AGENTS.md to create an Android development build and install it. Use development
builds for UI integration. Then create a standalone preview/release APK for acceptance.
Record app version, version code, source commit, build profile, fixture flag, engine/model
revision, artifact link, Android version and device model with every test pass.

## Device test checklist — all pending

Use a disposable test project with five pages and a contact form, PHP 15,000,
two weeks and two revision rounds. Use prepared outputs only in visibly labeled
fixture mode. Run persistence checks again with fixtures disabled and real SQLite.

| Check | Steps and acceptance |
| --- | --- |
| Manual flow without AI | With no usable model, create project → enter manual scope → save/reopen draft → confirm v1. No crash or forced AI setup; absent terms remain absent. |
| Extraction/review | Paste conversation → extract → correct rows/terms → save → confirm. Returned text is reviewed, not silently confirmed; stored v1 matches reviewed fields. |
| Confirmation integrity | Rapidly confirm twice; interrupt during save; relaunch. Exactly one complete v1, no misleading retry or incomplete snapshot; future edits cannot mutate it. |
| Request and evidence | Analyze mixed included/additional/ambiguous requests. Evidence opens the exact stored requirement/version; unknown citations fail validation; ambiguous findings remain unresolved. |
| Proposal | Select additional finding → enter PHP 7,000 and five working days → generate → review/edit → save/reopen → copy. Values persist; copied text matches editor; no sent status or agreement mutation. Check blank vs zero and invalid decimal days. |
| Navigation/save windows | Edit then blur/back while SQLite save is delayed; verify no lost keystrokes. Exercise hardware Back, route changes, retry after save failure, and discard prompts. |
| Cancellation/lifecycle | Stop immediately, repeat Send/Stop, navigate away, background/foreground and terminate mid-generation. Inputs retained, cancelled output never saved, no concurrent generation, actionable recovery. |
| Disk-backed persistence | Force-stop and reopen with fixtures disabled. Draft, agreement, analyses, edited deliverables, estimates and message remain bound to the right project. |
| Native UI/accessibility | Small phone, keyboard overlap/dismissal, safe areas, rotation, large system fonts, TalkBack labels/focus, touch targets, clipboard success/failure and Lucide icons. |
| Offline standalone APK | Fresh install in airplane mode; no Metro/Expo Go. First launch, local model setup, complete workflow and relaunch succeed. Inspect attempted network activity separately from airplane-mode success. Current HTTP engine cannot pass this gate. |
| Upgrade/data safety | Install previous signed APK, create records, upgrade with same package/key and higher version code; verify migrated records and immutable agreement. Never uninstall to simulate an upgrade. |
| Model/resources | Missing/corrupt model, unavailable local import bytes, low storage, repeated generation and background interruption. Record cold/warm load, first-token latency, throughput, peak memory, thermal behavior and Stop latency against team-defined thresholds. |

When iOS builds/devices are available, repeat shared flow, keyboard, safe areas,
clipboard, VoiceOver, large text and guarded back gestures on iPhone. Check iPad
landscape, full screen and narrow multitasking layouts. All native iOS checks remain
unverified; Android standalone APK acceptance remains the release gate.

## Review artifacts and boundaries

Reproduction probes ran against application TypeScript and real repositories through
a Node SQLite shim, using injected failures and a deferred fake engine. Temporary
script: `/tmp/saklaw-integration-probes.cjs`; run from repository root with
`node /tmp/saklaw-integration-probes.cjs`. It asserts the observed defects, not their
desired fixed behavior; it is not part of the committed regression suite.

The pre-existing deletion of the tracked LibreOffice lock file
`docs/superpowers/specs/.~lock.2026-10-09-saklaw-mobile-frontend-design.md#` was untouched.
No code fixes, data migrations, independent review, legal review, build signing,
device testing, or offline release acceptance are claimed.
