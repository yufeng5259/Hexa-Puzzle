import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT} from '../io.mjs';
import {scriptType} from '../builder.mjs';
const registry=JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/resources/framework/config/prefab-registry.json')));
const asset=id=>{const record=registry.prefabs.find(p=>p.id===id);return JSON.parse(fs.readFileSync(path.join(PROJECT,record.assetPath)));};
const component=(objects,file)=>objects.filter(o=>o.__type__===scriptType('assets/scripts/features/'+file+'.ts'));

test('whole piece root and typed touch area share the same centered coordinate space',()=>{
  const objects=asset('puzzle-piece'),piece=component(objects,'puzzle/presentation/PuzzlePiecePresentation')[0];
  assert(piece);const root=piece.node.__id__,touch=objects[piece.touchArea.__id__];
  assert.equal(touch.node.__id__,root);assert.equal(touch._anchorPoint.x,.5);assert.equal(touch._anchorPoint.y,.5);
  assert.equal(objects[piece.cellsRoot.__id__]._parent.__id__,root);
  assert.notEqual(piece.cellsRoot.__id__,piece.previewRoot.__id__);
  assert.equal(objects[piece.cellsRoot.__id__]._lpos.x,0);assert.equal(objects[piece.cellsRoot.__id__]._lpos.y,0);
});

test('each real puzzle layout binds its actual counters, templates and an inactive independent live root',()=>{
  for(const id of ['puzzle','puzzle-preview']){
    const objects=asset(id),boards=component(objects,'puzzle/presentation/PuzzleBoardPresentation');
    assert.equal(boards.length,registry.prefabs.find(p=>p.id===id).stateIds.length);
    for(const board of boards){
      assert.equal(objects[board.liveRoot.__id__]._active,false);
      assert.equal(objects[board.remainingLabel.__id__].__type__,'cc.Label');
      assert.equal(objects[objects[board.remainingCaptionLabel.__id__].node.__id__]._name,'剩余标签');
      assert.equal(objects[objects[board.totalCellsLabel.__id__].node.__id__]._name,'轮廓填充进度');
      assert.equal(board.piecePrefab.__uuid__,registry.prefabs.find(p=>p.id==='puzzle-piece').uuid);
      assert.equal(objects[board.boardMount.__id__]._parent.__id__,board.liveRoot.__id__);
      const fixture=new Set(board.fixtureNodes.map(r=>r.__id__));
      const layout=objects.find(o=>o.__type__===scriptType('assets/scripts/features/presentation/CorePresentation.ts')&&o.node.__id__===board.node.__id__);
      for(const mount of layout.itemMounts)assert.equal(fixture.has(mount.__id__),objects[mount.__id__]._name!=='TrayFrame');
      for(const geometry of objects.filter(o=>o.__type__===scriptType('assets/scripts/features/presentation/SourceGeometry.ts')&&objects[o.node.__id__]._parent.__id__===board.node.__id__))assert(fixture.has(geometry.node.__id__));
      for(const node of objects.filter(o=>o.__type__==='cc.Node'&&/^主棋盘_障碍标记/.test(o._name)&&o._parent.__id__===board.node.__id__))assert(fixture.has(objects.indexOf(node)));
    }
  }
});

test('paging uses explicitly bound serialized buttons and stays hidden in artwork fixtures',()=>{
  const objects=asset('mainline-map'),map=component(objects,'mainline/presentation/MainlineMapPresentation')[0];
  assert(map);for(const [field,action]of [['previousButton','map:previous'],['nextButton','map:next']]){
    const button=objects[map[field].__id__];assert.equal(objects[button.node.__id__]._active,false);
    const events=button.clickEvents.map(reference=>reference.__id__===undefined?reference:objects[reference.__id__]);
    assert(events.some(event=>event?.handler==='onAction'&&event.customEventData===action));
  }
  const items=asset('level-node');assert.equal(component(items,'mainline/presentation/MainlineLevelSelection').length,1);
});
