import assert from 'node:assert/strict';

/** Keep Scene at object 1 in Creator's scene format and reserve its asset UUID. */
export function serializeScene(objects, sceneIndex, assetUuid) {
  assert.equal(objects[0]?.__type__, 'cc.SceneAsset');
  assert.equal(objects[sceneIndex]?.__type__, 'cc.Scene');
  const order = [0, sceneIndex, ...objects.map((_, index) => index).filter(index => index !== 0 && index !== sceneIndex)];
  const indexes = new Map(order.map((old, current) => [old, current]));
  const remap = value => {
    if (Array.isArray(value)) return value.map(remap);
    if (!value || typeof value !== 'object') return value;
    if ('__id__' in value) {
      assert(indexes.has(value.__id__), 'Scene contains an invalid object reference');
      return { ...value, __id__: indexes.get(value.__id__) };
    }
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, remap(child)]));
  };
  const result = order.map(index => remap(objects[index]));
  result[0].scene = { __id__: 1 };
  result[1]._id = assetUuid;
  validateScene(result, assetUuid);
  return result;
}

export function validateScene(objects, assetUuid) {
  assert.equal(objects[0]?.__type__, 'cc.SceneAsset', 'Missing SceneAsset');
  assert.equal(objects[0].scene?.__id__, 1, 'SceneAsset.scene must reference object 1 for Creator import');
  assert.equal(objects[1]?.__type__, 'cc.Scene', 'Creator importer expects cc.Scene at object 1');
  assert.equal(objects[1]._id, assetUuid, 'Scene root must own the asset UUID');
  assert.equal(objects[1]._parent, null, 'Scene root cannot have a parent');
  const ids = new Set(), visited = new Set();
  for (const object of objects) if (object.__type__ === 'cc.Node' || object.__type__ === 'cc.Scene') {
    assert(object._id && !ids.has(object._id), 'Duplicate or missing scene node UUID: ' + object._id);
    ids.add(object._id);
    if (object.__type__ === 'cc.Node') assert.notEqual(object._id, assetUuid, 'Child node cannot own the scene asset UUID');
  }
  const visit = (index, parent) => {
    assert(!visited.has(index), 'Scene hierarchy contains a cycle or repeated child');
    visited.add(index);
    const node = objects[index];
    assert(node && (node.__type__ === 'cc.Scene' || node.__type__ === 'cc.Node'), 'Invalid hierarchy child');
    if (parent !== null) assert.equal(node._parent?.__id__, parent, 'Non-reciprocal scene parent');
    for (const child of node._children ?? []) visit(child.__id__, index);
  };
  visit(1, null);
  assert.equal(visited.size, ids.size, 'Scene contains disconnected nodes');
  const references = value => {
    if (!value || typeof value !== 'object') return;
    if ('__id__' in value) assert(Number.isInteger(value.__id__) && objects[value.__id__], 'Invalid scene reference');
    for (const child of Object.values(value)) references(child);
  };
  references(objects);
}
