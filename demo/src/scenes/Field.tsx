import type React from "react";
import { colors } from "../../owlsetTheme";
import { easeInOut, lerp, p, rand, spring, window, useStory } from "../lib";
import { mono, sans } from "../ui";

/**
 * The messages that multiply out of the first one (scene 1), tangle into a network (scene 2),
 * then flatten into the task list beside the clock (scene 3). Each stays one object throughout.
 */
const FIRST = "Can we add one more thing?";
/** In scene 3 the first five become the agreed work and the next four the work added since. */
const TASKS = ["Home page", "Menu page", "About page", "Gallery page", "Contact form", "Another page", "Animations", "A quick revision", "One more round"];
const MESSAGES: { text: string; x: number; y: number; born: number }[] = [
  { text: FIRST, x: 470, y: 250, born: 262 },
  { text: FIRST, x: 1470, y: 760, born: 284 },
  { text: FIRST, x: 1430, y: 220, born: 300 },
  { text: FIRST, x: 480, y: 780, born: 312 },
  { text: "Can we redesign this?", x: 240, y: 500, born: 470 },
  { text: "Please add another page.", x: 1660, y: 480, born: 505 },
  { text: "Let’s include animations.", x: 960, y: 880, born: 560 },
  { text: "Just a quick revision.", x: 960, y: 110, born: 610 },
  { text: "One more round?", x: 300, y: 110, born: 660 },
  { text: "Could it be done by Friday?", x: 1580, y: 960, born: 700 },
  { text: "Small tweak!", x: 1700, y: 110, born: 740 },
  { text: "Also a booking form?", x: 300, y: 960, born: 775 },
];

const ORIGIN = { x: 960, y: 500 };
const MORPH = [830, 915] as const; // messages become task chips
const LIST = { x: 140, y: 318, w: 420, h: 50, gap: 62 };
/** When each chip is counted as a task in scene 3. The first five are there from the start. */
export const TASK_ADDED = [915, 915, 915, 915, 915, 985, 1055, 1125, 1195];

const LINKS: [number, number][] = [[0, 4], [2, 5], [1, 6], [3, 6], [0, 7], [2, 7], [4, 8], [5, 10], [1, 9], [3, 11], [6, 9], [7, 10], [4, 11], [8, 7]];

function position(i: number, frame: number) {
  const m = MESSAGES[i];
  const out = p(frame, m.born, m.born + 46, spring);
  const drift = { x: Math.sin(frame / 47 + i * 1.9) * 16, y: Math.cos(frame / 53 + i * 2.3) * 12 };
  const scattered = { x: lerp(ORIGIN.x, m.x, out) + drift.x * out, y: lerp(ORIGIN.y, m.y, out) + drift.y * out };
  const t = p(frame, MORPH[0] + i * 2, MORPH[1] + i * 2, easeInOut);
  const row = Math.min(i, TASK_ADDED.length - 1);
  return {
    x: lerp(scattered.x, LIST.x + LIST.w / 2, t),
    y: lerp(scattered.y, LIST.y + row * LIST.gap + LIST.h / 2, t),
    t,
    out,
  };
}

export const Field: React.FC = () => {
  const frame = useStory();
  if (frame < 255 || frame > 1420) return null;
  const places = MESSAGES.map((_, i) => position(i, frame));
  const linesOpacity = window(frame, 300, 340, 820, 880);
  const leave = 1 - p(frame, 1300, 1380, easeInOut);

  return (
    <>
      {/* The thread: thin mint lines from the first message to every copy, then between copies. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: linesOpacity }}>
        {MESSAGES.map((m, i) => {
          const drawn = p(frame, m.born + 6, m.born + 50);
          const to = places[i];
          const length = Math.hypot(to.x - ORIGIN.x, to.y - ORIGIN.y);
          return (
            <line
              key={`o${i}`}
              x1={ORIGIN.x}
              y1={ORIGIN.y}
              x2={to.x}
              y2={to.y}
              stroke={colors.primary}
              strokeWidth={2}
              strokeOpacity={0.5}
              strokeDasharray={length}
              strokeDashoffset={length * (1 - drawn)}
            />
          );
        })}
        {LINKS.map(([a, b], i) => {
          const start = Math.max(MESSAGES[a].born, MESSAGES[b].born) + 30;
          const drawn = p(frame, start, start + 60);
          const from = places[a];
          const to = places[b];
          const length = Math.hypot(to.x - from.x, to.y - from.y);
          return (
            <line
              key={`l${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={colors.primary}
              strokeWidth={1.5}
              strokeOpacity={0.32}
              strokeDasharray={length}
              strokeDashoffset={length * (1 - drawn)}
            />
          );
        })}
      </svg>

      {MESSAGES.map((m, i) => {
        const place = places[i];
        if (frame < m.born) return null;
        const isTask = i < TASK_ADDED.length;
        const width = lerp(m.text.length * 15.5 + 52, LIST.w, place.t);
        const height = lerp(60, LIST.h, place.t);
        // Later tasks wait, faded, until the moment they are added to the workload.
        const added = isTask ? p(frame, TASK_ADDED[i] - 4, TASK_ADDED[i] + 16) : 0;
        const opacity = place.out * lerp(1, isTask ? lerp(0, 1, added) : 0, place.t) * leave;
        const fresh = isTask && i >= 5 ? window(frame, TASK_ADDED[i] - 4, TASK_ADDED[i] + 10, TASK_ADDED[i] + 40, TASK_ADDED[i] + 70) : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: place.x - width / 2,
              top: place.y - height / 2,
              width,
              height,
              opacity,
              rotate: `${(rand(i) - 0.5) * 7 * (1 - place.t)}deg`,
              scale: lerp(0.5, 1, place.out),
              display: "flex",
              alignItems: "center",
              gap: 14,
              paddingInline: lerp(26, 16, place.t),
              background: colors.surface,
              border: `${fresh > 0.05 ? 2 : 1.5}px solid ${fresh > 0.05 ? colors.status.additional.text : colors.borderStrong}`,
              color: colors.text,
              fontFamily: sans,
              fontSize: lerp(27, 23, place.t),
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <span style={{ fontFamily: mono, fontSize: 19, color: i >= 5 ? colors.status.additional.text : colors.primary, opacity: place.t, width: place.t * 34, overflow: "hidden" }}>
              {i >= 5 ? `+${i - 4}` : i + 1}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", opacity: Math.abs(place.t - 0.5) * 2 }}>{place.t > 0.5 && isTask ? TASKS[i] : m.text}</span>
          </div>
        );
      })}
    </>
  );
};
