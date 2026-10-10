import type React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, easeInOut, spring, window } from "./lib";

/**
 * Kwagi, as one drawing: the app's layered full-body artwork. He rises, ducks, blinks, and moves one wing.
 */
const RATIO = 940 / 896; // height over width of the drawing
const PIVOT = { x: 0.7411, y: 0.6191 }; // shoulder of the wing that moves

/**
 * Kwagi appears three times, each when he has something to do: he taps the first message,
 * he stops the clock, and he stands beside the brand mark. He never travels across the frame.
 * He peeks up from behind the thing he is there for and ducks back down behind it, so each
 * move is about his own height and the object hides the rest.
 */
const VISIBLE: [number, number][] = [[62, 228], [670, 912], [1798, 2040]];

/** Where he is (centre of the drawing) and his width there. Frames are film frames. */
const SPOTS: { f: number; x: number; y: number; w: number }[] = [
  { f: 62, x: 1150, y: 452, w: 220 }, // behind the first message
  { f: 94, x: 1150, y: 325, w: 220 }, // risen: perched on its top edge
  { f: 192, x: 1150, y: 325, w: 220 }, // he has tapped it twice and hooted
  { f: 226, x: 1150, y: 478, w: 220 }, // ducks back down as the copies spread
  { f: 672, x: 960, y: 378, w: 200 }, // hidden behind the clock
  { f: 704, x: 960, y: 161, w: 200 }, // rises onto its top edge
  { f: 878, x: 960, y: 161, w: 200 },
  { f: 910, x: 960, y: 378, w: 200 }, // sinks back behind it before it becomes the phone
  { f: 1800, x: 1600, y: 1260, w: 300 }, // below the bottom edge of the frame
  { f: 1846, x: 1600, y: 505, w: 300 }, // rises up beside the brand mark
  { f: 2040, x: 1600, y: 505, w: 300 },
];

const DUCK = Easing.bezier(0.45, 0, 0.55, 1);

/** Wing gestures: [start, hold frames]. A hold of 0 is a wave; longer is a raised, pointing wing. */
const GESTURES: [number, number][] = [
  [94, 4], // taps the message: "One extra feature"
  [141, 4], // and again: "One quick revision"
  [848, 22], // holds the clock: "more than you planned"
  [1948, 0], // goodbye, after the last word
];

const RAISE = 10;
const LOWER = 12;
const WAVE = 22;

function wingAngle(frame: number) {
  let angle = 0;
  for (const [start, hold] of GESTURES) {
    const middle = hold > 0 ? hold : WAVE;
    const end = start + RAISE + middle + LOWER;
    if (frame < start || frame > end) continue;
    const up = interpolate(frame, [start, start + RAISE, start + RAISE + middle, end], [0, 1, 1, 0], { ...clamp, easing: easeInOut });
    const swing = hold > 0 ? 0 : Math.sin(((frame - start - RAISE) / WAVE) * Math.PI * 4) * 17 * window(frame, start + RAISE - 2, start + RAISE + 3, start + RAISE + WAVE - 3, start + RAISE + WAVE + 2);
    angle = -98 * up + swing * up;
  }
  return angle;
}

function spotAt(frame: number) {
  let i = 0;
  while (i < SPOTS.length - 2 && frame >= SPOTS[i + 1].f) i += 1;
  const a = SPOTS[i];
  const b = SPOTS[i + 1];
  // Rising settles softly at the top. Ducking is an even, unhurried ease: the film's sharper
  // curve would hold him still and then drop him in a few frames.
  const t = interpolate(frame, [a.f, b.f], [0, 1], { ...clamp, easing: b.y < a.y ? spring : DUCK });
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t };
}

export const Kwagi: React.FC<{ layer: "behind" | "front" }> = ({ layer }) => {
  const frame = useCurrentFrame();
  // Behind the message and the clock, so they hide him as he rises and ducks. At the end the
  // hero is the whole mint field, so there he is in front of it.
  if ((layer === "behind") !== frame < 1500) return null;
  if (!VISIBLE.some(([from, to]) => frame >= from && frame <= to)) return null;

  const at = spotAt(frame);
  // The message is shorter than he is, so there he also fades as he rises and ducks.
  const opacity = frame < 400 ? window(frame, 62, 78, 208, 226) : 1;
  const blink = frame % 131 < 5 || (frame + 47) % 211 < 5;
  const nod = window(frame, 1986, 1996, 2000, 2014) * 6;
  const height = at.w * RATIO;
  const layerStyle: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: "100%", height: "100%" };

  return (
    <div
      style={{
        position: "absolute",
        left: at.x - at.w / 2,
        top: at.y - height / 2,
        width: at.w,
        height,
        opacity,
        rotate: `${nod}deg`,
        transformOrigin: "50% 90%",
      }}
    >
      <Img src={staticFile("kwagi/layer-body.svg")} style={layerStyle} />
      <Img
        src={staticFile("kwagi/layer-wing.svg")}
        style={{ ...layerStyle, rotate: `${wingAngle(frame)}deg`, transformOrigin: `${PIVOT.x * 100}% ${PIVOT.y * 100}%` }}
      />
      <Img src={staticFile("kwagi/layer-head.svg")} style={layerStyle} />
      <Img src={staticFile("kwagi/layer-eyes.svg")} style={{ ...layerStyle, opacity: blink ? 0 : 1 }} />
    </div>
  );
};
