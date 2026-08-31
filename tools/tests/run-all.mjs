import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const egretRoot = 'F:\\qiguobing\\git\\Hexa Puzzle\\Hexa Puzzle\\Hexa-Puzzle';
const creatorRoot = process.env.COCOS_CREATOR_ROOT ?? 'G:\\cocosCreator\\Editor\\Creator\\3.8.8';
const tsc = path.join(creatorRoot, 'resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js');

function run(label, command, args, env = {}) {
  console.log(`\n[${label}]`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

const converterTests = readdirSync(path.join(root, 'tools/flax-converter/test'))
  .filter((name) => name.endsWith('.test.mjs'))
  .map((name) => path.join('tools/flax-converter/test', name));

run('Flax converter', process.execPath, ['--test', ...converterTests], {
  FLAX_GAME_JSON: path.join(egretRoot, 'resource/swfs/game.json'),
});
run('Prefab contract', process.execPath, ['tools/flax-prefab-generator/test.mjs']);
run('Pure TypeScript compile', process.execPath, [tsc, '-p', 'tools/tests/tsconfig.g005.json']);
run('Project-owned TypeScript diagnostics', process.execPath, ['tools/tests/project-diagnostics.mjs']);
for (const story of ['g005', 'g006', 'g008', 'g009']) run(story.toUpperCase(), process.execPath, [`tools/tests/${story}.test.cjs`]);
run('Adaptation contract', process.execPath, ['tools/tests/adaptation-contract.test.mjs']);
run('Final asset audit', process.execPath, ['tools/tests/final-asset-audit.mjs']);
console.log('\nAll migration tests passed.');
