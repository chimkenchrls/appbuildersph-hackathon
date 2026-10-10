# OwlSet promotional film

A 68-second, 1920×1080, 30 fps film built with [Remotion](https://www.remotion.dev). It is a separate
project from the app: its own `package.json`, excluded from the app's typecheck and lint.

```sh
cd demo
npm install
npm run dev                      # Remotion Studio: preview, scrub, and render from the browser
npx remotion render OwlSetFilm   # writes out/OwlSetFilm.mp4
```

## How it is put together

- `owlsetTheme.ts` holds the brand tokens (colours, fonts, square corners, motion curves) read from
  the live site. Everything on screen uses them.
- One element, the "hero", is on screen for the whole film and only ever changes shape:
  cursor → chat message → project checklist → clock → phone → change proposal → project card → mint field.
  Its outline is keyframed in `src/hero.ts`; what it shows at each stage is in `src/Film.tsx`.
- `src/scenes/Field.tsx` is the messages that multiply, tangle, and then line up as the task list.
  `src/scenes/Cost.tsx` is the clock and the workload and fee panels. `src/scenes/Phone.tsx` plays the
  app's real screens, with taps, typing and scrolling.
- `src/Kwagi.tsx` is Kwagi: the app's layered full-body drawing. He appears three times (tapping the
  first message, stopping the clock, and at the end card). He peeks up from behind the message and the
  clock and ducks back behind them; at the end he rises from the bottom edge of the frame.
- `src/Sound.tsx` places the music and each sound effect on its frame.

## Timing follows the voiceover

The film is cut to `public/audio/owlset_voiceover.mp3`. The word timings came from a local Whisper
transcription of that file; the transcript and the transcription script are not kept in the project.

- The picture keeps its own timeline ("story frames"). `PINS` in `src/lib.ts` pins each story moment to
  the film frame where its words are spoken; to move an event, change its pin.
- `src/Words.tsx` holds the end card, timed in voiceover seconds. There are no headlines or subtitles;
  the narration carries the message.
- Kwagi (`src/Kwagi.tsx`) is timed in film frames, so re-pinning the story never changes how fast he moves.

If the voiceover is replaced, it needs transcribing again with word timestamps (for example with
`@remotion/whisper-webgpu`). Then update the pins, the times in `Words.tsx`, `Kwagi.tsx` and `Sound.tsx`,
and the scene boundaries in `scripts/make_audio.py`.

## Sound

`python3 scripts/make_audio.py` (NumPy, SciPy, ffmpeg) synthesises everything in `public/audio/`:
a 68-second score cut to the voiceover's scenes, and nine effects including Kwagi's "ka-hoot".
Nothing in it is downloaded or licensed. The voiceover is the supplied recording.

## Checking frames

`node scripts/stills.mjs 60 915 2690` renders those frames to `out/stills/`.
Set `REMOTION_BROWSER` to a Chrome Headless Shell binary if Remotion cannot download its own.

## The app screens

The phone shows screenshots of the app's real screens (`public/app/*.png`, 360×740 at 3×), driven by a
fictional demo project. To retake them after the app's UI changes, from the repository root:

1. Copy `demo/scripts/app-capture/shots.route.tsx.template` to `src/app/shots.tsx`.
2. In `src/constants/theme.ts`, temporarily make `colors` use `lightColors` on web too (the app's
   web build otherwise applies the landing page's dark palette).
3. `npx expo export --platform web --output-dir /tmp/shots` then `python3 demo/scripts/app-capture/serve.py /tmp/shots`.
4. Run `capture.cjs` with `PW` (a folder where Playwright is installed), `CHROME` and `OUT` set.
   It also prints the scroll distances and tap positions used in `src/scenes/Phone.tsx`.
5. Delete `src/app/shots.tsx` and restore `theme.ts`.

The captures use Roboto, Android's system font, in place of the capture machine's own.
