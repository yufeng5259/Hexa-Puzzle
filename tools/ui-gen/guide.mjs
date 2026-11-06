// Builds assets/bundles/common/config/guide.json from the T51 guide page configs (tip box, finger, arrow, text keys per step).
// Usage: node tools/ui-gen/guide.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ARTS, PROJECT, jsonMeta, readJson, writeJson } from './lib/io.mjs';

const dir = path.join(ARTS, '页面配置/缺少');
const rect = layer => layer && [...layer.position, ...layer.size];
const steps = fs.readdirSync(dir).filter(f => /^T51-0\d/.test(f)).sort().map(file => {
  const config = readJson(path.join(dir, file));
  const layer = name => config.layers.find(l => l.name === name);
  const text = name => config.texts.find(t => t.text_id === layer(name).text_id);
  return {
    page: path.basename(file, '.json'),
    tipKey: text('引导短句').localization_key,
    stepKey: text('引导步骤').localization_key,
    tip: rect(layer('引导原生木纹提示框')),
    finger: rect(layer('引导手指')),
    arrow: rect(layer('整块拖放方向')) ?? null,
  };
});
const out = path.join(PROJECT, 'assets/bundles/common/config/guide.json');
writeJson(out, { steps });
jsonMeta(out);
console.log(`guide.json: ${steps.length} steps`);
