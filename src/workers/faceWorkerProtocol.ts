import type { InferenceDelegate, RawFaceResult } from '../face/types';

export type FaceWorkerInput =
  | { type: 'init'; wasmBaseUrl: string; modelUrl: string }
  | { type: 'frame'; bitmap: ImageBitmap; timestampMs: number }
  | { type: 'dispose' };

export type FaceWorkerOutput =
  | { type: 'ready'; delegate: InferenceDelegate }
  | { type: 'result'; result: RawFaceResult }
  | { type: 'error'; message: string; phase: 'init' | 'inference' };
