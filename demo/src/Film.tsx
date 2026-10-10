import type React from "react";
import { AbsoluteFill } from "remotion";
import { colors, signature } from "../owlsetTheme";
import { heroAt } from "./hero";
import { Kwagi } from "./Kwagi";
import { easeInOut, lerp, p, typed, useStory, window } from "./lib";
import { ClockFace, CostPanels } from "./scenes/Cost";
import { Field } from "./scenes/Field";
import { PhoneScreen } from "./scenes/Phone";
import { Sound } from "./Sound";
import { Badge, mono, sans } from "./ui";
import { EndCard } from "./Words";

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Dark ground with the site's teal glow. The light cools as things go wrong and warms at the reveal. */
const Background: React.FC = () => {
  const frame = useStory();
  const tension = window(frame, 760, 915, 1300, 1400);
  const reveal = p(frame, 1340, 1440);
  return (
    <AbsoluteFill style={{ background: colors.background }}>
      <AbsoluteFill style={{ background: signature.heroGlow, opacity: lerp(1, 0.25, tension) }} />
      <AbsoluteFill
        style={{
          background: "radial-gradient(46% 62% at 50% 50%, #1C3E44, transparent 76%)",
          opacity: reveal * (1 - p(frame, 2215, 2300)),
        }}
      />
    </AbsoluteFill>
  );
};

/** Hairlines that sweep across as the tangle resolves into order, between the clock and the phone. */
const OrderLines: React.FC = () => {
  const frame = useStory();
  const opacity = window(frame, 1312, 1340, 1400, 1450);
  if (opacity <= 0) return null;
  return (
    <AbsoluteFill style={{ opacity }}>
      {Array.from({ length: 7 }, (_, i) => {
        const grow = p(frame, 1312 + i * 5, 1380 + i * 5, easeInOut);
        return <div key={i} style={{ position: "absolute", left: 0, top: 180 + i * 120, height: 1.5, width: `${grow * 100}%`, background: colors.primary, opacity: 0.35 }} />;
      })}
    </AbsoluteFill>
  );
};

/** What the hero shows at each stage. Stages cross-fade while its outline keeps morphing. */
const HeroContent: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const frame = useStory();
  const message = window(frame, 58, 72, 474, 500);
  const checklist = window(frame, 510, 545, 835, 875);
  const clock = window(frame, 880, 915, 1318, 1362);
  const phone = window(frame, 1385, 1420, 2222, 2262);
  const proposal = window(frame, 2262, 2292, 2346, 2372);
  const card = window(frame, 2358, 2386, 2478, 2505);

  const items = [
    { label: "Five responsive pages", doneAt: 560 },
    { label: "Contact form", doneAt: 610 },
    { label: "Menu and gallery content", doneAt: 670 },
    { label: "Another page", addedAt: 596 },
    { label: "Animations", addedAt: 650 },
    { label: "A quick revision", addedAt: 706 },
    { label: "Redesign the header", addedAt: 762 },
  ];

  return (
    <>
      {message > 0 ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingInline: h * 0.34, opacity: message, fontFamily: sans, fontSize: h * 0.4, color: colors.text, whiteSpace: "nowrap", overflow: "hidden" }}>
          {typed("Can we add one more thing?", frame, 74, 0.55)}
          {frame < 140 && frame % 20 < 12 ? <span style={{ width: 3, height: h * 0.44, marginLeft: 4, background: colors.primary }} /> : null}
        </div>
      ) : null}

      {checklist > 0 ? (
        <div style={{ position: "absolute", inset: 0, padding: 34, opacity: checklist, fontFamily: sans, color: colors.text, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>Project scope</span>
            <span style={{ fontFamily: mono, fontSize: 22, color: colors.textSecondary }}>{3 + items.filter((item) => item.addedAt && frame >= item.addedAt).length} items</span>
          </div>
          <div style={{ marginTop: 20, display: "grid", gap: 11 }}>
            {items.map((item) => {
              const shown = item.addedAt ? p(frame, item.addedAt, item.addedAt + 18) : 1;
              const done = item.doneAt ? frame >= item.doneAt : false;
              return (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 16, height: 38 * shown, opacity: shown, overflow: "hidden", fontSize: 26 }}>
                  <span style={{ width: 22, height: 22, flex: "none", border: `2px solid ${done ? colors.primary : item.addedAt ? colors.status.additional.text : colors.borderStrong}`, background: done ? colors.primary : "transparent" }} />
                  <span style={{ color: done ? colors.textSecondary : item.addedAt ? colors.status.additional.text : colors.text }}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {clock > 0 ? <ClockFace size={Math.min(w, h)} opacity={clock} /> : null}

      {phone > 0 ? <PhoneScreen width={w} height={h} opacity={phone} /> : null}

      {proposal > 0 ? (
        <div style={{ position: "absolute", inset: 0, padding: 40, opacity: proposal, fontFamily: sans, color: colors.text, display: "grid", alignContent: "center", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 44, fontWeight: 560, letterSpacing: "-0.03em" }}>Change proposal</span>
            <Badge kind="draft" size={22}>Draft</Badge>
          </div>
          <div style={{ fontSize: 30, color: colors.textSecondary }}>Customer accounts with login</div>
          <div style={{ display: "flex", gap: 44, marginTop: 8, fontFamily: mono, fontSize: 34 }}>
            <span>PHP 7,000</span>
            <span>+5 days</span>
          </div>
          <div style={{ fontSize: 26, color: colors.textSecondary }}>Written with OwlSet. Reviewed and sent by you.</div>
        </div>
      ) : null}

      {card > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: card }}>
          <ProjectCard name="Café Amihan website" badge="Agreement v1, confirmed" line="1 change proposal drafted" />
        </div>
      ) : null}
    </>
  );
};

const ProjectCard: React.FC<{ name: string; badge: string; line: string }> = ({ name, badge, line }) => (
  <div style={{ position: "absolute", inset: 0, padding: 34, display: "grid", alignContent: "center", gap: 18, fontFamily: sans, color: colors.text }}>
    <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em" }}>{name}</div>
    <Badge kind="confirmed" size={21}>{badge}</Badge>
    <div style={{ fontSize: 25, color: colors.textSecondary }}>{line}</div>
  </div>
);

/** The other tidy projects that line up beside the hero card: the opposite of the opening tangle. */
const Neighbours: React.FC = () => {
  const frame = useStory();
  const cards = [
    { x: 400, name: "Harbor Studio rebrand", badge: "Agreement v2, confirmed", line: "Scope clear", at: 2398 },
    { x: 1520, name: "Lakbay travel blog", badge: "Agreement v1, confirmed", line: "Scope clear", at: 2412 },
  ];
  return (
    <>
      {cards.map((card) => {
        const shown = window(frame, card.at, card.at + 26, 2470, 2496);
        if (shown <= 0) return null;
        return (
          <div
            key={card.name}
            style={{ position: "absolute", left: card.x - 250, top: 470 - 140, width: 500, height: 280, background: colors.surface, border: `2px solid ${colors.borderStrong}`, opacity: shown, translate: `0px ${(1 - shown) * 16}px` }}
          >
            <ProjectCard name={card.name} badge={card.badge} line={card.line} />
          </div>
        );
      })}
    </>
  );
};

export const OwlSetFilm: React.FC = () => {
  const frame = useStory();
  const hero = heroAt(frame);

  // One slow camera: pushes in on the first message, widens for the tangle, then holds steady.
  const zoom =
    lerp(1, 1.07, p(frame, 0, 262, easeInOut)) *
    lerp(1, 0.86 / 1.07, p(frame, 262, 520, easeInOut)) *
    lerp(1, 1 / 0.86, p(frame, 830, 930, easeInOut)) *
    lerp(1, 1.03, p(frame, 930, 1300)) *
    lerp(1, 1 / 1.03, p(frame, 1300, 1395, easeInOut));
  // The phone turns toward the viewer as it arrives, then settles.
  const turn = lerp(-26, 0, p(frame, 1370, 1520, easeInOut)) * p(frame, 1340, 1395) + Math.sin(frame / 60) * 2.5 * window(frame, 1520, 1560, 1750, 1790);
  // The light that runs around the phone frame as the screen comes on.
  const trace = p(frame, 1388, 1470, easeInOut);
  const perimeter = 2 * (hero.w + hero.h);

  return (
    <AbsoluteFill style={{ background: colors.background, overflow: "hidden" }}>
      <Background />
      <AbsoluteFill style={{ scale: zoom, transformOrigin: "50% 46%" }}>
        <OrderLines />
        <Field />
        <CostPanels />
        <Neighbours />
        <Kwagi layer="behind" />

        {/* The hero */}
        <div
          style={{
            position: "absolute",
            left: hero.x - hero.w / 2,
            top: hero.y - hero.h / 2,
            width: hero.w,
            height: hero.h,
            background: hero.background,
            border: `${hero.border}px solid ${hero.borderColor}`,
            boxSizing: "border-box",
            transform: `perspective(1800px) rotateY(${turn}deg)`,
            overflow: "hidden",
          }}
        >
          <HeroContent w={hero.w - hero.border * 2} h={hero.h - hero.border * 2} />
        </div>
        {trace > 0 && trace < 1 ? (
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, transform: `perspective(1800px) rotateY(${turn}deg)`, transformOrigin: `${hero.x}px ${hero.y}px` }}>
            <rect
              x={hero.x - hero.w / 2}
              y={hero.y - hero.h / 2}
              width={hero.w}
              height={hero.h}
              fill="none"
              stroke={colors.primary}
              strokeWidth={4}
              strokeDasharray={`${perimeter * 0.22} ${perimeter}`}
              strokeDashoffset={-perimeter * trace}
            />
          </svg>
        ) : null}

        <EndCard />
        <Kwagi layer="front" />
      </AbsoluteFill>
      {/* Film grain over everything, as on the site. */}
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.5, mixBlendMode: "soft-light", pointerEvents: "none" }} />
      <Sound />
    </AbsoluteFill>
  );
};
