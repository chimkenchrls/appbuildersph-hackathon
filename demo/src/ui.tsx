import type React from "react";
import { colors, fonts } from "../owlsetTheme";

export const sans = fonts.sans;
export const mono = fonts.mono;

type BadgeKind = keyof typeof colors.status | "draft";

/** A status badge, as on the site: mono text on its own dark surface, square corners. */
export const Badge: React.FC<{ kind: BadgeKind; children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  kind,
  children,
  size = 14,
  style,
}) => {
  const tone = kind === "draft" ? { text: colors.textSecondary, surface: colors.surfaceRaised } : colors.status[kind];
  return (
    <div
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        padding: `${size * 0.3}px ${size * 0.6}px`,
        background: tone.surface,
        color: tone.text,
        fontFamily: mono,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
};
