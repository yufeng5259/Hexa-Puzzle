"""Read-only asset/overlay checks for this lane's fourteen new layouts."""
import json,hashlib
from pathlib import Path
V=Path(__file__).resolve().parents[4];A=V/'素材';O=A/'布局';R=Path(__file__).parent
groups={'P1-1':['S05','S07','S08','S09','S10','S11','S12'],'P1-2':['S01','S24','S13','S14','S15','S16','S25']}
def get(sid):return json.loads((O/(sid+'.json')).read_text(encoding='utf-8'))
report=[]
lookup={}
for p in [V/'制作记录/切图20261112/common/manifest.json',V/'制作记录/切图20261112/hud_puzzle/manifest.json']:
 for item in json.loads(p.read_text(encoding='utf-8')):
  for asset in item.get('states',{}).values():lookup[asset]=item
def check_slice(e):
 if not e.get('slice') or 'rect'not in e:return
 inset=lookup.get(e.get('asset'),{}).get('slice')
 if inset:
  assert e['rect'][2]>=inset[0]+inset[2] and e['rect'][3]>=inset[1]+inset[3],('nine-slice below fixed border',e)
 if 'fillAmount'in e:assert 0<=e['fillAmount']<=1 and e.get('fillMode')=='horizontal',e
for batch,sids in groups.items():
 for sid in sids:
  d=get(sid);ids=[e['id'] for e in d['elements']];assert len(ids)==len(set(ids)),sid
  for e in d['elements']:
   check_slice(e)
   if 'asset'in e:assert(A/e['asset']).is_file(),(sid,e['asset'])
   if e.get('type')=='label':
    assert all(k in e for k in ['fontSize','color','bold','outlineColor','outlineWidth']),e
    if any(c.isdigit() for c in e['text']):assert e['dynamic'],e
   assert 'rect'in e or e.get('anchor')=='building_feet',e
   if 'rect'in e:assert len(e['rect'])==4 and min(e['rect'][2:])>0,e
  if 'underlay'in d:
   under=get(d['underlay']);underids={e['id'] for e in under['elements']}
   assert set(d.get('underlayExcludeIds',[]))<=underids,(sid,'exclude id')
   assert set(d.get('underlayOverrides',{}))<=underids,(sid,'override id')
   for eid,patch in d.get('underlayOverrides',{}).items():
    if 'asset'in patch:assert(A/patch['asset']).is_file(),(sid,patch['asset'])
    original=next(e for e in under['elements'] if e['id']==eid)
    check_slice({**original,**patch})
  assert hashlib.sha256((V/d['reference']).read_bytes()).hexdigest()==d['referenceSha256'],sid
  report.append(dict(page=sid,batch=batch,elements=len(ids),sha256=hashlib.sha256((O/(sid+'.json')).read_bytes()).hexdigest(),
                     assetReferences='PASS',uniqueIds='PASS',overlayStateReferences='PASS',labelsAndDynamicNumbers='PASS',referenceHash='PASS'))
s5=get('S05');assert len(s5['puzzleGeometry']['targetCells'])==23
assert len([e for e in s5['elements'] if e['id'].startswith('board_cell_')])==23
assert len({e['pieceId'] for e in s5['elements'] if 'pieceId'in e})==3
(R/'validation.json').write_text(json.dumps(dict(status='PASS',layoutCount=len(report),checks=report,
 notes=['源图均实际目视检查；14页新布局，不修改P0布局或脚本','S05复用真实challenge-012几何及三个完整托盘，不将效果图作为运行资源','underlayOverrides按持久状态替换底页HUD/建筑/圆点；满级移除价格热区','S16缩略图fit=cover，需渲染器等比裁切支持']),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('PASS',len(report),'layouts, 23 challenge cells, 3 full tray pieces')
