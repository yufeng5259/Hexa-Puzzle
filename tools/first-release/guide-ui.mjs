import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, ref, scriptType, color } from '../prefab-foundation/builder.mjs';
import { PROJECT, directory, stableUuid, writeFile, writeOnceStableMeta } from '../prefab-foundation/io.mjs';

const base = 'assets/scripts/features/guide';
const metaIdentity = file => fs.existsSync(path.join(PROJECT,file+'.meta')) ? JSON.parse(fs.readFileSync(path.join(PROJECT,file+'.meta'),'utf8')).uuid : stableUuid(file);
export const GUIDE_PREFAB = 'assets/resources/first-release/prefabs/GuideOverlay.prefab';
export function generateGuidePrefab() {
    directory(base);
    for (const name of fs.readdirSync(path.join(PROJECT, base)).filter(name => name.endsWith('.ts'))) {
        const file = `${base}/${name}`;
        writeOnceStableMeta(path.join(PROJECT,file), { ver:'4.0.24', importer:'typescript', imported:true, uuid:metaIdentity(file), files:[], subMetas:{}, userData:{} });
    }
    directory('assets/resources/first-release/prefabs');
    const b = new Builder('GuideOverlay');
    const holes = b.node('SpotlightStencil',b.root,{width:853,height:1844});
    const mask = b.component(holes,'cc.Mask',{_type:2,_inverted:true,_segments:64});
    b.component(holes,'cc.Graphics',{_lineWidth:1,_strokeColor:color(),_fillColor:color(),_lineJoin:0,_lineCap:0,_miterLimit:10});
    const dim = b.node('Dimmer',holes,{width:853,height:1844});
    const dimmer=b.component(dim,'cc.Graphics',{_lineWidth:1,_strokeColor:color(),_fillColor:color([8,32,42],165),_lineJoin:0,_lineCap:0,_miterLimit:10});
    const highlight=b.node('TargetHighlight',b.root,{width:853,height:1844});
    const targetHighlight=b.component(highlight,'cc.Graphics',{_lineWidth:6,_strokeColor:color([195,255,233]),_fillColor:color([92,255,221],60),_lineJoin:1,_lineCap:0,_miterLimit:10});
    const targetOpacity=b.component(highlight,'cc.UIOpacity',{_opacity:70});
    const bubble=b.node('Instruction',b.root,{x:90,y:-195,width:540,height:125});
    const bubbleLabel=b.label(bubble,'',{font_size:30,color_rgb:[255,255,255],weight:'bold',max_lines:3,stroke_width:2,stroke_color:[25,65,74]});
    const artFile=path.join(PROJECT,'tools/first-release/guide-art-additions.json');
    if(!fs.existsSync(artFile))throw new Error('Guide hand art must exist before regenerating GuideOverlay');
    const art=JSON.parse(fs.readFileSync(artFile,'utf8'));
    const images=Array.isArray(art)?art:[...(art.records??[]),...(art.derivatives??[])];
    const image=art['firstrelease.guide.hand']??images.find(item=>item.id==='firstrelease.guide.hand');
    if(!image?.spriteFrameUuid)throw new Error('Missing firstrelease.guide.hand.spriteFrameUuid in guide-art-additions.json');
    const tip=image.tipAnchor??image.handTip??art.handTip??{x:.30,y:.96};
    const tipX=tip.anchorX??tip.x??tip[0]??.30,tipY=tip.anchorY??tip.y??tip[1]??.96;
    const hand=b.node('HandFingertip',b.root,{width:1,height:1});
    const handOpacity=b.component(hand,'cc.UIOpacity',{_opacity:255});
    const glove=b.node('WhiteGlove',hand,{width:140,height:200,anchorX:tipX,anchorY:tipY});
    const handSprite=b.sprite(glove,image.spriteFrameUuid);
    b.component(b.root,scriptType(`${base}/GuideOverlayView.ts`),{holeMask:ref(mask),dimmer:ref(dimmer),targetHighlight:ref(targetHighlight),targetOpacity:ref(targetOpacity),bubbleLabel:ref(bubbleLabel),hand:ref(hand),handSprite:ref(handSprite),handOpacity:ref(handOpacity),handTipX:tipX,handTipY:tipY});
    const uuid=metaIdentity(GUIDE_PREFAB);
    writeOnceStableMeta(path.join(PROJECT,GUIDE_PREFAB),{ver:'1.1.50',importer:'prefab',imported:true,uuid,files:['.json'],subMetas:{},userData:{}});
    writeFile(path.join(PROJECT,GUIDE_PREFAB),JSON.stringify(b.finish(),null,2)+'\n');
    return {id:'first-guide',assetPath:GUIDE_PREFAB,uuid,bundle:'resources',resourcePath:'first-release/prefabs/GuideOverlay'};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(generateGuidePrefab()));
