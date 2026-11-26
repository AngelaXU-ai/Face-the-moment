import { describe, expect, it, vi } from 'vitest';
import { RealtimeLoop } from './RealtimeLoop';

describe('RealtimeLoop', () => {
  it('does not schedule multiple loops when start is called twice', () => {
    const requestFrame = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1);
    const loop = new RealtimeLoop();

    loop.start();
    loop.start();

    expect(requestFrame).toHaveBeenCalledTimes(1);
    requestFrame.mockRestore();
  });
});
