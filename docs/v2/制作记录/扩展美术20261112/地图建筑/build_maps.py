from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess,sys,json,time,os

V2=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2')
REC=V2/'制作记录/扩展美术20261112/地图建筑'
REF=V2/'效果图/S03_建造页_BlockHexa风格.png'
HELPER=Path('F:/qiguobing/git/Hexa Puzzle/Project/arts/补充制作记录/run_image_cli.py')
for x in [REC/'prompts',REC/'raw',REC/'logs',V2/'地图',V2/'图集/建筑',V2/'素材/建筑']:x.mkdir(parents=True,exist_ok=True)
MAPS=[
 ('M01','晨露蜂园','fresh mid-green meadow, simple blue sky and rounded low hills, winding pale stone path, narrow turquoise creek along lower left; retain the reference terrain, camera and five building locations exactly'),
 ('M02','繁花溪谷','fresh mid-green meadow valley, restrained pink and lavender flower patches at outer edges, a turquoise brook winding along lower left, rounded blue-green distant hills; same camera, path arrangement and five spacious building locations as reference, no dense flower carpet'),
 ('M03','巨树蜂城','a broad green woodland clearing around the roots of a giant friendly tree at the far rear edge; rounded foliage around outer edges, small turquoise spring along lower left, winding pale path; same camera and five spacious building locations as reference, no tree trunk covering a building location')]
BUILDINGS=[
 ('B01','M01','蜂巢主屋','hive main house, cream walls, teal three-module hexagonal honeycomb roof, amber trim, hexagonal door and windows; preserve reference upper center house identity'),
 ('B02','M01','采蜜工坊','honey workshop, cream walls, teal roof, amber hexagonal entrance and honey vats, preserve reference middle-left workshop identity'),
 ('B03','M01','花粉仓库','pollen warehouse, compact cream storage hut, amber honeycomb flower roof, hexagonal entrance, pollen sack, preserve reference middle-right identity'),
 ('B04','M01','蜂蜜水车','honey watermill with cream walls, teal roof, one clearly visible wooden waterwheel on right side, preserve reference lower-left watermill identity; NO creek or water background attached'),
 ('B05','M01','花园亭','small open-sided garden pavilion with amber flower-petal canopy and cream pillars, no walls, preserve reference lower-right pavilion identity'),
 ('B06','M02','花瓣蜂屋','cream bee house with rose-petal roof, teal accents, hexagonal door, distinctive rose flower identity'),
 ('B07','M02','酿蜜工坊','honey brewing workshop with cream walls, lavender-teal curved roof, golden honey tanks and short hexagonal chimney'),
 ('B08','M02','溪流磨坊','creek mill with cream walls, mint-teal leaf roof, a clearly visible pale wooden wheel and amber window, no creek or backdrop'),
 ('B09','M02','蜜罐商铺','little honey jar shop with cream curved walls, amber honey-jar-shaped roof and mint canopy, hexagonal windows, no writing or shop sign text'),
 ('B10','M02','花桥','small freestanding arched garden bridge, honeycomb rails, pale wood deck, rose petal posts, no water no land under it'),
 ('B11','M03','树洞蜂宫','freestanding tree-hollow bee palace, rounded pale wooden trunk shell, teal leaf-honeycomb crown roof, amber hexagonal doorway, royal bee motif, no background tree'),
 ('B12','M03','空中采蜜站','freestanding aerial nectar station on short sturdy tree stilts, a hexagonal landing deck, teal petal canopy, gold honey collector, compact visible supports'),
 ('B13','M03','树脂仓库','resin warehouse with rounded cream wooden walls, overlapping deep teal leaf roof, amber resin jars and honeycomb vents'),
 ('B14','M03','升降平台','freestanding bee village lift platform, pale wood upright frame, teal leaf canopy, honeycomb lift cage and gold counterweight, clearly readable pulley mechanism'),
 ('B15','M03','蜂群广场','freestanding small bee town plaza monument, hexagonal cream stone dais with golden honeycomb centerpiece and two teal leaf benches, no lawn or full environment')]
STYLE='''Reference image is an original bee village game design, STYLE AND CAMERA reference. Match its polished clean 2.5D casual mobile game art: rounded solid shapes, broad soft bevels, crisp edges, neutral daylight upper-left, cream, teal, amber, fresh green, no photoreal grain, no oil painting, no flat vector stand-in. No logo, no watermark, no gibberish. All materials and camera must be consistent.'''
JOBS=[]
for mid,name,desc in MAPS:
 prompt=f'''Use case: stylized-concept. {STYLE}
Create ONE complete portrait background image only, full bleed, no smartphone frame. Theme {name}: {desc}.
Remove every building, character, resource HUD, panel, progress dot, price, icon, text, scaffold and building foundation visible in the reference. Paint all previously hidden terrain naturally and completely. Keep empty clean grass patches for five future independent buildings: upper center, middle left, middle right, lower left beside creek, lower right. Landscape may include sparse small daisies and bushes at edges. Keep path connecting these positions. No houses or huts even in distance, no bridge building, no empty transparent holes, no silhouettes, no construction props. Camera lightly elevated frontal 2.5D, same reference perspective, same scene composition; map must extend behind the removed header and bottom panel. This is the bare reusable scene layer, not a finished UI screen.'''
 dest=V2/f'地图/{mid}_{name}_背景.png'
 JOBS.append(dict(id=mid,kind='background',name=name,prompt=prompt,out=str(dest),size='1024x2208'))
for bid,mid,name,desc in BUILDINGS:
 prompt=f'''Use case: stylized-concept game sprite sheet. {STYLE}
Create EXACTLY SIX separate upgrade states of ONE building: {name}, described as {desc}.
Output a wide landscape sprite sheet with EXACTLY THREE COLUMNS and TWO ROWS, equal cells, objects centered in their cell with wide empty margins. Top row left-to-right levels 0,1,2; bottom row left-to-right levels 3,4,5. No header/footer/captions/text/grid lines. NO seventh object or detached accessory. Six complete objects total, never cropped at sheet boundaries.
BACKGROUND MUST BE PERFECTLY UNIFORM FLAT PURE MAGENTA #FF00FF, including spaces inside arches and between columns. Magenta is a removable key, not part of the building. No vignette, no checkered background, no ground plane, NO cast shadow on background, NO green lawn tile under the building. Keep the object's own structural base/plinth, internal and contact shading. Do not use magenta or pink on the building itself; rose petals should be coral/peach instead.
All six states must share exactly the same camera direction (front slightly above, see front and right), left-to-right lighting, constant physical scale, centered feet baseline per cell and original building identity. Level0: a complete tiny low hexagonal foundation platform, no finished walls or roof, only a few tidy construction beams. Level1: simplest recognizable small usable version with core functionality. Level2: modest extra volume and one functional addition. Level3: visibly more complete two-part structure. Level4: larger enriched roof and another functional detail. Level5: fully complete handsome largest version, signature honeycomb ornament, richer but readable architectural silhouette. Differences must be architectural growth, NOT six recolors or six copies. Never reduce from level3 to level4. Level5 largest version still fits whole within its cell. Design for small mobile sprites. Do not depict a full village scene or UI.
The reference scene shows five DIFFERENT buildings: choose ONLY the specified {name}, not all five. Make the upgrade sequence immediately recognizable as that same building across six stages.'''
 dest=REC/f'raw/{bid}_{name}_key.png'
 JOBS.append(dict(id=bid,kind='building',map=mid,name=name,prompt=prompt,out=str(dest),size='3072x2048'))
(REC/'jobs.json').write_text(json.dumps(JOBS,ensure_ascii=False,indent=2),encoding='utf-8')
for j in JOBS:(REC/f'prompts/{j["id"]}.txt').write_text(j['prompt'],encoding='utf-8')

def run(j):
 out=Path(j['out'])
 if out.exists():return (j['id'],'existing')
 cmd=[sys.executable,str(HELPER),'edit','--image',str(REF),'--prompt-file',str(REC/f'prompts/{j["id"]}.txt'),'--model','gpt-image-2','--size',j['size'],'--quality','high','--no-augment','--out',str(out)]
 for attempt in range(2):
  started=time.time()
  r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',env={**os.environ,'PYTHONIOENCODING':'utf-8'})
  (REC/f'logs/{j["id"]}_{attempt}.log').write_text(r.stdout+'\n'+r.stderr,encoding='utf-8')
  if r.returncode==0 and out.exists():return (j['id'],f'ok {time.time()-started:.0f}s')
  print(j['id'],'retry; log saved',flush=True)
 return (j['id'],'FAILED')
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=2) as pool:
  futs=[pool.submit(run,j) for j in JOBS]
  for f in as_completed(futs):print(*f.result(),flush=True)
