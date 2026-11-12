import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT } from './env.mjs';

// All v2 node tests plus the Excel exporter tests; run serially so failures are easy to read.
const dirs = ['tools/v2/tests', 'tools/meta/tests'];
const files = dirs.flatMap(dir => fs.readdirSync(path.join(PROJECT, dir))
    .filter(name => /\.test\.(mjs|cjs)$/.test(name)).sort().map(name => path.join(dir, name)));
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { cwd: PROJECT, stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
