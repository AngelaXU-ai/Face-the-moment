import { describe, expect, it } from 'vitest';
import { RainParty, rainSpawnBounds, rainTuning } from './RainParty';

describe('Rain Party', () => {
  it('covers the visible top and overscans upwind for each stage aspect', () => {
    for (const halfWidth of [.46, 1.25, 1.78, 2.4]) {
      const {left, right} = rainSpawnBounds(halfWidth, 1.94);
      expect(left).toBe(-halfWidth);
      expect(right - 1.94 * Math.tan(rainTuning.angleDegrees * Math.PI / 180)).toBeGreaterThan(halfWidth);
    }
  });
  it('raises active density with intensity and drains after release', () => {
    const low = new RainParty();
    const high = new RainParty();
    for (let i = 0; i < 120; i++) {
      low.update(1 / 60, {strength: .15, pose: null}, 1.6, false);
      high.update(1 / 60, {strength: .9, pose: null}, 1.6, false);
    }
    expect(high.particleCount).toBeGreaterThan(low.particleCount);
    expect(high.update(1 / 60, null, 1.6, false)).toBe(true);
    for (let i = 0; i < 240; i++) high.update(1 / 60, null, 1.6, false);
    expect(high.particleCount).toBe(0);
    expect(high.update(1 / 60, null, 1.6, false)).toBe(false);
  });

  it('clears particles and atmosphere on reset', () => {
    const rain = new RainParty();
    for (let i = 0; i < 120; i++) rain.update(1 / 60, {strength: .8, pose: null}, 1.4, true);
    expect(rain.particleCount).toBeGreaterThan(0);
    rain.clear();
    expect(rain.update(1 / 60, null, 1.4, true)).toBe(false);
    expect(rain.particleCount).toBe(0);
  });

  it('produces rings from landings and lets them expire after emission stops', () => {
    const rain = new RainParty();
    for (let i = 0; i < 120; i++) rain.update(1 / 60, {strength: .65, pose: null}, 1.4, false);
    expect(rainTuning.ground).toEqual([.81, .94]);
    expect(rain.impactCount).toBeGreaterThan(0);
    expect(rain.rippleCount).toBeGreaterThan(0);
    expect(rain.rippleCount).toBeLessThanOrEqual(rain.impactCount);
    for (let i = 0; i < 240; i++) rain.update(1 / 60, null, 1.4, false);
    expect(rain.rippleCount).toBe(0);
  });
});
