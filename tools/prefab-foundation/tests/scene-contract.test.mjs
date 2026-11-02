import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT} from '../io.mjs';
import {serializeScene,validateScene} from '../scene-contract.mjs';

const uuid='scene-asset';
const misplaced=()=>[
  {__type__:'cc.SceneAsset',scene:{__id__:3}},
  {__type__:'cc.Node',_id:'canvas',_parent:{__id__:3},_children:[],_components:[{__id__:2}]},
  {__type__:'cc.Canvas',node:{__id__:1},external:{__uuid__:'keep-external-asset'}},
  {__type__:'cc.Scene',_id:'old-scene-id',_parent:null,_children:[{__id__:1}]},
];

test('scene serialization keeps the asset UUID reserved for Scene across an import round trip',()=>{
  const input=misplaced(),result=serializeScene(input,3,uuid);
  result[1]._id=uuid; // Reapplying asset identity must affect only the Scene.
  validateScene(result,uuid);
  assert.equal(result[2]._id,'canvas');
  assert.equal(result[2]._parent.__id__,1);
  assert.equal(result[2]._components[0].__id__,3);
  assert.equal(result[3].node.__id__,2);
  assert.equal(result[3].external.__uuid__,'keep-external-asset');
  assert.deepEqual(input,misplaced(),'Serialization must not mutate its source');
});

test('audit rejects the original misplaced Scene and child/scene UUID collision',()=>{
  assert.throws(()=>validateScene(misplaced(),uuid),/object 1/);
  const result=serializeScene(misplaced(),3,uuid);
  result[2]._id=uuid;
  assert.throws(()=>validateScene(result,uuid),/UUID/);
});

test('scene hierarchy rejects repeated children, broken parents and disconnected nodes',()=>{
  const result=serializeScene(misplaced(),3,uuid);
  result[1]._children.push({__id__:2});
  assert.throws(()=>validateScene(result,uuid),/cycle or repeated child/);
  result[1]._children.pop();result[2]._parent={__id__:2};
  assert.throws(()=>validateScene(result,uuid),/Non-reciprocal/);
  result[2]._parent={__id__:1};result[1]._children=[];
  assert.throws(()=>validateScene(result,uuid),/disconnected/);
});

test('production Main scene satisfies editor identity and hierarchy contracts',()=>{
  const file=path.join(PROJECT,'assets/scenes/Main.scene');
  const objects=JSON.parse(fs.readFileSync(file)),meta=JSON.parse(fs.readFileSync(file+'.meta'));
  validateScene(objects,meta.uuid);
  const imported=structuredClone(objects);imported[1]._id=meta.uuid;
  validateScene(imported,meta.uuid);
});
