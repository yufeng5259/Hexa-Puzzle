import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'G:/cocosCreator/Editor/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript/lib/typescript.js');
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = path.join(project, 'assets/scripts/features/puzzle/presentation');
function runtime() {
    class Component { enabled = true; destroyed = false; get isValid() { return !this.destroyed && this.node?.isValid !== false; } }
    class Node {
        static EventType = { TOUCH_START: 'start', TOUCH_MOVE: 'move', TOUCH_END: 'end', TOUCH_CANCEL: 'cancel' };
        active = true; isValid = true; destroyCalls = 0; children = []; components = new Map(); position = { x: 0, y: 0 }; events = new Map();
        get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
        get parent() { return this._parent; }
        set parent(value) { this._parent = value; value?.children.push(this); }
        setPosition(x,y,z) { this.position = { x,y,z }; }
        add(Type) { const component = new Type(); component.node = this; this.components.set(Type,component); return component; }
        getComponent(Type) { return this.components.get(Type) || null; }
        destroy() {
            this.destroyCalls++; if (!this.isValid) throw new Error('destroy called twice'); this.isValid = false;
            // Creator tears down descendant components before the owning page component.
            this.children.forEach(child => { if (child.isValid) child.destroy(); });
            this.components.forEach(component => { component.onDestroy?.(); component.destroyed = true; });
        }
        on(name, callback, owner) { const entries = this.events.get(name) || []; entries.push({ callback,owner }); this.events.set(name,entries); }
        off(name, callback, owner) { this.events.set(name,(this.events.get(name) || []).filter(entry => entry.callback !== callback || entry.owner !== owner)); }
        emit(name, value) { (this.events.get(name) || []).forEach(entry => entry.callback.call(entry.owner,value)); }
    }
    class UITransform extends Component { width = 100; height = 100; setContentSize(width,height) { this.width=width; this.height=height; } }
    class Label extends Component { string = ''; }
    class Prefab { constructor(create) { this.create=create; } }
    // Controlled resource-consuming child port. Its real implementation has its own async tests.
    class PresentationItem extends Component {
        revision=0; value=null; body={grayscale:false};
        async present(scope,data) { const rev=++this.revision; await scope.load(data.bodyAssetId); if(rev===this.revision && !scope.isReleased && this.node.isValid) this.value=data; }
        cancelPending() { this.revision++; }
        onDestroy() { this.cancelPending(); }
    }
    class SourceGeometry extends Component { spec=''; renders=0; render() { this.renders++; } }
    let instances=0;
    const cc={ Component,Node,UITransform,Label,Prefab,CCString:String,isValid: value=>value && value.isValid!==false,
        instantiate: prefab=>{ instances++; return prefab.create(); },
        _decorator:{ccclass:()=>value=>value,property:(...args)=>args.length>=2?undefined:()=>{}} };
    const cache=new Map();
    function load(filename) {
        filename=path.resolve(filename.endsWith('.ts')?filename:filename+'.ts');
        if(cache.has(filename)) return cache.get(filename).exports;
        const module={exports:{}}; cache.set(filename,module);
        const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
        vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(id=>id==='cc'?cc:id.endsWith('/PresentationItem')?{PresentationItem}:id.endsWith('/SourceGeometry')?{SourceGeometry}:load(path.resolve(path.dirname(filename),id)),module,module.exports);
        return module.exports;
    }
    const layout=load(path.join(source,'PuzzleLayout'));
    const {PuzzlePiecePresentation}=load(path.join(source,'PuzzlePiecePresentation'));
    const {PuzzleBoardPresentation}=load(path.join(source,'PuzzleBoardPresentation'));
    const cellPrefab=new Prefab(()=>{const node=new Node();node.add(PresentationItem);node.add(UITransform);return node;});
    const piecePrefab=new Prefab(()=>{const node=new Node(),item=node.add(PuzzlePiecePresentation);item.previewRoot=new Node();item.previewRoot.parent=node;item.cellsRoot=new Node();item.cellsRoot.parent=node;item.cellPrefab=cellPrefab;item.touchArea=node.add(UITransform);return node;});
    function board() {
        const node=new Node(),item=node.add(PuzzleBoardPresentation);
        item.liveRoot=new Node();item.liveRoot.parent=node;item.liveRoot.active=false;item.fixtureNodes=[new Node()];item.fixtureNodes[0].parent=node;
        item.boardMount=new Node();item.boardMount.parent=node;item.boardMount.add(UITransform).setContentSize(703,705);
        item.piecesMount=new Node();item.piecesMount.parent=node;item.piecesMount.add(UITransform).setContentSize(780,280);
        item.cellPrefab=cellPrefab;item.piecePrefab=piecePrefab;
        item.boardFloor=new Node().add(SourceGeometry);item.boardFloor.node.add(UITransform);
        item.boardRim=new Node().add(SourceGeometry);item.boardRim.node.add(UITransform);
        item.boardShadow=new Node().add(SourceGeometry);item.boardShadow.node.add(UITransform);
        item.wellAssetId='well';item.obstacleAssetId='obstacle';item.textureAssetIds=JSON.stringify({red:'red',blue:'blue'});
        item.remainingLabel=new Node().add(Label);item.levelLabel=new Node().add(Label);
        item.remainingCaptionLabel=new Node().add(Label);item.totalCellsLabel=new Node().add(Label);
        return item;
    }
    const scope={isReleased:false,releases:0,load:async id=>id,release(){this.releases++;this.isReleased=true;}};
    return {...cc,...layout,PresentationItem,PuzzlePiecePresentation,PuzzleBoardPresentation,board,piecePrefab,scope,get instances(){return instances;}};
}
const level = (id='one',count=3) => ({id,mode:'classic',index:1,mainlineNumber:1,moveLimit:null,
    targetCells:[{q:0,r:0},{q:1,r:0},{q:1,r:1}],obstacleCells:[{q:0,r:1}],
    pieces:Array.from({length:count},(_,i)=>({id:`${id}-${i}`,textureName:i%2?'red':'blue',cells:[{q:0,r:0},{q:1,r:0}],targetCells:[]}))});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};

test('flat-top display coordinates invert consistently for negative and positive axial cells',()=>{
    const r=runtime();
    for(const q of [-6,-1,0,1,6])for(const s of [-4,0,4]){
        const p=r.axialPoint({q,r:s},27),a=r.axialFromPoint(p,27);near(a.x,q);near(a.y,s);
    }
    assert.throws(()=>r.fitCells([{q:0,r:0},{q:0,r:0}],100,100),/unique/);
    assert.throws(()=>r.fitTray(level().pieces,1,1),/bounds/);
});
test('every catalog board and complete piece fits its assigned bounds across four screen sizes',()=>{
    const r=runtime(),catalog=JSON.parse(fs.readFileSync(path.join(project,'assets/bundles/puzzle/config/level-catalog.json'),'utf8'));
    assert.equal(catalog.levels.length,110);
    const counts=new Set();
    for(const question of catalog.levels){
        counts.add(question.pieces.length);
        for(const [width,height] of [[390,844],[320,568],[414,896],[768,1024]]){
            const boardWidth=width*.82,boardHeight=height*.44,trayWidth=width*.91,trayHeight=height*.17;
            const fit=r.fitCells([...question.targetCells,...question.obstacleCells],boardWidth,boardHeight,12);
            fit.centers.forEach(p=>{assert.ok(Math.abs(p.x)+fit.radius<=boardWidth/2+1e-7);assert.ok(Math.abs(p.y)+Math.sqrt(3)*fit.radius/2<=boardHeight/2+1e-7);});
            const tray=r.fitTray(question.pieces,trayWidth,trayHeight,4,3);
            tray.pieces.forEach(piece=>piece.centers.forEach(p=>{
                assert.ok(Math.abs(piece.position.x+p.x)+tray.radius<=trayWidth/2+1e-7);
                assert.ok(Math.abs(piece.position.y+p.y)+Math.sqrt(3)*tray.radius/2<=trayHeight/2+1e-7);
            }));
        }
    }
    for(const count of [3,4,6,7])assert.ok(counts.has(count),`missing source piece count ${count}`);
});
test('wood boundary and cell centers use the same fit after source-screen Y projection',()=>{
    const r=runtime(),filename=path.join(project,'assets/scripts/features/presentation/SourceGeometry.ts'),module={exports:{}};
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
    const cc={...r,_decorator:{ccclass:()=>c=>c,executionOrder:()=>c=>c,property:()=>()=>{}}};
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(()=>cc,module,module.exports);
    const catalog=JSON.parse(fs.readFileSync(path.join(project,'assets/bundles/puzzle/config/level-catalog.json'),'utf8'));
    for(const level of catalog.levels){
        const cells=[...level.targetCells,...level.obstacleCells],fit=r.fitCells(cells,703,705,32);
        const geometry=module.exports.fitSourceHex(cells.map(cell=>[cell.q,cell.r]),[0,0,703,705],32,true);
        near(fit.radius,geometry.radius);
        fit.centers.forEach((p,i)=>{near(p.x,geometry.centers[i].center[0]-703/2);near(p.y,705/2-geometry.centers[i].center[1]);});
    }
});
test('board uses distinct well/obstacle cells, one root per piece, and consistent geometric shape',async()=>{
    const r=runtime(),board=r.board(),data=level();await board.present(r.scope,data);
    assert.equal(board.levelId,'one');assert.equal(board.piecesMount.children.length,3);
    assert.deepEqual(board.boardMount.children.map(n=>n.getComponent(r.PresentationItem).value.bodyAssetId),['well','well','well','obstacle']);
    for(const node of board.piecesMount.children){const piece=node.getComponent(r.PuzzlePiecePresentation);assert.equal(piece.cells.length,2);assert.equal(piece.cellsRoot.children.length,2);assert.equal(piece.previewRoot.active,false);}
    assert.equal(board.remainingLabel.string,'3');assert.equal(board.levelLabel.string,'第 1 关');
    assert.equal(board.remainingCaptionLabel.string,'剩余拼块');assert.equal(board.totalCellsLabel.string,'0/3');
    const spec=JSON.parse(board.boardFloor.spec);assert.equal(spec.cells.length,4);assert.equal(spec.flip_y,true);
    assert.equal(board.boardRim.renders,1);assert.equal(r.scope.releases,0);
});
test('challenge labels and dedicated obstacle art reset when the same root becomes a target',async()=>{
    const r=runtime(),board=r.board(),data={...level('challenge'),mode:'challenge',moveLimit:7};
    await board.present(r.scope,data);
    assert.equal(board.remainingCaptionLabel.string,'剩余步数');assert.equal(board.remainingLabel.string,'7');
    const last=board.boardMount.children[3],item=last.getComponent(r.PresentationItem);assert.equal(item.body.grayscale,false);assert.equal(item.value.bodyAssetId,'obstacle');
    assert.ok(board.boardMount.children.slice(0,3).every(node=>!node.getComponent(r.PresentationItem).body.grayscale));
    await board.present(r.scope,{...level('normal'),targetCells:[...data.targetCells,...data.obstacleCells],obstacleCells:[]});
    assert.equal(board.boardMount.children[3],last);assert.equal(item.body.grayscale,false);assert.equal(item.value.bodyAssetId,'well');
    assert.equal(board.totalCellsLabel.string,'0/4');assert.equal(board.remainingCaptionLabel.string,'剩余拼块');assert.equal(board.remainingLabel.string,'3');
});
test('repeat/shorter/longer levels reuse roots and hide surplus without retaining piece identities',async()=>{
    const r=runtime(),board=r.board();await board.present(r.scope,level('seven',7));
    const roots=[...board.piecesMount.children],instances=r.instances;
    await board.present(r.scope,level('three',3));assert.equal(r.instances,instances);
    assert.equal(roots.filter(n=>n.active).length,3);assert.equal(roots[6].getComponent(r.PuzzlePiecePresentation).pieceId,'');
    await board.present(r.scope,level('again',7));assert.equal(r.instances,instances);assert.equal(roots[6].getComponent(r.PuzzlePiecePresentation).pieceId,'again-6');
    board.node.destroy();assert.ok(roots.every(n=>!n.isValid));assert.equal(r.scope.releases,0);
});
test('late old question cannot overwrite a newly completed question',async()=>{
    const r=runtime(),board=r.board(),late=deferred();r.scope.load=()=>late.promise;
    const first=board.present(r.scope,level('old'));r.scope.load=async id=>id;
    await board.present(r.scope,level('new',4));late.resolve('old');await first;
    assert.equal(board.levelId,'new');assert.equal(board.remainingLabel.string,'4');
    assert.equal(board.piecesMount.children[0].getComponent(r.PuzzlePiecePresentation).pieceId,'new-0');
});
test('hide and destroy cancel pending resource writes and never release the borrowed scope',async()=>{
    for(const operation of ['onDisable','onDestroy']){
        const r=runtime(),board=r.board(),late=deferred();r.scope.load=()=>late.promise;
        const pending=board.present(r.scope,level());board[operation]();late.resolve('late');await pending;
        assert.equal(board.levelId,'');assert.equal(board.boardFloor.renders,0);assert.equal(r.scope.releases,0);
    }
});
test('child-first Creator teardown tolerates cleared child fields without cancellation calls or double destruction',async()=>{
    const r=runtime(),board=r.board();await board.present(r.scope,level());
    const roots=[...board.piecesMount.children];
    for(const node of roots){
        const piece=node.getComponent(r.PuzzlePiecePresentation);
        node.destroy();
        // Immediate destruction clears object fields; stale parent entries still point at the component.
        piece.items=null;piece.cellsRoot=null;piece.touchArea=null;piece.cells=null;
        assert.doesNotThrow(()=>piece.cancelPending());assert.doesNotThrow(()=>piece.onDisable());
        piece.cancelPending=()=>{throw new Error('parent called a destroyed child component');};
    }
    assert.doesNotThrow(()=>board.cancelPending());assert.doesNotThrow(()=>board.node.destroy());
    assert.ok(roots.every(node=>node.destroyCalls===1));
    board.cells=null;board.pieces=null;board.boardFloor=null;board.boardRim=null;board.boardShadow=null;
    assert.doesNotThrow(()=>board.cancelPending());assert.doesNotThrow(()=>board.clear());assert.doesNotThrow(()=>board.onDisable());assert.doesNotThrow(()=>board.onDestroy());
    assert.equal(r.scope.releases,0);
});
test('missing typed bindings and missing color mapping fail explicitly; failed loading clears owned instances',async()=>{
    const r=runtime(),board=r.board();board.piecePrefab=null;await assert.rejects(board.present(r.scope,level()),/piecePrefab/);
    board.piecePrefab=r.piecePrefab;board.textureAssetIds='{}';await assert.rejects(board.present(r.scope,level()),/textureName/);
    board.textureAssetIds='{"red":"red","blue":"blue"}';r.scope.load=async()=>{throw new Error('offline');};
    await assert.rejects(board.present(r.scope,level()),/offline/);
    assert.ok(board.boardMount.children.every(n=>!n.active));assert.ok(board.piecesMount.children.every(n=>!n.active));assert.equal(board.boardFloor.node.active,false);
    r.scope.load=async id=>id;await board.present(r.scope,level('retry'));assert.equal(board.levelId,'retry');
});
test('piece input remains an intent port and listeners unsubscribe symmetrically',async()=>{
    const r=runtime(),node=r.piecePrefab.create(),piece=node.getComponent(r.PuzzlePiecePresentation),events=[];
    node.on('puzzle-piece-input',payload=>events.push(payload));piece.onEnable();
    await piece.present(r.scope,{piece:level().pieces[0],radius:20,assetId:'red'});
    const position={...node.position};node.emit('start');node.emit('end');assert.deepEqual(events.map(e=>e.phase),['start','end']);assert.deepEqual(node.position,position);
    piece.onDisable();node.emit('start');assert.equal(events.length,2);piece.onEnable();node.emit('start');assert.equal(events.length,3);
});
