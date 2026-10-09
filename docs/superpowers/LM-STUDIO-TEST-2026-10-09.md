# LM Studio integration fix and live test

Date: 2026-10-09. Branch: `pandesal-branch`; changes are uncommitted and unpushed.
The [integration audit](./INTEGRATION-AUDIT-2026-10-09.md) describes the earlier
`10f3053` baseline. This note records subsequent LM Studio testing fixes.

## Diagnosis and changes

- LM Studio originally listened only on localhost. The user enabled a LAN binding
  and confirmed that the iPhone could open `/v1/models` in Safari.
- The app could retain `local-model` in SQLite despite a corrected `.env`. Explicit
  environment URL/model values now override saved settings without changing saved
  projects or settings. Readiness checks that the configured model ID is listed.
- Qwen 3.5 9B had reasoning enabled by default. Short probes used their full output
  budget for reasoning, and full extraction exceeded the 60-second deadline.
  `reasoning_effort: "none"` produced a direct answer with zero reasoning tokens.
  `chat_template_kwargs.enable_thinking: false` and `reasoning: "off"` were ignored
  by the tested OpenAI-compatible endpoint. The LM Studio adapter now sends the
  verified direct-answer setting; native inference options were not changed.
- Two Qwen instances were loaded on a 16 GB machine with about 1.8 GB available and
  9.5 GB swap used. With the user's approval, the idle `qwen/qwen3.5-9b:2` instance
  was unloaded. The selected instance remains loaded; model files were not deleted.
  Available memory then increased to about 6.8 GB. The live retry combined this
  resource change and disabled reasoning, so their individual timing gains are not isolated.
- Generation timeouts now have a distinct error and retry guidance. A timeout does
  not mark a previously reachable model unavailable. The deadline remains active
  until the complete response body is consumed.

## Verification

Regression tests first reproduced the configuration/readiness failures, missing
reasoning control, misclassified timeout, and premature timeout cleanup.
Final `npm test -- --runInBand`: **74 passed, eight suites**, none skipped.
`npx expo lint`, `npx tsc --noEmit`, and `git diff --check` passed.

Live model: `qwen/qwen3.5-9b`, Q4_K_M, context 8192, served by LM Studio over LAN.
CLI commit: `69d945a`. The fictional five-page website test used the actual HTTP
adapter, prompt builders, JSON schemas, mappings, and business validators.

| Step | Observed time | Observed result |
| --- | --- | --- |
| Extract scope | 18.4 seconds | Five pages/contact form, PHP 15,000, two weeks, two revisions, and recorded exclusions; valid cleaned draft. |
| Analyze request | 20.2 seconds | Button text edit included with valid evidence; booking/accounts additional; findings accepted by evidence validation. |
| Draft proposal | 10.5 seconds | Valid message retaining the entered PHP 7,000 and five business days in this sample. |

Temporary runner: `/tmp/saklaw-lm-studio-smoke.cjs`, executed with
`node --env-file=.env /tmp/saklaw-lm-studio-smoke.cjs` from the repository root.
It uses Node HTTP with only the React Native platform constant stubbed; agreement
lookup is in memory. It does not exercise device SQLite, mobile transport, saves,
clipboard, or native inference. No personal project data was submitted.

## Remaining verification

Restart Metro with `npx expo start --clear`, reopen the app in Expo Go, and repeat
extraction and the full workflow on the iPhone. A successful Safari request does
not prove the app's native HTTP behavior. Physical-device confirmation remains pending.
The default engine still depends on the computer's LM Studio HTTP server and does
not satisfy standalone, on-device/offline APK acceptance. The audit's persistence,
backup, inference race, and other domain-rule findings remain unresolved.
