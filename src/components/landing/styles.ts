import { colors } from '@/constants/theme';

/**
 * Styles for the web landing page. The page is plain HTML and CSS (web only), so it can use
 * grid, sticky positioning, :hover and :focus-visible, and media queries directly.
 * Colours come from the app's theme tokens; nothing here defines a new palette.
 *
 * Layers: page content (auto), the top bar (10), grain (20), skip link (30).
 */
export const LANDING_CSS = `
@font-face {
  font-family: 'Geist';
  src: url('/fonts/Geist-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
@font-face {
  font-family: 'Geist Mono';
  src: url('/fonts/GeistMono-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

html, body { background: ${colors.background}; color-scheme: dark; }

.lp {
  --bg: ${colors.background};
  --surface: ${colors.surface};
  --raised: ${colors.surfaceRaised};
  --text: ${colors.textPrimary};
  --text2: ${colors.textSecondary};
  --mint: ${colors.primary};
  --mint-pressed: ${colors.primaryPressed};
  --on-mint: ${colors.onPrimary};
  --line: ${colors.border};
  --line-strong: ${colors.controlBorder};
  --info: ${colors.infoText};
  --info-surface: ${colors.infoSurface};
  --brand: ${colors.brand};
  --on-brand: ${colors.onBrand};
  --sans: 'Geist', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: 'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --max: 1200px;
  --gutter: clamp(20px, 4vw, 48px);
  --bar: 64px;
  /* Strong curves: ease-out for things entering or responding, ease-in-out for scripted explanations. */
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  /* A critically damped spring (no overshoot) for things a click moves: it leaves fast and settles
     softly, and because it is a transition it restarts from wherever the element is on screen. */
  --spring: linear(0, 0.083, 0.246, 0.417, 0.566, 0.686, 0.777, 0.844, 0.893, 0.927, 0.95, 0.967, 0.978, 0.985, 0.99, 0.993, 0.996, 0.997, 0.998, 0.999, 1);
  --spring-t: 480ms;

  flex: 1 1 0%;
  min-height: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 1rem;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  scrollbar-color: var(--line-strong) var(--bg);
}
/* Resets use :where() so they never outrank a component class. */
:where(.lp) *, :where(.lp) *::before, :where(.lp) *::after { box-sizing: border-box; }
.lp ::selection { background: var(--mint); color: var(--on-mint); }
:where(.lp) :where(h1, h2, h3, p, ul, ol) { margin: 0; padding: 0; }
:where(.lp) :where(ul, ol) { list-style: none; }
:where(.lp) a { color: inherit; text-decoration: none; }
:where(.lp) button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.lp :focus-visible { outline: 2px solid var(--mint); outline-offset: 3px; }

.lp-wrap { width: 100%; max-width: calc(var(--max) + 2 * var(--gutter)); margin-inline: auto; padding-inline: var(--gutter); }
.lp-mono { font-family: var(--mono); font-feature-settings: 'tnum'; }
.lp-stack-tight { gap: 8px; }
.lp-stack-snug { gap: 12px; }
.lp-stack-loose { gap: 48px; }
/* First stop for keyboard users: hidden until focused. */
.lp-skip {
  position: absolute; z-index: 30; left: var(--gutter); top: 10px; padding: 10px 14px;
  background: var(--mint); color: var(--on-mint); font-weight: 600; transform: translateY(-200%);
}
.lp-skip:focus-visible { transform: none; outline-color: var(--text); }
/* Fine grain over everything, so large flat fields do not read as sterile. Fixed, and never interactive. */
.lp-grain {
  position: fixed; inset: 0; z-index: 20; pointer-events: none; opacity: 0.5; mix-blend-mode: soft-light;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.lp-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---------- Top bar ---------- */
/* A translucent layer the page scrolls under. It has no divider line: once content is beneath it,
   a short fade below the bar marks the edge. */
.lp-bar {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%);
  transition: background-color 200ms ease;
}
/* With the menu open the bar is a larger surface carrying text, so it reads as thicker. */
.lp-bar:has(.lp-menu[data-open='true']) { background: color-mix(in srgb, var(--bg) 97%, transparent); }
.lp-bar::after {
  content: ''; position: absolute; inset: 100% 0 auto 0; height: 20px; pointer-events: none;
  background: linear-gradient(color-mix(in srgb, var(--bg) 60%, transparent), transparent);
  opacity: 0; transition: opacity 200ms ease;
}
.lp-bar[data-scrolled]::after { opacity: 1; }
.lp-bar-row { display: flex; align-items: stretch; justify-content: space-between; height: var(--bar); }
.lp-brand { display: flex; align-items: center; gap: 8px; font-size: 1.375rem; font-weight: 600; letter-spacing: -0.03em; color: var(--mint); }
.lp-brand-logo { display: block; width: 48px; height: 32px; object-fit: contain; flex-shrink: 0; }
.lp-brand-sm { font-size: 1.125rem; }
.lp-nav { position: relative; display: flex; align-items: stretch; }
.lp-nav a {
  display: flex; align-items: center; padding-inline: 16px;
  font-size: 0.9375rem; font-weight: 500; color: var(--text2);
  transition: color 150ms ease, opacity 100ms ease-out;
}
.lp-nav a[aria-current] { color: var(--text); }
.lp-nav-mark {
  position: absolute; left: 0; bottom: 0; width: 1px; height: 2px; background: var(--mint);
  transform-origin: left center; opacity: 0;
  transition: transform var(--spring-t) var(--spring), opacity 150ms ease;
}
/* First placement and keyboard moves are instant: the marker never grows from nothing. */
.lp-nav-mark[data-instant] { transition-duration: 0ms; }
.lp-menu-btn { display: none; align-self: center; height: 44px; padding-inline: 16px; border: 1px solid var(--line-strong); font-size: 0.9375rem; font-weight: 500; }
.lp-menu-btn { transition: transform 160ms var(--ease-out), background-color 150ms ease; }
.lp-menu { display: none; }

/* ---------- Buttons ---------- */
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding-inline: 22px; white-space: nowrap;
  font-size: 1rem; font-weight: 500; letter-spacing: -0.01em;
  border: 1px solid transparent;
  transition: background-color 150ms ease, border-color 150ms ease, transform 160ms var(--ease-out);
}
/* Feedback lands on the press itself, faster than the release. */
.lp-btn:active, .lp-menu-btn:active { transform: scale(0.97); transition-duration: 100ms; }
.lp-nav a:active, .lp-menu a:active, .lp-link:active, .lp-brand:active, .lp-footer-links a:active { opacity: 0.6; }
.lp-btn-primary { background: var(--mint); color: var(--on-mint); }
.lp-btn-quiet { border-color: var(--line-strong); color: var(--text); }
.lp-link { color: var(--mint); font-weight: 500; border-bottom: 1px solid var(--line-strong); padding-bottom: 2px; transition: border-color 150ms ease, opacity 100ms ease-out; }

/* ---------- Hero ---------- */
/* A low teal glow behind the headline gives the dark ground some depth without a second colour. */
.lp-hero-band { background: radial-gradient(70% 90% at 8% 0%, color-mix(in srgb, var(--brand) 34%, transparent), transparent 72%); }
/* Two parts only: one grouped text column, and one tall mint field that carries Kwagi. */
.lp-hero {
  display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; align-items: stretch;
  min-height: min(calc(100dvh - var(--bar)), 800px);
  padding-block: clamp(32px, 5vw, 64px);
}
.lp-hero-copy { grid-column: 1 / span 7; display: grid; gap: clamp(24px, 2.6vw, 36px); align-content: center; }
.lp-h1 { font-size: clamp(2.25rem, 4.2vw, 3.625rem); line-height: 1.04; font-weight: 560; letter-spacing: -0.036em; }
.lp-h1 span { display: block; }
.lp-lead { font-size: 1.1875rem; line-height: 1.5; color: var(--text2); max-width: 27em; }
.lp-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; }
.lp-actions .lp-link { display: inline-flex; align-items: center; min-height: 48px; padding-bottom: 0; border-bottom: 0; text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 6px; transition: text-decoration-color 150ms ease, opacity 100ms ease-out; }
/* No field behind the mascot: two concept screens of the app stand behind him on the page's own ground. */
.lp-hero-visual { grid-column: 8 / -1; position: relative; align-self: center; height: clamp(480px, 44vw, 590px); }
/* The screens dissolve toward the bottom so Kwagi reads as standing in front of them. */
.lp-phones { position: absolute; inset: 0 0 44px 0; overflow: hidden; mask-image: linear-gradient(#000 52%, transparent 94%); -webkit-mask-image: linear-gradient(#000 52%, transparent 94%); }
.lp-phone { position: absolute; top: 0; zoom: 0.82; }
.lp-phone-a { left: 0; }
.lp-phone-b { right: 0; top: 64px; }
.lp-kwagi { position: absolute; left: 50%; bottom: 36px; translate: -50% 0; }
.lp-hero-note { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 0.8125rem; line-height: 1.4; letter-spacing: 0.01em; color: var(--text2); }

/* One load sequence: headline, then copy, then the panel. */
@keyframes lp-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes lp-fade { from { opacity: 0; } to { opacity: 1; } }
.lp-rise { animation: lp-rise 560ms var(--ease-out) both; animation-delay: calc(var(--i, 0) * 70ms); }

/* ---------- Sections ---------- */
.lp-section { padding-block: clamp(72px, 8.5vw, 124px) clamp(84px, 10vw, 144px); border-top: 1px solid var(--line); scroll-margin-top: calc(var(--bar) - 1px); }
/* Staged entry: blocks marked lp-st arrive in order the first time their section is seen.
   The hidden state only applies once the page script has confirmed it can reveal them. */
.lp-st { transition: opacity 520ms ease, transform 640ms var(--ease-out); transition-delay: calc(var(--i, 0) * 90ms); }
.lp[data-js] [data-reveal]:not([data-in]) .lp-st { opacity: 0; transform: translateY(14px); }
/* Alternate sections sit on the next surface tone, so the page has rhythm beyond hairlines. */
.lp-alt { background: var(--surface); }
.lp-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; row-gap: 48px; align-items: center; }
.lp-h2 { font-size: clamp(1.75rem, 3.1vw, 2.625rem); line-height: 1.1; font-weight: 560; letter-spacing: -0.03em; text-wrap: balance; }
.lp-h3 { font-size: 1.1875rem; line-height: 1.3; font-weight: 600; letter-spacing: -0.015em; }
.lp-body { font-size: 1.0625rem; line-height: 1.6; color: var(--text2); max-width: 34em; text-wrap: pretty; }
.lp-stack { display: grid; gap: 20px; align-content: start; }
.lp-title-row { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; }
/* Keeps an app badge at its own width inside a grid, which would otherwise stretch it. */
.lp-badge { display: flex; }

/* ---------- Problem: scattered chat becomes a record ---------- */
.lp-problem-copy { grid-column: 1 / span 5; }
.lp-file { grid-column: 7 / -1; position: relative; --k: 1; }
.lp-file-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; height: 44px; transition: opacity 300ms ease; }
.lp-file-rows { position: relative; }
.lp-file-row {
  display: flex; align-items: center; gap: 16px; height: 56px; border-top: 1px solid var(--line);
  transition: opacity 280ms ease, transform 420ms var(--ease-out);
  transition-delay: calc(var(--i) * 60ms + 220ms);
}
.lp-file-row b { font-family: var(--mono); font-weight: 500; font-size: 0.875rem; color: var(--mint); width: 24px; }
.lp-file-row span { font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lp-bubble {
  position: absolute; left: 40px; top: calc(var(--i) * 56px + 9px);
  height: 38px; line-height: 36px; padding-inline: 14px; white-space: nowrap;
  background: var(--surface); border: 1px solid var(--line-strong); font-size: 0.9375rem; color: var(--text);
  /* Filing is the explanation, so it may run longer than UI motion; the fade trails the move. */
  transition: transform 560ms var(--ease-in-out), opacity 200ms ease 360ms;
  transition-delay: calc(var(--i) * 60ms), calc(var(--i) * 60ms + 360ms);
  opacity: 0; transform: none; pointer-events: none;
}
.lp-bubble[data-mine] { border-color: var(--mint); }
.lp-file[data-filed='false'] .lp-file-head { opacity: 0; }
.lp-file[data-filed='false'] .lp-file-row { opacity: 0; transform: translateX(-10px); transition-delay: 0ms; }
.lp-file[data-filed='false'] .lp-bubble {
  opacity: 1;
  transform: translate(calc(var(--x) * var(--k)), calc(var(--y) * var(--k))) rotate(var(--r));
  /* Scattering back is the quicker direction. */
  transition: transform 380ms var(--ease-in-out), opacity 160ms ease;
  transition-delay: calc(var(--i) * 30ms);
}
.lp-file-foot { margin-top: 20px; display: flex; align-items: center; gap: 16px; font-size: 0.875rem; color: var(--text2); border-top: 1px solid var(--line); padding-top: 16px; min-height: 48px; }

/* ---------- Demo ---------- */
/* The frame and the divider are one 1px gap showing a gradient, which brightens under the cursor. */
.lp-demo {
  margin-top: 48px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1px; padding: 1px;
  background: radial-gradient(280px circle at var(--mx, -400px) var(--my, -400px), var(--mint), var(--line) 72%);
}
.lp-demo > div { padding: clamp(20px, 3vw, 40px); display: grid; gap: 12px; align-content: start; background: var(--bg); }
.lp-demo-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 8px; }
.lp-clause {
  display: flex; align-items: baseline; gap: 14px; padding: 14px 16px; border: 1px solid var(--line);
  transition: opacity 200ms ease, border-color 200ms ease, background-color 200ms ease;
}
.lp-clause b { font-family: var(--mono); font-weight: 500; font-size: 0.875rem; color: var(--text2); transition: color 200ms ease; }
.lp-clause span { flex: 1; min-width: 0; }
.lp-clause i { font-family: var(--mono); font-style: normal; font-size: 0.75rem; color: var(--mint); opacity: 0; transition: opacity 200ms ease; }
.lp-clause[data-cited='true'] { border-color: var(--mint); background: var(--raised); }
.lp-clause[data-cited='true'] b { color: var(--mint); }
.lp-clause[data-cited='true'] i { opacity: 1; }
.lp-clause[data-cited='false'] { opacity: 0.45; }
.lp-label { font-size: 0.875rem; font-weight: 500; letter-spacing: 0.005em; color: var(--text2); }
.lp-option {
  display: flex; align-items: center; gap: 14px; width: 100%; min-height: 52px; padding: 10px 16px; text-align: left;
  border: 1px solid var(--line-strong);
  transition: border-color 150ms ease, background-color 150ms ease, transform 160ms var(--ease-out);
}
.lp-option:active { transform: scale(0.985); transition-duration: 100ms; }
.lp-option[aria-checked='true'] { border-color: var(--mint); background: var(--raised); }
.lp-option em { flex: none; width: 14px; height: 14px; border: 2px solid var(--line-strong); transition: background-color 150ms ease, border-color 150ms ease; }
.lp-option[aria-checked='true'] em { background: var(--mint); border-color: var(--mint); }
.lp-result { display: grid; gap: 12px; margin-top: 12px; padding-top: 20px; border-top: 1px solid var(--line); }
/* New content settles in with a transition, not a keyframe, so quick repeated picks never restart from zero.
   A little blur hides the moment where old and new would otherwise read as two objects. */
.lp-swap { transition: opacity 220ms var(--ease-out), transform 220ms var(--ease-out), filter 220ms var(--ease-out); }
@starting-style { .lp-swap { opacity: 0; transform: translateY(6px); filter: blur(3px); } }
/* Keyboard-driven changes are instant. */
[data-instant] .lp-swap, .lp-swap[data-instant] { transition-duration: 0ms; }
.lp-question { padding: 12px 14px; background: var(--info-surface); color: var(--info); font-size: 0.9375rem; }
.lp-fine { font-size: 0.875rem; letter-spacing: 0.005em; color: var(--text2); }

/* ---------- How it works ---------- */
.lp-steps { grid-column: 1 / span 5; align-self: start; display: grid; gap: 28px; align-content: start; }
.lp-step-list { position: relative; --row: 68px; border-bottom: 1px solid var(--line); }
.lp-step-hl {
  position: absolute; z-index: 0; inset: 0 0 auto 0; height: var(--row); background: var(--raised);
  transform: translateY(calc(var(--at) * var(--row)));
  transition: transform var(--spring-t) var(--spring);
}
.lp-step-list[data-instant] .lp-step-hl { transition-duration: 0ms; }
.lp-step { position: relative; height: var(--row); border-top: 1px solid var(--line); }
.lp-step button { display: flex; align-items: center; gap: 18px; width: 100%; height: 100%; padding-inline: 20px; text-align: left; transition: transform 160ms var(--ease-out); }
.lp-step button:active { transform: scale(0.985); transition-duration: 100ms; }
.lp-step button b { font-family: var(--mono); font-weight: 500; font-size: 0.9375rem; color: var(--text2); transition: color 200ms ease; }
.lp-step button span { font-size: 1.1875rem; font-weight: 500; letter-spacing: -0.015em; color: var(--text2); transition: color 200ms ease; }
.lp-step[data-open='true'] button span { color: var(--text); }
.lp-step[data-open='true'] button b { color: var(--mint); }
.lp-step-desc { min-height: 7.2em; padding-inline: 20px; }
.lp-stage {
  grid-column: 7 / -1; align-self: stretch; display: grid; justify-items: center; align-content: center; gap: 20px;
  min-height: 560px;
}
.lp-stage-phone { display: grid; }
.lp-stage-slide { grid-area: 1 / 1; justify-self: center; opacity: 0; visibility: hidden; transition: opacity 200ms ease, visibility 0s linear 200ms; }
.lp-stage-slide[data-active='true'] { opacity: 1; visibility: visible; transition: opacity 220ms var(--ease-out); }
.lp-stage-phone[data-instant] .lp-stage-slide { transition-duration: 0ms; }
/* The bezel is the only chrome: a dark rim and rounded corners, with the screen's own pixels inside. */
.lp-device { width: 250px; max-width: 100%; padding: 8px; border-radius: 38px; background: #05090A; border: 1px solid var(--line-strong); box-shadow: 0 24px 48px -24px rgba(0, 0, 0, 0.6); }
.lp-device img { display: block; width: 100%; height: auto; border-radius: 30px; user-select: none; -webkit-user-drag: none; }
.lp-phone .lp-device { width: 280px; }

/* ---------- Your control ---------- */
/* The one deep-teal field on the page: the mascot's own colour, under the page's strongest statement. */
.lp-control { position: relative; overflow: hidden; background: var(--brand); color: var(--on-brand); border-top: 0; }
.lp-control .lp-body { color: color-mix(in srgb, var(--on-brand) 92%, transparent); }
.lp-control :focus-visible { outline-color: var(--on-brand); }
.lp-control { --pb: clamp(84px, 10vw, 144px); }
.lp-control .lp-wrap { position: relative; }
/* Statements on the left; on the right a phone that rises out of the bottom of the band. */
.lp-control-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: 24px; row-gap: 48px; }
.lp-control-main { grid-column: 1 / span 7; }
.lp-control-phone { grid-column: 9 / -1; align-self: end; display: flex; justify-content: center; height: 460px; overflow: hidden; margin-bottom: calc(-1 * var(--pb)); }
.lp-control-phone .lp-device { width: 300px; align-self: flex-start; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.lp-control-phone .lp-device img { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
/* A cropped window onto part of an app screen. */
.lp-snip { overflow: hidden; border-radius: 12px; background: #fff; border: 1px solid color-mix(in srgb, var(--on-brand) 30%, transparent); }
.lp-snip img { display: block; width: 100%; height: auto; max-width: none; user-select: none; -webkit-user-drag: none; }
.lp-statement { font-size: clamp(2.125rem, 5vw, 4.25rem); line-height: 1.02; font-weight: 560; letter-spacing: -0.038em; max-width: 14em; text-wrap: balance; }
.lp-statement-body { margin-top: 20px; }
.lp-pair { margin-top: clamp(40px, 5vw, 72px); display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 24px; row-gap: 40px; }
.lp-pair > div { display: grid; gap: 10px; align-content: start; }

/* ---------- Closing and footer ---------- */
/* The mint field returns once, so the page opens and closes on the brand colour. */
.lp-band { background: var(--mint); color: var(--on-mint); scroll-margin-top: calc(var(--bar) - 1px); }
.lp-close { display: grid; justify-items: center; gap: 48px; padding-block: clamp(64px, 8vw, 112px); }
/* Kwagi and what he says. The layout is the open state: Kwagi on the left, his speech bubble on
   the right. Until he is clicked the bubble is hidden and he is shifted to the middle, so opening
   is one transform and nothing reflows. */
.lp-says { --bw: 27rem; --gap: 34px; display: flex; align-items: flex-start; justify-content: center; gap: var(--gap); width: 100%; }
.lp-says-col {
  flex: none; display: grid; justify-items: center; gap: 14px;
  transform: translateX(calc((var(--bw) + var(--gap)) / 2));
  transition: transform var(--spring-t) var(--spring);
}
.lp-says[data-open] .lp-says-col { transform: none; }
.lp-says-kwagi { cursor: pointer; }
.lp-says-hint { display: grid; justify-items: center; gap: 6px; font-size: 0.9375rem; font-weight: 500; cursor: pointer; }
.lp-says-hint span { grid-area: 2 / 1; opacity: 0; transition: opacity 160ms ease; }
.lp-says-hint span[data-on] { opacity: 1; transition: opacity 200ms ease 140ms; }
/* A small arrow pointing up at him, nudging until the first click. */
.lp-says-arrow {
  grid-area: 1 / 1; width: 10px; height: 10px; margin-top: 4px;
  border-left: 2px solid currentColor; border-top: 2px solid currentColor; rotate: 45deg;
  animation: lp-nudge 1400ms var(--ease-in-out) infinite alternate;
  transition: opacity 160ms ease;
}
.lp-says[data-open] .lp-says-arrow { opacity: 0; animation: none; }
@keyframes lp-nudge { from { translate: 0 0; } to { translate: 0 -4px; } }

/* The speech bubble: light like his face, outlined like his drawing, with a tail toward his head. */
.lp-speech {
  position: relative; flex: none; width: var(--bw); margin-top: 26px; padding: 16px 22px 22px;
  display: grid; gap: 12px;
  background: var(--text); color: var(--on-mint); border: 2px solid var(--on-mint);
  box-shadow: 5px 5px 0 var(--brand);
  /* It grows out of its tail, a beat after he starts moving. */
  transform-origin: 0 42px;
  opacity: 0; visibility: hidden; transform: scale(0.96);
  transition: opacity 140ms ease, transform 140ms ease, visibility 0s linear 140ms;
}
.lp-says[data-open] .lp-speech {
  opacity: 1; visibility: visible; transform: none;
  transition: opacity 240ms var(--ease-out) 200ms, transform 240ms var(--ease-out) 200ms, visibility 0s linear 200ms;
}
.lp-speech::before {
  content: ''; position: absolute; left: -11px; top: 32px; width: 18px; height: 18px;
  background: var(--text); border-left: 2px solid var(--on-mint); border-bottom: 2px solid var(--on-mint); rotate: 45deg;
}
.lp-speech-head { display: flex; justify-content: space-between; gap: 12px; font-size: 0.8125rem; letter-spacing: 0.01em; color: color-mix(in srgb, var(--on-mint) 70%, transparent); }
.lp-speech-head span:first-child { font-weight: 600; color: var(--brand); }
/* Every line occupies the same cell, so the bubble is always as tall as the longest one. */
.lp-speech-lines { display: grid; }
.lp-speech-lines p {
  grid-area: 1 / 1; font-size: 1.1875rem; line-height: 1.45; font-weight: 500; letter-spacing: -0.012em; text-wrap: pretty;
  opacity: 0; visibility: hidden; transform: translateY(6px); filter: blur(3px);
  /* Leaving: a quick fade in place. The resting offset is restored only once it is invisible. */
  transition: opacity 120ms ease, visibility 0s linear 120ms, transform 0s linear 120ms, filter 0s linear 120ms;
}
/* Arriving: settles upward into place just after the old line has gone. Transitions, not keyframes,
   so quick repeated clicks carry on from wherever the text is. */
.lp-speech-lines p[data-on] {
  opacity: 1; visibility: visible; transform: none; filter: none;
  transition: opacity 220ms var(--ease-out) 90ms, transform 220ms var(--ease-out) 90ms, filter 220ms var(--ease-out) 90ms, visibility 0s;
}
.lp-says[data-instant] :is(.lp-says-col, .lp-speech, .lp-speech-lines p, .lp-says-hint span) { transition-duration: 0ms; transition-delay: 0ms; }
/* The release note sits under Kwagi, set apart by a rule. */
.lp-about-note { display: grid; gap: 6px; width: min(100%, 44rem); padding-top: 20px; border-top: 1px solid color-mix(in srgb, var(--on-mint) 30%, transparent); }
.lp-about-note .lp-body { max-width: none; }
.lp-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-block: 12px 8px; }
.lp-facts > div { display: grid; gap: 4px; align-content: start; }
.lp-fact-title { margin: 0; font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.01em; }
.lp-band .lp-body { color: color-mix(in srgb, var(--on-mint) 82%, transparent); }
/* Links on the mint field use the dark ink; the usual mint link colour would vanish here. */
.lp-band .lp-link { color: var(--on-mint); font-weight: 600; border-bottom-color: var(--on-mint); white-space: nowrap; }
/* On mint, the focus ring switches to the dark ink so it stays visible. */
.lp-band :focus-visible { outline-color: var(--on-mint); }
.lp-footer { border-top: 1px solid var(--line); }
.lp-footer-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; }
.lp-footer-links { display: flex; flex-wrap: wrap; gap: 8px 28px; font-size: 0.875rem; color: var(--text2); }
.lp-footer-links a { padding-block: 8px; transition: color 150ms ease, opacity 100ms ease-out; }

/* ---------- Narrow screens: one column ---------- */
@media (max-width: 860px) {
  .lp-nav { display: none; }
  .lp-menu-btn { display: inline-flex; align-items: center; }
  /* The menu arrives from under the bar and leaves the same way. */
  .lp-menu {
    padding-bottom: 12px; opacity: 0; transform: translateY(-8px);
    transition: opacity 180ms ease, transform 220ms var(--ease-out), display 220ms allow-discrete;
  }
  .lp-menu[data-open='true'] { display: grid; opacity: 1; transform: none; }
  @starting-style { .lp-menu[data-open='true'] { opacity: 0; transform: translateY(-8px); } }
  .lp-menu a { padding: 12px 0; font-size: 1.0625rem; font-weight: 500; border-top: 1px solid var(--line); transition: opacity 100ms ease-out; }
  .lp-h1 span { white-space: normal; display: block; margin-right: 0; }
  .lp-hero { min-height: 0; }
  .lp-hero { row-gap: 40px; padding-bottom: 0; }
  .lp-hero-copy, .lp-problem-copy, .lp-file, .lp-steps, .lp-stage { grid-column: 1 / -1; }
  .lp-hero-visual { grid-column: 1 / -1; height: 420px; margin-bottom: 32px; }
  .lp-phone { zoom: 0.7; }
  .lp-file { --k: 0.24; }
  .lp-bubble { left: 4px; max-width: calc(100% - 64px); font-size: 0.875rem; }
  .lp-bubble, .lp-file-row span { overflow: hidden; text-overflow: ellipsis; }
  .lp-demo { grid-template-columns: minmax(0, 1fr); }
  .lp-stage { min-height: 0; }
  .lp-step-desc { min-height: 0; }
  .lp-control-main, .lp-control-phone { grid-column: 1 / -1; }
  .lp-control-phone { height: 380px; }
  .lp-pair, .lp-facts { grid-template-columns: minmax(0, 1fr); }
  /* No room to glide: he stays centred, the bubble opens under him, and the hint moves below it. */
  .lp-says { flex-direction: column; align-items: center; gap: 22px; }
  .lp-says-col { display: contents; }
  .lp-says-kwagi { order: 1; }
  .lp-speech { order: 2; display: none; width: 100%; margin-top: 0; transform-origin: 50% 0; transition: opacity 140ms ease, transform 140ms ease, visibility 0s linear 140ms, display 140ms allow-discrete; }
  .lp-says[data-open] .lp-speech { display: grid; transition-delay: 0ms; }
  @starting-style { .lp-says[data-open] .lp-speech { opacity: 0; transform: scale(0.96); } }
  .lp-speech::before { left: calc(50% - 9px); top: -11px; border: 0; border-left: 2px solid var(--on-mint); border-top: 2px solid var(--on-mint); }
  .lp-says-hint { order: 3; }
}

/* Hover styles only where there is a real pointer; touch screens would otherwise stick on tap. */
@media (hover: hover) and (pointer: fine) {
  .lp-nav a:hover, .lp-footer-links a:hover { color: var(--text); }
  .lp-btn-primary:hover { background: var(--mint-pressed); }
  .lp-btn-quiet:hover { border-color: var(--text); background: var(--raised); }
  .lp-link:hover { border-color: var(--mint); }
  .lp-actions .lp-link:hover { text-decoration-color: var(--mint); }
  .lp-option:hover { background: var(--raised); }
  .lp-step button:hover span { color: var(--text); }
}

/* Reduced motion: keep fades and colour changes that aid understanding, drop movement. */
@media (prefers-reduced-motion: reduce) {
  .lp-rise { animation: lp-fade 200ms ease both; animation-delay: 0ms; }
  .lp-btn, .lp-menu-btn, .lp-option, .lp-step button { transition-property: background-color, border-color; }
  .lp-btn:active, .lp-menu-btn:active, .lp-option:active, .lp-step button:active { transform: none; }
  .lp-menu, .lp-menu[data-open='true'] { transform: none; }
  @starting-style { .lp-menu[data-open='true'] { transform: none; } }
  .lp-nav-mark, .lp-step-hl { transition-duration: 0ms; }
  .lp-bubble { display: none; }
  .lp-file-row { transition: none; }
  .lp-swap { transition: opacity 200ms ease; }
  @starting-style { .lp-swap { transform: none; filter: none; } }
  .lp-st { transition: none; }
  .lp[data-js] [data-reveal]:not([data-in]) .lp-st { opacity: 1; transform: none; }
  .lp-skip { transition: none; }
  .lp-says-col { transition: none; }
  .lp-says-arrow { animation: none; }
  .lp-speech, .lp-says[data-open] .lp-speech { transform: none; transition: opacity 200ms ease, visibility 0s; }
  @starting-style { .lp-says[data-open] .lp-speech { transform: none; } }
  .lp-speech-lines p, .lp-speech-lines p[data-on] { transform: none; filter: none; transition: opacity 200ms ease, visibility 0s; }
}

/* Readers who ask for less transparency or more contrast get a solid bar with a real edge. */
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .lp-bar { background: var(--bg); -webkit-backdrop-filter: none; backdrop-filter: none; border-bottom: 1px solid var(--line-strong); }
  .lp-bar::after { display: none; }
  .lp-phones { mask-image: none; -webkit-mask-image: none; }
}
`;
