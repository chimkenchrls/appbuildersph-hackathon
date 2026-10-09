import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

import { StatusBadge } from '@/components/ui/StatusBadge';

import { CLAUSES, PROJECT_NAME, REQUESTS } from './agreement';

/**
 * A prepared example of checking a request against a confirmed agreement.
 * Nothing here runs AI: every result is written by hand, and the page says so.
 */
export function ScopeDemo() {
  const [selected, setSelected] = useState(0);
  // Arrow-key changes are not animated; pointer picks are.
  const [instant, setInstant] = useState(false);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const request = REQUESTS[selected];

  const onKeyDown = (event: KeyboardEvent) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (selected + step + REQUESTS.length) % REQUESTS.length;
    setInstant(true);
    setSelected(next);
    options.current[next]?.focus();
  };

  // The frame brightens under a real pointer. Set straight on the element: no re-render per move.
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty('--my', `${event.clientY - box.top}px`);
  };
  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty('--mx');
    event.currentTarget.style.removeProperty('--my');
  };

  return (
    <div className="lp-demo" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
      <div className="lp-st">
        <div className="lp-demo-head">
          <h3 className="lp-h3">{PROJECT_NAME}</h3>
          <StatusBadge variant="confirmed" label="Agreement v1" />
        </div>
        {CLAUSES.map((clause) => (
          <div key={clause.id} className="lp-clause" data-cited={request.cites.some((id) => id === clause.id)}>
            <b>{clause.id}</b>
            <span>{clause.text}</span>
            <i aria-hidden>cited</i>
          </div>
        ))}
      </div>

      <div className="lp-st" style={{ '--i': 1 } as CSSProperties}>
        <p className="lp-label" id="lp-demo-label">
          Pick a request from the client
        </p>
        <div role="radiogroup" aria-labelledby="lp-demo-label" className="lp-stack lp-stack-tight" onKeyDown={onKeyDown}>
          {REQUESTS.map((item, index) => (
            <button
              key={item.ask}
              ref={(node) => {
                options.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={index === selected}
              tabIndex={index === selected ? 0 : -1}
              className="lp-option"
              onClick={(event) => {
                setInstant(event.detail === 0);
                setSelected(index);
              }}
            >
              <em aria-hidden />
              <span>{item.ask}</span>
            </button>
          ))}
        </div>

        <div aria-live="polite" className="lp-result">
          <div key={selected} className="lp-swap lp-stack lp-stack-snug" data-instant={instant ? '' : undefined}>
            <div className="lp-badge">
              <StatusBadge variant={request.kind} />
            </div>
            <p>{request.why}</p>
            {request.question ? <p className="lp-question">{request.question}</p> : null}
            <p className="lp-fine">Relies on {request.cites.join(' and ')}, marked in the agreement.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
