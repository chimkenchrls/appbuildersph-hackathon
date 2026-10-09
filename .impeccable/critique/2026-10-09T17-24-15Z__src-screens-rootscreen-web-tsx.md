---
target: the landing page hero and page
total_score: 16
max_score: 24
na_heuristics: 5,7,9,10
p0_count: 0
p1_count: 3
target_identity: "file:/mnt/heavy-data/diligent-dev/src/screens/RootScreen.web.tsx"
target_fingerprint: "sha256:d78e84e7594b7ef129d41927641ee68f74170dafae4f4b60d9f833da2521ce44"
target_path: /mnt/heavy-data/diligent-dev/src/screens/RootScreen.web.tsx
timestamp: 2026-10-09T17-24-15Z
slug: src-screens-rootscreen-web-tsx
closed: true
---
⚠️ DEGRADED: single-context (the session does not allow spawning sub-agents unless the user asks)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Nav marker, selected states and the filed/scattered state are all shown |
| 2 | Match System / Real World | 3 | Plain freelancer language; clause IDs explained by use |
| 3 | User Control and Freedom | 3 | Nothing traps the visitor; the filing can be replayed |
| 4 | Consistency and Standards | 2 | Grey hero panel is foreign to the palette; app badges and concept phone use a different typeface from the page |
| 5 | Error Prevention | n/a | No inputs on this page |
| 6 | Recognition Rather Than Recall | 3 | Section labels and numbered steps |
| 7 | Flexibility and Efficiency | n/a | Landing page |
| 8 | Aesthetic and Minimalist Design | 2 | Disconnected hero, mascot too small, colour starved, flat section rhythm |
| 9 | Error Recovery | n/a | No error states possible |
| 10 | Help and Documentation | n/a | Landing page |
| **Total** | | **16/24** | **Acceptable (67%)** |

## Design Specificity Verdict

LLM assessment: the content is specific (clause IDs, the Café Amihan agreement, the chat-to-record idea), but the first viewport does not show it. The hero reads as a dark template with a grey box.

Deterministic scan: 36 findings on the rendered page. Real: flat type hierarchy in "Your control" (19px heading over 19px subheadings), and Geist flagged as an overused face. False positives: 25 cramped-padding hits on fixed-height rows, 2 low-contrast hits from static colour guessing, a buried raster that is the hidden reactions sprite, and the Kwagi SVG flagged as a shape-built illustration.

## Priority Issues

- [P1] Hero is three disconnected clusters with a dead middle. Headline top, pitch bottom-left, panel bottom-right. Fix: one grouped text column beside one tall visual.
- [P1] The mascot, the only colourful asset, is small and cropped in a corner of a mid-grey slab that reads as a placeholder. Fix: make Kwagi the hero image on a brand-colour field.
- [P1] Colour is starved. The mint accent appears on one button and some IDs; nothing owns a region. Fix: give mint real area in the hero and the closing.
- [P2] Flat page rhythm. Sections differ only by hairlines, and wide screens leave large voids. Fix: alternate surface tones, centre two-column sections, tighten padding.
- [P2] Type: "Your control" has no size step between its heading and subheadings; display tracking is too tight.

## Persona Red Flags

Jordan (first-timer): cannot tell from the first screen what the grey box or the R1/T1 list is. Casey (mobile): hero panel shows three clause rows and a small owl; little payoff for the scroll.

## Minor Observations

App badges render in the system monospace and the concept phone in the system sans, beside Geist. The closing Kwagi is small and his dark outline is lost on the dark ground.
