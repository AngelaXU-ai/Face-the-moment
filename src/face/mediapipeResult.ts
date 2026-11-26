import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { ExtendedExpressionScores, RawFaceGeometry, RawFaceResult } from './types';

function categoryScore(result: FaceLandmarkerResult, name: string): number {
  const categories = result.faceBlendshapes[0]?.categories ?? [];
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}

const oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

function geometryFromLandmarks(landmarks: NormalizedLandmark[], aspect: number): RawFaceGeometry | null {
  if (landmarks.length === 0) return null;
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const rollRadians = leftEye && rightEye ? Math.atan2(rightEye.y - leftEye.y, (rightEye.x - leftEye.x) * aspect) : 0;
  const c = Math.cos(rollRadians), s = Math.sin(rollRadians);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const index of oval) {
    const landmark = landmarks[index];
    if (!landmark) continue;
    const x = landmark.x * aspect * c + landmark.y * s;
    const y = -landmark.x * aspect * s + landmark.y * c;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  const x = (minX + maxX) / 2, y = (minY + maxY) / 2;
  return {
    centerX: (x * c - y * s) / aspect,
    centerY: x * s + y * c,
    width: (maxX - minX) / aspect,
    height: maxY - minY,
    rollRadians,
  };
}

export function compactFaceLandmarkerResult(result: FaceLandmarkerResult, timestampMs: number, inferenceMs: number, aspect: number): RawFaceResult {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) {
    return { timestampMs, scores: null, geometry: null, transformationMatrix: null, inferenceMs };
  }
  const scores: ExtendedExpressionScores = {
    smileLeft: categoryScore(result, 'mouthSmileLeft'),
    smileRight: categoryScore(result, 'mouthSmileRight'),
    jawOpen: categoryScore(result, 'jawOpen'),
    mouthPucker: categoryScore(result, 'mouthPucker'),
    browInnerUp: categoryScore(result, 'browInnerUp'),
  };
  return {
    timestampMs,
    scores,
    geometry: geometryFromLandmarks(landmarks, aspect),
    transformationMatrix: result.facialTransformationMatrixes[0]?.data.slice() ?? null,
    inferenceMs,
  };
}
