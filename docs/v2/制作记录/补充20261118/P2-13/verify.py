"""Independent delivery measurements against the fixed original Git revision."""
import json,subprocess,hashlib
from pathlib import Path
from io import BytesIO
import numpy as np
from scipy import ndimage as ndi
from PIL import Image
from spec_register import HERE,ROOT,BASE,SPEC,baseline
def distance(a,b):
 ae=a^ndi.binary_erosion(a);be=b^ndi.binary_erosion(b)
 return float(max(ndi.distance_transform_edt(~ae)[be].max(initial=0),ndi.distance_transform_edt(~be)[ae].max(initial=0)))
if __name__=='__main__':
 spec=json.loads((HERE/'specification.json').read_text(encoding='utf8'))
 manifest=json.loads((ROOT/'美术交付清单.json').read_text(encoding='utf8'))
 lookup={e['id']:e for e in manifest['uiAssets']};old=baseline();oldlookup={e['id']:e for e in old['uiAssets']}
 measurements=[]
 for r in spec['files']:
  p=ROOT/'素材'/r['file'];im=Image.open(p);orig=Image.open(BytesIO(subprocess.check_output(['git','show',BASE+':docs/v2/素材/'+r['file']]))).convert('RGBA')
  assert im.mode=='RGBA' and list(im.size)==r['size'],r['file']
  assert lookup[r['id']]['sha256'][r['state']]==hashlib.sha256(p.read_bytes()).hexdigest()
  assert lookup[r['id']]['priority']==oldlookup[r['id']]['priority']
  assert lookup[r['id']]['scale']==2 and lookup[r['id']]['batch']=='P2-13'
  assert lookup[r['id']]['slice']==(r['slice'] or [0,0,0,0])
  a=np.asarray(orig);b=np.asarray(im.resize(orig.size,Image.Resampling.LANCZOS));ao=a[:,:,3]>=128;bo=b[:,:,3]>=128
  delta=distance(ao,bo);interior=ndi.binary_erosion(ao&bo,iterations=3)
  diff=np.abs(a[:,:,:3].astype(float)-b[:,:,:3].astype(float))
  measurements.append(dict(file=r['file'],tier=r['tier'],size=list(im.size),contourDeltaAtHalfPx=delta,meanInteriorRGBDifference=round(float(diff[interior].mean()),3),semiTransparentPixelCount=int(((np.asarray(im)[:,:,3]>0)&(np.asarray(im)[:,:,3]<255)).sum()),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
 # The rest of the manifest must retain all original values.
 for e in old['uiAssets']:
  if e['id'] not in SPEC:assert lookup[e['id']]==e,e['id']
 for k in old:
  if k!='uiAssets':assert manifest[k]==old[k],k
 allowed={'docs/v2/素材/'+r['file'] for r in spec['files']}|{'docs/v2/美术交付清单.json'}
 changed=subprocess.check_output(['git','diff','--name-only','-z',BASE]).decode('utf8').strip('\0').split('\0')
 assert all(p in allowed or p.startswith('docs/v2/制作记录/补充20261118/') for p in changed if p and not p.endswith('.meta')),changed
 result=dict(batch='P2-13',count=len(measurements),baseline=BASE,measurements=measurements,contourOver1px=[r for r in measurements if r['tier']!='C' and r['contourDeltaAtHalfPx']>1],unmodifiedManifestEntriesPreserved=True)
 (HERE/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(json.dumps(dict(count=len(measurements),contourOver1px=[(r['file'],r['contourDeltaAtHalfPx']) for r in result['contourOver1px']]),ensure_ascii=False))
