"""Register P2-12 without changing existing entries; validate all 55 exports."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops
from prepare_avatars import ANIMALS

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
ART=ROOT/'素材'
MANIFEST=ROOT/'美术交付清单.json'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def entry(id,size,states=None,frames=None,**extra):
    d=dict(id=id,name=id,batch='P2-12',priority='P1',size=size,scale=2,anchor=[.5,.5],slice=None,
           source='17_美术需求_排行榜头像与胜利弹窗.md；制作记录/补充20261117/P2-12/（原稿、提示词、来源哈希与生成脚本）')
    if states:
        d['states']=states;d['sha256']={k:sha(ART/v) for k,v in states.items()}
    if frames:
        d['frames']=frames;d['sha256']={f'{i:02}':sha(ART/v) for i,v in enumerate(frames,1)}
    d.update(extra);return d

def build():
    r='UI/排行榜/'
    out=[entry('avatar',[256,256],frames=[r+f'avatar/avatar_{a}.png' for a,_,_ in ANIMALS],ids=[a for a,_,_ in ANIMALS],
               source='gpt-image-2，24条独立提示词见 avatar_prompts.jsonl；原始输出与SHA见 avatar_provenance.json；去底色、边缘去污染后统一缩放')]
    for id in ['avatar_player_bee','avatar_bg','icon_league_star']:
        path=r+('avatar/' if id=='avatar_player_bee' else '')+id+'.png'
        out.append(entry(id,[128,128] if id=='icon_league_star' else [256,256],states={'normal':path}))
    out[1]['source']='素材/角色/bee_wave.png 同角色头部裁切；原始SHA与裁切框见 avatar_provenance.json'
    for id,size,keys in [('avatar_frame',[288,288],['normal','gold','silver','bronze','self']),('league_badge',[320,352],['1','2','3','4','5']),('podium',[440,320],['1','2','3']),('rank_row',[240,144],['normal','self']),('tab',[160,96],['normal','selected']),('rank_medal',[128,128],['1','2','3']),('gift',[400,440],['gold_closed','gold_open','silver_closed','silver_open','bronze_closed','bronze_open'])]:
        d=entry(id,size,states={k:r+id+'_'+k+'.png' for k in keys})
        if id=='podium':d.update(anchor=[.5,0],stateSizes={'1':[440,320],'2':[400,240],'3':[400,200]})
        if id=='rank_row':d['slice']=[48]*4
        if id=='tab':d['slice']=[40]*4
        out.append(d)
    out.append(entry('icon_leaderboard',[200,200],states={'normal':'UI/图标/icon_leaderboard.png'}))
    out.append(entry('win_panel_header',[1120,360],states={'normal':'UI/通用/win_panel_header.png'},anchor=[.5,0]))
    return out

if __name__=='__main__':
    m=json.loads(MANIFEST.read_text(encoding='utf-8'));new=build()
    old=[e for e in m['uiAssets'] if e.get('batch')!='P2-12']
    assert not ({e['id'] for e in old}&{e['id'] for e in new}), 'Existing asset ID collision'
    m['uiAssets']=old+new
    checks=[]
    for e in new:
        pairs=list(e.get('states',{}).items()) or [(f'{i:02}',p) for i,p in enumerate(e['frames'],1)]
        for key,p in pairs:
            path=ART/p;im=Image.open(path);a=im.getchannel('A');bbox=a.getbbox()
            expected=e.get('stateSizes',{}).get(key,e['size'])
            assert im.mode=='RGBA' and list(im.size)==expected,(p,im.mode,im.size)
            assert sha(path)==e['sha256'][key]
            if not e['slice']:
                assert min(bbox[0],bbox[1],im.width-bbox[2],im.height-bbox[3])>=6,(p,bbox)
            assert sum(a.histogram()[1:255]) > 0, p
            checks.append(dict(file=p,size=list(im.size),mode=im.mode,bbox=bbox,sha256=sha(path)))
    assert len(checks)==55
    for state in ['closed','open']:
        gold=Image.open(ART/f'UI/排行榜/gift_gold_{state}.png').getchannel('A')
        for c in ['silver','bronze']:
            assert ImageChops.difference(gold,Image.open(ART/f'UI/排行榜/gift_{c}_{state}.png').getchannel('A')).getbbox() is None
    header=Image.open(ART/'UI/通用/win_panel_header.png').getchannel('A')
    assert header.crop((224,0,896,360)).getbbox() is None
    MANIFEST.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (HERE/'validation.json').write_text(json.dumps(dict(batch='P2-12',pngCount=55,manifestGroups=len(new),files=checks,giftSameStateColourAlphaDifferencePixels=0,headerCentral60PercentTransparent=True),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('55 PNGs verified; 13 manifest groups registered; original entries preserved')
