"""P2-12 离线合成对照。仅生成制作记录，不生成或修改运行素材。"""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / '素材'
OUT = ROOT / '制作记录/补充20261117/对照'
RANK = 'UI/排行榜/'
IDS = 'bear rabbit fox cat dog panda raccoon hedgehog squirrel frog duck chick sloth monkey tiger lion elephant giraffe hippo crocodile seal owl penguin koala'.split()
BG = ['#FFFFFF', '#F6EBD2', '#0E2A5C', '#7CC44E']
AVCOL = ['#C6E6F5', '#EAD3FA', '#FFE1B3', '#D0EDBC', '#F5CBD4', '#C9E8DF']
MANIFEST = json.loads((ROOT / '美术交付清单.json').read_text(encoding='utf-8'))
RESAMPLE = Image.Resampling.LANCZOS

def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc', size)

def text(im, xy, value, size=26, fill='#503D2A', anchor='mm', bold=False):
    ImageDraw.Draw(im).text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)

def read(path):
    return Image.open(ART / path).convert('RGBA')

def nine(im, target, cuts, scale=1):
    """在显示坐标下保留原切片角尺寸；2倍素材先等比缩为1倍。"""
    if scale != 1:
        im = im.resize((im.width // scale, im.height // scale), RESAMPLE)
    l, t, r, b = [int(v / scale) for v in cuts]
    w, h = target
    if w < l+r or h < t+b:
        raise ValueError(f'九宫格目标过小：{target}, {cuts}')
    xs, ys = [0, l, im.width-r, im.width], [0, t, im.height-b, im.height]
    dx, dy = [0, l, w-r, w], [0, t, h-b, h]
    out = Image.new('RGBA', target)
    for y in range(3):
        for x in range(3):
            sz = dx[x+1]-dx[x], dy[y+1]-dy[y]
            if min(sz) > 0:
                patch = im.crop((xs[x], ys[y], xs[x+1], ys[y+1])).resize(sz, RESAMPLE)
                out.alpha_composite(patch, (dx[x], dy[y]))
    return out

def put(im, path, rect, cuts=None, scale=1):
    x, y, w, h = [int(v) for v in rect]
    source = read(path)
    source = nine(source, (w,h), cuts, scale) if cuts else source.resize((w,h), RESAMPLE)
    im.alpha_composite(source, (x,y))

def reuse(im, id, rect, state=None):
    item = next(x for x in MANIFEST['uiAssets'] if x['id'] == id)
    states = item['states']
    path = states.get(state, next(iter(states.values())))
    put(im, path, rect, item.get('slice'), item.get('scale', 1))

def save(im, name):
    OUT.mkdir(parents=True, exist_ok=True)
    im.convert('RGB').save(OUT / ('P2-12_' + name + '.png'))

def base():
    return read('背景/bg_puzzle.png').resize((853,1844), RESAMPLE)

def avatar(im, animal, x, y, side=96, colour=0, frame='normal'):
    bg = read(RANK+'avatar_bg.png')
    bg = ImageChops.multiply(bg, Image.new('RGBA',bg.size,AVCOL[colour % 6]))
    im.alpha_composite(bg.resize((side,side),RESAMPLE),(int(x),int(y)))
    put(im,RANK+'avatar/avatar_'+animal+'.png',(x,y,side,side))
    padding = side / 16
    put(im,RANK+'avatar_frame_'+frame+'.png',(x-padding,y-padding,side+2*padding,side+2*padding))

def progress(im, rect, proportion, label):
    x,y,w,h = rect
    reuse(im,'bar_bg',rect)
    fill = nine(read('UI/通用/bar_fill_green.png'),(w,h),(22,10,22,10))
    im.alpha_composite(fill.crop((0,0,int(w*proportion),h)),(x,y))
    text(im,(x+w/2,y+h/2),label,24,'#FFFFFF',bold=True)

def button(im, rect, label, grey=False):
    reuse(im,'btn_grey' if grey else 'btn_green',rect,'normal')
    x,y,w,h = rect
    text(im,(x+w/2,y+h/2-3),label,32,'#FFFFFF',bold=True)

def s26():
    im = base()
    put(im,'UI/图标/icon_back.png',(40,55,52,52))
    text(im,(426,78),'蜂群联赛',43,'#FFF0BD',bold=True)
    ImageDraw.Draw(im).ellipse((775,58,815,98),outline='#FFF0BD',width=3)
    text(im,(795,79),'i',30,'#FFF0BD',bold=True)
    for i,label in enumerate(['每日','每周','总榜']):
        put(im,RANK+('tab_selected.png' if i==0 else 'tab_normal.png'),(49+i*254,135,240,80),(40,40,40,40),2)
        text(im,(169+i*254,173),label,31, '#513610',bold=i==0)
    put(im,RANK+'league_badge_1.png',(92,234,112,123))
    text(im,(253,262),'工蜂联赛',33,'#FFF0BD',anchor='lm',bold=True)
    progress(im,(274,307,425,42),.68,'34 / 50')
    put(im,RANK+'icon_league_star.png',(225,301,54,54))
    reuse(im,'hud_capsule_light',(289,373,275,52))
    text(im,(426,398),'剩余 23:58:11',24)
    for rank,animal,x,y,w,h,nick,score in [(2,'rabbit',103,579,200,120,'花粉兔','1,150'),(1,'bear',316,539,220,160,'蜜糖熊','1,280'),(3,'fox',549,599,200,100,'嗡嗡狐','1,080')]:
        put(im,RANK+f'podium_{rank}.png',(x,y,w,h))
        avatar(im,animal,x+w/2-59,y-128,118,rank-1,['','gold','silver','bronze'][rank])
        put(im,RANK+f'rank_medal_{rank}.png',(x+w/2-24,y-19,48,48))
        text(im,(x+w/2,y+4),str(rank),24,bold=True)
        text(im,(x+w/2,y+46),score,25,'#4D3E29',bold=True)
        text(im,(x+w/2,725),nick,25,'#FFF0BD')
    names=['蜂蜡小猫','蜜风小狗','甜甜熊猫','嗡嗡浣熊','蜜罐刺猬','花蜜松鼠','晨露蛙']
    for i in range(7):
        y=760+i*120
        put(im,RANK+'rank_row_normal.png',(47,y,760,114),(48,48,48,48),2)
        text(im,(90,y+55),str(i+4),31,bold=True)
        avatar(im,IDS[i+3],130,y+9,96,i)
        text(im,(249,y+42),names[i],27,anchor='lm',bold=True)
        put(im,'UI/图标/icon_coin.png',(251,y+66,29,29))
        text(im,(290,y+81),'20',21,anchor='lm')
        text(im,(760,y+57),f'{1020-i*65:,}',29,anchor='rm',bold=True)
    put(im,RANK+'rank_row_self.png',(47,1624,760,120),(48,48,48,48),2)
    text(im,(90,1684),'12',31,bold=True)
    avatar(im,'player_bee',130,1636,96,2,'self')
    text(im,(250,1684),'我',31,anchor='lm',bold=True)
    text(im,(755,1684),'540',31,anchor='rm',bold=True)
    button(im,(238,1760,377,68),'去挑战')
    save(im,'S26_排行榜页示意')

def rewards(im, y, coin='150', energy='1', hint='1'):
    for i,(icon,value) in enumerate([('coin',coin),('energy',energy),('hint',hint)]):
        x=132+i*202
        reuse(im,'panel_inner',(x,y,185,176))
        put(im,'UI/图标/icon_'+icon+'.png',(x+49,y+16,88,88))
        text(im,(x+92,y+139),value,33,bold=True)

def s27():
    im=base()
    im.alpha_composite(Image.new('RGBA',im.size,(0,0,0,145)))
    reuse(im,'panel_dialog',(86,454,680,1000))
    put(im,'UI/通用/ribbon_win_gold.png',(146,399,560,140))
    text(im,(426,464),'联赛奖励',39,'#5F3A08',bold=True)
    text(im,(426,558),'昨日第 1 名',37,bold=True)
    put(im,RANK+'gift_gold_open.png',(266,608,320,352))
    rewards(im,974)
    put(im,RANK+'league_badge_2.png',(178,1184,110,121))
    text(im,(335,1215),'晋升 · 采蜜蜂！',31,anchor='lm',bold=True)
    put(im,RANK+'icon_league_star.png',(335,1251,46,46))
    text(im,(398,1274),'+20 联赛星',26,anchor='lm')
    button(im,(195,1331,463,88),'领取')
    save(im,'S27_联赛结算示意')

def s06():
    im=base()
    text(im,(426,215),'第 12 关',44,'#FFF0BD',bold=True)
    # 使用已交付六角母件组合完成态棋盘，避免拿带文字的效果图当切图。
    tiles=list((ART/'六角块/母件').glob('*_png_*.png'))
    for q in range(-3,4):
        for r in range(max(-3,-q-3),min(3,-q+3)+1):
            p=tiles[(q-r)%len(tiles)]
            put(im,str(p.relative_to(ART)),(373+q*78,690+(r+q*.5)*90,104,90))
    im.alpha_composite(Image.new('RGBA',im.size,(0,0,0,150)))
    reuse(im,'panel_dialog',(86,610,680,720))
    put(im,'UI/通用/win_panel_header.png',(146,440,560,180))
    put(im,'UI/通用/ribbon_win_gold.png',(146,540,560,140))
    text(im,(426,602),'通关！',44,'#5F3A08',bold=True)
    text(im,(426,722),'第 12 关完成',34,bold=True)
    for x,icon,value in [(154,'coin','+150'),(449,'exp','+30')]:
        reuse(im,'panel_inner',(x,791,250,208))
        put(im,'UI/图标/icon_'+icon+'.png',(x+73,812,104,104))
        text(im,(x+125,957),value,36,bold=True)
    text(im,(426,1043),'金币充足，可以建造了！',27)
    button(im,(177,1102,500,88),'下一关')
    button(im,(177,1200,500,88),'回家建造',True)
    put(im,'UI/通用/reddot.png',(639,1204,26,26))
    save(im,'S06_胜利弹窗示意')

def avatar_sheet():
    im=Image.new('RGBA',(1392,1280),'#203455')
    text(im,(696,40),'24 动物头像 · 六种底色 · 同一普通框',30,'#FFFFFF',bold=True)
    for i,id in enumerate(IDS):
        x=36+(i%6)*228; y=90+(i//6)*238
        avatar(im,id,x+16,y,188,i%6)
        text(im,(x+110,y+213),id,22,'#FFFFFF')
    for i,frame in enumerate(['gold','silver','bronze','self']):
        x=210+i*260
        avatar(im,IDS[i] if i<3 else 'player_bee',x,1080,150,i,frame)
        text(im,(x+75,1252),frame,22,'#FFFFFF')
    save(im,'头像6x4与金银铜自己框')

def gift_badge_sheet():
    im=Image.new('RGBA',(1500,1410),'#213752')
    text(im,(750,42),'礼盒同态跨色对齐 / 开关共用画布与盒身锚点',29,'#FFFFFF',bold=True)
    for i,c in enumerate(['gold','silver','bronze']):
        for j,s in enumerate(['closed','open']):
            put(im,RANK+f'gift_{c}_{s}.png',(60+i*480,95+j*410,320,352))
            text(im,(220+i*480,465+j*410),c+' '+s,23,'#FFFFFF')
    for j,s in enumerate(['closed','open']):
        x=200+j*700; y=910
        for i,c in enumerate(['gold','silver','bronze']):
            src=read(RANK+f'gift_{c}_{s}.png').resize((200,220),RESAMPLE)
            src.putalpha(src.getchannel('A').point(lambda a: int(a*.34)))
            im.alpha_composite(src,(x,y))
        text(im,(x+100,y+239),s+' 三色原位叠放',23,'#FFFFFF')
    text(im,(750,1202),'工蜂 → 采蜜蜂 → 守卫蜂 → 蜂王卫 → 蜂后',26,'#FFFFFF')
    for i in range(5):
        put(im,RANK+f'league_badge_{i+1}.png',(185+i*250,1240,120,132))
    save(im,'礼盒开关三色叠放与五段徽章')

def all_paths():
    paths=[RANK+'avatar/avatar_'+id+'.png' for id in IDS+['player_bee']]
    paths += [RANK+'avatar_bg.png']+[RANK+'avatar_frame_'+s+'.png' for s in ['normal','gold','silver','bronze','self']]
    paths += [RANK+f'league_badge_{i}.png' for i in range(1,6)]
    paths += [RANK+'icon_league_star.png']+[RANK+f'podium_{i}.png' for i in range(1,4)]
    paths += [RANK+'rank_row_'+s+'.png' for s in ['normal','self']]+[RANK+'tab_'+s+'.png' for s in ['normal','selected']]
    paths += [RANK+f'rank_medal_{i}.png' for i in range(1,4)]
    paths += [RANK+f'gift_{c}_{s}.png' for c in ['gold','silver','bronze'] for s in ['closed','open']]
    return paths+['UI/图标/icon_leaderboard.png','UI/通用/win_panel_header.png']

def edge_crop(src):
    """选取首个具有真实alpha变化的轮廓段，在原生像素上截取20×20。"""
    a=src.getchannel('A'); box=a.getbbox()
    if not box:
        raise ValueError('空图')
    px=a.load(); y=min(box[1]+2,src.height-1)
    xs=[x for x in range(box[0],box[2]) if px[x,y]>20]
    x=xs[0] if xs else box[0]
    x=max(0,min(src.width-20,x-10)); y=max(0,min(src.height-20,y-8))
    return src.crop((x,y,x+20,y+20))

def colour_sheets():
    paths=all_paths()
    assert len(paths)==55
    for k,colour in enumerate(BG):
        im=Image.new('RGBA',(1800,1970),'#E6E9EF')
        text(im,(900,34),'全部55件 · '+colour+' · 右下为原生20×20轮廓的4倍最近邻放大',25,bold=True)
        for i,path in enumerate(paths):
            x=12+(i%8)*224; y=67+(i//8)*270
            tile=Image.new('RGBA',(216,260),colour)
            src=read(path); thumb=src.copy(); thumb.thumbnail((192,164),RESAMPLE)
            tile.alpha_composite(thumb,((216-thumb.width)//2,5+(164-thumb.height)//2))
            tile.alpha_composite(edge_crop(src).resize((80,80),Image.Resampling.NEAREST),(128,173))
            label=Path(path).stem
            for j in range(0,len(label),19):
                text(tile,(6,181+(j//19)*17),label[j:j+19],13,'#FFFFFF' if k==2 else '#333333',anchor='lt')
            im.alpha_composite(tile,(x,y))
        save(im,f'55件四底检查_{k+1}_{colour[1:]}与4倍')

def nine_sheet():
    im=Image.new('RGBA',(1660,940),'#183254')
    text(im,(830,40),'九宫格：2倍资源 → 1倍显示，边角保持原生比例',28,'#FFFFFF',bold=True)
    for i,state in enumerate(['normal','self']):
        put(im,RANK+'rank_row_'+state+'.png',(60,110+i*180,760,120),(48,48,48,48),2)
        text(im,(910,170+i*180),f'{state}: 760×120',25,'#FFFFFF',anchor='lm')
    for i,state in enumerate(['normal','selected']):
        put(im,RANK+'tab_'+state+'.png',(60+i*400,510,240,80),(40,40,40,40),2)
        text(im,(180+i*400,640),state+' 240×80',23,'#FFFFFF')
    text(im,(830,760),'切片：排名行 48/48/48/48；页签 40/40/40/40（原图像素）',25,'#FFFFFF')
    text(im,(830,815),'放大方式：只延展九宫格中间条带和中心，四角不拉伸。',25,'#FFFFFF')
    save(im,'九宫格实际显示尺寸检查')

def structure_compare():
    im=Image.new('RGBA',(1500,2210),'#E6E9EF')
    text(im,(750,38),'结构参考 / 蜂巢小镇合成 · 角色、礼盒、配色分别制作',29,bold=True)
    pairs=[('猫咪数独联赛2.png','P2-12_S26_排行榜页示意.png','领奖台 / 排名行 / 固定自己行'),
           ('猫咪数独次日结算页1.png','P2-12_S27_联赛结算示意.png','礼盒展示 / 奖励 / 领取')]
    for i,(ref,result,label) in enumerate(pairs):
        y=85+i*1060
        text(im,(750,y+18),label,27,bold=True)
        for x,p in [(100,ROOT.parent/'猫咪数独'/ref),(850,OUT/result)]:
            source=Image.open(p).convert('RGBA')
            source.thumbnail((550,930),RESAMPLE)
            im.alpha_composite(source,(x+(550-source.width)//2,y+60))
        text(im,(375,y+1020),'参考游戏：仅取信息结构',23)
        text(im,(1125,y+1020),'本项目：复用 v2 UI 与 P2-12 新切图',23)
    save(im,'结构参考与本项目合成对照')

def main():
    missing=[p for p in all_paths() if not (ART/p).exists()]
    if missing:
        raise SystemExit('素材未齐，未生成占位图：'+', '.join(missing))
    for fn in [s26,s27,s06,avatar_sheet,gift_badge_sheet,colour_sheets,nine_sheet,structure_compare]:
        fn()
    print('P2-12: 11 张对照图已生成；其中 S26/S27/S06 均为 853×1844。')

if __name__=='__main__':
    main()
