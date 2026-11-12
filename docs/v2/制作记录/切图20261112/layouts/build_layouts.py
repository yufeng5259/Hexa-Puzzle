"""P0 source-coordinate annotations. Run from any directory; no runtime assets touched."""
from pathlib import Path
import json, hashlib, math

V2 = Path(__file__).resolve().parents[3]
OUT = V2 / '素材/布局'
OUT.mkdir(parents=True, exist_ok=True)
SIZE = [854, 1842]

def image(id, asset, rect, sliced=False, **kw):
    return dict(id=id, asset=asset, rect=rect, **({'slice': True} if sliced else {}), **kw)

def label(id, text, rect, size=32, color='#233E7C', bold=True, dynamic=False, **kw):
    return dict(id=id, type='label', text=text, rect=rect, fontSize=size, color=color,
                bold=bold, align='center', verticalAlign='center', dynamic=dynamic, **kw)

def ui(id, rect, folder='通用', state=None, sliced=False, **kw):
    return image(id, f'UI/{folder}/{id}{"_"+state if state else ""}.png', rect, sliced, **kw)

def hud(dark=False):
    e=[]
    if not dark:
        e += [ui('hud_bar_bg',[0,0,854,147],'HUD'),
              ui('bar_bg',[70,53,214,56],sliced=True),
              ui('bar_fill_green',[78,59,163,42],sliced=True),
              ui('hud_level_badge',[17,25,101,108],'HUD'),
              label('player_level','2',[27,48,77,69],52,dynamic=True)]
        capsules=[('energy',[299,44,189,72],[307,46,70,64],[381,53,96,54],'4/5'),
                  ('coin',[507,44,219,72],[506,40,79,79],[588,54,121,53],'1,280')]
    else:
        e += [ui('hud_btn_square_blue',[29,37,107,96],'HUD','normal'),
              ui('icon_home',[51,57,60,60],'图标')]
        capsules=[('energy',[146,44,218,86],[184,59,57,56],[246,59,90,55],'4/5'),
                  ('coin',[383,44,317,86],[425,49,72,72],[513,57,139,59],'1,280')]
    for name,box,iconbox,txtbox,txt in capsules:
        e += [image('hud_'+name, f'UI/HUD/hud_capsule_{"dark" if dark else "light"}.png',box,True),
              image(name+'_icon',f'UI/图标/icon_{name}.png',iconbox),
              label(name+'_value',txt,txtbox,38,'#FFFFFF' if dark else '#233E7C',dynamic=True)]
    e += [ui('hud_btn_square_'+('blue' if dark else 'purple'),[715,37,110,96] if dark else [740,29,101,100],'HUD','normal'),
          ui('icon_settings',[742,57,54,54] if dark else [760,47,62,65],'图标')]
    return e

MAP = json.loads((V2/'地图/M01_建筑布局.json').read_text(encoding='utf-8'))
LEVELS=[3,2,1,2,1]
def map_scene():
    e=[image('map_background','../'+MAP['background'],[0,0,*SIZE])]
    for p,lv in zip(MAP['placements'],LEVELS):
        w=round(p['render_width_fraction']*854)
        x,y=[p['normalized_feet'][i]*SIZE[i] for i in range(2)]
        ax,ay=p['anchor']
        e.append(image(p['building'],p['stages'][lv]['file'].removeprefix('素材/'),
                       [round(x-w*ax),round(y-w*ay),w,w], buildingId=p['building'],
                       level=lv, spriteAnchor=p['anchor'], zIndex=p['z_index']))
    return e

def write(sid,e,deferred=None,**kw):
    counts = {}
    for element in e:
        name = element['id']
        counts[name] = counts.get(name, 0) + 1
        if counts[name] > 1:
            element['id'] = name + '_' + str(counts[name])
    ref=next((V2/'效果图').glob(sid+'_*')).relative_to(V2).as_posix()
    data=dict(page=sid,reference=ref,size=SIZE,coordinateSystem='top-left, pixels; asset paths relative to 素材/',
              referenceSha256=hashlib.sha256((V2/ref).read_bytes()).hexdigest(),
              designResolution=[853,1844],priority='P0',elements=e,**kw)
    if deferred: data['deferredElements']=deferred
    (OUT/(sid+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

e=map_scene()+hud()+[label('map_name','晨露蜂园',[279,164,298,64],52,'#FFFFFF',dynamic=True,outlineColor='#2077B7',outlineWidth=2)]
for name,x,y,txt in [('signin',20,178,'签到'),('task',20,347,'任务'),('endless',691,177,'活动')]:
    e += [image(name+'_entry','UI/主页/home_side_entry.png',[x,y,141,152]),
          image(name+'_icon',f'UI/图标/icon_{name}.png',[x+23,y+8,95,100]),
          image(name+'_label_bg','UI/主页/home_side_label.png',[x+2,y+98,135,52],True),
          label(name+'_text',txt,[x+7,y+103,124,43],34)]
e += [ui('home_play_btn',[137,1555,584,149],'主页','normal',True),
      ui('home_play_level_arrow',[145,1560,192,134],'主页'),
      label('play_level','71',[176,1580,122,85],64,'#FFFFFF',dynamic=True,outlineColor='#6633A8',outlineWidth=3),
      label('play_text','开始游戏',[352,1581,306,87],61,'#FFFFFF',outlineColor='#17625E',outlineWidth=4),
      ui('home_bottom_bar',[7,1713,840,120],'主页',sliced=True),
      ui('home_btn_home',[54,1722,136,101],'主页','normal'),
      ui('icon_home',[75,1732,90,83],'图标'),
      ui('home_btn_build',[553,1726,256,89],'主页','normal',True),
      ui('icon_build',[602,1734,72,70],'图标'),label('build_text','建造',[679,1740,113,54],39)]
write('S02',e,[dict(id='bee_wave',priority='P1',rect=[528,1332,196,217],reason='角色属4.9 P1；未用原效果图裁片冒充独立切图')],
      existingAssetPolicy='复用M01裸背景和分级建筑；其与效果图建筑像素并非完全一致，保持已交付资产，不重做。')

e=map_scene()+hud()+[label('map_name','晨露蜂园',[279,164,298,64],52,'#FFFFFF',dynamic=True)]
anchorContext={}
for i,(p,lv) in enumerate(zip(MAP['placements'],LEVELS)):
    bid=p['building']; anchorContext[bid]=dict(feet=[round(p['normalized_feet'][j]*SIZE[j]) for j in range(2)],source='../地图/M01_建筑布局.json')
    # Reference source feet are a measurement, while new map feet come from the existing layout.
    # Anchors remain tied to the building at runtime, independent of canvas/safe-area scaling.
    def anch(id,asset,offset,size,**kw):
        return dict(id=id,asset=asset,anchor='building_feet',buildingId=bid,
                    offset=[offset[0]+size[0]/2,offset[1]+size[1]/2],offsetAnchor='center',size=size,**kw)
    e.append(anch(bid+'_dot_bar','UI/建造/build_dot_bar.png',[-71,3],[142,34]))
    for n in range(5):
        e.append(anch(bid+f'_dot_{n+1}',f'UI/建造/build_dot_{"done" if n<lv else "todo"}.png',[-59+n*26,7],[23,23],dynamic=True))
    e += [anch(bid+'_cost','UI/建造/build_cost_capsule_normal.png',[-110,30],[220,68],slice=True),
          anch(bid+'_coin','UI/图标/icon_coin.png',[-96,37],[53,53]),
          dict(id=bid+'_cost_text',type='label',text=str([100,80,60,80,60][i]),anchor='building_feet',buildingId=bid,
               offset=[31,64],offsetAnchor='center',size=[118,50],fontSize=36,color='#233E7C',bold=True,align='center',dynamic=True)]
e += [ui('home_bottom_bar',[8,1661,838,169],'主页',sliced=True),
      ui('home_btn_home',[35,1683,136,126],'主页','normal'),ui('icon_home',[59,1707,88,79],'图标'),
      label('home_progress_title','家园建设',[330,1688,197,51],37),
      ui('bar_bg',[205,1745,438,48],sliced=True),ui('bar_fill_green',[211,1751,156,36],sliced=True),
      label('home_progress','9/25',[375,1750,125,43],33,'#FFFFFF',dynamic=True),
      ui('icon_gift',[674,1672,140,142],'图标')]
write('S03',e,[dict(id='bee_wave',priority='P1',rect=[531,1412,192,218],reason='4.9角色未纳入P0')],anchorContext=anchorContext)

# Use the true 110-question identity. Fixed source-coordinate asset rectangles below
# make a transparent-asset reconstruction possible without a runtime Cocos renderer.
geo=json.loads((V2/'制作记录/BlockHexa首轮/S04_关卡引用.json').read_text(encoding='utf-8'))
catalog=json.loads((V2.parent.parent/'assets/bundles/puzzle/config/level-catalog.json').read_text(encoding='utf-8'))
level=next(p for p in catalog['levels'] if p['id']==geo['levelId'])
e=[image('background','背景/bg_puzzle.png',[0,0,*SIZE])]+hud(True)
e += [label('level_title','第71关',[325,187,240,78],61,'#FFFFFF',dynamic=True),
      ui('icon_honeycomb_deco',[561,219,72,56],'图标'),ui('puzzle_title_line',[279,266,282,23],'拼图'),
      ui('divider_gold',[82,1133,156,24],sliced=True),
      label('puzzle_instruction','拖动拼块，填满蜂巢',[253,1122,355,47],34,'#FFFFFF'),
      image('divider_right','UI/通用/divider_gold.png',[618,1133,156,24],True,flipX=True),
      ui('puzzle_tray_frame',[23,1217,811,327],'拼图',sliced=True)]
def texture(name):
    return next((V2/'素材/六角块/母件').glob(name+'_*.png')).relative_to(V2/'素材').as_posix()
filled={}
for p,name in zip(level['pieces'][:2],['1_png','8_png']):
    for c in p['targetCells']: filled[(c['q'],c['r'])]=texture(name)
for i,c in enumerate(level['targetCells']):
    q,r=c['q'],c['r'];cx=50+94*q;cy=453+105*(r+q/2)
    e.append(image('board_cell_'+str(i),filled.get((q,r),'六角块/母件/empty_well.png'),[round(cx-62),round(cy-54),124,108],
                   q=q,r=r,generatedBy='puzzle_geometry',dynamic=True))
for i,p in enumerate(geo['trayPieces']):
    pts=[(1.5*37*c['q'],math.sqrt(3)*37*(c['r']+c['q']/2)) for c in p['cells']]
    ox=[169,428,688][i]-(min(x for x,y in pts)+max(x for x,y in pts))/2
    oy=1378-(min(y for x,y in pts)+max(y for x,y in pts))/2
    for n,(x,y) in enumerate(pts):
        e.append(image(f'tray_{i}_cell_{n}',texture(['6_png','9_png','10_png'][i]),[round(x+ox-37),round(y+oy-32),74,64],pieceId=p['id'],generatedBy='puzzle_geometry',dynamic=True))
for name,color,x,title in [('undo','blue',91,'撤销'),('replay','purple',341,'重玩'),('hint','teal',591,'提示')]:
    e += [image(name+'_button',f'UI/拼图/puzzle_btn_{color}_normal.png',[x,1597,175,150],True),
          image(name+'_icon',f'UI/图标/icon_{name}.png',[x+39,1626,96,96]),
          label(name+'_text',title,[x+20,1752,135,43],34,'#FFFFFF')]
e += [ui('puzzle_badge_count',[706,1606,44,43],'拼图'),label('hint_count','5',[707,1607,41,40],35,'#FFFFFF',dynamic=True)]
underlayExcludeIds=[element['id'] for element in e if element.get('generatedBy')=='puzzle_geometry']
write('S04',e,[dict(id='bee_fly',priority='P1',rect=[151,171,128,129],reason='4.9角色属P1')],
      texturePolicy='关卡几何和pieceId保留classic-060；静态对照展示按S04上方蜜金/下方紫、托盘青蓝/青柠/桃粉映射美术母件颜色。',
      puzzleGeometry=dict(levelId=geo['levelId'],mainlineNumber=71,source='../制作记录/BlockHexa首轮/S04_关卡引用.json',
                          targetCells=geo['targetCells'],placedPieceIds=geo['placedPieceIds'],trayPieces=geo['trayPieces']))

e=[ui('mask_black',[0,0,*SIZE],opacity=0.55),ui('panel_dialog',[70,515,712,857],sliced=True),
   ui('ribbon_title_blue',[153,456,547,145],sliced=True),
   label('title','通关成功',[250,503,354,70],43,'#FFFFFF'),
   label('first_clear','第71关 · 首次通关',[245,775,365,43],32,dynamic=True),
   ui('panel_inner',[234,839,389,222],sliced=True),ui('icon_coin',[371,864,111,109],'图标'),
   label('reward_coin','+100',[330,974,194,56],49,dynamic=True),
   label('reward_status','金币已到账',[322,1023,211,35],25,'#8E9AAE',False),
   label('build_suggestion','金币充足，可以回家建造',[240,1095,374,45],27,'#6B80A1',False,dynamic=True),
   ui('btn_green',[143,1171,568,102],state='normal',sliced=True),
   label('next','下一关',[249,1192,356,58],37,'#FFFFFF'),
   ui('btn_grey',[143,1283,568,78],state='normal',sliced=True),
   label('return_build','回家建造',[250,1297,354,47],31,'#536B91')]
write('S06',e,[dict(id='bee_celebrate',priority='P1',rect=[354,614,147,155],reason='4.9角色属P1')],
      overlay=True,underlay='S04',underlayExcludeIds=underlayExcludeIds,
      underlayState='completed_cleared',notes='只标注本弹窗自身；通关后底页棋盘和托盘清空，排除underlayExcludeIds，不沿用未通关对局。')

e=[ui('mask_black',[0,0,*SIZE],opacity=0.45),ui('panel_feature',[42,450,774,1081],sliced=True),
   ui('panel_feature_crown',[210,320,434,203],sliced=True),label('title','七日签到',[266,414,335,88],68,'#FFFFFF',outlineColor='#51429A',outlineWidth=2),
   ui('btn_close',[700,420,103,100],state='normal'),label('caption','漏签保留进度',[311,1295,240,50],32),
   ui('btn_green',[207,1348,440,123],state='normal',sliced=True),label('claim','领取',[300,1370,254,75],58,'#FFFFFF')]
deferred=[dict(id='bee_peek',priority='P1',rect=[60,246,220,229],reason='4.9角色属P1')]
for i,(x,y,icon,value,status) in enumerate([(95,546,'coin','50','claimed'),(319,546,'energy','1','claimed'),(542,546,'coin','100','claimed'),(95,798,'hint','1','today'),(319,798,'coin','150','locked'),(542,798,'energy','2','locked')]):
    deferred.append(dict(id='signin_cell_'+str(i+1),asset=f'UI/签到/signin_cell_{status if status!="today" else "today"}.png',priority='P1',rect=[x,y,217,243],reason='4.6日格各状态属P1；P0对照留空，不用原图残片掩盖缺件'))
    e += [label('day_'+str(i+1),f'第{i+1}天',[x+37,y+7,148,43],31),
          image('reward_icon_'+str(i+1),f'UI/图标/icon_{icon}.png',[x+64,y+56,89,89]),
          label('reward_'+str(i+1),value,[x+54,y+143,110,50],39,dynamic=True)]
    if status in ('claimed','locked'):
        e.append(image('state_'+str(i+1),f'UI/通用/mark_{"check" if status=="claimed" else "lock"}.png',[x+72,y+180,74,67]))
    else:e.append(label('today','今日',[x+57,y+188,111,45],31,'#2878BA'))
deferred.append(dict(id='signin_cell_big_7',asset='UI/签到/signin_cell_big_locked.png',priority='P1',rect=[107,1055,642,218],reason='4.6日格属P1'))
e += [label('day_7','第7天',[339,1059,178,58],35),ui('icon_coin',[234,1122,96,94],'图标'),
      label('reward_7_coin','200 +',[330,1133,147,56],43,dynamic=True),ui('icon_hint',[484,1116,83,96],'图标'),
      label('reward_7_hint','1',[571,1134,45,56],43,dynamic=True),ui('mark_lock',[388,1202,79,75])]
write('S17',e,deferred,overlay=True,underlay='S03',priorityNote='P0验收附加布局，仅验证P0通用大面板与图标；P1日格和角色尚未交付，不代表签到页完整验收。')

summary={sid:dict(elements=len(json.loads((OUT/(sid+'.json')).read_text(encoding='utf-8'))['elements'])) for sid in ['S02','S03','S04','S06','S17']}
(Path(__file__).parent/'layout_summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(summary))
