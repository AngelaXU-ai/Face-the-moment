import { describe, expect, it, vi } from 'vitest';
import { EffectManager, effectFadeOutMs, type EffectRequest } from './EffectManager';

const request = (kind: EffectRequest['kind'], source: EffectRequest['source'] = 'manual'): EffectRequest => ({
  kind, source, settings: {shape: 'SPHERE', theme: 'Candy', strength: .72, reduced: false},
});

function harness() {
  const manager = new EffectManager();
  const start = vi.fn();
  const fade = vi.fn();
  const clear = vi.fn();
  const advance = (time: number) => manager.tick(time, start, fade, clear);
  return {manager, start, fade, clear, advance};
}

describe('exclusive effect manager', () => {
  it('fades out, clears, then starts the next effect and retains only the latest request', () => {
    const {manager, start, fade, clear, advance} = harness();
    manager.requestEffect(request('rain'));
    advance(0);
    manager.requestEffect(request('firework'));
    advance(600);
    manager.requestEffect(request('rain'));
    manager.requestEffect(request('firework'));
    advance(600 + effectFadeOutMs - 1);
    expect(manager.active?.kind).toBe('rain');
    expect(fade).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();
    advance(600 + effectFadeOutMs);
    expect(manager.active?.kind).toBe('firework');
    expect(clear.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[1]);
    expect(manager.opacity(600 + effectFadeOutMs)).toBe(0);
  });

  it('protects a manual preview and accepts the stable expression after completion', () => {
    const {manager, start, advance} = harness();
    manager.requestEffect(request('rain'));
    advance(0);
    for (const time of [90, 190, 650]) {
      manager.observe({request: request('firework', 'expression'), sampleTime: time}, time);
      advance(time);
    }
    expect(start).toHaveBeenCalledOnce();
    manager.complete();
    manager.observe({request: request('firework', 'expression'), sampleTime: 700}, 700);
    advance(700);
    expect(manager.active?.kind).toBe('firework');
  });

  it('rejects duplicate samples and unstable or cooling-down expression changes', () => {
    const {manager, start, advance} = harness();
    const sample = (kind: EffectRequest['kind'], sampleTime: number, time = sampleTime) => {
      manager.observe({request: request(kind, 'expression'), sampleTime}, time);
      advance(time);
    };
    sample('rain', 0);
    sample('rain', 0, 200);
    expect(start).not.toHaveBeenCalled();
    sample('rain', 220);
    sample('firework', 300);
    sample('firework', 450);
    expect(manager.leaving).toBe(false);
    sample('rain', 780);
    sample('firework', 900);
    sample('firework', 1100);
    expect(manager.leaving).toBe(true);
    sample('rain', 1150);
    sample('rain', 1250);
    advance(1550);
    expect(start.mock.calls.map(([r]) => r.kind)).toEqual(['rain', 'rain']);
  });
});
