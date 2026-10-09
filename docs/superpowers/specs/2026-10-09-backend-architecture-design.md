# OwlSet backend architecture design specification

**Date:** 2026-10-09  
**Status:** Approved  
**Scope:** Offline-first TypeScript backend subsystem for React Native Expo, with direct local LM Studio integration, SQLite persistence, and portable export/sharing.

---

## 1. Context and goals

OwlSet is a mobile-first, local-AI workspace that helps freelancers turn messy client messages into confirmed project agreements, evaluate new requests against those agreements, and draft change proposals.

### Key decisions agreed
1. **Primary runtime:** The backend subsystem (database migrations, repositories, business logic, prompt builders, schema validation, and inference adapters) runs directly in TypeScript inside the React Native Expo app under `src/`.
2. **Local inference connection:** Connects directly from the app to LM Studio's OpenAI-compatible HTTP endpoint (`/v1/chat/completions`) running on the local machine or host network, with a configurable host setting. An abstract `LLMEngine` interface allows swapping to an embedded on-device model engine later with zero business logic changes.
3. **Database:** Local SQLite via `expo-sqlite` with WAL mode, foreign keys, and versioned migrations.
4. **Offline boundaries:** 100% functional offline. Online database sync is deferred to Phase 2.
5. **Portable sharing and backup:** Includes native one-tap proposal sharing via React Native `Share` API and full project JSON backup/restore via an `ExportService`.
6. **Seed data:** Includes an idempotent demo seed loader containing the 5-page website scenario from `PROJECT.md`.

---

## 2. Directory structure

```text
src/
├── types/
│   ├── index.ts               # Shared domain interfaces and enums
│   ├── project.ts             # Project, agreement, and requirement types
│   ├── scopeguard.ts          # Request and analysis types
│   ├── changedesk.ts          # Proposal types
│   └── schemas.ts             # Zod validation schemas for all entities
├── database/
│   ├── client.ts              # SQLite connection, PRAGMA configuration, query helpers
│   ├── migrations/
│   │   ├── index.ts           # Ordered migration registry
│   │   └── 001_initial.ts     # Initial tables, indexes, and constraints
│   ├── migrate.ts             # Transactional migration runner
│   ├── seed.ts                # Idempotent demo project seed loader
│   └── repositories/
│       ├── projectRepository.ts
│       ├── agreementRepository.ts
│       ├── scopeGuardRepository.ts
│       ├── proposalRepository.ts
│       └── settingsRepository.ts
├── llm/
│   ├── contracts.ts           # LLMEngine and LLMMessage interfaces
│   ├── jsonParser.ts          # Markdown fence stripper and Zod schema parser
│   ├── adapters/
│   │   └── lmStudioAdapter.ts # OpenAI-compatible HTTP adapter for LM Studio
│   └── prompts/
│       ├── briefCraftPrompt.ts # Extraction prompt builder
│       ├── scopeGuardPrompt.ts # Comparison prompt builder
│       └── changeDeskPrompt.ts # Proposal draft prompt builder
└── services/
    ├── briefCraftService.ts   # Raw text -> structured scope draft
    ├── kasunduanVaultService.ts # Scope confirmation -> immutable agreement
    ├── scopeGuardService.ts   # New request -> classification & evidence mapping
    ├── changeDeskService.ts   # User estimates + findings -> change proposal
    ├── exportService.ts       # JSON backup & restore
    ├── shareService.ts        # Native one-tap sharing
    └── bootstrapService.ts    # App initialization, migrations, and seed loading
```

---

## 3. Data layer specification

### SQLite schema (`001_initial.ts`)

```sql
-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  client_name TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Agreements (immutable snapshots)
CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  budget_amount REAL,
  budget_currency TEXT NOT NULL DEFAULT 'PHP',
  budget_notes TEXT,
  duration_days INTEGER,
  deadline TEXT,
  timeline_notes TEXT,
  revision_terms TEXT,
  exclusions_json TEXT NOT NULL DEFAULT '[]',
  missing_info_json TEXT NOT NULL DEFAULT '[]',
  confirmed_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, version_number)
);

-- Requirements (stable identifiers per agreement)
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT NOT NULL,
  agreement_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  PRIMARY KEY (agreement_id, id),
  FOREIGN KEY (agreement_id) REFERENCES agreements(id) ON DELETE CASCADE
);

-- Client Requests
CREATE TABLE IF NOT EXISTS client_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  agreement_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (agreement_id) REFERENCES agreements(id)
);

-- ScopeGuard Analyses
CREATE TABLE IF NOT EXISTS scopeguard_analyses (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  agreement_id TEXT NOT NULL,
  classification TEXT NOT NULL,
  summary TEXT NOT NULL,
  findings_json TEXT NOT NULL,
  clarification_questions_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES client_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (agreement_id) REFERENCES agreements(id)
);

-- Change Proposals
CREATE TABLE IF NOT EXISTS change_proposals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  analysis_id TEXT NOT NULL,
  selected_items_json TEXT NOT NULL,
  freelancer_fee_estimate REAL,
  freelancer_days_estimate INTEGER,
  currency TEXT NOT NULL DEFAULT 'PHP',
  draft_message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (analysis_id) REFERENCES scopeguard_analyses(id)
);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agreements_project ON agreements(project_id);
CREATE INDEX IF NOT EXISTS idx_requirements_agreement ON requirements(agreement_id);
CREATE INDEX IF NOT EXISTS idx_client_requests_project ON client_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_scopeguard_agreement ON scopeguard_analyses(agreement_id);
CREATE INDEX IF NOT EXISTS idx_change_proposals_project ON change_proposals(project_id);
```

---

## 4. LLM layer specification

### Contract (`contracts.ts`)

```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMEngine {
  isAvailable(): Promise<boolean>;
  generate(messages: LLMMessage[], options?: GenerationOptions): Promise<string>;
}
```

### LM Studio adapter (`lmStudioAdapter.ts`)
- Communicates with `http://<configured_ip>:1234/v1/chat/completions`.
- Default endpoint resolver:
  - Android Emulator: `http://10.0.2.2:1234/v1`
  - Web or iOS Simulator: `http://localhost:1234/v1`
  - Configurable via `SettingsRepository` for physical device LAN IPs.
- Implements request timeout (60 seconds) and connectivity check (`GET /v1/models`).

### Resilient JSON parser (`jsonParser.ts`)
1. Strips Markdown code blocks (` ```json `, ` ``` `).
2. Uses regex to extract the outermost `{ ... }` if surrounding text exists.
3. Parses with `JSON.parse` and validates against the provided Zod schema.
4. Throws structured `LLMParseError` with raw text context for UI recovery and retry.

---

## 5. Application services specification

### 1. `BriefCraftService`
- Ingests raw conversation text.
- Validates input length (non-empty, maximum 15,000 characters).
- Formats prompt via `briefCraftPrompt.ts`.
- Executes LLM generation at `temperature = 0.1`.
- Assigns sequential `REQ-01`, `REQ-02` identifiers to deliverables and terms.
- Returns `ScopeDraft` containing requirements, budget, timeline, revision terms, and missing information.

### 2. `KasunduanVaultService`
- Receives reviewed `ScopeDraft` and `projectId`.
- Determines next version number for project (starts at 1).
- In a single SQLite transaction:
  - Inserts `agreements` record.
  - Inserts all `requirements` records.
- Returns immutable `AgreementVersion` entity.

### 3. `ScopeGuardService`
- Ingests `projectId`, `agreementId`, and `requestText`.
- Loads confirmed agreement and requirements from SQLite.
- Formats prompt via `scopeGuardPrompt.ts`.
- Executes LLM generation at `temperature = 0.1`.
- Verifies every cited `evidence_requirement_ids` against existing requirement IDs in the database, stripping hallucinations.
- Persists `client_requests` and `scopeguard_analyses` records.
- Returns `ScopeGuardAnalysis`.

### 4. `ChangeDeskService`
- Ingests `analysisId`, `selectedItems`, `freelancerFee`, and `freelancerDays`.
- Injects freelancer inputs into `changeDeskPrompt.ts`.
- Executes LLM generation at `temperature = 0.4` for natural, collaborative phrasing.
- Persists `change_proposals` record with status `draft`.
- Returns `ChangeProposal`.

### 5. `ExportService` & `ShareService`
- `ExportService.exportProject(projectId)`: Returns a validated JSON string of the complete project tree.
- `ExportService.importProject(jsonString)`: Validates JSON with Zod and reconstructs the project and agreements idempotently.
- `ShareService.shareProposal(proposal)`: Opens native device share sheet with formatted text.
- `ShareService.shareAgreement(agreement)`: Opens native device share sheet with scope summary.

### 6. `BootstrapService`
- Runs pending SQLite migrations.
- Seeds demo project if database has 0 projects.
- Verifies engine availability.

---

## 6. Error handling and boundaries

1. **Database errors:** Handled via typed repository exceptions. Read operations return null or empty arrays; write failures roll back transactions.
2. **Inference timeout or offline engine:** `LLMEngineUnavailableError` returned when LM Studio cannot be reached, allowing UI to suggest checking the server URL.
3. **Model output corruption:** `LLMParseError` captured and surfaced to allow one-click retry.
4. **Data immutability:** Confirmed agreements cannot be updated or overwritten. Any changes require creating a new agreement version.

---

## 7. Testing strategy

1. **Unit tests:**
   - Zod schema validation tests for valid and malformed payloads.
   - Resilient JSON parser tests with markdown blocks, leading/trailing whitespace, and incomplete formatting.
   - Prompt builder output tests verifying requirement formatting and injection rules.
2. **Integration tests:**
   - Database migration and repository CRUD operations using an in-memory SQLite database.
   - Pipeline service execution using a mocked `LLMEngine`.
   - Seed loader idempotency test verifying no duplicates on multiple runs.
