# Backend and database recheck — 2026-10-10

Used the Superpowers systematic-debugging, test-driven-development, and
verification-before-completion workflows. Reviewed the existing services,
repositories, migration runner, transaction ownership, persistence validation,
and project backup/restore. No user database was opened or modified.

## Confirmed problems corrected

- Home startup automatically deleted projects sharing a normalized title.
  Removed that startup action and its destructive repository helper. Separate
  project IDs remain separate even when their names match.
- Project deletion issued independent writes. A late failure left the project
  behind after removing its agreements and history. It now uses the existing
  isolated transaction mechanism and also removes only that project's source
  and draft settings. Failure rolls back the whole operation.
- Request deletion failed when its analysis had a proposal. It now explicitly
  removes proposals and analyses before the request in one transaction. This
  works even when the isolated transaction connection has foreign keys disabled;
  the existing pre-commit foreign-key check still protects references.
- Approval and request-status updates bypassed persisted-field validation.
  Malformed values could save successfully and later prevent records from being
  read. Both updates now validate before writing and report missing records.
- Simultaneous AI adapter calls could both pass the busy guard while backend
  initialization was pending. The guard is now checked after initialization too.

Each regression was observed failing before its corresponding production fix.

## Verification

- Full Jest suite: 177 tests in 16 suites passed, including real Node SQLite
  migrations/repositories and disk-backed close/reopen checks.
- `npx expo lint`, `npx tsc --noEmit`, and `git diff --check` passed.
- `npm run build:web` exported successfully.
- Live LM Studio, using the configured model and fictional project text:
  extraction, evidence-validated scope analysis, and proposal drafting succeeded.
  Fee and additional days remained application-controlled.
- Used the installed Expo SDK 57 SQLite reference to verify transaction APIs.

The local runtime was Node 26.10.0; the project's supported version is Node 22.
SQLite tests use a shim over real SQLite, not Expo's Android native binding.
No Android device/toolchain was available here. Physical Android persistence,
standalone APK acceptance, and iOS native checks remain unverified.

## Concurrent on-device inference work

Native/hybrid inference files and bootstrap wiring appeared while this audit was
running. Their additions were preserved. The successful live check used the LM
Studio adapter directly; it does not validate that new native path.

The new native adapter still requires review before release:

- Its generation timeout is not cleared when completion finishes. A timer from
  an earlier request can later call `stopCompletion` during another request.
- Its model importer deletes an existing destination before validating/copying
  the replacement, so a failed import can lose the previous model. It also
  accepts a caller-provided filename without rejecting path traversal.
- Native readiness currently checks module/file presence, rather than proving
  model compatibility through loading and inference.

These native findings were not changed in the concurrently edited files. A device
build, safe model replacement, timeout cleanup, and verified inference are needed
before claiming complete offline readiness.
