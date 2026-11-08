"""Read back first-release art, check bounded text probes, then refresh portable delivery metadata."""
from pathlib import Path
import json,hashlib
from PIL import Image
from psd_tools import PSDImage
from psd_tools.api.layers import TypeLayer
from psd_text_layers import render_text_cache,verify_type_layer
P=Path(__file__).resolve().parents[2];A=P/'arts';R=A/'补充制作记录/五页首版'
def read(f):return json.loads(Path(f).read_text(encoding='utf8'))
def dump(f,v):Path(f).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
report=read(R/'PSD回读与合成校验.json');pages=report['pages'];probes=[];layers=[];portable=[]
tr={'向阳蜂谷':'Sunny Honey Garden','花园建设':'Garden Construction','设置':'Settings','音乐':'Music','音效':'Sound Effects','震动':'Vibration','语言':'Language','开启':'Enabled','确定':'Confirm','简体中文':'English','Play':'Continue','加载中…':'Loading...','已用步数':'Moves Used'}
for page in pages:
 cfg=read(A/page['config']);specs={s['layer_name']:s for s in cfg['layers'] if s['kind']=='text'};psd=PSDImage.open(A/page['psd']);assert sha(A/page['psd'])==page['psd_sha256'];assert sha(A/page['preview'])==page['preview_sha256'];assert sha(A/page['comparison']['original'])==page['original_sha256']
 for layer in psd:
  if isinstance(layer,TypeLayer):layers.append(verify_type_layer(layer,specs[layer.name]))
 for s in cfg['layers']:
  if s.get('source_file'):
   f=A/s['source_file'];assert f.exists(),str(f);portable.append(s['source_file'])
  if s['kind']!='text':continue
  v=dict(s);text=s['text'];v['text']=tr.get(text,'999,999,999' if 'Coins' in s['layer_name'] else '9,999' if '/Cost' in s['layer_name'] else '999' if 'LevelNumber' in s['layer_name'] else '25/25' if text=='1/25' else text);c=render_text_cache(v)['spec'];probes.append({'page':page['name'],'layer':s['layer_name'],'original':text,'probe':v['text'],'font_size':c['font_size'],'overflow':c['layout_overflow'],'ink':c['measured_ink_size']})
assert not any(p['overflow'] for p in probes)
dump(R/'文字长文案与数值探针.json',{'coverage':'Chinese default, representative English strings and stated numeric probes; not all languages','cases':probes,'overflowCount':0})
addition=read(P/'assets/resources/first-release/art-additions.json');files=[]
for r in addition['records']:
 f=P/r['sourceFile'];runtime=P/r['assetPath'];assert sha(f)==sha(runtime);files.append({'id':r['id'],'source':r['sourceFile'],'sha256':sha(f),'size':list(Image.open(f).size),'runtimeAsset':r['assetPath'],'runtimeSha256':sha(runtime)})
dump(R/'运行素材与来源.json',{'date':'2026-11-08','status':'20 registered source PNGs;5 layered PSDs;38 genuine editable TypeLayers','sourceUIRoot':'D:/CodexData/Temp/Block清爽五页执行20261107/ui','mapEditSource':'D:/CodexData/Temp/Block清爽五页执行20261107/shared-map.png','files':files,'transformNotes':{'play':'largest alpha component of current empty arrow mother','puzzleBackground':'original quiet upper field crop[0,0,853,1120],resize853x1844','puzzleTray':'original crop[22,1142,831,1509],rounded alpha mask68px/3px feather','loadingBackground':'remove baked bar with grass crop[40,1690,813,1830]at[40,1540],12px feather','upgrade':'original native new upgrade badge split into blank base and green/gray dots;details in升级锚点派生.json','panel':'clean source blank material interior, preserve original frame/crest/close'}})
puzzle=read(A/'游戏素材/页面配置/五页首版/拼图参数化组件.json');assert len(puzzle['layers'])==37 and len(puzzle['geometry'])==3
# Preserve prior delivery history; record new scope without inheriting its old visual PASS.
cat=read(A/'游戏素材/素材清单.json');summary=read(A/'交付清单与校验.json');summary.update(asset_count=cat['asset_count'],page_count=len(cat['pages']),editable_text_count=cat['text_count'],final_directory=str(A))
summary['firstRelease20261108']={'status':'20 source PNGs and5 actual layered implementation pages delivered; visual differences retained','uniquePNGs':20,'layeredPages':len(pages),'realTypeLayers':len(layers),'parameterizedPuzzleLayers':{'boardCells':19,'pieceCells':18,'geometry':3},'sourceRuntimeShaMatch':True,'psdRoundtripAndComposite':'PASS max difference<=2','representativeLongTextProbes':len(probes),'probeOverflow':0,'report':'补充制作记录/五页首版/交付状态.md','photoshopInteraction':False,'visualPixelAcceptance':'NOT CLAIMED'};dump(A/'交付清单与校验.json',summary)
dump(R/'最终回读校验.json',{'pages':len(pages),'trueTypeLayers':len(layers),'textChecks':layers,'probeCount':len(probes),'probeOverflow':0,'portableSourceReferences':len(portable),'uniquePortableSourceFiles':len(set(portable)),'newPNGs':len(files),'allSourceRuntimeHashMatch':True,'originalV2Hashes':{f.name:sha(f) for f in (A/'效果预览/效果图v2').glob('*.png')},'inputs':{f.name:sha(f) for f in (P/'assets/resources/first-release/prefabs').glob('*.prefab') if f.stem in ['HomeBuild','Dialog','Loading','PuzzlePage']},'puzzleGeometryExportPrefabHash':puzzle['source_prefab_sha256'],'indexBrowserEvidence':'tmp/prototype/first-release/art-index-check.json','toolCopy':{'source':'D:/CodexData/Temp/BigHero补给站对齐20261107/candidate/执行工具/psd_text_layers.py','target':'tools/first-release/psd_text_layers.py','source_sha256':sha(Path('D:/CodexData/Temp/BigHero补给站对齐20261107/candidate/执行工具/psd_text_layers.py')),'target_sha256':sha(Path(__file__).with_name('psd_text_layers.py')),'modifications':'none'}})
text='''# 五页首版美术交付状态（2026-11-08）

原始五张效果图仍在`效果预览/效果图v2/`，未覆盖。本次交付为当前Prefab、唯一PNG和配表快照重建的实现页面，不宣称与效果图逐像素一致或完整美术视觉验收。

- 20张新增运行PNG已登记统一`游戏素材/素材清单.json`；与运行资源逐文件SHA-256相同，来源与变换见本目录JSON记录。
- Loading、主页、建造、拼图、设置共5个PSD，38个真实Microsoft YaHei TypeLayer，保存后回读Unicode、字体、字号、颜色、段落、变换和UTF-16运行区间；实际图层强制合成与导出PNG最大通道差不超过2。
- 拼图保存19个独立孔格、18个独立拼块格、木底/木框/阴影3个参数化图层，首关classic-001原始格坐标、材质和几何在`游戏素材/页面配置/五页首版/拼图参数化组件.json`。没有整页截图平铺替代分层。
- `arts/index.html`选择“ 五页首版_建造”等页面，上方为真实v2原图与保存PSD的实际合成，下方列专属和公共依赖；默认全部素材包括新增资源。原图对照是原字节副本。
- 中文默认、代表性英文与数值增长共38个文字探针无溢出，实际字号与覆盖范围见`文字长文案与数值探针.json`；不代表所有语言完成验证。

## 使用和复现

常规生成入口为`npm run firstrelease:generate`，内部包含资源所有权检查；`generate-ui.mjs`和`generate-app.mjs`仅供集成人分步联调，不作为绕过wrapper的常规入口。

`tools/first-release/export-puzzle-art.mjs`只读导出首关几何；`art-closeout.py`生成分层PSD/合成/统一入口；`art-verify.py`复验文本、可移植来源与哈希。依赖本机已有Pillow、psd-tools和numpy，没有新增运行依赖。设置遮罩按实际Graphics fillColor(8,26,36,175)制作，预挂BlockInputEvents。

编辑源在`PSD/五页首版/`，游戏用PNG在`游戏素材/PNG/`，页面配置在`游戏素材/页面配置/五页首版/`，对照在`页面对照/`。当前家园样张快照为第2关/60币/第一建筑1级/其他0级/进度1/25；运行状态以存档为准。

## 保留的视觉差异

建筑复用既有向阳花园0..5级母件，造型与v2插画不同；v2地图经去建筑/蜜蜂补齐裸地形后叠独立实体。五建筑和锚点共根0.88缩放上移55，背景全屏，位置与原效果图不逐像素一致。

设置开关使用现有空白按钮表示状态；建设底栏、体力心形、Loading轨道复用旧公共素材，窄HUD钱包存在横向适配比例差异。上述差异保留在实际合成里，不能把功能联调通过写为全部美术验收。

执行的是psd-tools解析、真文本回读与实际图层合成，没有Photoshop交互。Creator导入及交互测试证据由集成人统一归档。音乐音效、Spine、新地图和新建筑仍按后补清单，不在本轮制作。
'''
(R/'交付状态.md').write_text(text,encoding='utf8',newline='\n')
# Keep original checksum entries for untouched legacy assets, update only this scope and shared indexes.
checks=read(A/'文件校验清单.json');byfile={v['file']:v for v in checks['files']};owned=[A/'index.html',A/'游戏素材/素材清单.json',A/'交付清单与校验.json']+[P/r['sourceFile'] for r in addition['records']]
for folder in ['PSD/五页首版','游戏素材/页面配置/五页首版','页面对照/PSD合成/五页首版','页面对照/原页面/五页首版','补充制作记录/五页首版']:owned.extend(f for f in (A/folder).rglob('*') if f.is_file())
for f in owned:
 relative=f.relative_to(A).as_posix();byfile[relative]={'file':relative,'bytes':f.stat().st_size,'sha256':sha(f)}
checks['files']=list(byfile.values());dump(A/'文件校验清单.json',checks)
print(json.dumps({'pages':len(pages),'trueTypeLayers':len(layers),'probeCount':len(probes),'newPNGs':len(files),'portableReferences':len(portable),'ownedChecksumsUpdated':len(owned)}))
