import { Easing, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { motion } from "../owlsetTheme";

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const TOTAL = 68 * FPS;
/** The voiceover starts half a second in. */
export const VOICE_START = 15;
/** A time in the voiceover (seconds) as a film frame. */
export const said = (seconds: number) => Math.round(seconds * FPS) + VOICE_START;

/** Scene starts in story frames (see `useStory`). */
export const S = { hook: 0, problem: 450, cost: 900, reveal: 1350, solution: 1800, cta: 2250 } as const;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const easeOut = Easing.bezier(motion.easeOut[0], motion.easeOut[1], motion.easeOut[2], motion.easeOut[3]);
export const easeInOut = Easing.bezier(motion.easeInOut[0], motion.easeInOut[1], motion.easeInOut[2], motion.easeInOut[3]);
/** The brand's no-overshoot spring. */
export const spring = Easing.spring({ damping: 200 });

/** Progress from 0 to 1 between two frames. */
export const p = (frame: number, from: number, to: number, easing: (t: number) => number = easeOut) =>
  interpolate(frame, [from, to], [0, 1], { ...clamp, easing });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Visible between two windows: fades in over [inA, inB], out over [outA, outB]. */
export const window = (frame: number, inA: number, inB: number, outA: number, outB: number) =>
  Math.min(p(frame, inA, inB), 1 - p(frame, outA, outB));

export const mix = (t: number, a: string, b: string) => interpolateColors(t, [0, 1], [a, b]);

/** Text revealed one character at a time. */
export const typed = (text: string, frame: number, start: number, charsPerFrame = 0.6) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * charsPerFrame)));

/** Deterministic pseudo-random number in [0, 1) for an index. */
export const rand = (i: number, salt = 0) => {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * The picture was choreographed on its own 90-second timeline ("story frames"). The film now
 * follows the voiceover instead, so each story moment is pinned to the film frame where its
 * words are spoken: [story frame, film frame]. Between pins the story plays at an even rate.
 */
const PINS: [number, number][] = [
  [0, 0],
  [74, 22], // the message starts typing: "It starts with one small request"
  [122, 70],
  [262, 106], // first copy: "One extra feature"
  [284, 153], // second copy: "One quick revision"
  [300, 200],
  [312, 214], // "You say yes"
  [330, 232],
  [470, 300], // more arrive: "what happens when the requests keep coming?"
  [505, 330],
  [540, 371], // the checklist: "Agreements get buried in messages"
  [596, 441], // an item is added: "Deliverables change"
  [650, 481], // another: "Expectations shift"
  [706, 545], // "And suddenly, you're not even sure..."
  [762, 590],
  [775, 600],
  [830, 628], // the tangle winds into the clock
  [915, 668], // "Every extra task takes time"
  [985, 680],
  [1055, 708],
  [1125, 742], // "Every extra revision takes energy"
  [1195, 770],
  [1258, 860], // the clock slows: "costing more than you planned"
  [1300, 884],
  [1300, 904], // held, stopped
  [1395, 944], // the phone: "That's where OwlSet comes in"
  [1760, 1212],
  [1808, 1228], // tap New Project
  [1814, 1232],
  [1842, 1252], // pasted: "Capture conversations"
  [1874, 1274],
  [1880, 1278], // scope draft: "review deliverables"
  [1918, 1290],
  [1958, 1312],
  [1972, 1322], // tap: "confirm your scope"
  [1978, 1326],
  [2014, 1354], // "Check new requests"
  [2020, 1358],
  [2046, 1376],
  [2064, 1388],
  [2084, 1400],
  [2092, 1410],
  [2098, 1414], // findings: "Spot potential changes"
  [2114, 1428],
  [2134, 1462],
  [2140, 1466], // proposal: "And draft professional change proposals"
  [2178, 1500],
  [2208, 1522],
  [2212, 1552], // tap Copy: "with you in control"
  [2215, 1574], // the phone folds into the proposal: "Your time matters"
  [2290, 1612],
  [2340, 1622], // the project card: "Your work deserves clarity"
  [2395, 1650],
  [2398, 1664], // the other cards: "every project deserves clear expectations"
  [2412, 1676],
  [2475, 1746],
  [2560, 1772], // the mint field: "OwlSet."
  [2700, TOTAL],
];

/** Film frame → story frame. */
export function toStory(film: number) {
  for (let i = 1; i < PINS.length; i += 1) {
    if (film <= PINS[i][1]) {
      const [s0, f0] = PINS[i - 1];
      const [s1, f1] = PINS[i];
      return f1 === f0 ? s1 : s0 + ((film - f0) / (f1 - f0)) * (s1 - s0);
    }
  }
  return PINS[PINS.length - 1][0];
}

/** Story frame → film frame, for placing sounds on story events. */
export function toFilm(story: number) {
  for (let i = 1; i < PINS.length; i += 1) {
    if (story <= PINS[i][0] && PINS[i][0] !== PINS[i - 1][0]) {
      const [s0, f0] = PINS[i - 1];
      const [s1, f1] = PINS[i];
      return Math.round(f0 + ((story - s0) / (s1 - s0)) * (f1 - f0));
    }
  }
  return TOTAL;
}

/** The current story frame. Scenes use this where they used to use the film frame. */
export const useStory = () => toStory(useCurrentFrame());
