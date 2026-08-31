# Flax Prefab Generator

离线把`normalized-game.json`转换为Cocos Creator 3.8.x Prefab，并为图片生成确定性`.meta`。

```powershell
node tools/flax-prefab-generator/generate.mjs "H:\path\to\Block-Hexa-Puzzle-Online"
node tools/flax-prefab-generator/test.mjs
```

Egret源目录只会被读取。生成结果位于`assets/prefabs/legacy`和`assets/resources/legacy`。
