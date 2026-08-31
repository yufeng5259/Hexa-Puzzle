export class FlaxValidationError extends Error {
  constructor(diagnostics) {
    super(diagnostics.map((item) => `${item.code} ${item.path}: ${item.message}`).join('\n'));
    this.name = 'FlaxValidationError';
    this.diagnostics = diagnostics;
  }
}

export function diagnostic(code, path, message, rawValue) {
  const result = { severity: 'error', code, path, message };
  if (rawValue !== undefined) result.rawValue = rawValue;
  return result;
}

export function fail(code, path, message, rawValue) {
  throw new FlaxValidationError([diagnostic(code, path, message, rawValue)]);
}
