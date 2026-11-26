import { act, createElement, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCamera } from './useCamera';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise, resolve};
}

function fakeStream() {
  const stops = [vi.fn(), vi.fn()];
  const stream = {getTracks: () => stops.map(stop => ({stop}))} as unknown as MediaStream;
  return {stream, stops};
}

describe('camera lifecycle', () => {
  let root: Root | undefined;
  let container: HTMLElement;
  let video: HTMLVideoElement;
  let camera: ReturnType<typeof useCamera>;
  const getUserMedia = vi.fn<() => Promise<MediaStream>>();

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', () => ({matches: false}));
    vi.stubGlobal('navigator', {mediaDevices: {getUserMedia}});
    getUserMedia.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    function Harness() {
      const ref = useRef<HTMLVideoElement>(null);
      camera = useCamera(ref);
      return createElement('video', {ref});
    }
    await act(async () => { root!.render(createElement(Harness)); });
    video = container.querySelector('video')!;
    video.srcObject = null;
    vi.spyOn(video, 'play').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => { root?.unmount(); });
    root = undefined;
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('starts successfully and releases every track on repeated cleanup', async () => {
    const {stream, stops} = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    await act(async () => { expect(await camera.start()).toBe(true); });
    expect(camera.status).toBe('active');
    expect(video.srcObject).toBe(stream);
    await act(async () => { camera.stop(); camera.stop(); });
    for (const stop of stops) expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(camera.status).toBe('idle');
  });

  it.each([
    ['NotAllowedError', 'denied', /permission was denied/],
    ['NotFoundError', 'error', /no usable camera/i],
    ['NotReadableError', 'error', /in use/],
    ['AbortError', 'idle', /cancelled/],
  ] as const)('reports %s without leaving an attached stream', async (name, status, message) => {
    getUserMedia.mockRejectedValue(new DOMException('', name));
    await act(async () => { expect(await camera.start()).toBe(false); });
    expect(camera.status).toBe(status);
    expect(camera.error).toMatch(message);
    expect(video.srcObject).toBeNull();
  });

  it('releases a stream after playback rejection and retries immediately', async () => {
    const first = fakeStream();
    const second = fakeStream();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    vi.mocked(video.play).mockRejectedValueOnce(new DOMException('', 'NotAllowedError'));
    await act(async () => { expect(await camera.start()).toBe(false); });
    for (const stop of first.stops) expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(camera.status).toBe('error');
    expect(camera.error).toMatch(/video playback/);
    await act(async () => { expect(await camera.start()).toBe(true); });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(camera.status).toBe('active');
    expect(camera.error).toBeNull();
    expect(video.srcObject).toBe(second.stream);
  });

  it.each(['unmount', 'pagehide', 'cancel'] as const)('stops a stream returned after %s', async action => {
    const late = fakeStream();
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pending.promise);
    let startup!: Promise<boolean>;
    act(() => { startup = camera.start(); });
    expect(camera.status).toBe('requesting');
    await expect(camera.start()).resolves.toBe(false);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    act(() => {
      if (action === 'unmount') {
        root!.unmount();
        root = undefined;
      } else if (action === 'pagehide') {
        window.dispatchEvent(new Event('pagehide'));
      } else camera.stop();
    });
    await act(async () => {
      pending.resolve(late.stream);
      expect(await startup).toBe(false);
    });
    for (const stop of late.stops) expect(stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
    if (action !== 'unmount') {
      expect(camera.status).toBe('idle');
      expect(camera.error).toMatch(/cancelled/);
    }
  });

  it('keeps the new stream when stale playback completes after cancellation', async () => {
    const first = fakeStream();
    const second = fakeStream();
    const playback = deferred<void>();
    getUserMedia.mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream);
    vi.mocked(video.play).mockReturnValueOnce(playback.promise);
    let startup!: Promise<boolean>;
    await act(async () => { startup = camera.start(); });
    expect(video.srcObject).toBe(first.stream);
    act(() => camera.stop());
    await act(async () => { expect(await camera.start()).toBe(true); });
    await act(async () => {
      playback.resolve(undefined);
      expect(await startup).toBe(false);
    });
    for (const stop of first.stops) expect(stop).toHaveBeenCalledTimes(1);
    for (const stop of second.stops) expect(stop).not.toHaveBeenCalled();
    expect(video.srcObject).toBe(second.stream);
    expect(camera.status).toBe('active');
  });
});
