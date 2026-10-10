import { useState, type CSSProperties, type MouseEvent } from 'react';

import { PhoneFrame, type AppScreen } from './PhoneFrame';

const STEPS: { title: string; body: string; screen: AppScreen }[] = [
  {
    title: 'Paste the conversation',
    body: 'Paste the client messages you choose. OwlSet drafts the deliverables, budget, timeline and revision terms, and lists what was never settled. Every field stays editable.',
    screen: 'draft',
  },
  {
    title: 'Confirm Agreement v1',
    body: 'When the draft matches what was agreed, confirm it. That saves a fixed snapshot with an ID for each requirement. It records your review, not the client’s approval.',
    screen: 'agreement',
  },
  {
    title: 'Check a new request',
    body: 'Enter what the client is asking for. Each item gets its own finding, and every finding points to the requirement it relies on.',
    screen: 'scopeguard',
  },
  {
    title: 'Draft the change proposal',
    body: 'Choose what to propose and enter your own fee and extra days. OwlSet helps word the message. You edit, save and copy it. Nothing is sent for you.',
    screen: 'proposal',
  },
];

/**
 * The four workflow steps. Choosing one slides the highlight to it and swaps the
 * description and app screen. Rows keep a fixed height, so nothing reflows.
 */
export function StepTabs() {
  const [selected, setSelected] = useState(1);
  // A click with no pointer detail came from the keyboard; those changes are not animated.
  const [instant, setInstant] = useState(false);

  const choose = (event: MouseEvent, index: number) => {
    setInstant(event.detail === 0);
    setSelected(index);
  };

  return (
    <>
      <div className="lp-steps lp-st">
        <ol className="lp-step-list" data-instant={instant ? '' : undefined} style={{ '--at': selected } as CSSProperties}>
          <li className="lp-step-hl" aria-hidden />
          {STEPS.map((step, index) => (
            <li key={step.title} className="lp-step" data-open={index === selected}>
              <button type="button" aria-pressed={index === selected} aria-controls="lp-step-detail" onClick={(event) => choose(event, index)}>
                <b aria-hidden>{index + 1}</b>
                <span>{step.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div id="lp-step-detail" aria-live="polite" className="lp-step-desc">
          <p key={selected} className="lp-swap lp-body" data-instant={instant ? '' : undefined}>
            {STEPS[selected].body}
          </p>
        </div>
      </div>

      <div className="lp-stage lp-st" style={{ '--i': 1 } as CSSProperties}>
        {/* All four screens are in the page from the start and stacked in one cell, so choosing a
            step only changes which one is visible. Nothing is fetched or remounted on a click. */}
        <div className="lp-stage-phone" data-instant={instant ? '' : undefined}>
          {STEPS.map((step, index) => (
            <div key={step.screen} className="lp-stage-slide" data-active={index === selected} aria-hidden={index !== selected}>
              <PhoneFrame screen={step.screen} eager />
            </div>
          ))}
        </div>
        <p className="lp-fine">Screen from the app, with demo data</p>
      </div>
    </>
  );
}
