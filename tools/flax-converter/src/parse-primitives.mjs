import { fail } from './diagnostics.mjs';

function finite(value, path) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail('NUMBER_NOT_FINITE', path, 'Expected a finite number', value);
  return number;
}

export function parsePair(raw, path, labels = ['x', 'y']) {
  if (typeof raw !== 'string') fail('FIELD_TYPE_INVALID', path, 'Expected a string pair', raw);
  const match = raw.match(/^\s*\{?\s*([^,{}]+)\s*,\s*([^,{}]+)\s*\}?\s*$/);
  if (!match) fail('GEOMETRY_INVALID', path, 'Expected {a,b}', raw);
  return { [labels[0]]: finite(match[1], `${path}.${labels[0]}`), [labels[1]]: finite(match[2], `${path}.${labels[1]}`) };
}

export function parseAtlasRect(raw, path) {
  if (typeof raw !== 'string') fail('FIELD_TYPE_INVALID', path, 'Expected an atlas rectangle string', raw);
  const match = raw.match(/^\s*\{\s*\{\s*([^,{}]+)\s*,\s*([^,{}]+)\s*\}\s*,\s*\{\s*([^,{}]+)\s*,\s*([^,{}]+)\s*\}\s*\}\s*$/);
  if (!match) fail('GEOMETRY_INVALID', path, 'Expected {{x,y},{width,height}}', raw);
  const result = {
    x: finite(match[1], `${path}.x`),
    y: finite(match[2], `${path}.y`),
    width: finite(match[3], `${path}.width`),
    height: finite(match[4], `${path}.height`),
  };
  if (result.width <= 0 || result.height <= 0) fail('GEOMETRY_INVALID', path, 'Width and height must be positive', raw);
  return result;
}

export function parseMovieClipRect(raw, path) {
  if (typeof raw !== 'string') fail('FIELD_TYPE_INVALID', path, 'Expected a MovieClip rectangle string', raw);
  const values = raw.split(',');
  if (values.length !== 4) fail('GEOMETRY_INVALID', path, 'Expected x,y,width,height', raw);
  const result = {
    x: finite(values[0], `${path}.x`),
    y: finite(values[1], `${path}.y`),
    width: finite(values[2], `${path}.width`),
    height: finite(values[3], `${path}.height`),
  };
  if (result.width <= 0 || result.height <= 0) fail('GEOMETRY_INVALID', path, 'Width and height must be positive', raw);
  return result;
}

export function parseFrameState(raw, path, isText) {
  const values = raw.split(',');
  const expected = isText ? 15 : 9;
  if (values.length !== expected) fail('FRAME_STATE_FIELD_COUNT_INVALID', path, `Expected ${expected} fields`, raw);
  const result = {
    position: { x: finite(values[0], `${path}.x`), y: finite(values[1], `${path}.y`) },
    rotation: finite(values[2], `${path}.rotation`),
    scale: { x: finite(values[3], `${path}.scaleX`), y: finite(values[4], `${path}.scaleY`) },
    alpha: finite(values[5], `${path}.alpha`),
    zIndex: finite(values[6], `${path}.zIndex`),
    skew: { x: finite(values[7], `${path}.skewX`), y: finite(values[8], `${path}.skewY`) },
  };
  if (isText) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(values[11])) fail('FIELD_TYPE_INVALID', `${path}.color`, 'Expected #RRGGBB', values[11]);
    if (!['left', 'center', 'right'].includes(values[12])) fail('FIELD_TYPE_INVALID', `${path}.align`, 'Expected left, center, or right', values[12]);
    Object.assign(result, {
      fontFamily: values[9],
      fontSize: finite(values[10], `${path}.fontSize`),
      color: values[11].toUpperCase(),
      align: values[12],
      size: { width: finite(values[13], `${path}.width`), height: finite(values[14], `${path}.height`) },
    });
  }
  return result;
}

export function expandFrameStates(raw, totalFrames, path, isText) {
  if (typeof raw !== 'string') fail('FIELD_TYPE_INVALID', path, 'Expected a frame-state string', raw);
  const slots = raw.split('|');
  if (slots.length !== totalFrames) fail('FRAME_SLOT_COUNT_MISMATCH', path, `Expected ${totalFrames} slots, received ${slots.length}`, raw);
  const expanded = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (slot === 'null') expanded.push(null);
    else if (slot === '') expanded.push(expanded[index - 1] ?? null);
    else expanded.push(parseFrameState(slot, `${path}[${index}]`, isText));
  }
  return expanded;
}
