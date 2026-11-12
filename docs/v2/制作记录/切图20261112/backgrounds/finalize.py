from pathlib import Path
from PIL import Image
import hashlib,json
V2=Path(__file__).resolve().parents[3]
REC=Path(__file__).resolve().parent
assets=[]
for sid,name,cn in [('S01','loading','加载页纯场景背景'),('S04','puzzle','拼图深蓝蜂巢背景')]:
 src=REC/(name+'_raw.png'); dst=V2/'素材/背景'/('bg_'+name+'.png');dst.parent.mkdir(exist_ok=True,parents=True)
 Image.open(src).convert('RGBA').resize((853,1844),Image.Resampling.LANCZOS).save(dst)
 ref=next((V2/'效果图').glob(sid+'_*'))
 assets.append({'id':'bg_'+name,'name':cn,'states':{'normal':dst.relative_to(V2/'素材').as_posix()},'size':[853,1844],'scale':1,'slice':None,'anchor':[0.5,0.5],'source':sid+' imagegen CLI gpt-image-2 去除UI重建；原图不修改','sourceFiles':[{'file':ref.relative_to(V2).as_posix(),'sha256':hashlib.sha256(ref.read_bytes()).hexdigest()}],'priority':'P0','opaque':True,'sha256':{'normal':hashlib.sha256(dst.read_bytes()).hexdigest()}})
(REC/'manifest.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding='utf-8')
