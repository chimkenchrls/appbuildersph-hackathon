import type React from "react";
import { colors } from "../../owlsetTheme";
import { p, window, useStory } from "../lib";
import { mono, sans } from "../ui";
import { TASK_ADDED } from "./Field";

/** Angle of the clock's minute hand: it speeds up, then slows to a stop as Kwagi holds it. */
export function clockAngle(frame: number) {
  const start = 915;
  const hold = 1258;
  const stop = 1300;
  const run = (f: number) => 0.016 * Math.pow(Math.max(0, f - start), 1.85);
  if (frame <= hold) return run(frame);
  const speed = run(hold) - run(hold - 1);
  const dt = Math.min(frame, stop) - hold;
  return run(hold) + speed * (dt - (dt * dt) / (2 * (stop - hold)));
}

/** The clock face drawn inside the hero square. */
export const ClockFace: React.FC<{ size: number; opacity: number }> = ({ size, opacity }) => {
  const frame = useStory();
  const angle = clockAngle(frame);
  const c = size / 2;
  const stopped = p(frame, 1296, 1312);
  return (
    <svg width={size} height={size} style={{ position: "absolute", inset: 0, opacity }}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const long = i % 3 === 0;
        const r1 = c * (long ? 0.7 : 0.76);
        const r2 = c * 0.84;
        return (
          <line
            key={i}
            x1={c + Math.sin(a) * r1}
            y1={c - Math.cos(a) * r1}
            x2={c + Math.sin(a) * r2}
            y2={c - Math.cos(a) * r2}
            stroke={long ? colors.primary : colors.borderStrong}
            strokeWidth={long ? 4 : 2}
          />
        );
      })}
      <line x1={c} y1={c} x2={c} y2={c - c * 0.42} stroke={colors.text} strokeWidth={7} transform={`rotate(${angle / 12} ${c} ${c})`} />
      <line x1={c} y1={c} x2={c} y2={c - c * 0.64} stroke={stopped > 0.5 ? colors.primary : colors.text} strokeWidth={4} transform={`rotate(${angle} ${c} ${c})`} />
      <rect x={c - 7} y={c - 7} width={14} height={14} fill={colors.primary} />
    </svg>
  );
};

/** Either side of the clock: the workload that keeps growing, and the fee that does not. */
export const CostPanels: React.FC = () => {
  const frame = useStory();
  const opacity = window(frame, 905, 950, 1300, 1360);
  if (opacity <= 0) return null;

  const tasks = TASK_ADDED.filter((at) => frame >= at).length;
  // Progress climbs toward done, then falls back each time a task is added.
  let done = 3.4;
  for (let f = 915; f <= frame; f += 1) {
    done = Math.min(tasks - 0.5, done + 0.017);
  }
  const progress = done / tasks;
  const bump = TASK_ADDED.slice(5).reduce((m, at) => Math.max(m, window(frame, at - 2, at + 8, at + 26, at + 50)), 0);

  return (
    <div style={{ position: "absolute", inset: 0, opacity, fontFamily: sans, color: colors.text }}>
      {/* Left: workload */}
      <div style={{ position: "absolute", left: 140, top: 150, width: 420 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em" }}>Workload</span>
          <span style={{ fontFamily: mono, fontSize: 26, color: bump > 0.1 ? colors.status.additional.text : colors.textSecondary }}>
            {tasks} tasks
          </span>
        </div>
        <div style={{ marginTop: 22, height: 14, background: colors.surfaceRaised }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: colors.primary }} />
        </div>
        <div style={{ marginTop: 12, fontFamily: mono, fontSize: 22, color: colors.textSecondary }}>
          {Math.round(progress * 100)}% done
        </div>
      </div>

      {/* Right: the agreed fee */}
      <div style={{ position: "absolute", left: 1360, top: 250, width: 420, padding: 34, border: `1.5px solid ${colors.border}`, background: colors.surface }}>
        <div style={{ fontSize: 28, color: colors.textSecondary }}>Agreed fee</div>
        <div style={{ marginTop: 12, fontSize: 62, fontWeight: 560, letterSpacing: "-0.036em", whiteSpace: "nowrap" }}>PHP 15,000</div>
        <div style={{ marginTop: 18, fontFamily: mono, fontSize: 24, color: colors.textSecondary }}>unchanged</div>
        <div style={{ marginTop: 34, paddingTop: 26, borderTop: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", fontSize: 28 }}>
          <span style={{ color: colors.textSecondary }}>Work agreed</span>
          <span style={{ fontFamily: mono }}>5 tasks</span>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 28 }}>
          <span style={{ color: colors.textSecondary }}>Work now</span>
          <span style={{ fontFamily: mono, color: tasks > 5 ? colors.status.additional.text : colors.text }}>{tasks} tasks</span>
        </div>
      </div>
    </div>
  );
};
