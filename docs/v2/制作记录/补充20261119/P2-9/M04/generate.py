from pathlib import Path
import json,hashlib,subprocess,sys,time
from concurrent.futures import ThreadPoolExecutor,as_completed
V=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2'); R=V/'制作记录/补充20261119/P2-9'; T=Path('D:/CodexData/Temp/P2-9')
STYLE='Match attached bee village original style: polished clean rounded 2.5D casual mobile game solids, broad smooth bevels, soft contact shading, frontal slightly elevated three-quarter camera showing front and right, neutral upper-left daylight. Crisp rich charming toy-like architecture, no photorealism, no painterly texture, no flat vector. Reference is STYLE ONLY. Never its UI or text.'
BUILD={
'M04':[('B16','花田蜂舍','tulip-field bee cottage, cream walls, rounded orange tiled roof with blue-violet petal eaves, gold honeycomb dormer window and honey-drop finial; spacious main dwelling'),('B17','花蜜榨坊','nectar press workshop, cream walls, blue-violet curved roof, visible wooden lever press, amber honey vat and hexagonal vents'),('B18','球根温室','bulb greenhouse, pale timber frame with arched turquoise glass roof, contained small tulip bulbs, amber honeycomb window and pot shelving; no garden ground tile'),('B19','运河花船','canal flower barge, rounded wooden hull, cream covered cabin, orange tulip cargo planters, golden honeycomb rails; no water attached'),('B20','大风车','large countryside windmill, tapered cream tower, orange cap, four broad wooden blades with clearly visible HEXAGONAL honeycomb mesh inserts, bee-wing vane; no surrounding land')],
'M05':[('B21','灯塔蜂屋','white coastal lighthouse bee house, red-orange roof, stout tower with hexagonal amber lantern room and attached cream dwelling, bee-wing finial'),('B22','装瓶工坊','white honey bottling workshop, red-orange roof, open hexagonal doorway revealing amber honey bottles and compact brass bottling pipes, blue trim'),('B23','码头货仓','white dock cargo warehouse, red roof, broad sea-blue plank doors with golden hexagon fittings, honey crates and one tidy amber barrel'),('B24','起重吊臂','wooden and brass harbor crane, sea-blue canopy, honeycomb counterweight and suspended golden honey crate, sturdy narrow structural base, clearly readable mechanism'),('B25','远航蜂船','expedition bee sailboat at rest, cream hull with red and blue trim, amber prow, tall cream sail displaying a BEE WING AND HEXAGON graphic, golden honey lanterns; NO letters or water attached')]
}
BG={'M04':'Windmill flower fields WITHOUT WINDMILLS OR BUILDINGS. Dominant purple and orange stripes of low tulip fields, warm soil paths, narrow turquoise canal near lower left, distant rounded gentle hills. Not another green meadow. Only sparse small trees at outer edges.', 'M05':'Honey harbor coast: dominant sea blue and cream white, red-orange low flowers at outer edges, NO red roofs or buildings. Upper coastal slope and distant rounded hills, lower half turquoise harbor water, wooden connecting piers and rounded outer reefs. Empty flat pale dock lots joined by boardwalks, no ships or buildings even distant.'}
J=[]
for mid,bs in BUILD.items():
 d=R/mid
 for f in ['raw','prompts']:(d/f).mkdir(parents=True,exist_ok=True)
 coords=([(0.5,.39),(.76,.51),(.23,.735),(.76,.72),(.245,.86)] if mid=='M04' else [(.5,.39),(.245,.505),(.76,.505),(.25,.725),(.775,.71)])
 lots='; '.join(f'({(133+854*x)/1120:.3f},{(103+1842*y)/2048:.3f})' for x,y in coords)
 prompt=f'''Use case: stylized-concept. {STYLE}
Create ONE full bleed portrait EMPTY GAME MAP environment. Theme: {BG[mid]}
Expanded full-world canvas, central original view x=133..987,y=103..1945 in 1120x2048 output. Natural scene continues to all edges. Reserve five EMPTY flat, slightly lighter usable plots with feet near normalized image coordinates {lots}. Each lot has generous empty space above it for a future sprite. No geometric markers or outlines. Top 18% and bottom 12% of central view nonessential scenery. High camera sees terrain behind future buildings, sky and distant hills only in top part. No giant foreground foliage covering plots. NO buildings, houses, foundations, characters, animals, UI, icons, panels, lettering, signs, letters, numbers, watermark, flags or religious symbols. Bare reusable landscape layer, all architecture added separately later.'''
 p=d/'prompts/background.txt';p.write_text(prompt,encoding='utf-8')
 J.append(dict(map=mid,id='background',prompt=str(p),out=str(d/'raw/background.png'),size='1120x2048',refs=[str(V/'地图/M01_晨露蜂园_背景.png'),str(V/'效果图/S03_建造页_BlockHexa风格.png')]))
 for bid,name,desc in bs:
  prompt=f'''Use case: stylized-concept GAME SPRITE SHEET. {STYLE}
ONE original bee-world building: {name}: {desc}.
EXACTLY SIX complete upgrade states of SAME building, EXACT THREE COLUMNS TWO ROWS equal-cell landscape sprite sheet. Reading order top row L0,L1,L2 then bottom L3,L4,L5. No caption, labels, letters, numbers, grid lines or frames. At least 70px empty margins around every object in each cell. Six complete objects total, no detached accessories, no cropped pieces, never cross cell boundaries.
L0 empty low hexagonal foundation with bee ornament, no walls or finished building. L1 smallest recognizable simple usable version. L2 meaningful functional expansion plus taller walls. L3 complete functional mid-sized building with architectural additions. L4 clearly larger, expanded roof and additional functional apparatus. L5 largest most ornate, rich honeycomb crown or bee-wing finial, gold trim, lanterns, genuine expanded architecture, clean readable silhouette. Different architecture, not six recolors or scaled copies. Approximate height L1=60%,L3=80%,L5=100%. All same fixed camera, lighting, physical world scale, feet center and baseline in every equal cell. All stages contain unmistakable honeycomb/bee features.
BACKGROUND perfectly uniform PURE MAGENTA #FF00FF, including through openings and gaps. No cast shadows on background, no gradients or checkerboard. Chroma key not part of building. NO magenta or pink on building, use orange/coral or blue-violet instead. No magenta reflections/fringes. No lawn tile, water tile, landscape or huge plinth, only narrow structural base. No characters, people, national flags, religious worship symbols, lettering or watermark. References STYLE ONLY, create ONLY specified building.'''
  p=d/f'prompts/{bid}.txt';p.write_text(prompt,encoding='utf-8')
  J.append(dict(map=mid,id=bid,name=name,prompt=str(p),out=str(d/f'raw/{bid}_key.png'),size='3072x2048',refs=[str(V/'效果图/S03_建造页_BlockHexa风格.png'),str(V/'制作记录/扩展美术20261112/地图建筑/raw/B01_蜂巢主屋_key.png')]))
for mid in BUILD:
 jobs=[{**j,'model':'gpt-image-2','quality':'high','source_reference_sha256':{str(Path(r).relative_to(V)):hashlib.sha256(Path(r).read_bytes()).hexdigest() for r in j['refs']}} for j in J if j['map']==mid]
 (R/mid/'jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2),encoding='utf-8')
def run(j):
 if Path(j['out']).exists():return j['map']+'/'+j['id']+' existing'
 args=[sys.executable,str(T/'run_cli.py'),'edit']
 for r in j['refs']:args+=['--image',r]
 args+=['--prompt-file',j['prompt'],'--model','gpt-image-2','--size',j['size'],'--quality','high','--no-augment','--out',j['out']]
 start=time.time();p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace');(T/f'{j["map"]}_{j["id"]}.log').write_text(p.stdout+'\n'+p.stderr,encoding='utf-8')
 return f'{j["map"]}/{j["id"]} exit={p.returncode} seconds={time.time()-start:.0f}'
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=2) as pool:
  for f in as_completed([pool.submit(run,j) for j in (J[:1] if '--first' in sys.argv else J)]):print(f.result(),flush=True)

