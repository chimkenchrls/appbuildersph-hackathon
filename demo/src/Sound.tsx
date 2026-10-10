import type React from "react";
import { Audio } from "@remotion/media";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, toFilm, VOICE_START } from "./lib";

const file = (name: string) => staticFile(`audio/${name}.m4a`);

/**
 * Sound effects. Most belong to a picture event, so they are given as story frames and follow
 * that event wherever the voiceover has moved it. Kwagi's are given as film frames, like him.
 */
const STORY: { story: number; sound: string; volume: number }[] = [
  { story: 66, sound: "notify", volume: 0.4 }, // the first message
  ...[262, 284, 300, 312].map((story, i) => ({ story, sound: "pop", volume: 0.26 + i * 0.03 })), // it multiplies
  ...[470, 505, 560, 610, 660, 700, 740, 775].map((story) => ({ story, sound: "pop", volume: 0.22 })),
  { story: 838, sound: "riser", volume: 0.2 }, // the tangle winds into a clock
  ...[985, 1055, 1125, 1195].map((story) => ({ story, sound: "flag", volume: 0.22 })), // another task
  { story: 1318, sound: "riser", volume: 0.18 }, // clock into phone
  { story: 1402, sound: "chime", volume: 0.36 }, // the screen lights up: "OwlSet"
  { story: 1760, sound: "whoosh", volume: 0.22 },
  { story: 1808, sound: "tap", volume: 0.5 }, // new project
  { story: 1842, sound: "pop", volume: 0.24 }, // conversation pasted
  { story: 1874, sound: "tap", volume: 0.5 }, // create scope draft
  { story: 1972, sound: "tap", volume: 0.5 }, // release and confirm
  { story: 1976, sound: "chime", volume: 0.32 },
  { story: 2014, sound: "tap", volume: 0.5 }, // add a client request
  { story: 2046, sound: "notify", volume: 0.34 }, // the request arrives
  { story: 2092, sound: "tap", volume: 0.5 }, // analyze
  { story: 2100, sound: "flag", volume: 0.36 }, // flagged for review
  { story: 2134, sound: "tap", volume: 0.5 }, // prepare change proposal
  { story: 2212, sound: "tap", volume: 0.5 }, // copy message
  { story: 2218, sound: "whoosh", volume: 0.22 },
  { story: 2398, sound: "pop", volume: 0.24 },
  { story: 2412, sound: "pop", volume: 0.24 },
  { story: 2478, sound: "whoosh", volume: 0.26 },
  { story: 2548, sound: "logo", volume: 0.5 }, // the brand mark: "OwlSet."
];

const FILM: { at: number; sound: string; volume: number }[] = [
  { at: 104, sound: "tap", volume: 0.5 }, // Kwagi taps the message
  { at: 151, sound: "tap", volume: 0.5 },
  { at: 178, sound: "hoot", volume: 0.5 }, // in the pause after "One quick revision"
  { at: 858, sound: "tap", volume: 0.45 }, // wing on the clock
  { at: 1962, sound: "hoot", volume: 0.55 }, // after the last word
];

const CUES = [...STORY.map((cue) => ({ at: toFilm(cue.story), sound: cue.sound, volume: cue.volume })), ...FILM];

export const Sound: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Audio name="Voiceover" from={VOICE_START} src={staticFile("audio/owlset_voiceover.mp3")} premountFor={fps} />
      {/* The music sits under the voice, and comes up once the last word has been said. */}
      <Audio
        name="Music"
        src={file("music")}
        premountFor={fps}
        volume={interpolate(frame, [0, 8, 26, 1955, 1990], [0.6, 0.6, 0.34, 0.34, 0.62], clamp)}
      />
      {CUES.map((cue, i) => (
        <Audio key={i} name={cue.sound} from={cue.at} src={file(cue.sound)} volume={cue.volume} premountFor={fps} />
      ))}
    </>
  );
};
