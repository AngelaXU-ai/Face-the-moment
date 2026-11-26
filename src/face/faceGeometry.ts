import type { FacePose, RawFaceGeometry } from './types';

export interface CoverTransformInput {
  sourceWidth: number;
  sourceHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  mirror: boolean;
}

export function mapGeometryThroughCover(geometry: RawFaceGeometry, input: CoverTransformInput): Omit<FacePose, 'velocityX' | 'velocityY' | 'speed'> {
  const scale = Math.max(input.viewportWidth / input.sourceWidth, input.viewportHeight / input.sourceHeight);
  const renderedWidth = input.sourceWidth * scale;
  const renderedHeight = input.sourceHeight * scale;
  const cropX = (renderedWidth - input.viewportWidth) / 2;
  const cropY = (renderedHeight - input.viewportHeight) / 2;
  let centerX = (geometry.centerX * renderedWidth - cropX) / input.viewportWidth;
  const centerY = (geometry.centerY * renderedHeight - cropY) / input.viewportHeight;
  if (input.mirror) centerX = 1 - centerX;
  return {
    centerX,
    centerY,
    width: geometry.width * renderedWidth / input.viewportWidth,
    height: geometry.height * renderedHeight / input.viewportHeight,
    rollDegrees: geometry.rollRadians * 180 / Math.PI * (input.mirror ? -1 : 1),
  };
}
