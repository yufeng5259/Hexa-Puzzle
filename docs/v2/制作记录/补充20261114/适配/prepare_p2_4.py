"""Prepare outpainting canvases and imagegen CLI prompts. Run from Project root."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path('docs/v2');REC=ROOT/'制作记录/补充20261114/适配';TMP=Path('../tmp/p2-4')
REC.mkdir(parents=True,exist_ok=True);TMP.mkdir(parents=True,exist_ok=True)
jobs=[]
for name in ['M01','M02','M03','loading']:
    p=next((ROOT/'地图').glob(name+'_*背景.png')) if name!='loading' else ROOT/'素材/背景/bg_loading.png'
    im=Image.open(p).convert('RGB');offset=(133,103 if name!='loading' else 102)
    canvas=Image.new('RGBA',(1120,2048));canvas.paste(im,offset)
    canvas.save(TMP/(name+'_canvas.png'))
    mask=Image.new('RGBA',canvas.size,(255,255,255,0));d=ImageDraw.Draw(mask)
    d.rectangle((offset[0],offset[1],offset[0]+im.width-1,offset[1]+im.height-1),fill=(255,255,255,255))
    mask.save(TMP/(name+'_mask.png'))
    theme={'M01':'sunny green meadow, distant blue mountains, blue sky with soft white clouds, bushes and a cyan stream at lower left',
      'M02':'flowery green valley, blue distant mountains and sky, soft scattered lilac and white flowers, cyan stream at lower left',
      'M03':'giant-tree meadow: the existing tree canopy and trunk continue naturally above the top edge, green foliage and hills to the sides, stream lower left; no second tree or new giant landmark',
      'loading':'same cheerful honeybee village loading scene, preserving the existing village ONLY in the locked center; extend sky and mountains above, lawn, bushes and stream at margins; NO buildings in new margins'}[name]
    prompt=f'''Use case: precise-object-edit. OUTPAINT ONLY the transparent margin of Image1 using the provided mask.
The input is a1120x2048 canvas with the original{im.width}x{im.height} game background locked at top-left{offset}. Retain these positions and scale exactly. The opaque original center must NOT be redrawn, cropped, resized, recolored or moved. Paint only the transparent frame surrounding it, creating a complete opaque RGB image with no transparency anywhere. No checkerboard or borders.
Continue the SAME scene: {theme}. Seamlessly connect each path, water bank, grass contour, canopy, cloud, bush and shading crossing the original edges. Match the original cartoony softly sculpted casual mobile game painting, light from upper left, smooth clean surfaces. Extend upper sky or existing foliage, left/right landscape and bottom grass/path naturally. The marginal scenery is quiet, lower-detail environmental continuation with NO new focal point.
No new buildings, houses, people, bee characters, signs, UI, buttons, text, numbers, logos, frames or watermark. Existing buildings in the locked loading center are preserved ONLY; do not repeat them in the expansion. Final output must remain pixel-aligned to this exact1120x2048 input canvas.
'''
    (REC/(name+'_prompt.txt')).write_text(prompt,encoding='utf-8')
    jobs.append(dict(name=name,size='1120x2048',image=str(TMP/(name+'_canvas.png')),mask=str(TMP/(name+'_mask.png')),prompt=str(REC/(name+'_prompt.txt')),original=p.relative_to(ROOT).as_posix(),offset=[133,99 if name!='loading' else 98]))
for name in ['pad_light','pad_dark']:
    light=name=='pad_light'
    content='''A softly lit distant honeybee-town countryside, with gentle green grass hills, distant layered blue mountains, soft blue sky and small diffuse white clouds. Low-detail, softened depth of field. A few subtle small honeycomb motifs in the OUTER LEFT and OUTER RIGHT regions only. No actual town buildings. Broad calm shapes, no visual focal point. Slightly darker and less saturated than reference Image1 (about12% darker).''' if light else '''Deep navy to muted teal blue gradient in the exact color family of reference Image1. A few very large faint thin hexagon outlines float in the OUTER LEFT and OUTER RIGHT areas. Just a few tiny diffuse honey-gold specks toward the far sides, low contrast. Very calm spacious decorative backdrop. No landscape, buildings or characters.'''
    prompt=f'''Use case: stylized-concept. Create ONE opaque landscape decorative background for the SIDES of a portrait mobile game on tablets. Exact target2304x1844, same cartoon surface/lighting language as the input STYLE reference, but this is NOT a game page or a phone/tablet mockup.
{content}
Composition: the central900px-wide vertical region will be COVERED by the portrait game. Concentrate the environmental decorative interest in the LEFT700px and RIGHT700px strips, extending over full height; leave the center quiet and unobtrusive. Sides should be loosely balanced but NOT identical mirrored copies. Use one uninterrupted full-bleed painted canvas, with no bars or panels. Smooth progression across the canvas, the sides are decorative and not interactive.
No text, digits, buttons, interface, device frame, character, bee, visible building, landmark or watermark. Opaque background everywhere.
'''
    (REC/(name+'_prompt.txt')).write_text(prompt,encoding='utf-8')
    ref=next((ROOT/'地图').glob('M01_*背景.png')) if light else ROOT/'素材/背景/bg_puzzle.png'
    jobs.append(dict(name=name,size='2304x1840',image=str(ref),prompt=str(REC/(name+'_prompt.txt'))))
(REC/'generation_jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Prepared four protected outpainting inputs and two side-background prompts.')
