import { useEffect, useRef, useState, type RefObject } from 'react';
import { FaceTrackingRuntime } from './FaceTrackingRuntime';
import type { FaceTrackingSample, FaceTrackingStatus } from './types';

interface UseFaceTrackingOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  active: boolean;
  mirror: boolean;
}

export function useFaceTracking({ videoRef, viewportRef, active, mirror }: UseFaceTrackingOptions) {
  const mirrorRef = useRef(mirror);
  const [status, setStatus] = useState<FaceTrackingStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [sample, setSample] = useState<FaceTrackingSample | null>(null);

  useEffect(() => { mirrorRef.current = mirror; }, [mirror]);

  useEffect(() => {
    const video = videoRef.current;
    const viewport = viewportRef.current;
    if (!active || !video || !viewport) {
      setStatus('idle');
      setMessage(null);
      setSample(null);
      return;
    }
    const runtime = new FaceTrackingRuntime({
      video,
      viewport,
      getMirror: () => mirrorRef.current,
      onSample: setSample,
      onStatus: (nextStatus, nextMessage) => {
        setStatus(nextStatus);
        setMessage(nextMessage);
      },
    });
    void runtime.start();
    return () => runtime.dispose();
  }, [active, videoRef, viewportRef]);

  return { status, message, sample };
}
