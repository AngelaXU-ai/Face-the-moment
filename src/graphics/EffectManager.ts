import type { FireworkSettings } from './FireworkEmitter';

export const effectFadeOutMs = 450;
const fadeInMs = 500;
const autoCooldownMs = 800;
const confirmationMs = 80;

export type EffectKind = 'rain' | 'firework';
export type EffectRequest = {
  kind: EffectKind;
  source: 'manual' | 'expression';
  settings: FireworkSettings;
};
export type ExpressionEffect = { request: EffectRequest; sampleTime: number };

export class EffectManager {
  active: EffectRequest | null = null;
  private pending: EffectRequest | null = null;
  private blockedAfterReset: EffectKind | undefined;
  private stopRequested = false;
  private opacityAtExit = 1;
  private beganAt = 0;
  private leavingAt: number | null = null;
  private lastAutoAt = -Infinity;
  private candidate: {kind: EffectKind; first: number; last: number} | null = null;

  get leaving() { return this.leavingAt !== null; }

  requestEffect(request: EffectRequest) {
    if (request.source === 'expression' && (this.active?.source === 'manual' || this.pending?.source === 'manual')) return;
    this.pending = request;
  }

  observe(expression: ExpressionEffect | null, now: number) {
    if (!expression) {
      this.candidate = null;
      this.blockedAfterReset = undefined;
      if (this.pending?.source === 'expression') this.pending = null;
      return;
    }
    const {request, sampleTime} = expression;
    if (request.kind === this.blockedAfterReset) return;
    this.blockedAfterReset = undefined;
    if (this.pending?.source === 'expression' && this.pending.kind !== request.kind) this.pending = null;
    if (this.candidate?.kind !== request.kind) {
      this.candidate = {kind: request.kind, first: sampleTime, last: sampleTime};
    } else if (sampleTime > this.candidate.last) {
      this.candidate.last = sampleTime;
    }
    if (this.candidate.last - this.candidate.first < confirmationMs || now - this.lastAutoAt < autoCooldownMs ||
      (!this.leaving && this.active?.kind === request.kind)) return;
    this.requestEffect(request);
  }

  tick(now: number, start: (request: EffectRequest) => void, fade: () => void, clear: () => void) {
    if (this.leavingAt !== null) {
      if (now - this.leavingAt < effectFadeOutMs) return;
      clear();
      this.active = null;
      this.leavingAt = null;
    }
    const request = this.pending;
    const stop = this.stopRequested;
    this.stopRequested = false;
    if (this.active && (stop || (request && this.active.kind !== request.kind))) {
      this.opacityAtExit = this.opacity(now);
      this.leavingAt = now;
      fade();
      return;
    }
    if (!request) return;
    this.pending = null;
    if (this.active) {
      // A manual click may take ownership without recreating a live effect.
      if (request.source === 'manual') this.active = request;
      return;
    }
    this.active = request;
    this.beganAt = now;
    if (request.source === 'expression') this.lastAutoAt = now;
    start(request);
  }

  opacity(now: number) {
    const ratio = this.leavingAt === null ? (now - this.beganAt) / fadeInMs : 1 - (now - this.leavingAt) / effectFadeOutMs;
    const t = Math.max(0, Math.min(1, ratio));
    return t * t * (3 - 2 * t) * (this.leaving ? this.opacityAtExit : 1);
  }

  complete() { if (!this.leaving) this.active = null; }

  stopCurrentEffect(blockUntilExpressionChanges?: EffectKind) {
    this.blockedAfterReset = blockUntilExpressionChanges;
    this.pending = this.candidate = null;
    this.stopRequested = !this.leaving;
    this.lastAutoAt = -Infinity;
  }
}
