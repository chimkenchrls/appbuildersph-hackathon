# Kwagi — Mascot Visual Brief

> **Status:** Two versions are built from the owner's generated designs. The mobile app shows a full-body Kwagi who blinks and waves. The web landing page shows a head-and-shoulders Kwagi who follows the cursor and reacts to clicks. Neither has been verified on a physical device; the app icon and splash are not made yet.
> **Companions:** [PROJECT.md](./PROJECT.md) for product context, [FRONTEND.md](./FRONTEND.md) for the app's design rules.

## 1. Who Kwagi is

Kwagi is a kwago (owl) who represents OwlSet. His name joins *kwago* with *wagi* ("win").

He is a **calm, watchful ally**: quiet, observant, reassuring. He notices things and points them out. He does not judge the client, pressure the freelancer, or announce conclusions.

Kwagi is **not the official logo**. He is a character who appears alongside the brand. The app's logo and wordmark are a separate decision.

His owl identity connects to freelancers working with international clients across time zones. His watchfulness represents care with project details, while his calm personality supports clear communication and healthy boundaries. [ABOUT_KWAGI.md](./ABOUT_KWAGI.md) contains the public-facing story and implementation notes.

## 2. Where he appears

| Surface | Use | Status |
| --- | --- | --- |
| Mobile app | Full-body Kwagi on the home screen. Later: first-run greeting and while the on-device AI is working. | Built: blink and wave. |
| Web landing page | Head-and-shoulders Kwagi in the hero. | Built: cursor tracking and click reactions. |
| App icon and splash | Decided: Kwagi is on both. He is still a character, not the logo. | Not made. |
| Pitch and demo | Slides, demo video, presentation material. | Not made. |

He stays off dense working screens. Findings, evidence and proposal editing remain plain UI.

## 3. Look

**Style:** clean cartoon with curved shapes, flat fills and a dark outline. No gradients, painted texture, eyelashes or cheek blush.

**Silhouette, in priority order:**

1. **Large round head on a short round body.** The head is wider than the body, so he reads at small sizes.
2. **Ear tufts.** Two swept tufts, as on a Philippine scops owl. These separate his outline from other well-known owl mascots.
3. **Big amber eyes** in a pale mint, goggle-shaped face disc. They carry almost all expression.
4. **Small wings** hugging his sides, the same teal as the body, with three feather tips. One lifts to wave.
5. **Orange three-toed feet**, set apart.

**Accessory:** a small black necktie under a dark collar, on the pale belly.

## 4. Colour

Sampled from the owner's full-body design and used by the app drawing.

| Part | Colour |
| --- | --- |
| Body, head, wings, tufts | `#346A74` |
| Forehead spots | `#3F7A80` |
| Shaded edges (lower head, wing tips, inner tufts) | `#2A5861` |
| Face disc and belly | `#CBECCF` |
| Belly shade | `#A6D0B4` |
| Eye whites and catchlights | `#FBF8EC` |
| Irises, beak, feet | `#E68A1D` |
| Iris rim and lower beak | `#C97514` |
| Pupils and outline | `#070B0B` (outline 9 units on the 1024-unit drawing) |
| Necktie and collar | `#292927` |

On the app's deep teal surfaces he needs a light backing shape, since his body is close to that colour.

## 5. Motion

**Mobile app.** For now Kwagi only blinks and waves.

- **Blink:** every 3 to 6 seconds at random, closed for about a tenth of a second.
- **Wave:** once shortly after the screen appears, and again when tapped. The viewer's-right wing swings out to the side, moves twice, and settles in about 1.5 seconds.
- **Reduced motion:** he stays still.

**Web landing page.** Behaviour comes from the page-mascot component.

- **Directions:** his head turns to one of eight directions toward the cursor, and faces forward when the cursor is close. On touch screens he turns toward wherever the screen is touched, holds for about two seconds, then faces forward again.
- **Reactions on click:** a blink, then heart, sparkle or delighted in turn. The reaction holds for about 1.4 seconds, and for as long as the cursor rests on him, then fades back to his normal face. Four quick clicks give dizzy, which lasts about 1.8 seconds.
- **Dizzy from the cursor:** swinging the cursor around him by two full turns within three seconds, while it is within 360 pixels of him, also makes him dizzy. It cannot trigger again for about four seconds afterwards.
- **No movement on click:** only his expression changes. The component's default squash was removed at the owner's request.

Motion otherwise stays slow and small. A thinking pose and poses for findings or problem states are not built.

## 6. How each version is built

### Mobile app: layered SVG

`scripts/build_kwagi_app.py` holds the drawing as vector parts and generates both
`src/components/kwagi/KwagiArt.tsx` and `assets/mascot/kwagi-full.svg`. Run it with
`python3 scripts/build_kwagi_app.py`; it needs only Python.

The art is four stacked layers: body (with feet, belly, tie and the still wing), the
waving wing, the head (with closed lids drawn on it), and the open eyes.
`Kwagi.tsx` rotates the wing layer around the shoulder to wave and fades the open-eyes
layer to blink, using `react-native-svg` and React Native's built-in `Animated`.
It is a hand redraw that follows the owner's full-body design closely, not a trace.

### Web landing page: sprite atlases

Two 3×3 sheets, built with the page-mascot skill from the sources in `characters/kwagi/`:

- `directions.png` is the owner's generated direction sheet.
- `reactions.png` was generated with Gemini from that design and then assembled by hand:
  cells from two generated sheets were combined so all nine reactions differ, and the
  heart was added from a third.

Rebuild the atlases from the project root with the skill's
`scripts/mascot.py kwagi --skip-generate` (needs Pillow, NumPy and SciPy). It aligns the
two sheets and writes `public/mascots/kwagi-{directions,reactions}.webp`.
Then run `python3 scripts/align_kwagi_reactions.py` (Pillow and NumPy). It moves and scales the
reaction frames to match the forward-facing frame, so Kwagi stays in place when clicked.
Generated sheets need checking by eye, because the build's checks do not catch wrong expressions or
turned heads.

Directions are from the **viewer's** perspective, in this order:

| Upper left | Up | Upper right |
| --- | --- | --- |
| Left | Forward | Right |
| Lower left | Down | Lower right |

Reactions, in index order: blink, heart, sparkle, surprised, wink, bashful, sleepy, dizzy,
delighted. No blush in any cell; symbols are amber.

### Rules for both

- Progress still needs text and a Stop control; the mascot never replaces either.
- Keep browser pointer tracking in web-only code, outside shared mobile screens.
- Respect reduced motion.
- Bundle artwork locally and hide decorative artwork from screen readers.
- Android build and physical-device checks are still pending.

## 7. Sizes

| Version | Size in use |
| --- | --- |
| Mobile app, full body | 180 logical pixels wide on the home screen. |
| Web landing page, head and shoulders | 220 pixels; atlas cells are 360 pixels. |

There is no head-only variant yet. The app icon will need one.

## 8. What Kwagi never does

- Looks angry, alarmed, smug or disappointed, especially about a client request.
- Appears to deliver a verdict, a price, or a statement that work is out of scope.
- Speaks in bubbles that present AI output as his own certainty.
- Appears on error states in a way that makes a failure feel cute or minor.
- Stands in for a missing label, button or status message.

## 9. Files

| File | Use |
| --- | --- |
| `src/components/kwagi/Kwagi.tsx` | App component: blink, wave, reduced-motion handling. |
| `src/components/kwagi/KwagiArt.tsx` | Generated layered art. Do not edit by hand. |
| `src/components/kwagi/PageMascot.tsx` | Web-only cursor-following component, copied from the page-mascot skill. |
| `src/screens/workspace/HomeScreen.tsx` | Native home screen showing the app Kwagi. |
| `src/screens/RootScreen.web.tsx` | Web landing screen showing the cursor-following Kwagi. `EXPO_PUBLIC_KWAGI_WEB_PREVIEW=1` also shows the app Kwagi there for testing; this switch is temporary. |
| `scripts/build_kwagi_app.py` | Source of the app drawing. |
| `assets/mascot/kwagi-full.svg` | Static picture of the app drawing. |
| `public/mascots/kwagi-{directions,reactions}.webp` | Web atlases, 1080×1080 with 360×360 cells. |
| `characters/kwagi/{directions,reactions}.png` | Source sheets for the atlases. |
| `assets/mascot/reference/kwagi-fullbody-reference.png` | Owner's full-body design; the app drawing follows it. |
| `assets/mascot/reference/kwagi-redesign-generated.png` | Owner's direction sheet; the web atlases come from it. |
| `assets/mascot/reference/kwagi-directions-original.webp` | Earliest direction sheet, kept for history only. Do not ship it. |

Still to make: the app icon, the splash image, and any pitch animation.

## 10. Open decisions

- **Cultural check:** owls are a bad omen in some Filipino folk beliefs. Show the artwork to a few people outside the team before it goes on the icon.
