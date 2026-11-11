import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT, stableUuid, directory, writeFile, writeOnceStableMeta, assetJson, imageMeta, sha256 } from '../prefab-foundation/io.mjs';
import { scriptType, external } from '../prefab-foundation/builder.mjs';
import { validateScene } from '../prefab-foundation/scene-contract.mjs';
import { generatePuzzleUI } from './puzzle-ui.mjs';
import { generateGuidePrefab } from './guide-ui.mjs';
import { generateTransitionUI } from './transition-ui.mjs';

const read = file => JSON.parse(fs.readFileSync(path.join(PROJECT, file), 'utf8'));
const ART = 'assets/resources/framework/config/source-art-manifest.json';
const REGISTRY = 'assets/resources/framework/config/prefab-registry.json';
const SCENE = 'assets/scenes/Main.scene';
const BOOT = 'assets/scripts/app/FirstReleaseBoot.ts';
directory(path.dirname(BOOT));
writeOnceStableMeta(path.join(PROJECT,BOOT), {ver:'4.0.24',importer:'typescript',imported:true,uuid:fs.existsSync(path.join(PROJECT,BOOT+'.meta'))?read(BOOT+'.meta').uuid:stableUuid(BOOT),files:[],subMetas:{},userData:{}});
const additions = read('assets/resources/first-release/art-additions.json');
const guideArtFile = 'tools/first-release/guide-art-additions.json';
const guideArt = fs.existsSync(path.join(PROJECT,guideArtFile)) ? read(guideArtFile) : { records: [] };
const puzzleArt = read('tools/first-release/puzzle-art-additions.json');
for (const record of puzzleArt.records) {
    const bytes = fs.readFileSync(path.join(PROJECT, record.sourceFile));
    if (sha256(bytes) !== record.sourceSha256) throw Error('Puzzle artwork source changed: '+record.id);
    writeFile(path.join(PROJECT,record.assetPath),bytes);
    imageMeta(record.assetPath,record.size,{uuid:record.uuid});
}
const art = read(ART), registry = read(REGISTRY);
for (const record of [...(additions.records || []), ...(guideArt.records || []), ...puzzleArt.records]) {
    const previous = art.records.findIndex(item => item.id === record.id);
    if (previous >= 0) {
        if (art.records[previous].uuid !== record.uuid) throw Error('Refusing artwork UUID replacement: '+record.id);
        art.records[previous] = record;
    } else art.records.push(record);
}
art.sourceCount = art.records.length;
registry.aliases = {...registry.aliases,...additions.aliases};
const records = [...additions.prefabs,generatePuzzleUI(),generateGuidePrefab(),generateTransitionUI()];
for (const record of records) {
    const index = registry.prefabs.findIndex(item=>item.id===record.id);
    if(index>=0) registry.prefabs[index]={...registry.prefabs[index],...record}; else registry.prefabs.push(record);
}
const config = 'assets/resources/config/game-config.json', configUuid=read(config+'.meta').uuid;
registry.dataAssets=(registry.dataAssets||[]).filter(item=>item.id!=='data:game-config');
registry.dataAssets.push({id:'data:game-config',uuid:configUuid,bundle:'resources',resourcePath:'config/game-config',assetPath:config});
registry.businessConnected=true;
registry.limitations=['五页首版；正式范围以docs/重建计划/README.md为准。'];

// Existing Main.scene keeps its UUID, Canvas, camera, ViewHost and serialized loading binding.
const scene=read(SCENE), oldType=scriptType('assets/scripts/app/FoundationBoot.ts'), newType=scriptType(BOOT);
const boot=scene.find(object=>object.__type__===oldType||object.__type__===newType);
if(!boot)throw Error('Missing known composition root in Main.scene');
boot.__type__=newType;
const loading = registry.prefabs.find(item=>item.id==='firstrelease-loading');
if(loading)boot.loadingPrefab=external(loading.uuid,'cc.Prefab');
for(const object of scene)for(const event of object.clickEvents||[]){
    if(event.component==='FoundationBoot'){event.component='FirstReleaseBoot';event.handler='onRetry';}
}
validateScene(scene,read(SCENE+'.meta').uuid);
const images=new Map([...art.records,...art.derivatives].map(item=>[item.id,item]));
for(const alias of Object.keys(registry.aliases)) if(images.has(alias)) delete registry.aliases[alias];
for(const [alias,target] of Object.entries(registry.aliases||{}))if(!images.has(target))throw Error('Alias target unavailable: '+alias+' -> '+target);
const data=read(config).tables;
const decode=name=>Object.entries(data[name]).filter(([id])=>id!=='keys').map(([,values])=>Object.fromEntries(data[name].keys.map((key,i)=>[key,values[i]])));
for(const id of [...decode('Maps').map(row=>row.backgroundAssetId),...decode('BuildingStages').map(row=>row.bodyAssetId)])
    if(!images.has(id)&&!images.has(registry.aliases[id]))throw Error('Configuration art is not registered: '+id);
assetJson(ART,art); assetJson(REGISTRY,registry);writeFile(path.join(PROJECT,SCENE),JSON.stringify(scene,null,2)+'\n');

const source='tools/meta/reference-manifest.json',target=path.join(PROJECT,'tools/framework/reference-manifest.json');
if(fs.existsSync(path.join(PROJECT,source))){
    const next=read(source), prior=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):{schema:'hexa.reference.v1',records:[]};
    const incoming=Array.isArray(next)?next:next.records||next.files||[];
    const list=Array.isArray(prior)?prior:prior.records||[];
    for(const record of incoming){const index=list.findIndex(item=>item.target===record.target);if(index<0)list.push(record);else list[index]=record;}
    fs.mkdirSync(path.dirname(target),{recursive:true});writeFile(target,JSON.stringify({schema:'hexa.reference.v1',records:list},null,2)+'\n');
}
writeFile(path.join(PROJECT,'tools/first-release/active.json'),JSON.stringify({schema:'honey-garden.first-release.v1',entry:SCENE,boot:BOOT,legacyGeneratorRetired:true},null,2)+'\n');
const managed=[SCENE,ART,REGISTRY,...records.map(item=>item.assetPath)];
writeFile(path.join(PROJECT,'tools/first-release/generated-files.json'),JSON.stringify({schema:'honey-garden.first-release.outputs.v1',files:managed.map(file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(path.join(PROJECT,file))).digest('hex')}))},null,2)+'\n');
console.log(JSON.stringify({prefabs:records.length,aliases:Object.keys(registry.aliases).length,registeredImages:art.sourceCount,entry:SCENE}));
