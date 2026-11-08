import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT } from '../prefab-foundation/io.mjs';
import { validateScene } from '../prefab-foundation/scene-contract.mjs';
import { reachability } from './reachability.mjs';
const read=file=>JSON.parse(fs.readFileSync(path.join(PROJECT,file),'utf8'));
const errors=[];
const result=reachability();errors.push(...result.errors);
for(const row of read('tools/first-release/generated-files.json').files){
 const file=path.join(PROJECT,row.path);
 if(!fs.existsSync(file)||createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==row.sha256)errors.push('Generated ownership mismatch '+row.path);
}
validateScene(read('assets/scenes/Main.scene'),read('assets/scenes/Main.scene.meta').uuid);
const registry=read('assets/resources/framework/config/prefab-registry.json');
const art=read('assets/resources/framework/config/source-art-manifest.json');
if(art.sourceCount!==art.records.length)errors.push('Artwork source count mismatch');
const ids=new Set(),uuids=new Set();
for(const row of [...art.records,...art.derivatives]){
 if(ids.has(row.id)||uuids.has(row.uuid))errors.push('Duplicate image identity '+row.id);ids.add(row.id);uuids.add(row.uuid);
 const file=path.join(PROJECT,row.assetPath);
 if(!fs.existsSync(file)){errors.push('Image missing '+row.assetPath);continue}
 if(read(row.assetPath+'.meta').uuid!==row.uuid)errors.push('Image UUID mismatch '+row.id);
 const hash=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 if(hash!==(row.sha256||row.sourceSha256))errors.push('Image content hash mismatch '+row.id);
}
for(const row of registry.prefabs){
 const objects=read(row.assetPath);
 if(objects[0].__type__!=='cc.Prefab'||read(row.assetPath+'.meta').uuid!==row.uuid)errors.push('Prefab identity mismatch '+row.id);
 const refs=value=>{if(!value||typeof value!=='object')return;if('__id__' in value&&(!Number.isInteger(value.__id__)||!objects[value.__id__]))errors.push('Invalid serialized binding '+row.id+':'+value.__id__);Object.values(value).forEach(refs)};
 refs(objects);
}
for(const [alias,id] of Object.entries(registry.aliases||{}))if(ids.has(alias)||!ids.has(id))errors.push('Invalid alias '+alias);
for(const row of registry.dataAssets||[])if(!fs.existsSync(path.join(PROJECT,row.assetPath)))errors.push('Data missing '+row.id);
const config=read('assets/resources/config/game-config.json').tables;
const rows=name=>Object.entries(config[name]).filter(([id])=>id!=='keys').map(([,value])=>Object.fromEntries(config[name].keys.map((key,i)=>[key,value[i]])));
const levels=read('assets/bundles/puzzle/config/level-catalog.json').levels;
const line=rows('Mainline');for(const row of line)if(!levels.some(level=>level.id===row.puzzleId))errors.push('Missing mainline geometry '+row.puzzleId);
for(const row of [...rows('Maps').map(row=>row.backgroundAssetId),...rows('BuildingStages').map(row=>row.bodyAssetId)])if(!ids.has(row)&&!ids.has(registry.aliases[row]))errors.push('Unreachable configured image '+row);
console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',prefabs:registry.prefabs.length,images:ids.size,mainline:line.length,requiredFiles:result.required.size,unusedRuntimeFiles:result.removable.length,errors},null,2));
if(errors.length)process.exitCode=1;
