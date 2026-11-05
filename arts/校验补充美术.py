"""Verify the supplemental delivery after checkout; Python 3, standard library only."""
import hashlib
import json
from pathlib import Path
import struct
import sys


def verify(root):
    root = root.resolve()
    receipt = json.loads((root / "补充美术校验.json").read_text(encoding="utf-8"))

    def local_file(relative):
        path = root / relative
        if not isinstance(relative, str) or "\\" in relative or ":" in relative:
            raise ValueError(f"不是可移植相对路径：{relative}")
        if Path(relative).is_absolute() or ".." in Path(relative).parts:
            raise ValueError(f"路径越界：{relative}")
        if not path.resolve().is_relative_to(root):
            raise ValueError(f"路径越界：{relative}")
        return path

    checked = {}
    for entry in receipt["files"]:
        relative = entry["file"]
        if relative in checked:
            raise ValueError(f"重复文件：{relative}")
        data = local_file(relative).read_bytes()
        if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"文件内容校验失败：{relative}")
        checked[relative] = data

    catalogue = json.loads(checked["补充美术交付清单.json"].decode("utf-8"))
    if len(catalogue) != receipt["png_count"] or len(catalogue) != 113:
        raise ValueError("PNG条目数量不符")
    expected_counts = {1: 1, 2: 3, 3: 1, 5: 1, 6: 1, 7: 1, 8: 3, 9: 5,
                       10: 6, 11: 5, 12: 5, 13: 5, 14: 13, 15: 2, 16: 7,
                       17: 3, 18: 1, 19: 4, 20: 30, 21: 9, 22: 2, 23: 1, 24: 4}
    counts = {}
    images = set()
    for entry in catalogue:
        if not {"id", "file", "size", "state", "nine_slice", "notes"} <= entry.keys():
            raise ValueError("逐图清单字段不完整")
        relative = entry["file"]
        if relative in images or not relative.startswith("游戏素材/PNG/补充/"):
            raise ValueError(f"重复或错误PNG路径：{relative}")
        images.add(relative)
        data = checked[relative]
        if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            raise ValueError(f"不是PNG：{relative}")
        width, height, depth, color_type = struct.unpack(">IIBB", data[16:26])
        if [width, height] != entry["size"] or depth != 8 or color_type != 6:
            raise ValueError(f"PNG尺寸或RGBA格式不符：{relative}")
        insets = entry["nine_slice"]
        if insets is not None and (len(insets) != 4 or
                any(not isinstance(v, int) or v < 0 for v in insets) or
                insets[0] + insets[2] >= width or insets[1] + insets[3] >= height):
            raise ValueError(f"九宫格边距错误：{relative}")
        number = int(entry["id"].removeprefix("R-"))
        counts[number] = counts.get(number, 0) + 1
    if counts != expected_counts:
        raise ValueError(f"需求覆盖数量不符：{counts}")

    placement = json.loads(checked[receipt["placement_json"]].decode("utf-8"))
    if placement["canvas"] != [853, 1844] or placement["garden"] != "清风水湾":
        raise ValueError("地形画布或园名错误")
    buildings = placement["buildings"]
    if len(buildings) != 5 or {e["slot"] for e in buildings} != set(range(5)):
        raise ValueError("建筑槽位不完整")
    for entry in buildings:
        x, y = entry["center"]
        if not (0 <= x <= 853 and 0 <= y <= 1844 and entry["width"] > 0):
            raise ValueError(f"建筑落位无效：{entry}")
    print(f"PASS：{len(images)}张RGBA PNG、5个建筑落位、{len(checked)}个交付文件的SHA-256一致。")


if __name__ == "__main__":
    try:
        verify(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent)
    except (OSError, ValueError, KeyError, TypeError, struct.error) as error:
        print(f"FAIL：{error}", file=sys.stderr)
        raise SystemExit(1)
