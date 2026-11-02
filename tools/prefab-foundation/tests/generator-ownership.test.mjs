import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ManagedOutputs } from '../managed-output.mjs';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const fixtures = path.join(workspace, 'tmp/prototype/prefab-foundation/ownership-fixture');
fs.mkdirSync(fixtures, { recursive: true });
function fixture() {
  const project = fs.mkdtempSync(path.join(fixtures, 'run-'));
  const manifest = path.join(project, 'tools/owned.json');
  return { project, manifest, managed: () => new ManagedOutputs(project, manifest), file: name => path.join(project, name) };
}

for (const extension of ['prefab', 'ts']) {
  test(`protects a manually edited ${extension} before generation and during writes`, () => {
    const f = fixture(), name = `assets/view.${extension}`;
    const first = f.managed(); first.write(name, 'generated'); first.commit();
    const running = f.managed().preflight();
    fs.writeFileSync(f.file(name), 'human edit');
    assert.throws(() => f.managed().preflight(), /edited or removed/);
    assert.throws(() => running.write(name, 'next generated'), /edited or removed/);
    assert.equal(fs.readFileSync(f.file(name), 'utf8'), 'human edit');
  });
}

test('permits unchanged reruns, allows owned updates, and retains prior untouched ownership', () => {
  const f = fixture(), first = f.managed();
  first.write('a.prefab', 'first'); first.write('b.ts', 'binding'); first.commit();
  const second = f.managed().preflight(); second.write('a.prefab', 'second'); second.commit();
  const third = f.managed().preflight(); third.write('a.prefab', 'second'); third.commit();
  const manifest = JSON.parse(fs.readFileSync(f.manifest, 'utf8'));
  assert.deepEqual(manifest.files.map(entry => entry.path), ['a.prefab', 'b.ts']);
  fs.writeFileSync(f.file('b.ts'), 'human binding');
  assert.throws(() => f.managed().preflight(), /edited or removed/);
});

test('refuses unknown existing content and enrolls identical content only', () => {
  const f = fixture(); fs.writeFileSync(f.file('a.prefab'), 'human');
  const owner = f.managed();
  assert.throws(() => owner.write('a.prefab', 'generated'), /not owned/);
  owner.write('a.prefab', 'human'); owner.commit();
  assert.equal(JSON.parse(fs.readFileSync(f.manifest, 'utf8')).files.length, 1);
});

test('explicit initial adoption fingerprints existing files once', () => {
  const f = fixture(); fs.writeFileSync(f.file('a.prefab'), 'initial generated');
  const initial = f.managed().adopt(['a.prefab']);
  assert.throws(() => initial.adopt(['a.prefab']), /only be adopted once/);
  initial.commit();
  assert.throws(() => f.managed().adopt(['a.prefab']), /only be adopted once/);
  const owner = f.managed().preflight(); owner.write('a.prefab', 'new generated'); owner.commit();
});

test('rejects path escapes, ownership of its own manifest, and malicious manifest paths', () => {
  const f = fixture(), owner = f.managed();
  assert.throws(() => owner.write('../outside.prefab', 'bad'), /escapes Project/);
  assert.throws(() => owner.adopt(['../outside.ts']), /escapes Project/);
  assert.throws(() => owner.write(f.manifest, 'bad'), /ownership manifest/);
  assert.throws(() => new ManagedOutputs(f.project, '../outside.json'), /escapes Project/);
  fs.mkdirSync(path.dirname(f.manifest), { recursive: true });
  fs.writeFileSync(f.manifest, JSON.stringify({ schema: 'hexa.prefab-foundation.managed-outputs.v1', files: [{ path: '../outside.ts', sha256: '0'.repeat(64) }] }));
  assert.throws(() => f.managed(), /escapes Project/);
});

test('detects edits or removal after write and before commit', () => {
  const f = fixture(), owner = f.managed();
  owner.write('a.prefab', 'generated'); fs.writeFileSync(f.file('a.prefab'), 'manual');
  assert.throws(() => owner.commit(), /edited or removed/);
  assert.equal(fs.existsSync(f.manifest), false);
});

test('rejects junction or symlink ancestors leading outside Project', () => {
  const f = fixture(), outside = fs.mkdtempSync(path.join(fixtures, 'outside-'));
  fs.symlinkSync(outside, f.file('escape'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => f.managed().write('escape/a.prefab', 'bad'), /escapes Project/);
  assert.equal(fs.existsSync(path.join(outside, 'a.prefab')), false);
});
