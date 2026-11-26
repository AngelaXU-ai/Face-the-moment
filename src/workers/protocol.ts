import type { ExpressionSample } from '../face/expressionTypes';

export type RuntimeWorkerMessage =
  | { type: 'expression'; payload: ExpressionSample }
  | { type: 'dispose' };
