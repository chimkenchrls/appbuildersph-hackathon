/**
 * A phone bezel around a real screen from the app. The images in /public/app are produced by
 * scripts/capture-app-screens.mjs from the app's own screens with labelled demo data.
 */
export type AppScreen = 'draft' | 'agreement' | 'scopeguard' | 'proposal';

const SCREENS: Record<AppScreen, string> = {
  draft:
    'The app’s scope review screen: a draft with three editable deliverables, with budget, timeline and revision terms below, and the note that the delivery date is not set.',
  agreement:
    'The app’s project overview screen: Agreement v1 confirmed by the freelancer, client approval not recorded yet, and the included deliverables R1 and R2.',
  scopeguard:
    'The app’s ScopeGuard review screen: three findings for a new client request. Customer accounts is a potential addition, the Menu page on phones is included, and swapping the hero photo needs clarification.',
  proposal:
    'The app’s change proposal screen: customer accounts selected as an additional deliverable, a fee of 7,000 pesos and five extra working days entered by the freelancer, and an editable message to the client.',
};

export const APP_SCREEN_IDS = Object.keys(SCREENS) as AppScreen[];

export function PhoneFrame({ screen, eager = false }: { screen: AppScreen; eager?: boolean }) {
  return (
    <div className="lp-device">
      <img
        src={`/app/${screen}.webp`}
        alt={SCREENS[screen]}
        width={390}
        height={844}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}

/**
 * A cropped window onto one part of an app screen. `top` is where the window starts, as a
 * fraction of the screen's height, and `height` is the window's height in px.
 */
export function ScreenSnip({ screen, top, height, alt }: { screen: AppScreen; top: number; height: number; alt: string }) {
  return (
    <div className="lp-snip" style={{ height }}>
      <img
        src={`/app/${screen}.webp`}
        alt={alt}
        width={390}
        height={844}
        loading="lazy"
        decoding="async"
        draggable={false}
        style={{ marginTop: `${-top * (844 / 390) * 100}%` }}
      />
    </div>
  );
}
