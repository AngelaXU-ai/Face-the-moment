import { describe, expect, it } from 'vitest';
import { FIREWORK_REPEAT_MS, FireworkEmitter, bloomColorIndex, fireworkDirection, fireworkShapes, planFireworks, radialVelocity, fireworkPatterns, type FireworkCue } from './FireworkEmitter';

describe('FireworkEmitter', () => {
  it('stages four blooms and adds a fifth accent at high intensity', () => {
    const low = planFireworks(.25, 1, 1.55, null);
    const normal = planFireworks(.70, 1, 1.55, null);
    const accent = planFireworks(.95, 4, 1.55, null);
    expect(low).toHaveLength(4);
    expect(normal).toHaveLength(4);
    expect(planFireworks(.95, 5, 1.55, null)).toHaveLength(5);
    expect(accent).toHaveLength(5);
    expect(normal[0].x * normal[1].x).toBeLessThan(0);
    expect(normal[0].y).not.toBe(normal[1].y);
    expect(normal[0].y).toBeGreaterThan(low[0].y);
    expect(accent[2].radiusX).toBeLessThan(accent[1].radiusX);
    expect(accent[2].delay).toBeGreaterThan(accent[1].delay);
    expect(accent.every(burst => burst.startY < 0 && burst.y > burst.startY)).toBe(true);
  });
  it('gives neighboring bouquets separate cores at desktop and portrait widths', () => {
    for (const halfWidth of [.53, 1.55, 2]) {
      for (const sequence of [1, 2]) {
        const bursts = planFireworks(.93, sequence, halfWidth, null);
        expect(bursts[0].radiusX).toBeLessThan(Math.min(halfWidth, 1.38) * .56);
        for (let i = 0; i < bursts.length; i++) {
          for (const next of bursts.slice(i + 1)) {
            const current = bursts[i];
            const separation = Math.hypot(current.x - next.x, current.y - next.y);
            expect(separation).toBeGreaterThan((current.radiusX + next.radiusX) * .47);
          }
        }
      }
    }
  });

  it('rotates five coordinated warm and cool palettes across launches and separates simultaneous blooms', () => {
    const sequence = Array.from({length: 5}, (_, i) => bloomColorIndex(i + 1, 0));
    expect(new Set(sequence).size).toBe(5);
    expect(new Set([0, 1, 2, 3, 4].map(burst => bloomColorIndex(1, burst))).size).toBe(5);
    expect(bloomColorIndex(8, 0)).not.toBe(bloomColorIndex(9, 0));
  });

  it('uses evenly spaced two-dimensional launch vectors with a controlled jitter', () => {
    const a = radialVelocity(0, 4, 0, 2);
    const b = radialVelocity(1, 4, 0, 2);
    expect(a).toEqual({x: 2, y: 0});
    expect(b.x).toBeCloseTo(0);
    expect(b.y).toBeCloseTo(2);
    const c = radialVelocity(2, 4, .12, 3);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(3);
    expect(c.y).toBeLessThan(0);
    expect(fireworkPatterns.map(pattern => pattern.rings)).toEqual([15, 9, 7, 12]);
  });

  it('bounds pooled actors across three bursts, resizes and releases them on reset', () => {
    const emitter = new FireworkEmitter(true);
    for (let i = 0; i < 4; i++) emitter.launch({shape: 'SPHERE', theme: 'Candy', strength: 1, reduced: false}, 1.15);
    let peak = 0;
    for (let i = 0; i < 100; i++) {
      emitter.update(1 / 60, null, () => {}, i < 60 ? 1.15 : 1.65);
      peak = Math.max(peak, emitter.particleCount);
    }
    expect(peak).toBeGreaterThan(60);
    expect(peak).toBeLessThanOrEqual(580);
    emitter.clear();
    expect(emitter.particleCount).toBe(0);
    expect(emitter.active).toBe(false);
  });

  it('builds different distributions and mirrored butterfly wings', () => {
    const directions = fireworkShapes.map(shape => fireworkDirection(shape, 25, 120).toArray().join(','));
    expect(new Set(directions).size).toBe(fireworkShapes.length);
    const left = fireworkDirection('BUTTERFLY', 8, 120);
    const right = fireworkDirection('BUTTERFLY', 9, 120);
    expect(left.x).toBeCloseTo(-right.x);
    expect(left.y).toBeCloseTo(right.y);
  });

  it('completes and releases scene ownership without inventing collisions when there is no head', () => {
    const emitter = new FireworkEmitter(false);
    emitter.launch({shape: 'HEART', theme: 'Dream', strength: .9, reduced: false}, .56);
    for (let i = 0; i < 230; i++) emitter.update(1 / 30, null, () => { throw new Error('Unexpected collision'); });
    expect(emitter.active).toBe(false);
    expect(emitter.particleCount).toBe(0);
  });

  it('layers a second group over live actors without discarding the previous group', () => {
    const emitter = new FireworkEmitter(false);
    const settings = {shape: 'SPHERE', theme: 'Candy', strength: 1, reduced: false} as const;
    emitter.launch(settings, 1.4);
    expect(emitter.pendingBurstCount).toBe(5);
    for (let time = 0; time < FIREWORK_REPEAT_MS; time += 1000 / 60) emitter.update(1 / 60, null, () => {});
    expect(emitter.pendingBurstCount).toBe(0);
    const previousActors = emitter.particleCount;
    expect(previousActors).toBeGreaterThan(0);
    emitter.launch(settings, 1.4);
    expect(emitter.pendingBurstCount).toBe(5);
    expect(emitter.particleCount).toBe(previousActors);
    emitter.clear();
    expect(emitter.pendingBurstCount).toBe(0);
  });

  it('emits one launch and explosion cue at each visual boundary and clears outstanding cues on reset', () => {
    const emitter = new FireworkEmitter(false);
    const settings = {shape: 'SPHERE', theme: 'Candy', strength: 1, reduced: false} as const;
    const plan = planFireworks(1, 1, 1.4, null);
    const cues: {cue: FireworkCue; at: number}[] = [];
    const step = 1 / 60;
    emitter.launch(settings, 1.4);
    for (let frame = 1; frame < 180; frame++) {
      emitter.update(step, null, () => {}, 1.4, frame * step, cue => cues.push({cue, at: frame * step}));
    }
    expect(cues).toHaveLength(10);
    for (const [i, burst] of plan.entries()) {
      for (const [kind, expected] of [['launch', burst.start], ['burst', burst.delay]] as const) {
        const event = cues.find(item => item.cue.index === i && item.cue.kind === kind)!;
        expect(event.at).toBeGreaterThanOrEqual(expected - 1e-9);
        expect(event.at).toBeLessThanOrEqual(expected + step + 1e-9);
        expect(event.cue.pan).toBeCloseTo(burst.x / 1.4);
      }
    }
    emitter.launch(settings, 1.4);
    emitter.clear();
    emitter.update(.9, null, () => {}, 1.4, 3.9, cue => cues.push({cue, at: 3.9}));
    expect(cues).toHaveLength(10);
  });

  it('reports solver contacts and counts them when a test head crosses an active burst', () => {
    const emitter = new FireworkEmitter(false);
    emitter.launch({shape: 'SPHERE', theme: 'Candy', strength: 1, reduced: false}, .56);
    let hits = 0;
    for (let frame = 0; frame < 140; frame++) {
      emitter.update(1 / 60, {
        centerX: .22 + frame * .005, centerY: .49, width: .34, height: .31,
        rollDegrees: 21, velocityX: 0, velocityY: 0, speed: 0,
      }, () => { hits++; });
    }
    expect(hits).toBeGreaterThan(0);
    expect(emitter.combo.count).toBe(hits);
    const contact = emitter.lastContact!;
    expect(Math.hypot(contact.nx, contact.ny)).toBeCloseTo(1);
    expect(contact.energy).toBeGreaterThan(.025);
  });
});
