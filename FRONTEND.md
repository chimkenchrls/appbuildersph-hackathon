# OwlSet — Frontend Development Guidelines for Claude

## 1. Purpose and agreed decisions

Use this document when implementing or reviewing OwlSet's frontend. It records
the product and design decisions agreed with the project owner. It describes
required behavior, not features already implemented.

OwlSet helps freelance developers and UI/UX designers turn client conversations
into reviewed project scopes, assess new requests against those scopes, and
prepare change proposals. The freelancer controls commitments; AI assists.

| Decision            | Guideline                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary target      | Android mobile app, delivered as a standalone APK.                                                                                                       |
| Other native target | The same shared UI supports iPhone and adaptive iPad layouts; iOS delivery remains secondary. Verify native integrations and device behavior separately. |
| Web                 | Product landing page, not a browser version of the workspace.                                                                                            |
| Visual direction    | Calm, professional, readable; Mint Teal: teal-tinted dark surfaces, a clear mint accent, a deep teal brand field, square corners. Dark only.             |
| Language            | English interface; retain established product/module names where useful.                                                                                 |
| Navigation          | Project-centered stack, rather than a tab for every module.                                                                                              |
| MVP input           | Pasted conversations and manually entered requirements.                                                                                                  |
| Screenshot input    | Follow-up: conversation screenshots only, local text extraction, user correction before analysis.                                                        |
| Claude's discretion | Make routine layout, styling, and component decisions within this guide. Discuss new features, navigation changes, and dependencies first.               |

Read `AGENTS.md`, `PROJECT.md`, and `ARCHITECTURE.md` before implementation.
Check `package.json`, `app.json`, `eas.json`, and the actual source before using
an API or changing configuration. Follow an existing `ROADMAP.md` when present;
`PROJECT.md` references it, but it was absent when these guidelines were written.

The owner's Android-first and landing-page-only decisions supersede the
provisional iPhone demo choice in `PROJECT.md`. Adapt the generic architecture's
library/chat examples to OwlSet; they are not additional required screens.
Preserve its engineering and offline boundaries. If another conflict affects
implementation, identify it and resolve it before dependent work.

## 2. Actual baseline and scope

The repository already uses Expo, React Native, React, strict TypeScript,
Expo Router, safe-area support, SQLite dependencies, a development client,
ESLint, and npm with a committed lockfile. `package.json` points to
`expo-router/entry`; routes live under `src/app/`; `@/*` resolves to `src/*`.
CI includes lint, type checking, dependency compatibility, and web export.

The current screen is a starter placeholder. Installed dependencies and build
profiles do not establish working storage, local inference, or product screens.
Some `AGENTS.md` and README baseline descriptions predate the Router migration;
inspect current code rather than recreating retired `App.tsx`/`index.ts` entry points.

The 16-hour MVP is one complete flow:

**Create project → Paste conversation → Extract and review scope → Confirm
Agreement v1 → Analyze a new request → Review evidence → Edit, save, and copy
a change proposal.**

Do not add authentication, cloud sync, client portals, messaging integrations,
OCR/image input, PDF import/export, payments, invoices, signatures, automatic
sending, Agreement v2, or a generic AI chat to the MVP. Screenshot input is
explicitly deferred; do not display a nonfunctional image-upload control.

## 3. Information architecture and navigation

Use the existing Expo Router root. Keep route files thin and put screen
implementations outside `src/app/`. The following is the intended route map;
it is not a claim that these routes exist yet:

| Route                                        | Screen and purpose                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/`                                          | Native: Dashboard. Web: landing page through a platform-specific screen.            |
| `/project/[projectId]`                       | Project Workspace: scope draft, confirmed agreement, requests, and compact history. |
| `/project/[projectId]/request`               | ScopeGuard: enter and analyze a new request.                                        |
| `/project/[projectId]/proposal/[proposalId]` | Change Proposal: edit and save a proposal draft.                                    |

BriefCraft review belongs inside the Project Workspace initially. Create a
proposal draft record before navigating to its editor; generating its message
must not mark it accepted. Opening saved analyses must restore their stored
request and exact agreement version, using validated identifiers.

Do not add a global module tab bar, separate history screen, competing navigator,
or duplicate route tree. Validate route parameters and handle missing/deleted
records with a useful recovery action. Hardware Back returns to the parent
context and preserves drafts or offers an explicit discard choice.

Web must render the landing page without initializing native inference or
importing an incompatible native binding. Put platform differences in screen
or service modules outside the route directory. Do not expose native project
routes as a functioning web app; unsupported web routes should return users to
the landing page without loading private data or native services.

## 4. Screen behavior

### Dashboard

- Show the project list immediately, with project name and honest scope status.
- Provide Create project and Open project. An empty list explains how to start.
- Keep project creation minimal: a required name; collect remaining scope details
  in the workspace. Do not invent client profiles or onboarding forms.
- Load saved projects from repositories. Development fixtures must be visibly
  identified and must not appear as the user's persisted projects.

### Project Workspace and BriefCraft

- Display the project name, draft/confirmed state, and applicable agreement version.
- Offer a labeled multiline conversation field and a manual scope-entry path.
  Allow normal paste; do not automatically read the clipboard or messaging accounts.
- Extract an editable draft with deliverables, exclusions, budget, timeline,
  revision terms, and missing information. Missing values stay unspecified.
- Keep source messages available for review without dominating the screen.
- Let users correct generated fields before confirmation. Preserve draft edits
  through navigation and inference failures; never replace them silently on retry.
- Use **Confirm scope** for the explicit confirmation action. Explain that it
  saves a fixed snapshot reviewed by the freelancer and does not record client approval.
- Save Agreement v1 through the application service, then display its version,
  stable requirement IDs, terms, and confirmation time. Confirmed fields are read-only.
- Enable request analysis only when a confirmed agreement exists. Explain the
  prerequisite and provide a route back to review the draft.
- Keep history compact within the workspace; show saved requests and proposal drafts.

### ScopeGuard

- Show the confirmed agreement version being used and a labeled new-request field.
- Present one finding per requested item when a request contains mixed work.
- Use these exact domain values and plain English labels:

| Stored value           | Visible label              | Meaning                                                        |
| ---------------------- | -------------------------- | -------------------------------------------------------------- |
| `included`             | Included in recorded scope | Appears covered by an actual recorded requirement.             |
| `potential_additional` | Potential additional work  | Appears beyond the recorded scope; requires freelancer review. |
| `needs_clarification`  | Needs clarification        | Request or scope is too ambiguous for a supported conclusion.  |

- Label results as AI suggestions. Avoid verdicts such as “client violation,”
  legal guarantees, fabricated confidence percentages, or automatic pricing.
- Each finding shows an explanation, actual requirement references, and relevant
  clarification questions. Tapping evidence reveals the stored clause and version.
- Distinguish “not found in the recorded scope” from an explicit exclusion.
  Absence is not evidence that a clause forbids something.
- Validate evidence identifiers against the selected agreement before presenting
  a completed result. An invalid reference is a failed result, not a valid badge.
- Let the freelancer choose which additional deliverables to propose. Unresolved
  findings keep their clarification questions; do not silently classify them as extras.
- Never alter the agreement or infer consumed revision rounds from an analysis.

### Change Proposal and ChangeDesk

- Show selected deliverables, editable message, and optional fee and extra working days.
- Estimates are freelancer inputs. Blank means unspecified, not zero. Validate
  monetary and day values; do not invent amounts, dates, or commitments.
- Use Generate message, Save draft, and Copy text as distinct actions. Preserve
  manual edits; make replacing an edited message an explicit choice.
- Saving persists a proposal with status `draft` and its reviewed analysis reference.
  Only show Saved after persistence succeeds; retain the draft if saving fails.
- Copy copies the current visible text after a user action. Do not imply it was sent.
- Saving or copying does not record acceptance or update Agreement v1. Do not
  add Send, Accept, signature, or payment controls.
- Use the fictional PHP demo amounts only in labeled fixtures. Keep currency
  handling in shared formatters and treat it as recorded user data.

## 5. AI, persistence, and failure states

Expose operation state through typed hooks and services. Saved records belong
in SQLite; component/UI state holds current edits, selection, and progress.

| State                    | Required frontend behavior                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Initializing             | Explain local preparation; do not permit writes before database readiness.                                     |
| Model absent/unavailable | Explain that local AI is unavailable; preserve project access and manual scope/proposal editing.               |
| Loading model            | Show an honest indeterminate state unless measurable progress exists.                                          |
| Generating               | Identify the operation, prevent duplicate submissions, and provide Stop when supported by the engine contract. |
| Cancelled/interrupted    | Preserve input and reviewed edits; identify incomplete output and offer retry.                                 |
| Invalid/failed result    | Explain the failure, keep input, and offer retry or manual entry; do not save it as a successful analysis.     |
| Save failure             | Retain the draft, keep the unsaved indicator, and offer retry.                                                 |
| Missing record           | Explain that the record is unavailable and return to its parent context.                                       |

Only complete, validated structured output becomes a usable scope or analysis.
Streaming output, if exposed, is provisional and cannot be confirmed mid-generation.
Retry creates a new operation and must not duplicate saved records or clobber edits.
Use operation IDs to ignore stale callbacks after cancellation or navigation.

Core use must work offline, including first launch under `ARCHITECTURE.md`'s
local model provisioning policy. No cloud inference fallback, required model
download, remote fonts, login, telemetry, or automatic online updates. Do not
wire the local development FastAPI/LM Studio server into the installed app.

The engine, model, device limits, and provisioning method remain feasibility
decisions. Describe readiness truthfully; do not assume Qwen 3.5 9B works or
that it can interpret screenshots. Explain actionable resource failures such
as unavailable model bytes or insufficient storage without exposing raw logs.

## 6. Design system

Build a practical work surface with restrained color, clear typography, and
predictable spacing. The first viewport exposes useful project content or the
current task. Keep marketing headlines on the landing page.

Use React Native primitives and `StyleSheet`. Define shared semantic tokens in
`src/constants/theme.ts` and consume them from reusable UI components. The
values below are the Mint Teal tokens in that file. They replaced the earlier, greyer Mint Slate values on 2026-10-10 at the owner's request. They were first sampled from the
reviewed theme preview and are approximate:

| Token                            | Value                 | Purpose                                                                                 |
| -------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `background`                     | `#0B1214`             | App canvas.                                                                             |
| `surface`                        | `#111C1F`             | Forms and content surfaces.                                                             |
| `surfaceRaised`                  | `#1A2A2E`             | Bottom action bar, pressed rows, disabled fill.                                         |
| `textPrimary`                    | `#E8F0EE`             | Headings and primary text.                                                              |
| `textSecondary`                  | `#9DB2B0`             | Supporting text.                                                                        |
| `primary`                        | `#86D3C5`             | Primary actions, focus emphasis, confirmed edge.                                        |
| `onPrimary`                      | `#0B1214`             | Text on primary actions.                                                                |
| `brand` / `onBrand`              | `#2C6E78` / `#F0F8F6` | Kwagi's body teal, for large brand fields such as landing page bands. Not for controls. |
| `border`                         | `#263A3E`             | Decorative separators; not the sole control boundary.                                   |
| `controlBorder`                  | `#6F8C8C`             | Input boundaries and meaningful outlines.                                               |
| `successText` / `successSurface` | `#86D9A0` / `#11261B` | Included status.                                                                        |
| `warningText` / `warningSurface` | `#F0B866` / `#2B200E` | Potential additional work; unsaved changes.                                             |
| `infoText` / `infoSurface`       | `#8FB4F5` / `#131E36` | Clarification required.                                                                 |
| `errorText` / `errorSurface`     | `#F2A0A0` / `#2E1516` | Failed operations and validation errors.                                                |
| `aiText` / `aiSurface`           | `#CDB4DD` / `#36293D` | AI suggestions.                                                                         |

- Use Geist fonts for reading and the system monospace font for
  requirement IDs, version labels, and badges. Bundle any later custom font locally;
  do not fetch it at runtime.
- Default body/input text to 16, supporting text to 14, headings to 22–28,
  with comfortable line height and system font scaling enabled.
- Use a 4/8-unit spacing scale: 4, 8, 12, 16, 24, 32. Phone gutters start at 16.
- Use square corners (radius 0), borders in place of elevation, and consistent outlines.
  Avoid glass effects, animated gradients, ornamental dashboards, and excessive cards.
- Use one clear primary action per task section. Show disabled reasons where relevant.
- Status indicators combine text with an optional consistent icon; never rely
  on red/green or color alone. Avoid emoji as structural icons.
- Icons come from `@react-native-vector-icons/lucide` through the `Icon` wrapper in
  `src/components/ui/Icon.tsx`, which lists the allowed names. Browser-only icon
  components do not belong in shared native screens.
- Provide immediate pressed feedback. Keep optional motion brief and respect
  reduced-motion preferences; inference progress must not depend on animation.
- The MVP is dark only (`userInterfaceStyle: "dark"`). A theme toggle is not a
  required feature; any later light mode needs independent semantic colors and testing.

Reusable primitives should emerge from repeated needs: Button, labeled TextField,
StatusBadge, EvidenceItem, EmptyState, and InlineError. Support relevant accessibility
and busy/disabled states. Do not build a component catalog before the first flow.

## 7. Android and iOS usability and accessibility

- Support small phones and larger screens with flexible, scrollable layouts.
  Do not hardcode desktop widths or truncate clauses needed to understand evidence.
- Use the same four screens and product behavior on Android and iOS. Keep platform
  adjustments in shared components or modules outside the route directory.
- Respect Android system bars, iPhone notches/Dynamic Island, landscape safe areas,
  and the home indicator. Reserve space for bottom actions without double-applying
  insets; actions must remain accessible when the keyboard opens.
- Preserve adaptive iPad layouts while `ios.supportsTablet` is enabled: use readable
  content widths and support rotation and narrow multitasking windows.
- Use at least 48 × 48 logical units for Android touch targets; allow spacing
  between adjacent actions. Preserve iOS targets of at least 44 × 44 where applicable.
- Give every field a persistent label, not just a placeholder. Use appropriate
  keyboard types, multiline input behavior, visible errors, and recoverable validation.
- Test keyboard avoidance independently on Android and iOS, including multiline inputs
  and numeric keyboards. Provide an accessible dismissal action when a keyboard has
  no Done/Return key; keep validation feedback and bottom actions reachable.
- Announce actionable errors and important save/generation state changes through
  accessible feedback. Avoid announcing every streamed token.
- Keep TalkBack and VoiceOver reading order aligned with the visual order. Label icon buttons
  and expose disabled/selected/expanded states; hide purely decorative imagery.
- Verify announcements on both platforms; Android-only live-region behavior is not
  sufficient evidence that VoiceOver announces errors and save/generation results.
- Allow large system text without overlapping labels or losing actions. Essential
  content and buttons must remain reachable at increased font sizes, including iOS
  accessibility text sizes through Dynamic Type.
- Normal text needs at least 4.5:1 contrast; meaningful controls and indicators
  need at least 3:1. Recheck composed colors for pressed, focused, and error states.
- Do not make required actions swipe-only or depend on long presses. Keep a visible
  Back control, preserve normal iOS back gestures, and guard header Back, Android
  hardware Back, and iOS edge swipes consistently against loss of unsaved work.

## 8. Component and code boundaries

```text
src/app/                 Routes and navigator layouts
src/screens/             Dashboard, workspace, analysis, proposal, landing
src/components/ui/       Shared visual primitives
src/features/            Project/scope/request/proposal UI and feature hooks
src/hooks/               Shared initialization and runtime hooks
src/constants/           Theme tokens and frontend constants
src/services/            Application orchestration and model lifecycle
src/database/            Migrations and repositories
src/llm/                 Engine contracts, adapter, scheduler
src/safety/              Validation and policy boundaries
src/types/               Shared typed contracts
```

Create directories when needed, not as empty scaffolding. Screens/components
consume hooks, which call application services/repositories. Never execute SQL,
load models, or call native inference directly from a screen or route.

Use strict TypeScript, stable record IDs, explicit props, and typed operation
states. Keep business invariants in services, not merely disabled buttons.
Separate persistent entities from editable form drafts and provisional AI output.
Use controlled form inputs; preserve user changes when asynchronous results arrive.

Virtualize growing project/history lists. Keep inference off the UI thread,
throttle streaming updates, and clean up component subscriptions. A globally
owned model is not unloaded simply because a screen unmounts. Profile observed
performance problems before adding memoization or state libraries.

Validate generated output and evidence at service boundaries. Render pasted
and generated content as inert text; do not execute raw HTML, links, commands,
or model-proposed actions. Keep client messages and personal data out of logs.
Do not describe plain SQLite storage as encrypted or guarantee legal protection.

Verify Expo APIs against the installed SDK and React Native APIs against the
installed version. Preserve npm and the lockfile. Add packages with
`npx expo install <package>` after the agreed dependency discussion. Clipboard,
image picker, OCR, schema validation, and native inference integrations require
actual compatible dependencies; do not assume they are already installed.

## 9. Web landing page

The landing page introduces OwlSet and helps visitors obtain the Android app.
Reuse brand tokens and product language while giving web its own appropriate
layout. It does not initialize SQLite, model setup, or the mobile workspace.

Include a concise introduction, the freelancer scope problem, the actual core
workflow, available product screenshots, and an Android download section.
Use the approved tagline when helpful: “Clear agreements. Controlled revisions.
Confident freelancing.” Screenshots must represent implemented behavior; label
concept images or demonstration fixtures accurately.

Use a verified APK artifact URL when a release exists. Include version/build
information when known. Before that, show honest availability text rather than
a fake Download link. No fabricated testimonials, user counts, pricing,
App Store badges, waitlist forms, or unimplemented feature claims.

Keep the page responsive with readable mobile/desktop layouts, semantic headings,
descriptive links, keyboard access, visible focus, image alternatives, reduced
motion support, and appropriate document metadata. Do not add routes or a hosting
provider simply to implement the mobile workflow; publication is a separate task.

## 10. Deferred conversation screenshots

Implement only after the text MVP works and screenshot work is explicitly started:

**Select screenshot → Extract text locally → Review/correct extracted text →
Use the reviewed text in BriefCraft or ScopeGuard.**

- Support client-conversation screenshots only initially, not arbitrary photos,
  documents, handwriting, or image-based contracts.
- Use user-selected images; do not automatically scan the gallery or capture
  other apps. Request only the permissions the selected approach actually needs.
- Confirm on-device OCR/runtime feasibility before choosing dependencies. Do not
  assume the text model provides vision or introduce a remote OCR fallback.
- Keep the pasted-text and manual paths usable after permission denial, poor
  recognition, unsupported files, or extraction failure.
- Treat extracted text as untrusted and provisional. Preserve the original
  image context during review, and let the user correct recognition errors.
- Validate file types/sizes and apply bounded processing. Define image retention,
  private storage, and cleanup before persisting screenshots.
- Do not advertise screenshot support as available until it works on the installed
  Android app offline. Do not add unused OCR dependencies or UI during the text MVP.

## 11. Verification and Claude handoff

Implement the smallest coherent product slice, connect real service contracts,
and keep unfinished integrations explicit. Use fixtures for development/tests
only; fixture output is not proof of local inference. Prefer a working manual
path to controls that imply nonexistent functionality.

For frontend code changes, run the existing checks:

```sh
npm run lint
npm run typecheck
```

Run `npm run check:dependencies` and `npx expo-doctor` after dependency/native
configuration changes. Run `npm run build:web` for web, routing, shared rendering,
or bundling changes; preserve all CI checks. Native module changes require a
new development/native build, not just a Metro reload.

Use focused tests for confirmation immutability, evidence validation, request
version binding, estimate preservation, retry/cancellation, and save failures.
Do not add tests that merely restate styles or copy. Guide-only changes need
document and reference validation; they do not establish application correctness.

Before accepting the core flow, verify on a physical Android device:

- Create a project; paste text; review/correct the draft; confirm Agreement v1.
- Analyze mixed requests with evidence resolving to actual stored requirements.
- Keep ambiguous items unresolved and missing budget/timeline fields unspecified.
- Enter estimates; generate/edit/save/copy a proposal; verify the agreement is unchanged.
- Retain saved records after offline restart and preserve edits through navigation.
- Exercise no-model, invalid-output, interrupted-generation, and save-failure paths.
- Check small-screen layout, large system text, TalkBack, keyboard, and hardware Back.
- Complete the flow in a signed standalone APK without Metro or Expo Go, following
  the architecture's offline first-launch and upgrade acceptance requirements.

When iOS builds and devices are available, repeat the shared workflow and failure
cases on iPhone, including small screens, safe areas, landscape, VoiceOver, large
accessibility text, numeric-keyboard dismissal, copy feedback, and guarded back
gestures. Check iPad full-screen and narrow multitasking layouts while tablet support
is enabled. Record unavailable builds, signing access, or devices and the exact checks
still pending. A shared UI or simulator preview does not establish physical-device
inference compatibility; Android APK acceptance remains the primary release gate.

Use the fictional website scenario from `PROJECT.md` as a labeled demo fixture:
five pages and a contact form, PHP 15,000, two weeks, two revision rounds;
later accounts/booking, with freelancer-entered PHP 7,000 and five extra working days.
Those amounts are not AI recommendations. The demo must distinguish real
inference from prepared outputs.

For each handoff, state what changed, checks actually run, remaining integration
gaps, and device verification still needed. Never equate a passing web export
with native correctness. Discuss scope/navigation/dependency changes before
implementing them; routine decisions within this document need no repeated approval.

## Staging integration decisions (2026-10-10)

The owner approved staging's light native workspace, with Projects, Agreements and Settings
root tabs and focused project flows. Native screens use the staging theme (white canvas,
`#4D8B8B` primary and `#1E1E1E` text). This supersedes earlier native dark-theme and
no-tab requirements. The existing dark Mint Teal web landing page stays unchanged.

Expo Router owns navigation, including the native root's validated query parameters.
Existing project routes and web redirects remain compatible. The fixture flag still
opens the existing labelled fixture dashboard; the new screens use SQLite.

Staging's contract PDF/share controls are included, with local Expo print/sharing
modules. Contract wording remains a draft for review, not verified legal compliance.
Silent heuristic AI fallbacks and invented terms are excluded. Missing terms stay
unspecified, estimates come from the freelancer, and save/AI failures remain visible.
The settings sample reset is disabled to protect immutable records.

The Android package remains `com.saklaw.dds`, and the existing EAS link and APK
profiles are preserved. Rebuild native clients after these dependency changes.
