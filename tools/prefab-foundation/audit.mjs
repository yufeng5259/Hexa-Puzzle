import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PROJECT, SCRATCH, sha256 } from './io.mjs';
import { scriptType } from './builder.mjs';
import { ManagedOutputs } from './managed-output.mjs';
import { validateScene } from './scene-contract.mjs';
import {exportLevels,LEVEL_CATALOG_PATH} from './export-levels.mjs';

const registry=JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/resources/framework/config/prefab-registry.json')));
const art=JSON.parse(fs.readFileSync(path.join(PROJECT,'assets/resources/framework/config/source-art-manifest.json')));
const layoutManifest=JSON.parse(fs.readFileSync(path.join(PROJECT,'tools/prefab-foundation/layout-manifest.json')));
const sourceLayouts=new Map(layoutManifest.prefabs.map(record=>[record.id,record.layouts]));
const imageRecords=new Map([...art.records,...art.derivatives].map(record=>[record.id,record]));
const uuids=new Map(), scripts=new Map();
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.meta')){const meta=JSON.parse(fs.readFileSync(f));for(const value of [meta,...Object.values(meta.subMetas??{})]){assert(!uuids.has(value.uuid),'Duplicate UUID: '+value.uuid);uuids.set(value.uuid,f);}if(f.endsWith('.ts.meta'))scripts.set(scriptType(path.relative(PROJECT,f.slice(0,-5)).replaceAll('\\','/')),f);}}}
walk(path.join(PROJECT,'assets'));
const componentTypes=new Map();
for(const [type,meta]of scripts){
  const name=fs.readFileSync(meta.slice(0,-5),'utf8').match(/@ccclass\(['"]([^'"]+)['"]\)/)?.[1];
  if(!name)continue;
  assert(!componentTypes.has(name),'Duplicate component class: '+name);
  componentTypes.set(name,type);
}
const scenePath=path.join(PROJECT,'assets/scenes/Main.scene');
validateScene(JSON.parse(fs.readFileSync(scenePath)),JSON.parse(fs.readFileSync(scenePath+'.meta')).uuid);
assert.equal(registry.prefabs.length,82);assert.equal(registry.routes.length,73);assert.equal(art.records.length,371);
assert.equal(registry.dataAssets?.length,1,'Exactly one formal level catalog must be registered');
const catalog=registry.dataAssets[0];
assert.equal(catalog.id,'data:level-catalog');assert.equal(catalog.assetPath,LEVEL_CATALOG_PATH);
assert.equal(catalog.bundle,'puzzle');assert.equal(catalog.resourcePath,'config/level-catalog');
assert.equal(JSON.parse(fs.readFileSync(path.join(PROJECT,LEVEL_CATALOG_PATH+'.meta'))).uuid,catalog.uuid);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(PROJECT,LEVEL_CATALOG_PATH))),exportLevels(),'Level data diverges from source questions');
let references=0,buttons=0,nodes=0;
const properties=value=>{if(!value||typeof value!=='object')return[];return[...Object.values(value),...Object.values(value).flatMap(properties)];};
for(const p of registry.prefabs){
  const file=path.join(PROJECT,p.assetPath),objects=JSON.parse(fs.readFileSync(file));
  assert.equal(sha256(fs.readFileSync(file)),p.sha256,'Prefab drift: '+p.id);
  const root=objects[objects[0].data.__id__],view=objects[p.rootComponent];
  assert(root._components.some(reference=>reference.__id__===p.rootComponent),'View is not attached to root: '+p.id);
  assert.equal(view.__type__,scriptType(p.scriptPath),'View script differs: '+p.id);
  if(p.id!=='virtual-list'){
    if(p.stateIds.length>1){assert.deepEqual(view.stateIds,p.stateIds,'View variants differ: '+p.id);assert.equal(view.stateRoots.length,p.stateIds.length);}
    else for(const field of ['stateRoots','stateIds','sourceLayouts'])assert(!Object.hasOwn(view,field),'Single-state Inspector scaffolding: '+p.id+'.'+field);
  }
  for(const layout of sourceLayouts.get(p.id)||[]){
    assert.equal(objects[layout.node.__id__]?.__type__,'cc.Node','Invalid source metadata state: '+p.id);
    assert.equal(layout.dynamicSprites.length,layout.imageIds.length,'Source image slots differ: '+p.id);
    assert.equal(layout.dynamicLabels.length,layout.previewTexts.length,'Source label slots differ: '+p.id);
    assert.equal(layout.geometryMounts.length,layout.geometrySpecs.length,'Source geometry slots differ: '+p.id);
    layout.dynamicSprites.forEach((reference,i)=>{const sprite=objects[reference.__id__];assert.equal(sprite?.__type__,'cc.Sprite');assert.equal(sprite._spriteFrame?.__uuid__,imageRecords.get(layout.imageIds[i])?.spriteFrameUuid,'Unserialized source artwork: '+p.id);});
    layout.dynamicLabels.forEach((reference,i)=>{const label=objects[reference.__id__];assert.equal(label?.__type__,'cc.Label');assert.equal(label._string,String(layout.previewTexts[i]).replace(/\r\n?/g,'\n'),'Unserialized default source text: '+p.id);});
    layout.geometryMounts.forEach(reference=>assert.equal(objects[reference.__id__]?.__type__,'cc.Node','Invalid source geometry mount: '+p.id));
  }
  if(p.maintenance==='manual'){
    const root=objects[objects[0].data.__id__],component=objects[p.rootComponent];
    assert(root._components.some(reference=>reference.__id__===p.rootComponent),'Manual View is not attached to root: '+p.id);
    assert.equal(component.__type__,scriptType(p.scriptPath),'Manual page View script differs: '+p.id);
    assert.deepEqual(p.stateIds,component.stateIds||[],'Manual page states differ: '+p.id);
    for(const binding of p.bindings){
      const value=component[binding.name];
      if(binding.type==='Prefab'){
        assert.equal(value?.__expectedType__,'cc.Prefab','Invalid manual Prefab binding: '+p.id+'.'+binding.name);
        assert(registry.prefabs.some(record=>record.uuid===value.__uuid__),'Unregistered manual Prefab binding: '+p.id+'.'+binding.name);
      }else{
        const expectedType=componentTypes.get(binding.type)||'cc.'+binding.type;
        assert.equal(objects[value?.__id__]?.__type__,expectedType,'Invalid manual page binding: '+p.id+'.'+binding.name);
      }
    }
  }
  for(const o of objects){
    assert(o.__type__.startsWith('cc.')||scripts.has(o.__type__),'Unknown script: '+o.__type__);
    if(o.__type__==='cc.Node'){
      nodes++;
      assert(!['VisualRoot','DynamicRoot'].includes(o._name),'Redundant universal root: '+p.id);
      for(const c of o._children){assert(objects[c.__id__]?._parent?.__id__===objects.indexOf(o),'Non-reciprocal parent: '+p.id);}
    }
    if(o.__type__==='cc.Button'){
      buttons++;assert(o.clickEvents.length>0,'Button missing serialized event: '+p.id);
      for(const reference of o.clickEvents){
        const event=reference.__id__===undefined?reference:objects[reference.__id__];
        assert(event,'Button event missing');
        assert(objects[event.target?.__id__]?.__type__==='cc.Node','Button target missing');assert(event.handler,'Button handler missing');
      }
    }
    for(const value of [o,...properties(o)]){
      if(!value||typeof value!=='object')continue;
      if('__id__'in value){assert(Number.isInteger(value.__id__)&&objects[value.__id__],'Broken __id__: '+p.id);references++;}
      if('__uuid__'in value){assert(uuids.has(value.__uuid__),'Missing asset: '+value.__uuid__);references++;}
    }
  }
  if(p.id==='building'){
    const component=objects.find(o=>o.__type__===scriptType(p.scriptPath));
    assert.notDeepEqual(component.body,component.rotor,'Rotor aliases body');
    assert.equal(objects[objects[component.rotor.__id__].node.__id__]._parent.__id__,component.rotorRoot.__id__);
  }
  for(const list of objects.filter(o=>o.__type__===scriptType('assets/scripts/framework/ui/VirtualList.ts'))){
    const template=registry.prefabs.find(p=>p.uuid===list.itemPrefab.__uuid__);
    assert(template,'Unknown list template');assert(list.itemExtent>=template.layoutSize[1],'List row overlaps authored item');
  }
  if(p.id==='mail-detail'||p.id==='privacy'){
    const component=objects.find(o=>o.__type__===scriptType(p.scriptPath));
    const content=objects[component.content.__id__];assert(content._children.length>=3,'Incomplete scroll prose');
    const body=objects[objects[component.bodyLabel.__id__].node.__id__];assert(/正文/.test(body._name),'Body binds a heading');
  }
}
for(const a of [...art.records,...art.derivatives]){
  assert.equal(sha256(fs.readFileSync(path.join(PROJECT,a.assetPath))),a.sha256??a.sourceSha256,'Image hash mismatch '+a.id);
  assert(uuids.has(a.spriteFrameUuid),'Image subasset missing');
}
new ManagedOutputs(PROJECT,'tools/prefab-foundation/generated-files.json').preflight();
const report={status:'PASS_STATIC_PREFAB_AND_SOURCE_CONTRACTS',prefabs:82,routes:73,originalImages:371,derivatives:art.derivatives.length,nodes,buttons,references,businessConnected:false};
fs.mkdirSync(SCRATCH,{recursive:true});fs.writeFileSync(path.join(SCRATCH,'audit.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
