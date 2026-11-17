"""Persist the per-asset imagegen specifications; no credentials are stored here."""
import json
from pathlib import Path

OUT = Path(__file__).parent
ANIMALS = [
 ('bear','warm brown bear','small honey pot held against shoulder'),
 ('rabbit','white rabbit with long ears','black and yellow bee antenna headband'),
 ('fox','orange fox','black and yellow striped scarf'),
 ('cat','cream tabby cat','golden hexagonal hair clip'),
 ('dog','golden floppy-eared puppy','tiny translucent bee wings behind shoulders'),
 ('panda','black and white giant panda','golden honey droplet brooch'),
 ('raccoon','gray raccoon with natural black eye mask','bee antenna headband'),
 ('hedgehog','brown hedgehog','small honey pot held against shoulder'),
 ('squirrel','red squirrel','black and yellow striped scarf'),
 ('frog','green frog','tiny translucent bee wings behind shoulders'),
 ('duck','yellow duck with broad orange bill','golden hexagonal hair clip'),
 ('chick','fluffy pale yellow baby chicken with short beak','golden honey droplet brooch'),
 ('sloth','brown sloth with distinct tan eye markings','black and yellow striped scarf'),
 ('monkey','brown monkey with round ears','tiny translucent bee wings behind shoulders'),
 ('tiger','orange tiger with black stripes','golden hexagonal hair clip'),
 ('lion','golden lion with round fluffy mane','black and yellow bee antenna headband'),
 ('elephant','gray baby elephant with short trunk','golden honey droplet brooch'),
 ('giraffe','golden spotted giraffe with small horns','small honey pot held against shoulder'),
 ('hippo','lavender gray hippopotamus','black and yellow striped scarf'),
 ('crocodile','green crocodile with rounded muzzle','tiny translucent bee wings behind shoulders'),
 ('seal','silver gray seal','golden hexagonal hair clip'),
 ('owl','brown owl with large round eyes','black and yellow bee antenna headband'),
 ('penguin','black and white penguin with orange beak','golden honey droplet brooch'),
 ('koala','gray koala with fluffy ears','small honey pot held against shoulder'),
]
COMMON = '''Use case: stylized-concept. Asset type: premium mobile puzzle game avatar cutout.
Make ONE original friendly {animal} HEAD AND SHOULDERS portrait, looking directly forward with a warm happy smile.
Required clearly visible bee accessory: {accessory}. Only this accessory, no other clothing.
Art direction: polished rounded 3D toy illustration, very soft smooth volumes, warm honey golden highlights,
clean subtle dark brown contours, large kind glossy brown eyes with two white catchlights,
soft key light from upper left, gentle ambient occlusion. Consistent big head and tiny shoulders.
Centered symmetrical framing; whole head including ears/accessory visible, no cropping;
subject fits within the middle 86 percent of the square. Shoulders end at lower edge of subject.
Background: perfectly FLAT SOLID PURE MAGENTA #FF00FF chroma-key backdrop, no gradient, no floor, no shadow on backdrop.
Do not use magenta or pink on the subject. NO text, NO numbers, NO logo, NO watermark,
NO circular badge, NO frame, NO base plate, NO second character, NO props except required accessory.
Original Honeycomb Town character, not copied from any existing game.'''

if __name__ == '__main__':
 jobs = [dict(prompt=COMMON.format(animal=a,accessory=b),out=f'avatar_{i}.png',size='1024x1024',quality='high') for i,a,b in ANIMALS]
 (OUT/'avatar_prompts.jsonl').write_text('\n'.join(json.dumps(j,ensure_ascii=False) for j in jobs)+'\n',encoding='utf-8')
 print('24 distinct avatar specifications saved')
