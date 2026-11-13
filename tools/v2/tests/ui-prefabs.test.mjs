import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT } from '../env.mjs';
import { buildUi } from '../build-ui.mjs';
import { scriptType } from '../prefab-builder.mjs';

const OUT = path.join(PROJECT, 'assets/bundles/ui/prefabs');
const VIEW = scriptType('assets/scripts/features/ui/LayoutView.ts');
const known = new Set();
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, e.name);
        if (e.isDirectory()) walk(file);
        else if (e.name.endsWith('.meta')) {
            const meta = JSON.parse(fs.readFileSync(file, 'utf8'));
            known.add(meta.uuid);
            for (const sub of Object.values(meta.subMetas ?? {})) known.add(sub.uuid);
        }
    }
})(path.join(PROJECT, 'assets'));

test('every layout page builds a prefab and regeneration is byte-stable', () => {
    const before = fs.readdirSync(OUT).filter(f => f.endsWith('.prefab')).map(f => fs.readFileSync(path.join(OUT, f), 'utf8'));
    const names = buildUi();
    assert.equal(names.length, 26);
    const after = fs.readdirSync(OUT).filter(f => f.endsWith('.prefab')).map(f => fs.readFileSync(path.join(OUT, f), 'utf8'));
    assert.deepEqual(after, before);
});

for (const file of fs.readdirSync(OUT).filter(f => f.endsWith('.prefab'))) {
    test(`${file}: references resolve and LayoutView bindings are complete`, () => {
        const objects = JSON.parse(fs.readFileSync(path.join(OUT, file), 'utf8'));
        const refs = [], external = [];
        (function scan(v) {
            if (Array.isArray(v)) return v.forEach(scan);
            if (!v || typeof v !== 'object') return;
            if ('__id__' in v) refs.push(v.__id__);
            if ('__uuid__' in v) external.push(v.__uuid__);
            Object.values(v).forEach(scan);
        })(objects);
        assert.ok(refs.every(id => objects[id]), 'internal reference out of range');
        for (const uuid of external) assert.ok(known.has(uuid), `unknown asset ${uuid}`);
        const view = objects.find(o => o.__type__ === VIEW);
        assert.ok(view, 'LayoutView on root');
        assert.equal(view.node.__id__, 1);
        assert.equal(view.nodes.length, view.nodeIds.length);
        assert.equal(view.labels.length, view.labelIds.length);
        assert.equal(new Set(view.nodeIds).size, view.nodeIds.length, 'duplicate element id');
        for (const button of objects.filter(o => o.__type__ === 'cc.Button'))
            for (const event of button.clickEvents) assert.deepEqual([event.component, event.handler, event.target.__id__], ['LayoutView', 'onAction', 1]);
    });
}
