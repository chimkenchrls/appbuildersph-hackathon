import { colors } from "../owlsetTheme";
import { clamp, easeInOut, lerp, mix } from "./lib";
import { interpolate } from "remotion";

/**
 * The one element that travels through the whole film. It is never cut away from:
 * cursor → chat message → checklist → clock → phone → change proposal → project card → brand field.
 */
export type HeroState = {
  x: number; // centre
  y: number;
  w: number;
  h: number;
  rotate: number;
  border: number;
  borderColor: string;
  background: string;
};

type Key = HeroState & { f: number };

const dark = colors.background;

const KEYS: Key[] = [
  // Scene 1: a blinking cursor becomes the first message.
  { f: 0, x: 960, y: 500, w: 6, h: 64, rotate: 0, border: 0, borderColor: colors.primary, background: colors.primary },
  { f: 40, x: 960, y: 500, w: 6, h: 64, rotate: 0, border: 0, borderColor: colors.primary, background: colors.primary },
  { f: 70, x: 960, y: 500, w: 940, h: 136, rotate: 0, border: 2, borderColor: colors.borderStrong, background: colors.surface },
  { f: 286, x: 960, y: 500, w: 940, h: 136, rotate: 0, border: 2, borderColor: colors.borderStrong, background: colors.surface },
  { f: 330, x: 960, y: 500, w: 560, h: 84, rotate: 0, border: 2, borderColor: colors.primary, background: colors.surface },
  // Scene 2: it grows into the project checklist at the middle of the tangle.
  { f: 470, x: 960, y: 500, w: 560, h: 84, rotate: 0, border: 2, borderColor: colors.primary, background: colors.surface },
  { f: 540, x: 960, y: 470, w: 560, h: 470, rotate: 0, border: 2, borderColor: colors.borderStrong, background: colors.surface },
  { f: 830, x: 960, y: 470, w: 560, h: 470, rotate: 0, border: 2, borderColor: colors.borderStrong, background: colors.surface },
  // Scene 3: the checklist squares off into a clock face.
  { f: 915, x: 960, y: 500, w: 480, h: 480, rotate: 0, border: 3, borderColor: colors.primary, background: dark },
  { f: 1300, x: 960, y: 500, w: 480, h: 480, rotate: 0, border: 3, borderColor: colors.primary, background: dark },
  // Scene 4: the stopped clock stretches into a phone.
  { f: 1395, x: 960, y: 540, w: 440, h: 886, rotate: 0, border: 2, borderColor: colors.borderStrong, background: dark },
  { f: 1760, x: 960, y: 540, w: 440, h: 886, rotate: 0, border: 2, borderColor: colors.borderStrong, background: dark },
  // Scene 5: the phone comes forward for the walkthrough.
  { f: 1830, x: 960, y: 540, w: 480, h: 968, rotate: 0, border: 2, borderColor: colors.borderStrong, background: dark },
  { f: 2215, x: 960, y: 540, w: 480, h: 968, rotate: 0, border: 2, borderColor: colors.borderStrong, background: dark },
  // Scene 6: the phone folds down into the proposal, then a project card, then the brand field.
  { f: 2290, x: 960, y: 500, w: 720, h: 400, rotate: 0, border: 2, borderColor: colors.primary, background: colors.surface },
  { f: 2340, x: 960, y: 500, w: 720, h: 400, rotate: 0, border: 2, borderColor: colors.primary, background: colors.surface },
  { f: 2395, x: 960, y: 470, w: 500, h: 280, rotate: 0, border: 2, borderColor: colors.borderStrong, background: colors.surface },
  { f: 2475, x: 960, y: 470, w: 500, h: 280, rotate: 0, border: 2, borderColor: colors.borderStrong, background: colors.surface },
  { f: 2560, x: 960, y: 540, w: 1940, h: 1100, rotate: 0, border: 0, borderColor: colors.primary, background: colors.primary },
  { f: 2700, x: 960, y: 540, w: 1940, h: 1100, rotate: 0, border: 0, borderColor: colors.primary, background: colors.primary },
];

export function heroAt(frame: number): HeroState {
  let i = 0;
  while (i < KEYS.length - 2 && frame >= KEYS[i + 1].f) i += 1;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = interpolate(frame, [a.f, b.f], [0, 1], { ...clamp, easing: easeInOut });
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    w: lerp(a.w, b.w, t),
    h: lerp(a.h, b.h, t),
    rotate: lerp(a.rotate, b.rotate, t),
    border: lerp(a.border, b.border, t),
    borderColor: mix(t, a.borderColor, b.borderColor),
    background: mix(t, a.background, b.background),
  };
}
