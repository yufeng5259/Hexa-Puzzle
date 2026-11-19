"""Append P2-11 delivery notes without changing any preceding delivery line."""
from pathlib import Path
from package_art import MAPS
R=Path(__file__).resolve().parent
V=R.parents[2]
SUBTITLES=['仙露蜜','金苹果蜜','符文蜜','熔岩蜜','萤光蜜','月尘蜜','红岩蜜','星尘蜜','晶光蜜','星河蜜']
def append_notes():
 p=V/'美术交付说明.md'; text=p.read_text(encoding='utf8')
 rows=[]
 for (mid,(name,template,buildings)),sub in zip(MAPS.items(),SUBTITLES):
  start=5*int(mid[1:])-4
  rows.append(f'| {mid} {name} · {sub} | '+'、'.join(f'B{start+i}{b}' for i,b in enumerate(buildings))+' |')
 marker='| M20 珊瑚沉城 · 珍珠蜜 | B96珊瑚蜂宫、B97珍珠工坊、B98贝壳仓、B99气泡电梯、B100海底柱廊 |'
 if rows[0] not in text:
  assert marker in text;text=text.replace(marker,marker+'\n'+'\n'.join(rows),1)
 note='2026-11-19 P2-11 追加 M21–M30：330 张运行 PNG、10 份落位 JSON、50 张六态建筑图集（B101–B150）。模板 B：M22/M24/M27/M29；其余六图用 A。M30 蜂后星宫为终章，B150 蜂后星冠采用金色蜂翼冠冕与银河紫宝石层次。神话章节采用象征物，符文为几何图形。提示词、AI 原稿、技术核验与逐条自检见[本批验收记录](制作记录/补充20261119/P2-11/验收记录.md)；满级/L0组合、三底六态、M01–M30缩略图总览、逐像素结果见[对照目录](制作记录/补充20261119/对照/)。仅离线美术交付，未导入运行工程。\n\n'
 if note not in text:
  anchor='每栋图集左上到右下为L0—L5';assert anchor in text;text=text.replace(anchor,note+anchor,1)
 p.write_text(text,encoding='utf8')
if __name__=='__main__':append_notes()
