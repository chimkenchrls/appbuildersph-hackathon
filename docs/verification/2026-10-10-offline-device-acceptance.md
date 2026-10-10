# Offline on-device acceptance: Android

Status: **not run**. Nothing in this file is a result until a row is filled in on a physical
phone. Until then, no document, screen or landing page may say that OwlSet works offline.

Requirements come from `ARCHITECTURE.md` sections 1, 10 and 11 and `AGENTS.md` ("Android APK
delivery"). A development client, Expo Go, the web export and Jest do not count.

## 1. What is being tested

| Field | Value |
| --- | --- |
| App version / package | 1.0.0 / `com.owlset.app` |
| Source commit | _fill in: `git rev-parse HEAD` at build time_ |
| EAS build link | _fill in_ |
| Build profile | `preview` (APK) |
| Engine mode under test | **On-Device** (Settings > AI Inference Engine) |
| Model file | _name, quantization, size in bytes, SHA-256_ |
| Phone, Android version, RAM | _fill in_ |
| Tester / date | _fill in_ |

Compute the model digest on the computer before copying it, so the file on the phone can be
compared: `sha256sum model.gguf`.

## 2. Before you start

1. Use a phone with at least 8 GB RAM and about 8 GB of free storage. Close other apps.
2. Pick the model. Start with the small one (Qwen3.5 4B, about 2.8 GB). Try the 9B model
   (about 5.2 GB) only after the 4B run passes, and record it as a separate run.
3. Copy the `.gguf` to the phone (USB or any file transfer). It must be a file on the phone,
   not a cloud placeholder.
4. Stop LM Studio on the computer, or make sure the phone cannot reach it. Test A below proves
   the app is not quietly using it.
5. For memory and thermal numbers, connect the phone with USB debugging. Everything else works
   without a cable.

## 3. Tests

Mark each row **Pass**, **Fail** or **Skipped** and write what you saw. A fail needs the exact
message on screen.

### A. Install and first launch

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| A1 | Uninstall any earlier OwlSet. Install the APK from the build link. | Installs; app icon appears. | |
| A2 | Turn on airplane mode. Leave Wi-Fi and mobile data off. | Status bar shows airplane mode. | |
| A3 | Open OwlSet for the first time. | Onboarding appears without an error. No spinner that never ends. | |
| A4 | Finish onboarding with a name and role. | Lands on Projects. | |

### B. Model setup

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| B1 | Settings > AI Inference Engine > **On-Device**. | Tab is highlighted. Status says no model found. | |
| B2 | Tap **Import .gguf Model**. Choose a file that is not a model (a PDF or image). | Clear error that it is not a GGUF model. Nothing is installed. | |
| B3 | Tap **Import .gguf Model**. Choose the real `.gguf`. | Progress, then "imported and activated". Status shows file name and size. | |
| B4 | Compare the shown size with the file size on the phone. | They match. | |
| B5 | Tap **Test On-Device**. | "On-Device Test Passed" with a time. Record the time and tokens per second. | |
| B6 | Tap **Free Model RAM**, then **Test On-Device** again. | Passes again; second time is the "cold load" measurement. | |

### C. The workflow, offline

Use this fictional conversation (from `ROADMAP.md` section 10) in a new project:

> Client: I need five responsive pages: Home, About, Services, Portfolio, and Contact, with a contact form.
> Freelancer: The proposed fee is PHP 15,000, the timeline is two weeks, and two revision rounds are included.
> Client: Approved. Let's proceed.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| C1 | New Project. Paste the conversation. Check the status pill at the top. | Pill reads `On-Device (...) · Offline`. It must **not** say "Local LLM Ready" with a network model name. | |
| C2 | Run extraction. Note the time from tap to draft. | A draft with the five pages, contact form, PHP 15,000, two weeks, two revisions. The draft screen shows **"Drafted by AI · Review every field"**. Unstated terms (start date, payment schedule) stay unset. Takes several seconds. If the label says "rule-based fallback, not AI", the model did not run: record why. | |
| C2b | Create a second project with this wording, which a pattern matcher cannot read: "Hi! Quick one. We want a small site for the cafe: a front page, a menu page, and a way for people to message us. We can pay fifteen thousand pesos, and we need it in a fortnight. Two rounds of changes is fine." | Draft lists the three items, budget 15,000, about 14 days, two revisions. Label reads "Drafted by AI". If budget or timeline come out empty or wrong while C2 worked, treat C2 with suspicion. | |
| C3 | Confirm the scope. | Agreement v1 saved. | |
| C4 | New request: "Can we add customer accounts and appointment booking?" | Both items flagged as potential additions. Evidence points to real requirement IDs. | |
| C5 | New request: "Can you change the text on the contact form button?" | Covered by the contact form. | |
| C6 | New request: "Make it more advanced." | Needs clarification. No invented deliverables. | |
| C7 | New request: "Change the contact button text and add online payments." | Items classified separately. | |
| C8 | Prepare a change proposal for C4. Enter fee 7000 and 5 days. Save. | Fee and days are exactly what was typed. Status stays draft. Agreement v1 unchanged. | |

### D. Proof that nothing left the phone

Airplane mode alone can hide a quiet fallback to the network, so do both checks.

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| D1 | Turn Wi-Fi **on** and start LM Studio with its request log visible. Set the app to **On-Device**. Run C2 and C4 again. | LM Studio's log shows **zero** requests from the phone. | |
| D2 | Android Settings > Apps > OwlSet > Mobile data and Wi-Fi usage (after the whole run). | About zero bytes. Record the figure. | |
| D3 | Set the app to **Auto** with the model installed. Run one extraction. | Pill still reads `On-Device`. | |
| D4 | Set **Auto**, then remove the model (reinstall the app, skip import). Run one extraction with LM Studio running. | Record what happens. If it is answered through LM Studio, that is the network fallback and must be fixed or labelled before any offline claim. With LM Studio stopped, the draft must be labelled "rule-based fallback, not AI". | |

### E. Persistence

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| E1 | Force-stop OwlSet (Android Settings > Apps). Reopen in airplane mode. | Projects, agreement, requests and proposal are all there. | |
| E2 | Reboot the phone. Reopen in airplane mode. | Same data. Model is still installed. | |
| E3 | Run one new request after the reboot. | Completes on-device. | |

### F. Limits and failures

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| F1 | Paste a very long conversation (about 15,000 characters) into New Project and submit. | A message that the text is too long for the on-device model. The text stays in the box and no project is created. No crash. | |
| F2 | Find the longest conversation that works: try about 2,000, 4,000, 6,000 characters. | Record the largest that succeeds. | |
| F3 | Tap Analyze twice quickly. | One run only. No duplicate analysis saved. | |
| F4 | Start a run, then force-stop the app during it. Reopen. | No half-saved analysis. The request text is still there. App opens normally. | |
| F5 | Background the app during a run, return after 10 seconds. | Either completes or shows a clear error. No frozen screen. | |
| F6 | **Free Model RAM**, then run a request. | Model reloads and answers. | |
| F7 | Import a second `.gguf`, then import a bad file. | The second model stays active after the failed import. | |

### G. Measurements

Fill these in for each model tested. Record observed numbers; do not guess.

| Measure | 4B | 9B | How |
| --- | --- | --- | --- |
| File size | | | Settings model status |
| Cold load (seconds) | | | Test On-Device after Free Model RAM (B6) |
| Warm run (seconds) | | | Test On-Device, second tap |
| Tokens per second | | | Test On-Device result |
| Extraction time (C2) | | | Stopwatch, tap to result |
| Analysis time (C4) | | | Stopwatch |
| Longest input that passed (F2) | | | characters |
| Peak memory | | | `adb shell dumpsys meminfo com.owlset.app` during a run, "TOTAL PSS" |
| Free storage used by the model | | | before and after import |
| Battery used by 5 runs | | | Settings > Battery |
| Phone temperature after 5 runs | | | Warm, hot, or throttled? |
| Out of memory or app killed? | | | yes / no, at which step |

The 120 second generation timeout is untested on real hardware. If a normal request times out,
record how long it actually takes.

## 4. Things already known to check

These came out of code review and are the likeliest ways this run fails:

- **Rule-based fallback is now labelled and no longer hides errors.** `briefCraftService`
  still uses `extractBriefHeuristic` (regexes for amounts, weeks, days and revision rounds)
  when no engine is available. The draft screen now says "Drafted by the rule-based
  fallback, not AI". A too-long input, a timeout or an unusable model answer is shown to the
  user and no project is created; it is no longer turned into a regex draft. The demo
  conversation in C2 can be read by those regexes, so use the label, the timing, C2b and D1
  together. The request and proposal steps (C4 to C8) have no fallback and fail visibly.
- The context window is 2048 tokens. The adapter rejects a prompt that cannot fit with an
  `input_too_long` error (F1, F2).
- `auto` mode falls back to the LAN server when no model is installed (D4).
- `NewProjectScreen` shows "Local LLM Offline · Smart heuristic" when AI is unavailable. That
  matches the fallback above.
- Settings > Offline Architecture still says "LM Studio HTTP development adapter; on-device
  inference unverified". Update that line only after this run passes.
- A new import replaces the installed model once it passes the header check. It is not test
  run first, so a valid GGUF that cannot load will leave no working model until another is
  imported.
- This is the first build under the `twilightdust` EAS project, so it has a new signing key.
  Upgrade-without-data-loss cannot be tested until a second build with the same key exists.

## 5. Result

| Item | Value |
| --- | --- |
| Tests passed / failed / skipped | _ / _ / _ |
| Blocking failures | _list test IDs_ |
| On-device inference verified offline | yes / no |
| Fresh install, offline first launch, relaunch, reboot | yes / no |
| Upgrade from a previous APK | not tested (needs a second build) |
| Statements now allowed | _e.g. "ran offline on [device] with [model]"_ |
| Statements still not allowed | _e.g. "works on all devices"_ |

Sign-off: _name, date_

When a run is complete, copy the filled-in file to
`docs/verification/<date>-offline-device-acceptance-run-N.md` and leave this one as the blank
template. Record the supported-device baseline, model and measured fallback in
`docs/decisions/`, as `ARCHITECTURE.md` section 2 requires.
