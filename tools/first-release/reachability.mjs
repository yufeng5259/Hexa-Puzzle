import fs from 'node:fs';
import path from 'node:path';
import { PROJECT, normalize } from '../prefab-foundation/io.mjs';
import { scriptType } from '../prefab-foundation/builder.mjs';
export function reachability() {
    const read=file=>JSON.parse(fs.readFileSync(path.join(PROJECT,file),'utf8'));
    const registry=read('assets/resources/framework/config/prefab-registry.json');
    const art=read('assets/resources/framework/config/source-art-manifest.json');
    const files=[];
    const walk=folder=>{for(const e of fs.readdirSync(path.join(PROJECT,folder),{withFileTypes:true})){const file=folder+'/'+e.name;if(e.isDirectory())walk(file);else files.push(file)}};
    walk('assets');
    const uuidFiles=new Map(), componentFiles=new Map();
    for(const file of files.filter(file=>file.endsWith('.meta'))){
        try{const meta=read(file);if(meta.uuid)uuidFiles.set(meta.uuid,file.slice(0,-5))}catch{}
    }
    for(const file of files.filter(file=>file.endsWith('.ts'))){if(fs.existsSync(path.join(PROJECT,file+'.meta')))componentFiles.set(scriptType(file),file)}
    const images=new Map([...art.records,...art.derivatives].map(row=>[row.id,row]));
    const required=new Set(),imageIds=new Set(),errors=[],pending=[];
    const add=file=>{file=normalize(file);if(!required.has(file)){required.add(file);pending.push(file)}};
    const image=id=>{
        id=registry.aliases?.[id]||id;if(imageIds.has(id))return;
        const row=images.get(id);if(!row){errors.push('Unregistered image '+id);return}
        imageIds.add(id);add(row.assetPath);if(row.sourceId)image(row.sourceId);
    };
    const value=v=>{
        if(Array.isArray(v)){v.forEach(value);return}
        if(v&&typeof v==='object'){
            if(v.__uuid__){const uuid=v.__uuid__.split('@')[0],file=uuidFiles.get(uuid);if(file)add(file);else if(!uuid.startsWith('00000000'))errors.push('Missing UUID '+v.__uuid__)}
            if(componentFiles.has(v.__type__))add(componentFiles.get(v.__type__));
            Object.values(v).forEach(value);return;
        }
        if(typeof v==='string'){
            if(images.has(v)||registry.aliases?.[v])image(v);
            else if(v.startsWith('{')||v.startsWith('[')){try{value(JSON.parse(v))}catch{}}
        }
    };
    add('assets/scenes/Main.scene');
    add('assets/resources/framework/config/source-art-manifest.json');add('assets/resources/framework/config/prefab-registry.json');
    const seedIds=['home','firstrelease-dialog','firstrelease-loading','firstrelease-puzzle','first-guide','page-transition','hex-cell','puzzle-piece'];
    for(const id of seedIds){const row=registry.prefabs.find(row=>row.id===id);if(!row)errors.push('Missing entry Prefab '+id);else add(row.assetPath)}
    for(const row of registry.dataAssets||[])add(row.assetPath);
    for(const target of Object.values(registry.aliases||{}))image(target);
    for(const file of files.filter(file=>file.startsWith('assets/scripts/framework/')&&file.endsWith('.ts')))add(file);
    // Source declarations/derivation receipt are build inputs, not a second runtime authority.
    if(fs.existsSync(path.join(PROJECT,'assets/resources/first-release/art-additions.json')))add('assets/resources/first-release/art-additions.json');
    const drain=()=>{while(pending.length){
        const file=pending.pop(),absolute=path.join(PROJECT,file);
        if(!fs.existsSync(absolute)){errors.push('Missing asset '+file);continue}
        if(file=== 'assets/resources/framework/config/source-art-manifest.json'||file==='assets/resources/framework/config/prefab-registry.json')continue;
        if(file.endsWith('.ts')){
            const code=fs.readFileSync(absolute,'utf8');
            for(const match of code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
                if(!match[1].startsWith('.'))continue;
                const target=normalize(path.relative(PROJECT,path.resolve(path.dirname(absolute),match[1]+'.ts')));
                if(fs.existsSync(path.join(PROJECT,target)))add(target);else errors.push('Missing import '+file+' -> '+match[1]);
            }
        }else if(file.endsWith('.prefab')||file.endsWith('.scene')||file.endsWith('.json')){try{value(read(file))}catch(e){errors.push(file+': '+e.message)}}
    }};
    drain();
    // Any frame referenced directly by a Prefab must also remain in the registration boundary.
    for(const row of images.values())if(required.has(row.assetPath))image(row.id);
    drain();
    const keptPrefabs=registry.prefabs.filter(row=>required.has(row.assetPath));
    const nextRegistry={...registry,prefabs:keptPrefabs,routes:[],counts:{firstRelease:keptPrefabs.length}};
    const nextArt={...art,records:art.records.filter(row=>imageIds.has(row.id)),derivatives:art.derivatives.filter(row=>imageIds.has(row.id))};nextArt.sourceCount=nextArt.records.length;
    for(const row of nextArt.derivatives)if(!nextArt.records.some(source=>source.id===row.sourceId))errors.push('Missing derivative parent '+row.id);
    for(const file of [...required]){
        if(files.includes(file+'.meta'))required.add(file+'.meta');
        let parent=path.posix.dirname(file);while(parent.startsWith('assets/')){if(files.includes(parent+'.meta'))required.add(parent+'.meta');parent=path.posix.dirname(parent)}
    }
    const removable=files.filter(file=>!required.has(file)&&!file.endsWith('.meta')&&(/\.(ts|png|jpg|jpeg|webp|prefab|json|scene|fnt|ttf|otf|effect|mtl)$/i.test(file)));
    return {required,removable,errors,nextRegistry,nextArt,keptPrefabs,imageIds};
}
