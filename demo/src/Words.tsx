import type React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { colors } from "../owlsetTheme";
import { p, said } from "./lib";
import { mono, sans } from "./ui";

/**
 * The only words on screen are the closing card's. Its lines land on the voiceover's words; times
 * are seconds in the voiceover file, from a word-level transcript of it.
 * There are no headlines and no subtitles: the narration carries the message.
 */

/** The closing card, on the mint field the hero has become. Each line lands on its spoken words. */
export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const mark = p(frame, said(58.46) - 2, said(58.46) + 18);
  if (mark <= 0) return null;
  const protect = p(frame, said(59.32), said(59.32) + 14);
  const keep = p(frame, said(60.38), said(60.38) + 14);
  const url = p(frame, said(61.96), said(61.96) + 16);
  return (
    <div style={{ position: "absolute", left: 250, top: 300, fontFamily: sans, color: colors.onPrimary }}>
      <div style={{ display: "flex", alignItems: "center", gap: 40, opacity: mark, translate: `0px ${(1 - mark) * 16}px` }}>
        <Img src={staticFile("kwagi/logo.png")} style={{ width: 250 }} />
        <span style={{ fontSize: 230, fontWeight: 600, letterSpacing: "-0.045em", lineHeight: 1 }}>OwlSet</span>
      </div>
      <div style={{ marginTop: 44, fontSize: 68, fontWeight: 560, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
        <span style={{ opacity: protect }}>Protect your scope.</span> <span style={{ opacity: keep }}>Keep work moving.</span>
      </div>
      <div style={{ marginTop: 34, display: "inline-block", padding: "12px 22px", background: colors.onPrimary, color: colors.primary, fontFamily: mono, fontSize: 44, opacity: url }}>
        owlsetph.vercel.app
      </div>
    </div>
  );
};
