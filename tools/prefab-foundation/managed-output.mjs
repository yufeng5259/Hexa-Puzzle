import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SCHEMA = 'hexa.prefab-foundation.managed-outputs.v1';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalize = value => value.replaceAll('\\', '/');
const present = file => {
  try { fs.lstatSync(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
};

/** Owns generated files without overwriting edits made in Creator or a source editor. */
export class ManagedOutputs {
  constructor(project, manifestFile) {
    this.project = fs.realpathSync(path.resolve(project));
    this.manifestFile = this.resolve(manifestFile);
    this.expected = new Map();
    this.manifestBytes = fs.existsSync(this.manifestFile) ? fs.readFileSync(this.manifestFile) : null;
    this.adopted = false;
    if (this.manifestBytes) {
      const manifest = JSON.parse(this.manifestBytes.toString('utf8'));
      if (manifest.schema !== SCHEMA || !Array.isArray(manifest.files)) throw new Error('Invalid managed-output manifest');
      for (const entry of manifest.files) {
        if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Invalid managed-output entry');
        const file = this.output(entry.path);
        if (this.expected.has(file)) throw new Error('Duplicate managed-output path: ' + entry.path);
        this.expected.set(file, entry.sha256);
      }
    }
  }

  /** Call before generation so a conflict is discovered before any output changes. */
  preflight() {
    for (const [file, expected] of this.expected) {
      this.output(file);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile() || hash(fs.readFileSync(file)) !== expected) {
        throw new Error('Managed output was edited or removed; refusing to overwrite: ' + file);
      }
    }
    return this;
  }

  /** Explicit one-time enrollment of this initial foundation's already-generated outputs. */
  adopt(paths) {
    if (this.manifestBytes || this.adopted) throw new Error('Managed outputs may only be adopted once before the first commit');
    this.preflight();
    const additions = new Map();
    for (const value of paths) {
      const file = this.output(value);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('Cannot adopt missing output: ' + file);
      additions.set(file, hash(fs.readFileSync(file)));
    }
    for (const [file, fingerprint] of additions) this.expected.set(file, fingerprint);
    this.adopted = true;
    return this;
  }

  write(value, bytes) {
    const file = this.output(value);
    const next = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const fingerprint = hash(next);
    const exists = fs.existsSync(file);
    const current = exists && fs.statSync(file).isFile() ? fs.readFileSync(file) : null;
    const expected = this.expected.get(file);
    if (expected && (!current || hash(current) !== expected)) {
      throw new Error('Managed output was edited or removed; refusing to overwrite: ' + file);
    }
    if (!expected && exists && (!current || !current.equals(next))) {
      throw new Error('Existing output is not owned; refusing to overwrite: ' + file);
    }
    if (!current || !current.equals(next)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, next);
    }
    this.expected.set(file, fingerprint);
    return file;
  }

  commit() {
    this.preflight();
    this.resolve(this.manifestFile);
    const current = fs.existsSync(this.manifestFile) ? fs.readFileSync(this.manifestFile) : null;
    if (current ? !this.manifestBytes || !current.equals(this.manifestBytes) : this.manifestBytes !== null) {
      throw new Error('Managed-output manifest changed during generation');
    }
    const files = [...this.expected].map(([file, sha256]) => ({ path: normalize(path.relative(this.project, file)), sha256 }))
      .sort((a, b) => a.path.localeCompare(b.path));
    const bytes = Buffer.from(JSON.stringify({ schema: SCHEMA, files }, null, 2) + '\n');
    fs.mkdirSync(path.dirname(this.manifestFile), { recursive: true });
    if (!current || !current.equals(bytes)) fs.writeFileSync(this.manifestFile, bytes);
    this.manifestBytes = bytes;
    return this;
  }

  output(value) {
    const file = this.resolve(value);
    if (file === this.manifestFile) throw new Error('The ownership manifest cannot also be a managed output');
    return file;
  }

  resolve(value) {
    if (typeof value !== 'string' || !value) throw new Error('Managed output path must be a nonempty string');
    const file = path.resolve(this.project, value);
    this.assertInside(file);
    // Follow existing ancestors as well as the file, preventing a symlink/junction escape.
    let existing = file;
    while (!present(existing)) existing = path.dirname(existing);
    this.assertInside(fs.realpathSync(existing), true);
    return file;
  }

  assertInside(file, allowRoot = false) {
    const relative = path.relative(this.project, file);
    if ((!relative && !allowRoot) || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      throw new Error('Managed output escapes Project: ' + file);
    }
  }
}
