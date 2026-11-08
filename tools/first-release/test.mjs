import { spawnSync } from 'node:child_process';
import { PROJECT } from '../prefab-foundation/io.mjs';

// Keep framework, imported question geometry and puzzle rules from the prior baseline.
// Assertions for retired route pages remain historical; the new product is covered below.
const retained = ['framework','scene-contract','source-geometry','level-data','puzzle-display','puzzle-session','play-input'];
const current = ['progression','puzzle','guide','generator'];
const files = [
    ...retained.map(name => `tools/prefab-foundation/tests/${name}.test.mjs`),
    ...current.map(name => `tools/first-release/tests/${name}.test.mjs`),
    'tools/meta/tests/export.test.cjs',
];
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: PROJECT, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
