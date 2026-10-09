import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Kwagi } from '@/components/kwagi/Kwagi';

// Kwagi introduces himself, one line per click. The facts come from ABOUT_KWAGI.md.
const LINES: { text: string; shown?: ReactNode }[] = [
  { text: 'Hoo, me? I’m Kwagi, OwlSet’s owl. I keep watch over what you and your client agreed.' },
  { text: 'Yes, I’m a night owl. So are you, when your client’s morning starts at your bedtime.' },
  {
    text: 'These big eyes aren’t just for looks. They’re for deliverables, deadlines, and the “one small thing” that quietly grows into a week of work.',
  },
  {
    text: 'My name is kwagi, Filipino for owl, plus wagi, which means “win.” I didn’t pick it. I do like it.',
    shown: (
      <>
        My name is <i lang="tl">kwago</i>, Filipino for owl, plus <i lang="tl">wagi</i>, which means “win.” I didn’t
        pick it. I do like it.
      </>
    ),
  },
  { text: 'A win, to me: a clear agreement, work that is valued, and a client who knows what to expect. No feathers ruffled.' },
  { text: 'One last thing, from one night owl to another: get some rest. The scope will still be here in the morning.' },
];

const HINTS = [
  'Click Kwagi. He’ll tell you about himself.',
  'Click him again for more.',
  'Click him once more to finish.',
  'Click Kwagi to hear it again.',
];

/**
 * Kwagi stands in the middle with a hint under him. The first click sends him gliding to the
 * left and opens his speech bubble; each later click shows his next line. A click after the last
 * line closes the bubble and sends him back to the middle, ready to be played again.
 * He waves twice only: the first time the section is scrolled into view, and when the bubble opens.
 * Wide layouts always reserve the bubble's place, so nothing reflows when it opens.
 */
export function KwagiSays({ size }: { size: number }) {
  // 0 means he has not been clicked yet; otherwise the number of the line being shown.
  const [at, setAt] = useState(0);
  const [played, setPlayed] = useState(false);
  const [waves, setWaves] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  // Keyboard-driven changes are not animated.
  const [instant, setInstant] = useState(false);
  const open = at > 0;

  const last = at === LINES.length;
  const hint = open ? (last ? 2 : 1) : played ? 3 : 0;

  // His hello: once, the first time the section is mostly in view.
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setWaves((count) => count + 1);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const next = (fromKeyboard: boolean) => {
    setInstant(fromKeyboard);
    if (last) {
      setAt(0);
      setPlayed(true);
      return;
    }
    // Keyboard-driven changes are instant, so the opening wave is for pointer clicks only.
    if (!open && !fromKeyboard) setWaves((count) => count + 1);
    setAt(at + 1);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    next(true);
  };

  return (
    <div ref={root} className="lp-says" data-open={open ? '' : undefined} data-instant={instant ? '' : undefined}>
      <div className="lp-says-col">
        <div
          className="lp-says-kwagi"
          role="button"
          tabIndex={0}
          aria-label={last ? 'Kwagi. Close his speech bubble.' : open ? 'Kwagi. Hear his next line.' : 'Kwagi. Hear about him.'}
          onKeyDown={onKeyDown}
        >
          <Kwagi size={size} waveOnMount={false} waveOnPress={false} waveSignal={waves} onPress={() => next(false)} />
        </div>
        <p className="lp-says-hint" aria-hidden onClick={() => next(false)}>
          <i className="lp-says-arrow" />
          {HINTS.map((text, index) => (
            <span key={index} data-on={index === hint ? '' : undefined}>
              {text}
            </span>
          ))}
        </p>
      </div>
      <div className="lp-speech">
        <div className="lp-speech-head lp-mono" aria-hidden>
          <span>Kwagi</span>
          <span>
            {at || LINES.length} / {LINES.length}
          </span>
        </div>
        <div className="lp-speech-lines" aria-hidden>
          {LINES.map((line, index) => (
            <p key={index} data-on={index === at - 1 ? '' : undefined}>
              {line.shown ?? line.text}
            </p>
          ))}
        </div>
        <p className="lp-sr" aria-live="polite">
          {open ? LINES[at - 1].text : ''}
        </p>
      </div>
    </div>
  );
}
