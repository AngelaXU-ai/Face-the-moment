export type Expression = 'NEUTRAL' | 'SMILE' | 'LAUGH';
export type FaceState = 'NO_FACE' | Expression;

export interface ExpressionScores {
  smileLeft: number;
  smileRight: number;
  jawOpen: number;
}

export interface ExtendedExpressionScores extends ExpressionScores {
  mouthPucker: number;
  browInnerUp: number;
}

export interface RawFaceGeometry {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rollRadians: number;
}

export interface FacePose {
  projection?: { width: number; height: number; mirror: boolean; sourceWidth: number; sourceHeight: number };
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rollDegrees: number;
  velocityX: number;
  velocityY: number;
  speed: number;
}

export interface RawFaceResult {
  timestampMs: number;
  scores: ExtendedExpressionScores | null;
  geometry: RawFaceGeometry | null;
  transformationMatrix: number[] | null;
  inferenceMs: number;
}

export type InferenceDelegate = 'GPU' | 'CPU';
export type InferenceThread = 'worker' | 'main';

export interface FaceTrackingSample {
  timestampMs: number;
  state: FaceState;
  trigger: Expression | null;
  scores: ExtendedExpressionScores;
  pose: FacePose | null;
  transformationMatrix: number[] | null;
  delegate: InferenceDelegate;
  thread: InferenceThread;
  inferenceHz: number;
  inferenceMs: number;
}

export type FaceTrackingStatus = 'idle' | 'loading' | 'tracking' | 'fallback' | 'error';

export const ZERO_SCORES: ExtendedExpressionScores = {
  smileLeft: 0,
  smileRight: 0,
  jawOpen: 0,
  mouthPucker: 0,
  browInnerUp: 0,
};
