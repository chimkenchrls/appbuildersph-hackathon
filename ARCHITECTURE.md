# React Native + Expo Architecture for Offline Local-LLM Applications

This reusable guide defines the directory structure, layer boundaries, local data model, inference lifecycle, safety rules, and verification requirements for a project-agnostic mobile application. Adapt feature names to the product while retaining these engineering conventions.

## 1. Scope and architectural principles

The application runs entirely on the device. Its core capabilities are a generic local data library, saved conversations, and inference using locally installed language-model weights. Android is the primary deployment target, delivered as a signed, standalone APK for direct installation. Preserve iOS compatibility where practical; iOS delivery and web support are secondary capability decisions.

Use EAS cloud builds with the `preview` profile for test APKs and the `apk` profile for release candidates. Both explicitly set `android.buildType` to `apk` in `eas.json`; the `apk` profile inherits production version incrementing. The existing `production` profile remains available for a future Google Play AAB workflow. Record the artifact link, app version, and source commit for each shared build. Keep the Android package identifier and signing key stable across upgrades. No native cloud build or offline acceptance is implied by configuration alone. [Expo APK build documentation](https://docs.expo.dev/build-reference/apk/).

1. **Fully offline operation.** After installation, first launch, navigation, data editing, search, model setup, inference, history, and settings must work without connectivity. Ship a compatible model in the installed package, or support import from a file already on the device. An app that requires a first-run download does not satisfy this requirement. Model import is optional when a usable model is bundled.
2. **No remote runtime dependencies.** No cloud inference, login, remote configuration, telemetry, online fonts, hosted content, or remote safety checks. Configure automatic update checks and third-party SDKs consistently with this policy. Build-time tooling may use the network; the installed release must not depend on it.
3. **Local data ownership.** SQLite holds structured records; private persistent files hold model weights and attachments. Export is an explicit user action. Do not add sync queues or remote IDs without an actual product requirement.
4. **Clear layers.** Routes and components consume hooks; hooks invoke application services and repositories. Screens never execute SQL or call native inference directly.
5. **Replaceable inference engine.** A typed adapter isolates the native engine from product logic. Keep tokenizer, model format, chat template, and engine compatibility explicit.
6. **Bounded resource use.** Limit input size, context, output tokens, concurrent generation, file imports, storage, and memory. Preserve a useful data-only experience when inference is unavailable.
7. **Versioned changes.** Use incremental database migrations, versioned model manifests, and recorded prompt/policy revisions. Pin dependencies in the lockfile.
8. **Private and safe by design.** Treat imported content and model output as untrusted. Prompts alone are not security boundaries.

## 2. Expo and native integration

Use TypeScript and Expo Router. Put route files in `src/app/`; keep reusable feature implementations outside that directory. Do not maintain a second navigation root or duplicate route tree.

A native local-LLM library typically requires a **development build and a release native build**, because Expo Go cannot load arbitrary custom native code. Integrate through a compatible React Native binding or a local Expo module. A llama.cpp-based engine is one possible implementation; the architecture does not mandate a specific binding. Validate its maintained version, license, model support, CPU/GPU backends, cancellation, and Android/iOS compatibility before adoption. [Expo custom native code documentation](https://docs.expo.dev/workflow/customizing/), [llama.cpp project](https://github.com/ggml-org/llama.cpp).

Read `package.json` and the lockfile before choosing SDK APIs. Use documentation for the project's installed Expo SDK, rather than copying a fixed SDK version from this guide. Rebuild the native app after native dependencies or configuration change.

Record in `docs/decisions/`: supported OS/device baseline, Expo and React Native versions, engine/binding revision, model format and license, quantization, maximum context, memory budget, and measured fallback behavior. Verify on physical devices; simulator results are insufficient for performance claims.

Choose one native-project strategy:

- **Continuous Native Generation:** reproducible config plugins and local modules; generated `android/` and `ios/` folders are not hand-edited.
- **Committed native projects:** native modifications are version controlled and maintained explicitly.

Large model files need a deliberate packaging strategy, asset/native build configuration, and install-size verification. Do not assume a multi-gigabyte model can be imported by Metro like an image. A bundled model must be packaged locally, rather than resolved from a remote asset URL.

## 3. Canonical directory structure

```text
project/
├── assets/
│   ├── data/                    # Optional local seed data
│   ├── models/                  # Model manifests; weights if packaging supports them
│   ├── fonts/                   # Bundled fonts
│   └── images/                  # Icons and static images
├── src/
│   ├── app/                     # Expo Router routes only
│   │   ├── _layout.tsx           # Providers, initialization, error boundary
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Home / local library
│   │   │   ├── chat.tsx          # New conversation
│   │   │   ├── history.tsx       # Saved conversations and activity
│   │   │   └── settings.tsx      # Privacy and inference preferences
│   │   ├── item/[id].tsx         # Generic local record details
│   │   ├── conversation/[id].tsx # Existing conversation
│   │   └── models/index.tsx      # Model import, activation, removal
│   ├── screens/                 # Screen implementations composed by routes
│   ├── components/
│   │   ├── ui/                  # Button, input, card, dialog, status badge
│   │   ├── data/                # Item card, editor, search/filter controls
│   │   ├── chat/                # Message list, composer, generation controls
│   │   └── models/              # Model card, import progress, readiness state
│   ├── hooks/                   # useLibrary, useConversation, useModels, useBootstrap
│   ├── stores/                  # Ephemeral UI and runtime state
│   ├── database/
│   │   ├── client.ts            # Connection and pragmas
│   │   ├── migrations/          # Ordered immutable migrations
│   │   ├── migrate.ts           # Transactional migration runner
│   │   ├── seed.ts              # Idempotent seed loader
│   │   └── repositories/       # Items, conversations, messages, models, settings
│   ├── services/
│   │   ├── bootstrap.ts         # Startup orchestration and crash recovery
│   │   ├── conversations.ts     # Generation orchestration and persistence
│   │   ├── modelLifecycle.ts    # Import, verification, activation, removal
│   │   ├── storage.ts           # Private paths, quotas, cleanup
│   │   └── export.ts            # User-approved portable exports
│   ├── llm/
│   │   ├── contracts.ts         # Engine-independent interfaces
│   │   ├── adapters/native.ts   # Native engine implementation
│   │   ├── scheduler.ts         # Serialized inference ownership
│   │   ├── promptBuilder.ts     # Chat template and context budgeting
│   │   ├── modelManifest.ts     # Manifest validation and compatibility
│   │   └── errors.ts            # Typed runtime errors
│   ├── safety/                 # Input/output policy, schema validation, redaction
│   ├── types/                  # Persistent and application types
│   ├── constants/              # Resource limits and defaults
│   └── utils/                  # Pure formatting, IDs, file checks, validators
├── modules/local-llm/           # Optional custom Expo native module
├── plugins/                    # Optional native config plugins
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── device/
│   └── fixtures/               # Small models, corrupt files, policy cases
├── docs/decisions/
├── app.config.ts               # App configuration and native permissions
├── metro.config.js             # Asset configuration when needed
├── AGENTS.md                   # Repository implementation instructions
├── ARCHITECTURE.md
├── package.json
└── tsconfig.json
```

Routes should be thin wrappers around screens. `screens/` contains no route definitions. Do not create duplicate `App.tsx` navigation when Expo Router is the entry point. This routing convention follows [Expo Router notation](https://docs.expo.dev/router/basics/notation/).

## 4. Dependencies and data flow

```text
Route → Screen / Component → Hook → Application service
                                      ├─ Repository → SQLite
                                      ├─ Storage service → Private files
                                      └─ LLM scheduler → Adapter → Native engine
```

Shared types and pure utilities must not import routes or UI. The LLM layer must not import React components. Native resources have one owner; component unmounting does not implicitly destroy a globally shared model.

Use stores for selected tabs, drafts, progress, and runtime state. SQLite is the source of truth for saved data. Avoid storing a second full persistent history in a UI store. Expose loading, empty, ready, denied, unavailable, and error states explicitly.

## 5. Offline storage and database

Use `expo-sqlite` with WAL and foreign keys enabled on the relevant connections. Complete migrations before repository access. Apply each migration and its `schema_migrations` record in a transaction; serialize startup and migration execution. A migration failure blocks writes and offers recovery without silently resetting user data.

For a bundled seed database, copy it to its writable destination **before opening it** on first install. Alternatively, create tables through migrations and seed them afterward. Never overwrite an existing user database. Use idempotent seed versions. See [Expo SQLite documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/).

### Recommended entities

| Table | Purpose and key fields |
| --- | --- |
| `schema_migrations` | `version` primary key, `applied_at` |
| `items` | UUID `id`, `title`, `body`, `created_at`, `updated_at`, optional validated `metadata_json` |
| `conversations` | UUID `id`, `title`, timestamps |
| `messages` | UUID `id`, `conversation_id`, ordered `sequence`, `role`, `content`, `status`, timestamps |
| `generation_runs` | UUID `id`, assistant `message_id`, model ID and revision, prompt/policy revision, sampling config, token counts, finish reason, duration, sanitized error code |
| `models` | Logical ID plus revision, private relative path, format, size, digest, template/tokenizer identifiers, license, compatibility metadata, installation status |
| `attachments` | UUID `id`, owning record/message, private relative path, MIME type, byte size, digest |
| `settings` | Typed setting key, validated value, schema version |

Model revisions should be immutable and uniquely identified. A conversation can contain runs from different models; record provenance per run. Message roles and statuses use constrained values; statuses include `pending`, `generating`, `completed`, `cancelled`, `interrupted`, and `failed`.

Use foreign keys with documented deletion semantics. Index message order by `(conversation_id, sequence)` with uniqueness, conversation update times, and common item search fields. Add full-text search only when needed and maintain it transactionally. Keep generated token probabilities separate from factual confidence: they are not a calibrated correctness score.

All variable SQL inputs must be bound parameters:

```typescript
const item = await db.getFirstAsync<ItemRow>(
  'SELECT id, title, body FROM items WHERE id = ?',
  [itemId],
);
```

Use fixed allowlists for SQL identifiers and sort clauses. Static migration SQL is permitted; user input must never be interpolated. Finalize prepared statements and keep transactions short. Persist streaming output in bounded batches, not one database write per token.

### File ownership and privacy

- Resolve model files, attachments, and exports through the storage service using generated internal filenames. Reject traversal, unsupported formats, excessive file sizes, and unsafe archive entries.
- Store installed models and user content in private persistent storage. Cache is for disposable staging only. Persist relative paths when possible; resolve the current sandbox root at runtime.
- Use the installed SDK's supported FileSystem API; current documentation describes `File`, `Directory`, and `Paths`. Do not mix legacy examples into the adapter without checking compatibility. [Expo FileSystem documentation](https://docs.expo.dev/versions/latest/sdk/filesystem/).
- Reserve space for staging, final copies, temporary conversion, database growth, and a safety margin. Calculate peak required space; a universal “twice the model size” rule is insufficient for every import path.
- SQLite and ordinary files are not automatically encrypted by choosing Expo. If confidentiality requires encryption at rest, choose and test a compatible encrypted database/file design. Keep small keys in an appropriate secure credential store, not model weights or chat history.
- Define OS backup exclusions, encryption-key recovery behavior, retention, and deletion policy. Clear conversation data, attachments, exports, and derived indexes consistently. Do not claim secure physical erasure on flash storage.

## 6. Local LLM contract and inference lifecycle

The following interfaces are architectural contracts, not calls to a specific engine SDK:

```typescript
type GenerationEvent =
  | { type: 'delta'; runId: string; text: string }
  | { type: 'done'; runId: string; reason: 'stop' | 'length' | 'cancelled' }
  | { type: 'error'; runId: string; code: string };

interface LocalLLMEngine {
  load(model: VerifiedModel, options: RuntimeOptions): Promise<void>;
  countTokens(messages: PromptMessage[]): Promise<number>;
  generate(request: GenerationRequest): AsyncIterable<GenerationEvent>;
  cancel(runId: string): Promise<void>;
  unload(): Promise<void>;
}
```

Define every referenced type in `contracts.ts`. The adapter must document whether cancellation resolves only after native work stops. Its terminal event and cleanup rules must be deterministic. Use run IDs to discard stale callbacks after cancellation or navigation.

### Runtime state machine

```text
unloaded → loading → ready → generating → ready
               └─ error         └─ cancelling → ready
ready → unloading → unloaded
```

The scheduler serializes load, generate, cancel, switch, and unload operations. Permit one active generation initially; reject or bound queued requests. Wait for native cancellation to finish before unloading or switching models. Keep inference off the JavaScript/UI thread and throttle streamed UI updates.

### Generation sequence

1. Validate input and readiness; persist the user message and a pending assistant message/run.
2. Build the prompt with the model's exact chat template and tokenizer. Separate system instructions, history, and untrusted local document excerpts.
3. Count tokens with the compatible tokenizer. Reserve output tokens and template overhead. Trim oldest history or retrieve bounded excerpts deterministically; never silently remove required safety instructions.
4. Run native inference with bounded context, output, threads, and validated sampling settings. Record the effective settings.
5. Stream deltas to the UI and periodically checkpoint content. Validate output before any structured result is accepted or any action is proposed.
6. Persist the final content and finish reason. Cancellation preserves clearly marked partial content; failure does not masquerade as a completed answer.

At startup, mark abandoned `generating` runs as `interrupted`. Retry creates a new run; it must not duplicate the original user message accidentally.

Model file size is not peak RAM. Budget weights, KV cache, context, compute buffers, and application overhead using device measurements. Select conservative defaults and reduce context or use a smaller compatible model after recoverable allocation failures. The OS may terminate the process before an out-of-memory error can be caught.

On backgrounding, cancel and checkpoint by default; release resources when policy and platform allow. Do not assume unrestricted background inference. Handle thermal pressure, low battery, memory warnings, and foreground recovery. No remote fallback.

## 7. Model installation and lifecycle

Keep installation state separate from runtime state:

```text
absent → staging → verifying → installed
                    └─ invalid
installed → removing → absent
```

Each model manifest includes an ID, revision, format, file size, cryptographic digest, license, architecture/quantization, tokenizer and template references, supported engine revision range, context limit, and measured device recommendations. Optional embedding models have their own manifests.

1. Copy a bundled asset or user-selected local file to a private staging location. A system picker may expose cloud placeholders; handle unavailable local bytes without initiating a required network workflow.
2. Check space and quotas before copying. Stream copying and hashing; do not load the full model into JavaScript memory.
3. Validate size, digest, format, compatibility, and required companion files. A checksum only proves identity against an expected digest; publisher authenticity requires a trusted bundled manifest or verified signature.
4. Promote verified files using a crash-safe protocol, then commit installation metadata. File moves and SQLite writes are not one atomic transaction; startup reconciliation must handle either side completing alone.
5. Activate only after successful loading and a small bounded smoke inference. Retain the previous known-good installation until activation succeeds.
6. Block removal of a model in use, or cancel and unload before deletion. Clean orphaned staging files with age/ownership checks. Never delete unrelated user files.

Bundled baseline models provide first-launch availability. User-imported replacements and new app releases provide offline upgrades. No download manager is required in this architecture.

## 8. Safety and privacy boundaries

- Imported documents, filenames, messages, and generated text are untrusted data. Local execution does not eliminate prompt injection or hallucinations.
- Use an explicit input/output policy appropriate to the product. Explain uncertainty and allow stopping generation. Local policy checks must work without network access; refusal behavior needs evaluation across supported models and languages.
- Render generated text without executing scripts, raw HTML, SQL, file paths, or deep links. External links require explicit user action and must not be necessary for core use.
- Default to conversational output with no autonomous tools. If tools are introduced, use an allowlisted registry, schema validation, bounded arguments, and confirmation for destructive or externally visible actions. Enforce permissions in application code, never by trusting the model's instructions.
- Grammar-constrained generation may improve output shape where supported; validate the complete result against a schema and business rules before persisting structured data or performing actions.
- Keep logs local, bounded, and redacted. Exclude prompts, document content, keys, and full filesystem paths by default. Export diagnostics only on explicit request.
- Export previews should show included data and redaction choices. Permissions must be minimal and requested when needed. Denial must offer a usable fallback.

## 9. Frontend conventions

Use function components, strict TypeScript, reusable design-system primitives, and accessible labels. Avoid `any`; distinguish database rows, application entities, and runtime events. Use stable IDs for lists, virtualize long histories, and keep keyboard/safe-area behavior consistent.

The home screen exposes local records and search. Chat exposes model readiness, a composer, token-limit feedback, streamed messages, Stop, and retry. History loads saved conversations from repositories. Model management displays installed revision, size, compatibility, import status, activation, and removal. Settings exposes resource limits, retention, privacy, and explicit export/delete controls.

Disable duplicate Send while the scheduler is busy. Preserve drafts through navigation. Display actionable states for no model, incompatible model, corrupt import, low disk space, and interrupted generation. Distinguish optional permissions from required capabilities; permission denial must not crash startup.

Optional local retrieval belongs behind a service: parse bounded supported documents, chunk locally, retrieve with SQLite search or a compatible local embedding index, and attach source references. Store index/model versions, rebuild after incompatible changes, and remove derived chunks when their source is deleted. Retrieval is not required for basic chat.

## 10. Verification and release acceptance

| Level | Required evidence |
| --- | --- |
| Static | Type checking, linting, compatible dependency/native configuration |
| Unit | Context budgeting, state transitions, path validation, manifest validation, safety rules |
| Integration | Migration rollback, repositories, file/DB reconciliation, generation cancellation, partial-message recovery |
| Physical device | Native load/generate/unload, rapid model switching, backgrounding, memory and thermal behavior |
| Offline release | Fresh installed release launches and completes all core flows in airplane mode without a development server |
| Evaluation | Fixed local prompt set for helpfulness, policy handling, injection resistance, structured-output validity, and supported languages |

Use a fake adapter for orchestration tests and a small compatible real model for native integration. Do not assert identical natural-language output across all hardware/backends. Assert terminal events, bounded tokens, valid structures, and measured quality thresholds instead.

The Android release gate uses the signed standalone APK on physical devices, including the minimum supported device baseline. Verify fresh installation, offline first launch, model setup, inference, persistence, relaunch, and upgrade from the previous APK without losing local data. A development-client session, Expo Go preview, or web export does not satisfy this gate. Deliver offline upgrades as replacement APKs; automatic OTA checks must not introduce runtime network dependencies.

Test missing/corrupt/truncated model files, denied picker access, disk exhaustion, oversized input, repeated Send/Stop, app termination mid-import and mid-generation, deleted attachments, and database upgrades from each supported prior schema. Include device tests that inspect runtime network activity; airplane mode alone can conceal attempted network dependencies.

Record cold/warm load time, time to first token, tokens per second, peak memory, disk use, sustained thermal behavior, and cancellation latency on minimum supported devices. Set explicit project-specific acceptance thresholds before release.

Run the project's configured tests plus `npx tsc --noEmit` and `npx expo lint` when supported by its tooling. A guide-only edit requires document validation; it does not establish that an app builds or passes device tests.

## 11. Implementation rules for developers and AI agents

1. Inspect the actual repository instructions, dependency versions, and existing conventions before editing.
2. Keep routes in `src/app/` and non-route implementations outside it.
3. Access persistent data through repositories and native inference through the adapter/scheduler.
4. Bind SQL values; validate all import, export, structured-output, and tool boundaries.
5. Maintain migration history and model provenance. Do not invent sync metadata or confidence scores.
6. Preserve the fully offline contract, including first launch. Do not add cloud fallback or hidden network dependencies.
7. Respect cancellation, lifecycle ownership, storage quotas, and measured device limits.
8. Use installed-SDK APIs and reproducible native integration. Document compatibility decisions.
9. Run checks appropriate to the change and report the checks actually completed.
10. Add product-specific features through these seams rather than coupling them to storage or the engine.

## 12. Adoption checklist

- [ ] Select supported devices, engine/binding, and a licensed baseline model.
- [ ] Record compatible versions and establish a reproducible native build.
- [ ] Package local baseline weights or define the local-import setup experience.
- [ ] Implement SQLite migrations, repositories, private storage, and crash reconciliation.
- [ ] Implement typed engine adapter, serialized scheduler, prompt budgeting, and cancellation.
- [ ] Compose generic routes, screens, components, and explicit failure states.
- [ ] Define safety, privacy, backup, export, and deletion behavior.
- [ ] Measure resource limits and quality on physical devices.
- [ ] Pass fresh-install offline release acceptance before claiming full offline support.

Documentation links are references for implementers; the application must not require access to them at runtime. This guide intentionally avoids hardcoding an Expo SDK, model family, engine binding, or performance promise.
