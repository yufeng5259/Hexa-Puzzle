import fs from 'node:fs';
import path from 'node:path';
import { Builder, ref, scriptType, color } from '../prefab-foundation/builder.mjs';
import { PROJECT, directory, writeFile, writeOnceStableMeta, stableUuid, assetJson, imageMeta, sha256 } from '../prefab-foundation/io.mjs';

// Only these new first-release Prefabs are owned here. Never invokes the legacy full generator.
const manifest = JSON.parse(fs.readFileSync(path.join(PROJECT, 'assets/resources/framework/config/source-art-manifest.json')));
const puzzleArt = JSON.parse(fs.readFileSync(path.join(PROJECT, 'tools/first-release/puzzle-art-additions.json')));
const records = [...manifest.records, ...manifest.derivatives, ...puzzleArt.records];
const byId = new Map(records.map(record => [record.id, record]));
const added = [];
// Recover the actual transparent mother assets used to compose the confirmed v2 previews.
// Inputs are copied into the formal art directory once; subsequent runs use portable local sources.
const sourceRoot='D:/CodexData/Temp/Block清爽五页执行20261107/ui';
const formalRoot=path.join(PROJECT,'arts/游戏素材/PNG/首版V2UI');
const formalPath=key=>{
    const shared=['back','settings','wallet','avatar','panel'];
    const page=key==='play'?'五页首版主页':['build','gift','progress','cost','upgrade','stage-green','stage-gray'].includes(key)?'五页首版建造':key==='loading-background'?'五页首版Loading':'五页首版拼图';
    return `arts/游戏素材/PNG/${shared.includes(key)?'公共UI/五页首版':`页面素材/${page}/${key.endsWith('background')?'背景':'UI'}`}/${key}.png`;
};
fs.mkdirSync(formalRoot,{recursive:true});
for(const key of ['back','build','settings','undo','rotate','hint','gift','play','wallet','progress','cost','avatar','panel','puzzle-background','puzzle-tray','loading-background','upgrade','stage-green','stage-gray']) {
    const formal=path.join(PROJECT,formalPath(key));
    fs.mkdirSync(path.dirname(formal),{recursive:true});
    if(!fs.existsSync(formal)&&fs.existsSync(path.join(formalRoot,key+'.png'))) fs.renameSync(path.join(formalRoot,key+'.png'),formal);
    if(!fs.existsSync(formal)) fs.copyFileSync(path.join(sourceRoot,key+'.png'),formal);
    const bytes=fs.readFileSync(formal), width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
    const file=`assets/resources/first-release/art/${key}.png`;
    writeFile(path.join(PROJECT,file),bytes);
    const identity=imageMeta(file,[width,height]);
    const id=key==='puzzle-background'?'firstrelease.puzzle.background':key==='puzzle-tray'?'firstrelease.puzzle.tray':key==='loading-background'?'firstrelease.loading.background':'firstrelease.ui.'+(key==='rotate'?'restart':key);
    const record={id,...identity,assetPath:file,bundle:'resources',resourcePath:`first-release/art/${key}/spriteFrame`,size:[width,height],sourceSha256:sha256(bytes),sourceFile:formalPath(key),name:'V2 '+key};
    added.push(record);byId.set(record.id,record);
}
const mapFormal='arts/游戏素材/PNG/首版V2地图/裸地图.png';
const mapBytes=fs.readFileSync(path.join(PROJECT,mapFormal));
const mapFile='assets/resources/first-release/art/map.png';
writeFile(path.join(PROJECT,mapFile),mapBytes);
const mapIdentity=imageMeta(mapFile,[853,1844]);
const mapRecord={id:'garden1.background',...mapIdentity,assetPath:mapFile,bundle:'resources',resourcePath:'first-release/art/map/spriteFrame',size:[853,1844],sourceSha256:sha256(mapBytes),sourceFile:mapFormal,name:'V2同构图无建筑地形'};
added.push(mapRecord);byId.set(mapRecord.id,mapRecord);
const replacements={'block_建造界面_返回':'firstrelease.ui.back','block_hud_设置木质齿轮':'firstrelease.ui.settings','block_微信图片_20261019173444_81_187_建造花园':'firstrelease.ui.build','block_建造界面_树屋奖励礼物':'firstrelease.ui.gift','block_好友界面_赠送进度空槽':'firstrelease.ui.wallet'};
const frame = id => { const record = byId.get(replacements[id]||id); if (!record) throw Error('Missing source image ' + id); return record.spriteFrameUuid; };
const files = [];
function scriptMeta(file) {
    directory(path.dirname(path.join(PROJECT, file)));
    writeOnceStableMeta(path.join(PROJECT, file), { ver:'4.0.24', importer:'typescript', imported:true, uuid:stableUuid(file), files:[], subMetas:{}, userData:{} });
}
for (const file of ['assets/scripts/features/home/ui/HomeBuildView.ts','assets/scripts/features/common/ui/EnergyHud.ts','assets/scripts/features/common/ui/FirstReleaseDialogView.ts']) scriptMeta(file);
const outputRoot = 'assets/resources/first-release/prefabs';
directory(path.join(PROJECT, outputRoot));
function publish(b, name) {
    const file = `${outputRoot}/${name}.prefab`, uuid = stableUuid(file);
    writeOnceStableMeta(path.join(PROJECT,file), { ver:'1.1.50', importer:'prefab', imported:true, uuid, files:['.json'], subMetas:{}, userData:{} });
    writeFile(path.join(PROJECT,file), JSON.stringify(b.finish(),null,2)+'\n');
    files.push({ id:name==='HomeBuild'?'home':name==='Loading'?'firstrelease-loading':'firstrelease-dialog', uuid, bundle:'resources', resourcePath:`first-release/prefabs/${name}`, assetPath:file });
}
const buttonImage = 'block_结算_下一关按钮', panelImage = 'firstrelease.ui.panel';
function image(b,name,parent,box,id) { const n=b.node(name,parent,box); b.sprite(n,frame(id)); return n; }
function label(b,name,parent,box,text,size=30,rgb=[42,75,84]) { const n=b.node(name,parent,box); return b.label(n,text,{font_size:size,color_rgb:rgb,weight:'bold'}); }
function button(b,name,parent,box,id,action,component='HomeBuildView',handler='onAction',target=b.root) {
    const n=image(b,name,parent,box,id); return b.button(n,target,component,handler,action);
}
function owner(b,component) { return b.objects[component].node.__id__; }
function energy(b,parent,x,y) {
    const n=b.node('EnergyHUD',parent,{x,y,width:190,height:88});
    image(b,'Heart',n,{x:-55,width:72,height:68},'block_hud_体力爱心空白');
    const amount=label(b,'EnergyAmount',n,{x:-55,width:65,height:60},'5',32,[255,255,255]);
    const timer=label(b,'EnergyTimer',n,{x:33,width:110,height:48},'FULL',24);
    return b.component(n,scriptType('assets/scripts/features/common/ui/EnergyHud.ts'),{amountLabel:ref(amount),timerLabel:ref(timer)});
}
function home() {
    const b=new Builder('HomeBuild');
    const bg=image(b,'BareTerrain',b.root,{width:853,height:1844},'garden1.background');
    const map=b.node('Map',b.root,{y:55,width:853,height:1844});
    b.objects[map]._lscale.x=.88;b.objects[map]._lscale.y=.88;
    const background=b.objects[bg]._components.find(x=>b.objects[x.__id__].__type__==='cc.Sprite').__id__;
    const buildingSprites=[],rotorSprites=[];
    for(let i=0;i<5;i++) {
        const n=b.node(`Building${i+1}`,map,{width:512,height:512});
        buildingSprites.push(ref(b.sprite(n)));
        const rotor=b.node('WatermillRotor',n,{width:512,height:512},false);rotorSprites.push(ref(b.sprite(rotor)));
    }
    const hud=b.node('HUD',b.root,{width:853,height:1844});
    image(b,'Avatar',hud,{x:-350,y:770,width:112,height:120},'firstrelease.ui.avatar');
    image(b,'WalletPlate',hud,{x:-95,y:770,width:400,height:90},'block_好友界面_赠送进度空槽');
    const coins=label(b,'Coins',hud,{x:-55,y:770,width:240,height:70},'0',38,[255,255,255]);
    const eh=energy(b,hud,185,770);
    const settings=button(b,'Settings',hud,{x:352,y:770,width:104,height:104},'block_hud_设置木质齿轮','settings');
    const mapName=label(b,'MapName',hud,{y:660,width:700,height:70},'向阳蜂谷',36);
    b.objects[owner(b,mapName)]._active=false;
    const upgradeRoot=b.node('UpgradeAnchors',map,{width:853,height:1844},false);
    const upgrades=[],costs=[],stages=[],stageSprites=[];
    for(let i=0;i<5;i++) {
        const control=button(b,`Upgrade${i+1}`,upgradeRoot,{width:210,height:96},'firstrelease.ui.upgrade',`building:upgrade:${i+1}`);
        const n=owner(b,control);
        costs.push(ref(label(b,'Cost',n,{x:29,y:-10,width:115,height:58},'40',30)));
        const stageLabel=label(b,'StageDescription',n,{width:190,height:40},'0/5',20);
        b.objects[owner(b,stageLabel)]._active=false;stages.push(ref(stageLabel));
        for(let dot=0;dot<5;dot++) {
            const node=image(b,`StageDot${dot+1}`,n,{x:((413.5+dot*128)/1323-.5)*210,y:(.5-101.5/607)*96,width:18,height:18},'firstrelease.ui.stage-gray');
            stageSprites.push(ref(b.objects[node]._components.find(x=>b.objects[x.__id__].__type__==='cc.Sprite').__id__));
        }
        upgrades.push(ref(control));
    }
    const homeBottom=b.node('HomeBottom',b.root,{width:853,height:1844});
    const buildButton=button(b,'Build',homeBottom,{x:-290,y:-785,width:142,height:142},'block_微信图片_20261019173444_81_187_建造花园','home:build');
    const play=button(b,'Play',homeBottom,{x:90,y:-785,width:540,height:150},'firstrelease.ui.play','home:play');
    const playNode=owner(b,play);
    const arrow=b.node('LevelArrow',playNode,{x:-165,width:120,height:100});
    const level=label(b,'LevelNumber',arrow,{width:110,height:90},'1',46,[255,255,255]);
    label(b,'PlayText',playNode,{x:55,width:260,height:100},'Play',56,[255,255,255]);
    const buildBottom=b.node('BuildBottom',b.root,{width:853,height:1844},false);
    image(b,'BottomPlate',buildBottom,{y:-785,width:853,height:179},'block_建造界面_花园总进度面板');
    const back=button(b,'Back',buildBottom,{x:-325,y:-785,width:110,height:110},'block_建造界面_返回','home:back');
    image(b,'ProgressTrack',buildBottom,{x:0,y:-810,width:480,height:43},'block_建造界面_花园总进度底轨');
    const fill=image(b,'ProgressFill',buildBottom,{x:-240,y:-810,width:480,height:43,anchorX:0},'block_建造界面_花园总进度填充');
    const progress=label(b,'Progress',buildBottom,{y:-810,width:450,height:60},'0/25',30,[255,255,255]);
    label(b,'BuildCaption',buildBottom,{y:-750,width:450,height:50},'花园建设',30);
    const claim=button(b,'MapGift',buildBottom,{x:320,y:-785,width:125,height:125},'block_建造界面_树屋奖励礼物','map:claim');
    const view=b.component(b.root,scriptType('assets/scripts/features/home/ui/HomeBuildView.ts'),{
        mapRoot:ref(map),background:ref(background),homeBottom:ref(homeBottom),buildBottom:ref(buildBottom),upgradeRoot:ref(upgradeRoot),coinLabel:ref(coins),levelLabel:ref(level),progressLabel:ref(progress),mapNameLabel:ref(mapName),progressFill:ref(fill),energyHud:ref(eh),playButton:ref(play),buildButton:ref(buildButton),backButton:ref(back),settingsButton:ref(settings),claimButton:ref(claim),buildingSprites,rotorSprites,upgradeButtons:upgrades,costLabels:costs,stageLabels:stages,stageSprites
    });
    const opacity=node=>ref(b.component(node,'cc.UIOpacity',{_opacity:255}));
    Object.assign(b.objects[view],{
        homeBottomOpacity:opacity(homeBottom),buildBottomOpacity:opacity(buildBottom),mapNameOpacity:opacity(owner(b,mapName)),
        upgradeOpacities:upgrades.map(control=>opacity(owner(b,control.__id__)))
    });
    publish(b,'HomeBuild');
}
function dialog() {
    const b=new Builder('Dialog');
    b.component(b.root,'cc.BlockInputEvents');
    const shade=b.node('Shade',b.root,{width:5000,height:5000});
    const shadeGraphics=b.component(shade,'cc.Graphics',{_lineWidth:0,_fillColor:color([8,26,36],175)});
    b.component(shade,'cc.BlockInputEvents');
    image(b,'Panel',b.root,{width:730,height:1100},panelImage);
    // The original plate includes a baked close icon. Mirror its clean opposite corner
    // through a local mask for dialogs which cannot close; the source art stays intact.
    const closeArtCover=b.node('CloseArtCover',b.root,{x:220,y:340,width:125,height:140},false);
    b.component(closeArtCover,'cc.Mask',{_type:0,_inverted:false});
    const cleanCorner=image(b,'MirroredCleanCorner',closeArtCover,{x:-220,y:-340,width:730,height:1100},panelImage);
    b.objects[cleanCorner]._lscale.x=-1;
    const title=label(b,'Title',b.root,{y:280,width:570,height:95},'提示',46);
    const body=label(b,'Body',b.root,{y:75,width:580,height:440},'',34); b.objects[body]._enableWrapText=true;
    const primary=button(b,'Primary',b.root,{y:-330,width:470,height:110},buttonImage,'primary','FirstReleaseDialogView','onDialogAction');
    const primaryLabel=label(b,'PrimaryLabel',owner(b,primary),{width:440,height:90},'确定',38,[255,255,255]);
    const secondary=button(b,'Secondary',b.root,{y:-465,width:400,height:85},buttonImage,'secondary','FirstReleaseDialogView','onDialogAction');
    const secondaryLabel=label(b,'SecondaryLabel',owner(b,secondary),{width:370,height:70},'关闭',30,[255,255,255]);
    const closeNode=b.node('Close',b.root,{x:220,y:340,width:85,height:85});
    const close=b.button(closeNode,b.root,'FirstReleaseDialogView','onDialogAction','dialog:close');
    const rewards=b.node('Rewards',b.root,{y:-95,width:560,height:230},false);
    const coinClip=b.node('RewardCoinsIcon',rewards,{x:-145,y:40,width:110,height:118});
    b.component(coinClip,'cc.Mask',{_type:1,_inverted:false,_segments:64});
    const coinIcon=image(b,'ExistingCoinPlate',coinClip,{x:150,width:450,height:157.5},'firstrelease.ui.cost');
    const hintIcon=image(b,'RewardHintsIcon',rewards,{x:145,y:40,width:105,height:105},'firstrelease.reward.hint');
    label(b,'RewardCoinsCaption',rewards,{x:-145,y:-35,width:230,height:45},'蜜蜂币',26);
    label(b,'RewardHintsCaption',rewards,{x:145,y:-35,width:230,height:45},'提示',26);
    const rewardCoins=label(b,'RewardCoinsAmount',rewards,{x:-145,y:-85,width:230,height:55},'100',36);
    const rewardHints=label(b,'RewardHintsAmount',rewards,{x:145,y:-85,width:230,height:55},'1',36);
    const settings=b.node('Settings',b.root,{width:600,height:600},false),settingLabels=[];
    for(const [i,key] of ['music','sound','vibration','language'].entries()) {
        const y=230-i*130;
        label(b,'SettingName'+i,settings,{x:-150,y,width:230,height:80},['音乐','音效','震动','语言'][i],34);
        const control=button(b,'Setting'+i,settings,{x:145,y,width:225,height:85},buttonImage,`settings:${key}`,'FirstReleaseDialogView','onDialogAction');
        settingLabels.push(ref(label(b,'SettingValue'+i,owner(b,control),{width:210,height:80},'开启',28,[255,255,255])));
    }
    b.component(b.root,scriptType('assets/scripts/features/common/ui/FirstReleaseDialogView.ts'),{shadeGraphics:ref(shadeGraphics),titleLabel:ref(title),bodyLabel:ref(body),primaryLabel:ref(primaryLabel),secondaryLabel:ref(secondaryLabel),primaryButton:ref(primary),secondaryButton:ref(secondary),closeButton:ref(close),closeArtCover:ref(closeArtCover),settingsRoot:ref(settings),settingLabels,rewardsRoot:ref(rewards),rewardCoinsLabel:ref(rewardCoins),rewardHintsLabel:ref(rewardHints),rewardCoinsIcon:ref(b.objects[coinIcon]._components.find(x=>b.objects[x.__id__].__type__==='cc.Sprite').__id__),rewardHintsIcon:ref(b.objects[hintIcon]._components.find(x=>b.objects[x.__id__].__type__==='cc.Sprite').__id__)});
    publish(b,'Dialog');
}
const aliases={};
for(const [kind,native] of Object.entries({treehouse:'树屋',flowerbed:'花园',workshop:'蜂蜜工坊',watermill:'小溪水车',greenhouse:'温室'})) for(let stage=0;stage<=5;stage++) {
    const source=records.find(r=>r.name===`向阳花园_${native}_${stage}级_原生母件` || (native==='小溪水车' && r.name===`向阳花园_${native}_${stage}级_无轮静态本体_原生母件`));
    if(!source)throw Error(`Missing native building ${kind} ${stage}`);
    aliases[`building.${kind}.stage${stage}`]=source.id;
    if(kind==='watermill' && stage>0)aliases[`building.watermill.rotor.stage${stage}`]=records.find(r=>r.name===`向阳花园_小溪水车_${stage}级_独立水轮转子_原生母件`).id;
}
function loading() {
    const b=new Builder('Loading');
    image(b,'Background',b.root,{width:853,height:1844},'firstrelease.loading.background');
    image(b,'ProgressTrack',b.root,{y:-690,width:700,height:80},'block_主图_加载进度底槽');
    const fill=b.node('ProgressFill',b.root,{x:-325,y:-690,width:650,height:38,anchorX:0});
    const sprite=b.sprite(fill,frame('block_主图_加载进度填充')); b.objects[sprite]._color=color([76,255,200]);
    const bar=b.component(b.root,'cc.ProgressBar',{_barSprite:ref(sprite),_mode:0,_totalLength:650,_progress:0,_reverse:false});
    const percent=label(b,'Percent',b.root,{y:-770,width:280,height:55},'0%',28);
    label(b,'Caption',b.root,{y:-620,width:450,height:55},'加载中…',28);
    b.component(b.root,scriptType('assets/scripts/features/boot/ui/LoadingPageView.ts'),{progressBar:ref(bar),progressLabel:ref(percent)});
    publish(b,'Loading');
}
home(); dialog(); loading();
assetJson('assets/resources/first-release/art-additions.json',{records:added,derivatives:[],aliases,prefabs:files});
console.log(JSON.stringify({prefabs:files,aliases:Object.keys(aliases).length,records:added.length,visualLimitations:['V2 bare map was AI edited from the actual shared map; buildings reuse existing stage mother assets and need actual Creator composition verification.','Formal editable PSD and full art delivery index synchronization remain a separate art-closeout task.']},null,2));
