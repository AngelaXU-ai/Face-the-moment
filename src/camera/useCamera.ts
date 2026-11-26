import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'error';

type CameraController = {
  status: CameraStatus;
  error: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
};

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

function cameraFailure(reason: unknown, acquired: boolean): {status: CameraStatus; error: string} {
  if (acquired) return {status: 'error', error: 'The camera was accessed, but video playback could not start. Try again.'};
  const name = reason instanceof Error || reason instanceof DOMException ? reason.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {status: 'denied', error: 'Camera permission was denied. Allow access in your browser settings and try again.'};
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {status: 'error', error: 'No usable camera is available. Check the device connection and try again.'};
    case 'NotReadableError':
      return {status: 'error', error: 'The camera could not be read. It may be in use by another app or browser tab.'};
    case 'AbortError':
      return {status: 'idle', error: 'Camera startup was cancelled. Try again when ready.'};
    default:
      return {status: 'error', error: 'The camera could not be started. Try again.'};
  }
}

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>): CameraController {
  const attached = useRef<{stream: MediaStream; video: HTMLVideoElement} | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const release = useCallback(() => {
    const current = attached.current;
    attached.current = null;
    if (!current) return;
    stopTracks(current.stream);
    if (current.video.srcObject === current.stream) current.video.srcObject = null;
  }, []);

  const invalidate = useCallback(() => {
    generation.current++;
    pending.current = false;
    release();
  }, [release]);

  const stop = useCallback(() => {
    const cancelled = pending.current;
    invalidate();
    setStatus('idle');
    setError(cancelled ? 'Camera startup was cancelled. Try again when ready.' : null);
  }, [invalidate]);

  const start = useCallback(async (): Promise<boolean> => {
    if (pending.current) return false;
    if (attached.current) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setError('Camera access requires HTTPS or a supported browser.');
      return false;
    }
    const request = ++generation.current;
    pending.current = true;
    setStatus('requesting');
    setError(null);
    let acquired = false;
    try {
      const preferPortrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: preferPortrait ? 720 : 1280 },
          height: { ideal: preferPortrait ? 1280 : 720 },
        },
      });
      if (request !== generation.current) {
        stopTracks(stream);
        return false;
      }
      acquired = true;
      const video = videoRef.current;
      if (!video) {
        stopTracks(stream);
        throw new Error('Camera preview is unavailable.');
      }
      attached.current = {stream, video};
      video.srcObject = stream;
      await video.play();
      if (request !== generation.current) return false;
      setStatus('active');
      return true;
    } catch (reason) {
      if (request !== generation.current) return false;
      release();
      const failure = cameraFailure(reason, acquired);
      setStatus(failure.status);
      setError(failure.error);
      return false;
    } finally {
      if (request === generation.current) pending.current = false;
    }
  }, [release, videoRef]);

  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      invalidate();
    };
  }, [invalidate, stop]);

  return { status, error, start, stop };
}
