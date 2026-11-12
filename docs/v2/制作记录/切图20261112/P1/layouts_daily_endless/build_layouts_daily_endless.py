"""P1 daily/endless/settings layout annotations; runtime code/assets unchanged."""
from pathlib import Path
import json,hashlib,math
REC=Path(__file__).resolve().parent
V2=REC.parents[3]; A=V2/'素材'; O=A/'布局'
def dump(p,j):p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def image(id,path,rect,slice=False,**kw):return dict(id=id,asset=path,rect=rect,**({'slice':True} if slice else {}),**kw)
def label(id,text,rect,size=32,color='#233E7C',**kw):return dict(id=id,type='label',text=text,rect=rect,fontSize=size,color=color,bold=True,align='center',verticalAlign='center',dynamic=True,**kw)
def ui(id,rect,folder='通用',state=None,slice=False,**kw):return image(id,'UI/'+folder+'/'+id+('_'+state if state else '')+'.png',rect,slice,**kw)
def icon(id,rect):return ui('icon_'+id,rect,'图标')
def bee(pose,rect):return image('bee_'+pose,'角色/bee_'+pose+'.png',rect)
def text_button(id,text,rect,kind='green',fs=38):
 x,y,w,h=rect
 return [image(id,'UI/通用/btn_'+kind+'_normal.png',rect,True),label(id+'_label',text,[x+12,y+6,w-24,h-12],fs,'#FFFFFF' if kind!='grey' else '#536B91')]
def write(sid,e,group,**kw):
 ref=next((V2/'效果图').glob(sid+'_*'))
 if sid=='S19':
  for x in e:
   if x.get('asset')=='UI/图标/icon_hint.png':x['tint']='#FFC63D'
 counts={}
 for x in e:
  key=x['id'];counts[key]=counts.get(key,0)+1
  if counts[key]>1:x['id']=key+'_'+str(counts[key])
 j=dict(page=sid,reference=ref.relative_to(V2).as_posix(),referenceSha256=hashlib.sha256(ref.read_bytes()).hexdigest(),size=[854,1842],designResolution=[853,1844],coordinateSystem='top-left, pixels; asset paths relative to 素材/',priority='P1',deliveryGroup=group,elements=e,**kw)
 dump(O/(sid+'.json'),j)
def mask():return ui('mask_black',[0,0,854,1842],opacity=.52)
def dialog(title,panel=[70,515,712,857],ribbon=[153,456,547,145],close=False):
 x,y,w,h=ribbon
 e=[mask(),ui('panel_dialog',panel,slice=True),ui('ribbon_title_blue',ribbon,slice=True),label('title',title,[x+40,y+38,w-80,h-55],43,'#FFFFFF')]
 if close:e+=[ui('btn_close_dialog',[722,y+8,52,52],state='normal')]
 return e
# S18: three rows and a completion reward. No screenshot fragments or baked text.
e=[mask(),ui('panel_feature',[26,485,801,999],slice=True),ui('panel_feature_crown',[140,320,565,245],slice=False),label('title','每日任务',[230,451,390,91],67,'#FFFFFF'),ui('btn_close',[728,454,90,100],state='normal'),label('daily_reset','每日0点刷新',[269,575,317,52],36)]
for i,(desc,progress,coin,kind,action) in enumerate([('完成1次拼图','1/1',30,'puzzle','领取'),('完成3次拼图','1/3',50,'puzzle','前往'),('完成1次建造','1/1',30,'build','领取')]):
 y=634+i*201;prefix='task_'+str(i+1)
 e += [image(prefix+'_row','UI/任务/task_row_'+('done' if i!=1 else 'normal')+'.png',[55,y,744,187],True),image(prefix+'_icon','UI/任务/task_icon_'+kind+'.png',[72,y+34,153,130]),label(prefix+'_description',desc,[243,y+37,236,53],37),image(prefix+'_progress_bg','UI/任务/task_progress_bar_bg.png',[245,y+104,233,43],True),image(prefix+'_progress_fill','UI/任务/task_progress_bar_fill.png',[250,y+109,223 if i!=1 else 70,33],True),label(prefix+'_progress',progress,[266,y+106,193,37],32,'#FFFFFF'),icon('coin',[513,y+29,77,77]),label(prefix+'_coins',str(coin),[515,y+105,78,49],38)]
 for b in text_button(prefix+'_action',action,[614,y+50,169,98],'green' if i!=1 else 'blue',40):e.append(b)
e += [ui('panel_inner',[56,1263,743,164],slice=True),label('completion_progress','今日完成 2/3',[76,1310,241,67],40),icon('chest_closed',[326,1286,127,126])]
# icon_chest has a stateful filename, unlike simple icons.
e[-1]['asset']='UI/图标/icon_chest_closed.png'
e += [icon('coin',[478,1294,74,74]),label('completion_coin','50',[478,1361,76,48],35),image('completion_claim','UI/通用/btn_green_disabled.png',[577,1306,208,87],True),label('completion_claim_text','完成后领取',[583,1320,197,60],31,'#FFFFFF')]
write('S18',e,'P1-3',overlay=True,underlay='S03',listViewport=[55,634,744,589],scrollContent='task_1_row..task_3_row',notes='功能大面板遵循紫框蜂巢顶饰；任务列表坐标是首屏示例，运行时用独立item Prefab复用。')

# S19: weekly cumulative reward lobby, independent from the current game score.
e=[image('background','背景/bg_puzzle.png',[0,0,854,1842])]
for id,name,box in [('home','home',[28,37,110,97]),('back','back',[148,37,115,97]),('help','help',[726,37,100,97])]:
 e += [image(id+'_button','UI/HUD/hud_btn_square_blue_normal.png',box),icon(name,[box[0]+24,box[1]+20,box[2]-48,box[3]-40])]
e += [bee('fly',[137,155,133,126]),label('event_title','蜂巢消消乐',[293,169,350,82],63,'#FFFFFF'),icon('honeycomb_deco',[643,201,73,61]),ui('puzzle_title_line',[269,254,367,24],'拼图'),ui('endless_score_panel',[36,320,782,169],'无尽',slice=True),label('weekly_label','本周积分',[147,340,190,49],41,'#FFFFFF'),label('record_label','最高纪录',[546,340,190,49],41,'#FFFFFF'),icon('coin',[125,388,77,77]),label('weekly_score','1,540',[206,391,170,72],57,'#FFFFFF'),icon('coin',[526,388,77,77]),label('record_score','2,680',[609,391,168,72],57,'#FFFFFF'),label('weekly_reset','每周一0点刷新',[265,493,330,53],31,'#FFFFFF')]
# Continuous node spine is behind each node and row; reached/unreached do not move.
for i in range(3):e += [image('stage_link_'+str(i),'UI/无尽/endless_stage_link_'+('reached' if i==0 else 'unreached')+'.png',[117,699+i*227,31,179])]
for i,(score,kind,amount,state) in enumerate([(500,'coin_pile',50,'claimed'),(1500,'coin_pile',100,'claimable'),(3000,'hint',1,'locked'),(6000,'coin_pile',150,'locked')]):
 y=[592,820,1047,1274][i]
 e += [image('stage_'+str(i)+'_row','UI/无尽/endless_stage_row.png',[215,y,597,136],True),image('stage_'+str(i)+'_node','UI/无尽/endless_stage_node_'+('reached' if i<2 else 'unreached')+'.png',[58,y-16,151,165]),label('stage_'+str(i)+'_threshold',format(score,','),[73,y+37,119,61],37,'#603B09' if i<2 else '#34496E'),icon(kind,[269,y+10,86,78] if i==3 else [257,y+23,110,104])]
 if i<3:e.append(label('stage_'+str(i)+'_reward',('金币' if kind=='coin_pile' else '提示')+' ×'+str(amount),[376,y+40,182,58],35))
 else:e += [label('stage_3_coin','金币×150',[254,y+94,130,38],29),label('stage_3_plus','+',[395,y+38,41,47],34),icon('energy',[451,y+21,73,73]),label('stage_3_energy','体力×1',[434,y+94,110,38],28)]
 if state=='claimable':
  for b in text_button('stage_'+str(i)+'_claim','领取',[600,y+26,184,88],fs=43):e.append(b)
 else:
  e += [image('stage_'+str(i)+'_status','UI/通用/tag_'+('claimed' if state=='claimed' else 'locked')+'.png',[597,y+33,194,66],True),ui('mark_check' if state=='claimed' else 'mark_lock',[620,y+46,38,39]),label('stage_'+str(i)+'_status_text','已领取' if state=='claimed' else '未解锁',[661,y+43,115,48],32,'#31664D' if state=='claimed' else '#5E6C84')]
e += text_button('start_challenge','开始挑战',[129,1482,595,166],fs=70)
e += [label('free_play','免费游玩',[330,1656,194,61],43,'#FFFFFF'),label('claim_reminder','奖励请及时领取',[214,1742,426,61],33,'#D5E7FA')]
write('S19',e,'P1-4',scrollViewport=[47,570,776,846],notes='所有币使用S02圆形蜜蜂币；体力文案不用爱心。周积分与最高纪录分别标注。')
# S20: true radius-4 axial 61-cell board. Existing geometry data remains authoritative.
geo=json.loads((V2/'制作记录/扩展美术20261112/页面/S20_几何配置.json').read_text(encoding='utf-8'))
assert len(geo['cells'])==61 and len({tuple(c) for c in geo['cells']})==61
expected={(q,r) for q in range(-4,5) for r in range(-4,5) if abs(q+r)<=4}
assert {tuple(c) for c in geo['cells']}==expected
colors={'#ffb82e':'1_png','#9567ee':'8_png','#ff657e':'10_png'}
def texture(stem):return next((A/'六角块/母件').glob(stem+'_*.png')).relative_to(A).as_posix()
e=[image('background','背景/bg_puzzle.png',[0,0,854,1842]),ui('hud_btn_square_blue',[28,37,110,96],'HUD',state='normal'),icon('home',[55,59,57,57]),image('settings_button','UI/HUD/hud_btn_square_blue_normal.png',[720,37,108,96]),icon('settings',[746,58,58,58]),bee('fly',[146,120,132,124]),label('event_title','蜂巢消消乐',[282,143,353,81],62,'#FFFFFF'),icon('honeycomb_deco',[627,170,70,58]),ui('puzzle_title_line',[263,244,365,25],'拼图')]
for id,text,box in [('score','本局 1,540',[95,279,310,75]),('record','最高 2,680',[455,279,310,75])]:e += [image(id+'_capsule','UI/HUD/hud_capsule_dark.png',box,True),label(id,text,[box[0]+16,box[1]+10,box[2]-32,box[3]-20],40,'#FFFFFF')]
occupied={(c['q'],c['r']):texture(colors[c['color']]) for c in geo['occupied']}
for i,(q,r) in enumerate(geo['cells']):
 cx=427+81*q;cy=776+math.sqrt(3)*54*(r+q/2)
 e.append(image('board_cell_'+str(i),occupied.get((q,r),'六角块/母件/empty_well.png'),[round(cx-54),round(cy-47),108,94],q=q,r=r,dynamic=True,generatedBy='endless_geometry'))
e.append(ui('puzzle_tray_frame',[30,1284,794,350],'拼图',slice=True))
for i,piece in enumerate(geo['tray']):
 pts=[(1.5*38*q,math.sqrt(3)*38*(r+q/2)) for q,r in piece];ox=[180,427,674][i]-(min(x for x,y in pts)+max(x for x,y in pts))/2;oy=1455-(min(y for x,y in pts)+max(y for x,y in pts))/2
 for n,((q,r),(x,y)) in enumerate(zip(piece,pts)):
  e.append(image(f'tray_{i}_cell_{n}',texture(['6_png','9_png','10_png'][i]),[round(ox+x-38),round(oy+y-33),76,66],pieceIndex=i,q=q,r=r,dynamic=True,generatedBy='endless_geometry'))
e += [ui('divider_gold',[72,1705,121,25],slice=True),label('rule_hint','三个方向填满整线即可消除',[209,1696,442,58],35,'#FFFFFF'),image('divider_right','UI/通用/divider_gold.png',[668,1705,121,25],True,flipX=True)]
write('S20',e,'P1-4',endlessGeometry={'radius':4,'cellCount':61,'coordinates':'axial q,r; pointy texture canvas with flat-topped footprint','source':'../制作记录/扩展美术20261112/页面/S20_几何配置.json','cells':geo['cells'],'occupied':geo['occupied'],'tray':geo['tray']},notes='61格与3块均由既有母件按独立坐标组合；不使用效果图棋盘截图。按3.1统一深色页蓝胶囊。')
# S21 and S22 are standard cream dialogs on the preserved live endless page.
e=dialog('本局结束',[70,490,712,915],[153,424,547,155])
e += [bee('celebrate',[351,591,152,157]),label('game_score','1,540',[279,744,296,91],76),label('game_score_label','本局得分',[336,832,182,41],28,'#8291A8'),label('best_label','本地最高分',[152,904,207,51],29),label('best_value','2,680',[572,900,128,55],39),label('weekly_delta_label','本局新增活动积分',[150,980,310,51],29),label('weekly_delta','+1,540',[546,978,158,55],39),label('reward_notice','阶段奖励请返回活动页领取',[237,1081,390,47],27,'#8B9AB0')]
e += text_button('retry','再来一局',[143,1190,568,105],fs=42)+text_button('return_event','返回活动',[143,1310,568,85],'grey',39)
write('S21',e,'P1-4',overlay=True,underlay='S20',underlayBlur=4,notes='结算标签单局得分/本周新增积分明确分开；阶段奖仅指引返回活动页领取。')
e=dialog('暂时离开？',[70,555,712,774],[153,503,547,135],True)
e += [bee('fly',[351,708,152,137]),label('preserve_board','棋盘与剩余拼块都会保留',[230,844,400,47],31),label('resume_caption','随时回来继续挑战',[272,897,310,47],28,'#8B9AB0')]
e += text_button('save_leave','保存并返回活动',[143,1020,568,105],fs=37)+text_button('continue','继续游戏',[143,1134,568,95],'blue',40)
e += [label('end_game','结束本局',[300,1259,256,51],32,'#C57075')]
write('S22',e,'P1-4',overlay=True,underlay='S20',underlayBlur=4,notes='保存返回、继续、结束本局分别标注；结束本局需运行时二次确认，不等同清空活动积分。')
# S23 uses independent toggle track and knob; on/off are also identified in labels.
e=dialog('设置',[70,548,712,791],[153,494,547,139],True)
for i,(id,txt,on) in enumerate([('music','音乐',True),('sound','音效',True),('vibration','震动',False)]):
 y=[750,900,1050][i];state='on' if on else 'off'
 e += [label(id+'_name',txt,[180,y+12,110,61],40),label(id+'_state','开启' if on else '关闭',[390,y+20,80,43],24,'#8B9AB0'),image(id+'_toggle_track','UI/通用/toggle_track_'+state+'.png',[509,y,183,79]),image(id+'_toggle_knob','UI/通用/toggle_knob_'+state+'.png',[620 if on else 509,y+3,72,72])]
e += text_button('done','完成',[143,1221,568,93],'blue',42)
write('S23',e,'P1-4',overlay=True,underlay='S02',underlayBlur=4,underlayDynamic=True,notes='示例来源为主页；运行时应保留实际来源页S02/S04/S20。三个开关独立，track/knob分离、文案同时表达状态，不新增语言/社交/付费入口。')
# Portable group metadata for integration; validate every PNG reference independently.
for group,sids in [('P1-3',['S18']),('P1-4',['S19','S20','S21','S22','S23'])]:
 manifest=[];missing=[]
 for sid in sids:
  p=O/(sid+'.json');j=json.loads(p.read_text(encoding='utf-8'))
  for el in j['elements']:
   if 'asset' in el and not (A/el['asset']).is_file():missing.append({'page':sid,'asset':el['asset']})
  manifest.append({'id':sid,'file':p.relative_to(V2).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'priority':'P1','group':group,'elements':len(j['elements'])})
 dump(REC/(group+'_manifest.json'),manifest)
 dump(REC/(group+'_verification.json'),{'group':group,'layouts':len(sids),'files':manifest,'allReferencesExist':not missing,'missing':missing,'S20Cells':61 if 'S20' in sids else None,'sourceReferences':'Viewed S18–S23 originals; source SHA registered in each layout.'})
print('P1 layouts complete: S18–S23')
