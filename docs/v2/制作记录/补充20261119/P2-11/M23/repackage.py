"""Reproduce final M23 packaging: use one smaller common scale for B112 to clear the main hive."""
from pathlib import Path
import importlib.util,inspect
p=Path(__file__).resolve().parents[1]/'package_art.py'
s=importlib.util.spec_from_file_location('pack',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
fn=inspect.getsource(m.package_building).replace('maxh=430 if slot==0 else 480',"maxh=430 if slot==0 else (450 if bid=='B112' else 480)")
exec(fn,m.__dict__)
if __name__=='__main__':m.package('M23')
