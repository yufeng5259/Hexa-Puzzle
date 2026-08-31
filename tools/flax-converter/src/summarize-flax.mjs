export function summarizeFlax(document) {
  const children = document.movieClips.flatMap((item) => item.children);
  return {
    atlas: `${document.metadata.image} (${document.metadata.atlasSize.width}x${document.metadata.atlasSize.height})`,
    frames: document.atlasFrames.length,
    displays: document.displays.length,
    atlasDisplays: document.displays.filter((item) => item.kind === 'atlas').length,
    externalImages: document.displays.filter((item) => item.kind === 'external-image').length,
    movieClips: document.movieClips.length,
    children: children.length,
    textChildren: children.filter((item) => item.kind === 'text').length,
  };
}
