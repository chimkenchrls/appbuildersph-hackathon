import Head from 'expo-router/head';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';

import { Mascot } from '@/components/kwagi/PageMascot';
import { AgreementConcept, ScopeGuardConcept } from '@/components/landing/ConceptScreens';
import { FileTheChat } from '@/components/landing/FileTheChat';
import { KwagiSays } from '@/components/landing/KwagiSays';
import { ScopeDemo } from '@/components/landing/ScopeDemo';
import { StepTabs } from '@/components/landing/StepTabs';
import { LANDING_CSS } from '@/components/landing/styles';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors } from '@/constants/theme';

const DESCRIPTION =
  'Saklaw is an Android app, in development, that helps freelancers turn client conversations into a confirmed scope, compare new requests with it, and prepare change proposals.';

const SECTIONS = [
  { id: 'why', label: 'Why' },
  { id: 'demo', label: 'Demo' },
  { id: 'how', label: 'How it works' },
  { id: 'control', label: 'Your control' },
  { id: 'android', label: 'Android' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const NARROW = '(max-width: 860px)';

function useNarrow() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(NARROW);
      query.addEventListener('change', notify);
      return () => query.removeEventListener('change', notify);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

/**
 * Web landing page, written as plain HTML and CSS because it is web only. It loads no
 * mobile services, and it offers no download link because no release exists yet.
 */
export default function RootScreen() {
  const narrow = useNarrow();
  const scroller = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const nav = useRef<HTMLElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  // True while the last navigation came from the keyboard, which is never animated.
  const keyboardNav = useRef(false);
  const [active, setActive] = useState<SectionId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // The current section is the last one whose top has entered the upper part of the view.
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = [...SECTIONS].reverse().find((section) => visible.has(section.id));
        setActive(current ? current.id : null);
      },
      { root, rootMargin: '-64px 0px -55% 0px' },
    );
    for (const section of SECTIONS) {
      const node = root.querySelector(`#${section.id}`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  // Staged entry and the watermark fill: mark each section the first time it is seen.
  // The hidden starting state is switched on only here, so the page is complete without script.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
    if (typeof IntersectionObserver === 'undefined') {
      for (const section of sections) section.dataset.in = '';
      return;
    }
    root.dataset.js = '';
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.in = '';
          observer.unobserve(entry.target);
        }
      },
      { root, rootMargin: '0px 0px -18% 0px' },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // The bar shows its lower edge only while content is actually underneath it.
  useEffect(() => {
    const root = scroller.current;
    const top = header.current;
    if (!root || !top) return;
    const update = () => {
      if (root.scrollTop > 4) top.dataset.scrolled = '';
      else delete top.dataset.scrolled;
    };
    update();
    root.addEventListener('scroll', update, { passive: true });
    return () => root.removeEventListener('scroll', update);
  }, []);

  // Slide the marker under the current nav link.
  useEffect(() => {
    const bar = mark.current;
    const link = active ? nav.current?.querySelector<HTMLElement>(`[data-id="${active}"]`) : null;
    if (!bar) return;
    if (!link) {
      bar.style.opacity = '0';
      return;
    }
    // Appearing from hidden is a placement, not a move, so it happens without the glide.
    if (bar.style.opacity !== '1') bar.dataset.instant = '';
    else if (!keyboardNav.current) delete bar.dataset.instant;
    bar.style.transform = `translateX(${link.offsetLeft + 16}px) scaleX(${link.offsetWidth - 32})`;
    bar.style.opacity = '1';
    if (!keyboardNav.current) requestAnimationFrame(() => delete bar.dataset.instant);
  }, [active, narrow]);

  const goTo = useCallback((event: MouseEvent, id: SectionId | 'top') => {
    event.preventDefault();
    setMenuOpen(false);
    // Smooth scrolling answers a pointer; keyboard activation and reduced motion jump straight there.
    keyboardNav.current = event.detail === 0;
    if (keyboardNav.current) setTimeout(() => (keyboardNav.current = false), 600);
    const still = keyboardNav.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = still ? 'instant' : 'smooth';
    if (id === 'top') scroller.current?.scrollTo({ top: 0, behavior });
    else scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ block: 'start', behavior });
  }, []);

  const skipToContent = useCallback((event: MouseEvent) => {
    event.preventDefault();
    const main = scroller.current?.querySelector<HTMLElement>('#main');
    main?.focus({ preventScroll: true });
    scroller.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const links = (onlyFirst?: number) =>
    SECTIONS.slice(0, onlyFirst).map((section) => (
      <a
        key={section.id}
        href={`#${section.id}`}
        data-id={section.id}
        aria-current={active === section.id ? 'location' : undefined}
        onClick={(event) => goTo(event, section.id)}
      >
        {section.label}
      </a>
    ));

  return (
    <div ref={scroller} className="lp" data-scroller>
      <Head>
        <title>Saklaw: clear agreements for freelancers</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content={colors.background} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Saklaw: clear agreements for freelancers" />
        <meta property="og:description" content={DESCRIPTION} />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </Head>
      <style>{LANDING_CSS}</style>
      <div className="lp-grain" aria-hidden />
      <a href="#main" className="lp-skip" onClick={skipToContent}>
        Skip to content
      </a>

      <header ref={header} className="lp-bar">
        <div className="lp-wrap lp-bar-row">
          <a href="#top" className="lp-brand" aria-label="Saklaw, back to top" onClick={(event) => goTo(event, 'top')}>
            Saklaw
          </a>
          <nav ref={nav} className="lp-nav" aria-label="Sections">
            {links()}
            <span ref={mark} className="lp-nav-mark" aria-hidden />
          </nav>
          <button type="button" className="lp-menu-btn" aria-expanded={menuOpen} aria-controls="lp-menu" onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        <nav id="lp-menu" className="lp-wrap lp-menu" data-open={menuOpen} aria-label="Sections">
          {links()}
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        <div className="lp-hero-band">
        <section className="lp-wrap lp-hero">
          <div className="lp-hero-copy">
            <h1 className="lp-h1">
              {['Clear agreements.', 'Controlled revisions.', 'Confident freelancing.'].map((sentence, index) => (
                <span key={sentence} className="lp-rise" style={{ '--i': index } as CSSProperties}>
                  {sentence}
                </span>
              ))}
            </h1>
            <p className="lp-lead lp-rise" style={{ '--i': 3 } as CSSProperties}>
              Saklaw turns client conversations into a confirmed scope, checks new requests against it, and helps you
              write change proposals.
            </p>
            <div className="lp-actions lp-rise" style={{ '--i': 4 } as CSSProperties}>
              <a href="#demo" className="lp-btn lp-btn-primary" onClick={(event) => goTo(event, 'demo')}>
                Try the demo
              </a>
              <a href="#how" className="lp-link" onClick={(event) => goTo(event, 'how')}>
                See how it works
              </a>
            </div>
          </div>
          <div className="lp-hero-visual">
            {/* Two concept screens of the app stand behind Kwagi. They fade out toward his feet. */}
            <div className="lp-phones">
              <div className="lp-phone lp-phone-a lp-rise" style={{ '--i': 5 } as CSSProperties}>
                <AgreementConcept />
              </div>
              <div className="lp-phone lp-phone-b lp-rise" style={{ '--i': 6 } as CSSProperties}>
                <ScopeGuardConcept />
              </div>
            </div>
            <div className="lp-kwagi lp-rise" style={{ '--i': 7 } as CSSProperties}>
              <Mascot
                directions="/mascots/kwagi-directions.webp"
                reactions="/mascots/kwagi-reactions.webp"
                size={narrow ? 230 : 290}
                label="owl"
              />
            </div>
            <p className="lp-hero-note">
              This is Kwagi. Move your cursor around him, or click. Behind him are concept mockups with demo data.
            </p>
          </div>
        </section>
        </div>

        <section id="why" className="lp-section">
          <div className="lp-wrap lp-grid">
            <div className="lp-problem-copy lp-stack">
              <h2 className="lp-h2">Scope gets lost in the chat</h2>
              <p className="lp-body">
                Deliverables, deadlines, prices and revision terms end up scattered across messages. When the client
                asks for more, you rebuild the agreement from memory.
              </p>
              <p className="lp-body">Saklaw keeps it in one place, so every new request is read against what was recorded.</p>
            </div>
            <FileTheChat />
          </div>
        </section>

        <section id="demo" className="lp-section lp-alt" data-reveal>
          <div className="lp-wrap">
            <div className="lp-stack">
              <div className="lp-title-row">
                <h2 className="lp-h2">See a request checked</h2>
                <div className="lp-badge">
                  <StatusBadge variant="demo" />
                </div>
              </div>
              <p className="lp-body">
                Pick a request and see how it compares with the agreement. This is a prepared example. No AI runs on
                this page.
              </p>
            </div>
            <ScopeDemo />
          </div>
        </section>

        <section id="how" className="lp-section" data-reveal>
          <div className="lp-wrap lp-stack lp-stack-loose">
            <div className="lp-stack">
              <h2 className="lp-h2">How it works</h2>
              <p className="lp-body">
                Four steps, from the first conversation to a change proposal. The app is still being built, so the
                screens here are concepts.
              </p>
            </div>
            <div className="lp-grid">
              <StepTabs />
            </div>
          </div>
        </section>

        <section id="control" className="lp-section lp-control" data-reveal>
          <span className="lp-control-mark" aria-hidden>
            R1
          </span>
          <div className="lp-wrap">
            <h2 className="lp-statement">You confirm, not the AI.</h2>
            <p className="lp-body lp-statement-body">
              Suggestions are labelled as suggestions. Nothing becomes part of an agreement until you confirm it.
            </p>
            <div className="lp-pair">
              <div className="lp-st">
                <h3 className="lp-h3">Evidence, not verdicts.</h3>
                <p className="lp-body">
                  A finding shows the recorded clause behind it. Something missing from the scope is shown as missing,
                  never as a rule the client broke.
                </p>
              </div>
              <div className="lp-st" style={{ '--i': 1 } as CSSProperties}>
                <h3 className="lp-h3">Your numbers.</h3>
                <p className="lp-body">
                  Saklaw does not suggest prices or deadlines. Fees and extra days are whatever you type.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="android" className="lp-band">
          <div className="lp-wrap lp-close">
            <h2 className="lp-sr">About Kwagi</h2>
            <KwagiSays size={narrow ? 150 : 220} />
            <div className="lp-about-note">
              <h3 className="lp-h3">Android app</h3>
              <p className="lp-body">Saklaw is in development. A download will be listed here when a release is available.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <a href="#top" className="lp-brand lp-brand-sm" onClick={(event) => goTo(event, 'top')}>
            Saklaw
          </a>
          <nav className="lp-footer-links" aria-label="Footer">
            {links(3)}
          </nav>
        </div>
      </footer>
    </div>
  );
}
