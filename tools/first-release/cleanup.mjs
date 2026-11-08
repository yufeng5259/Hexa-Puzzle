import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT, writeFile } from '../prefab-foundation/io.mjs';
import { reachability } from './reachability.mjs';
const plan=reachability();if(plan.errors.length)throw Error(plan.errors.join('\n'));
const out='D:/CodexData/Artifacts/HoneyGarden五页首版开发20261108/retired-assets';
const receipt={createdAt:new Date().toISOString(),mode:process.argv.includes('--apply')?'apply':'plan',status:'planned',keptPrefabs:plan.keptPrefabs.map(p=>p.id),images:plan.imageIds.size,remove:plan.removable,files:[]};
console.log(JSON.stringify({mode:receipt.mode,prefabs:receipt.keptPrefabs,images:receipt.images,retireFiles:plan.removable.length}));
if(receipt.mode==='apply'){
    const backup=path.join(out,String(Date.now()));fs.mkdirSync(backup,{recursive:true});
    const targets=[...plan.removable,...plan.removable.map(file=>file+'.meta').filter(file=>fs.existsSync(path.join(PROJECT,file)))];
    const manifests=['assets/resources/framework/config/prefab-registry.json','assets/resources/framework/config/source-art-manifest.json','tools/first-release/generated-files.json'].filter(file=>fs.existsSync(path.join(PROJECT,file)));
    for(const file of [...targets,...manifests]){
        const absolute=path.resolve(PROJECT,file),relative=path.relative(path.join(PROJECT,'assets'),absolute);
        if(!manifests.includes(file)&&(relative.startsWith('..')||path.isAbsolute(relative)||file.startsWith('assets/scripts/framework/')))throw Error('Unsafe retirement target '+file);
        const bytes=fs.readFileSync(absolute),dest=path.join(backup,file),sha256=createHash('sha256').update(bytes).digest('hex');
        fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);
        if(createHash('sha256').update(fs.readFileSync(dest)).digest('hex')!==sha256)throw Error('Backup verification failed '+file);
        receipt.files.push({path:file,sha256,bytes:bytes.length,action:manifests.includes(file)?'rewrite':'remove'});
    }
    receipt.backup=backup;receipt.status='backed-up';
    writeFile(path.join(backup,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    // Re-check the frozen inputs before mutation so a concurrent importer/generator cannot silently lose edits.
    for(const row of receipt.files){if(createHash('sha256').update(fs.readFileSync(path.join(PROJECT,row.path))).digest('hex')!==row.sha256)throw Error('Retirement input changed after backup '+row.path)}
    // Only exact verified files are removed; arts, player data and other workspaces are never traversed.
    for(const file of targets)fs.unlinkSync(path.resolve(PROJECT,file));
    writeFile(path.join(PROJECT,'assets/resources/framework/config/prefab-registry.json'),JSON.stringify(plan.nextRegistry,null,2)+'\n');
    writeFile(path.join(PROJECT,'assets/resources/framework/config/source-art-manifest.json'),JSON.stringify(plan.nextArt,null,2)+'\n');
    const ownershipFile=path.join(PROJECT,'tools/first-release/generated-files.json');
    if(fs.existsSync(ownershipFile)){
        const ownership=JSON.parse(fs.readFileSync(ownershipFile,'utf8'));
        for(const row of ownership.files)row.sha256=createHash('sha256').update(fs.readFileSync(path.join(PROJECT,row.path))).digest('hex');
        writeFile(ownershipFile,JSON.stringify(ownership,null,2)+'\n');
    }
    receipt.status='applied';
    writeFile(path.join(backup,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
    writeFile(path.join(PROJECT,'tools/first-release/retired-assets.json'),JSON.stringify(receipt,null,2)+'\n');
}
