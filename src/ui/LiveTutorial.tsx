import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import './LiveTutorial.css';

const steps = [
  { title: 'Live Preview', target: '.stage-area', text: 'This is your main stage. Once the camera is on, your expressions and effects appear here in real time.' },
  { title: 'Live Controls', target: '.interaction-panel', text: 'See your expression status, adjust intensity, preview effects, and manage live settings.' },
  { title: 'Effects Library', target: '.gift-rail', text: 'Choose an effect here. Smile for Rain Aura or laugh for Firework Party.' },
  { title: 'Quick Actions', target: '.stage-controls', text: 'Start or stop the camera, mirror the view, go fullscreen, or reset the preview.' },
] as const;

export const liveTutorialKey = 'face-the-moment.live-tutorial.v1';

export function firstTutorialStep(): number | null {
  try { return localStorage.getItem(liveTutorialKey) === 'seen' ? null : 0; }
  catch { return 0; }
}

type Rect = { x: number; y: number; width: number; height: number; rx: number };

export function LiveTutorial({ step, onStep, onClose }: {
  step: number; onStep: (step: number) => void; onClose: () => void;
}) {
  const maskId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [destination, setDestination] = useState<number | null>(null);
  useEffect(() => {
    if (destination === null) return;
    const timer = window.setTimeout(() => {
      onStep(destination);
      setDestination(null);
    }, 155);
    return () => window.clearTimeout(timer);
  }, [destination, onStep]);

  function navigate(next: number) {
    if (destination !== null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) onStep(next);
    else setDestination(next);
  }

  const [spot, setSpot] = useState<Rect | null>(null);
  const [position, setPosition] = useState<{left: number; top: number} | null>(null);
  const current = steps[step];
  const last = step === steps.length - 1;

  useLayoutEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const target = document.querySelector(current.target);
    const callout = card.current;
    if (!target || !callout) return;

    function measure() {
      if (!target || !callout) return;
      const bounds = target.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const inset = 12;
      const gap = 12;
      const x = Math.max(3, bounds.left - 3);
      const y = Math.max(3, bounds.top - 3);
      const right = Math.min(vw - 3, bounds.right + 3);
      const bottom = Math.min(vh - 3, bounds.bottom + 3);
      // Keep the last valid opening while the mobile drawer slides into view.
      if (right <= x || bottom <= y) return;
      const padding = 12;
      const openingX = Math.max(0, bounds.left - padding);
      const openingY = Math.max(0, bounds.top - padding);
      const openingWidth = Math.min(vw, bounds.right + padding) - openingX;
      const openingHeight = Math.min(vh, bounds.bottom + padding) - openingY;
      const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius);
      setSpot({
        x: openingX, y: openingY, width: openingWidth, height: openingHeight,
        rx: Math.min((radius || 0) + padding, openingWidth / 2, openingHeight / 2),
      });

      const width = callout.offsetWidth;
      const height = callout.offsetHeight;
      const fitX = (left: number) => Math.max(inset, Math.min(left, vw - width - inset));
      const fitY = (top: number) => Math.max(inset, Math.min(top, vh - height - inset));
      const center = (x + right - width) / 2;
      if (step === 0 && right + gap + width <= vw - inset) {
        setPosition({left: right + gap, top: fitY(y + 20)});
      } else if (y - gap - height >= inset && step !== 0) {
        setPosition({left: fitX(center), top: y - gap - height});
      } else if (x - gap - width >= inset) {
        setPosition({left: x - gap - width, top: fitY(y + 20)});
      } else if (bottom + gap + height <= vh - inset) {
        setPosition({left: fitX(center), top: bottom + gap});
      } else {
        setPosition({left: fitX(center), top: fitY(bottom - height - 20)});
      }
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    observer.observe(callout);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    target.addEventListener('transitionend', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      target.removeEventListener('transitionend', measure);
    };
  }, [current.target, step]);

  return <dialog ref={dialog} className={`live-tutorial${destination !== null ? ' is-leaving' : ''}`} aria-labelledby="live-tutorial-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <svg className="live-tutorial-shade" aria-hidden="true" width="100%" height="100%">
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill="white" />
          {spot && <rect className="live-tutorial-window" style={spot} fill="black" />}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="#08070c" fillOpacity=".60" mask={`url(#${maskId})`} />
      {spot && <rect className="live-tutorial-spot live-tutorial-window" style={spot} fill="none" />}
    </svg>
    <section key={step} ref={card} className="live-tutorial-card" style={position ?? undefined}>
      <div className="live-tutorial-meta"><span>Step {step + 1} / {steps.length}</span><button type="button" onClick={onClose}>Skip</button></div>
      <h2 ref={heading} id="live-tutorial-title" tabIndex={-1}>{current.title}</h2>
      <p>{current.text}</p>
      <div className="live-tutorial-actions">
        <button type="button" disabled={step === 0 || destination !== null} onClick={() => navigate(step - 1)}>Back</button>
        <button className="primary-action" type="button" disabled={destination !== null} onClick={last ? onClose : () => navigate(step + 1)}>
          {last ? 'Start Exploring' : 'Next'}
        </button>
      </div>
    </section>
  </dialog>;
}
