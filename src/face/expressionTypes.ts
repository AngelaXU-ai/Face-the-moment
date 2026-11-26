export type ExpressionSample = Readonly<{
  timestampMs: number;
  faceDetected: boolean;
  smile: number;
  laugh: number;
  headCenter: readonly [number, number, number];
  headRadius: readonly [number, number, number];
}>;

export const EMPTY_EXPRESSION_SAMPLE: ExpressionSample = {
  timestampMs: 0,
  faceDetected: false,
  smile: 0,
  laugh: 0,
  headCenter: [0, 0, 0],
  headRadius: [0, 0, 0],
};
