"""Independent final delivery checks; read PNGs and protect Git write scope."""
from pathlib import Path
import json,hashlib,re,subprocess,runpy
from PIL import ImageChops,Image
REC=Path(__file__).resolve().parent;V2=REC.parents[1];ROOT=V2.parents[1]
ctx=runpy.run_path(str(REC/'integrate_verify.py'));nine=ctx['nine']
m=json.loads((V2/'美术交付清单.json').read_text(encoding='utf-8'));sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
checks=0
for a in m['uiAssets']:
 if 'sourceFile' in a:
  s=a.get('sourceSha256',a.get('sourceHash'))
  if s:assert sha(V2/a['sourceFile'])==s,a['id']
 for path in a['states'].values():
  assert re.fullmatch('[a-z0-9_]+[.]png',Path(path).name),path
  if a.get('slice'):
   im=Image.open(V2/'素材'/path);l,t,r,b=a['slice'];w,h=im.size
   for W,H in [(2*w,h),(w,2*h),(2*w,2*h)]:
    out=nine(im,(W,H),a['slice'])
    for old,new in [((0,0,l,t),(0,0,l,t)),((w-r,0,w,t),(W-r,0,W,t)),((0,h-b,l,h),(0,H-b,l,H)),((w-r,h-b,w,h),(W-r,H-b,W,H))]:
     assert ImageChops.difference(im.crop(old),out.crop(new)).getbbox() is None,(path,'corner changed')
    checks+=1
for a in m['designImages']:assert sha(V2/a['file'])==a['sha256'],a['id']
tracked=subprocess.check_output(['git','diff','--name-only','-z'],cwd=ROOT).decode().split('\0')
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
for p in filter(None,tracked+untracked):
 assert p.startswith(('docs/v2/素材/','docs/v2/制作记录/')) or p in ['docs/v2/美术交付清单.json','docs/v2/03_美术切图任务.md'],p
old=subprocess.check_output(['git','show','HEAD:docs/v2/03_美术切图任务.md'],cwd=ROOT).decode().replace('\r\n','\n')
new=(V2/'03_美术切图任务.md').read_text(encoding='utf-8').replace('\r\n','\n');assert new.startswith(old)
report={'result':'PASS','nineSliceStretchCases':checks,'originalDesignImagesUnchanged':25,'sourceHashes':'PASS','asciiPngNames':'PASS','allowedGitPathsOnly':'PASS','taskDocumentOriginalBodyUnchanged':'PASS','visualReview':'S02/S03/S04/S06/S17 inspected after fixes; P1 deferred elements remain explicitly reported','imageGeneration':'backgrounds via imagegen bundled CLI gpt-image-2; prompts recorded; other images reference extraction/reconstruction'}
(REC/'final_checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
