import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const sourceRoot = process.argv[2];
const projectRoot = path.resolve(import.meta.dirname, '..');
if (!sourceRoot) throw new Error('Usage: node tools/migrate-game-data.mjs <egret-project-root>');

const copies = [
  ['levels/Novice.json', 'assets/resources/data/levels/classic.json'],
  ['levels/Novice1.json', 'assets/resources/data/levels/novice.json'],
  ...Array.from({ length: 18 }, (_, index) => [`resource/assets/ui/pic2/${index + 1}.png`, `assets/resources/gameplay/tiles/${index + 1}.png`]),
  ['resource/assets/ui/aaa.fnt', 'assets/resources/gameplay/fonts/aaa-fnt.txt'],
  ['resource/assets/ui/aaa.png', 'assets/resources/gameplay/fonts/aaa.png'],
  ['resource/assets/ui/bbb.fnt', 'assets/resources/gameplay/fonts/bbb-fnt.txt'],
  ['resource/assets/ui/bbb.png', 'assets/resources/gameplay/fonts/bbb.png'],
  ['resource/assets/ui/ccc.fnt', 'assets/resources/gameplay/fonts/ccc-fnt.txt'],
  ['resource/assets/ui/ccc.png', 'assets/resources/gameplay/fonts/ccc.png'],
  ['resource/img/rotate.png', 'assets/resources/gameplay/rotate.png'],
];

const files = [];
for (const [sourceRelative, targetRelative] of copies) {
  const source = path.join(sourceRoot, ...sourceRelative.split('/'));
  const target = path.join(projectRoot, ...targetRelative.split('/'));
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  const bytes = await readFile(target);
  files.push({ source: sourceRelative, target: targetRelative, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}

const catalog = {
  version: 1,
  categories: [{ id: 'basic', name: 'Basic', maps: [
    { id: 'classic', name: 'Classic', description: 'Block 3 to 5 levels', levelCount: 80, resource: 'data/levels/classic' },
    { id: 'novice', name: 'Novice', description: 'Block 5 to 7 levels', levelCount: 80, resource: 'data/levels/novice' },
  ] }],
};
const catalogPath = path.join(projectRoot, 'assets/resources/data/catalog.json');
await mkdir(path.dirname(catalogPath), { recursive: true });
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

const report = { generatedAt: new Date().toISOString(), sourceRoot, scope: { maps: 2, levels: 160 }, files };
const reportPath = path.join(projectRoot, 'docs/generated/g005-resource-manifest.json');
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ copied: files.length, maps: 2, levels: 160 }, null, 2));
