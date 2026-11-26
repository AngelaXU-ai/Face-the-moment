import { describe, expect, it } from 'vitest';
import { classifyExpression, DEFAULT_EXPRESSION_CONFIG, ExpressionStateMachine } from './expressionClassifier';
import type { ExtendedExpressionScores } from './types';

const neutral: ExtendedExpressionScores = { smileLeft: 0.05, smileRight: 0.05, jawOpen: 0.05, mouthPucker: 0.02, browInnerUp: 0.1 };
const smile: ExtendedExpressionScores = { smileLeft: 0.39, smileRight: 0.35, jawOpen: 0.08, mouthPucker: 0.05, browInnerUp: 0.2 };
const laugh: ExtendedExpressionScores = { smileLeft: 0.65, smileRight: 0.60, jawOpen: 0.25, mouthPucker: 0.08, browInnerUp: 0.35 };
const fastConfig = { ...DEFAULT_EXPRESSION_CONFIG, emaTimeConstantMs: 1 };

describe('classifyExpression', () => {
  it('uses the mean of both smile coefficients', () => {
    expect(classifyExpression({ smileLeft: 0.40, smileRight: 0.30, jawOpen: 0.1 })).toBe('SMILE');
    expect(classifyExpression({ smileLeft: 0.40, smileRight: 0.24, jawOpen: 0.1 })).toBe('NEUTRAL');
  });

  it('requires smile and jaw evidence for laughter', () => {
    expect(classifyExpression({ smileLeft: 0.8, smileRight: 0.8, jawOpen: 0.5 })).toBe('LAUGH');
    expect(classifyExpression({ smileLeft: 0.1, smileRight: 0.1, jawOpen: 0.8 })).toBe('NEUTRAL');
  });
});

describe('ExpressionStateMachine', () => {
  it('confirms a smile continuously for 150ms', () => {
    const machine = new ExpressionStateMachine(fastConfig);
    expect(machine.update(smile, 0).state).toBe('NEUTRAL');
    expect(machine.update(smile, 149).state).toBe('NEUTRAL');
    const result = machine.update(smile, 150);
    expect(result.state).toBe('SMILE');
    expect(result.trigger).toBe('SMILE');
  });

  it('gives laugh priority and confirms a natural open smile in 150ms', () => {
    const machine = new ExpressionStateMachine(fastConfig);
    machine.update(laugh, 0);
    machine.update(laugh, 75);
    const result = machine.update(laugh, 150);
    expect(result.state).toBe('LAUGH');
    expect(result.trigger).toBe('LAUGH');
  });

  it('does not treat yawning or puckered speech as laughter', () => {
    const machine = new ExpressionStateMachine(fastConfig);
    const yawn = { ...neutral, jawOpen: 0.8 };
    machine.update(yawn, 0);
    expect(machine.update(yawn, 300).state).toBe('NEUTRAL');
    const puckered = { ...laugh, mouthPucker: 0.8 };
    machine.update(puckered, 400);
    expect(machine.update(puckered, 700).state).not.toBe('LAUGH');
  });

  it('requires a 340ms minimum laugh hold even when release has already been confirmed', () => {
    const machine = new ExpressionStateMachine(fastConfig);
    machine.update(laugh, 0);
    machine.update(laugh, 75);
    machine.update(laugh, 150);
    machine.update(neutral, 151);
    expect(machine.update(neutral, 489).state).toBe('LAUGH');
    expect(machine.update(neutral, 490).state).toBe('NEUTRAL');
  });

  it('keeps a weaker open smile out of fireworks and vetoes rain on a wide raw jaw', () => {
    const gap = { ...smile, jawOpen: .37 };
    expect(classifyExpression(gap)).toBe('NEUTRAL');
    const machine = new ExpressionStateMachine();
    machine.update(smile, 0);
    machine.update(smile, 149);
    expect(machine.update({ ...smile, jawOpen: .65 }, 150).state).toBe('NEUTRAL');
  });

  it('retains laugh through dips and settles into a qualifying smile without a rain trigger', () => {
    const machine = new ExpressionStateMachine(fastConfig);
    machine.update(laugh, 0);
    machine.update(laugh, 75);
    machine.update(laugh, 150);
    expect(machine.update({ ...laugh, jawOpen: .18 }, 450).state).toBe('LAUGH');
    machine.update(smile, 500);
    expect(machine.update(smile, 630).state).toBe('LAUGH');
    expect(machine.update(laugh, 660).state).toBe('LAUGH');
    machine.update(smile, 700);
    expect(machine.update(smile, 949).state).toBe('LAUGH');
    expect(machine.update(smile, 950)).toMatchObject({ state: 'SMILE', trigger: null });
  });

  it('switches a confirmed smile to laugh promptly at live inference cadence', () => {
    const machine = new ExpressionStateMachine();
    const interval = 1000 / 18;
    for (let i = 0; i < 5; i++) machine.update(smile, i * interval);
    let laughAt = Infinity;
    for (let i = 5; i <= 12; i++) {
      const sample = machine.update(laugh, i * interval);
      if (sample.trigger === 'LAUGH') laughAt = (i - 5) * interval;
    }
    expect(laughAt).toBeLessThanOrEqual(300);
  });

  it('keeps a relaxed open smile in rain and rejects brief opening or duplicate frames', () => {
    expect(classifyExpression({ ...smile, jawOpen: .23 })).toBe('SMILE');
    expect(classifyExpression({ ...laugh, jawOpen: .13 })).toBe('SMILE');
    const machine = new ExpressionStateMachine();
    for (const time of [0, 56, 112, 168]) machine.update(smile, time);
    for (const time of [224, 280]) expect(machine.update(laugh, time).state).toBe('SMILE');
    expect(machine.update(smile, 336).state).toBe('SMILE');
    const sparse = new ExpressionStateMachine(fastConfig);
    for (const time of [0, 75, 75, 350, 425]) expect(sparse.update(laugh, time).state).toBe('NEUTRAL');
    expect(sparse.update(laugh, 500).state).toBe('LAUGH');
  });

  it('delays NO_FACE and suppresses triggers during cooldown', () => {
    const machine = new ExpressionStateMachine(fastConfig);
    machine.update(smile, 0);
    machine.update(smile, 75);
    expect(machine.update(smile, 150).trigger).toBe('SMILE');
    machine.update(neutral, 151);
    machine.update(neutral, 401);
    machine.update(smile, 402);
    machine.update(smile, 475);
    expect(machine.update(smile, 552).trigger).toBeNull();
    machine.update(null, 600);
    expect(machine.update(null, 849).state).not.toBe('NO_FACE');
    expect(machine.update(null, 850).state).toBe('NO_FACE');
  });
});
