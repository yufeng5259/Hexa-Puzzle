# Prefab 结构

由 `tools/ui-gen` 根据 `tools/ui-gen/specs/` 生成，与 Prefab 同源；**不要手改本文**，改 spec 后运行 `node tools/ui-gen/gen.mjs --doc`。

读法：
- 树中每行是一个节点。`Sprite(…)` 为图片（arts 文件名）；`Label「示例」 key=…` 为本地化文字（运行时按 key 显示，示例仅供对照）；无 key 的 Label 为数值文字。
- `[Xxx]` 为挂在该节点上的组件脚本（行、卡片、HUD 等重复单元），其内部的 `@prop` 和按钮属于该组件。
- `→ onX` 为 Prefab 中绑定的按钮事件；`@prop` 为脚本的 `@property` 绑定（`[]` 为数组）。
- `Widget:top/bottom` 为贴边适配；`默认隐藏` 为状态节点；`List → Cell` 为动态列表（ScrollableItemGrid）。
- 坐标与尺寸取自页面配置（853×1844），文档中不列出。

共 1 个 Prefab。

- [puzzle](#puzzle)：1 个

## puzzle

### PuzzleWinPopup

拼图胜利结算（普通/限步星级）

- 文件：`assets/bundles/puzzle/prefabs/popups/PuzzleWinPopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/PuzzleWinPopup.ts`（PuzzleWinPopup extends PopupBase）　参数：{ level, mode, reward, stars, bestStars, bonusAd }
- 来源：T06-01_普通拼图成功、T07-01_限步星级结算　功能：F014、F015、F056
- 状态节点：Stars/StarLight（限步关显示）、Best（限步关显示历史最佳）、BtnBonusAd（无额度或已领时隐藏）；标题 key 普通「闯关成功」/限步「挑战完成」
- 动效（延后）：FX-01、FX-03、FX-11

```
PuzzleWinPopup  [PuzzleWinPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(结算_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.6」 key=block.common.level 参数{level}  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「440」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ StarLight  Sprite(星光放射)  @starLight  默认隐藏
   ├─ Stars  @starsRow  默认隐藏  空星由脚本换 R-05
   │  ├─ Star1  Sprite(金星完整母件)  @stars[]
   │  ├─ Star2  Sprite(金星完整母件)  @stars[]
   │  └─ Star3  Sprite(金星完整母件)  @stars[]
   ├─ PilotBee  Sprite(右上飞行蜜蜂)  @pilotBee
   ├─ Title  
   │  ├─ LeafL  Sprite(标题左花叶)
   │  ├─ LeafR  Sprite(标题右花叶)
   │  ├─ Ribbon  Sprite(闯关成功红飘带)
   │  └─ Text  Label「闯关成功」 key=block.30171313d141.text.5ce2d4cc8539  @titleLabel
   ├─ Level  Label「第 5 关」 key=block.30171313d141.text.fbeb832f1681 参数{level}  @levelLabel
   ├─ Reward  
   │  ├─ Card  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(蜂蜜货币)
   │  └─ Amount  Label「+80」  @rewardLabel
   ├─ Best  Label「历史最佳 3星」 key=block.5a183ef06031.text.dd7c87d6fe9c 参数{count}  @bestLabel  默认隐藏
   ├─ Claimed  Label「正常奖励已到账」 key=block.30171313d141.text.e9f9c74a6be3
   ├─ BtnNext  → onNext
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「下一关」 key=block.30171313d141.text.53c74482122c
   ├─ BtnBonusAd  → onBonusAd  @bonusAdButton
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「视频加领 +40」 key=block.30171313d141.text.be73b533883d 参数{count}  @bonusAdLabel
   ├─ CheerBee  Sprite(欢呼蜜蜂)
   └─ Bottom  Widget:bottom
      ├─ BtnBack  Sprite(返回按钮)  → onBack
      └─ BtnHome  Sprite(主页按钮)  → onHome
```
