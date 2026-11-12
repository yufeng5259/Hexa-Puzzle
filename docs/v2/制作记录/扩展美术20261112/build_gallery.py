"""Build a portable review gallery and verify final image files, without changing runtime assets."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,re,hashlib,html

ROOT=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2')
REC=ROOT/'制作记录/扩展美术20261112'
entries=[]
def add(path,kind,title=None,count=None):
    path=Path(path)
    with Image.open(path) as check:check.verify()
    with Image.open(path) as im:
        size=list(im.size);mode=im.mode
        alpha=im.getextrema()[-1] if mode=='RGBA' else None
    entries.append({'id':path.stem.split('_')[0],'title':title or path.stem.replace('_BlockHexa风格','').replace('_',' · '),'category':kind,'file':path.relative_to(ROOT).as_posix(),'width':size[0],'height':size[1],'mode':mode,'transparent':bool(alpha and alpha[0]<255),'items':count,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})

for f in sorted((ROOT/'效果图').glob('S[0-9][0-9]_*.png')):add(f,'页面')
for dirname,kind in [('图集/六角块','六角块图集'),('地图','地图背景'),('图集/建筑','建筑升级图集')]:
    metadata={}
    m=ROOT/dirname/'atlas_manifest.json'
    if m.exists():
        content=json.loads(m.read_text(encoding='utf-8'))
        for item in content.get('boards',content.get('atlases',[])):
            if isinstance(item,dict):metadata[Path(item.get('file',item.get('path',''))).name]=item
    for f in sorted((ROOT/dirname).glob('*.png')):
        meta=metadata.get(f.name,{})
        add(f,kind,meta.get('title'),meta.get('itemCount',6 if kind=='建筑升级图集' else None))

catalog={'date':'2026-11-12','kind':'design-preview-and-atlas-delivery','categories':{c:sum(x['category']==c for x in entries) for c in ['页面','六角块图集','地图背景','建筑升级图集']},'images':entries,'notes':['效果图和图集供设计评审；不是Creator实机截图。','透明母件与建筑分级PNG另存素材目录；代码及来源登记在制作记录。','未制作完整页面PSD，未修改运行工程。']}
(ROOT/'美术目录.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2),encoding='utf-8')

# Contact sheet is a review aid, not another runtime asset or another version.
pages=[x for x in entries if x['category']=='页面']
cw,ch=240,558; cols=5;rows=(len(pages)+cols-1)//cols
sheet=Image.new('RGB',(cols*cw,rows*ch+100),'#10213e');d=ImageDraw.Draw(sheet)
font=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',19)
titlefont=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',31)
d.text((25,24),'蜂巢小镇 · 页面效果总览',font=titlefont,fill='#f5f0dd')
for i,item in enumerate(pages):
    im=Image.open(ROOT/item['file']).convert('RGB');im.thumbnail((cw-18,ch-54),Image.Resampling.LANCZOS)
    x=(i%cols)*cw+(cw-im.width)//2;y=100+(i//cols)*ch
    sheet.paste(im,(x,y));label=item['title']
    if len(label)>15:label=label[:15]
    d.text(((i%cols)*cw+12,y+ch-43),label,font=font,fill='#dbe9ef')
sheet.save(ROOT/'效果图/页面总览.jpg',quality=92)

template=r'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>蜂巢小镇 · 美术图册</title><style>
:root{color-scheme:dark;--bg:#0b172b;--card:#14273f;--text:#eaf2f8;--muted:#a5bbcd;--accent:#50d9d5}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.65 "Microsoft YaHei",sans-serif}header{padding:30px max(24px,calc((100vw - 1500px)/2));background:linear-gradient(120deg,#15364d,#18223f)}h1{font-size:30px;margin:0 0 7px}header p{margin:4px 0;color:var(--muted)}header a{color:#a3fff1;text-decoration:none;margin-right:20px}.controls{position:sticky;top:0;z-index:3;padding:14px 24px;background:#0b172bf2;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid #294154;backdrop-filter:blur(15px)}button,input,select{font:inherit;border:1px solid #365267;border-radius:12px;color:var(--text);background:#162d44;padding:9px 15px}button{cursor:pointer}button:hover,button.active{border-color:var(--accent);background:#205363}input{min-width:210px;flex:1;max-width:340px}#stats{padding:18px 28px;color:var(--muted);max-width:1550px;margin:auto}.grid{max-width:1550px;margin:auto;padding:0 24px 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:22px}.card{background:var(--card);border:1px solid #263e55;border-radius:18px;overflow:hidden;box-shadow:0 8px 20px #0002}.imagebox{height:360px;display:flex;align-items:center;justify-content:center;padding:12px;cursor:zoom-in;background-color:#17283a;background-image:linear-gradient(45deg,#ffffff07 25%,transparent 25%),linear-gradient(-45deg,#ffffff07 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ffffff07 75%),linear-gradient(-45deg,transparent 75%,#ffffff07 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.imagebox img{max-width:100%;max-height:100%;object-fit:contain}.info{padding:14px 16px}.info strong{display:block;font-size:17px}.info small{color:var(--muted)}.info a{color:var(--accent);display:block;font-size:13px;margin-top:8px}.empty{padding:80px;text-align:center;color:var(--muted)}dialog{padding:0;border:1px solid #365267;border-radius:18px;background:#0b172b;color:var(--text);width:94vw;height:94vh;max-width:1600px;max-height:96vh}dialog::backdrop{background:#000d}.lighthead{height:68px;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid #2d4054}.lighthead strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lightbuttons{display:flex;gap:8px}.viewer{overflow:auto;height:calc(100% - 113px);display:flex;align-items:flex-start;justify-content:center;padding:18px;background:#173047}.viewer.checker{background-color:#ddd;background-image:linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%);background-size:32px 32px;background-position:0 0,0 16px,16px -16px,-16px 0}.viewer.white{background:white}.viewer.dark{background:#101820}.viewer img.fit{max-width:100%;max-height:100%;object-fit:contain}.viewer img.actual{max-width:none;max-height:none;flex:none}.lightfoot{height:45px;text-align:center;padding:9px;color:var(--muted);font-size:12px}body.whitecards .imagebox{background:white;background-image:none}body.darkcards .imagebox{background:#101820;background-image:none}@media(max-width:600px){h1{font-size:24px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));padding:0 10px;gap:10px}.imagebox{height:270px;padding:6px}.info{padding:10px}.info strong{font-size:13px}.lighthead{height:auto;flex-wrap:wrap}.lightbuttons button{font-size:12px;padding:6px}.controls{padding:10px}input{width:100%;max-width:none}.viewer{height:calc(100% - 150px)}}
</style></head><body><header><h1>蜂巢小镇 · 美术图册</h1><p>页面效果、六角拼块、地图背景与建筑升级图集 · 2026-11-12</p><p>延续已确认的两张图的品质与风格。点击图片放大；透明图集可切换底色检查。</p><p><a href="效果图/页面总览.jpg" target="_blank">页面总览</a><a href="美术交付说明.md">交付说明</a><a href="美术目录.json">完整目录</a><a href="素材/六角块/shapes.json">六角形状数据</a></p></header><div class="controls"><button class="active" data-category="全部">全部</button><button data-category="页面">页面</button><button data-category="六角块图集">六角块</button><button data-category="地图背景">地图背景</button><button data-category="建筑升级图集">建筑升级</button><input id="search" placeholder="搜索编号、页面、建筑…" aria-label="搜索"><select id="back" aria-label="底色"><option value="checker">棋盘底</option><option value="white">白底</option><option value="dark">深底</option></select></div><div id="stats"></div><main class="grid" id="gallery"></main><dialog id="lightbox"><div class="lighthead"><strong id="lightTitle"></strong><div class="lightbuttons"><button id="prev">上一张</button><button id="next">下一张</button><button id="zoom">原尺寸</button><button id="close">关闭</button></div></div><div class="viewer checker" id="viewer"><img id="large" class="fit" alt=""></div><div class="lightfoot" id="lightMeta"></div></dialog><script>
const CATALOG=__CATALOG__;const all=CATALOG.images;let category='全部',visible=[],current=-1,actual=false;const $=id=>document.getElementById(id);const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){const term=$('search').value.trim().toLowerCase();visible=all.filter(i=>(category==='全部'||i.category===category)&&(i.title+' '+i.id+' '+i.file).toLowerCase().includes(term));$('stats').textContent=`共 ${all.length} 张设计图；页面 ${CATALOG.categories['页面']} · 六角图集 ${CATALOG.categories['六角块图集']} · 裸背景 ${CATALOG.categories['地图背景']} · 建筑图集 ${CATALOG.categories['建筑升级图集']}。当前显示 ${visible.length} 张。`;$('gallery').innerHTML=visible.map((i,n)=>`<article class="card"><div class="imagebox" data-image="${n}" tabindex="0" role="button" aria-label="放大 ${escapeHTML(i.title)}"><img loading="lazy" src="${encodeURI(i.file)}" alt="${escapeHTML(i.title)}"></div><div class="info"><strong>${escapeHTML(i.title)}</strong><small>${i.category} · ${i.width} × ${i.height}${i.transparent?' · 透明PNG':''}${i.items?' · '+i.items+'项':''}</small><a target="_blank" href="${encodeURI(i.file)}">查看原图 ↗</a></div></article>`).join('')||'<div class="empty">没有匹配的图片</div>';document.querySelectorAll('[data-image]').forEach(el=>{el.onclick=()=>openImage(Number(el.dataset.image));el.onkeydown=e=>{if(e.key==='Enter')openImage(Number(el.dataset.image))}})}
function openImage(n){current=(n+visible.length)%visible.length;let i=visible[current];$('large').src=encodeURI(i.file);$('large').alt=i.title;$('lightTitle').textContent=i.title;$('lightMeta').textContent=`${i.width} × ${i.height}　${i.transparent?'透明PNG　':''}${i.file}`;actual=false;$('large').className='fit';$('large').style.width='';$('zoom').textContent='原尺寸';if(!$('lightbox').open)$('lightbox').showModal()}
document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('active',x===b));render()});$('search').oninput=render;$('back').onchange=()=>{let v=$('back').value;document.body.className=v==='checker'?'':v+'cards';$('viewer').className='viewer '+v};$('close').onclick=()=>$('lightbox').close();$('prev').onclick=()=>openImage(current-1);$('next').onclick=()=>openImage(current+1);$('zoom').onclick=()=>{actual=!actual;$('large').className=actual?'actual':'fit';$('large').style.width=actual?visible[current].width+'px':'';$('zoom').textContent=actual?'适应窗口':'原尺寸'};document.addEventListener('keydown',e=>{if(!$('lightbox').open)return;if(e.key==='ArrowRight')openImage(current+1);if(e.key==='ArrowLeft')openImage(current-1)});render();
</script></body></html>'''
embedded=json.dumps(catalog,ensure_ascii=False).replace('</','<\\/')
(ROOT/'index.html').write_text(template.replace('__CATALOG__',embedded),encoding='utf-8')
print(json.dumps(catalog['categories'],ensure_ascii=False), 'PNG decode PASS; gallery generated')
