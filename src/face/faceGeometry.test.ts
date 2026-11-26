import { describe, expect, it } from 'vitest';
import { mapGeometryThroughCover } from './faceGeometry';

describe('mapGeometryThroughCover', () => {
  it('accounts for portrait object-fit cover cropping', () => {
    const pose = mapGeometryThroughCover(
      { centerX: 0.4, centerY: 0.5, width: 0.2, height: 0.4, rollRadians: 0.2 },
      { sourceWidth: 1280, sourceHeight: 720, viewportWidth: 360, viewportHeight: 640, mirror: false },
    );
    expect(pose.centerX).toBeCloseTo(0.184, 2);
    expect(pose.centerY).toBeCloseTo(0.5, 3);
    expect(pose.width).toBeCloseTo(0.632, 2);
    expect(pose.rollDegrees).toBeCloseTo(11.46, 2);
  });

  it('mirrors display coordinates and tilt without changing size', () => {
    const pose = mapGeometryThroughCover(
      { centerX: 0.4, centerY: 0.5, width: 0.2, height: 0.4, rollRadians: 0.2 },
      { sourceWidth: 1280, sourceHeight: 720, viewportWidth: 360, viewportHeight: 640, mirror: true },
    );
    expect(pose.centerX).toBeCloseTo(0.816, 2);
    expect(pose.width).toBeCloseTo(0.632, 2);
    expect(pose.rollDegrees).toBeCloseTo(-11.46, 2);
  });
});
