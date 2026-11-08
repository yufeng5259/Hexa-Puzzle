import { _decorator, Canvas, Color, EventTouch, Graphics, isValid, Label, Mask, Node, Sprite, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { BaseView } from '../../framework/ui/BaseView';
import { requireBinding } from '../../framework/components/Binding';
import type { GuideStepRow } from '../config/MetaManager';
import { GuideInput, type GuidePoint, type GuidePolygon, type GuideRegion } from './GuideInput';
import { guidePresentation, type GuidePresentation } from './GuidePresentation';
import { GuideTargetRegistry } from './GuideTargetRegistry';
const { ccclass, property } = _decorator;
export interface GuideBounds { x:number; y:number; width:number; height:number }
/** All geometry is in Canvas-camera world coordinates. point identifies a real cell center. */
export interface GuideTargetDescriptor {
    bounds(): GuideBounds|null;
    polygons?(): readonly GuidePolygon[]|null;
    point?(): GuidePoint|null;
}
export type GuideTarget = Node|GuideTargetDescriptor;
interface Geometry { bounds:GuideBounds; polygons:readonly GuidePolygon[]|null; point:GuidePoint }

@ccclass('GuideOverlayView')
export class GuideOverlayView extends BaseView {
    @property(Mask) public holeMask:Mask|null=null;
    @property(Graphics) public dimmer:Graphics|null=null;
    @property(Graphics) public targetHighlight:Graphics|null=null;
    @property(UIOpacity) public targetOpacity:UIOpacity|null=null;
    @property(Label) public bubbleLabel:Label|null=null;
    @property(Node) public hand:Node|null=null;
    @property(Sprite) public handSprite:Sprite|null=null;
    @property(UIOpacity) public handOpacity:UIOpacity|null=null;
    /** Calibrated normalized image anchor from bottom-left; the hand root is the fingertip. */
    @property public handTipX=.30;
    @property public handTipY=.96;
    private registry:GuideTargetRegistry<GuideTarget>|null=null;
    private inputRoot:Node|null=null;
    private step:GuideStepRow|null=null;
    private elapsed=0;
    private resolver:(key:string)=>string=key=>key;
    private readonly guard=new GuideInput();
    private failed=false;
    private dragging=false;
    private draggingPolygons:(()=>readonly GuidePolygon[]|null)|null=null;
    private layoutSignature='';
    private handTween:Tween<Node>|null=null;
    private fadeTween:Tween<UIOpacity>|null=null;
    private pulseTween:Tween<UIOpacity>|null=null;
    private presentation:GuidePresentation=guidePresentation(null);
    private missingNotified=false;
    public onFailure:((message:string)=>void)|null=null;
    public onTargetsUnavailable:(()=>void)|null=null;
    public allowRecoveryTarget:((node:Node)=>boolean)|null=null;
    public get isDragStepVisible():boolean{return this.step?.action==='drag'&&!this.failed&&this.guard.enabled&&this.node.activeInHierarchy;}
    public get isReadyForInput():boolean{return !!this.step&&!this.failed&&this.node.activeInHierarchy&&(this.step.action==='wait'||this.guard.enabled&&this.guard.regions.length>0);}
    public validateBindings():void {
        super.validateBindings();
        for(const [key,value] of Object.entries({holeMask:this.holeMask,dimmer:this.dimmer,targetHighlight:this.targetHighlight,targetOpacity:this.targetOpacity,bubbleLabel:this.bubbleLabel,hand:this.hand,handSprite:this.handSprite,handOpacity:this.handOpacity}))requireBinding('GuideOverlayView',key,value);
    }
    public configure(registry:GuideTargetRegistry<GuideTarget>,inputRoot:Node,textResolver?:(key:string)=>string):void {
        this.detachInput();this.registry=registry;this.inputRoot=inputRoot;this.resolver=textResolver??(key=>key);
        inputRoot.on(Node.EventType.TOUCH_START,this.onStart,this,true);inputRoot.on(Node.EventType.TOUCH_MOVE,this.onMove,this,true);
        inputRoot.on(Node.EventType.TOUCH_END,this.onEnd,this,true);inputRoot.on(Node.EventType.TOUCH_CANCEL,this.onCancel,this,true);
    }
    public presentStep(step:GuideStepRow):void {
        this.stopPresentation();this.step=step;this.elapsed=0;this.failed=false;this.missingNotified=false;this.dragging=false;this.guard.reset();this.layoutSignature='';
        this.presentation=guidePresentation(step.params.presentation,{handTipX:this.handTipX,handTipY:this.handTipY});
        this.node.active=true;
        this.bubbleLabel!.string=step.textKey?this.resolver(step.textKey):'';this.bubbleLabel!.node.active=!!step.textKey;
        this.bubbleLabel!.node.setPosition(this.presentation.instructionX,this.presentation.instructionY,0);
        const imageUI=this.handSprite!.node.getComponent(UITransform)!;
        imageUI.setContentSize(this.presentation.handWidth,this.presentation.handHeight);
        imageUI.setAnchorPoint(this.presentation.handTipX,this.presentation.handTipY);
        this.handSprite!.node.setPosition(0,0,0);
        this.refresh();
    }
    public clearGuide():void {
        this.stopPresentation();this.step=null;this.guard.reset();this.layoutSignature='';this.dragging=false;this.draggingPolygons=null;
        this.holeMask!.node.active=false;this.targetHighlight!.node.active=false;this.hand!.active=false;this.bubbleLabel!.node.active=false;
    }
    /** Driven only by the player's real controller gesture, not the hand animation. */
    public setDragging(dragging:boolean,polygons:(()=>readonly GuidePolygon[]|null)|null=null):void {
        if(this.dragging===dragging)return;
        this.dragging=dragging;this.draggingPolygons=dragging?polygons:null;this.stopHand();this.hand!.active=false;
        if(!dragging&&this.step&&!this.failed&&this.node.activeInHierarchy){this.layoutSignature='';this.refresh();}
    }
    public acceptsPointerStart(x:number,y:number,_pointerId?:number):boolean{return this.guard.canStart({x,y});}
    public allowsPointer(phase:'start'|'move'|'end'|'cancel',id:number,x:number,y:number):boolean{return this.guard.accepts(phase,id,{x,y});}
    public update(dt:number):void {
        if(!this.step||!this.node.activeInHierarchy||this.failed)return;
        this.elapsed+=dt;
        if(this.step.skippable&&this.step.timeoutSeconds>0&&this.elapsed>this.step.timeoutSeconds){this.fail('Guide step timed out: '+this.step.id);return;}
        this.refresh();
    }
    protected onShown():void{if(this.step){this.layoutSignature='';this.refresh();}}
    protected onHidden():void{this.guard.reset();this.stopPresentation();this.layoutSignature='';}
    protected onClosed():void{this.stopPresentation();this.detachInput();this.registry=null;this.step=null;this.onFailure=null;this.onTargetsUnavailable=null;this.allowRecoveryTarget=null;}
    private refresh():void {
        const step=this.step;if(!step||!this.registry)return;
        const sourceId=typeof step.params.dragSourceTargetId==='string'?step.params.dragSourceTargetId:step.targetId;
        const destinationId=typeof step.params.dragDestinationTargetId==='string'?step.params.dragDestinationTargetId:null;
        const ids=[...new Set([sourceId,destinationId].filter((id):id is string=>!!id))];
        const geometries=ids.map(id=>this.geometry(this.registry!.resolve(id)));
        if(geometries.some(value=>!value)){
            this.dragging=false;this.draggingPolygons=null;this.onTargetsUnavailable?.();
            if(this.elapsed>2&&!this.missingNotified){this.missingNotified=true;this.onFailure?.('Guide target is not ready: '+step.id);}
            this.blockUntilReady();this.stopPresentation();this.holeMask!.node.active=false;this.targetHighlight!.node.active=false;this.hand!.active=false;this.layoutSignature='';return;
        }
        const all=geometries as Geometry[],source=all[0],destination=destinationId?all[ids.indexOf(destinationId)]:source;
        const regions=all.map(item=>this.region(item.bounds,step));
        this.guard.enabled=step.action!=='wait';this.guard.action=step.action;
        // A destination is visible but never an eligible drag start.
        this.guard.regions=step.action==='drag'?regions.slice(0,1):regions;
        this.guard.sourcePolygons=step.action==='drag'?(source?.polygons??null):null;
        const moving=this.dragging?this.draggingPolygons?.()??null:null;
        const signature=JSON.stringify({id:step.id,regions,polygons:all.map(item=>item.polygons),points:all.map(item=>item.point),moving});
        if(signature===this.layoutSignature)return;
        this.layoutSignature=signature;
        this.draw(all,regions,step,moving);
        if(this.failed)return;
        if(!this.dragging&&source&&step.action!=='wait')this.animateHand(source.point,destination?.point??source.point,step.action==='drag');
        else{this.stopHand();this.hand!.active=false;}
    }
    private draw(all:Geometry[],regions:GuideRegion[],step:GuideStepRow,moving:readonly GuidePolygon[]|null):void {
        const mask=this.holeMask!,stencil=mask.node.getComponent(Graphics);
        if(!stencil){this.fail('Guide mask requires serialized Graphics');return;}
        mask.node.active=step.shape!=='none';stencil.clear();stencil.fillColor=Color.WHITE;
        all.forEach((item,i)=>this.path(stencil,item.polygons,regions[i]));
        // The player's actual piece stays fully visible while its exact hex outline travels through the dimmer.
        if(moving?.length&&regions.length)this.path(stencil,moving,regions[0]);
        stencil.fill();
        const size=this.node.getComponent(UITransform)!.contentSize,g=this.dimmer!;
        g.clear();g.fillColor=new Color(8,32,42,165);g.rect(-size.width/2,-size.height/2,size.width,size.height);g.fill();
        const highlight=this.targetHighlight!,index=step.action==='drag'&&all.length>1?all.length-1:0;
        // Puzzle targets are drawn by the board's existing placement preview below its pieces.
        highlight.clear();highlight.node.active=all.length>0&&step.action!=='wait'&&step.params.highlightProvider!=='puzzlePlacementPreview';
        if(highlight.node.active){
            highlight.fillColor=new Color(92,255,221,60);highlight.strokeColor=new Color(195,255,233,255);highlight.lineWidth=6;
            this.path(highlight,all[index].polygons,regions[index]);highlight.fill();highlight.stroke();
            if(!this.pulseTween){
                const p=this.presentation;this.targetOpacity!.opacity=p.pulseMinOpacity;
                this.pulseTween=tween(this.targetOpacity!).to(p.pulseDuration/2,{opacity:p.pulseMaxOpacity},{easing:'sineInOut'}).to(p.pulseDuration/2,{opacity:p.pulseMinOpacity},{easing:'sineInOut'}).union().repeatForever().start();
            }
        }
    }
    private path(graphics:Graphics,polygons:readonly GuidePolygon[]|null,region:GuideRegion):void {
        const ui=graphics.node.getComponent(UITransform)!;
        if(polygons?.length){
            for(const polygon of polygons){polygon.forEach((point,i)=>{const p=ui.convertToNodeSpaceAR(new Vec3(point.x,point.y,0));if(i===0)graphics.moveTo(p.x,p.y);else graphics.lineTo(p.x,p.y);});graphics.close();}
            return;
        }
        const c=ui.convertToNodeSpaceAR(new Vec3(region.x,region.y,0)),scale=Math.abs(graphics.node.worldScale.x)||1;
        const w=region.width/scale,h=region.height/scale,r=(region.radius??20)/scale;
        if(region.shape==='circle')graphics.circle(c.x,c.y,r);
        else if(region.shape==='roundRect')graphics.roundRect(c.x-w/2,c.y-h/2,w,h,Math.min(r,w/2,h/2));
        else graphics.rect(c.x-w/2,c.y-h/2,w,h);
    }
    private animateHand(source:GuidePoint,destination:GuidePoint,drag:boolean):void {
        this.stopHand();const hand=this.hand!,opacity=this.handOpacity!,p=this.presentation,ui=this.node.getComponent(UITransform)!;
        const start=ui.convertToNodeSpaceAR(new Vec3(source.x,source.y,0)),end=ui.convertToNodeSpaceAR(new Vec3(destination.x,destination.y,0));
        start.x+=this.step!.handOffsetX;start.y+=this.step!.handOffsetY;end.x+=this.step!.handOffsetX;end.y+=this.step!.handOffsetY;
        hand.active=true;
        this.handTween=tween(hand).call(()=>{hand.setPosition(start);hand.setScale(1,1,1);opacity.opacity=255;}).delay(p.sourceHold)
            .to(p.pressDuration,{scale:new Vec3(.90,.90,1)},{easing:'sineInOut'})
            .to(drag?p.dragDuration:p.pressDuration,{position:drag?end:start,scale:new Vec3(drag ? .90 : 1,drag ? .90 : 1,1)},{easing:'sineInOut'})
            .delay(p.destinationHold).call(()=>{this.fadeTween=tween(opacity).to(p.fadeDuration,{opacity:0}).start();})
            .delay(p.fadeDuration+p.loopDelay).union().repeatForever().start();
    }
    private stopHand():void{this.handTween?.stop();this.handTween=null;this.fadeTween?.stop();this.fadeTween=null;}
    private stopPresentation():void{this.stopHand();this.pulseTween?.stop();this.pulseTween=null;}
    private geometry(target:GuideTarget|null):Geometry|null {
        if(!target)return null;
        if('bounds'in target){const bounds=target.bounds();if(!bounds)return null;return{bounds,polygons:target.polygons?.()??null,point:target.point?.()??{x:bounds.x,y:bounds.y}};}
        if(!isValid(target,true)||!target.activeInHierarchy)return null;
        const rect=target.getComponent(UITransform)?.getBoundingBoxToWorld();if(!rect)return null;
        const bounds={x:rect.x+rect.width/2,y:rect.y+rect.height/2,width:rect.width,height:rect.height};return{bounds,polygons:null,point:{x:bounds.x,y:bounds.y}};
    }
    private region(bounds:GuideBounds,step:GuideStepRow):GuideRegion {
        const scale=Math.abs(this.node.worldScale.x)||1,width=(step.width??bounds.width/scale)*scale+2*step.padding*scale,height=(step.height??bounds.height/scale)*scale+2*step.padding*scale;
        return{x:bounds.x+step.offsetX*scale,y:bounds.y+step.offsetY*scale,width,height,shape:step.shape==='none'?'rect':step.shape,radius:step.shape==='circle'?(step.radius?step.radius*scale+step.padding*scale:Math.max(width,height)/2):(step.radius??20)*scale};
    }
    private blockUntilReady():void{this.guard.reset();if(this.step&&!this.step.skippable){this.guard.enabled=true;this.guard.action='wait';}}
    private fail(message:string):void{this.failed=true;this.blockUntilReady();this.stopPresentation();this.holeMask!.node.active=false;this.targetHighlight!.node.active=false;this.hand!.active=false;this.bubbleLabel!.node.active=false;this.onFailure?.(message);}
    private filter(event:EventTouch,phase:'start'|'move'|'end'|'cancel'):void {
        if(event.target instanceof Node&&this.allowRecoveryTarget?.(event.target))return;
        const camera=this.inputRoot?.getComponent(Canvas)?.cameraComponent,screen=event.getLocation();
        const p=camera?camera.screenToWorld(new Vec3(screen.x,screen.y,0)):event.getUILocation();
        if(!this.allowsPointer(phase,event.getID(),p.x,p.y)){event.propagationStopped=true;event.propagationImmediateStopped=true;}
    }
    private onStart(event:EventTouch):void{this.filter(event,'start');}
    private onMove(event:EventTouch):void{this.filter(event,'move');}
    private onEnd(event:EventTouch):void{this.filter(event,'end');}
    private onCancel(event:EventTouch):void{this.filter(event,'cancel');}
    private detachInput():void {
        if(this.inputRoot&&isValid(this.inputRoot,true)){
            this.inputRoot.off(Node.EventType.TOUCH_START,this.onStart,this,true);this.inputRoot.off(Node.EventType.TOUCH_MOVE,this.onMove,this,true);
            this.inputRoot.off(Node.EventType.TOUCH_END,this.onEnd,this,true);this.inputRoot.off(Node.EventType.TOUCH_CANCEL,this.onCancel,this,true);
        }
        this.inputRoot=null;this.guard.reset();this.stopPresentation();
    }
}
