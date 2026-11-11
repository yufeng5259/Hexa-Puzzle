import fs from 'node:fs';
import path from 'node:path';
import {Builder,ref,scriptType,color} from '../prefab-foundation/builder.mjs';
import {PROJECT,stableUuid,directory,writeFile,writeOnceStableMeta} from '../prefab-foundation/io.mjs';
export function generateTransitionUI(){
 const script='assets/scripts/features/common/ui/PageTransitionView.ts',file='assets/resources/first-release/prefabs/PageTransition.prefab';
 const identity=p=>fs.existsSync(path.join(PROJECT,p+'.meta'))?JSON.parse(fs.readFileSync(path.join(PROJECT,p+'.meta'))).uuid:stableUuid(p);
 directory(path.dirname(script));directory(path.dirname(file));
 writeOnceStableMeta(path.join(PROJECT,script),{ver:'4.0.24',importer:'typescript',imported:true,uuid:identity(script),files:[],subMetas:{},userData:{}});
 const b=new Builder('PageTransition');
 const opacity=b.component(b.root,'cc.UIOpacity',{_opacity:0});
 b.component(b.root,'cc.BlockInputEvents');
 const curtain=b.component(b.root,'cc.Graphics',{_lineWidth:0,_fillColor:color([143,195,204]),_strokeColor:color([143,195,204])});
 b.component(b.root,scriptType(script),{curtain:ref(curtain),opacity:ref(opacity)});
 const uuid=identity(file);writeOnceStableMeta(path.join(PROJECT,file),{ver:'1.1.50',importer:'prefab',imported:true,uuid,files:['.json'],subMetas:{},userData:{}});
 writeFile(path.join(PROJECT,file),JSON.stringify(b.finish(),null,2)+'\n');
 return {id:'page-transition',uuid,bundle:'resources',resourcePath:'first-release/prefabs/PageTransition',assetPath:file};
}
