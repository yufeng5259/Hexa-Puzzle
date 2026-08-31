# Flax Converter

将旧EgretFlax的 `game.json + game.png` 转成规范化JSON和独立PNG。工具不会修改源项目。

## 环境

- Node.js 20
- Windows PowerShell / PowerShell 7
- .NET System.Drawing
- 无npm依赖

## 命令

```powershell
node tools/flax-converter/src/cli.mjs inspect --input "H:\path\resource\swfs\game.json"
node tools/flax-converter/src/cli.mjs prepare --input "H:\path\resource\swfs\game.json" --output "assets/resources/legacy/flax"
pwsh -File tools/flax-converter/scripts/extract-atlas.ps1 -Manifest assets/resources/legacy/flax/atlas-manifest.json -Atlas "H:\path\resource\swfs\game.png" -OutputDirectory assets/resources/legacy/flax/frames
```

## 已确认规则

- 帧ID按字典序排序后映射Display的start/end。
- `type: null` 是图集Display。
- 帧槽字面量 `null` 表示隐藏，空槽继承上一帧。
- Cocos子节点坐标：`x=rawX-W*anchorX`、`y=rawY-H*anchorY`。
- 文字Y额外减3像素。
- 详细证据见 `.omx/plans/swf-conversion-rules.md`。

生成目录由工具管理，不应人工修改。
