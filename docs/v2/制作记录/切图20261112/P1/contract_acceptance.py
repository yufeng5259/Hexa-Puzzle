"""Contract checks against the requested four P1 deliveries, independent of generators."""
from pathlib import Path
import json,hashlib,subprocess
R=Path(__file__).resolve().parents[3];A=R/'素材';REC=Path(__file__).resolve().parent
m=json.loads((R/'美术交付清单.json').read_text(encoding='utf-8'));d={x['id']:x for x in m['uiAssets']};sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for k,states in {'signin_cell':{'normal','today','claimed','locked'},'signin_cell_big':{'normal','today','claimed','locked'},'task_row':{'normal','done'},'map_card':{'current','done','locked'},'endless_stage_node':{'reached','unreached'},'endless_stage_link':{'reached','unreached'}}.items():assert set(d[k]['states'])==states,k
for k in ['bee_wave','bee_fly','bee_celebrate','bee_worry','bee_peek','bee_loading','signin_today_tag','task_icon_puzzle','task_icon_build','task_icon_endless','task_progress_bar_bg','task_progress_bar_fill','map_thumb_m01','map_thumb_m02','map_thumb_m03','map_tag_current','endless_score_panel','endless_stage_row','bg_endless']:assert d[k].get('states'),k
for k,lo,hi in [('bee_builder',2,4),('fx_build_scaffold',3,3),('fx_build_dust',4,6),('fx_build_sparkle',4,6),('fx_line_clear',4,6)]:
 a=d[k];assert lo<=len(a['frames'])<=hi and a['fps']>0,k;assert len({sha(A/p) for p in a['frames']})==len(a['frames']),(k,'duplicate frames')
assert d['fx_build_scaffold']['size']==[576,576];assert abs(d['fx_build_scaffold']['anchor'][1]-544/576)<1e-9
assert m['uiAssetDecisions']['endless_board_frame']['status']=='not_applicable';assert d['bg_endless']['states']['normal']==d['bg_puzzle']['states']['normal']
assert {a['id'] for a in m['uiLayouts']}=={f'S{i:02}' for i in range(1,26)}
for x in m['uiLayouts']:
 p=R/x['file'];j=json.loads(p.read_text(encoding='utf-8'));assert sha(p)==x['sha256'];assert not j.get('deferredElements'),j['page']
 for e in j['elements']:
  if e.get('asset'):assert (A/e['asset']).is_file(),(j['page'],e['asset'])
 for e in j.get('underlayOverrides',{}).values():
  if e.get('asset'):assert (A/e['asset']).is_file(),(j['page'],'override',e['asset'])
 # Marked underlay changes must refer to real ids, not silently do nothing.
 if j.get('underlay'):
  under=json.loads((A/'布局'/(j['underlay']+'.json')).read_text(encoding='utf-8'));ids={e['id'] for e in under['elements']}
  assert set(j.get('underlayOverrides',{}))<=ids,j['page'];assert set(j.get('underlayExcludeIds',[]))<=ids,j['page']
for sid,bee in [('S02','bee_wave'),('S03','bee_wave'),('S04','bee_fly'),('S06','bee_celebrate'),('S17','bee_peek')]:
 j=json.loads((A/'布局'/f'{sid}.json').read_text(encoding='utf-8'));assert any(e.get('asset')=='角色/'+bee+'.png' for e in j['elements']),sid
j=json.loads((A/'布局/S20.json').read_text(encoding='utf-8'));board=[e for e in j['elements'] if e['id'].startswith('board_')];assert len(board)==61,len(board)
for sid in ['S17','S18','S19','S20']:assert (REC.parent/'对照/P1/最终'/f'{sid}_原图对照.jpg').is_file(),sid
# Documentation changes are append-only; runtime paths stay outside our commits.
root=R.parents[1];orig=subprocess.check_output(['git','show','9515e71:docs/v2/03_美术切图任务.md'],cwd=root).decode().replace('\r\n','\n');assert (R/'03_美术切图任务.md').read_text(encoding='utf-8').startswith(orig)
for commit in ['aeeb1f0','5c77383','c4cf7b3']:
 names=subprocess.check_output(['git','diff-tree','--no-commit-id','--name-only','-r','-z',commit],cwd=root).decode().split('\0');assert all(not p or p.startswith('docs/v2/') for p in names),commit
report={'result':'PASS','p1StatesAndFrames':'all requested states and frame ranges covered','uniqueSequenceFrames':'PASS','layouts':25,'deferredElements':0,'sourceAndOverrideReferences':'PASS','endlessBoardCells':61,'finalComparisons':['S17','S18','S19','S20'],'documentBody':'unchanged; feedback appended','runtimeWrites':'none in P1 commits','conditionalAsset':'endless_board_frame not_applicable; original S20 has no separate frame'}
(REC/'contract_acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,ensure_ascii=False))
