import type React from "react";
import {Img, staticFile } from "remotion";
import { easeInOut, lerp, p, S, window, useStory } from "../lib";

/**
 * The phone shows the app's real screens. They are screenshots of the implemented React Native
 * screens (light theme), rendered at 360×740 with the film's demo project, so nothing here is
 * redrawn by hand. Taps, typing and scrolling are played over them.
 */
const SHOT_W = 360;
const SHOT_H = 740;
const HEADER_H = 60; // the app's header bar stays put while the content scrolls
const APP_PRIMARY = "#4D8B8B";

type Screen = {
  enter: number; // frame the screen slides in (relative to the start of scene 5); the first is already there
  from: string;
  /** A second capture of the same screen, e.g. after text is pasted in. */
  filled?: { image: string; at: number };
  /** Scroll to the end of the screen: how far (px), and when. */
  scroll?: { image: string; by: number; from: number; to: number };
  taps: { at: number; x: number; y: number }[];
};

const SCREENS: Screen[] = [
  { enter: -9999, from: "projects", taps: [{ at: 8, x: 180, y: 233 }] },
  { enter: 14, from: "new", filled: { image: "new-filled", at: 42 }, taps: [{ at: 74, x: 180, y: 644 }] },
  { enter: 80, from: "draft", scroll: { image: "draft-end", by: 387, from: 118, to: 158 }, taps: [{ at: 172, x: 180, y: 561 }] },
  { enter: 178, from: "overview", taps: [{ at: 214, x: 180, y: 201 }] },
  { enter: 220, from: "request", filled: { image: "request-filled", at: 246 }, scroll: { image: "request-end", by: 135, from: 264, to: 284 }, taps: [{ at: 292, x: 180, y: 594 }] },
  { enter: 298, from: "review", taps: [{ at: 334, x: 180, y: 436 }] },
  { enter: 340, from: "proposal", scroll: { image: "proposal-end", by: 151, from: 378, to: 408 }, taps: [{ at: 412, x: 100, y: 601 }] },
];

const shot = (name: string) => staticFile(`app/${name}.png`);
const fill: React.CSSProperties = { position: "absolute", left: 0, top: 0, width: SHOT_W, height: SHOT_H, maxWidth: "none" };

const ScreenLayer: React.FC<{ screen: Screen; g: number }> = ({ screen, g }) => {
  const filled = screen.filled ? p(g, screen.filled.at, screen.filled.at + 12) : 0;
  const scrolled = screen.scroll ? p(g, screen.scroll.from, screen.scroll.to, easeInOut) : 0;
  const by = screen.scroll?.by ?? 0;
  const start = screen.filled && filled >= 1 ? screen.filled.image : screen.from;
  return (
    <>
      {/* The capture at the top of the screen, and the capture at the end of it. The second is the
          same screen scrolled by exactly `by` pixels, so moving both together reads as one scroll.
          Both are clipped below the header, which stays put. */}
      <div style={{ position: "absolute", left: 0, top: HEADER_H, width: SHOT_W, height: SHOT_H - HEADER_H, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: -HEADER_H, width: SHOT_W, height: SHOT_H, translate: `0px ${-by * scrolled}px` }}>
          <Img src={shot(screen.from)} style={fill} />
          {screen.filled ? <Img src={shot(screen.filled.image)} style={{ ...fill, opacity: filled }} /> : null}
        </div>
        {screen.scroll ? (
          <div style={{ position: "absolute", left: 0, top: -HEADER_H, width: SHOT_W, height: SHOT_H, translate: `0px ${by * (1 - scrolled)}px`, opacity: scrolled > 0 ? 1 : 0 }}>
            {/* Its own header is cut off; the fixed header above stands in for it. */}
            <Img src={shot(screen.scroll.image)} style={{ ...fill, clipPath: `inset(${HEADER_H}px 0px 0px 0px)` }} />
          </div>
        ) : null}
      </div>
      {/* Header bar, fixed. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: SHOT_W, height: HEADER_H, overflow: "hidden" }}>
        <Img src={shot(start)} style={fill} />
      </div>
      {screen.taps.map((tap) => {
        const ring = p(g, tap.at - 2, tap.at + 14);
        const visible = window(g, tap.at - 4, tap.at, tap.at + 8, tap.at + 16);
        if (visible <= 0) return null;
        const size = lerp(18, 64, ring);
        return (
          <div
            key={tap.at}
            style={{ position: "absolute", left: tap.x - size / 2, top: tap.y - size / 2, width: size, height: size, borderRadius: "50%", background: APP_PRIMARY, opacity: visible * 0.32, border: "1.5px solid #FFFFFF" }}
          />
        );
      })}
    </>
  );
};

export const PhoneScreen: React.FC<{ width: number; height: number; opacity: number }> = ({ width, height, opacity }) => {
  const frame = useStory();
  const g = frame - S.solution;
  const pad = 10;
  const scale = (width - pad * 2) / SHOT_W;
  return (
    <div style={{ position: "absolute", left: pad, top: (height - SHOT_H * scale) / 2, width: SHOT_W, height: SHOT_H, transformOrigin: "0 0", scale, opacity, overflow: "hidden", background: "#FFFFFF" }}>
      {SCREENS.map((screen, i) => {
        const next = SCREENS[i + 1];
        if (g < screen.enter - 1) return null;
        if (next && g > next.enter + 20) return null;
        const arrive = screen.enter < 0 ? 1 : p(g, screen.enter, screen.enter + 16);
        const leave = next ? p(g, next.enter, next.enter + 16) : 0;
        return (
          <div key={screen.from} style={{ position: "absolute", inset: 0, translate: `${(1 - arrive) * SHOT_W - leave * SHOT_W * 0.28}px 0px`, opacity: 1 - leave * 0.5, background: "#FFFFFF" }}>
            <ScreenLayer screen={screen} g={g} />
          </div>
        );
      })}
    </div>
  );
};
