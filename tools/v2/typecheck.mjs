import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PROJECT, TYPESCRIPT_LIB } from './env.mjs';

const result = spawnSync(process.execPath, [path.join(TYPESCRIPT_LIB, 'tsc.js'), '--noEmit', '--skipLibCheck', '-p', 'tsconfig.json'], { cwd: PROJECT, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
