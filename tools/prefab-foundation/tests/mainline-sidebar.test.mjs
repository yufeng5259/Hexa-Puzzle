import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const project = new URL('../../../', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, project), 'utf8'));
const file = 'assets/bundles/mainline/prefabs/pages/MainlineMapPage.prefab';
const objects = read(file);
const node = name => {
    const matches = objects.filter(object => object.__type__ === 'cc.Node' && object._name === name);
    assert.equal(matches.length, 1, `Expected one ${name}`);
    return matches[0];
};
const component = (owner, type) => owner._components.map(ref => objects[ref.__id__]).find(value => value.__type__ === type);
const parent = child => objects[child._parent.__id__];
const action = owner => component(owner, 'cc.Button').clickEvents.map(ref => objects[ref.__id__] || ref);
const groups = {
    left_layout: ['每日签到', '排行榜', '每日任务', '好友'],
    right_layout: ['超值礼包', '限时活动', '新手礼包'],
};

test('map sidebars contain whole entries in the approved visual order', () => {
    for (const [name, entries] of Object.entries(groups)) {
        const container = node(name);
        assert.deepEqual(container._children.map(ref => objects[ref.__id__]._name), entries);
        for (const entry of entries) assert.equal(parent(node(entry)), container);
        const layout = component(container, 'cc.Layout');
        assert.equal(layout._enabled, true); assert.equal(layout._layoutType, 2);
        assert.equal(layout._resizeMode, 1); assert.equal(layout._spacingY, 20);
        assert.equal(layout._verticalDirection, 1);
        assert.equal(component(container, 'cc.UITransform')._anchorPoint.y, 1, 'Container top must stay fixed when Layout resizes');
        const widget = component(container, 'cc.Widget');
        assert.equal(widget._enabled, true); assert.equal(widget._alignFlags, name === 'left_layout' ? 9 : 33);
    }
});

test('each side entry owns its original label and badge without moving their relative artwork', () => {
    const expected = [
        ['排行榜', '排行榜红点', 42.5, 51], ['排行榜', '排行榜文案', 0, -39.5],
        ['每日任务', '每日任务红点', 42, 53.5], ['每日任务', '每日任务文案', 0, -42.5],
        ['好友', '好友文案', 0, -40],
        ['限时活动', '限时活动红点', 41.5, 54.5], ['限时活动', '限时活动文案', 0, -43],
        ['新手礼包', '新手礼包红点', 41.5, 53.5], ['新手礼包', '新手礼包文案', 0, -41.5],
        ['超值礼包', '礼包促销吊牌文案', 23, -20.851],
    ];
    for (const [entry, name, x, y] of expected) {
        const child = node(name);
        assert.equal(parent(child), node(entry), `${name} is outside its entry`);
        assert.ok(Math.abs(child._lpos.x - x) < 1e-6, `${name}.x`);
        assert.ok(Math.abs(child._lpos.y - y) < 1e-6, `${name}.y`);
    }
    for (const entry of ['每日签到', '超值礼包']) {
        assert.equal(parent(node(entry + '红点')), node(entry));
        assert.equal(parent(node(entry + '文案')), node(entry));
    }
});

test('entry and badge clicks retain the root View event contract', () => {
    const expected = {
        每日签到: 'notice:signin', 排行榜: 'notice:achievements', 每日任务: 'notice:tasks', 好友: 'notice:bee-home',
        超值礼包: 'notice:supply', 限时活动: 'notice:events', 新手礼包: 'open:help-index',
        每日签到红点: 'notice:signin', 每日任务红点: 'notice:tasks',
    };
    for (const [name, id] of Object.entries(expected)) {
        const events = action(node(name)); assert.equal(events.length, 1);
        assert.equal(events[0].target.__id__, objects[0].data.__id__);
        assert.equal(events[0].component, 'MainlineMapPageView');
        assert.equal(events[0].handler, 'onAction'); assert.equal(events[0].customEventData, id);
    }
});

test('all serialized links stay reciprocal and the single map page retains eight level mounts', () => {
    for (const owner of objects.filter(object => object.__type__ === 'cc.Node'))
        for (const ref of owner._children) assert.equal(parent(objects[ref.__id__]), owner);
    const record = read('assets/resources/framework/config/prefab-registry.json').prefabs.find(item => item.id === 'mainline-map');
    const view = objects[record.rootComponent];
    const rootSize = component(objects[objects[0].data.__id__], 'cc.UITransform')._contentSize;
    assert.deepEqual([rootSize.width, rootSize.height], [853, 1843]);
    assert.deepEqual(record.layoutSize, [rootSize.width, rootSize.height]);
    assert.equal(view.stateRoots, undefined); assert.deepEqual(record.stateIds, []);
    const presentation = objects[view.presentation.__id__], layout = objects[presentation.layout.__id__];
    assert.equal(layout.itemMounts.length, 8);
    for (const ref of layout.itemMounts) assert.equal(parent(objects[ref.__id__]), node('LevelNodes'));
    for (const label of layout.labels) assert.equal(objects[label.__id__].__type__, 'cc.Label');
    assert.equal(record.maintenance, 'manual');
    const managed = read('tools/prefab-foundation/generated-files.json');
    assert.ok(managed.files.every(item => item.path !== file && item.path !== record.scriptPath));
});
