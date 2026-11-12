"""Invoke the bundled ImageGen CLI; secrets exist only in the child environment."""
from pathlib import Path
import os,json,tomllib,sys,subprocess,concurrent.futures
REC=Path('docs/v2/制作记录/切图20261112/P1/characters');REC.mkdir(parents=True,exist_ok=True)
common='''Use case: identity-preserve, stylized-concept game sprite.
Image 1 is the authoritative S02 character identity; image 2 is a higher resolution reference for the SAME character's materials and details. Extract and recreate ONLY this original cheerful honey bee mascot, NOT the scene. Identity invariants: round golden-yellow face/body, chocolate brown leather aviator cap with silver-rimmed blue-glass goggles perched on forehead, two slim brown antennae ending in round honey-yellow balls, dark brown belly stripes, short dark brown mitt hands and boots, two pairs of thin white translucent wings behind, large expressive face with curved black eyebrows, rosy cheeks, friendly toy proportions. Keep polished soft 2.5D rounded rendering, broad clean highlights, upper-left light, saturated honey gold/brown/white/blue. No fur, realistic insect anatomy, stinger, human clothes, text, signs or invented badge.
Deliver one high-quality isolated character on a PERFECTLY FLAT PURE MAGENTA #FF00FF chroma-key background, zero gradient, zero cast shadow or floor, no backdrop elements. Only actual character/held props, no sparkles or floating symbols. Centered complete silhouette, generous 12% margin on every side including antennae, limbs, wings and prop. Sharp clean antialiased edges, no magenta reflected light, no outlines. No frame, no watermark, no writing.
'''
jobs={
'bee_wave': 'Full body front three-quarter view, standing with both boots down. Smile with happy curved eyes and open mouth. One hand raised outward in a friendly wave, other hand near tummy. Follow Image1 pose exactly. No held objects.',
'bee_fly': 'Small flying side view facing RIGHT. Whole body suspended horizontally with tiny boots trailing backwards, arms forward slightly, visible white wings spread behind. Head turned slightly toward viewer with a cheerful smile. Keep goggles cap and identity. No motion trail or external marks.',
'bee_celebrate': 'Full body front three-quarter view, joyful cheer with both hands raised high and knees slightly lifted in a small celebratory hop. Eyes happy arcs, mouth open laughing. No held prop or detached decorative marks.',
'bee_worry': 'Full body front three-quarter view, a gentle worried frown, curved raised inner eyebrows, large dark eyes looking slightly downward, mouth small worried curve. One brown hand touches cheek and the other rests near tummy. Both feet down, shoulders slightly drooped. Still cute, no tears or floating symbols.',
'bee_peek': 'Upper body only peeking over an INVISIBLE horizontal panel edge. Two brown hands rest at the same horizontal baseline near the bottom, face smiles just above hands, goggle cap and antennae fully visible above. Wings subtly behind shoulders. There is NO actual panel or straight line in the image: only the self-contained bee upper-body silhouette with hands at the bottom.',
'bee_loading': 'Full body front three-quarter view, walking lightly while embracing one small rounded amber HONEY JAR against chest with both brown hands. Jar has a thick honey-yellow lid and visible golden honey, NO TEXT and NO LABEL or painted emblem. The jar is a rounded pot, NOT a hexagonal tile. Happy curved eyes and warm open smile. One boot slightly forward, keep whole silhouette visible.',
'bee_builder': '''Create a PRECISE THREE FRAME HORIZONTAL SPRITE SHEET, 3072x1024. Three equally sized square 1024x1024 cells, no borders, all with pure #FF00FF background. In each cell the SAME full-body original bee builder stands in EXACTLY THE SAME position, scale, foot baseline and camera. Bee wears a yellow safety hard-hat over its aviator cap; goggles remain visible in front of hardhat. Holds ONE tiny wood-handle silver hammer with both hands. Frame 1 (left): hammer lifted over right shoulder preparing. Frame 2 (middle): hammer at chest height moving downward. Frame 3 (right): hammer extended diagonally down in striking follow-through. Feet and body don't move, only arms and hammer angle change. No duplicated hammers, no nails, building, particles, strike marks or ground. Each complete silhouette including raised hammer and antennae fits its own cell with 12% safety margin. One bee per cell, exactly three bees total, consistent left-to-right rhythmic hand animation.'''
}
for name,body in jobs.items(): (REC/(name+'_prompt.txt')).write_text(common+body,encoding='utf-8')
root=Path.home()/'.codex'; env=os.environ.copy()
if not env.get('OPENAI_API_KEY'):
 auth=json.loads((root/'auth.json').read_text(encoding='utf-8')); key=auth.get('OPENAI_API_KEY')
 if key:env['OPENAI_API_KEY']=key
cfg=tomllib.loads((root/'config.toml').read_text(encoding='utf-8'));provider=cfg.get('model_providers',{}).get(cfg.get('model_provider'),{})
if provider.get('base_url'): env['OPENAI_BASE_URL']=provider['base_url']
if not env.get('OPENAI_API_KEY'): raise SystemExit('No configured API key')
cli=root/'skills/.system/imagegen/scripts/image_gen.py'
def run(name):
 out=REC/(name+'_raw.png')
 if out.exists(): return name,0,'already present'
 size='3072x1024' if name=='bee_builder' else '1024x1024'
 cmd=[sys.executable,str(cli),'edit','--image',str(REC/'s02_identity_reference.png'),'--image',str(REC/'s01_detail_reference.png'),'--prompt-file',str(REC/(name+'_prompt.txt')),'--size',size,'--quality','high','--out',str(out)]
 result=subprocess.run(cmd,env=env,capture_output=True,text=True)
 # CLI output normally contains only API status, never dump environment/auth.
 (REC/(name+'_run.txt')).write_text(result.stdout+result.stderr,encoding='utf-8')
 return name,result.returncode,'saved' if result.returncode==0 else 'failed; see run record'
selected=sys.argv[1:] or list(jobs)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for result in pool.map(run,selected): print(*result,flush=True)
