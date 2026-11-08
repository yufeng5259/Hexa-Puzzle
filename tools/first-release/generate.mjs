import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT } from '../prefab-foundation/io.mjs';

const ownership = path.join(PROJECT, 'tools/first-release/generated-files.json');
if (fs.existsSync(ownership)) {
    for (const row of JSON.parse(fs.readFileSync(ownership, 'utf8')).files) {
        const file = path.join(PROJECT, row.path);
        if (!fs.existsSync(file) || createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== row.sha256) {
            throw Error('Generated output was edited outside its owner: ' + row.path + '. Review and preserve the edit before regeneration.');
        }
    }
}
// One serial owner: validate current output before touching any UI, then refresh all output hashes.
await import('./generate-ui.mjs');
await import('./generate-app.mjs');
