import { FlaxValidationError, diagnostic } from './diagnostics.mjs';

export function validateFlax(document) {
  const diagnostics = [];
  const frameCount = document.atlasFrames.length;
  const displayIds = new Set(document.displays.map((item) => item.id));
  const movieClipIds = new Set(document.movieClips.map((item) => item.id));
  const { width: atlasWidth, height: atlasHeight } = document.metadata.atlasSize;

  for (const frame of document.atlasFrames) {
    const { x, y, width, height } = frame.region;
    if (x < 0 || y < 0 || x + width > atlasWidth || y + height > atlasHeight) diagnostics.push(diagnostic('ATLAS_REGION_OUT_OF_BOUNDS', `frames.${frame.id}.frame`, `Region exceeds ${atlasWidth}x${atlasHeight}`));
    if (frame.sourceSize.width < width || frame.sourceSize.height < height) diagnostics.push(diagnostic('GEOMETRY_INVALID', `frames.${frame.id}.sourceSize`, 'sourceSize cannot be smaller than the cropped region'));
  }

  for (const display of document.displays) {
    if (display.kind !== 'atlas') continue;
    if (!Number.isInteger(display.startFrame) || !Number.isInteger(display.endFrame) || display.startFrame < 0 || display.endFrame < display.startFrame || display.endFrame >= frameCount) diagnostics.push(diagnostic('DISPLAY_RANGE_INVALID', `displays.${display.id}`, `Range ${display.startFrame}..${display.endFrame} is outside 0..${frameCount - 1}`));
  }

  for (const movieClip of document.movieClips) {
    if (!Number.isInteger(movieClip.totalFrames) || movieClip.totalFrames <= 0) diagnostics.push(diagnostic('FIELD_TYPE_INVALID', `mcs.${movieClip.id}.totalFrames`, 'totalFrames must be a positive integer'));
    for (const child of movieClip.children) {
      if (child.kind === 'display' && !displayIds.has(child.displayId) && !movieClipIds.has(child.displayId)) diagnostics.push(diagnostic('DISPLAY_REFERENCE_MISSING', `mcs.${movieClip.id}.children.${child.instanceName}.class`, `Unknown display or MovieClip ${child.displayId}`));
    }
  }

  if (diagnostics.length) throw new FlaxValidationError(diagnostics);
  return document;
}
