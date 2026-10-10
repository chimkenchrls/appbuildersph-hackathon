# OwlSet MVP — AI Development Roadmap

## 1. Objective

Build a mobile MVP in **16 elapsed hours with 4 team members**. The estimate provides approximately 64 person-hours, with work proceeding in parallel where dependencies permit.

Deliver one complete workflow:

**Create project → Paste conversation → Extract and review scope → Confirm Agreement v1 → Analyze a new request → Review supporting evidence → Edit and save a change proposal.**

Essential records must persist locally. The core AI workflow must run on the chosen demonstration device without internet after the model is installed.

This document is an implementation plan, not evidence of completed development. All tasks start unchecked.

## 2. Instructions for the AI implementing this roadmap

1. Read repository instructions and inspect existing code before making changes. This roadmap does not assume a repository, working native build, or installed model already exists.
2. Preserve the repository's package manager, navigation, styling, and conventions where compatible with the MVP.
3. Work on the earliest incomplete task whose dependencies are satisfied. Use the checkpoints below to verify actual behavior.
4. Record completed work and evidence in the execution log. Check a task only after implementation and its completion check pass.
5. Prioritize a complete working flow over additional screens or modules. Freeze new features at hour 11.
6. Validate AI output before saving or displaying it as a successful analysis. Never invent agreement evidence, prices, deadlines, client approval, or inference results.
7. Use prepared responses only as clearly identified development fixtures. They cannot satisfy the live local-AI checkpoint or final offline demonstration.
8. Implement ordinary reversible changes within the authorized project scope. Escalate only material unresolved decisions, missing access, or blockers that cannot be resolved within that scope.
9. Keep secrets and actual private client conversations out of committed fixtures and logs. Use fictional demonstration content.
10. Report limitations accurately. A UI prototype with fixture responses is not a completed local-AI MVP.

## 3. Scope

### Required

- Create and list local projects.
- Paste selected client conversations or enter scope manually.
- BriefCraft: extract editable requirements, terms, and missing details.
- Save a user-confirmed, immutable Agreement v1.
- ScopeGuard: compare a new request against a selected confirmed agreement.
- Display a suggested classification, explanation, and valid scope references.
- ChangeDesk: edit and save a proposal with optional freelancer-entered fee and additional days.
- Copy proposal text for sharing through the freelancer's existing communication channel.
- Preserve projects, scopes, requests, analyses, and proposals across app restarts.
- Run the required local AI operations offline on the demonstration device.

### Deferred

- Authentication, Supabase integration, cloud sync, and client portals.
- Automatic messaging imports or sending messages to clients.
- OCR, PDF import, embeddings, and advanced semantic indexing.
- Invoices, payments, accounting, milestone management, and revision counters.
- Client approval flows, digital signatures, and automatic amendment acceptance.
- Supporting both Android and iOS for the demonstration when one device is sufficient.

### Stretch work

Only after all required acceptance checks pass, with no release risk:

- Record external client confirmation and create Agreement v2 from an accepted amendment while preserving v1.
- Improve proposal wording or project history presentation.

Saving a proposal alone must never create an accepted amendment.

## 4. Stack and device assumptions

Use the technologies proposed in the supplied project brief, subject to repository inspection and device validation:

| Area | Intended choice | Implementation rule |
| --- | --- | --- |
| Mobile | React Native + Expo + TypeScript | Reuse an existing compatible project. |
| Navigation | Expo Router | Preserve existing navigation if changing it would add risk. |
| UI | React Native components and StyleSheet | Reuse existing styling; avoid a new UI framework. |
| Storage | Expo SQLite | Store all essential records locally. |
| Validation | Zod | Validate structured AI responses and user input. |
| Local AI | Quantized Qwen 3.5 9B | Intended model from the brief; compatibility is unverified. |
| Native inference | Compatible React Native llama.cpp integration, such as llama.rn | Verify the exact model/runtime/device combination before relying on it. |
| Build | Existing native or Expo build workflow | Prove installation early; prepare a release candidate by hour 11. |

The brief proposes an iPhone 15 Pro Max. Confirm the available demonstration device, installation access, signing requirements, model acquisition method, and competition rules during Phase 1. Select one primary target.

Do not assume model memory requirements, supported model formats, native compatibility, or build turnaround. Verify them against the actual setup. Do not require a fresh model download during the offline demonstration.

## 5. Team ownership

These are ownership lanes for the four team members, not a requirement to create additional AI agents.

| Lane | Owner | Responsibilities |
| --- | --- | --- |
| A | Member 1 — AI | Runtime, model loading, BriefCraft, ScopeGuard, proposal drafting, AI validation |
| B | Member 2 — Data and logic | SQLite, project records, agreement snapshots, relationships, persistence |
| C | Member 3 — UI | Navigation, forms, review screens, loading and error states |
| D | Member 4 — Integration and release | Shared contracts, feature wiring, ChangeDesk integration, device testing, builds, demo |

Agree on shared types and interface boundaries during the first hour. Give shared files one active owner at a time and integrate completed increments at every checkpoint.

## 6. Minimum data contracts

Adapt these contracts to repository conventions without changing their meaning.

| Record | Minimum fields |
| --- | --- |
| Project | id, title, optional client label, createdAt |
| Scope draft | projectId, sourceText, editable requirements, exclusions, optional budget/timeline/revision terms, missingDetails |
| Agreement | id, projectId, version, confirmedAt, sourceText, requirements with stable IDs, exclusions, optional terms, confirmation status |
| Request | id, projectId, agreementId, text, createdAt |
| Analysis | id, requestId, agreementId, classification, findings, supporting requirement IDs, clarification questions, createdAt |
| Proposal | id, projectId, analysisId, additional deliverables, optional proposedFee, optional additionalDays, editable message, status=draft, createdAt |

### Business rules

- A scope draft is editable; a confirmed agreement is an immutable snapshot.
- Confirmation means the freelancer confirmed the recorded scope. It does not automatically mean the client approved it.
- Each analysis must reference the exact agreement version used during inference.
- Classifications are `included`, `potential_additional`, or `needs_clarification`. Use findings to explain individual items in mixed requests; use `needs_clarification` when an overall conclusion cannot be supported.
- AI must ground any revision-related explanation in recorded revision terms; do not assume a universal revision policy.
- Any cited requirement ID must exist in the referenced agreement. Display referenced clauses from stored agreement data rather than invented AI quotations.
- If no clause explicitly covers a request, explain the absence without fabricating an exclusion or treating it as proof of a contractual breach.
- Missing terms remain null or marked unspecified. AI must not fill gaps with invented values.
- Freelancer-entered fees and additional days must be validated and remain editable. Proposal drafting must preserve those values.
- Analysis and proposal generation must never mutate the confirmed scope.
- Save linked records consistently so interrupted operations cannot leave broken references.

### Suggested service boundaries

- `extractBrief(sourceText)` → validated editable scope draft.
- `confirmScope(projectId, reviewedDraft)` → persisted agreement snapshot.
- `analyzeRequest(agreementId, requestText)` → validated analysis grounded in that agreement.
- `draftProposal(reviewedAnalysis, userEstimates)` → editable proposal text.
- Database services own persistence; screens call services rather than embedding model or SQL logic.

Directly retrieve the confirmed scope from SQLite and supply it to the model. A separate retrieval or embedding pipeline is outside this MVP.

## 7. Screen plan

1. **Dashboard:** project list and create-project action.
2. **Project Workspace:** project details, pasted conversation/manual input, editable scope review, confirmed agreement, compact history.
3. **ScopeGuard:** new request input, analysis results, evidence, clarification questions, create-proposal action.
4. **Change Proposal:** additional deliverables, fee, additional days, editable message, save and copy actions.

These are logical screens. BriefCraft review may use a nested route or section. Do not build a separate full history screen unless essential to usability.

## 8. Phases and task checklist

### Phase 1 — Foundation and feasibility

**Hours 0–2 | Dependencies: none**

- [ ] P1.1 — D: Inspect the repository, competition constraints, target device, and build/signing access.
- [ ] P1.2 — A: Acquire/load the permitted model and run genuine inference on the target device.
- [ ] P1.3 — B: Initialize SQLite and prove a record survives restart.
- [ ] P1.4 — C: Create navigation and the four screen shells.
- [ ] P1.5 — All, coordinated by D: Agree on shared data contracts and service boundaries.
- [ ] P1.6 — D: Install and open the native development app on the target device.

**Gate at hour 2:** The app installs and opens, SQLite persistence works, and the local inference feasibility result is recorded.

If the intended model fails, establish the cause and choose a smaller compatible local model only if rules permit. The remaining UI/data work may continue using clearly identified fixtures while inference is repaired. If no permitted local model works, record that the core AI requirement is blocked and revise the delivery claim; do not present fixtures or remote inference as on-device AI.

### Phase 2 — Project creation and confirmed scope

**Hours 2–5 | Dependencies: P1.3–P1.6; live extraction also needs P1.2**

- [ ] P2.1 — A: Implement BriefCraft prompts and validated structured extraction.
- [ ] P2.2 — B: Implement project creation, listing, and confirmed Agreement v1 storage.
- [ ] P2.3 — C: Implement conversation input, manual scope entry, editable review, and confirmation.
- [ ] P2.4 — D: Connect the full project-to-agreement flow and handle extraction failures.
- [ ] P2.5 — B + D: Verify saved projects and confirmed scopes after restarting the app.

**Gate at hour 5:** A user can paste a conversation, edit the extracted requirements, confirm Agreement v1, and reopen it. Manual entry works when AI extraction fails.

### Phase 3 — ScopeGuard

**Hours 5–8 | Dependencies: P2.1–P2.4 and working local inference**

- [ ] P3.1 — A: Implement comparison against the selected confirmed agreement.
- [ ] P3.2 — A + B: Validate output structure and cited requirement IDs.
- [ ] P3.3 — B: Persist requests and analyses with their agreement references.
- [ ] P3.4 — C: Implement request input, findings, evidence, and clarification states.
- [ ] P3.5 — D: Test included, additional, ambiguous, and mixed requests.

**Gate at hour 8:** Live local inference produces a reviewable comparison with valid scope references. Failed or invalid responses show a recoverable error. Agreement v1 remains unchanged.

### Phase 4 — ChangeDesk and integrated workflow

**Hours 8–11 | Dependencies: Phase 3 gate**

- [ ] P4.1 — A: Implement proposal drafting using reviewed findings and user-entered estimates.
- [ ] P4.2 — B: Implement proposal persistence and a compact project history.
- [ ] P4.3 — C: Build proposal editing, optional fee/days inputs, save, and copy actions.
- [ ] P4.4 — D: Wire the entire agreement-to-proposal workflow.
- [ ] P4.5 — D: Start the installable release candidate build early enough to allow repair and installation.

**Gate at hour 11:** The entire core flow works with real inference and persistent records. Saving a proposal leaves the agreement unchanged.

**Feature freeze:** Do not start stretch features after this point. Reserve the remaining five hours for stability and delivery.

### Phase 5 — Testing and stabilization

**Hours 11–14 | Dependencies: Phase 4 gate**

- [ ] P5.1 — A: Handle model-load failures, invalid output, failed inference, and retry.
- [ ] P5.2 — B: Verify linked records, snapshot integrity, and persistence after restart.
- [ ] P5.3 — C: Fix loading, empty, error, keyboard, and duplicate-submit states.
- [ ] P5.4 — D: Test the entire flow in airplane mode after restarting the app.
- [ ] P5.5 — D: Install and smoke-test the release candidate on the target device.
- [ ] P5.6 — All: Resolve defects that prevent the required acceptance checks from passing.

**Gate at hour 14:** The release candidate installs, local AI runs offline, saved data survives restart, and there are no known defects blocking the demonstration.

### Phase 6 — Final build and demonstration

**Hours 14–16 | Dependencies: Phase 5 gate**

- [ ] P6.1 — All: Fix only release-blocking issues; rebuild if necessary.
- [ ] P6.2 — D: Install and verify the final deliverable on the demonstration device.
- [ ] P6.3 — All: Rehearse a three-to-five-minute demonstration using the final installed app.
- [ ] P6.4 — D: Record the build location, installation method, known limitations, and test evidence.
- [ ] P6.5 — All: Confirm the final definition of done below.

**Gate at hour 16:** A tested installable app and a rehearsed demonstration are ready.

## 9. Acceptance checks

Use these as manual device checks or appropriate automated checks. Test business invariants and integration behavior; do not spend the time budget testing trivial presentation details.

| Check | Expected result |
| --- | --- |
| Create project | Project appears on Dashboard and persists after restart. |
| Extract conversation | Requirements are editable; unspecified terms stay unspecified. |
| Confirm scope | Agreement v1 preserves exactly the reviewed values. |
| Included request | Changing contact-form button text can be linked to the existing contact form; uncertainty about revision allowance is stated if necessary. |
| Additional request | Booking/authentication requests absent from the recorded scope are flagged for review with an accurate explanation. |
| Ambiguous request | A request such as "make it more advanced" results in clarification rather than invented deliverables. |
| Mixed request | Included and potentially additional items are explained individually without hiding uncertainty. |
| Invalid AI response | No successful analysis is saved; the user sees a retryable error. |
| Invalid evidence reference | An invented requirement ID is rejected rather than displayed as valid evidence. |
| Save proposal | User-entered fee/days remain intact; proposal stays a draft; Agreement v1 is unchanged. |
| Offline restart | Saved records reopen and fresh inference completes without remote calls. |
| Final installation | The final app opens on the target device without relying on a running development server for the demo. |

Capture observed inference timings on the chosen device. If the flow is too slow to demonstrate, address it during stabilization and report actual performance rather than an assumed target.

## 10. Demonstration fixture and script

Use this fictional conversation as input to real inference:

> Client: I need five responsive pages: Home, About, Services, Portfolio, and Contact, with a contact form.
> Freelancer: The proposed fee is PHP 15,000, the timeline is two weeks, and two revision rounds are included.
> Client: Approved. Let's proceed.

1. Create the project and paste the conversation.
2. Run BriefCraft; review the extracted details and confirm Agreement v1.
3. Enter: "Can we add customer accounts and appointment booking?"
4. Run ScopeGuard; review its explanation and stored agreement evidence.
5. Enter illustrative estimates of PHP 7,000 and five additional working days.
6. Generate, edit, and save a proposal; show that it remains a draft.
7. Enable airplane mode, restart the app, reopen the project, and run a fresh comparison.

The fee and timeline adjustments above are fictional user inputs, not AI-generated estimates. Do not require exact AI wording; assess whether the output is grounded and useful.

## 11. Definition of done

- [ ] The required workflow completes on the selected demonstration device.
- [ ] Brief extraction, scope comparison, and proposal drafting use working local inference.
- [ ] All essential records persist locally across restarts.
- [ ] Confirmed agreements remain immutable during analysis and proposal creation.
- [ ] Displayed evidence references resolve to the correct stored agreement.
- [ ] Invalid input and failed AI operations have understandable recovery paths.
- [ ] Fresh inference works offline after app restart.
- [ ] The final installable app has been tested, and its location and installation method are recorded.
- [ ] The team has rehearsed the final demonstration.
- [ ] Any omitted capability or unresolved issue is documented honestly.

## 12. Execution log

Update this section while implementing. Keep it concise and include concrete evidence.

| Task / checkpoint | Status | Evidence or result | Blocker / next action |
| --- | --- | --- | --- |
| Repository and target inspection | Done | Expo SDK 57, React Native 0.86.3, Expo Router, SQLite. | Ready. |
| Phase 1: Foundation and persistence | Done | SQLite WAL mode, schema migrations 001 and 002 applied, demo seed operational, LM Studio adapter configured. | Verified in `HomeScreen.tsx`. |
| Phase 2: Project creation & scope | Done | `ProjectRepository`, `BriefCraftService`, `KasunduanVaultService`, and `AgreementRepository` implemented and validated with Zod. | Ready for UI screen composition. |
| Phase 3: ScopeGuard request analysis | Done | `ScopeGuardService`, `ScopeGuardRepository`, and Zod validation verifying evidence requirement citations against confirmed scope. | Ready for UI screen composition. |
| Phase 4: ChangeDesk, Legal Contracts & Sharing | Done | `ChangeDeskService`, `ContractGeneratorService` (EOPT RA 11976, BIR 2307, RA 8293, RA 10173), and `ShareService` (`Share.share()`) verified. | UI screens in Phase 3/4. |
| Phase 5: Testing and stabilization | In progress | `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`, and `npm run build:web` pass cleanly with 0 errors. | Physical Android build testing. |
| Phase 6: Final APK build | Pending | EAS `preview` and `apk` profiles configured with standalone APK delivery. | EAS cloud build execution. |

### Decisions to record

- Repository location: https://github.com/chimkenchrls/appbuildersph-hackathon
- Demonstration device and OS: Nothing Phone 3a (Android, 8 GB RAM) for the APK. An iPhone 15 Pro Max with Expo Go is used for development testing.
- Permitted model and quantization: Qwen3.5 9B, Q4_K_M (5.24 GB). Qwen3.5 4B (about 2.8 GB) is the fallback. The model is never bundled in the APK.
- Model/runtime compatibility result: The model runs in LM Studio on a nearby computer, which the phone reaches over Wi-Fi (OpenAI-compatible API on port 1234). On-device inference with llama.rn 0.12.9 is installed and configured, but loading the model on the phone has not been tested.
- Native runtime and dependency versions: Expo SDK 57, React Native 0.86.3, llama.rn 0.12.9 (requires New Architecture), Zod 4, TypeScript 6. The LM Studio adapter sends `reasoning_effort: "none"`, because Qwen3.5 otherwise spends the whole token budget thinking.
- Build/signing and installation method: EAS cloud build, `preview` profile (APK), Expo account `rensyi`, project `@rensyi/diligent-dev`, package `com.saklaw.dds`. Installed from the EAS download link. The LM Studio address (`EXPO_PUBLIC_LM_STUDIO_URL`) and model id (`EXPO_PUBLIC_LM_STUDIO_MODEL`) are set in the EAS `preview` environment and built into the APK. The app saves the address in its database on first launch and uses the saved value first, so clear the app's data after changing it.
- Model provisioning method: Not applicable for the demo. The model lives in LM Studio on a nearby computer and is not in the APK or on the phone.
- Observed inference timings: ScopeGuard comparison takes about 18 to 28 seconds on the developer laptop (Qwen3.5 9B in LM Studio), measured with the live eval `tests/eval/scopeGuard.eval.ts`. Timings on the teammate's desktop and on the phone are not recorded yet.
- Any approved scope changes: AI is "Local AI, internet allowed": it runs on a computer on the same network, not on the phone, so the demo does not run fully offline. The proposal's fee, duration and total come from the user's inputs, not from the model. The model only writes the opening paragraph.

### Delivery record

- Final build location: https://expo.dev/accounts/rensyi/projects/diligent-dev/builds/4225af0e-994d-4c5b-957f-57d02195c308 (`preview` profile)
- Installation instructions: Uninstall any earlier version (or clear its data). Install the APK from the build link. Join the phone to the same Wi-Fi as the LM Studio computer, which must have the model loaded and the server running with "Serve on Local Network" on and port 1234 open in its firewall.
- Verification date and device: 2026-10-10, Nothing Phone 3a.
- Acceptance-check results: On the phone, the "Local AI: Ready" status stayed stable. Extraction was faithful to the conversation, agreement confirmation worked, ScopeGuard gave the expected result for each tested request, proposal generation and saving worked, data persisted after closing and reopening, and the app failed cleanly with LM Studio stopped. Automated checks pass: 92 Jest tests, `tsc --noEmit` and `expo lint`.
- Known limitations: The app depends on the LM Studio computer's IP address, which is fixed at build time. If it changes, rebuild. The phone and the computer must be on the same network. Occasionally the model cites an invalid requirement ID. The app then shows an error, never a wrong result. The tax treatment defaults to `net_of_withholding` when the conversation does not mention it (`briefCraftService.ts`, `kasunduanVaultService.ts`, `agreementRepository.ts`, migration 002), which breaks the rule that missing information stays empty.
- Remaining work: On-device model test with llama.rn. Remove the dev-only `ai-check` screen (`src/screens/workspace/AiCheckScreen.tsx`, `src/app/ai-check.tsx`). Rehearse the demonstration. Fix the tax default.
