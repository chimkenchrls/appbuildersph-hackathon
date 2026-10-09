# Saklaw mobile front-end — design spec

- **Date:** 2026-10-09
- **Owner:** front-end workflow (pandesal-branch)
- **Status:** awaiting review. Nothing in this document is implemented yet.
- **Implementation review:** the five safeguards from the 2026-10-09 review are specified
  below; application code and the pending visual decisions are unchanged.
- **Reads with:** `FRONTEND.md`, `PROJECT.md`, `ARCHITECTURE.md`, `AGENTS.md`. Where this spec
  and `FRONTEND.md` disagree, section 2 lists the difference and `FRONTEND.md` must be
  updated to match before screens are built.

## 1. Goal and scope

Build a shared React Native UI for Android and iOS for Saklaw's one MVP flow:

**Create project → Paste conversation → Extract and review scope → Confirm Agreement v1 →
Analyze a new request → Review evidence → Edit, save, and copy a change proposal.**

The same four screens, theme, service contracts, and editing safeguards apply on both
platforms. Android remains the primary release target, delivered as an APK. iOS is a
secondary native target with explicit UI requirements below, not a separate design or
the web placeholder. Preserve iPhone layouts and adaptive iPad layouts because the current
`app.json` enables tablet support. UI compatibility alone does not establish that the
native inference engine or an installable iOS build works; verify those separately.

The team has four parallel workflows: front-end, backend (SQLite), local AI, and
deployment. The front-end is built against typed contracts with labeled fixture data, so
it does not wait on the other three. Teammates replace the fixtures behind the same
contracts.

**In scope**

- Shared domain types and the two service contracts (section 3).
- Fixture implementations of both contracts, and the workflow glue between them.
- Theme tokens, shared UI components, and the four screens with all their states.
- A minimal web placeholder at `/`, and redirects from the project routes, so the CI web
  export keeps passing.

**Out of scope**

- Real SQLite repositories and migrations (backend workflow).
- Native inference, model loading, and structured-output parsing (local-AI workflow).
- EAS builds, signing, and APK distribution (deployment workflow).
- The web landing page. It gets its own spec once the app has real screenshots and an APK link.
- Everything `FRONTEND.md` section 2 excludes from the MVP.

**Time budget:** 14 hours remained when this was written. Section 12 gives the order.

## 2. Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Build order | Contract first, then screens in demo order | Teammates build to the same shapes from hour 1; if time runs out, the front of the flow works. |
| Contract split | Two interfaces: `SaklawData` (backend) and `SaklawAi` (local AI) | One file per teammate to implement. |
| Native platforms | Shared Android and iOS screens; Android APK is the release priority | Keep product behavior consistent while adapting safe areas, keyboard behavior, accessibility, and navigation to each platform. |
| Theme | Mint Slate, dark only | Chosen by the front-end owner. Closest of the three candidates to the previously agreed teal. |
| Fonts | System sans-serif for reading; system monospace for IDs, versions, and badges | Keeps the Mint Slate character with no bundled font files. |
| Corners | Radius 0 everywhere | Matches the theme. |
| Icons | `@react-native-vector-icons/lucide` behind an `Icon` wrapper | Expo's icon guide marks `@expo/vector-icons` as not recommended and points to this family. |
| Clipboard | `expo-clipboard` | React Native has no built-in clipboard API. |
| Motion | Press feedback only (Android ripple, opacity on iOS) | No animation library; inference progress never depends on animation. |
| Workspace | One screen that changes by stage (no scope, draft, confirmed) | Keeps the four-route map in `FRONTEND.md`. |
| Saved analyses | Same ScopeGuard route with `?analysisId=` | No new route. |
| Unit tests | `jest-expo` as a dev dependency | Expo's documented test setup; dev-only, so it does not reach the APK. |

**Changes to earlier agreements.** These differ from the current `FRONTEND.md` and need the
project owner's awareness:

1. Section 1 "Visual direction" and section 6 token table: light surfaces with deep teal
   become Mint Slate dark (section 6 of this spec).
2. Section 6 "Retain the current light-mode baseline": becomes dark only. Still one theme,
   no toggle.
3. Section 6 "modest 8–12-unit corners": becomes radius 0.
4. `app.json` `userInterfaceStyle`: `light` becomes `dark`; the status bar style becomes `light`.

**Already installed on this branch (uncommitted):** `expo-clipboard ~57.0.2`,
`@react-native-vector-icons/lucide ^13.1.4`, and the Lucide config plugin that
`npx expo install` added to `app.json`. Lint, type check, `expo install --check`,
`expo-doctor` (21/21), and the web export all passed afterwards. Both packages add native
code or assets, so every teammate on a development client needs a new build after pulling.

## 3. The contract

### 3.1 Domain types — `src/types/domain.ts`

Vocabulary follows `PROJECT.md` section 9. Timestamps are ISO 8601 strings. `null` means
"not specified" and is never treated as zero.

```ts
export type ScopeStatus = 'none' | 'draft' | 'confirmed';
export type Classification = 'included' | 'potential_additional' | 'needs_clarification';
export type AiStatus = 'unavailable' | 'loading' | 'ready' | 'busy';

export interface Project {
  id: string;
  name: string;
  scopeStatus: ScopeStatus;
  agreementVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScopeTerms {
  budgetAmount: number | null;
  currency: string;            // 'PHP' by default; recorded user data
  timeline: string | null;     // free text, e.g. "two weeks"
  revisionTerms: string | null;
}

export interface DraftItem { key: string; text: string }   // key is a local list key

export interface ScopeDraft {
  projectId: string;
  sourceText: string;          // pasted conversation; '' for manual entry
  origin: 'extracted' | 'manual';
  deliverables: DraftItem[];
  exclusions: DraftItem[];
  terms: ScopeTerms;
  missingInformation: string[];
  updatedAt: string;
}

export interface ExtractedScope {                          // what the AI returns
  deliverables: string[];
  exclusions: string[];
  terms: ScopeTerms;
  missingInformation: string[];
}

export interface Requirement {
  id: string;                  // stable within an agreement: 'R1', 'R2', ...
  kind: 'deliverable' | 'exclusion';
  text: string;
}

export interface Agreement {
  id: string;
  projectId: string;
  version: number;             // 1 for the MVP
  requirements: Requirement[];
  terms: ScopeTerms;
  confirmedAt: string;
}

export interface Finding {
  id: string;
  requestedItem: string;
  classification: Classification;
  explanation: string;
  evidenceRequirementIds: string[];
  clarificationQuestions: string[];
}

export interface Analysis {
  id: string;
  projectId: string;
  agreementId: string;
  agreementVersion: number;
  requestText: string;
  findings: Finding[];
  createdAt: string;
}
export type NewAnalysis = Omit<Analysis, 'id' | 'createdAt'>;

export interface Proposal {
  id: string;
  projectId: string;
  analysisId: string;
  deliverables: string[];
  feeAmount: number | null;
  currency: string;
  extraWorkingDays: number | null;
  message: string;
  status: 'draft';
  createdAt: string;
  updatedAt: string;
}

export interface ProposalInput {
  agreement: Agreement;
  requestText: string;
  deliverables: string[];
  feeAmount: number | null;
  currency: string;
  extraWorkingDays: number | null;
}
```

### 3.2 Service contracts — `src/services/contracts.ts`

```ts
export interface SaklawData {                 // backend workflow → SQLite
  listProjects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  getProject(id: string): Promise<Project | null>;

  getDraft(projectId: string): Promise<ScopeDraft | null>;
  saveDraft(draft: ScopeDraft): Promise<void>;
  confirmScope(projectId: string, draft: ScopeDraft): Promise<Agreement>;
  getAgreement(projectId: string): Promise<Agreement | null>;

  saveAnalysis(analysis: NewAnalysis): Promise<Analysis>;
  listAnalyses(projectId: string): Promise<Analysis[]>;
  getAnalysis(projectId: string, id: string): Promise<Analysis | null>;

  createProposal(projectId: string, analysisId: string, deliverables: string[]): Promise<Proposal>;
  getProposal(projectId: string, id: string): Promise<Proposal | null>;
  saveProposal(proposal: Proposal): Promise<Proposal>;
  listProposals(projectId: string): Promise<Proposal[]>;
}

export interface SaklawAi {                   // local-AI workflow → on-device model
  getStatus(): AiStatus;
  subscribe(listener: (status: AiStatus) => void): () => void;
  extractScope(sourceText: string, signal: AbortSignal): Promise<ExtractedScope>;
  analyzeRequest(agreement: Agreement, requestText: string, signal: AbortSignal): Promise<Finding[]>;
  draftProposalMessage(input: ProposalInput, signal: AbortSignal): Promise<string>;
}
```

**Rules both implementations must follow**

- `confirmScope` assigns requirement IDs `R1…Rn` in order, deliverables first, then
  exclusions. It rejects when an agreement already exists for the project. Agreement v1 is
  never modified afterwards.
- `confirmScope` sets the project's `scopeStatus` to `confirmed`; `saveDraft` sets it to
  `draft` when it was `none`. `saveDraft` rejects once the project is confirmed, so a late
  draft save cannot modify that stage.
- Reads of analyses and proposals are scoped to `projectId`; an existing record from a
  different project returns `null`, just like a missing record. Do not expose its content
  before checking the relationship.
- Writes validate relationships against stored records, not just the supplied object:
  draft and confirmation project IDs must agree; an analysis must reference an agreement
  belonging to its project with the exact stored ID and version; a proposal must reference
  an analysis belonging to its project and that analysis's valid agreement. A mismatch
  rejects with `not_found` before any write. `saveProposal` cannot change the stored
  proposal's project or analysis relationship.
- Confirmation and saves complete atomically, including relationship checks and project
  status changes. Resolve only after a successful commit; reject without partial writes.
  Fixture implementations enforce the same rules as SQLite implementations.
- AI methods reject with `cancelled` when the signal aborts, and resolve only with complete,
  schema-valid output. They never write to storage.
- `draftProposalMessage` must carry the given fee and days through unchanged, and must not
  introduce amounts or dates of its own.

### 3.3 Errors — `src/services/errors.ts`

```ts
export type ServiceErrorCode =
  | 'model_unavailable' | 'invalid_output' | 'cancelled' | 'save_failed' | 'not_found';

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode, message?: string) { super(message ?? code); }
}
```

Any other thrown value is treated as `invalid_output` for AI calls and `save_failed` for
data calls. Messages are for logs; the UI maps codes to its own copy (section 8).

### 3.4 The swap — `src/services/index.ts`

Exports the active `data: SaklawData` and `ai: SaklawAi`, plus `isFixtureData` and
`isFixtureAi` booleans. Each teammate replaces one import when theirs is ready. While
either flag is true the app shows a "Demo data" label (section 7), satisfying the rule
that fixtures are visibly identified.

On web, `index.ts` is not imported at all (section 5), so no native binding loads.

## 4. Front-end owned logic

### 4.1 Fixtures — `src/services/fixtures/`

- `fixtureData.ts`: in-memory `SaklawData`. Seeded with one project from the `PROJECT.md`
  scenario (five responsive pages, contact form, PHP 15,000, two weeks, two revision rounds)
  so the dashboard is not empty on first run. Data resets when the app restarts; that is
  expected for fixtures and is why the label exists.
- `fixtureAi.ts`: `SaklawAi` returning prepared outputs for the scenario after a 1.5–3 s
  delay, honoring the abort signal. The accounts-and-booking request returns mixed
  findings covering all three classifications.
- `fixtureControls.ts`: development-only switches to force each failure: AI unavailable,
  invalid output, slow generation, save failure. Used to design and verify every state in
  section 8. Not reachable in a release build (`__DEV__` guard).

### 4.2 Workflows — `src/services/workflows.ts`

Plain TypeScript, no React, taking `data` and `ai` as arguments so tests can pass fakes.

| Function | Does |
| --- | --- |
| `extractDraft(projectId, sourceText, signal)` | Calls `ai.extractScope`, converts to a validated `ScopeDraft` with `origin: 'extracted'`, and returns the candidate. Never saves or replaces an existing draft. `useWorkspace` applies an authorized replacement and saves through the guarded operation in section 4.5. |
| `confirmDraft(projectId, draft)` | Validates the draft has at least one non-empty deliverable, strips empty rows, calls `data.confirmScope`. |
| `analyzeRequest(projectId, requestText, signal)` | Loads the project's agreement, calls `ai.analyzeRequest`, runs `validateFindings`, and returns a validated `NewAnalysis` candidate without writing. `useRequestAnalysis` retains it and calls `beginSave()` immediately before `data.saveAnalysis` under section 4.5. |
| `startProposal(projectId, analysisId, selectedFindingIds)` | Reloads the analysis using the scoped lookup, validates its agreement, and resolves every selected ID against its stored findings. Rejects an empty, unknown, or non-`potential_additional` selection. Calls `data.createProposal(projectId, analysisId, selectedItemsText)`. |
| `generateMessage(proposal, signal)` | Validates the proposal's stored project/analysis relationship and the analysis's exact agreement. Builds `ProposalInput` using those records and a snapshot of the current edited deliverables and estimates, then calls `ai.draftProposalMessage`. Returns text; never saves. |

### 4.3 Validation — `src/safety/`

- `validateFindings(findings, agreement)`: every `evidenceRequirementIds` entry must match
  a requirement in that agreement; an `included` finding must cite at least one. A failure
  throws `ServiceError('invalid_output')`. `potential_additional` may cite zero
  requirements, because absence from the scope is not an exclusion.
- `parseEstimate(text)`: blank returns `null`; otherwise a non-negative finite number, or a
  validation message. Used for fee and working days.

### 4.4 Hooks — `src/features/*/` and `src/hooks/`

| Hook | Returns |
| --- | --- |
| `useAiStatus()` | Current `AiStatus`, subscribed and cleaned up on unmount. |
| `useOperation(fn)` | `{ status: 'idle' \| 'running' \| 'saving' \| 'succeeded' \| 'failed' \| 'cancelled', error, run, cancel }`. Supplies `signal` and `beginSave: () => void` to `fn`. Owns the `AbortController` and operation ID; ignores stale UI callbacks and blocks another run until the active operation settles. Cancellation and persistence follow section 4.5. |
| `useProjects()` | List, loading and error state, `create(name)`, `reload()`. |
| `useWorkspace(projectId)` | Project, draft, agreement, analyses, proposals; `dirty`, `saveDraft`, `extract`, `confirm`. Holds editable state, serializes blur saves, and awaits a successful save before leaving. Failed saves retain edits and keep the route mounted (section 4.5). |
| `useRequestAnalysis(projectId, analysisId?)` | Agreement, request text, saved analysis or unsaved validated candidate, selection set, `analyze`, `retrySave`, `startProposal`. Retains the candidate until persistence succeeds; only a saved analysis can start a proposal. |
| `useProposal(projectId, proposalId)` | Proposal form state, `dirty` flag, `save`, `generate`, `copy`; loads the proposal within the route's project. |

Screens call hooks only. They never import `services/index.ts` directly.

### 4.5 Save, edit, and cancellation boundaries

**Workspace saves and navigation**

- Save immutable snapshots of the draft. Allow at most one save at a time and coalesce
  later edits into the next snapshot. A completed older save must not clear `dirty` for
  newer edits. Confirmation waits for pending saves and uses the current reviewed draft;
  no queued draft save may run after confirmation.
- Intercept header Back, Android hardware Back, iOS back gestures, and other route exits
  before unmounting. Finish or cancel the active generation, flush any pending blur save,
  then await saving the latest draft before replaying the navigation action once. Lock
  edits while completing this exit save. Do not rely on an unmount cleanup to save data.
- If the exit save fails, keep the screen, edits, and unsaved indicator intact. Offer
  **Retry save and leave**, **Keep editing**, or an explicit **Discard unsaved changes**.
  Discard abandons only edits not already saved. Never navigate on a failed save without
  that discard choice. A conversation not yet extracted also needs an explicit discard
  choice before leaving; it must not disappear silently.

**Generation and edit ownership**

- Generation uses an immutable snapshot of its inputs. For proposal generation, keep
  deliverables, fee, currency, days, and message visible but read-only until the operation
  settles. Disable Save and another Generate during this time; Stop remains available.
  Copy may still copy the current visible message. This prevents changes made during
  inference from being overwritten by a result based on older inputs.
- Obtain replacement consent before starting generation when a proposal message has
  manual edits or extraction would replace an edited scope draft. Lock the affected
  fields while running. Keep existing values until a complete valid result is available;
  cancellation or generation failure leaves them unchanged. A proposal result only marks
  the form dirty; Save remains a separate action.
- Before extraction or confirmation, drain pending draft saves and block new blur saves
  for the locked fields. Candidate saves use the same serialized writer, so an older
  snapshot cannot overwrite the accepted replacement.
- Extraction returns a candidate without side effects. After checking the operation is
  still active, `useWorkspace` calls `beginSave()`, installs the authorized candidate in
  editable state, and immediately calls `data.saveDraft(candidate)`. A save failure retains
  that candidate with an unsaved indicator and retries saving it without rerunning AI.
- Keep the request field read-only during analysis and its save. The displayed request,
  findings, and persisted analysis must all refer to the same captured request text.
  `useRequestAnalysis` retains the validated candidate, calls `beginSave()`, and immediately
  invokes `data.saveAnalysis(candidate)`. Editing the request after a save failure clears
  that unsaved candidate and its findings before another analysis; Retry save otherwise
  uses the original snapshot.

**Cancellation and the save boundary**

- Before saving starts, check cancellation after every awaited step and before applying
  a generated result.
  `beginSave()` synchronously checks both the signal and active operation ID, rejects
  stale/cancelled work, and changes the operation to `saving`. Invoke the data write
  immediately afterwards with no intervening await. Workflows must enforce this boundary;
  ignoring a late result in the hook alone does not prevent a late write.
- Before `beginSave()`, Stop aborts the operation and prevents its candidate/result from
  being applied or saved. Keep duplicate submissions blocked until cancellation settles;
  the AI adapter must finish native cancellation before releasing inference ownership.
- Once `beginSave()` succeeds, the write is no longer cancellable. Show **Saving…** with
  no Stop action, wait for success or failure, and defer navigation until it settles.
  Do not report a committed write as cancelled or attempt to undo it on navigation.
  Direct saves and confirmation use the same non-cancellable saving phase.
- A failed persistence step offers **Retry save** using the retained validated snapshot;
  do not rerun extraction or analysis just to retry saving. After success, reuse the
  returned record rather than writing it again. Late UI callbacks after unmount remain
  ignored, but this does not imply that an already-started save was cancelled.

## 5. Routes

| Route | File | Screen |
| --- | --- | --- |
| `/` | `src/app/index.tsx` | `RootScreen`: the dashboard on native, the landing placeholder on web. |
| `/project/[projectId]` | `src/app/project/[projectId]/index.tsx` | `WorkspaceScreen` |
| `/project/[projectId]/request` | `src/app/project/[projectId]/request.tsx` | `ScopeGuardScreen` (optional `?analysisId=`) |
| `/project/[projectId]/proposal/[proposalId]` | `src/app/project/[projectId]/proposal/[proposalId].tsx` | `ProposalScreen` |

Route files stay thin: read params, validate them (one non-empty string of the expected
shape; reject arrays), and render the screen. Hooks and services then load records scoped
to the route's `projectId`. Check `analysis.projectId` and `proposal.projectId` against
that project, load a proposal's analysis in the same project, and verify the analysis's
agreement ID and version against the stored agreement before rendering or running AI.
For the MVP, `getAgreement(projectId)` returns Agreement v1; it must match the saved
analysis exactly, never silently substitute another agreement. Revalidate relationships
at write time under section 3.2. Invalid, unknown, or mismatched records render the same
Missing-record state, without displaying unrelated content; return to the project if it
exists, otherwise Projects. The root layout keeps the single `Stack` with headers hidden;
each screen draws its own header inside `Screen`.

**Web.** Platform differences stay out of `src/app/`, as `FRONTEND.md` requires. Each
screen has a `.web.tsx` sibling in `src/screens/`: `RootScreen.web.tsx` renders the
placeholder, and the three project screens' web siblings redirect to `/`. The web bundle
therefore never imports `services/index.ts`, so swapping in native-only services later
cannot break the web export.

## 6. Theme — `src/constants/theme.ts`

Colors were sampled from the theme screenshot and are approximate; correcting them is a
one-file change. All pairs were contrast-checked (text ≥ 4.5:1, control outlines ≥ 3:1).

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `background` | `#0E0E11` | App canvas | |
| `surface` | `#121216` | Forms and content blocks | |
| `surfaceRaised` | `#1C1C22` | Bottom action bar, pressed rows, disabled fill | |
| `textPrimary` | `#C9CFCF` | Headings and body | 12.2:1 on background |
| `textSecondary` | `#939E9E` | Supporting text | 7.0:1 on background, 6.2:1 on raised |
| `primary` | `#85ADAD` | Primary actions, focus, confirmed edge | 7.6:1 as text on surface |
| `onPrimary` | `#0E0E11` | Text on primary | 7.9:1 |
| `primaryPressed` | `#6F9595` | Pressed primary | 5.9:1 with `onPrimary` |
| `border` | `#2A2A30` | Decorative separators only | |
| `controlBorder` | `#6E7B7B` | Input outlines, secondary buttons | 4.3:1 on surface |
| `disabledText` | `#6E7B7B` | Disabled labels | |
| `successText` / `successSurface` | `#86D9A0` / `#11261B` | Included in recorded scope | 9.5:1 |
| `warningText` / `warningSurface` | `#F0B866` / `#2B200E` | Potential additional work; unsaved changes | 8.9:1 |
| `infoText` / `infoSurface` | `#8FB4F5` / `#131E36` | Needs clarification | 7.9:1 |
| `errorText` / `errorSurface` | `#F2A0A0` / `#2E1516` | Failed operations, validation errors | 8.4:1 |
| `aiText` / `aiSurface` | `#CDB4DD` / `#36293D` | AI suggestions | 7.3:1 |
| `destructive` / `onDestructive` | `#7A1F1F` / `#FFFFFF` | Discard confirmation | 10.3:1 |

- **Type:** title 28/34, heading 22/28, subheading 18/24, body and inputs 16/24,
  supporting and labels 14/20. Weights 400, 600, 700. Nothing below 14. System font scaling
  stays on.
- **Fonts:** `fontFamily` unset for sans (system default). `mono` is `'monospace'` on
  Android and `'Menlo'` on iOS through `Platform.select`.
- **Spacing:** 4, 8, 12, 16, 24, 32. Screen gutter 16.
- **Shape:** radius 0. Borders, not shadows. The bottom action bar uses a top border.
- **Touch:** minimum 48 × 48.

No hex value appears outside this file.

## 7. Components — `src/components/ui/`

Built when the first screen needs them, in this order.

| Component | Behavior |
| --- | --- |
| `Screen` | Non-scrolling safe-area and keyboard-aware shell with a header (back button, title, right slot), flexible content viewport, and optional bottom action bar. Header and bar sit outside that viewport in the layout, so they do not cover its content. Applies system/keyboard insets once and creates no `ScrollView`. Shows the "Demo data" label in the header right slot while a fixture flag is on. |
| `Button` | `primary` (filled), `secondary` (outlined), `quiet` (text). States: pressed, disabled, busy. Busy keeps the label and adds a spinner at fixed width. `accessibilityState` reflects disabled and busy. Optional leading icon. |
| `TextField` | Persistent label above; optional helper below; error text below replaces helper and is announced. Single-line and multiline (auto-growing, minimum 4 lines). Passes through `keyboardType`. |
| `StatusBadge` | Icon + text + color, monospace. Variants: `included`, `potential_additional`, `needs_clarification`, `draft`, `confirmed`, `unsaved`, `saved`, `ai`, `demo`. Text always carries the meaning. |
| `EvidenceItem` | Collapsed: `R3 · Agreement v1`. Expanded: the stored clause in full, never truncated. `accessibilityState.expanded`. |
| `EmptyState` | One sentence and one action. |
| `InlineError` | Error surface, plain-language message, one or two actions (Retry, Enter manually). `accessibilityLiveRegion="polite"`. |
| `Icon` | Wraps Lucide. Takes a name from a closed union of the icons the app uses, so the set can be swapped in one file. Decorative by default; labeled when it is the only content of a button. |

**Feature components** live with their feature:

- `features/scope/`: `DraftEditor` (editable item lists and terms), `AgreementView`
  (read-only), `ConfirmBar`.
- `features/request/`: `FindingCard`, `AgreementStrip`.
- `features/ai/`: `OperationPanel` (what is running, plus Stop), `AiSuggestionBanner`.

**Four content treatments,** used identically on every screen:

| Kind | Treatment |
| --- | --- |
| Draft (editable) | Input outlines, `draft` badge. |
| Confirmed agreement | Read-only block with a 4-unit `primary` left edge and lock icon; badge "Agreement v1 · Confirmed 9 Oct". No input outlines. |
| AI suggestion | `aiSurface` block, sparkle icon, the line "AI suggestion. Review before using." |
| Saved proposal | Badge "Draft · Saved 14:02", or "Unsaved changes" in the warning style. |

## 8. Screens

Every screen has one owner of vertical scrolling and at most one primary action in the
bottom bar. Form screens put one `ScrollView` in `Screen`'s content viewport; Dashboard
puts its `FlatList` there directly. Never wrap a vertical virtualized list in a vertical
`ScrollView`. Growing history lists must use a virtualized owner too, with surrounding
content in list header/footer slots rather than a nested scroll container.

### 8.1 Dashboard — `/`

- Header: "Projects"; AI status label (Ready, Loading, Unavailable).
- `FlatList` of rows: name, status badge (No scope yet, Draft, Agreement v1 confirmed),
  last updated. A row is one 48+ touch target. The list owns scrolling directly inside
  `Screen`; empty/loading content uses its list slots, with no wrapping `ScrollView`.
- Bottom bar: **New project**. Tapping it swaps the bar for a labeled name field with
  **Create** and **Cancel**. Empty name shows a field error. On success, navigate to the
  new project's workspace.
- States: loading (list placeholder text), empty (how to start, plus the button), load
  failure (`InlineError` with Retry), create failure (error under the field, name kept).

### 8.2 Project Workspace — `/project/[projectId]`

Header: project name and status badge. Content depends on `scopeStatus`.

**No scope yet**

- Labeled multiline field "Client conversation", helper "Paste the messages that describe
  the work. Nothing is read from your clipboard or accounts automatically."
- Bottom bar: **Extract scope** (disabled with reason when the field is empty or AI is
  unavailable) and quiet **Enter scope manually**, which creates an empty manual draft.

**Draft**

- "Source conversation" collapsed to one line with Show/Hide. Absent for manual drafts.
- `DraftEditor`: Deliverables and Exclusions as editable rows with Add and Remove; Terms
  with Budget (numeric, currency label), Timeline, Revision terms. Blank fields show
  "Not specified" as helper and are saved as `null`.
- "Missing information" list in the AI-suggestion treatment (extracted drafts only).
- Quiet **Extract again** when a source conversation exists. If the draft has edits, it
  asks before starting replacement generation, then locks the draft fields until the
  operation settles. Invalid or cancelled generation keeps the existing draft.
- Bottom bar: **Confirm scope**. Tapping expands the bar to show "This saves a fixed
  snapshot you reviewed. It does not record client approval." with **Confirm Agreement v1**
  and **Keep editing**. Disabled with reason when there is no deliverable.

**Confirmed**

- `AgreementView`: requirements with IDs, terms, confirmation time. Read-only.
- "Requests and proposals": compact list of saved analyses (request excerpt, date) and
  proposal drafts (first deliverable, saved time). Tapping opens the saved record.
- Bottom bar: **Analyze new request**.

States: loading; missing project (explanation, **Back to projects**); extraction running
(`OperationPanel` "Reading the conversation…" with Stop; the conversation field stays
visible and uneditable); extraction failed or invalid (`InlineError` with Retry and Enter
manually; pasted text kept); cancelled (text kept, "Extraction stopped"); save failure
("Unsaved changes" badge and Retry); confirm failure (bar stays expanded with the error).
Leaving with a draft follows section 4.5: show **Saving…**, wait before navigating, and
keep the screen open with recovery actions if saving fails.

### 8.3 ScopeGuard — `/project/[projectId]/request`

- `AgreementStrip`: "Comparing against Agreement v1 · Confirmed 9 Oct", expandable to the
  requirement list.
- Labeled multiline field "New client request".
- Bottom bar: **Analyze request** (disabled with reason when empty or AI unavailable).
- Running: `OperationPanel` "Comparing request with Agreement v1…" with Stop. The request
  field stays visible and read-only. After validation, show **Saving analysis…** without
  Stop until persistence settles. A save failure keeps the validated result for Retry
  save; only successful persistence enables starting a proposal.
- Results: `AiSuggestionBanner`, then one `FindingCard` per requested item:
  - the requested item;
  - classification badge with the exact label from `FRONTEND.md`;
  - explanation;
  - evidence as `EvidenceItem`s, or the line "Not found in the recorded scope" when a
    `potential_additional` finding cites none;
  - clarification questions, when present;
  - for `potential_additional` only, a checkbox "Include in proposal".
- Bottom bar after results: **Start proposal (N selected)**; disabled with "Select at
  least one item" when N is 0. Quiet **Analyze again** above the results.
- With `?analysisId=`: loads the saved analysis and the agreement version it used; the
  request field is read-only and the bar shows **Start proposal**. Check project ownership
  and the exact agreement reference before showing any saved request or finding.

States: no confirmed agreement (explanation, **Review scope draft** back to the
workspace); invalid output ("The result could not be verified against your agreement" with
Retry; nothing saved, no badges shown); cancelled; AI unavailable; missing or mismatched
analysis; save failure (**Retry save**, retained result marked unsaved, proposal disabled).

### 8.4 Change Proposal — `/project/[projectId]/proposal/[proposalId]`

- "Additional deliverables": editable rows, Add and Remove.
- "Proposed fee (PHP)" and "Extra working days": optional numeric fields, helper "Leave
  blank if not decided". Invalid input shows a field error and blocks Save.
- "Message": multiline field with **Generate message** above it. If the message was
  edited by hand, Generate first asks "Replace your edited message?" with **Replace** and
  **Keep mine**. Once started, capture the input snapshot and lock message, deliverables,
  and estimates until completion, failure, or settled cancellation. Only an active,
  validated result replaces the message and marks it unsaved.
- Save-state badge near the header.
- Bottom bar: **Save draft** (primary) and **Copy text** (secondary). After copy, the line
  "Copied. Not sent." appears for a few seconds and is announced.
- Back with unsaved changes: a native alert, **Keep editing** or **Discard**.
  Apply this guard to header Back, hardware Back, and gestures. A running generation is
  cancelled and settled before leaving; an in-progress save must settle first. Never
  bypass the dirty check after either operation.

States: loading; missing or mismatched proposal; generating (`OperationPanel` with Stop;
fields locked, Save disabled, existing message kept until a valid result arrives);
saving (fields locked, duplicate Save blocked, exit deferred);
generation failed (existing message kept, Retry);
save failure (badge stays "Unsaved changes", `InlineError` with Retry; edits kept); AI
unavailable (Generate disabled with reason; manual editing, Save, and Copy still work).

### 8.5 State-to-UI map

| `FRONTEND.md` state | Source | UI |
| --- | --- | --- |
| Initializing | First data call pending | Screen-level loading text; actions disabled. |
| Model absent/unavailable | `AiStatus` `unavailable` | Dashboard label; AI buttons disabled with reason; manual paths open. |
| Loading model | `AiStatus` `loading` | Indeterminate label "Preparing local AI". |
| Generating | `useOperation` `running` | `OperationPanel` with Stop; duplicate run blocked. |
| Saving | `useOperation` `saving` | Saving label; no Stop; duplicate writes blocked; navigation waits for settlement. |
| Cancelled/interrupted | `cancelled` | Inputs kept; "Stopped"; Retry. |
| Invalid/failed result | `invalid_output` | `InlineError`; nothing saved; Retry or manual. |
| Save failure | `save_failed` | Edits or validated candidate kept; unsaved indicator; Retry save without rerunning AI. A failed exit save keeps the route mounted. |
| Missing record | `not_found`, `null`, or relationship mismatch | No unrelated content shown; explanation and a button to the valid parent. |

## 9. Android and iOS usability and accessibility

Applies `FRONTEND.md` section 7 in full. Specific commitments:

- Every `Pressable` is at least 48 × 48 logical units on both platforms, also exceeding
  the iOS 44 × 44 minimum; small icons use `hitSlop` without overlapping adjacent targets.
- Every input has a persistent label; placeholders are examples only.
- Status is never color alone: badge text and icon carry the meaning.
- TalkBack and VoiceOver: reading order matches visual order; icon-only buttons are labeled; expanded,
  selected, disabled, and busy states are exposed; decorative icons are hidden.
- Errors and save or generation results are announced once on each platform; streamed
  text is not. Verify the iOS announcement behavior separately rather than assuming an
  Android accessibility property also announces changes through VoiceOver.
- Layouts are scrollable and wrap at 200% font scale and larger supported accessibility
  text sizes, including iOS Dynamic Type; evidence clauses never truncate.
- Respect Android system bars and iPhone notches/Dynamic Island, landscape safe areas,
  and the home indicator. Header and bottom actions remain inside the usable safe area;
  do not hardcode status-bar or home-indicator heights.
- Verify keyboard avoidance on both platforms with multiline fields and numeric keyboards.
  The focused input, validation feedback, and bottom actions remain reachable without
  duplicate insets. Provide an accessible keyboard-dismiss action where the keyboard has
  no Done/Return key, particularly the iOS numeric keyboard.
- Header Back, Android hardware Back, and iOS edge-swipe navigation follow section 4.5.
  Preserve iOS gestures when the form is clean; intercept exits while dirty or saving so
  gestures cannot bypass the save/discard guard. Keep a visible labeled Back button.
- Keep the same one-column workflow on small and large iPhones and on iPad. On larger
  widths use a centered readable content width and adaptive gutters. Layout follows the
  available window size, including rotation and iPad multitasking; no separate tablet
  navigator or new features are needed.
- Use the documented platform press feedback and system fonts from sections 2 and 6.
  Keep platform-specific adjustments in shared components or platform modules outside
  `src/app/`; the `.web.tsx` redirects never replace the iOS screens.

## 10. Files

```text
src/
  app/
    _layout.tsx                         (edit: dark status bar)
    index.tsx                           (edit: RootScreen)
    project/[projectId]/index.tsx
    project/[projectId]/request.tsx
    project/[projectId]/proposal/[proposalId].tsx
  screens/
    RootScreen.tsx                      (native: renders DashboardScreen)
    RootScreen.web.tsx                  (web: landing placeholder)
    DashboardScreen.tsx
    WorkspaceScreen.tsx   WorkspaceScreen.web.tsx    (web: redirect to /)
    ScopeGuardScreen.tsx  ScopeGuardScreen.web.tsx   (web: redirect to /)
    ProposalScreen.tsx    ProposalScreen.web.tsx     (web: redirect to /)
    HomeScreen.tsx                      (delete)
  components/ui/
    Screen.tsx Button.tsx TextField.tsx StatusBadge.tsx
    EvidenceItem.tsx EmptyState.tsx InlineError.tsx Icon.tsx
  features/
    projects/useProjects.ts
    scope/useWorkspace.ts  DraftEditor.tsx  AgreementView.tsx  ConfirmBar.tsx
    request/useRequestAnalysis.ts  FindingCard.tsx  AgreementStrip.tsx
    proposal/useProposal.ts
    ai/useAiStatus.ts  OperationPanel.tsx  AiSuggestionBanner.tsx
  hooks/useOperation.ts
  services/
    contracts.ts errors.ts index.ts workflows.ts
    fixtures/fixtureData.ts fixtureAi.ts fixtureControls.ts
  safety/validateFindings.ts  parseEstimate.ts
  constants/theme.ts
  types/domain.ts
  utils/format.ts                       (money, dates, working days)
```

## 11. Testing and verification

**Unit tests** (`jest-expo`), for logic only; no tests that restate styles or copy:

- `validateFindings`: unknown evidence ID fails; `included` without evidence fails;
  `potential_additional` without evidence passes.
- `parseEstimate`: blank is `null`, not 0; negatives and non-numbers are rejected.
- `confirmDraft`: empty rows stripped; no deliverable rejected.
- `analyzeRequest`: invalid output rejects; valid output returns a `NewAnalysis` candidate
  with the exact project, agreement, and request snapshot; neither path writes to storage.
- `generateMessage`: fee and days reach the AI call unchanged; nothing is saved.
- `useOperation`: a result arriving after cancel is ignored; a second run while running is blocked.
- Fixture `confirmScope`: IDs are `R1…Rn` in order; a second confirm rejects.

**Focused workflow and hook tests for the review safeguards** (controlled promises for
AI and data calls; run data-contract cases against fixtures and later SQLite):

- Navigation during a pending draft save waits. A rejected save retains the mounted
  editor and latest edits; Retry saves them before leaving once; explicit discard leaves
  without pretending the edits were saved. An older blur save cannot clear a newer edit's
  dirty state, overwrite it out of order, or run after confirmation.
- Proposal generation captures the visible estimates and deliverables, disables editing
  and Save until settlement, and preserves the old message on failure or Stop. A late
  result after cancellation cannot replace it. Successful generation changes only the
  message and dirty state; it does not persist or change estimates.
- Extraction returns a candidate without writing. Cancellation before application keeps
  the existing draft. A candidate save failure retains it, and Retry save does not call AI.
- Cancel after AI resolves but before `beginSave()`: no data write is called. Cancel or
  navigate after the write starts: await its outcome, with no false cancelled state or
  duplicate write. Failed analysis saves retry the same validated result without another
  AI call; success stores exactly one analysis.
- Two projects with valid IDs: an analysis/proposal from the wrong project, a proposal
  pointing to the wrong project's analysis, or a mismatched agreement ID/version all
  produce Missing-record behavior before content or AI access. Direct malformed writes
  reject without partial records; `saveProposal` cannot reassign existing relationships.

**Checks before each handoff:** `npm run lint`, `npm run typecheck`. After dependency or
config changes: `npm run check:dependencies`, `npx expo-doctor`, `npm run build:web`.

**Device verification** (physical Android, development build): the `FRONTEND.md` section 11
list, run first on fixtures and again after each real service is swapped in. Fixture runs
do not count as proof that local inference works.

Exercise header Back, hardware Back, and available iOS back gestures while generation
and saves are pending, including forced save failures. Try editing proposal inputs during
generation and deep-linking to mismatched project/record IDs. With enough fixture projects
to exceed the viewport, verify Dashboard uses one `FlatList` scroll owner without the
nested-virtualized-list warning; reach the final row and bottom actions with the keyboard
open and large text. Check the same scrolling ownership for growing workspace history.

**iOS compatibility verification:** when an iOS build and devices are available, repeat
the four-screen flow and failure cases on an iPhone. Check a small viewport and a device
with a home indicator, portrait/landscape, VoiceOver, accessibility text sizes, numeric
keyboard dismissal, copy feedback, and guarded edge-swipe Back. With tablet support
enabled, check iPad full-screen and a narrow multitasking window as well. Simulator checks
can support layout work but do not establish physical-device inference or performance.
If build/signing access or devices are unavailable, record the exact missing checks;
do not call iOS verified. Android standalone APK acceptance remains the release gate.

## 12. Build sequence

| Hours | Work | Done when |
| --- | --- | --- |
| 0–1 | `domain.ts`, `contracts.ts`, `errors.ts`; send to backend and AI teammates. Fixtures and `index.ts`. | Teammates have scoped lookup, relationship-validation, and atomic-save contracts; fixtures type-check. |
| 1–2 | `theme.ts`, `app.json` and status bar to dark, `Screen`, `Button`, `TextField`, `StatusBadge`, `Icon`. Update `FRONTEND.md` sections 1 and 6. `jest-expo` setup. | A screen renders in Mint Slate on Android; shared shell includes iOS safe-area and keyboard handling, checked on an available iOS build with any gaps recorded. |
| 2–3 | Dashboard with create, empty, loading, and error states. `useProjects`. | Create a project and land in its workspace; `FlatList` owns scrolling in the non-scrolling shell. |
| 3–5.5 | Workspace: three stages, `DraftEditor`, `ConfirmBar`, `AgreementView`, `OperationPanel`, extraction states. `workflows.extractDraft`, `confirmDraft`. | Paste, extract, edit, confirm Agreement v1 on fixtures; delayed/failed exit saves preserve edits. |
| 5.5–7.5 | ScopeGuard: `FindingCard`, `EvidenceItem`, selection, saved-analysis mode. `validateFindings`, `workflows.analyzeRequest`. | Evidence and project relationships resolve; invalid/cancelled results cannot save; persistence has an explicit non-cancellable phase. |
| 7.5–9 | Proposal: estimates, generate, save, copy, back guard. `parseEstimate`, `workflows.generateMessage`. | Whole demo flow completes on fixtures; locked generation inputs and guarded saves preserve user edits. |
| 9–10 | Swap in real `data` and `ai` as teammates deliver; fix contract mismatches. | Flow runs on whatever real services exist. |
| 10–14 | Stabilization on the Android demo phone and available iOS devices: small screens, large text, TalkBack/VoiceOver, keyboard, Back/edge swipe, every forced failure state. Bug fixes only. | Android checks in `FRONTEND.md` section 11 pass; iOS checks have explicit results or documented device/build limitations. |

If a block overruns, cut in this order: saved-analysis mode, Extract again, the
development failure switches for states already verified. The four screens and their
failure states are not cut.
The five review safeguards and their verification cases are not optional scope cuts.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Teammates' real output does not match the contract | Types sent in hour 1; `workflows.ts` is the only place that touches both sides. |
| Real inference is much slower than the fixture delay | `OperationPanel` is indeterminate and has Stop from the start; no timeouts are assumed in the UI. |
| The local model is not ready by the demo | Manual scope entry and manual proposal editing work with AI unavailable; fixtures stay labeled and are never presented as real inference. |
| Sampled theme colors are slightly off | All colors are in `theme.ts`; replacing them needs a contrast re-check only. |
| New native packages break a teammate's existing development build | Deployment teammate told to rebuild after this branch merges. |
| Keyboard covers bottom actions on Android or iOS | Check the shared shell on Android in hour 2 and on an available iOS build, including numeric-keyboard dismissal; record any platform verification gap. |
