"""Extend only the generated construction preview XP fill to the 80% sample value."""
from pathlib import Path
from PIL import Image, ImageChops
import shutil, json, hashlib

root=Path('F:/qiguobing/git/Hexa Puzzle/Project/docs/v2')
record=root/'制作记录/BlockHexa首轮'
target=root/'效果图/S03_建造页_BlockHexa风格.png'
backup=record/'S03_建造页_生成原稿.png'
if backup.exists():
    raise SystemExit('Already refined; inspect existing evidence rather than applying twice.')
shutil.copy2(target,backup)
before=Image.open(backup).convert('RGB')
after=before.copy()
# Visible XP track begins at x114 and ends at x273; 80% fill ends near x241.
# Preserve the existing right endcap rather than drawing a different art style.
strip=before.crop((114,59,146,102)).resize((92,43),Image.Resampling.LANCZOS)
endcap=before.crop((146,59,182,102))
after.paste(strip,(114,59))
after.paste(endcap,(206,59))
bbox=ImageChops.difference(before,after).getbbox()
assert bbox and bbox[0]>=114 and bbox[1]>=59 and bbox[2]<=242 and bbox[3]<=102
after.save(target)
after.crop((10,20,285,125)).resize((1100,420)).save(record/'经验条_修正后局部.png')
evidence={'operation':'Extend generated green XP fill only, keeping source endcap and all other pixels unchanged','expected':'9 upgrades x 20 XP = 180 XP; level 2 with 80/100 XP','changed_pixel_bbox':bbox,'source_sha256':hashlib.sha256(backup.read_bytes()).hexdigest(),'final_sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
(record/'经验条修正记录.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
print('XP fill corrected; changed pixel bbox:',bbox)
