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
const root = path.join(project, 'assets/scripts/features/puzzle');

function runtime(scale = 1, challenge = false) {
    class Events {
        events = new Map();
        on(name, fn, owner) { const list = this.events.get(name) || []; list.push({fn,owner}); this.events.set(name,list); }
        off(name, fn, owner) { this.events.set(name,(this.events.get(name)||[]).filter(e=>e.fn!==fn||e.owner!==owner)); }
        emit(name,...args) { for(const e of [...(this.events.get(name)||[])]) e.fn.apply(e.owner,args); }
        count(name) { return (this.events.get(name)||[]).length; }
    }
    class Component { enabled = true; isValid = true; }
    class Node extends Events {
        static EventType = {TOUCH_START:'start',TOUCH_MOVE:'move',TOUCH_END:'end',TOUCH_CANCEL:'cancel',SIZE_CHANGED:'size'};
        active=true;isValid=true;components=new Map();children=[];position={x:0,y:0,z:0};scale={x:1,y:1,z:1};
        get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
        get parent() {return this._parent;}
        set parent(value) { if(this._parent===value)return; if(this._parent)this._parent.children=this._parent.children.filter(n=>n!==this);this._parent=value;value?.children.push(this); }
        get worldScale() {const p=this.parent?.worldScale||{x:1,y:1};return {x:p.x*this.scale.x,y:p.y*this.scale.y};}
        get worldPosition() {const p=this.parent?.worldPosition||{x:0,y:0},s=this.parent?.worldScale||{x:1,y:1};return {x:p.x+this.position.x*s.x,y:p.y+this.position.y*s.y};}
        setPosition(x,y,z) {this.position=typeof x==='object'?{...x}:{x,y,z};}
        setScale(x,y,z) {this.scale={x,y,z};}
        add(Type) {const c=new Type();c.node=this;this.components.set(Type,c);return c;}
        getComponent(Type) {return this.components.get(Type)||null;}
    }
    class UITransform extends Component {
        width=300;height=300;anchorX=.5;anchorY=.5;
        convertToNodeSpaceAR(p) {const o=this.node.worldPosition,s=this.node.worldScale;return new Vec3((p.x-o.x)/s.x,(p.y-o.y)/s.y,0);}
        convertToWorldSpaceAR(p) {const o=this.node.worldPosition,s=this.node.worldScale;return new Vec3(p.x*s.x+o.x,p.y*s.y+o.y,0);}
    }
    class Vec3 {constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}}
    class Graphics extends Component { paths=[];clear(){this.paths=[];} moveTo(x,y){this.paths.push([x,y]);}lineTo(x,y){this.paths.push([x,y]);}close(){}fill(){}stroke(){} }
    class Color {constructor(...v){this.v=v;}}
    const input=new Events(),game=new Events(),view=new Events();
    const cc={Component,Node,UITransform,Vec3,Graphics,Color,input,game,view,Game:{EVENT_HIDE:'hide'},Input:{EventType:Node.EventType},
        isValid:value=>!!value&&value.isValid!==false,CCString:String,Button:class {},
        _decorator:{ccclass:()=>value=>value,property:(...args)=>args.length>=2?undefined:()=>{}}};
    const cache=new Map();
    function load(filename) {
        filename=path.resolve(filename.endsWith('.ts')?filename:filename+'.ts');if(cache.has(filename))return cache.get(filename).exports;
        const module={exports:{}};cache.set(filename,module);
        const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
        vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(id=>id==='cc'?cc:id.endsWith('/SourceGeometry')?{SourceGeometry:class{}}:id.endsWith('/PresentationItem')?{PresentationItem:class{}}:load(path.resolve(path.dirname(filename),id)),module,module.exports);
        return module.exports;
    }
    const layout=load(path.join(root,'presentation/PuzzleLayout'));
    const {PuzzleSession}=load(path.join(root,'session/PuzzleSession'));
    const {PuzzleBoardPresentation}=load(path.join(root,'presentation/PuzzleBoardPresentation'));
    const {PuzzlePiecePresentation}=load(path.join(root,'presentation/PuzzlePiecePresentation'));
    const {PuzzleController}=load(path.join(root,'controller/PuzzleController'));
    const targetCells=[{q:0,r:0},{q:0,r:1},{q:1,r:0},{q:1,r:1}];
    const level={id:'input',mode:challenge?'challenge':'classic',index:1,mainlineNumber:1,moveLimit:challenge?2:null,targetCells,obstacleCells:[],
        pieces:[{id:'a',textureName:'red',cells:[{q:0,r:0},{q:0,r:1}],targetCells:targetCells.slice(0,2)},
            {id:'b',textureName:'blue',cells:[{q:0,r:0},{q:0,r:1}],targetCells:targetCells.slice(2)}]};
    const canvas=new Node();canvas.setScale(scale,scale,1);canvas.setPosition(200,300,0);
    function node(parent=canvas,x=0,y=0) {const n=new Node();n.parent=parent;n.setPosition(x,y,0);n.add(UITransform);return n;}
    const page=node(),board=page.add(PuzzleBoardPresentation);
    board.boardMount=node(page);board.piecesMount=node(page,0,-230);board.liveRoot=page;
    board.level=level;board.levelId=level.id;board.boardFit=layout.fitCells(targetCells,300,300,30);board.trayFit=layout.fitTray(level.pieces,300,100,12,8);
    const p=layout.axialPoint(targetCells[0],board.boardFit.radius);board.boardOffset={x:board.boardFit.centers[0].x-p.x,y:board.boardFit.centers[0].y-p.y};
    board.pieces=level.pieces.map((definition,i)=>{const n=node(board.piecesMount),item=n.add(PuzzlePiecePresentation);item.pieceId=definition.id;item.cells=definition.cells;item.radius=board.trayFit.radius;item.touchArea=n.getComponent(UITransform);return {node:n,item};});
    board.remainingLabel={string:''};board.totalCellsLabel={string:''};
    const controller=page.add(PuzzleController);controller.board=board;controller.dragRoot=node(page);controller.previewRoot=node(page);controller.previewGraphics=controller.previewRoot.add(Graphics);
    const session=new PuzzleSession(level,'attempt-1');controller.bind(session);
    const world=(n,p)=>n.getComponent(UITransform).convertToWorldSpaceAR(p);
    const piecePoint=(id,i=0)=>{const entry=board.pieceEntries().find(e=>e.item.pieceId===id);return world(entry.node,layout.centeredCells(entry.item.cells,entry.item.radius).centers[i]);};
    const target=(q,r)=>world(board.boardMount,board.pointOfCell({q,r}));
    function emit(phase,point,pointerId=1){input.emit(phase,{getID:()=>pointerId,getUILocation:()=>point});}
    const dragTo=(id,q,r)=>{emit('start',piecePoint(id));emit('move',target(q,r));emit('end',target(q,r));};
    return {...layout,...cc,board,controller,session,level,world,piecePoint,target,emit,dragTo};
}

test('hex picking rejects empty bounding corners and cube rounding is symmetric at negative coordinates',()=>{
    const r=runtime(),piece=r.board.pieceEntries()[0].item;
    assert.equal(piece.containsLocal({x:piece.radius*.95,y:Math.sqrt(3)*piece.radius*.95}),false);
    const centers=r.centeredCells(piece.cells,piece.radius).centers;
    assert.ok(centers.every(p=>piece.containsLocal(p)));
    for(let q=-5;q<=5;q++)for(let s=-5;s<=5;s++)assert.deepEqual(r.nearestAxial(r.axialPoint({q,r:s},18),18),{q,r:s});
    r.emit('start',r.world(piece.node,{x:piece.radius*.95,y:Math.sqrt(3)*piece.radius*.95}));
    assert.equal(r.controller.draggingPieceId,null);assert.equal(r.session.snapshot.selectedPieceId,null);
});

test('first-cell grab survives thumbnail scaling, commits only on end, and synchronously projects the snapshot',()=>{
    for(const scale of [.375,.42,.6,1]){
        const r=runtime(scale),start=r.piecePoint('a'),end=r.target(0,0);
        r.emit('start',start);r.emit('move',end);
        assert.equal(r.session.snapshot.moves,0);assert.deepEqual(r.session.snapshot.placements,{});assert.equal(r.controller.previewRoot.active,true);
        const held=r.piecePoint('a');assert.ok(Math.abs(held.x-end.x)<1e-7&&Math.abs(held.y-end.y)<1e-7,'held hex stays under the pointer');
        r.emit('end',end);r.emit('end',end);
        assert.deepEqual(r.session.snapshot.placements.a,{q:0,r:0});assert.equal(r.session.snapshot.moves,1);
        assert.equal(r.board.remainingLabel.string,'1');assert.equal(r.board.totalCellsLabel.string,'2/4');assert.equal(r.controller.previewRoot.active,false);
        assert.equal(r.board.pieceEntries()[0].node.parent,r.board.boardMount);
    }
});

test('overlap and board-interior out-of-shape drops restore both model and original tray pose',()=>{
    const r=runtime();r.dragTo('a',0,0);const before=r.session.snapshot;
    r.dragTo('b',0,0);assert.deepEqual(r.session.snapshot.placements,before.placements);assert.equal(r.session.snapshot.moves,1);
    assert.equal(r.board.pieceEntries()[1].node.parent,r.board.piecesMount);
    r.dragTo('a',0,0);assert.equal(r.session.snapshot.moves,1,'same position does not consume a move');
    const original=r.piecePoint('a');r.emit('start',original);r.emit('move',r.world(r.board.boardMount,{x:130,y:130}));r.emit('end',r.world(r.board.boardMount,{x:130,y:130}));
    assert.equal(r.session.snapshot.moves,1);assert.deepEqual(r.session.snapshot.placements,before.placements);
});

test('an outside drop returns a placed piece once; an unplaced outside drop consumes no moves',()=>{
    const r=runtime(),outside=r.world(r.board.boardMount,{x:500,y:0});
    r.emit('start',r.piecePoint('a'));r.emit('end',outside);assert.equal(r.session.snapshot.moves,0);
    r.dragTo('a',0,0);r.emit('start',r.piecePoint('a'));r.emit('end',outside);r.emit('end',outside);
    assert.equal(r.session.snapshot.moves,2);assert.deepEqual(r.session.snapshot.placements,{});assert.equal(r.board.pieceEntries()[0].node.parent,r.board.piecesMount);
});

test('only the owner pointer may move, finish or cancel a drag; cancellation never places or consumes a move',()=>{
    const r=runtime(),start=r.piecePoint('a'),end=r.target(0,0);r.emit('start',start,7);
    r.emit('start',r.piecePoint('b'),8);r.emit('move',end,8);r.emit('end',end,8);r.emit('cancel',end,8);
    assert.equal(r.controller.draggingPieceId,'a');assert.equal(r.session.snapshot.moves,0);
    r.emit('move',end,7);r.emit('cancel',end,7);r.emit('end',end,7);
    assert.equal(r.controller.draggingPieceId,null);assert.equal(r.session.snapshot.moves,0);assert.deepEqual(r.session.snapshot.placements,{});
});

test('background, resize, suspend and disable cancel temporary visuals with symmetric listener lifetime',()=>{
    for(const event of ['hide','resize','board-size','page-size','suspend','disable']){
        const r=runtime();r.emit('start',r.piecePoint('a'));r.emit('move',r.target(0,0));
        if(event==='hide')r.game.emit('hide');else if(event==='resize')r.view.emit('canvas-resize');else if(event==='board-size')r.board.boardMount.emit('size');else if(event==='page-size')r.controller.node.emit('size');else if(event==='suspend')r.controller.suspend();else r.controller.onDisable();
        r.emit('end',r.target(0,0));assert.equal(r.session.snapshot.moves,0,event);assert.equal(r.controller.draggingPieceId,null,event);
        r.controller.suspend();assert.equal(r.input.count('start'),0);assert.equal(r.game.count('hide'),0);assert.equal(r.view.count('canvas-resize'),0);
        r.controller.resume();r.controller.resume();assert.equal(r.input.count('start'),1);r.dragTo('a',0,0);assert.equal(r.session.snapshot.moves,1);
        r.controller.onDestroy();assert.equal(r.input.count('start'),0);assert.equal(r.game.count('hide'),0);
    }
});

test('outcome emits once for user completion, never on bind; terminal sessions reject further input',()=>{
    const r=runtime(.5,true),outcomes=[];r.controller.onOutcome=value=>outcomes.push(value);
    r.dragTo('a',0,0);r.dragTo('b',1,0);assert.equal(r.session.snapshot.status,'completed');assert.deepEqual(outcomes,['completed']);
    r.controller.onReturnPiece();r.dragTo('a',0,0);assert.equal(r.session.snapshot.moves,2);assert.deepEqual(outcomes,['completed']);
    r.controller.bind(r.session);assert.deepEqual(outcomes,['completed']);assert.equal(r.board.totalCellsLabel.string,'4/4');
});

test('return button uses selected placed piece before latest placement and failure prevents repeated actions',()=>{
    const r=runtime(.5,true),outcomes=[];r.controller.onOutcome=value=>outcomes.push(value);
    r.dragTo('a',0,0);r.controller.onReturnPiece();assert.equal(r.session.snapshot.status,'failed');assert.deepEqual(outcomes,['failed']);
    r.controller.onReturnPiece();assert.equal(r.session.snapshot.moves,2);assert.deepEqual(outcomes,['failed']);
    const normal=runtime();normal.dragTo('a',0,0);normal.emit('start',normal.piecePoint('a'));normal.emit('end',normal.piecePoint('a'));
    assert.equal(normal.session.snapshot.selectedPieceId,'a');normal.controller.onReturnPiece();assert.deepEqual(normal.session.snapshot.placements,{});
});

test('child-first destruction during a drag drops engine references and unregisters global listeners safely',()=>{
    const r=runtime();r.emit('start',r.piecePoint('a'));r.emit('move',r.target(0,0));
    const held=r.board.pieceEntries()[0];held.node.isValid=false;held.item.isValid=false;
    r.board.isValid=false;r.controller.previewRoot.isValid=false;r.controller.previewGraphics.isValid=false;
    assert.doesNotThrow(()=>r.controller.onDestroy());assert.equal(r.controller.snapshot,null);
    assert.equal(r.input.count('move'),0);assert.equal(r.game.count('hide'),0);assert.equal(r.view.count('canvas-resize'),0);
    assert.doesNotThrow(()=>r.controller.onDisable());assert.doesNotThrow(()=>r.controller.onDestroy());
    assert.equal(r.session.snapshot.moves,0);
});

test('UI capture handles touches swallowed before global input and unprojects the injected Canvas camera',()=>{
    const r=runtime(.5),offset={x:67,y:283};
    r.controller.inputCamera={screenToWorld:p=>({x:p.x-offset.x,y:p.y-offset.y})};
    const ui=(phase,world)=>r.controller.node.emit(phase,{getID:()=>11,
        getLocation:()=>({x:world.x+offset.x,y:world.y+offset.y}),getUILocation:()=>({x:-10000,y:-10000})});
    ui('start',r.piecePoint('a'));ui('move',r.target(0,0));ui('end',r.target(0,0));
    assert.equal(r.session.snapshot.moves,1);assert.deepEqual(r.session.snapshot.placements.a,{q:0,r:0});
    r.controller.suspend();assert.equal(r.controller.node.count('start'),0);assert.equal(r.controller.node.count('move'),0);
});
