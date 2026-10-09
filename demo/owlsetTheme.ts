/**
 * OwlSet design system, extracted from the live landing page https://owlsetph.vercel.app
 * (computed styles read in a browser on 10 October 2026). Reusable in Remotion: this file has
 * no imports, so it can be copied into a Remotion project as is.
 *
 * Note: this is the landing page's dark "Mint Teal" look. The mobile app's own tokens
 * (src/constants/theme.ts) have since moved to a light theme and are not what is recorded here.
 *
 * Fonts. The site self-hosts two variable fonts (weights 100 to 900):
 *   public/fonts/Geist-Variable.woff2       family "Geist"
 *   public/fonts/GeistMono-Variable.woff2   family "Geist Mono"
 * In Remotion, copy both into the project's public/ folder and load them once, for example:
 *   import { loadFont } from '@remotion/fonts';
 *   import { staticFile } from 'remotion';
 *   loadFont({ family: 'Geist', url: staticFile('fonts/Geist-Variable.woff2'), weight: '100 900' });
 *   loadFont({ family: 'Geist Mono', url: staticFile('fonts/GeistMono-Variable.woff2'), weight: '100 900' });
 */

export const colors = {
  // Ground and surfaces, darkest to lightest
  background: '#0B1214',
  surface: '#111C1F', // alternate sections, mockup screens, chat fragments
  surfaceRaised: '#1A2A2E', // selected rows, cited clauses, badge fill

  // Text
  text: '#E8F0EE',
  textSecondary: '#9DB2B0',

  // Primary: mint. Buttons, links, the wordmark, active markers, the closing section's field.
  primary: '#86D3C5',
  primaryPressed: '#68B8AA',
  onPrimary: '#0B1214',

  // Accent: deep teal, Kwagi's body colour. One full-width band and the speech bubble's shadow.
  accent: '#2C6E78',
  onAccent: '#F0F8F6',

  // Hairlines
  border: '#263A3E',
  borderStrong: '#6F8C8C', // control outlines, mockup frames

  // Status badges: text on its own dark surface
  status: {
    confirmed: { text: '#86D3C5', surface: '#1A2A2E' },
    included: { text: '#86D9A0', surface: '#11261B' },
    additional: { text: '#F0B866', surface: '#2B200E' }, // also "Demo data"
    clarification: { text: '#8FB4F5', surface: '#131E36' },
    aiSuggestion: { text: '#CDB4DD', surface: '#36293D' },
  },
} as const;

/** Kwagi's own colours, from MASCOT.md. Use them for anything drawn to match him. */
export const kwagi = {
  body: '#346A74',
  bodyShade: '#2A5861',
  face: '#CBECCF',
  eyeWhite: '#FBF8EC',
  amber: '#E68A1D', // irises, beak, feet
  outline: '#070B0B',
  tie: '#292927',
} as const;

export const fonts = {
  sans: "'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  /** Weights in use. 560 is the display weight; it needs the variable font. */
  weight: { regular: 400, medium: 500, display: 560, semibold: 600 },
} as const;

/**
 * Type styles as measured at a 1440px-wide window. Sizes are px; letterSpacing is em, so it
 * scales if you enlarge the type for video. Large text is tightened, small text slightly opened.
 */
export const type = {
  statement: { fontFamily: fonts.sans, fontSize: 68, fontWeight: 560, lineHeight: 1.02, letterSpacing: '-0.038em' },
  h1: { fontFamily: fonts.sans, fontSize: 58, fontWeight: 560, lineHeight: 1.04, letterSpacing: '-0.036em' },
  h2: { fontFamily: fonts.sans, fontSize: 42, fontWeight: 560, lineHeight: 1.1, letterSpacing: '-0.03em' },
  h3: { fontFamily: fonts.sans, fontSize: 19, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.015em' },
  wordmark: { fontFamily: fonts.sans, fontSize: 22, fontWeight: 600, lineHeight: 1.5, letterSpacing: '-0.03em' },
  lead: { fontFamily: fonts.sans, fontSize: 19, fontWeight: 400, lineHeight: 1.5, letterSpacing: '0em' },
  body: { fontFamily: fonts.sans, fontSize: 17, fontWeight: 400, lineHeight: 1.6, letterSpacing: '0em' },
  button: { fontFamily: fonts.sans, fontSize: 16, fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.01em' },
  nav: { fontFamily: fonts.sans, fontSize: 15, fontWeight: 500, lineHeight: 1.5, letterSpacing: '0em' },
  fine: { fontFamily: fonts.sans, fontSize: 14, fontWeight: 400, lineHeight: 1.5, letterSpacing: '0.005em' },
  /** Requirement IDs (R1, T2), counters and badge labels. Tabular figures. */
  mono: { fontFamily: fonts.mono, fontSize: 14, fontWeight: 500, lineHeight: 1.5, letterSpacing: '0em' },
  badge: { fontFamily: fonts.mono, fontSize: 14, fontWeight: 600, lineHeight: 1.4, letterSpacing: '0em' },
} as const;

/** Every corner on the site is square: all 328 elements measured had a radius of 0. */
export const radius = { button: 0, card: 0, badge: 0, input: 0 } as const;

/**
 * The site uses no soft shadows. Depth comes from surface tone and 1px hairlines.
 * The single shadow is a hard, unblurred offset in the accent colour, on Kwagi's speech bubble.
 */
export const shadows = {
  none: 'none',
  hardOffset: `5px 5px 0 ${colors.accent}`,
} as const;

export const components = {
  buttonPrimary: {
    background: colors.primary, color: colors.onPrimary, borderRadius: 0, minHeight: 48,
    paddingInline: 22, ...type.button, pressedScale: 0.97,
  },
  /** Selectable rows and clause cards: outlined, no fill until selected. */
  card: { border: `1px solid ${colors.border}`, borderRadius: 0, padding: '14px 16px', background: 'transparent' },
  cardSelected: { border: `1px solid ${colors.primary}`, background: colors.surfaceRaised },
  option: { border: `1px solid ${colors.borderStrong}`, borderRadius: 0, minHeight: 52, padding: '10px 16px' },
  badge: { borderRadius: 0, padding: '4px 8px', ...type.badge },
  /** Chat fragment, as in the "Scope gets lost in the chat" section. */
  chatFragment: {
    background: colors.surface, border: `1px solid ${colors.borderStrong}`, color: colors.text,
    height: 38, paddingInline: 14, fontSize: 15, tiltDegrees: [-3, 2, -2, 3, -1.5],
  },
  /** Kwagi's speech bubble: light fill, 2px dark outline, hard teal shadow, tail toward his head. */
  speechBubble: {
    background: colors.text, color: colors.onPrimary, border: `2px solid ${colors.onPrimary}`,
    boxShadow: shadows.hardOffset, padding: '16px 22px 22px', fontSize: 19, fontWeight: 500,
  },
  /** App mockup frame: a 280px-wide screen on the surface tone inside a thin outline. */
  phoneFrame: {
    width: 280, padding: 8, background: colors.background, border: `1px solid ${colors.borderStrong}`,
    screenBackground: colors.surface, screenPadding: 12, borderRadius: 0,
  },
  /** Sticky top bar: translucent ground with a background blur, no divider line. */
  topBar: { height: 64, background: 'rgba(11, 18, 20, 0.86)', backdropFilter: 'blur(20px) saturate(180%)' },
} as const;

/** Signature details that make a frame read as OwlSet. */
export const signature = {
  /** Low teal glow from the top-left behind the hero headline. */
  heroGlow: 'radial-gradient(70% 90% at 8% 0%, rgba(44, 110, 120, 0.34), transparent 72%)',
  /** Teal pool behind a centred app mockup. */
  stageGlow: 'radial-gradient(60% 55% at 50% 46%, #1C3E44, #111C1F 78%)',
  /** Frames are a 1px gap showing this gradient; on the site it brightens under the cursor. */
  spotlightFrame: 'radial-gradient(280px circle at var(--mx) var(--my), #86D3C5, #263A3E 72%)',
  /** Fine film grain over everything: an feTurbulence noise layer. */
  grain: { opacity: 0.5, mixBlendMode: 'soft-light', baseFrequency: 0.9, octaves: 2 },
  /** Three full-width colour fields: dark ground, one accent band, one mint closing band. */
  bands: [colors.background, colors.accent, colors.primary],
  /** Oversized mono watermark ("R1") in the accent band, slightly darker than the band. */
  watermark: { fontFamily: fonts.mono, fontWeight: 600, color: '#265F67', letterSpacing: '-0.06em' },
  /** Sections are separated by 1px hairlines, never by boxes or shadows. */
  hairline: `1px solid ${colors.border}`,
  layout: { maxWidth: 1200, gutter: 48, columns: 12, columnGap: 24 },
} as const;

/**
 * Motion. CSS curves are given as control points for Remotion's Easing.bezier(...points).
 * The site's spring is critically damped (no overshoot); in Remotion, spring({ config: springConfig })
 * gives the same no-bounce character. That config is a suggested equivalent, not a measured value.
 */
export const motion = {
  easeOut: [0.23, 1, 0.32, 1], // entering, responding
  easeInOut: [0.77, 0, 0.175, 1], // scripted moves across the screen
  springConfig: { damping: 200 },
  springMs: 480,
  durationsMs: { press: 100, hover: 150, swap: 220, reveal: 560, staggerStep: 70 },
  /** Entrances rise 10 to 14px while fading in. Nothing bounces, including Kwagi. */
  riseDistance: 12,
} as const;

export const theme = { colors, kwagi, fonts, type, radius, shadows, components, signature, motion } as const;
export default theme;
