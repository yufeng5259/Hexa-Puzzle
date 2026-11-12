from pathlib import Path
import json,os,subprocess,sys,tomllib
p=Path.home()/'.codex'
env=os.environ.copy()
if not env.get('OPENAI_API_KEY'):
    auth=json.loads((p/'auth.json').read_text(encoding='utf-8'))
    key=auth.get('OPENAI_API_KEY')
    if key: env['OPENAI_API_KEY']=key
cfg=tomllib.loads((p/'config.toml').read_text(encoding='utf-8'))
provider=cfg.get('model_providers',{}).get(cfg.get('model_provider'),{})
if provider.get('base_url'): env['OPENAI_BASE_URL']=provider['base_url']
if not env.get('OPENAI_API_KEY'): raise SystemExit('No configured API key')
cmd=[sys.executable,str(p/'skills/.system/imagegen/scripts/image_gen.py'),'edit','--image',str(next(Path('docs/v2/效果图').glob('S01_*'))),'--prompt-file','docs/v2/制作记录/切图20261112/backgrounds/loading_prompt.txt','--size','1024x2208','--quality','high','--out','docs/v2/制作记录/切图20261112/backgrounds/loading_raw.png']
raise SystemExit(subprocess.run(cmd,env=env).returncode)
