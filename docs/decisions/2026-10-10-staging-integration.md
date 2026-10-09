# Staging mobile workspace integration — 2026-10-10

The owner approved the recommended conflict resolution: staging's light mobile UI,
with the existing dark OwlSet landing page, backend validation/timeouts/persistence
safeguards, Android package `com.saklaw.dds`, EAS link, and APK profiles preserved.
Internal Saklaw keys and identifiers remain compatible.

- Expo Router owns all navigation. Native root tabs and project flows use validated
  root route query parameters. Existing project routes and their web redirects remain.
- Screen orchestration lives in `useMobileWorkspace`; SQLite repositories and services
  retain their validation and transaction boundaries. Project creation stores the
  extracted draft and source together; confirmation stores draft and agreement atomically.
- Manual drafts work without AI. AI failures remain errors, never heuristic scopes or
  fake analyses. Missing terms remain unspecified; fees and whole working days come
  from the freelancer. Scope and proposal editors retain the existing exit-save guard.
- Staging drafts use `projects.draft_scope_json`; old `saklaw_scope_draft:` settings
  drafts remain readable. Backups preserve the new draft column. The source is stored
  under `saklaw_source:` and stays local; the existing backup format does not export
  that separate source setting. It must be copied separately if required for a restore.
- Both branches used migration 3. Migration 4 adds the missing draft column and,
  for a staging version-3 database, installs the existing immutable/link guards.
  Existing rows and timestamps are not rewritten; migration 3 is not renumbered.
- Incoming print/sharing and haptic modules are matched to SDK 57. Inference keeps
  the display awake and retains the full-response deadline. Keep-awake does not
  guarantee background CPU execution or offline inference.
- Incoming icons use the existing Lucide package, avoiding the Expo Doctor conflict
  from mixing scoped and legacy icon packages. Native fonts stay bundled.
- Destructive sample resets are disabled to preserve saved immutable records.
  Contract text requires review; legal compliance is not verified.
- `EXPO_PUBLIC_SAKLAW_FIXTURES=1` keeps the existing labelled in-memory fixture
  dashboard. The staging UI is the SQLite-backed native entry, not the fixture UI.

Verification includes both migration-3 upgrade paths, draft backup/restore and
validation, AI failure/manual creation, proposal ownership, missing terms and failed
saves. Run the repository's lint, typecheck, Jest, Expo compatibility, Doctor and
web export checks. A JavaScript Android export is useful for bundling validation,
but does not verify native build, gestures, printing/sharing, font loading, persistence
across an installed upgrade, or physical-device behavior. Rebuild and test Android
before APK release, including saved data and airplane-mode acceptance; verify iOS
separately when a build and device are available.

Local merge verification: lint and strict TypeScript passed; 156 Jest tests passed
across 14 suites; Expo dependency compatibility and all 21 Doctor checks passed.
Web and Android JavaScript exports passed, and all 15 landing smoke checks passed
against the locally served web export (including Kwagi, controls, deep-link redirect
and the 360px menu/overflow checks). No native rebuild, physical-device acceptance,
iOS build, or GitHub run for this merge was performed.
