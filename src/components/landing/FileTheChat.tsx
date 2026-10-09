import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { StatusBadge } from '@/components/ui/StatusBadge';

import { CLAUSES, PROJECT_NAME } from './agreement';

// Where each chat fragment sits before it is filed, as an offset from its row.
// The last ones are pulled upward so nothing reaches the caption line under the rows.
const SCATTER = [
  { x: '214px', y: '-22px', r: '-3deg' },
  { x: '-34px', y: '-8px', r: '2deg' },
  { x: '300px', y: '10px', r: '-2deg' },
  { x: '56px', y: '14px', r: '3deg' },
  { x: '196px', y: '-10px', r: '-1.5deg' },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The problem, shown: the same terms as loose chat messages, then filed as one record.
 * The record is the real content and is always in the page; the chat fragments are decoration.
 */
export function FileTheChat() {
  const root = useRef<HTMLDivElement>(null);
  const [filed, setFiled] = useState(prefersReducedMotion);

  useEffect(() => {
    const node = root.current;
    if (!node || prefersReducedMotion()) return;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setFiled(true), 0);
      return () => clearTimeout(timer);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // A beat to read the scattered messages before they are filed.
        timer = setTimeout(() => setFiled(true), 900);
      },
      { threshold: 0.7 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={root} className="lp-file" data-filed={filed}>
      <div className="lp-file-head">
        <h3 className="lp-h3">{PROJECT_NAME}</h3>
        <StatusBadge variant="confirmed" label="Agreement v1" />
      </div>
      <div className="lp-file-rows">
        <ol aria-label="The recorded agreement">
          {CLAUSES.map((clause, index) => (
            <li key={clause.id} className="lp-file-row" style={{ '--i': index } as CSSProperties}>
              <b>{clause.id}</b>
              <span>{clause.text}</span>
            </li>
          ))}
        </ol>
        {CLAUSES.map((clause, index) => (
          <div
            key={clause.id}
            aria-hidden
            className="lp-bubble"
            data-mine={index === 2 ? '' : undefined}
            style={{ '--i': index, '--x': SCATTER[index].x, '--y': SCATTER[index].y, '--r': SCATTER[index].r } as CSSProperties}
          >
            {clause.said}
          </div>
        ))}
      </div>
      <div className="lp-file-foot">
        <span>{filed ? 'Filed as one agreement, each term with its own ID.' : 'The same terms, as they arrived in chat.'}</span>
        <button type="button" className="lp-link" onClick={() => setFiled((value) => !value)}>
          {filed ? 'Scatter them again' : 'File them'}
        </button>
      </div>
    </div>
  );
}
