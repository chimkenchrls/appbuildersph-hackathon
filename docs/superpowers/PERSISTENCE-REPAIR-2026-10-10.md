# Saklaw persistence repair

Date: 2026-10-10. Branch: `pandesal-branch`, base commit `10f3053`.
Changes are uncommitted; no push, merge, deployment, or APK build was performed.
User scope: storage safety first; defer the integer-centavo money migration.
Android device/APK testing belongs to the user's team.

## Changes and ownership

`database/transaction.ts` serializes transaction operations on the shared database.
It uses Expo SDK 57 `withExclusiveTransactionAsync`, with repositories bound to the
callback's connection. Confirmation, draft saves, request/analysis saves, proposal
creation/editing, migrations, demo seeding, and backup import/export use this boundary.
No inference runs inside a database transaction. The standalone agreement repository
and older vault/analysis entry points participate without nested transactions.

Expo's exclusive transaction opens another connection. Connection-local foreign-key
settings cannot be enabled after BEGIN, so `PRAGMA foreign_key_check` verifies the
complete graph before commit; SQL triggers additionally enforce project/agreement/
request/analysis ownership. Invalid references roll back. The Node disk-backed test
uses a separate connection with foreign keys explicitly disabled to exercise this case.
The supported native API/platforms were checked against the SDK 57 SQLite reference
and installed `expo-sqlite ~57.0.4` source. Native behavior still needs device verification.
Web continues to render its placeholder and does not initialize this native backend.

Migration 3 adds a `sealed` agreement column and integrity triggers without rewriting
existing records. An agreement and its requirements are inserted and sealed within one
transaction. Once sealed, clauses cannot be appended, edited, or deleted. New vault
confirmations only create v1; pre-existing higher-version agreements remain readable.
Request and analysis records are immutable; proposals remain editable.

Repositories validate persisted shapes and JSON. Corrupt drafts, invalid stored shapes,
and broken relationships produce `data_integrity` errors rather than disappearing or
being silently repaired. New mixed analyses prioritize clarification over additional
work. Existing classification values are not rewritten.

New proposal days must be null or a nonnegative whole number, enforced in the editor,
fixtures, repositories, and SQL. Existing fractional days remain readable after migration;
users must explicitly correct them before saving or exporting that project. Backup
validation rejects fractional proposal days. Fees and budgets retain main-unit numbers
and SQLite REAL storage, including existing decimals and known zero values.

Newly seeded sample projects have a Demo title. Existing projects are not renamed, and
historically partial demo seeds are not automatically repaired or deleted.
Concurrent database opening/backend initialization now shares one promise, and failed
initialization can retry. Seeding and migrations roll back on failure.

## Backup compatibility and conflicts

`ExportService` now owns a database handle so a snapshot or restore has one transaction.
Version 1 JSON includes `formatVersion: 1`, a reviewed `draft` or null, the project,
agreements, requests, analyses, proposals, and `exportedAt`. Amounts are still main units.
The original unversioned format remains accepted; its absent draft field never clears a
local draft. Timestamps and request text are restored exactly.

Both formats use complete strict schemas, at most 1,000 entries per record array, bounded
strings/collections, and a 5,000,000-character JSON limit. IDs must be unique within their
entity scopes; versions, request/analysis links, project ownership, and evidence must
resolve within the backup. Unsupported versions and malformed/truncated input fail
before restoration. Backup export/import remain service APIs; no new UI was added.

Identical records can be imported repeatedly without duplication. Existing IDs with
different content or ownership fail; no user records are overwritten. A late conflict or
storage failure rolls back the entire restore, including a newly inserted project.
Requirement ordering differences introduced by repository reads do not create conflicts.

## Forward and rollback paths

Startup applies migration 3 and records its version atomically. Previous migration files
are unchanged. Failure rolls back schema/data/version writes; fix the cause and relaunch.
No database reset, value rounding, deletion, or destructive contraction is part of this pass.

Do not downgrade an upgraded installation to the old agreement writer: it cannot insert
requirements into an already sealed agreement. If a code rollback is required, retain the
migration-3-compatible writer and guards. Do not remove triggers or revert the schema to
make an old APK write again. Preserve the app sandbox and use a verified JSON backup for
restoration into a compatible build. This is a local app upgrade, with no shared server
or overlapping client/server schema rollout.

## Fresh automated evidence

Installed dependencies; Node's built-in SQLite rather than a physical device.

| Check | Result |
| --- | --- |
| `npm test -- --runInBand` | 119 tests passed in nine suites; none skipped |
| `npx expo lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run build:web` | Passed; existing web placeholder exported |
| `git diff --check` | Passed |

Regressions cover confirmation/draft/analysis/proposal rollback, duplicate confirmation,
confirmation racing a draft save, malformed JSON/record graphs, invalid evidence,
backup conflict/idempotent retry/timestamp/draft fidelity, late import/seed failures,
SQL immutability/ownership/whole-day guards, migration preservation and rollback,
concurrent initialization, corrupt reads, and complete history surviving a disk-backed
close/reopen. Physical Expo SQLite and OS termination semantics are not proven by this shim.
No dependencies or native configuration changed, so Doctor/dependency checks were not rerun.

## Team device checklist

- Upgrade the app over an installation with existing projects; keep the same sandbox.
  Verify titles, budget decimals, Agreement v1 clauses, history, and proposal estimates.
- Create a project and save an unconfirmed draft. Fully terminate/relaunch the app and
  verify source text, deliverables, exclusions, missing details, and terms.
- Confirm v1, immediately reopen it, and repeat confirmation attempts. Check one v1 and
  no stale draft. Edit/save/copy a proposal; verify the agreement remains unchanged.
- Repeat full termination/relaunch after saving an analysis and edited proposal. Verify
  evidence opens against the original agreement and saved message/zero estimates survive.
- Enter `1.5` extra days: saving must be disabled and input retained. Try blank, zero, and
  whole days; verify persistence. Correct any historical fractional-day proposal explicitly.
- Through a temporary test harness, export/import reviewed drafts and complete projects,
  repeat imports, and reject truncated/cross-project/conflicting backups with no partial data.
  Backup services are not exposed in the four-screen UI yet.
- Stop/unload the model or disconnect LM Studio; existing records must still reopen.
  LM Studio cannot establish offline inference acceptance. After teammate native-AI
  integration, run the standalone APK workflow in airplane mode without Metro/Expo Go.

Money conversion, inference reservation/cancellation, deterministic AI message estimates,
physical iOS verification of this migration, and standalone Android acceptance remain
separate integration work. The user reported successful iPhone Expo Go workflow testing
before these persistence changes; it does not verify this patch.
