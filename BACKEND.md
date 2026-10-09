# Saklaw: Backend Specification and Architecture

> **Audience:** Developers and AI coding assistants working on the Saklaw mobile application.
> **Status:** Implemented and verified in TypeScript on Expo SQLite (WAL mode) with local LM Studio inference integration.
> **Related documents:** [Project overview](./PROJECT.md) · [Development roadmap](./ROADMAP.md)

## 1. Backend scope

For Saklaw, "backend" means the application services, local SQLite persistence, validation, and on-device AI integration inside the mobile application.

Implemented capabilities:

- Create and retrieve projects (`ProjectRepository`).
- Extract and save editable scope drafts from chat (`BriefCraftService`).
- Confirm immutable, versioned agreements (`KasunduanVaultService`, `AgreementRepository`).
- Store new requests and analyze them against confirmed agreements (`ScopeGuardService`, `ScopeGuardRepository`).
- Validate findings and resolve evidence to stored scope requirements (`ScopeGuardService`).
- Generate and save editable change proposal drafts (`ChangeDeskService`, `ProposalRepository`).
- Automatically generate formal, legally compliant contracts under Philippine law with EOPT Act RA 11976, BIR Form 2307, RA 8293, and RA 10173 (`ContractGeneratorService`).
- Share change proposals, agreements, and contracts via the native mobile OS share sheet (`ShareService`).
- Backup and restore full project data offline (`ExportService`).
- Retrieve project history and state after restarting the application offline (`BootstrapService`).

No hosted remote server, HTTP API, account system, or cloud synchronization is required. Service methods are internal TypeScript classes and repositories, not remote REST routes.

## 2. Architecture and ownership

```text
Screens / Routes
  → Application services (BriefCraft, KasunduanVault, ScopeGuard, ChangeDesk, ContractGenerator, Share, Export)
      → Input/output schemas and business rules (Zod)
      → Repositories → SQLite (expo-sqlite WAL mode)
      → AI adapter (LMStudioAdapter) → Local inference runtime (LM Studio / llama.rn)
```

The implemented layout in `src/`:

```text
src/
  database/
    client.ts           # SQLite connection and WAL/foreign-key pragmas
    migrate.ts          # Versioned migration runner
    seed.ts             # Idempotent demo project seeder
    migrations/         # 001_initial.ts, 002_add_tax_treatment.ts
    repositories/       # Parameterized queries (Project, Agreement, ScopeGuard, Proposal, Settings)
  services/             # Domain orchestration services
  llm/                  # Contracts, LMStudioAdapter, JSON parser, prompt builders
  types/                # Domain types and Zod validation schemas
```

## 3. Domain conventions

- Use application-generated UUIDs for persistent record IDs. Never accept model-generated database IDs.
- Store timestamps as UTC ISO 8601 strings; format dates for the user in the UI.
- Keep null distinct from zero: an unspecified fee is null, while an explicitly entered zero fee is zero.
- Store monetary values in integer minor units. For PHP, PHP 7,000 is `700000` centavos.
- Restrict the MVP to PHP. Additional currencies are future work.
- Parse monetary input as a decimal string into minor units; reject negative values, more than two decimal places, and values outside safe integer bounds.
- Additional working days are a nullable nonnegative integer in the MVP.
- A confirmed agreement is freelancer-confirmed. Client approval is a separate future record, never an inferred flag.
- JSON fields are validated domain objects, not arbitrary model output.

### Scope snapshot

```ts
type Classification =
  | 'included'
  | 'potential_additional'
  | 'needs_clarification';

interface ScopeSnapshot {
  requirements: Array<{ id: string; text: string }>;
  exclusions: string[];
  budgetMinor: number | null;
  currency: 'PHP';
  timelineText: string | null;
  revisionTermsText: string | null;
  missingDetails: string[];
}

interface Finding {
  requestedItem: string;
  classification: Classification;
  explanation: string;
  requirementIds: string[];
  clarificationQuestions: string[];
}
```

Assign requirement IDs in the application after extraction. Preserve those IDs when editing requirement text before confirmation; assign a new ID to a newly added requirement. IDs are resolved within their agreement snapshot, never against a different version.

## 4. Local database design

Use a single local database, provisionally named `saklaw.db`. The following is a proposed initial schema, not an instruction to replace an existing database without inspecting it.

| Table | Purpose | Editable? |
| --- | --- | --- |
| `projects` | Basic project metadata | Metadata may be edited through a service. |
| `scope_drafts` | One current working scope per project | Yes. |
| `agreements` | Confirmed snapshots | No. |
| `requests` | Original text submitted for analysis | No; create another request for changed text. |
| `analyses` | Successful, validated comparisons | No; retry creates another successful analysis when appropriate. |
| `proposals` | User-reviewed change proposal drafts | Yes. |

### Initial schema

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  client_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE scope_drafts (
  project_id TEXT PRIMARY KEY NOT NULL
    REFERENCES projects(id) ON DELETE RESTRICT,
  source_text TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE agreements (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version >= 1),
  confirmation_status TEXT NOT NULL
    CHECK (confirmation_status = 'freelancer_confirmed'),
  source_text TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  UNIQUE (project_id, version),
  UNIQUE (id, project_id)
);

CREATE TABLE requests (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  agreement_id TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  created_at TEXT NOT NULL,
  UNIQUE (id, agreement_id, project_id),
  FOREIGN KEY (agreement_id, project_id)
    REFERENCES agreements(id, project_id) ON DELETE RESTRICT
);

CREATE TABLE analyses (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  agreement_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (
    classification IN ('included', 'potential_additional', 'needs_clarification')
  ),
  findings_json TEXT NOT NULL,
  clarification_questions_json TEXT NOT NULL,
  model_label TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  created_at TEXT NOT NULL,
  UNIQUE (id, project_id),
  FOREIGN KEY (request_id, agreement_id, project_id)
    REFERENCES requests(id, agreement_id, project_id) ON DELETE RESTRICT
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  additional_deliverables_json TEXT NOT NULL,
  proposed_fee_minor INTEGER CHECK (
    proposed_fee_minor IS NULL OR
    (typeof(proposed_fee_minor) = 'integer'
      AND proposed_fee_minor >= 0
      AND proposed_fee_minor <= 9007199254740991)
  ),
  currency TEXT NOT NULL CHECK (currency = 'PHP'),
  additional_days INTEGER CHECK (
    additional_days IS NULL OR
    (typeof(additional_days) = 'integer' AND additional_days >= 0)
  ),
  message_text TEXT NOT NULL CHECK (length(trim(message_text)) > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status = 'draft'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (analysis_id, project_id)
    REFERENCES analyses(id, project_id) ON DELETE RESTRICT
);

CREATE INDEX requests_project_created
  ON requests(project_id, created_at);
CREATE INDEX analyses_request_created
  ON analyses(request_id, created_at);
CREATE INDEX proposals_project_created
  ON proposals(project_id, created_at);

CREATE TRIGGER agreements_no_update
BEFORE UPDATE ON agreements
BEGIN
  SELECT RAISE(ABORT, 'Confirmed agreements cannot be updated');
END;

CREATE TRIGGER agreements_no_delete
BEFORE DELETE ON agreements
BEGIN
  SELECT RAISE(ABORT, 'Confirmed agreements cannot be deleted');
END;
```

Validate JSON with application schemas on write and on read. TypeScript row casts alone do not validate persisted data. Composite foreign keys ensure that analyses and proposals cannot be attached to records belonging to another project or agreement.

The required MVP exposes no delete/reset-project operation. If one is added later, design an explicit data-removal workflow and migration rather than silently bypassing snapshot protection.

### Connection and migrations

Enable foreign keys for every connection before opening transactions; SQLite requires explicit foreign-key activation. See [SQLite foreign-key documentation](https://www.sqlite.org/foreignkeys.html).

Apply versioned migrations in a short transaction and advance the schema version only after success. Do not drop data when the app starts. Verify the database configuration once during initialization.

Use bound parameters or prepared statements for all user/model values. Static schema SQL may use bulk execution; interpolated conversation text must never do so. Expo documents persistence, prepared statements, and transaction APIs in its [SQLite reference](https://docs.expo.dev/versions/latest/sdk/sqlite/).

Serialize writes and use a transaction mechanism supported by the installed SDK that prevents unrelated operations from accidentally joining a transaction. Never hold a database transaction open while inference runs.

## 5. Application service interfaces

The following contracts refine the roadmap's conceptual interfaces. Splitting request creation from inference allows failed requests to be retried without losing their original text.

| Service | Input | Output / effect |
| --- | --- | --- |
| `createProject` | Title and optional client label | Persisted project with application-generated ID. |
| `listProjects` | None | Projects ordered by update time, then ID. |
| `getProject` | Project ID | Project, or typed not-found error. |
| `extractBrief` | Pasted source text | Validated editable draft; no confirmed agreement is created. |
| `saveScopeDraft` | Project ID, source text, reviewed snapshot | Persisted working draft. |
| `getScopeDraft` | Project ID | Current working draft or null. |
| `confirmScope` | Project ID, operation ID, reviewed source/snapshot | Immutable Agreement v1. |
| `getAgreement` | Agreement ID | Validated stored snapshot and metadata. |
| `createRequest` | Agreement ID, request text, operation ID | Persisted request linked to the agreement's project. |
| `analyzeRequest` | Request ID and optional cancellation signal | Validated analysis saved against that request and agreement. |
| `listAnalyses` | Request ID | Successful analyses ordered by creation time, then ID. |
| `draftProposal` | Analysis ID, user-selected deliverables, optional fee/days, cancellation signal | Editable generated draft; no acceptance or scope mutation. |
| `saveProposal` | Draft values and operation ID, or existing proposal ID for edits | Persisted proposal with status `draft`. |
| `getProjectHistory` | Project ID | Agreements, requests, successful analyses, and proposals, ordered deterministically. |
| `getModelStatus` | None | Readiness state and a non-sensitive diagnostic. |
| `generateContractText` | Agreement, optional contract options (names, TINs, addresses, tax treatment) | Formal freelance service agreement formatted under Philippine commercial law. |
| `shareProposal` | Change proposal, project title | Opens native OS share sheet with formatted change proposal message. |
| `shareAgreement` | Agreement, project title | Opens native OS share sheet with confirmed deliverables and terms. |
| `shareContract` | Agreement, optional contract options | Opens native OS share sheet with full legal contract text. |
| `exportProject` | Project ID | Complete, portable JSON backup of project, agreements, requests, analyses, and proposals. |
| `importProject` | Export payload JSON | Validated offline restoration into SQLite. |

Derive project and agreement IDs from stored relationships where possible. Do not trust independently supplied IDs when they can disagree.

For create/confirm/save commands, use an application-generated operation ID as the persistent record ID and keep it stable across retries. If that ID already exists, return the existing record only when its original operation inputs match; otherwise return a conflict. Updating a proposal uses its existing ID and does not create a second draft.

### Agreement confirmation

1. Validate the reviewed snapshot: at least one nonempty requirement, unique requirement IDs, valid optional terms and amounts.
2. Verify that the project exists.
3. Inside a short write transaction, check the operation ID for an idempotent retry.
4. If Agreement v1 already exists under a different operation ID, return `AGREEMENT_ALREADY_CONFIRMED`.
5. Save source text and the reviewed snapshot as version 1 with `freelancer_confirmed` status.
6. Return the snapshot. Subsequent scope-draft edits cannot change it.

The schema reserves version numbers for future amendments, but MVP services only create v1. Do not implement automatic `MAX(version) + 1` amendments as part of confirmation.

### Request analysis

1. Load the request and its exact agreement; validate stored data.
2. Check model readiness and input/context limits.
3. Send agreement requirements, exclusions, recorded terms, and the new request to the local model.
4. Parse and validate the structured findings.
5. Resolve every cited requirement ID within the selected agreement.
6. Compute the overall classification deterministically: any ambiguous finding → `needs_clarification`; otherwise any additional finding → `potential_additional`; otherwise → `included`.
7. Save a successful analysis in a short transaction, including model label, prompt version, and observed duration.
8. Return findings with evidence text resolved from SQLite.

A failed inference leaves the request available for retry but creates no successful analysis row. Reanalysis does not overwrite earlier results. Serialize inference and reject duplicate in-flight submissions; a deliberate later reanalysis may create another result.

## 6. AI adapter and validation

Expose a small adapter rather than calling native runtime APIs from screens:

```ts
interface LocalAIAdapter {
  getStatus(): {
    state: 'unavailable' | 'loading' | 'ready' | 'busy' | 'error';
    modelLabel: string | null;
  };
  extractBrief(sourceText: string, signal?: AbortSignal): Promise<unknown>;
  compareScope(
    scope: ScopeSnapshot,
    requestText: string,
    signal?: AbortSignal,
  ): Promise<unknown>;
  draftNarrative(
    reviewedItems: string[],
    explanation: string,
    clarificationNotes: string[],
    signal?: AbortSignal,
  ): Promise<unknown>;
}
```

Unknown results must pass runtime schemas before becoming domain objects. These are application contracts, not claims about a particular runtime's native API.

### Output rules

- Use structured decoding when supported by the verified runtime; still validate the result.
- Require an object with expected fields and types. Do not evaluate returned text as code.
- Brief extraction returns data only. Database IDs, timestamps, status, and approval are set by services.
- Comparison requires at least one finding and valid classification values.
- All cited IDs must belong to the supplied scope, with no duplicate evidence IDs in one finding.
- An `included` finding requires at least one supporting requirement ID. Other findings may have no reference when explaining absence or ambiguity.
- IDs establish reference validity, not semantic correctness. Users still review whether the cited clause supports the explanation.
- Treat pasted messages and request text as untrusted data separated from application instructions.
- Invalid output returns `INVALID_AI_OUTPUT` or `INVALID_EVIDENCE`; do not silently turn it into a successful result.
- Failed operations allow a visible retry. Avoid unbounded automatic retries.

### Proposal facts and estimates

Generate the explanation and requested-work narrative from the user-reviewed analysis and selected deliverables. Pass only relevant project content to inference.

Render fee, currency, additional days, and draft status deterministically from the user's fields. Do not ask AI to choose or rewrite these values. Null estimates render as “To be confirmed”; never substitute invented figures. Assemble those facts with the AI narrative into an editable proposal message.

If AI drafting fails, leave the existing editor values intact and allow manual writing. A manual proposal is useful, but it does not verify the roadmap's local-AI drafting requirement.

### Runtime limits

The intended model is quantized Qwen 3.5 9B. Validate it on the demonstration device before committing to it. The native integration's installation requirements and supported features must be checked against the [llama.rn project documentation](https://github.com/mybigday/llama.rn) and the exact installed release.

- Run only one model operation at a time unless device testing proves concurrency safe.
- Persist the model outside temporary caches so the demo does not depend on another download.
- Confirm readiness using genuine inference, not just the presence of a model file.
- Set input and output budgets from the verified model context and device behavior.
- Reject an overlong scope/request with `INPUT_TOO_LONG`; never silently omit confirmed requirements or truncate evidence.
- Make cancellation effective at the native runtime when supported. A late result from a cancelled operation must not be saved or shown as current.
- Release/recover runtime resources on supported lifecycle boundaries and errors.
- Record actual latency and runtime configuration without logging private prompts.

## 7. Error contract

Use typed errors with user-facing messages and a recoverability flag. Technical detail belongs in non-sensitive diagnostics.

| Code | Meaning | Recovery |
| --- | --- | --- |
| `VALIDATION_ERROR` | Invalid or missing input | Edit input. |
| `NOT_FOUND` | Referenced record is missing | Reopen the project or refresh. |
| `CONFLICT` | Retried operation ID has different inputs | Start a new explicit operation. |
| `AGREEMENT_ALREADY_CONFIRMED` | v1 exists and cannot be overwritten | Open the existing agreement. |
| `MODEL_UNAVAILABLE` | No usable local model/runtime | Resolve model setup; manual entry remains available. |
| `MODEL_BUSY` | Another inference is running | Wait or cancel the current operation. |
| `INPUT_TOO_LONG` | Input exceeds the verified context budget | Ask the user to shorten the selected conversation/request. |
| `INFERENCE_FAILED` | Runtime generation failed | Retry after runtime recovery. |
| `INVALID_AI_OUTPUT` | Structured response validation failed | Retry or use manual scope/proposal editing. |
| `INVALID_EVIDENCE` | A comparison cites an unknown requirement | Retry; do not display it as a validated analysis. |
| `CANCELLED` | User cancelled the operation | Keep prior saved data and input. |
| `STORAGE_ERROR` | Database operation failed | Preserve editor input; retry after storage recovery. |
| `DATA_INTEGRITY_ERROR` | Persisted data fails validation | Show a clear error; avoid silent deletion or repair. |

Loading state should reflect the actual operation. Buttons must prevent duplicate submissions, and errors must not clear the user's unsaved text.

## 8. Offline behavior and data handling

- After model provisioning, all required reads, writes, and AI operations work without connectivity.
- Model provisioning/build tooling may require network access; the demo itself must not.
- Do not make a remote API call as a silent fallback for failed local inference.
- Store conversations and records in application-local storage. Do not send them to analytics or remote logs.
- Ordinary local persistence is not a claim of application-level encryption. Do not advertise encryption unless it is explicitly implemented and verified.
- No credentials, API keys, or account tokens are needed for this local MVP.
- History is derived from existing records; a separate audit/event subsystem is outside the 16-hour scope.
- Model readiness is runtime state. Persisted successful analyses remain available when the model is temporarily unavailable.

## 9. Backend implementation order

| Time window | Work | Required proof |
| --- | --- | --- |
| Hours 0–2 | Model feasibility, database initialization, shared contracts | Real device inference and a record that survives restart. |
| Hours 2–5 | Project/draft services and v1 confirmation | Reviewed scope saved and reopened without mutation. |
| Hours 5–8 | Requests, comparison, evidence validation | Included/additional/ambiguous/mixed examples produce valid stored results. |
| Hours 8–11 | Proposal drafting, persistence, history | Complete workflow; proposal stays a draft; v1 unchanged. |
| Hours 11–14 | Recovery, invariants, offline tests | Release candidate works after airplane-mode restart. |
| Hours 14–16 | Final verification | Final installed app completes the live workflow. |

## 10. Verification checklist

Use fictional fixtures for automated checks and real inference on the device for integration checks.

- [ ] Migrations run once, preserve existing records, and roll back on failure.
- [ ] Foreign keys reject mismatched project/agreement/request relationships.
- [ ] Agreement update and delete attempts are rejected.
- [ ] Repeated confirmation/create submissions with the same operation ID do not duplicate data.
- [ ] Missing terms remain null; a known zero is preserved as zero.
- [ ] PHP decimal inputs round-trip exactly through integer centavos.
- [ ] Malformed AI JSON and invented evidence IDs cannot create successful analyses.
- [ ] Aggregate classification follows the deterministic rule for mixed findings.
- [ ] Failed analysis keeps request text available for retry.
- [ ] Cancellation prevents late results from being persisted or shown as current.
- [ ] AI proposal narrative cannot set or overwrite fee/days/status fields.
- [ ] Saving/editing a proposal leaves the agreement unchanged.
- [ ] Database records and model readiness are independent: saved records open without a loaded model.
- [ ] The final installed app performs fresh inference and persists results after restarting offline.

This file defines implementation contracts. Track completion and device evidence in [ROADMAP.md](./ROADMAP.md), and keep the [project overview](./PROJECT_OVERVIEW.md) consistent with any approved scope changes.
