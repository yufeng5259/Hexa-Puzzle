import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scriptType } from '../builder.mjs';

const project = new URL('../../../', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, project), 'utf8'));
const objects = read('assets/bundles/mainline/prefabs/pages/MainlineMapPage.prefab');
const rootIndex = objects[0].data.__id__, root = objects[rootIndex];
const node = name => {
    const matches = objects.filter(object => object.__type__ === 'cc.Node' && object._name === name);
    assert.equal(matches.length, 1, `Expected one ${name}`); return matches[0];
};
const component = (owner, type) => owner._components.map(ref => objects[ref.__id__]).find(value => value.__type__ === type);
const parent = child => objects[child._parent.__id__];
const world = child => {
    let x = 0, y = 0;
    for (let current = child; current; current = current._parent ? parent(current) : null) {
        x += current._lpos.x; y += current._lpos.y;
    }
    return [x, y];
};
const near = (actual, expected, label) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, label));

test('map is one ordinary page without obsolete hidden artwork or state wrappers', () => {
    const nodes = objects.filter(object => object.__type__ === 'cc.Node');
    assert.ok(nodes.length <= 72, 'The old generated tree must be removed');
    assert.ok(!nodes.some(value => /^(VisualRoot|DynamicRoot|微信图片_)|^关卡\d+(底板|号码|星\d)$/.test(value._name)));
    for (const object of objects) for (const field of ['stateRoots', 'stateIds', 'sourceLayouts', 'visualRootStates', 'dynamicRootStates'])
        assert.equal(Object.hasOwn(object, field), false, `Old field ${field}`);
    assert.ok(!objects.some(object => object.__type__ === scriptType('assets/scripts/ui/common/SourceLayout.ts')));
    assert.ok(!objects.some(object => object.__type__ === scriptType('assets/scripts/features/presentation/PresentationGroup.ts')));
    const view = component(root, scriptType('assets/scripts/features/mainline/ui/MainlineMapPageView.ts'));
    const presentation = component(root, scriptType('assets/scripts/features/mainline/presentation/MainlineMapPresentation.ts'));
    const core = component(root, scriptType('assets/scripts/features/presentation/CorePresentation.ts'));
    assert.ok(view?.presentation, 'Map View must bind its existing root presentation');
    assert.equal(objects[view.presentation.__id__], presentation);
    assert.equal(presentation.node.__id__, rootIndex);
    assert.equal(objects[presentation.layout.__id__], core);
    assert.equal(objects[presentation.pageLabel?.__id__], component(node('SegmentNumber'), 'cc.Label'));
    for (const [field, name, actionId] of [
        ['previousButton', 'PreviousSegment', 'map:previous'], ['nextButton', 'NextSegment', 'map:next'],
    ]) {
        const button = component(node(name), 'cc.Button');
        assert.equal(objects[presentation[field]?.__id__], button, `Map presentation.${field} must bind the visible paging button`);
        assert.equal(button.clickEvents.length, 1);
        const event = objects[button.clickEvents[0].__id__] || button.clickEvents[0];
        assert.equal(event.target.__id__, rootIndex);
        assert.equal(event.component, 'MainlineMapPageView');
        assert.equal(event.handler, 'onAction'); assert.equal(event.customEventData, actionId);
    }
    assert.equal(core.actionTarget.__id__, rootIndex);
    assert.equal(presentation.actionTarget.__id__, rootIndex);
    assert.equal(core.itemMounts.length, 8);
    assert.deepEqual(core.itemMounts.map(ref => objects[ref.__id__]._name), Array.from({ length: 8 }, (_, i) => 'Slot' + (i + 1)));
    assert.equal(read('assets/resources/framework/config/prefab-registry.json').prefabs.find(item => item.id === 'mainline-map').nodeCount, nodes.length);
});

test('header, bottom entries and pagination own complete visual units', () => {
    for (const name of ['avatar', 'spinbar', 'coinbar', 'hintbar', 'setbtn']) assert.equal(parent(node(name)), node('header'));
    assert.equal(parent(node('星币或灯泡数量')), node('hintbar'));
    assert.equal(parent(node('建造花园')), node('footer'));
    assert.equal(parent(node('建造花园入口文案')), node('建造花园'));
    assert.equal(parent(node('花园入口进度底轨')), node('建造花园'));
    for (const name of ['花园入口进度填充', '花园入口进度数值', '花园入口阶段奖励']) assert.equal(parent(node(name)), node('花园入口进度底轨'));
    assert.equal(parent(node('无尽模式')), node('footer'));
    assert.equal(parent(node('无尽模式入口文案')), node('无尽模式'));
    assert.equal(parent(node('我的排名底板')), node('无尽模式'));
    for (const name of ['我的排名', '排名柱形图']) assert.equal(parent(node(name)), node('我的排名底板'));
    for (const name of ['PreviousSegment', 'NextSegment', 'SegmentNumber']) assert.equal(parent(node(name)), node('paging'));
    for (const name of ['PreviousSegment', 'NextSegment']) {
        assert.equal(node(name)._children.length, 0);
        assert.ok(component(node(name), 'cc.Sprite')); assert.ok(component(node(name), 'cc.Button'));
    }
});

test('grouping preserves existing visual positions and both sides of the level highlight', () => {
    for (const [name, point] of [
        ['avatar', [-344.5, 835.5]], ['spinbar', [-166.5, 842]], ['coinbar', [39, 841.5]],
        ['hintbar', [247, 842]], ['星币或灯泡数量', [237, 841]], ['setbtn', [367.5, 839]],
        ['建造花园', [-192.5, -706]], ['建造花园入口文案', [-175, -713]], ['花园入口进度数值', [-194, -773.5]],
        ['花园入口阶段奖励', [-66.5, -767]], ['无尽模式', [208, -708]], ['我的排名', [234, -776]],
        ['排名柱形图', [109.5, -773.5]], ['PreviousSegment', [-336.5, -478.5]], ['NextSegment', [336.5, -478.5]],
        ['SegmentNumber', [0, -518.5]], ['bee', [281, 20.5]],
    ]) near(world(node(name)), point, name);
    const levels = node('LevelNodes'), order = levels._children.map(ref => objects[ref.__id__]._name);
    assert.ok(order.indexOf('当前关卡高亮光晕') < order.indexOf('Slot5'));
    assert.ok(order.indexOf('当前关卡头像标记') > order.indexOf('Slot5'));
});
