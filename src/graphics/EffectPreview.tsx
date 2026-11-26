import { useEffect, useRef } from 'react';
import type P5 from 'p5';
import { RainParty, rainSpawnBounds, rainTuning } from './RainParty';
import type { FireworkAudio } from './FireworkAudio';
import type { RainAudio } from './RainAudio';
import type { FacePose } from '../face/types';
import { FIREWORK_REPEAT_MS, FireworkEmitter, type FireworkCue } from './FireworkEmitter';
import { EffectManager, effectFadeOutMs, type EffectRequest, type ExpressionEffect } from './EffectManager';
import type { Contact, ComboThreshold } from './headPhysics';

export type PhysicsDebugSample = { width: number; x: number; y: number; rx: number; ry: number; angle: number; contact: Contact | null };


export function EffectPreview({ request, resetVersion = 0, automatic, pose, rainAudio, fireworkAudio, mirror = false, onStart, onCollision, debug = false, expression = 'NO_FACE', onPhysicsDebug }: {
  request: EffectRequest | null; resetVersion?: number; automatic?: ExpressionEffect | null; pose: FacePose | null;
  mirror?: boolean;
  rainAudio?: RainAudio;
  fireworkAudio?: FireworkAudio;
  onStart?: (request: EffectRequest) => void;
  onCollision?: (count: number, reward: ComboThreshold | null) => void;
  debug?: boolean; expression?: string; onPhysicsDebug?: (sample: PhysicsDebugSample | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wake = useRef<(() => void) | null>(null);
  const tracking = useRef({ request, resetVersion, automatic, pose, rainAudio, fireworkAudio, mirror, onStart, onCollision, debug, expression, onPhysicsDebug });
  useEffect(() => {
    tracking.current = { request, resetVersion, automatic, pose, rainAudio, fireworkAudio, mirror, onStart, onCollision, debug, expression, onPhysicsDebug };
  }, [request, resetVersion, automatic, pose, rainAudio, fireworkAudio, mirror, onStart, onCollision, debug, expression, onPhysicsDebug]);

  const autoKind = automatic?.request.kind;
  useEffect(() => { wake.current?.(); }, [request, resetVersion, autoKind, debug]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mobile = matchMedia('(max-width: 767px)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const rain = new RainParty();
    const fireworks = new FireworkEmitter(mobile);
    const manager = new EffectManager();
    let lastReset = tracking.current.resetVersion;
    let manualRequest: EffectRequest | null = null;
    let rainUntil = 0;
    let surface: HTMLCanvasElement | null = null;
    let nextLaugh = 0;
    let published = -1;
    let publishedReward: ComboThreshold | null = null;
    let lastPublished = 0;
    let debugPublished = false;
    const hit = () => {};
    const playFireworkCue = (cue: FireworkCue) => tracking.current.fireworkAudio?.play(cue);
    let halfWidth = .56;
    let cssWidth = 0, cssHeight = 0;
    let wasVisible = false;
    let previousTime = performance.now();
    let rate = 60;
    let fps = 60;
    let sketch: P5 | null = null;
    const resize = () => {
      if (!sketch) return;
      const width = host.clientWidth, height = host.clientHeight;
      if (width < 1 || height < 1 || (width === cssWidth && height === cssHeight)) return;
      cssWidth = width; cssHeight = height;
      halfWidth = width / height;
      sketch.resizeCanvas(width, height, true);
      wake.current?.();
    };
    const resizeObserver = new ResizeObserver(resize);
    const visibility = () => {
      if (document.hidden) {
        tracking.current.rainAudio?.update(null);
        tracking.current.fireworkAudio?.stop();
        sketch?.noLoop();
      }
      else {
        previousTime = performance.now();
        sketch?.loop();
        wake.current?.();
      }
    };
    let disposed = false;
    let instance: P5 | null = null;
    const mount = (P5Constructor: typeof P5) => new P5Constructor(p => {
      p.setup = () => {
        sketch = p;
        cssWidth = Math.max(1, host.clientWidth);
        cssHeight = Math.max(1, host.clientHeight);
        halfWidth = cssWidth / cssHeight;
        p.pixelDensity(mobile ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
        const canvas = p.createCanvas(cssWidth, cssHeight, p.P2D);
        canvas.addClass('p5-stage-canvas');
        canvas.attribute('data-renderer', 'p5-p2d');
        canvas.parent(host);
        surface = canvas.elt as HTMLCanvasElement;
        wake.current = () => {
          if (rate !== 60) { rate = 60; p.frameRate(rate); }
        };
        resizeObserver.observe(host);
        document.addEventListener('visibilitychange', visibility);
        visibility();
      };
      p.draw = () => {
        const now = performance.now();
        const frameTime = now - previousTime;
        previousTime = now;
        const delta = Math.min(Math.max(0, frameTime / 1000), .05);
        if (document.hidden) return;
        fps += (1000 / Math.max(1, frameTime) - fps) * .10;
        const inputs = tracking.current;
        const projection = inputs.pose?.projection;
        const stagePose = projection && (projection.width !== cssWidth || projection.height !== cssHeight || projection.mirror !== inputs.mirror)
          ? null : inputs.pose;
        const clear = () => {
          rain.clear();
          fireworks.clear();
          inputs.rainAudio?.stopPlayback();
          inputs.fireworkAudio?.stop(0);
        };
        if (inputs.resetVersion !== lastReset) {
          lastReset = inputs.resetVersion;
          manager.stopCurrentEffect(inputs.automatic?.request.kind);
        }
        if (inputs.request !== manualRequest) {
          manualRequest = inputs.request;
          if (manualRequest) {
            manager.requestEffect(manualRequest);
            if (!manager.leaving && manager.active?.kind === 'rain' && manualRequest.kind === 'rain') rainUntil = now + 4000;
          }
        }
        manager.observe(inputs.automatic ?? null, now);
        manager.tick(now, request => {
          if (request.kind === 'rain') {
            rain.restart();
            rainUntil = now + 4000;
          } else {
            inputs.fireworkAudio?.beginPlayback();
            fireworks.launch({ ...request.settings, reduced: request.settings.reduced || reduced.matches }, halfWidth, stagePose);
            nextLaugh = now + FIREWORK_REPEAT_MS;
          }
          inputs.onStart?.(request);
        }, () => {
          inputs.rainAudio?.update(null, (effectFadeOutMs - 20) / 1000);
          inputs.fireworkAudio?.stop((effectFadeOutMs - 20) / 1000);
        }, clear);

        const active = manager.active;
        const automatic = inputs.automatic?.request;
        const emitting = !manager.leaving;
        const rainStrength = active?.kind === 'rain' && emitting
          ? active.source === 'manual' ? (now < rainUntil ? active.settings.strength : null)
            : automatic?.kind === 'rain' ? automatic.settings.strength : null
          : null;
        const rainInput = rainStrength === null ? null : { strength: rainStrength, pose: stagePose };
        const hasRain = active?.kind === 'rain' && rain.update(delta, rainInput, halfWidth, reduced.matches, stagePose, emitting);
        if (active?.kind === 'rain' && emitting) inputs.rainAudio?.update(rainStrength);
        if (active?.kind === 'firework' && active.source === 'expression' && emitting && automatic?.kind === 'firework' && now >= nextLaugh) {
          fireworks.launch({ ...automatic.settings, reduced: automatic.settings.reduced || reduced.matches }, halfWidth, stagePose);
          nextLaugh = now + FIREWORK_REPEAT_MS;
        }
        const hasFirework = active?.kind === 'firework'
          ? fireworks.update(delta, stagePose, hit, halfWidth, now / 1000, playFireworkCue, emitting)
          : fireworks.update(0, stagePose, hit, halfWidth, now / 1000, undefined, false);
        const opacity = active ? manager.opacity(now) : 1;
        // The surface opacity composites the entire old picture, including additive trails.
        if (surface && surface.style.opacity !== String(opacity)) surface.style.opacity = String(opacity);
        if (active?.kind === 'rain' && !hasRain && rainStrength === null && inputs.rainAudio?.status !== 'fading') manager.complete();
        if (active?.kind === 'firework' && !hasFirework && !inputs.fireworkAudio?.active) manager.complete();
        const combo = fireworks.combo.count;
        const showDebug = import.meta.env.DEV && inputs.debug;
        const debugVisible = Boolean(showDebug && stagePose);
        if (now - lastPublished >= 125) {
          lastPublished = now;
          if (combo !== published || publishedReward !== fireworks.lastReward) {
            published = combo;
            publishedReward = fireworks.lastReward;
            inputs.onCollision?.(combo, publishedReward);
          }
          if (debugVisible) {
            const { x, y, rx, ry, angle } = fireworks.head;
            inputs.onPhysicsDebug?.({width: halfWidth, x, y, rx, ry, angle, contact: fireworks.lastContact});
          } else if (debugPublished) inputs.onPhysicsDebug?.(null);
          debugPublished = debugVisible;
        }
        const visible = hasRain || hasFirework || showDebug;
        const nextRate = visible || manager.active || inputs.automatic ? 60 : 10;
        if (rate !== nextRate) { rate = nextRate; p.frameRate(rate); }
        if (!visible && !wasVisible) return;
        wasVisible = visible;
        p.clear();
        p.push();
        p.translate(cssWidth / 2, cssHeight / 2);
        p.scale(cssHeight / 2, -cssHeight / 2);
        if (hasRain) rain.draw(p);
        if (hasFirework) fireworks.draw(p);
        if (showDebug) {
          rain.drawDebug(p);
          fireworks.drawDebug(p);
        }
        p.pop();
        if (showDebug) {
          p.noStroke();
          p.fill(7, 11, 19, 215);
          p.rect(12, 48, Math.min(cssWidth - 24, 345), 75, 5);
          p.fill(211, 244, 244);
          p.textFont('monospace');
          p.textSize(12);
          p.text(`Drops ${rain.dropCount} / spray ${rain.splashCount} / rings ${rain.rippleCount}`, 20, 83);
          const spawn = rainSpawnBounds(halfWidth, .10 + rainTuning.ground[1] * 2);
          const right = Math.ceil((spawn.right + halfWidth) * cssHeight / 2);
          p.text(`Canvas ${cssWidth}×${cssHeight} / spawn x 0–${right}px`, 20, 115);
          p.text(`Audio ${inputs.rainAudio?.status ?? 'off'} / ground ${rainTuning.ground[0] * 100}–${rainTuning.ground[1] * 100}%`, 20, 99);
          p.text(`${Math.round(fps)} FPS · ${rain.particleCount + fireworks.particleCount} particles · ${inputs.expression}`, 20, 66);
        }
      };
    }, host);
    void import('p5').then(({default: P5Constructor}) => {
      if (!disposed) instance = mount(P5Constructor);
    }).catch(error => {
      if (!disposed) console.error('Could not load the p5 effects renderer.', error);
    });
    return () => {
      disposed = true;
      wake.current = null;
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      instance?.remove();
    };
  }, []);


  return <div ref={hostRef} className="effect-canvas" aria-hidden="true" />;
}
