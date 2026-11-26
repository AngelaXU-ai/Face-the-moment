import type { Expression, ExpressionScores, ExtendedExpressionScores, FaceState } from './types';
import { ZERO_SCORES } from './types';

export interface ExpressionStateMachineConfig {
  emaTimeConstantMs: number;
  smileEnter: number;
  smileExit: number;
  smileJawMax: number;
  smileJawRelease: number;
  laughSmileEnter: number;
  laughSmileExit: number;
  laughJawEnter: number;
  laughJawExit: number;
  laughPuckerMax: number;
  smileConfirmMs: number;
  laughConfirmMs: number;
  laughHoldMs: number;
  releaseMs: number;
  smileCooldownMs: number;
  laughCooldownMs: number;
}

export const DEFAULT_EXPRESSION_CONFIG: ExpressionStateMachineConfig = {
  emaTimeConstantMs: 78,
  smileEnter: 0.34,
  smileExit: 0.27,
  smileJawMax: 0.28,
  smileJawRelease: 0.35,
  laughSmileEnter: 0.56,
  laughSmileExit: 0.48,
  laughJawEnter: 0.22,
  laughJawExit: 0.16,
  laughPuckerMax: 0.36,
  smileConfirmMs: 150,
  laughConfirmMs: 150,
  laughHoldMs: 340,
  releaseMs: 250,
  smileCooldownMs: 1200,
  laughCooldownMs: 1800,
};

export function classifyExpression(scores: ExpressionScores): Expression {
  return expressionFor(scores, scores, 'NEUTRAL', DEFAULT_EXPRESSION_CONFIG);
}

// MediaPipe provides normalized blendshapes. Jaw opening alone never qualifies
// for fireworks. In the overlapping jaw band a relaxed smile still qualifies
// for rain, while a brighter open smile takes priority.
type ClassifierScores = ExpressionScores & { mouthPucker?: number };

function expressionFor(
  scores: ClassifierScores,
  raw: ClassifierScores,
  state: FaceState,
  config: ExpressionStateMachineConfig,
): Expression {
  const smile = (scores.smileLeft + scores.smileRight) / 2;
  const keepingLaugh = state === 'LAUGH';
  const rawSmile = (raw.smileLeft + raw.smileRight) / 2;
  const entryEvidence = raw.jawOpen >= config.laughJawExit && rawSmile >= config.laughSmileExit
    && (raw.mouthPucker ?? 0) <= config.laughPuckerMax;
  if ((keepingLaugh || entryEvidence) && smile >= (keepingLaugh ? config.laughSmileExit : config.laughSmileEnter)
      && scores.jawOpen >= (keepingLaugh ? config.laughJawExit : config.laughJawEnter)
      && (scores.mouthPucker ?? 0) <= config.laughPuckerMax) return 'LAUGH';

  const keepingSmile = state === 'SMILE';
  const smileActive = smile >= (keepingSmile ? config.smileExit : config.smileEnter)
    && scores.jawOpen <= (keepingSmile ? config.smileJawRelease : config.smileJawMax)
    && (keepingSmile || raw.jawOpen <= config.smileJawRelease);
  return smileActive ? 'SMILE' : 'NEUTRAL';
}

export interface ExpressionSnapshot {
  state: FaceState;
  trigger: Expression | null;
  smoothed: ExtendedExpressionScores;
  smileScore: number;
}

const minEntrySamples = 3;
const maxEntrySampleGapMs = 200;

const rank: Record<FaceState, number> = { NO_FACE: -1, NEUTRAL: 0, SMILE: 1, LAUGH: 2 };

export class ExpressionStateMachine {
  private state: FaceState = 'NO_FACE';
  private laughEnteredAt = -Infinity;
  private candidate: FaceState | null = null;
  private candidateSince = 0;
  private candidateLast = 0;
  private candidateSamples = 0;
  private missingSince: number | null = null;
  private lastTimestamp = 0;
  private smoothed: ExtendedExpressionScores = { ...ZERO_SCORES };
  private hasSmoothedSample = false;
  private lastTrigger: Record<Expression, number> = { NEUTRAL: -Infinity, SMILE: -Infinity, LAUGH: -Infinity };

  constructor(private readonly config: ExpressionStateMachineConfig = DEFAULT_EXPRESSION_CONFIG) {}

  update(scores: ExtendedExpressionScores | null, timestampMs: number): ExpressionSnapshot {
    if (!scores) return this.updateMissing(timestampMs);
    this.missingSince = null;
    this.applyEma(scores, timestampMs);
    if (this.state === 'NO_FACE') {
      this.state = 'NEUTRAL';
      this.candidate = null;
    }

    const desired = expressionFor(this.smoothed, scores, this.state, this.config);
    const promoting = rank[desired] > rank[this.state];
    let trigger: Expression | null = null;
    // Minimum laugh hold and release confirmation run concurrently. Recovery
    // clears a pending downgrade, and a settled downgrade cannot fire rain.
    if (desired === this.state) {
      this.candidate = null;
    } else if (this.candidate !== desired || (promoting && timestampMs - this.candidateLast > maxEntrySampleGapMs)) {
      this.candidate = desired;
      this.candidateSince = this.candidateLast = timestampMs;
      this.candidateSamples = 1;
    } else {
      if (timestampMs > this.candidateLast) {
        this.candidateLast = timestampMs;
        this.candidateSamples++;
      }
      if (timestampMs - this.candidateSince < this.confirmationFor(desired)
        || (promoting && this.candidateSamples < minEntrySamples)
        || (this.state === 'LAUGH' && timestampMs - this.laughEnteredAt < this.config.laughHoldMs)) return this.snapshot(null);
      const previous = this.state;
      this.state = desired;
      if (desired === 'LAUGH') this.laughEnteredAt = timestampMs;
      this.candidate = null;
      if ((desired === 'SMILE' || desired === 'LAUGH') && rank[desired] > rank[previous]) {
        const cooldown = desired === 'LAUGH' ? this.config.laughCooldownMs : this.config.smileCooldownMs;
        if (timestampMs - this.lastTrigger[desired] >= cooldown) {
          trigger = desired;
          this.lastTrigger[desired] = timestampMs;
        }
      }
    }
    return this.snapshot(trigger);
  }

  reset(): void {
    this.state = 'NO_FACE';
    this.laughEnteredAt = -Infinity;
    this.candidate = null;
    this.missingSince = null;
    this.lastTimestamp = 0;
    this.smoothed = { ...ZERO_SCORES };
    this.hasSmoothedSample = false;
  }

  private updateMissing(timestampMs: number): ExpressionSnapshot {
    this.candidate = null;
    if (this.state === 'NO_FACE') return this.snapshot(null);
    if (this.missingSince === null) this.missingSince = timestampMs;
    if (timestampMs - this.missingSince >= this.config.releaseMs) {
      this.state = 'NO_FACE';
      this.candidate = null;
      this.hasSmoothedSample = false;
      this.smoothed = { ...ZERO_SCORES };
    }
    return this.snapshot(null);
  }

  private applyEma(scores: ExtendedExpressionScores, timestampMs: number): void {
    if (!this.hasSmoothedSample) {
      this.smoothed = { ...scores };
      this.hasSmoothedSample = true;
      this.lastTimestamp = timestampMs;
      return;
    }
    const deltaMs = Math.max(0, timestampMs - this.lastTimestamp);
    const alpha = 1 - Math.exp(-deltaMs / this.config.emaTimeConstantMs);
    for (const key of Object.keys(this.smoothed) as Array<keyof ExtendedExpressionScores>) {
      this.smoothed[key] += alpha * (scores[key] - this.smoothed[key]);
    }
    this.lastTimestamp = timestampMs;
  }

  private confirmationFor(desired: FaceState): number {
    if (desired === 'LAUGH') return this.config.laughConfirmMs;
    if (desired === 'SMILE' && rank[desired] > rank[this.state]) return this.config.smileConfirmMs;
    return this.config.releaseMs;
  }

  private snapshot(trigger: Expression | null): ExpressionSnapshot {
    return {
      state: this.state,
      trigger,
      smoothed: { ...this.smoothed },
      smileScore: (this.smoothed.smileLeft + this.smoothed.smileRight) / 2,
    };
  }
}
