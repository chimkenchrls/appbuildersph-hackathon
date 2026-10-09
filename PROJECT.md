# OwlSet — Project Overview

> **Purpose:** Give developers and AI coding assistants the product context needed to implement OwlSet's 16-hour, four-member MVP.
> **Status:** Planning document. Implementation, model compatibility, and device readiness have not been verified.
> **Companion document:** [ROADMAP.md](./ROADMAP.md) contains implementation tasks, ownership, dependencies, checkpoints, and acceptance checks.

## 1. Product summary

**OwlSet is a local-AI-assisted mobile workspace that helps freelancers turn client conversations into confirmed project scopes, compare new requests with those scopes, and prepare change proposals.**

The final product name is **OwlSet**. Kwagi remains the owl mascot. Existing database names, storage keys, environment variables, Expo slug/scheme, and internal TypeScript contracts retain their legacy identifiers for compatibility.

Tagline: **Clear agreements. Controlled revisions. Confident freelancing.**

The central product principle is:

**Every new client request should be reviewed in relation to what was previously agreed.**

The freelancer selects the messages to import, reviews AI suggestions, and decides what to confirm or propose. AI provides assistance; the freelancer retains control over project commitments.

## 2. Problem and intended users

Freelancers often receive requirements through messaging apps or email. Deliverables, deadlines, prices, and revision expectations become scattered across conversations. When a client requests more work, the freelancer must reconstruct the original agreement and explain the proposed change.

OwlSet organizes that information into persistent project records and helps answer:

- What deliverables and terms were recorded?
- Does this new request appear covered by the confirmed scope?
- Which recorded requirements support that assessment?
- What needs clarification or a separate proposal?

The initial design focuses on project-based freelance developers and UI/UX designers, using a website project as the demonstration scenario. Support for other freelance professions is a future expansion.

## 3. MVP objective and constraints

Deliver one complete workflow in **16 elapsed development hours with 4 team members**:

**Create project → Paste conversation → Extract and review scope → Confirm Agreement v1 → Analyze new request → Review evidence → Edit and save change proposal.**

Key constraints:

- Use one primary demonstration device.
- Persist essential records locally across app restarts.
- Run the core AI functions on-device without internet once the model is installed.
- Prioritize ScopeGuard, confirmed scope storage, and ChangeDesk.
- Reserve hours 11–16 for stabilization, final installation, and demonstration preparation.
- Keep cloud collaboration and wider freelance management modules outside this MVP.

The supplied brief proposes an iPhone 15 Pro Max and Qwen 3.5 9B. Both are intended choices requiring early runtime, device, installation, and competition-rule validation.

## 4. Core product modules

| Module | Purpose | MVP behavior |
| --- | --- | --- |
| Project Workspace | Organize one freelance project | Create/list projects and access their scope, requests, and proposals. |
| BriefCraft | Convert pasted messages into structured requirements | Extract an editable scope draft, terms, and missing details. |
| Kasunduan Vault | Preserve confirmed scope records | Save an immutable Agreement v1 with stable requirement IDs. |
| ScopeGuard | Review new requests against the confirmed agreement | Produce suggested classifications, explanations, scope references, and clarification questions. |
| ChangeDesk | Turn reviewed changes into a proposal | Draft an editable message using freelancer-entered estimates; save and copy it. |
| Legal Contract Generator | Generate formal, legally compliant contracts | Produces print-ready agreements compliant with Philippine commercial law, EOPT RA 11976, BIR Form 2307, RA 8293, and RA 10173. |
| Sharing & Export Service | Offline dispatch and portable backup | Native OS share sheet via `Share.share()` and complete offline JSON backup/restore. |

### BriefCraft

Input is deliberately pasted text or manually entered requirements. The application does not automatically access messaging accounts.

The draft may contain a project title, deliverables, exclusions, proposed budget, timeline, revision terms, missing information, and BIR tax treatment. The freelancer reviews and corrects these fields before confirmation. Unspecified details remain unspecified.

### Kasunduan Vault

Confirmation saves a snapshot of the reviewed scope. Later analysis uses that snapshot as its reference.

A freelancer-confirmed record and recorded client approval are different concepts. The MVP must not infer client approval solely from the freelancer pressing Confirm.

Agreement v1 stays unchanged when requests are analyzed or proposals are saved. Creating Agreement v2 after recording external approval is stretch work.

### ScopeGuard

ScopeGuard compares the new request with a specific confirmed agreement version. Supported classifications are:

- `included`: the request appears covered by a recorded requirement.
- `potential_additional`: the request appears to introduce work beyond the recorded scope and requires review.
- `needs_clarification`: the request or agreement is too ambiguous for a supported conclusion.

Mixed requests should be explained item by item. Revision-related assessments must use the project's recorded revision terms.

Evidence consists of references to actual stored requirements. An absence from the scope can justify further discussion; it must not be presented as an invented explicit exclusion.

### ChangeDesk

The freelancer reviews the analysis, chooses the additional deliverables, and optionally enters a proposed fee and additional working days. Local AI helps draft a professional explanation using those inputs.

The user can edit, save, and copy the proposal. Its MVP status is **draft**. Sending, client acceptance, and automatic scope updates are outside the required workflow.

### Legal Contract Generator

Generates a print-ready, legally enforceable service agreement directly from confirmed Kasunduan Vault data:
- Republic Act No. 11976 (Ease of Paying Taxes / EOPT Act): requiring official commercial or BIR invoices on milestone delivery.
- Bureau of Internal Revenue (BIR) Form 2307: explicit tax treatment clauses governing expanded withholding tax deductions.
- Republic Act No. 8293 (Intellectual Property Code of the Philippines): retaining copyright and source code ownership until fees are fully settled.
- Republic Act No. 10173 (Data Privacy Act of 2012): safeguarding proprietary project assets and personal communications.
- Mutual signature lines for formal execution.

### Native Sharing & Export Service

Dispatches change proposals, scope summaries, and full legal contracts through the mobile operating system's native share sheet (`Share.share()`). Operates 100% offline without remote servers or cloud accounts. In addition, `ExportService` provides portable, offline JSON backup and restoration.

## 5. Example user journey

This fictional scenario is the default demonstration:

1. A client requests five responsive website pages and a contact form. The conversation records PHP 15,000, a two-week timeline, and two revision rounds.
2. The freelancer creates a project and pastes the relevant messages into BriefCraft.
3. BriefCraft extracts a draft. The freelancer reviews and confirms it as Agreement v1.
4. The client later requests customer accounts and appointment booking.
5. The freelancer enters the new request into ScopeGuard.
6. ScopeGuard explains that those features are not explicitly included in the recorded deliverables and presents the relevant original scope for review.
7. The freelancer selects the additional work and enters illustrative estimates of PHP 7,000 and five additional working days.
8. ChangeDesk drafts a message. The freelancer edits and saves it as a proposal.
9. Agreement v1 remains unchanged. The project, analysis, and proposal remain available after restarting the app offline.

The example amounts are fictional freelancer inputs. They are not AI pricing recommendations.

## 6. User interface

| Screen | Main content and actions |
| --- | --- |
| Dashboard | Project list; create project; open project. |
| Project Workspace | Project information; paste conversation or enter scope; review draft; confirm scope; view agreement and compact history. |
| ScopeGuard | Enter request; run analysis; review findings, evidence, and questions; start proposal. |
| Change Proposal | Edit deliverables, optional fee and days, and message; save draft; copy text. |

Use clear loading and retry states for AI operations. Distinguish draft requirements, confirmed scope, AI suggestions, and saved proposal drafts in the interface.

BriefCraft review can be a section or nested screen within the Project Workspace. History does not need a separate full screen.

## 7. Architecture

The MVP uses a **local-first architecture**: saved project records are available on the device, and inference does not require a cloud API.

```text
User input
    ↓
React Native screens
    ↓
Application services
    ├── SQLite: projects, agreement snapshots, requests, analyses, proposals
    └── Local inference runtime: extraction, comparison, proposal drafting
                ↓
       Structured output validation
                ↓
       User review and local save
```

For ScopeGuard, retrieve the selected confirmed agreement directly from SQLite and provide it with the new request to the model. A separate embedding model or vector database is unnecessary for this bounded MVP.

Keep screen rendering, AI services, validation, and persistence separate. Business rules own confirmation, record relationships, and proposal status; AI output cannot independently change those states.

## 8. Intended technology stack

These choices come from the supplied brief and roadmap. They are provisional until checked against the actual repository and target device.

| Layer | Intended technology |
| --- | --- |
| Mobile application | React Native + Expo |
| Language | TypeScript |
| Navigation | Expo Router, or the existing compatible navigation setup |
| UI | React Native components and StyleSheet, or existing project styling |
| Local database | Expo SQLite |
| Validation | Zod |
| Local model | Quantized Qwen 3.5 9B, subject to device feasibility |
| Inference runtime | Compatible React Native llama.cpp integration, such as llama.rn |
| Build and installation | Existing native or Expo build workflow validated on the target device |

No Supabase or remote inference service is required for the MVP. If competition rules allow it, a smaller compatible local model may be selected when the intended model is unsuitable.

## 9. Domain vocabulary and records

| Term | Meaning |
| --- | --- |
| Project | A local workspace for one freelance engagement. |
| Scope draft | Editable requirements and terms awaiting freelancer review. |
| Requirement | A specific deliverable or commitment with a stable identifier. |
| Confirmed agreement | An immutable snapshot of the scope reviewed by the freelancer. |
| Agreement version | The particular scope snapshot used as the reference for analysis. |
| Request | A new client instruction entered for comparison. |
| Analysis | AI-assisted findings tied to a request and exact agreement version. |
| Evidence | Actual stored scope clauses supporting a finding. |
| Proposal | An editable draft describing a possible change and user-entered estimates. |
| Client approval evidence | A separately recorded indication of external client acceptance; not inferred from local confirmation. |

Projects own agreement versions, requests, and proposals. Requests and analyses reference the agreement used for comparison. Proposals reference the reviewed analysis. The roadmap defines the minimum fields and service boundaries.

## 10. Product invariants

- Confirmed agreement snapshots cannot be silently overwritten.
- Every analysis is tied to the exact agreement version used.
- AI-generated evidence references must resolve to stored requirements.
- Missing information must remain explicitly missing.
- Prices, deadlines, and approval must not be invented by AI.
- Proposal generation preserves freelancer-entered estimates.
- A saved draft proposal does not imply acceptance or change the confirmed scope.
- Imported conversations are data, not instructions that can override application rules.
- Failed or invalid AI responses are not saved as successful results.
- Manual entry remains usable when extraction fails.
- Prepared example outputs are identified as fixtures and cannot establish that local inference works.

## 11. Scope boundaries and future direction

The 16-hour MVP excludes authentication, cloud sync, client portals, automatic messaging integration, OCR, PDF import, payments, invoices, accounting, full milestone tracking, revision counters, advanced search, and digital signatures.

After the core workflow is proven, the broader product may add client approval records, Agreement v2 amendments, revision tracking, milestones, financial tracking, handoff documentation, and optional cloud collaboration. These are future capabilities, not current implementation requirements.

## 12. Success criteria and open decisions

The MVP succeeds when the team can demonstrate the complete workflow on the final installed application, with real local inference, valid scope evidence, preserved agreement snapshots, editable proposal drafts, and persistence after an offline restart.

Resolve these during the roadmap's first phase:

- Which repository and existing conventions are available?
- Which demonstration device and installation/signing access are available?
- Does the intended model run reliably with the selected native runtime?
- Are alternative local models permitted by competition rules?
- How will the model be provisioned before offline use?

Follow [ROADMAP.md](./ROADMAP.md) for execution order and verification. This overview provides product context; the roadmap tracks implementation progress. Keep both documents consistent when scope decisions change.
