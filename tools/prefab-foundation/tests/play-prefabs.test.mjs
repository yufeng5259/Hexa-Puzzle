import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT} from '../io.mjs';
import {scriptType} from '../builder.mjs';
const registry=JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/resources/framework/config/prefab-registry.json')));
const asset=id=>JSON.parse(fs.readFileSync(path.join(PROJECT,registry.prefabs.find(p=>p.id===id).assetPath)));
const type=file=>scriptType('assets/scripts/features/puzzle/'+file+'.ts');

test('all playable variants serialize their controller and matching preview/drag coordinate layers',()=>{
  const objects=asset('puzzle'),controllers=objects.filter(o=>o.__type__===type('controller/PuzzleController'));
  assert.equal(controllers.length,registry.prefabs.find(p=>p.id==='puzzle').stateIds.length);
  for(const controller of controllers){
    const board=objects[controller.board.__id__];
    assert.equal(board.__type__,type('presentation/PuzzleBoardPresentation'));
    assert.equal(board.node.__id__,controller.node.__id__);
    const boardNode=objects[board.boardMount.__id__],live=objects[board.liveRoot.__id__];
    for(const field of ['previewRoot','dragRoot']){
      const node=objects[controller[field].__id__];
      assert.equal(node._parent.__id__,board.liveRoot.__id__);
      assert.deepEqual(node._lpos,boardNode._lpos);
      const ui=id=>objects[objects[id]._components.find(r=>objects[r.__id__].__type__==='cc.UITransform').__id__];
      assert.deepEqual(ui(controller[field].__id__)._contentSize,ui(board.boardMount.__id__)._contentSize);
    }
    assert.equal(objects[controller.previewGraphics.__id__].__type__,'cc.Graphics');
    assert.equal(objects[controller.previewGraphics.__id__].node.__id__,controller.previewRoot.__id__);
    const order=live._children.map(r=>r.__id__);
    assert(order.indexOf(controller.dragRoot.__id__)>order.indexOf(controller.previewRoot.__id__));
  }
  assert.equal(asset('puzzle-preview').filter(o=>o.__type__===type('controller/PuzzleController')).length,0);
});

test('play status uses real typed text slots and disables only bound unavailable product actions',()=>{
  for(const id of ['puzzle','puzzle-preview','puzzle-result','challenge-result','challenge-fail','pause','confirmation','settings']){
    const objects=asset(id),statuses=objects.filter(o=>o.__type__===type('presentation/PlayStatusPresentation'));
    assert(statuses.length>0,id);
    for(const status of statuses){
      assert.equal(status.labels.length,status.keys.length);
      for(const ref of status.labels)assert.equal(objects[ref.__id__].__type__,'cc.Label');
      for(const ref of status.unavailableButtons)assert.equal(objects[ref.__id__].__type__,'cc.Button');
      if(['puzzle-result','challenge-result'].includes(id)){
        assert(status.keys.includes('resultMessage'));assert(status.keys.includes('amount'));assert(status.keys.includes('level'));
        assert(status.unavailableButtons.length>0);
      }
      if(id==='confirmation')assert(status.keys.includes('exitMessage')||status.keys.includes('restartMessage'));
    }
  }
});

test('actual challenge retry and next controls retain explicit serialized action handlers',()=>{
  for(const [id,action]of [['challenge-fail','play:retry'],['challenge-result','play:next'],['puzzle-result','play:next']]){
    const objects=asset(id),buttons=objects.filter(o=>o.__type__==='cc.Button');
    assert(buttons.some(b=>b.clickEvents.some(e=>e.handler==='onAction'&&e.customEventData===action)),id);
  }
});
