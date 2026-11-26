import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { ExpressionStateMachine } from './expressionClassifier';
import { mapGeometryThroughCover } from './faceGeometry';
import { compactFaceLandmarkerResult } from './mediapipeResult';
import type { FacePose, FaceTrackingSample, FaceTrackingStatus, InferenceDelegate, InferenceThread, RawFaceResult } from './types';
import type { FaceWorkerInput, FaceWorkerOutput } from '../workers/faceWorkerProtocol';

const INFERENCE_INTERVAL_MS = 1000 / 18;
const UI_INTERVAL_MS = 1000 / 8;
const WASM_BASE_URL = new URL('/mediapipe/wasm', location.origin).href;
const OFFICIAL_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const MODEL_URL = import.meta.env.DEV && import.meta.env.VITE_DEV_FACE_MODEL_URL
  ? new URL(import.meta.env.VITE_DEV_FACE_MODEL_URL, location.origin).href
  : OFFICIAL_MODEL_URL;

export interface FaceTrackingRuntimeOptions {
  video: HTMLVideoElement;
  viewport: HTMLElement;
  getMirror: () => boolean;
  onSample: (sample: FaceTrackingSample) => void;
  onStatus: (status: FaceTrackingStatus, message: string | null) => void;
}

export class FaceTrackingRuntime {
  private readonly machine = new ExpressionStateMachine();
  private worker: Worker | null = null;
  private landmarker: FaceLandmarker | null = null;
  private gpuCanvas: HTMLCanvasElement | null = null;
  private timer: number | null = null;
  private running = false;
  private inFlight = false;
  private switchingToMain = false;
  private delegate: InferenceDelegate = 'CPU';
  private thread: InferenceThread = 'main';
  private lastResultAt = 0;
  private lastUiAt = 0;
  private inferenceHz = 0;
  private previousPose: FacePose | null = null;
  private previousPoseAt = 0;

  constructor(private readonly options: FaceTrackingRuntimeOptions) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.options.onStatus('loading', null);
    try {
      await this.initializeWorker();
      this.options.onStatus('tracking', null);
    } catch {
      if (!this.running) return;
      this.worker?.terminate();
      this.worker = null;
      this.options.onStatus('loading', 'Worker unavailable; loading controlled main-thread inference.');
      try {
        await this.initializeMainThread();
        this.options.onStatus('fallback', 'Worker unavailable; using controlled main-thread inference.');
      } catch (error) {
        this.fail(error instanceof Error ? error.message : 'Face model failed to load.');
        return;
      }
    }
    this.schedule(0);
  }

  dispose(): void {
    this.running = false;
    this.inFlight = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    if (this.worker) {
      const message: FaceWorkerInput = { type: 'dispose' };
      this.worker.postMessage(message);
      this.worker.terminate();
    }
    this.worker = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.gpuCanvas = null;
    this.machine.reset();
    this.options.onStatus('idle', null);
  }

  private async initializeWorker(): Promise<void> {
    if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
      throw new Error('Required worker imaging APIs are unavailable.');
    }
    const worker = new Worker(new URL('../workers/faceLandmarker.worker.ts', import.meta.url), { type: 'module', name: 'face-landmarker' });
    this.worker = worker;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Face worker initialization timed out.')), 15000);
      worker.onmessage = (event: MessageEvent<FaceWorkerOutput>) => {
        const message = event.data;
        if (message.type === 'ready') {
          window.clearTimeout(timeout);
          this.delegate = message.delegate;
          this.thread = 'worker';
          resolve();
        } else if (message.type === 'result') {
          this.inFlight = false;
          this.consume(message.result);
        } else if (message.type === 'error') {
          this.inFlight = false;
          if (message.phase === 'init') {
            window.clearTimeout(timeout);
            reject(new Error(message.message));
          } else {
            void this.fallbackAfterWorkerFailure(message.message);
          }
        }
      };
      worker.onerror = (event) => {
        window.clearTimeout(timeout);
        reject(new Error(event.message || 'Face worker failed.'));
      };
      const message: FaceWorkerInput = { type: 'init', wasmBaseUrl: WASM_BASE_URL, modelUrl: MODEL_URL };
      worker.postMessage(message);
    });
  }

  private async initializeMainThread(): Promise<void> {
    const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    const common = {
      runningMode: 'VIDEO' as const,
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };
    try {
      this.gpuCanvas = document.createElement('canvas');
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...common,
        canvas: this.gpuCanvas,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      });
      this.delegate = 'GPU';
    } catch {
      this.landmarker?.close();
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...common,
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
      });
      this.delegate = 'CPU';
    }
    this.thread = 'main';
  }

  private async fallbackAfterWorkerFailure(message: string): Promise<void> {
    if (this.switchingToMain || !this.running) return;
    this.switchingToMain = true;
    this.worker?.terminate();
    this.worker = null;
    this.options.onStatus('loading', `Worker inference failed; loading main-thread fallback. ${message}`);
    try {
      await this.initializeMainThread();
      this.options.onStatus('fallback', `Worker inference failed; main-thread fallback active. ${message}`);
    } catch (error) {
      this.fail(error instanceof Error ? error.message : 'Face model fallback failed.');
    } finally {
      this.switchingToMain = false;
    }
  }

  private schedule(delay = INFERENCE_INTERVAL_MS): void {
    if (!this.running) return;
    this.timer = window.setTimeout(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    const video = this.options.video;
    if (document.hidden || this.inFlight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      this.schedule();
      return;
    }
    this.inFlight = true;
    const timestampMs = performance.now();
    try {
      if (this.worker) {
        const bitmap = await createImageBitmap(video);
        if (!this.running || !this.worker) {
          bitmap.close();
          this.inFlight = false;
        } else {
          const message: FaceWorkerInput = { type: 'frame', bitmap, timestampMs };
          this.worker.postMessage(message, [bitmap]);
        }
      } else if (this.landmarker) {
        const startedAt = performance.now();
        const result = this.landmarker.detectForVideo(video, timestampMs);
        this.inFlight = false;
        this.consume(compactFaceLandmarkerResult(result, timestampMs, performance.now() - startedAt, video.videoWidth / video.videoHeight));
      } else {
        this.inFlight = false;
      }
    } catch (error) {
      this.inFlight = false;
      if (this.worker) await this.fallbackAfterWorkerFailure(error instanceof Error ? error.message : 'Frame transfer failed.');
      else this.options.onStatus('error', error instanceof Error ? error.message : 'Face inference failed.');
    }
    this.schedule();
  }

  private consume(result: RawFaceResult): void {
    if (!this.running) return;
    const now = performance.now();
    if (this.lastResultAt > 0) {
      const instantaneousHz = 1000 / Math.max(1, now - this.lastResultAt);
      this.inferenceHz = this.inferenceHz === 0 ? instantaneousHz : this.inferenceHz * 0.8 + instantaneousHz * 0.2;
    }
    this.lastResultAt = now;
    const expression = this.machine.update(result.scores, result.timestampMs);
    const previousProjection = this.previousPose?.projection;
    const pose = result.geometry ? this.mapPose(result.geometry, result.timestampMs) : null;
    if (!pose) this.previousPose = null;
    if (expression.trigger || previousProjection !== pose?.projection || now - this.lastUiAt >= UI_INTERVAL_MS) {
      this.lastUiAt = now;
      this.options.onSample({
        timestampMs: result.timestampMs,
        state: expression.state,
        trigger: expression.trigger,
        scores: expression.smoothed,
        pose,
        transformationMatrix: result.transformationMatrix,
        delegate: this.delegate,
        thread: this.thread,
        inferenceHz: this.inferenceHz,
        inferenceMs: result.inferenceMs,
      });
    }
  }

  private mapPose(geometry: RawFaceResult['geometry'], timestampMs: number): FacePose | null {
    if (!geometry) return null;
    const video = this.options.video;
    const viewport = this.options.viewport;
    const {clientWidth: width, clientHeight: height} = viewport;
    const {videoWidth: sourceWidth, videoHeight: sourceHeight} = video;
    const mirror = this.options.getMirror();
    if (!width || !height || !sourceWidth || !sourceHeight) return null;
    const old = this.previousPose?.projection;
    const sameProjection = old && old.width === width && old.height === height && old.mirror === mirror &&
      old.sourceWidth === sourceWidth && old.sourceHeight === sourceHeight;
    if (!sameProjection) this.previousPose = null;
    const projection = sameProjection ? old : {width, height, mirror, sourceWidth, sourceHeight};
    const mapped = mapGeometryThroughCover(geometry, {
      sourceWidth, sourceHeight, viewportWidth: width, viewportHeight: height, mirror,
    });
    const deltaSeconds = this.previousPoseAt > 0 ? Math.max(0.001, (timestampMs - this.previousPoseAt) / 1000) : 0;
    const rawVelocityX = this.previousPose && deltaSeconds ? (mapped.centerX - this.previousPose.centerX) / deltaSeconds : 0;
    const rawVelocityY = this.previousPose && deltaSeconds ? (mapped.centerY - this.previousPose.centerY) / deltaSeconds : 0;
    const velocityX = this.previousPose ? this.previousPose.velocityX * 0.65 + rawVelocityX * 0.35 : 0;
    const velocityY = this.previousPose ? this.previousPose.velocityY * 0.65 + rawVelocityY * 0.35 : 0;
    const pose: FacePose = { ...mapped, projection, velocityX, velocityY, speed: Math.hypot(velocityX, velocityY) };
    this.previousPose = pose;
    this.previousPoseAt = timestampMs;
    return pose;
  }

  private fail(message: string): void {
    this.running = false;
    this.inFlight = false;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.worker?.terminate();
    this.worker = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.options.onStatus('error', message);
  }
}
