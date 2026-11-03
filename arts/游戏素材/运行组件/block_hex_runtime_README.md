# Block 蜂巢运行组件

关卡只保存轴坐标 `cells`、摆放状态与 UI 参数；多关共用木纹、木框截面、单格凹槽三个原生材质。棋子继续引用既有五色素面／花朵母件，托盘继续引用同一个九宫格母件。无需每关保存完整木底、边框、投影或棋块组 PNG。

## 文件与精度

- `block_hex_runtime_reference.py`：独立精确参考，只依赖 Python 3.10+、numpy、Pillow、opencv-python。无需项目源码、Codex、本机盘符、账号或 API。给定同一份 spec 和母件，RGBA 与编辑用 Python renderer 相同，用于重建 PSD 图层或生成内存纹理。
- `block_hex_runtime.js`：零第三方 JS 依赖的浏览器 Canvas2D 运行参考，包含轴坐标适配、并集／内孔、木纹、26 像素木框截面、阴影、凹槽、障碍灰化、提示轮廓与选中框。实际浏览器已验证换 cells、37 格、透明内孔及缓存释放。
- `block_hex_runtime_demo.html`：加载 `renderer-contract.json` 的实际公共母件，可编辑 cells 重建，不写磁盘图片。请使用本地 HTTP 服务打开。直接用 `file://` 打开可能因浏览器对 fetch 或 Canvas 像素读取的限制而无法运行。
- `renderer-contract.json`：由当前交付清单生成母件相对路径及示例，文件名以本次交付实际内容为准，不依赖写死 PNG 名字。

Canvas2D 与 Pillow/OpenCV 的多边形栅格、缩放滤波及阴影滤波不同，JS 参考不宣称与 PSD 逐像素一致；精确编辑结果以独立 Python 参考为准。两者使用相同格心、轮廓、材质和层序。这里没有进行 Cocos 或其他引擎的实机导入。

## 描述文件

以下为结构示例，`file` 必须填写交付包实际母件相对于本组件目录的路径：

```json
{
  "renderer": "block.hex.v1",
  "material_version": "本次共享材质版本",
  "materials": {
    "hex_wood_floor": {"asset_id": "实际稳定ID", "file": "../PNG/公共素材/实际木纹文件.png"},
    "hex_rail_profile": {"asset_id": "实际稳定ID", "file": "../PNG/公共素材/实际截面文件.png"},
    "hex_empty_well": {"asset_id": "实际稳定ID", "file": "../PNG/公共素材/实际凹槽文件.png"}
  },
  "examples": [{"id": "示例", "cells": [[0,0],[1,0],[0,1]], "bbox": [0,0,703,705], "flip_y": true}]
}
```

`materials` 的值既可用路径字符串，也可用含 `file` 的对象；`asset_id` 便于接入游戏资源系统。示例支持 `bbox`、`flip_y` 和 `padding`，也可只设置顶层 `cells`。坐标盒是 `[left,top,width,height]`，普通拼图 `flip_y=true`，无尽模式 `false`。

## 浏览器接口

```js
const descriptor = await (await fetch('renderer-contract.json')).json();
const materials = await BlockHex.loadMaterials(descriptor.materials, document.baseURI);
const renderer = BlockHex.createRenderer(materials, {
  maxEntries: 12, materialVersion: descriptor.material_version
});
const spec = {
  renderer: 'block.hex.v1', cells: [[0,0],[1,0],[0,1]],
  bbox: [0,0,703,705], padding: 24, supersample: 2, flip_y: true
};
for (const role of ['shadow', 'floor', 'rim']) {
  context.drawImage(renderer.render({...spec, role}), 0, 0);
}
const fitted = BlockHex.layout(spec.cells, spec.bbox, spec.padding, spec.flip_y);
// 按 fitted.centers / fitted.radius 放入同一个凹槽或棋子母件。
renderer.clear(); // 退出关卡或材质热更新时释放缓存
```

缓存是内存中的 Canvas／纹理，键包含 cells、bbox、flip_y、padding、采样尺寸和材质版本。三个结构层共用一次距离场计算；相同参数再次请求复用缓存。材质变化时应创建新 renderer 或更新版本后释放旧缓存。修改 cells 或分辨率后重建一次即可，无需每帧计算。不要把生成缓存导出并随每个关卡打包。

`BlockHex.boundaryEdges(cells)` 返回公共边消除后的整数格点边段，包含外边和内孔边。可将这些边交给引擎 Mesh／shader：整数格点 `(ix,iy)` 转成实际坐标为 `x=ox+ix*radius/2`、`y=oy±iy*sqrt(3)*radius/2`，`ox,oy` 为 layout.offset。各格的三角扇可共用一张按统一 UV 采样的原木纹；只给返回的边段生成木框，避免内部重复描边。阴影可离屏缓存或由同一距离场材质生成。

## 精确 Python 接口

程序调用：

```python
from pathlib import Path
from block_hex_runtime_reference import render_component

package_root = Path('材质路径的基准目录')
def resolve(value):
    file = value['file'] if isinstance(value, dict) else value
    return package_root / file

image = render_component(procedural_spec, resolver=resolve)
# image 为未裁紧 RGBA。放入 PSD 时再按实例 alpha_crop 裁紧，使用实例 position。
```

命令行单层重建：

```text
python block_hex_runtime_reference.py --spec 单层参数.json --material-root 母件相对路径基准目录 --output 编辑重建缓存.png
```

省略 `--material-root` 时以 spec 文件所在目录解析材质路径。`renderer-contract.json` 的 demo 材质路径相对于 `运行组件/`；页面配置内的运行资源路径通常相对于 `游戏素材/`。调用者须按实际描述文件选择对应基准目录，不能把两种相对路径混用。独立 spec 的 `materials` 值应为包内路径或含 `file` 的对象；若配置保存的是资源 ID，程序调用须提供 ID→文件的 resolver。输入图层 role 为 `shadow`、`floor`、`rim`、`well`、`obstacle`、`outline` 或 `selection`。结构层需要 cells、bbox；单格需要 size；outline 支持完整 layout 和 outline_cells；selection 需要 size。

无论运行时绘制还是 PSD 重建，生成图不能再当作单独的关卡运行母件。PSD 编辑缓存嵌入实际分层源文件，公共母件和参数才是运行依赖。

## 官方原理参考

- [Cocos Creator 3.8 Sprite 渲染方式](https://docs.cocos.com/creator/3.8/manual/en/ui-system/components/editor/sprite.html)：原生精灵、九宫格与重复纹理。
- [脚本创建 Mesh](https://docs.cocos.com/creator/3.8/manual/en/asset/model/scripting-mesh.html)：按顶点、索引和 UV 构造几何。
- [RenderTexture](https://docs.cocos.com/creator/3.8/manual/en/asset/render-texture.html)：将绘制结果缓存后用于 2D／UI。
