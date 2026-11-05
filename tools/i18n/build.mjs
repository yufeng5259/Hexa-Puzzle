// Merges the art delivery's localization tables with tools/i18n/extra/*.json into the runtime table.
// Usage: node tools/i18n/build.mjs   ->  assets/bundles/common/i18n/zh-CN.json
import fs from 'node:fs';
import path from 'node:path';
import { ARTS, PROJECT, jsonMeta, readJson, writeJson } from '../ui-gen/lib/io.mjs';

const table = { ...readJson(path.join(ARTS, '本地化/zh-CN.json')), ...readJson(path.join(ARTS, '本地化/缺少/zh-CN.json')) };
const extraDir = path.join(PROJECT, 'tools/i18n/extra');
for (const file of fs.readdirSync(extraDir).filter(f => f.endsWith('.json')).sort()) {
  for (const [key, value] of Object.entries(readJson(path.join(extraDir, file)))) {
    if (key in table) throw new Error(`${file}: duplicate key ${key}`);
    table[key] = value;
  }
}
const out = path.join(PROJECT, 'assets/bundles/common/i18n/zh-CN.json');
writeJson(out, table);
jsonMeta(out);
console.log(`zh-CN: ${Object.keys(table).length} keys`);
