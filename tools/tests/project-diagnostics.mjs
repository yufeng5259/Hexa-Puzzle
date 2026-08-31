import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const creatorRoot = process.env.COCOS_CREATOR_ROOT ?? 'G:\\cocosCreator\\Editor\\Creator\\3.8.8';
const tsc = path.join(creatorRoot, 'resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js');
const result = spawnSync(process.execPath, [tsc, '--noEmit', '-p', 'tsconfig.json'], { cwd: root, encoding: 'utf8' });
if (result.error) throw result.error;
const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split(/\r?\n/).filter(Boolean);
const projectDiagnostics = diagnostics.filter((line) => /(?:assets[\\/]scripts|tools[\\/])/.test(line));
if (projectDiagnostics.length) {
  console.error(projectDiagnostics.join('\n'));
  throw new Error(`${projectDiagnostics.length} project-owned TypeScript diagnostics`);
}
console.log(`Project-owned TypeScript diagnostics: 0 (${diagnostics.length} Creator engine declaration diagnostics ignored).`);
