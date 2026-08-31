import { fail } from './diagnostics.mjs';
import { expandFrameStates, parseAtlasRect, parseMovieClipRect, parsePair } from './parse-primitives.mjs';

function object(raw, path) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('FIELD_TYPE_INVALID', path, 'Expected an object', raw);
  return raw;
}

function required(raw, key, path) {
  if (!(key in raw)) fail('FIELD_REQUIRED', `${path}.${key}`, 'Required field is missing');
  return raw[key];
}

function finite(raw, path) {
  const value = Number(raw);
  if (!Number.isFinite(value)) fail('NUMBER_NOT_FINITE', path, 'Expected a finite number', raw);
  return value;
}

function safeRelativePath(raw, path) {
  if (typeof raw !== 'string' || raw.length === 0) fail('FIELD_TYPE_INVALID', path, 'Expected a non-empty relative path', raw);
  const normalized = raw.replaceAll('\\', '/');
  if (/^(?:[A-Za-z]:|\/)/.test(normalized) || normalized.split('/').includes('..')) fail('EXTERNAL_PATH_UNSAFE', path, 'Path must stay relative to the source asset directory', raw);
  return normalized;
}

export function parseFlax(rawDocument) {
  const raw = object(rawDocument, '$');
  const metadataRaw = object(required(raw, 'metadata', '$'), 'metadata');
  const atlasSize = parsePair(required(metadataRaw, 'size', 'metadata'), 'metadata.size', ['width', 'height']);
  if (atlasSize.width <= 0 || atlasSize.height <= 0) fail('GEOMETRY_INVALID', 'metadata.size', 'Atlas dimensions must be positive', metadataRaw.size);
  const metadata = {
    exporter: String(required(metadataRaw, 'app', 'metadata')),
    exporterVersion: finite(required(metadataRaw, 'version', 'metadata'), 'metadata.version'),
    formatVersion: finite(required(metadataRaw, 'format', 'metadata'), 'metadata.format'),
    textureFileName: safeRelativePath(required(metadataRaw, 'textureFileName', 'metadata'), 'metadata.textureFileName'),
    realTextureFileName: safeRelativePath(metadataRaw.realTextureFileName ?? metadataRaw.textureFileName, 'metadata.realTextureFileName'),
    image: safeRelativePath(required(metadataRaw, 'image', 'metadata'), 'metadata.image'),
    atlasSize,
    fps: finite(required(metadataRaw, 'fps', 'metadata'), 'metadata.fps'),
  };

  const frameRaw = object(required(raw, 'frames', '$'), 'frames');
  const atlasFrames = Object.keys(frameRaw).sort().map((id) => {
    const value = object(frameRaw[id], `frames.${id}`);
    return {
      id,
      region: parseAtlasRect(required(value, 'frame', `frames.${id}`), `frames.${id}.frame`),
      offset: parsePair(required(value, 'offset', `frames.${id}`), `frames.${id}.offset`),
      sourceSize: parsePair(required(value, 'sourceSize', `frames.${id}`), `frames.${id}.sourceSize`, ['width', 'height']),
    };
  });

  const displayRaw = object(required(raw, 'displays', '$'), 'displays');
  const displays = Object.keys(displayRaw).sort().map((id) => {
    const value = object(displayRaw[id], `displays.${id}`);
    const anchor = { x: finite(required(value, 'anchorX', `displays.${id}`), `displays.${id}.anchorX`), y: finite(required(value, 'anchorY', `displays.${id}`), `displays.${id}.anchorY`) };
    if (value.type === 'png' || value.type === 'jpg') {
      return { id, kind: 'external-image', format: value.type, url: safeRelativePath(required(value, 'url', `displays.${id}`), `displays.${id}.url`), anchor };
    }
    if (value.type !== 'null') fail('FIELD_TYPE_INVALID', `displays.${id}.type`, 'Expected null, png, or jpg display type', value.type);
    const startFrame = finite(required(value, 'start', `displays.${id}`), `displays.${id}.start`);
    const endFrame = finite(required(value, 'end', `displays.${id}`), `displays.${id}.end`);
    return { id, kind: 'atlas', startFrame, endFrame, frameIds: atlasFrames.slice(startFrame, endFrame + 1).map((frame) => frame.id), anchor };
  });

  const movieClipRaw = object(required(raw, 'mcs', '$'), 'mcs');
  const movieClips = Object.keys(movieClipRaw).sort().map((id) => {
    const value = object(movieClipRaw[id], `mcs.${id}`);
    const totalFrames = finite(required(value, 'totalFrames', `mcs.${id}`), `mcs.${id}.totalFrames`);
    const childrenRaw = object(required(value, 'children', `mcs.${id}`), `mcs.${id}.children`);
    const children = Object.keys(childrenRaw).map((instanceName) => {
      const child = object(childrenRaw[instanceName], `mcs.${id}.children.${instanceName}`);
      const isText = child.text != null;
      return {
        instanceName,
        kind: isText ? 'text' : 'display',
        displayId: isText ? null : String(required(child, 'class', `mcs.${id}.children.${instanceName}`)),
        defaultText: isText ? String(child.text) : null,
        input: isText ? Boolean(child.input) : false,
        defaultZIndex: finite(required(child, 'zIndex', `mcs.${id}.children.${instanceName}`), `mcs.${id}.children.${instanceName}.zIndex`),
        states: expandFrameStates(required(child, 'frames', `mcs.${id}.children.${instanceName}`), totalFrames, `mcs.${id}.children.${instanceName}.frames`, isText),
      };
    }).sort((a, b) => a.defaultZIndex - b.defaultZIndex || a.instanceName.localeCompare(b.instanceName));
    return {
      id,
      bounds: parseMovieClipRect(required(value, 'rect', `mcs.${id}`), `mcs.${id}.rect`),
      anchor: { x: finite(required(value, 'anchorX', `mcs.${id}`), `mcs.${id}.anchorX`), y: finite(required(value, 'anchorY', `mcs.${id}`), `mcs.${id}.anchorY`) },
      totalFrames,
      children,
    };
  });

  return { metadata, atlasFrames, displays, movieClips };
}
