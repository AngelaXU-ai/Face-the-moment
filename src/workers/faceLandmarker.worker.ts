/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { compactFaceLandmarkerResult } from '../face/mediapipeResult';
import type { FaceWorkerInput, FaceWorkerOutput } from './faceWorkerProtocol';

let landmarker: FaceLandmarker | null = null;

function send(message: FaceWorkerOutput): void {
  self.postMessage(message);
}

async function createLandmarker(wasmBaseUrl: string, modelUrl: string): Promise<'GPU' | 'CPU'> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
  const sharedOptions = {
    runningMode: 'VIDEO' as const,
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  };
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...sharedOptions,
        canvas: new OffscreenCanvas(1, 1),
        baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
      });
      return 'GPU';
    } catch {
      landmarker?.close();
      landmarker = null;
    }
  }
  landmarker = await FaceLandmarker.createFromOptions(fileset, {
    ...sharedOptions,
    baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
  });
  return 'CPU';
}

self.onmessage = async (event: MessageEvent<FaceWorkerInput>) => {
  const message = event.data;
  if (message.type === 'init') {
    try {
      const delegate = await createLandmarker(message.wasmBaseUrl, message.modelUrl);
      send({ type: 'ready', delegate });
    } catch (error) {
      send({ type: 'error', phase: 'init', message: error instanceof Error ? error.message : 'Face model failed to load.' });
    }
    return;
  }
  if (message.type === 'dispose') {
    landmarker?.close();
    landmarker = null;
    self.close();
    return;
  }
  if (message.type === 'frame') {
    const startedAt = performance.now();
    try {
      if (!landmarker) throw new Error('Face model is not initialized.');
      const result = landmarker.detectForVideo(message.bitmap, message.timestampMs);
      send({ type: 'result', result: compactFaceLandmarkerResult(result, message.timestampMs, performance.now() - startedAt, message.bitmap.width / message.bitmap.height) });
    } catch (error) {
      send({ type: 'error', phase: 'inference', message: error instanceof Error ? error.message : 'Face inference failed.' });
    } finally {
      message.bitmap.close();
    }
  }
};

export {};
