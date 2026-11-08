import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PROJECT, WORKSPACE } from '../../prefab-foundation/io.mjs';

function fixture() {
    const base = path.join(WORKSPACE, 'tmp/prototype/first-release/generator-tests');
    fs.mkdirSync(base, { recursive: true });
    const root = fs.mkdtempSync(path.join(base, 'case-'));
    fs.mkdirSync(path.join(root, 'tools/first-release'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tools/prefab-foundation'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tools/prefab-foundation/io.mjs'), 'export const PROJECT = ' + JSON.stringify(root) + ';');
    fs.copyFileSync(path.join(PROJECT, 'tools/first-release/generate.mjs'), path.join(root, 'tools/first-release/generate.mjs'));
    for (const name of ['ui','app']) fs.writeFileSync(path.join(root, `tools/first-release/generate-${name}.mjs`), `import fs from 'node:fs'; fs.appendFileSync(${JSON.stringify(path.join(root, 'trace'))}, ${JSON.stringify(name+'\n')});`);
    const file = path.join(root, 'page.prefab');
    fs.writeFileSync(file, 'original');
    fs.writeFileSync(path.join(root, 'tools/first-release/generated-files.json'), JSON.stringify({ files: [{ path: 'page.prefab', sha256: createHash('sha256').update('original').digest('hex') }] }));
    return { root, file, run: () => spawnSync(process.execPath, ['tools/first-release/generate.mjs'], { cwd: root, encoding: 'utf8' }) };
}
test('generation refuses a changed manual Prefab before either writer starts', () => {
    const f = fixture(); fs.writeFileSync(f.file, 'manual layout');
    const result = f.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /edited outside its owner/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), 'manual layout');
    assert.equal(fs.existsSync(path.join(f.root, 'trace')), false);
});
test('unchanged generated outputs allow only serial UI then app composition', () => {
    const f = fixture(), result = f.run(); assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(path.join(f.root, 'trace'), 'utf8'), 'ui\napp\n');
});
