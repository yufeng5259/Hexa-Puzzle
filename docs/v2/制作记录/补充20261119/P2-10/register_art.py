"""Register only the ten complete P2-10 art packages; no runtime import."""
from pathlib import Path
import csv
import hashlib
import io
import json
import argparse

REC = Path(__file__).resolve().parent
V2 = REC.parents[2]
SOURCE = ('AI 生成：gpt-image-2，按14第6节主题与15第2节规范；'
          'imagegen CLI 使用既有匹配接口，六态同源切图保留透明度、清除边缘色键；'
          '背景完整画面等比适配后派生扩展与中央原图，非运行工程接入')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def read(p):
    return json.loads(p.read_text(encoding='utf-8'))

def write(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def append_unique(items, entries, key):
    for entry in entries:
        prior = next((i for i, old in enumerate(items) if old[key] == entry[key]), None)
        if prior is None:
            items.append(entry)
        else:
            assert items[prior].get('batch') == 'P2-10', f'Protected existing entry: {entry[key]}'
            items[prior] = entry

def register(maps):
    packages = [read(REC / mid / 'packaged.json') for mid in maps]
    manifest_path = V2 / '美术交付清单.json'
    atlas_path = V2 / '图集/建筑/atlas_manifest.json'
    manifest, atlas = read(manifest_path), read(atlas_path)
    catalog_path = V2 / '图集/建筑/Building_Catalog.csv'
    catalog = catalog_path.read_bytes()
    ids = {row['asset_id'] for row in csv.DictReader(io.StringIO(catalog.decode('utf-8-sig')))}
    additions = []
    for pack in packages:
        mid = pack['map']
        assert pack['batch'] == 'P2-10' and mid in [f'M{i:02}' for i in range(11, 21)]
        bg = pack['background']
        append_unique(manifest['independentPNGs'], [dict(
            id=f'{mid}_background', category='地图背景', file=bg['file'],
            width=854, height=1842, sha256=bg['sha256'], batch='P2-10', priority='P1',
            source=SOURCE, sourceFile=f'制作记录/补充20261119/P2-10/{mid}/raw/background.png')], 'id')
        ext = pack['extension']
        append_unique(manifest['p2Extensions'], [dict(
            file=ext['file'], original=bg['file'], size=[1120, 2040],
            originalOffset=[133, 99], sha256=ext['sha256'], batch='P2-10',
            priority='P1', source=SOURCE)], 'file')
        for building in pack['buildings']:
            append_unique(manifest['independentPNGs'], [dict(
                id=f'{building["id"]}_L{s["level"]}', category='建筑状态', file=s['file'],
                width=576, height=576, sha256=s['sha256'], batch='P2-10', priority='P1',
                source=SOURCE, sourceFile=building['source'], sourceHash=building['source_sha256'])
                for s in building['states']], 'id')
            entry = {**building, 'batch': 'P2-10', 'priority': 'P1', 'generationSource': SOURCE}
            append_unique(atlas['buildings'], [entry], 'id')
            for s in building['states']:
                asset_id = f'{building["id"]}_L{s["level"]}'
                if asset_id not in ids:
                    additions.append([asset_id, mid, building['name'], s['level'], s['file'], s['sha256']])
                    ids.add(asset_id)
        append_unique(atlas['backgrounds'], [dict(
            id=mid, name=pack['name'], file=bg['file'], size=[854, 1842],
            sha256=bg['sha256'], batch='P2-10', priority='P1', source=SOURCE)], 'id')
        if pack['layout']['file'] not in atlas['layout_configs']:
            atlas['layout_configs'].append(pack['layout']['file'])
        thumb = pack['thumbnail']
        composition = V2 / f'制作记录/补充20261119/地图建筑/{mid}_满级组合检查.png'
        sources = [bg, pack['layout']] + [b['states'][5] for b in pack['buildings']]
        append_unique(manifest['uiAssets'], [dict(
            id=f'map_thumb_{mid.lower()}', name=pack['name'] + '满级地标缩略图',
            states={'normal': thumb['file'].removeprefix('素材/')}, size=[768, 350],
            scale=1, anchor=[.5, .5], source='背景与全部L5按落位JSON合成，裁切主要地标后等比缩放；不移动建筑、不重绘',
            sourceFile=composition.relative_to(V2).as_posix(), sourceHash=sha(composition),
            priority='P1', batch='P2-10', sha256={'normal': thumb['sha256']},
            sources=[{'file': s['file'], 'sha256': s['sha256']} for s in sources],
            cropRect=thumb['cropRect'], sourceSize=[854, 1842],
            recommendedDisplayMode='landscape thumbnail, directly display; actual landmark crop')], 'id')
    atlas['counts'] = dict(backgrounds=len(atlas['backgrounds']), building_atlases=len(atlas['buildings']),
                           stages=sum(len(b['states']) for b in atlas['buildings']))
    manifest['counts'].update(backgrounds=len(atlas['backgrounds']), buildingBoards=len(atlas['buildings']),
                              buildingStates=atlas['counts']['stages'])
    write(manifest_path, manifest)
    write(atlas_path, atlas)
    if additions:
        text = io.StringIO(newline='')
        csv.writer(text, lineterminator='\n').writerows(additions)
        catalog_path.write_bytes(catalog + (b'\n' if not catalog.endswith(b'\n') else b'') + text.getvalue().encode('utf-8'))
    print('registered', ', '.join(maps), 'without modifying existing art entries')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--maps', nargs='+', required=True)
    register(parser.parse_args().maps)
