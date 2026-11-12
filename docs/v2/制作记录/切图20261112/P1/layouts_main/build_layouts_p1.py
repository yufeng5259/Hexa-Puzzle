"""Source-coordinate P1 layouts; P0 files are read-only inputs, never regenerated."""
from pathlib import Path
import json,hashlib,math,copy,sys
V=Path(__file__).resolve().parents[4]
A=V/'素材';O=A/'布局';R=Path(__file__).parent
W,H=854,1842
def img(id,asset,rect,slice=False,**kw):
    return dict(id=id,asset=asset,rect=rect,**({'slice':True} if slice else {}),**kw)
def ui(id,rect,folder='通用',state=None,slice=False,**kw):
    return img(id,f'UI/{folder}/{id}{"_"+state if state else ""}.png',rect,slice,**kw)
def txt(id,text,rect,size=32,color='#233E7C',bold=True,dynamic=False,**kw):
    return dict(id=id,type='label',text=text,rect=rect,fontSize=size,color=color,bold=bold,
                align='center',verticalAlign='center',outlineColor=kw.pop('outlineColor','#00000000'),outlineWidth=kw.pop('outlineWidth',0),dynamic=dynamic,**kw)
def bee(id,pose,rect):return img(id,'角色/bee_'+pose+'.png',rect)
def btn(id,text,y,kind='green',h=92):
    return [img(id,f'UI/通用/btn_{kind}_normal.png',[143,y,568,h],True),txt(id+'_text',text,[153,y+8,548,h-16],35,'#FFFFFF' if kind!='grey' else '#536B91',dynamic=any(c.isdigit() for c in text))]
def load(sid):return json.loads((O/(sid+'.json')).read_text(encoding='utf-8'))
def write(sid,e,batch,**kw):
    for el in e:
        if el.get('type')=='label':
            if any(c.isdigit() for c in el['text']):el['dynamic']=True
            el.setdefault('outlineColor','#00000000');el.setdefault('outlineWidth',0)
    ids=[x['id'] for x in e];assert len(ids)==len(set(ids)),(sid,'duplicate ids')
    ref=next((V/'效果图').glob(sid+'_*')).relative_to(V).as_posix()
    d=dict(page=sid,reference=ref,size=[W,H],coordinateSystem='top-left, pixels; asset paths relative to 素材/',
           referenceSha256=hashlib.sha256((V/ref).read_bytes()).hexdigest(),designResolution=[853,1844],
           priority='P1',batch=batch,elements=e,**kw)
    (O/(sid+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def shell(title,panel=[70,550,712,790],ribbon=[153,493,547,132],close=False):
    e=[ui('mask_black',[0,0,W,H],opacity=.55),ui('panel_dialog',panel,slice=True),ui('ribbon_title_blue',ribbon,slice=True),
       txt('title',title,[ribbon[0]+20,ribbon[1]+25,ribbon[2]-40,ribbon[3]-40],41,'#FFFFFF')]
    if close:e += [ui('btn_close_dialog',[747,ribbon[1]+3,51,51],state='normal')]
    return e
def tex(n):return next((A/'六角块/母件').glob(n+'_*.png')).relative_to(A).as_posix()

def group1():
    base=load('S04')
    e=[copy.deepcopy(x) for x in base['elements'] if x.get('generatedBy')!='puzzle_geometry' and x['id']!='bee_fly']
    for el in e:
        if el['id']=='level_title':el['text']='第72关'
        if el['id']=='puzzle_title_line':el['rect']=[297,266,261,23]
        if el['id']=='puzzle_tray_frame':el['rect']=[23,1135,811,300]
        if el['id']=='puzzle_instruction':el['rect']=[253,1060,355,47]
        if el['id'] in ('divider_gold','divider_right'):el['rect'][1]=1071
        if el['id'].endswith('_button'):el['rect'][1]=1467
        if el['id'].endswith('_icon') and el['id'].split('_')[0] in ('undo','replay','hint'):el['rect'][1]=1498
        if el['id'].endswith('_text') and el['id'].split('_')[0] in ('undo','replay','hint'):el['rect'][1]=1622
        if el['id']=='puzzle_badge_count':el['rect'][1]=1476
        if el['id']=='hint_count':el['rect'][1]=1477
    e += [bee('bee_fly','fly',[146,168,145,151]),ui('puzzle_steps_plate',[301,286,252,64],'拼图','normal'),
          txt('steps_count','剩余步数 5',[310,294,234,47],31)]
    g=json.loads((V/'制作记录/扩展美术20261112/页面/S05_关卡引用.json').read_text(encoding='utf-8'))
    cat=json.loads((V.parent.parent/'assets/bundles/puzzle/config/level-catalog.json').read_text(encoding='utf-8'))
    level=next(l for l in cat['levels'] if l['id']==g['levelId'])
    pts=[(1.5*c['q'],math.sqrt(3)*(c['r']+c['q']/2)) for c in g['targetCells']]
    radius=min(660/(max(x for x,y in pts)-min(x for x,y in pts)+2),595/(max(y for x,y in pts)-min(y for x,y in pts)+math.sqrt(3)))
    cx=427-radius*(min(x for x,y in pts)+max(x for x,y in pts))/2
    cy=688-radius*(min(y for x,y in pts)+max(y for x,y in pts))/2
    filled={}
    for p,col in zip(level['pieces'][:2],['1_png','8_png']):
        for c in p['targetCells']:filled[(c['q'],c['r'])]=tex(col)
    for i,(c,(x,y)) in enumerate(zip(g['targetCells'],pts)):
        e.append(img('board_cell_'+str(i),filled.get((c['q'],c['r']),'六角块/母件/empty_well.png'),
                     [round(cx+radius*x-radius),round(cy+radius*y-radius*math.sqrt(3)/2),round(radius*2),round(radius*math.sqrt(3))],
                     q=c['q'],r=c['r'],dynamic=True,generatedBy='puzzle_geometry'))
    for i,p in enumerate(g['trayPieces']):
        pts=[(1.5*35*c['q'],math.sqrt(3)*35*(c['r']+c['q']/2)) for c in p['cells']]
        ox=[169,428,688][i]-(min(x for x,y in pts)+max(x for x,y in pts))/2
        oy=1285-(min(y for x,y in pts)+max(y for x,y in pts))/2
        for n,(x,y) in enumerate(pts):
            e.append(img(f'tray_{i}_cell_{n}',tex(['6_png','9_png','10_png'][i]),[round(x+ox-35),round(y+oy-30),70,61],pieceId=p['id'],generatedBy='puzzle_geometry',dynamic=True))
    write('S05',e,'P1-1',puzzleGeometry=g,
          notes='真实challenge-012几何；背景沿用P0深蓝渐变，不将S05效果图底部场景残片当新运行背景。')
    e=shell('再试一次吧')+[bee('bee_worry','worry',[354,668,147,155]),txt('failure_reason','剩余步数已用完',[223,858,408,51],34),
        txt('retry_energy','重新挑战需要 1 点体力',[207,919,440,43],27,'#8D96A7',False,dynamic=True)]
    e+=btn('retry','再试一次 · 1体力',1062)+btn('home','回家',1181,'grey',82)
    write('S07',e,'P1-1',overlay=True,underlay='S05',underlayOverrides={'steps_count':{'text':'剩余步数 0'}},modal=True,dismissOnMask=False)
    e=shell('回到家园？',close=True)+[bee('bee_fly','fly',[354,668,147,155]),txt('save_summary','当前进度可以保留',[202,848,450,51],34),
        txt('save_detail','下次回来，继续这一次拼图',[189,902,476,44],27,'#8D96A7',False)]
    e+=btn('save_home','保存并回家',1017)+btn('continue','继续拼图',1137,'blue')+[txt('abandon','放弃本局',[267,1253,320,42],27,'#A2796B',False,action='open_abandon_confirmation')]
    write('S08',e,'P1-1',overlay=True,underlay='S04',modal=True,dismissOnMask=True,
          interactionNotes='放弃本局打开S08-B二次确认；保存成功才回家。当前只交付S08主要状态布局。')
    e=shell('重新开始？',panel=[70,565,712,750],ribbon=[153,513,547,132],close=True)+[ui('icon_energy',[366,703,122,117],'图标'),
        txt('restart_warning','当前摆放将被清空',[222,864,410,48],34),txt('restart_cost','新开一局需要 1 点体力',[212,919,430,43],27,'#8D96A7',False,dynamic=True)]
    e+=btn('restart','确认重玩',1048)+btn('continue','继续当前局',1167,'grey',82)
    write('S09',e,'P1-1',overlay=True,underlay='S04',modal=True,dismissOnMask=True)
    e=shell('体力不足',panel=[70,525,712,825],ribbon=[153,470,547,132],close=True)+[ui('icon_energy',[350,653,154,132],'图标'),
        txt('energy_amount','0 / 5',[297,804,260,63],56,dynamic=True),txt('energy_timer','下点恢复 04:32',[224,897,406,49],33,dynamic=True),
        txt('energy_recovery','每5分钟恢复1点，离线也能恢复',[187,965,480,40],24,'#8D96A7',False,dynamic=True)]
    e+=btn('go_endless','去玩蜂巢消消乐',1098)+btn('return','返回',1217,'grey',82)
    write('S10',e,'P1-1',overlay=True,underlay='S03',underlayOverrides={'energy_value':{'text':'0/5'}},modal=True,dismissOnMask=True,
          conditionalElements={'go_endless':'无尽已解锁时可见；未解锁隐藏按钮并仅保留返回'},state='energy_insufficient')
    e=shell('金币不足',panel=[70,535,712,810],ribbon=[153,480,547,132],close=True)+[ui('icon_coin',[354,662,147,147],'图标')]
    for i,(name,value) in enumerate([('当前拥有','20'),('升级需要','100'),('还差','80')]):
        e += [txt('cost_label_'+str(i),name,[237,846+i*63,228,44],27,'#7A88A3',False),txt('cost_value_'+str(i),value,[535,846+i*63,117,44],33,dynamic=True)]
    e+=btn('play','去闯关',1103)+btn('later','稍后',1222,'grey',82)
    write('S11',e,'P1-1',overlay=True,underlay='S03',underlayOverrides={'coin_value':{'text':'20'}},modal=True,dismissOnMask=True)
    e=shell('提示不足',close=True)+[ui('icon_hint',[361,676,132,142],'图标',tint='#FFC63D'),txt('hint_inventory','当前提示 0',[245,858,364,50],35,dynamic=True),
        txt('hint_source','签到与活动奖励可以获得提示',[195,926,464,43],27,'#8D96A7',False),
        txt('hint_help','也可以先试着自己完成拼图',[201,979,452,43],27,'#8D96A7',False)]
    e+=btn('continue','继续挑战',1153)
    write('S12',e,'P1-1',overlay=True,underlay='S04',underlayOverrides={'hint_count':{'text':'0'}},modal=True,dismissOnMask=True,
          conditionalLabels={'hint_source':'按已解锁且实际存在的奖励来源替换文案'})
    manifest('P1-1',['S05','S07','S08','S09','S10','S11','S12'])

def manifest(batch,ids):
    rows=[]
    for sid in ids:
        p=O/(sid+'.json');d=json.loads(p.read_text(encoding='utf-8'))
        rows.append(dict(page=sid,file=p.relative_to(V).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),elements=len(d['elements']),
                         missingAssets=[x['asset'] for x in d['elements'] if 'asset'in x and not (A/x['asset']).is_file()]))
    (R/(batch+'_manifest.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(batch,[(r['page'],r['elements'],len(r['missingAssets'])) for r in rows])

def building_overrides(levels):
    """Only changes actual map state. Footprint and feet anchors remain the source layout's."""
    out={}
    m=json.loads((V/'地图/M01_建筑布局.json').read_text(encoding='utf-8'))
    for p,lv in zip(m['placements'],levels):
        bid=p['building'];out[bid]={'asset':p['stages'][lv]['file'].removeprefix('素材/'),'level':lv}
        for i in range(5):out[bid+f'_dot_{i+1}']={'asset':f'UI/建造/build_dot_{"done" if i<lv else "todo"}.png'}
    return out

def group2():
    e=[img('bg_loading','背景/bg_loading.png',[0,0,W,H]),ui('logo_title',[200,55,454,248]),
       bee('bee_loading','loading',[246,855,362,544]),
       ui('home_bottom_bar',[24,1498,806,155],'主页',slice=True),
       ui('bar_bg',[67,1528,720,81],slice=True),ui('bar_fill_green',[72,1533,464,71],slice=True),
       txt('loading_percent','65%',[320,1534,214,69],48,dynamic=True),
       txt('loading_caption','正在准备蜂巢家园…',[137,1663,580,58],40,'#FFFFFF',outlineColor='#397E53',outlineWidth=1)]
    write('S01',e,'P1-2',state='loading',notes='进度来自资源/配置/存档准备状态；失败转S24-A，不绘制假完成。')
    e=shell('进度暂未保存',panel=[70,547,712,780],ribbon=[153,496,547,132])+[bee('bee_worry','worry',[354,672,147,155]),
        txt('save_error','请重试保存当前进度',[207,850,440,51],34),txt('save_retained','当前拼图仍然保留在这里',[209,914,436,42],27,'#8D96A7',False),
        txt('save_advice','保存成功后，再离开游戏',[212,966,430,42],27,'#8D96A7',False)]
    e+=btn('retry_save','重试保存',1081)+btn('continue','继续当前局',1200,'grey',82)
    write('S24',e,'P1-2',overlay=True,underlay='S04',modal=True,dismissOnMask=False,state='save_failed',variant='S24-C',
          interactionNotes='仅标注S24-C参考主要状态；A/B/D/E文案与按钮由失败操作身份选择，不复用C的成功语义。')
    e=shell('玩家升级',panel=[70,532,712,816],ribbon=[153,475,547,132])+[ui('hud_level_badge',[349,658,156,158],'HUD'),
       txt('new_level_value','3',[370,687,114,91],80,dynamic=True),txt('new_level','新等级 3',[278,837,298,49],34,dynamic=True),
       ui('panel_inner',[234,899,389,223],slice=True),ui('icon_energy',[370,925,114,109],'图标'),
       txt('energy_reward','+1',[327,1033,200,58],47,dynamic=True),txt('reward_saved','升级奖励已到账',[290,1084,274,35],25,'#8D96A7',False)]
    e+=btn('confirm','确认',1214)
    ov=building_overrides([4,2,1,2,1]);ov.update({'player_level':{'text':'3'},'home_progress':{'text':'10/25'},'bar_fill_green_2':{'rect':[211,1751,170,36]}})
    write('S13',e,'P1-2',overlay=True,underlay='S03',underlayOverrides=ov,
          underlayExcludeIds=['bar_fill_green'],modal=True,dismissOnMask=False,
          contentBindings={'playerLevel':'persisted player level','rewardItems':'committed level-up reward','nextLevelExperience':'game state; visible only when corresponding progress row is enabled'})
    # Non-modal localized feedback. Keep the shared scene and new completed building real.
    e=[ui('hud_capsule_light',[537,236,296,67],'HUD',slice=True),
       txt('building_complete','建筑完成 · 金币+30',[549,248,272,42],24,dynamic=True)]
    ov=building_overrides([5,2,1,2,1]);ov.update({'player_level':{'text':'3'},'home_progress':{'text':'11/25'},'bar_fill_green':{'rect':[78,59,22,42]},'bar_fill_green_2':{'rect':[211,1751,187,36]}})
    exclusion=['B01_cost','B01_coin','B01_cost_text']
    write('S14',e,'P1-2',overlay=True,underlay='S03',underlayOverrides=ov,underlayExcludeIds=exclusion,modal=False,
          dismissOnMask=False,transientSeconds=2,notes='非模态到账反馈；主屋满级后移除其价格和购买热区，五点全绿。其余建筑仍可建造。')
    e=shell('晨露蜂园完工',panel=[70,478,712,934],ribbon=[153,415,547,145])+[bee('bee_celebrate','celebrate',[354,568,147,155]),
       txt('map_progress','25 / 25',[277,741,300,63],48,dynamic=True),txt('map_complete','五栋建筑全部完成',[237,805,380,44],29),
       ui('panel_inner',[234,869,389,224],slice=True),ui('icon_coin',[370,893,114,112],'图标'),
       txt('map_reward','+200',[322,1005,210,59],48,dynamic=True),txt('map_reward_label','地图完工奖励',[287,1055,280,35],25,'#8D96A7',False)]
    e+=btn('claim_next','领取并前往下一地图',1195)+btn('stay','留在这里',1313,'grey',82)
    ov=building_overrides([5,5,5,5,5]);ov.update({'player_level':{'text':'6'},'home_progress':{'text':'25/25'},'bar_fill_green_2':{'rect':[211,1751,426,36]}})
    ex=['bar_fill_green']+[f'B0{j}_{kind}' for j in range(1,6) for kind in ('cost','coin','cost_text')]
    write('S15',e,'P1-2',overlay=True,underlay='S03',underlayOverrides=ov,underlayExcludeIds=ex,modal=True,dismissOnMask=False,
          state='map_complete_reward_pending',notes='领取和切图分别处理；末地图改内容完成文案，不显示不存在的下一地图。底页当前M01五栋L5、全绿25点、无升级价格。')
    e=[img('background','../地图/M01_晨露蜂园_背景.png',[0,0,W,H])]
    s2=load('S02')
    # Reuse only the HUD own elements; no old scene or side entries appear in map selection.
    allowed={'hud_bar_bg','bar_bg','bar_fill_green','hud_level_badge','player_level','hud_energy','energy_icon','energy_value','hud_coin','coin_icon','coin_value','hud_btn_square_purple','icon_settings'}
    e += [copy.deepcopy(x) for x in s2['elements'] if x['id'] in allowed]
    e += [ui('hud_btn_square_blue',[22,162,108,101],'HUD','normal'),ui('icon_back',[46,184,61,58],'图标'),
          txt('title','蜂群地图',[268,169,326,73],52,'#FFFFFF',outlineColor='#2077B7',outlineWidth=2)]
    rows=[('m01','晨露蜂园','current',[24,296,807,514],[44,315,767,350]),('m02','繁花溪谷','locked',[24,828,807,388],[44,847,767,268]),('m03','巨树蜂城','locked',[24,1234,807,402],[44,1253,767,275])]
    for i,(mid,name,state,box,thumb) in enumerate(rows):
        e += [img(mid+'_card',f'UI/地图选择/map_card_{state}.png',box,True),
              img(mid+'_thumbnail',f'UI/地图选择/map_thumb_{mid}.png',thumb,fit='cover'),
              txt(mid+'_name',name,[62,box[1]+box[3]-129 if i==0 else box[1]+box[3]-88,243,64],43,dynamic=True)]
        if i==0:
            e += [ui('map_tag_current',[288,675,168,51],'地图选择'),txt('current_tag','当前地图',[300,682,144,39],25,'#FFFFFF'),
                  img('map_progress_bg','UI/通用/bar_bg.png',[66,740,451,42],True),img('map_progress_fill','UI/通用/bar_fill_green.png',[72,745,157,32],True),
                  txt('map_progress','9/25',[209,741,165,39],29,'#FFFFFF',dynamic=True),
                  img('enter','UI/通用/btn_blue_normal.png',[561,688,241,90],True),txt('enter_text','进入',[593,701,177,60],42,'#FFFFFF')]
        else:
            y=box[1]+box[3]-89
            e += [img(mid+'_lock','UI/通用/mark_lock.png',[365,y+8,62,59]),txt(mid+'_condition',f'完成{rows[i-1][1]}后解锁',[425,y+10,365,53],30)]
    e += [img('return_home','UI/通用/btn_blue_normal.png',[191,1673,472,122],True),txt('return_home_text','返回家园',[223,1694,408,75],49,'#FFFFFF')]
    write('S16',e,'P1-2',modal=False,state='map_selection',scrollArea=[20,288,815,1357],
          notes='缩略图用既有地图+满级建筑组合，fit=cover按目标裁切；未来地图不响应进入，不伪造可领奖红点。')
    e=shell('欢迎来到蜂巢小镇',panel=[70,475,712,936],ribbon=[153,413,547,145])+[bee('bee_celebrate','celebrate',[354,564,147,155]),
       txt('welcome_description','第一座建筑落成啦！',[203,751,448,50],34),
       ui('panel_inner',[166,830,233,263],slice=True),img('hint_reward_panel','UI/通用/panel_inner.png',[463,830,233,263],True),
       ui('icon_coin',[220,862,123,123],'图标'),txt('coin_reward','+100',[202,984,159,54],44,dynamic=True),txt('coin_label','金币',[229,1041,105,38],27,'#7888A6',False),
       ui('icon_hint',[522,858,113,130],'图标'),txt('hint_reward','+1',[500,984,159,54],44,dynamic=True),txt('hint_label','提示',[527,1041,105,38],27,'#7888A6',False),
       txt('welcome_caption','一起建设蜜蜂的家园吧',[208,1147,438,44],27,'#8D96A7',False)]
    e+=btn('claim_continue','领取并继续',1266)
    ov=building_overrides([1,0,0,0,0]);ov.update({'player_level':{'text':'1'},'energy_value':{'text':'5/5'},'coin_value':{'text':'60'},'home_progress':{'text':'1/25'},'bar_fill_green_2':{'rect':[211,1751,17,36]}})
    write('S25',e,'P1-2',overlay=True,underlay='S03',underlayOverrides=ov,modal=True,dismissOnMask=False,state='welcome_reward_pending',
          interactionNotes='一次持久化欢迎奖励和引导完成；保存失败保留待领奖态，不假显示到账、不因重新展示重复建造。')
    manifest('P1-2',['S01','S24','S13','S14','S15','S16','S25'])

if __name__=='__main__':
    if len(sys.argv)==1 or sys.argv[1]=='P1-1':group1()
    elif sys.argv[1]=='P1-2':group2()
