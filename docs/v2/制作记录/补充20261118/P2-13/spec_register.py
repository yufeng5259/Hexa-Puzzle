"""P2-13 exact allowlist and metadata update, preserving other delivery entries."""
import json,hashlib,subprocess,sys
from pathlib import Path
from PIL import Image
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BASE='0aea3fc'
SPEC={}
def add(tier,ids,size,slice=None):
 for id in ids.split():SPEC[id]=dict(tier=tier,size=size,slice=slice)
add('A','btn_green btn_blue btn_grey',[480,184],[92,40,92,48])
add('A','btn_close',[184,184]);add('A','hud_btn_square_blue',[204,184]);add('A','hud_btn_square_purple',[196,196])
add('A','home_side_entry',[280,280]);add('A','home_side_label',[264,98],[52,34,52,34]);add('A','icon_back',[232,196]);add('A','logo_title',[856,480])
add('A','toggle_knob',[136,136]);add('A','toggle_track',[372,156])
add('B','panel_dialog panel_feature',[512,512],[140]*4);add('B','panel_inner',[256,256],[68]*4)
add('B','ribbon_title_blue',[600,280],[200,16,200,36]);add('B','divider_gold',[480,48],[44,12,44,12])
add('B','hud_capsule_dark',[360,168],[90,56,90,56]);add('B','hud_capsule_light',[360,146],[80,48,80,48])
add('B','bar_bg bar_fill_green bar_fill_blue task_progress_bar_bg task_progress_bar_fill',[220,84],[44,20,44,20])
add('B','task_row',[512,320],[92]*4);add('B','endless_score_panel',[492,334],[114,112,114,112]);add('B','endless_stage_row',[532,270],[90,88,90,88])
add('B','endless_stage_node',[304,326]);add('B','endless_stage_link',[96,232],[16]*4)
add('B','puzzle_tray_frame',[360,360],[96]*4)
add('B','puzzle_btn_blue puzzle_btn_purple puzzle_btn_teal',[352,292],[86]*4)
add('B','puzzle_badge_count',[84,84]);add('B','puzzle_steps_plate',[332,124],[64,44,64,44])
add('B','home_bottom_bar',[400,230],[112,68,112,68]);add('B','home_btn_home',[272,200])
add('B','map_card',[360,360],[96]*4);add('B','map_tag_current',[348,108],[56,36,56,36])
add('B','build_dot_bar',[296,76],[38,24,38,24]);add('B','build_cost_capsule',[300,140],[70,46,70,46])
add('B','signin_cell',[480,560]);add('B','signin_cell_big',[1320,460])
add('C','task_icon_puzzle',[264,264])
def sha(b):return hashlib.sha256(b).hexdigest()
def baseline():return json.loads(subprocess.check_output(['git','show',BASE+':docs/v2/美术交付清单.json']).decode('utf8'))
def items(m):
 return [(e,SPEC[e['id']]) for e in m['uiAssets'] if e['id'] in SPEC]
if __name__=='__main__':
 m=json.loads((ROOT/'美术交付清单.json').read_text(encoding='utf8'))
 records=[]
 for e,s in items(m):
  for state,path in e['states'].items():
   old=subprocess.check_output(['git','show',BASE+':docs/v2/素材/'+path]);p=ROOT/'素材'/path
   from io import BytesIO
   oldim=Image.open(BytesIO(old));newim=Image.open(p)
   rec=dict(id=e['id'],state=state,file=path,**s,oldSize=list(oldim.size),oldSha256=sha(old),sha256=sha(p.read_bytes()),actualSize=list(newim.size),mode=newim.mode)
   records.append(rec)
   if '--register' in sys.argv:
    assert list(newim.size)==s['size'] and newim.mode=='RGBA',rec
    e.update(batch='P2-13',size=s['size'],scale=2,slice=s['slice'] or [0,0,0,0],source='P2-13 去残影' if s['tier']=='C' else 'P2-13 2 倍重绘：原造型配色，边缘抗锯齿')
    e['sha256'][state]=rec['sha256']
 assert len(records)==77,len(records)
 assert {t:sum(r['tier']==t for r in records) for t in 'ABC'}==dict(A=25,B=51,C=1)
 (HERE/'specification.json').write_text(json.dumps(dict(baseline=BASE,files=records),ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 if '--register' in sys.argv:(ROOT/'美术交付清单.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('77 files enumerated'+('; metadata updated' if '--register' in sys.argv else ''))
