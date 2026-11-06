# Prefab 结构

由 `tools/ui-gen` 根据 `tools/ui-gen/specs/` 生成，与 Prefab 同源；**不要手改本文**，改 spec 后运行 `node tools/ui-gen/gen.mjs --doc`。

读法：
- 树中每行是一个节点。`Sprite(…)` 为图片（arts 文件名）；`Label「示例」 key=…` 为本地化文字（运行时按 key 显示，示例仅供对照）；无 key 的 Label 为数值文字。
- `[Xxx]` 为挂在该节点上的组件脚本（行、卡片、HUD 等重复单元），其内部的 `@prop` 和按钮属于该组件。
- `→ onX` 为 Prefab 中绑定的按钮事件；`@prop` 为脚本的 `@property` 绑定（`[]` 为数组）。
- `Widget:top/bottom` 为贴边适配；`默认隐藏` 为状态节点；`List → Cell` 为动态列表（ScrollableItemGrid）。
- 坐标与尺寸取自页面配置（853×1844），文档中不列出。

共 49 个 Prefab。

- [resources](#resources)：1 个
- [common](#common)：8 个
- [puzzle](#puzzle)：11 个
- [garden](#garden)：5 个
- [endless](#endless)：4 个
- [meta](#meta)：20 个

## resources

### LoadingPage

启动加载页（主图）

- 文件：`assets/resources/prefabs/LoadingPage.prefab`
- 脚本：`assets/scripts/game/features/boot/LoadingPage.ts`（LoadingPage extends ViewBase）　参数：无；App 推进进度 setProgress(0..1)
- 来源：主图　功能：F001
- 动态内容：Progress/Fill 按进度改宽度（底槽内 0→100%），Status 显示百分比。待确认：所用贴图目前在 common 包，移入主包属于后续打包任务
- 动效（延后）：FX-12

```
LoadingPage  [LoadingPage]
├─ Background  Sprite(主图_完整裸背景)
├─ Title  Sprite(HoneyGarden标题插画)  游戏标题艺术字（设计要求，用图片）
├─ Bees  
│  ├─ FlyingBee  Sprite(右上飞行蜜蜂)
│  ├─ Bee  Sprite(右下蜜蜂主体)
│  ├─ Daisy  Sprite(右下雏菊)
│  └─ Pot  Sprite(右下蜂蜜浇水壶)
└─ Progress  Widget:bottom
   ├─ Track  Sprite(加载进度底槽)
   ├─ Fill  Sprite(加载进度填充)  @fill  横向填充
   └─ Status  Label「加载中… {percent}%」 key=hg.common.loading  @statusLabel
```

## common

### AdStatusPopup

激励视频状态（加载 / 暂无 / 确认中 / 冷却）

- 文件：`assets/bundles/common/prefabs/popups/AdStatusPopup.prefab`
- 脚本：`assets/scripts/game/features/common/AdStatusPopup.ts`（AdStatusPopup extends PopupBase）　参数：{ state: 'loading' | 'unavailable' | 'confirming' | 'cooldown', rewardKey?, amount?, cooldownSeconds? }
- 来源：T42-01_激励广告加载、T43-01_广告暂无可用、T44-01_广告奖励确认中、T45-01_视频冷却倒计时　功能：F052、F053–F057
- 动态内容：奖励文字（参数见 key）、冷却倒计时 mm:ss
- 状态节点：states[0..3] = Loading、Unavailable、Confirming、Cooldown 互斥显示。Cooldown 由小窗母版组合（T45 原稿为每日补给页按钮冷却态，页面本身归 SupplyPopup）
- 动效（延后）：FX-08

```
AdStatusPopup  [AdStatusPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Mask  Sprite(局内独立遮罩)
└─ Content  @content
   ├─ Panel  Sprite(空白主面板)
   ├─ Loading  @states[]  默认隐藏
   │  ├─ Title  Label「准备广告」 key=block.7f6eb246af9a.text.065c8903bb20
   │  ├─ Clock  Sprite(clock)
   │  ├─ Bulb  Sprite(灯泡道具)
   │  ├─ Reward  Label「提示 +1」 key=block.7f6eb246af9a.text.1cbaaa4850fd  @loadingRewardLabel
   │  ├─ Desc  Label「可随时返回，不影响游戏」 key=block.7f6eb246af9a.text.7da524005206
   │  └─ BtnContinue  → onCancel
   │     ├─ Bg  Sprite(下一关按钮)
   │     └─ Text  Label「继续游戏」 key=block.7f6eb246af9a.text.92ce6bb12f9e
   ├─ Unavailable  @states[]  默认隐藏
   │  ├─ Title  Label「暂时没有广告」 key=block.36ed9fba7e1c.text.065c8903bb20
   │  ├─ Bee  Sprite(抱蜜罐蜜蜂)
   │  ├─ Desc  Label「进度已经保留，先继续玩吧」 key=block.36ed9fba7e1c.text.7da524005206
   │  ├─ BtnContinue  → onCancel
   │  │  ├─ Bg  Sprite(下一关按钮)
   │  │  └─ Text  Label「继续游戏」 key=block.36ed9fba7e1c.text.92ce6bb12f9e
   │  └─ BtnRetry  → onRetry
   │     ├─ Bg  Sprite(再来一次按钮)
   │     └─ Text  Label「稍后再试」 key=block.36ed9fba7e1c.text.df78fe15dcb5
   ├─ Confirming  @states[]  默认隐藏
   │  ├─ Title  Label「奖励确认中」 key=block.c69f676056b0.text.065c8903bb20
   │  ├─ Clock  Sprite(clock)
   │  ├─ Bulb  Sprite(灯泡道具)
   │  ├─ Reward  Label「提示 +1」 key=block.c69f676056b0.text.1cbaaa4850fd  @confirmRewardLabel
   │  ├─ Desc  Label「确认后自动到账，无需在此等待」 key=block.c69f676056b0.text.7da524005206
   │  └─ BtnContinue  → onCancel
   │     ├─ Bg  Sprite(下一关按钮)
   │     └─ Text  Label「继续游戏」 key=block.c69f676056b0.text.92ce6bb12f9e
   └─ Cooldown  @states[]  默认隐藏  组合态：无独立原稿
      ├─ Title  Label「视频冷却中」 key=hg.common.ad_cooldown_title
      ├─ Clock  Sprite(clock)
      ├─ Countdown  Label「2:00」  @cooldownLabel
      ├─ Desc  Label「冷却结束后可再次观看」 key=hg.common.ad_cooldown_desc
      └─ BtnContinue  → onCancel
         ├─ Bg  Sprite(下一关按钮)
         └─ Text  Label「继续游戏」 key=block.7f6eb246af9a.text.92ce6bb12f9e
```

### ConfirmPopup

通用确认弹窗（退出本局 / 重新开始 / 无尽收获）

- 文件：`assets/bundles/common/prefabs/popups/ConfirmPopup.prefab`
- 脚本：`assets/scripts/game/features/common/ConfirmPopup.ts`（ConfirmPopup extends PopupBase）　参数：{ titleKey, messageKey, confirmKey, cancelKey, value?, params? } → Promise<boolean>
- 来源：T37-01_退出本局确认、T38-01_重新开始确认、T13-01_无尽主动收获确认　功能：F013、F034
- 动态内容：标题、说明、两个按钮文字由参数 key 经 setKey 设置
- 状态节点：ValueCard（仅无尽收获确认显示本局可收花蜜，同时隐藏 Bee）

```
ConfirmPopup  [ConfirmPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Mask  Sprite(局内独立遮罩)
└─ Content  @content
   ├─ Panel  Sprite(空白主面板)
   ├─ LeafL  Sprite(标题左花叶)
   ├─ LeafR  Sprite(标题右花叶)
   ├─ Plank  Sprite(关卡木牌)
   ├─ Title  Label「返回主界面？」 key=block.288d0398c71e.text.065c8903bb20  @titleLabel
   ├─ Message  Label「本局自动保存，下次接着玩」 key=block.288d0398c71e.text.c443ef8ffa25  @messageLabel
   ├─ Bee  Sprite(欢呼蜜蜂)  @bee
   ├─ ValueCard  @valueCard  默认隐藏
   │  ├─ Card  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(目标蜂蜜)
   │  ├─ Value  Label「90」  @valueLabel
   │  └─ Caption  Label「本局可收花蜜」 key=block.51ad87ae47a3.text.8b01bc0e5386  @valueCaptionLabel
   ├─ BtnConfirm  → onConfirm
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「保存并返回」 key=block.288d0398c71e.text.f431d66b83ad  @confirmLabel
   └─ BtnCancel  → onCancel
      ├─ Bg  Sprite(再来一次按钮)
      └─ Text  Label「继续这一局」 key=block.288d0398c71e.text.ee92c5c44254  @cancelLabel
```

### GuideOverlay

事件式新手引导层（8 步数据驱动）

- 文件：`assets/bundles/common/prefabs/popups/GuideOverlay.prefab`
- 脚本：`assets/scripts/game/features/common/GuideOverlay.ts`（GuideOverlay extends PopupBase）　参数：{ step: 1..8, tipKey, tipY, fingerPos, arrow?, dragGhost? }（引导步骤数据放配置）
- 来源：T51-01_引导_01主界面进入建设、T51-02_引导_02首次建造、T51-03_引导_03返回地图闯关、T51-04_引导_04整块拖放、T51-05_引导_05成功收获回家、T51-06_引导_06再次升级、T51-07_引导_07自由探索、T51-08_引导_08无尽首次消除　功能：F048、F049
- 动态内容：Tip 位置与文案、Finger/Arrow 位置按步骤数据设置；Step 用 key 参数 {value_1}/{value_2} 显示「当前 / 8」
- 状态节点：masks[0..7] 每步一张烘焙聚光遮罩（原稿逐步出图），只显示当前步；Arrow、DragGhost 仅第 4/8 步显示；背景不拦截点击，玩家直接操作高亮目标，引导由真实事件推进
- 动效（延后）：FX-07

```
GuideOverlay  [GuideOverlay]
├─ Backdrop  @backdrop  不拦截输入
└─ Content  @content
   ├─ Masks  
   │  ├─ Mask1  Sprite(引导聚光遮罩)  @masks[]
   │  ├─ Mask2  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   │  ├─ Mask3  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   │  ├─ Mask4  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   │  ├─ Mask5  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   │  ├─ Mask6  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   │  ├─ Mask7  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   │  └─ Mask8  Sprite(引导聚光遮罩)  @masks[]  默认隐藏
   ├─ DragGhost  @dragGhost  默认隐藏
   │  ├─ 整块拖影_格0  Sprite(金色无花母件)
   │  ├─ 整块拖影_格1  Sprite(金色无花母件)
   │  ├─ 整块拖影_格2  Sprite(金色无花母件)
   │  ├─ 整块拖影_格3  Sprite(金色无花母件)
   │  ├─ 整块拖影_格4  Sprite(金色无花母件)
   │  └─ 整块拖影_格5  Sprite(金色无花母件)
   ├─ Tip  @tip
   │  ├─ Frame  Sprite(空白主面板)
   │  ├─ Lining  Sprite(好友行底板_1)
   │  └─ Text  Label「先来花园，种下第一份惊喜」 key=block.003867ad1dda.text.595d70a3fbd3  @tipLabel
   ├─ Arrow  Sprite(arrow)  @arrow  默认隐藏
   ├─ Finger  Sprite(style_hand)  @finger
   └─ Bottom  Widget:bottom
      ├─ Step  Label「1 / 8」 key=block.003867ad1dda.text.632a513f0aeb  @stepLabel
      └─ Skip  Label「跳过引导」 key=block.003867ad1dda.text.ca28c968a709  → onSkip
```

### HelpPopup

图示帮助（目录 + 拖放拼图 / 满线消除 / 五级建设）

- 文件：`assets/bundles/common/prefabs/popups/HelpPopup.prefab`
- 脚本：`assets/scripts/game/features/common/HelpPopup.ts`（HelpPopup extends PopupBase）　参数：{ article?: 'puzzle' | 'endless' | 'build' }（无参数显示目录）
- 来源：T40-01_图示帮助_目录、T40-02_图示帮助_拖放拼图、T40-03_图示帮助_三轴消除、T40-04_图示帮助_五级建设　功能：F046
- 动态内容：无；图示为静态示意（缩略棋盘取页面配置中的格子图层，木框投影为程序生成层，未出图）
- 状态节点：Catalog 与 articles[0..2]（puzzle、endless、build）互斥显示；各状态自带背景、木牌与标题
- 动效（延后）：FX-07（示意动画）

```
HelpPopup  [HelpPopup]
├─ Backdrop  @backdrop  BlockInputEvents
└─ Content  @content
   ├─ Catalog  @catalog
   │  ├─ Background  Sprite(玩法_完整裸背景)
   │  ├─ Plank  Sprite(关卡木牌)
   │  ├─ Title  Label「看图就会」 key=block.be98dfd5120e.text.5ce2d4cc8539
   │  ├─ Intro  Label「选择一种图示，随时可以回来重看」 key=block.be98dfd5120e.text.4f3af19b4b9c
   │  ├─ Entry0  
   │  │  ├─ Panel  Sprite(空白主面板)
   │  │  ├─ Thumb  
   │  │  │  ├─ 帮助缩略0_凹槽_4_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_4_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_3_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_2_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_2_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_3_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_5_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_5_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_5_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_5_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_5_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_4_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_4_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_6_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_6_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_6_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_7_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_7_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略0_凹槽_3_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  └─ 帮助缩略0_障碍标记0  Label「×」 key=block.be98dfd5120e.text.279f485af868
   │  │  ├─ Title  Label「拼图拖放」 key=block.be98dfd5120e.text.ab72aae77162
   │  │  └─ BtnLearn  → onOpenArticle(puzzle)
   │  │     ├─ Bg  Sprite(下一关按钮)
   │  │     └─ Text  Label「看图学习」 key=block.be98dfd5120e.text.baed64d1cc7b
   │  ├─ Entry1  
   │  │  ├─ Panel  Sprite(空白主面板)
   │  │  ├─ Thumb  
   │  │  │  ├─ 帮助缩略1_凹槽_-3_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-3_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-3_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-3_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-2_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-2_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-2_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-2_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-2_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-1_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-1_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-1_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-1_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-1_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_-1_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_0_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_1_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_1_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_1_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_1_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_1_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_1_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_2_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_2_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_2_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_2_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_2_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_3_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_3_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_3_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_凹槽_3_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  │  ├─ 帮助缩略1_落地_-3_0  Sprite(金色落地母件)
   │  │  │  ├─ 帮助缩略1_落地_-2_0  Sprite(金色落地母件)
   │  │  │  ├─ 帮助缩略1_落地_-1_0  Sprite(金色落地母件)
   │  │  │  ├─ 帮助缩略1_落地_0_0  Sprite(金色落地母件)
   │  │  │  ├─ 帮助缩略1_落地_1_0  Sprite(金色落地母件)
   │  │  │  ├─ 帮助缩略1_落地_2_0  Sprite(金色落地母件)
   │  │  │  ├─ 帮助缩略1_落地_0_1  Sprite(粉色落地母件)
   │  │  │  └─ 帮助缩略1_落地_1_1  Sprite(粉色落地母件)
   │  │  ├─ Title  Label「满线消除」 key=block.be98dfd5120e.text.af9a49de172a
   │  │  └─ BtnLearn  → onOpenArticle(endless)
   │  │     ├─ Bg  Sprite(下一关按钮)
   │  │     └─ Text  Label「看图学习」 key=block.be98dfd5120e.text.baed64d1cc7b
   │  ├─ Entry2  
   │  │  ├─ Panel  Sprite(空白主面板)
   │  │  ├─ Thumb  Sprite(bee_agong)
   │  │  ├─ Title  Label「家园建设」 key=block.be98dfd5120e.text.720095bc075a
   │  │  └─ BtnLearn  → onOpenArticle(build)
   │  │     ├─ Bg  Sprite(下一关按钮)
   │  │     └─ Text  Label「看图学习」 key=block.be98dfd5120e.text.baed64d1cc7b
   │  └─ BtnReturn  → onBack  Widget:bottom
   │     ├─ Bg  Sprite(再来一次按钮)
   │     └─ Text  Label「返回设置」 key=block.be98dfd5120e.text.8c9b6b3ffbf4
   ├─ Puzzle  @articles[]  默认隐藏
   │  ├─ Background  Sprite(玩法_完整裸背景)
   │  ├─ Plank  Sprite(关卡木牌)
   │  ├─ Title  Label「拖放拼图」 key=block.54f1edc98d06.text.5ce2d4cc8539
   │  ├─ Panel  Sprite(空白主面板)
   │  ├─ Step1  Label「1  抓起整块」 key=block.54f1edc98d06.text.2dfed5d0b87e
   │  ├─ Source  
   │  │  ├─ 教学整块源_无字木托盘  Sprite(空待放托盘)
   │  │  ├─ 教学整块源_拼块0_格0  Sprite(金色无花母件)
   │  │  ├─ 教学整块源_拼块0_格1  Sprite(金色无花母件)
   │  │  ├─ 教学整块源_拼块0_格2  Sprite(金色无花母件)
   │  │  ├─ 教学整块源_拼块0_格3  Sprite(金色无花母件)
   │  │  ├─ 教学整块源_拼块0_格4  Sprite(金色无花母件)
   │  │  └─ 教学整块源_拼块0_格5  Sprite(金色无花母件)
   │  ├─ Step2  Label「2  放入相同轮廓」 key=block.54f1edc98d06.text.248c17d5af3c
   │  ├─ Target  
   │  │  ├─ 教学真实目标_凹槽_4_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_4_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_3_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_2_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_2_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_3_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_5_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_5_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_5_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_5_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_5_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_4_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_4_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_6_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_6_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_6_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_7_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_7_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 教学真实目标_凹槽_3_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  └─ 教学真实目标_障碍标记0  Label「×」 key=block.54f1edc98d06.text.7cd209128662
   │  ├─ Arrow  Sprite(arrow)
   │  ├─ Rule  Label「仅平移，不旋转；拖错会返回」 key=block.54f1edc98d06.text.9b8e8d78cc91
   │  └─ Bottom  Widget:bottom
   │     ├─ BtnTry  → onTry
   │     │  ├─ Bg  Sprite(下一关按钮)
   │     │  └─ Text  Label「我来试试」 key=block.54f1edc98d06.text.6694a4bc190a
   │     └─ BtnReturn  → onCatalog
   │        ├─ Bg  Sprite(再来一次按钮)
   │        └─ Text  Label「返回」 key=block.54f1edc98d06.text.7c10f0888c8c
   ├─ Endless  @articles[]  默认隐藏
   │  ├─ Background  Sprite(无尽模式_完整裸背景)
   │  ├─ Plank  Sprite(关卡木牌)
   │  ├─ Title  Label「满线消除」 key=block.1e9c207fa389.text.5ce2d4cc8539
   │  ├─ Steps  Label「放入缺口 → 完整一行 → 消除」 key=block.1e9c207fa389.text.06e9fec317af
   │  ├─ Panel  Sprite(空白主面板)
   │  ├─ Axes  
   │  │  ├─ 三轴方向_竖向  Sprite(arrow)
   │  │  ├─ 三轴方向_下斜  Sprite(arrow)
   │  │  └─ 三轴方向_上斜  Sprite(arrow)
   │  ├─ Board  
   │  │  ├─ 三轴真实37格演示_凹槽_-3_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-3_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-3_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-3_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-2_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-2_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-2_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-2_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-2_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-1_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-1_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-1_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-1_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-1_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_-1_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_0_3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_1_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_1_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_1_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_1_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_1_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_1_2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_2_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_2_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_2_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_2_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_2_1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_3_-3  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_3_-2  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_3_-1  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_凹槽_3_0  Sprite(木边与内孔规范_凹槽_1_1)
   │  │  ├─ 三轴真实37格演示_落地_-3_0  Sprite(金色落地母件)
   │  │  ├─ 三轴真实37格演示_落地_-2_0  Sprite(金色落地母件)
   │  │  ├─ 三轴真实37格演示_落地_-1_0  Sprite(金色落地母件)
   │  │  ├─ 三轴真实37格演示_落地_0_0  Sprite(金色落地母件)
   │  │  ├─ 三轴真实37格演示_落地_1_0  Sprite(金色落地母件)
   │  │  ├─ 三轴真实37格演示_落地_2_0  Sprite(金色落地母件)
   │  │  ├─ 三轴真实37格演示_落地_0_1  Sprite(粉色落地母件)
   │  │  └─ 三轴真实37格演示_落地_1_1  Sprite(粉色落地母件)
   │  ├─ Ghost  Sprite(金色无花母件)
   │  ├─ Arrow  Sprite(arrow)
   │  ├─ Rule  Label「任一完整直线，三个方向都算」 key=block.1e9c207fa389.text.ea2f025bc50e
   │  ├─ Score  Label「整线消除 +100」 key=block.1e9c207fa389.text.c6fe804656ab
   │  └─ Bottom  Widget:bottom
   │     ├─ BtnTry  → onTry
   │     │  ├─ Bg  Sprite(下一关按钮)
   │     │  └─ Text  Label「我来试试」 key=block.1e9c207fa389.text.6694a4bc190a
   │     └─ BtnReturn  → onCatalog
   │        ├─ Bg  Sprite(再来一次按钮)
   │        └─ Text  Label「返回」 key=block.1e9c207fa389.text.7c10f0888c8c
   ├─ Build  @articles[]  默认隐藏
   │  ├─ Background  Sprite(建造界面_完整裸背景)
   │  ├─ Plank  Sprite(关卡木牌)
   │  ├─ Title  Label「家园升级」 key=block.9afa1990d313.text.5ce2d4cc8539
   │  ├─ Panel  Sprite(空白主面板)
   │  ├─ Stage1  Sprite(向阳花园_树屋_1级_原生母件)
   │  ├─ Stage2  Sprite(向阳花园_树屋_2级_原生母件)
   │  ├─ StageArrow  Sprite(arrow)
   │  ├─ Lv1  Label「Lv.1」 key=block.common.level
   │  ├─ Lv2  Label「Lv.2」 key=block.common.level
   │  ├─ BtnDemo  示意按钮，无事件
   │  │  ├─ Bg  Sprite(下一关按钮)
   │  │  └─ Text  Label「升级  40 花蜜」 key=block.9afa1990d313.text.17276c117092
   │  ├─ Arrow  Sprite(arrow)
   │  ├─ Result  Label「Lv.2  ·  花蜜 160 → 120」 key=block.9afa1990d313.text.df9ca19f977f
   │  ├─ Progress  
   │  │  ├─ Frame  Sprite(树屋进度容器)
   │  │  ├─ Track  Sprite(树屋进度底轨)
   │  │  ├─ Fill  Sprite(树屋进度填充)
   │  │  └─ Count  Label「2 / 5」 key=block.9afa1990d313.text.a58b99117aac
   │  ├─ Rule  Label「每栋最多 5 级，不需要等待」 key=block.9afa1990d313.text.a639a521913c
   │  └─ BtnOk  → onCatalog  Widget:bottom
   │     ├─ Bg  Sprite(下一关按钮)
   │     └─ Text  Label「知道了」 key=block.9afa1990d313.text.8499fdf9c8ad
   └─ Hud  [TopHud]  Widget:top
      ├─ Avatar  → onAvatar
      │  ├─ Frame  Sprite(玩法_头像空白等级)
      │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
      ├─ Hints  
      │  ├─ Bar  Sprite(透明计数底条)
      │  ├─ Icon  Sprite(灯泡道具)
      │  ├─ Count  Label「5」  @hintLabel
      │  └─ Caption  Label「提示」 key=block.be98dfd5120e.text.3a7b9e292b57
      ├─ Honey  
      │  ├─ Bar  Sprite(透明计数底条)
      │  ├─ Icon  Sprite(蜂蜜货币)
      │  └─ Count  Label「360」  @honeyLabel
      └─ Settings  Sprite(设置木质齿轮)  → onSettings
```

### LocalSavePopup

本地存档摘要

- 文件：`assets/bundles/common/prefabs/popups/LocalSavePopup.prefab`
- 脚本：`assets/scripts/game/features/common/LocalSavePopup.ts`（LocalSavePopup extends PopupBase）　参数：无；读取存档摘要
- 来源：T46-01_本地存档　功能：F065、F017、F013
- 动态内容：关卡与园（参数见 key）、存档状态、建设进度、花蜜数
- 状态节点：BtnContinue（无未完成拼图局时隐藏）

```
LocalSavePopup  [LocalSavePopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ RopeL  Sprite(左悬绳)
   ├─ RopeR  Sprite(右悬绳)
   ├─ Plank  Sprite(好友标题木牌)
   ├─ Title  Label「本地存档」 key=block.0e592132aa09.text.5ce2d4cc8539
   ├─ Subtitle  Label「每次操作自动保存在本机」 key=block.0e592132aa09.text.13d7ce0196ca
   ├─ SaveIcon  Sprite(R-13_图标_存档)  原稿为主页按钮占位，按 R-13 换存档图标
   ├─ Progress  Label「第1关 · 第1园」 key=block.0e592132aa09.text.f3cf00fd105c  @progressLabel
   ├─ Status  Label「原局已保存在本机」 key=block.0e592132aa09.text.1736655c9e0c  @statusLabel
   ├─ Record  
   │  ├─ Board  Sprite(好友行底板_1)
   │  ├─ Build  Label「建设 2/25」 key=block.0e592132aa09.text.837b042bdc38  @buildLabel
   │  ├─ HoneyIcon  Sprite(蜂蜜货币)
   │  └─ Honey  Label「360」  @honeyLabel
   ├─ Note  Label「不需要网络 · 下次接着玩」 key=block.0e592132aa09.text.f942d64285f2
   ├─ BtnSave  → onSave
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「保存当前进度」 key=block.0e592132aa09.text.f2df02ddeaf6
   ├─ BtnContinue  → onContinue  @continueButton
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「继续上次一局」 key=block.0e592132aa09.text.8a8f329df468
   └─ BtnBack  Sprite(返回按钮)  → onBack  Widget:bottom
```

### PrivacyPopup

隐私与本机数据说明

- 文件：`assets/bundles/common/prefabs/popups/PrivacyPopup.prefab`
- 脚本：`assets/scripts/game/features/common/PrivacyPopup.ts`（PrivacyPopup extends PopupBase）　参数：无
- 来源：T50-01_隐私与数据说明　功能：F051
- 动态内容：无（静态说明文案）

```
PrivacyPopup  [PrivacyPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ RopeL  Sprite(左悬绳)
   ├─ RopeR  Sprite(右悬绳)
   ├─ Plank  Sprite(好友标题木牌)
   ├─ Title  Label「隐私与数据说明」 key=block.e691c8a8beaf.text.5ce2d4cc8539
   ├─ Subtitle  Label「安心玩，慢慢建」 key=block.e691c8a8beaf.text.13d7ce0196ca
   ├─ Shield  Sprite(R-13_图标_隐私)  原稿占位为齿轮，按 R-13 换隐私图标
   ├─ Section0  
   │  ├─ Head  Label「本机存档」 key=block.e691c8a8beaf.text.d4df667fbb53
   │  └─ Body  Label「游戏进度与设置保存在本机，无需账号即可游玩。每次操作都会自动保存，下次可继续原局。」 key=block.e691c8a8beaf.text.22556e646419
   ├─ Section1  
   │  ├─ Head  Label「自愿观看视频」 key=block.e691c8a8beaf.text.ca154d767e46
   │  └─ Body  Label「仅在您主动选择观看视频时请求网络。视频为自愿操作，不影响正常游戏启动与单机游玩。」 key=block.e691c8a8beaf.text.6e9a5b5a74d8
   ├─ Section2  
   │  ├─ Head  Label「进度与奖励」 key=block.e691c8a8beaf.text.77174d8658fb
   │  └─ Body  Label「取消观看、加载失败或暂时没有广告，均不扣除正常游戏奖励。奖励确认中时，可以继续游玩，确认后自动到账。」 key=block.e691c8a8beaf.text.22bdd94d1539
   ├─ BtnReturn  → onBack
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「返回设置」 key=block.e691c8a8beaf.text.8c9b6b3ffbf4
   └─ BtnBack  Sprite(返回按钮)  → onBack  Widget:bottom
```

### SettingsPopup

声音与易用设置

- 文件：`assets/bundles/common/prefabs/popups/SettingsPopup.prefab`
- 脚本：`assets/scripts/game/features/common/SettingsPopup.ts`（SettingsPopup extends PopupBase）　参数：无；读写存档 settings
- 来源：T39-01_声音与易用设置　功能：F047、F046、F051、F065
- 动态内容：5 行开关状态（SettingRow：BaseOn/BaseOff 切换，Knob 左右位置）；行顺序 music、sfx、vibrate、reduceMotion、largeText
- 状态节点：每行 BaseOn / BaseOff
- 动效（延后）：FX-12

```
SettingsPopup  [SettingsPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ RopeL  Sprite(左悬绳)
   ├─ RopeR  Sprite(右悬绳)
   ├─ Plank  Sprite(好友标题木牌)
   ├─ Title  Label「设置」 key=block.4a5f6d4e4b94.text.5ce2d4cc8539
   ├─ Row0  [SettingRow]  → onToggle(music)  @rows[]
   │  ├─ Board  Sprite(好友行底板_1)
   │  ├─ Icon  Sprite(R-09_图标_音乐)
   │  ├─ Title  Label「音乐」 key=block.4a5f6d4e4b94.text.1934ab78547f
   │  ├─ BaseOn  Sprite(R-08_设置开关_底_开)  @baseOn
   │  ├─ BaseOff  Sprite(R-08_设置开关_底_关)  @baseOff  默认隐藏
   │  └─ Knob  Sprite(R-08_设置开关_滑块)  @knob  开 x=632 / 关 x=562，由脚本移动
   ├─ Row1  [SettingRow]  → onToggle(sfx)  @rows[]
   │  ├─ Board  Sprite(好友行底板_1)
   │  ├─ Icon  Sprite(R-09_图标_音效)
   │  ├─ Title  Label「音效」 key=block.4a5f6d4e4b94.text.d68eaca0062d
   │  ├─ BaseOn  Sprite(R-08_设置开关_底_开)  @baseOn
   │  ├─ BaseOff  Sprite(R-08_设置开关_底_关)  @baseOff  默认隐藏
   │  └─ Knob  Sprite(R-08_设置开关_滑块)  @knob  开 x=632 / 关 x=562，由脚本移动
   ├─ Row2  [SettingRow]  → onToggle(vibrate)  @rows[]
   │  ├─ Board  Sprite(好友行底板_1)
   │  ├─ Icon  Sprite(R-09_图标_震动)
   │  ├─ Title  Label「震动」 key=block.4a5f6d4e4b94.text.abb191eb96ff
   │  ├─ BaseOn  Sprite(R-08_设置开关_底_开)  @baseOn
   │  ├─ BaseOff  Sprite(R-08_设置开关_底_关)  @baseOff  默认隐藏
   │  └─ Knob  Sprite(R-08_设置开关_滑块)  @knob  开 x=632 / 关 x=562，由脚本移动
   ├─ Row3  [SettingRow]  → onToggle(reduceMotion)  @rows[]
   │  ├─ Board  Sprite(好友行底板_1)
   │  ├─ Icon  Sprite(R-09_图标_减少动效)
   │  ├─ Title  Label「减少动效」 key=block.4a5f6d4e4b94.text.6fc6acdb7343
   │  ├─ BaseOn  Sprite(R-08_设置开关_底_开)  @baseOn
   │  ├─ BaseOff  Sprite(R-08_设置开关_底_关)  @baseOff  默认隐藏
   │  └─ Knob  Sprite(R-08_设置开关_滑块)  @knob  开 x=632 / 关 x=562，由脚本移动
   ├─ Row4  [SettingRow]  → onToggle(largeText)  @rows[]
   │  ├─ Board  Sprite(好友行底板_1)
   │  ├─ Icon  Sprite(R-09_图标_大字)
   │  ├─ Title  Label「大字显示」 key=block.4a5f6d4e4b94.text.9d9a88aa838c
   │  ├─ BaseOn  Sprite(R-08_设置开关_底_开)  @baseOn
   │  ├─ BaseOff  Sprite(R-08_设置开关_底_关)  @baseOff  默认隐藏
   │  └─ Knob  Sprite(R-08_设置开关_滑块)  @knob  开 x=632 / 关 x=562，由脚本移动
   ├─ BtnHelp  → onHelp
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「看图帮助」 key=block.4a5f6d4e4b94.text.151f8811b62a
   ├─ BtnLocalSave  → onLocalSave
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「本地存档」 key=block.4a5f6d4e4b94.text.2f471e838294
   ├─ BtnPrivacy  → onPrivacy
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「隐私说明」 key=block.4a5f6d4e4b94.text.f41e8a24e25e
   └─ BtnReturn  → onBack  Widget:bottom
      ├─ Bg  Sprite(下一关按钮)
      └─ Text  Label「返回游戏」 key=block.4a5f6d4e4b94.text.6fa2cd41db0f
```

### Toast

飘字提示

- 文件：`assets/bundles/common/prefabs/popups/Toast.prefab`
- 脚本：`assets/scripts/game/features/common/Toast.ts`（Toast extends PopupBase）　参数：{ textKey, params? }（显示后自动关闭）
- 来源：—　功能：F002
- 动态内容：文案 hg.common.toast 的 {text} 由调用方填入已本地化文本
- 状态节点：飘字不拦截输入
- 动效（延后）：FX-12

```
Toast  [Toast]
├─ Backdrop  @backdrop  不拦截输入
└─ Content  @content
   └─ Bar  @bar
      ├─ Bg  Sprite(玩法提示条)
      └─ Text  Label「{text}」 key=hg.common.toast  @textLabel
```

## puzzle

### BoardCell

棋盘格（对象池）

- 文件：`assets/bundles/common/prefabs/items/BoardCell.prefab`
- 脚本：`assets/scripts/game/features/board/BoardCell.ts`（BoardCell extends Component）　参数：setState(groove | hint | obstacle)；节点缩放到棋盘格半径
- 来源：T02-01_普通异形拼图_三块　功能：F010、F016、F030
- 状态节点：Groove 常显；Hint（提示轮廓 / 可放预览）、Obstacle（固定障碍 ×）默认隐藏
- 动效（延后）：FX-10

```
BoardCell  [BoardCell]
├─ Groove  Sprite(木边与内孔规范_凹槽_1_1)  @groove
├─ Hint  Sprite(R-23_六角发光描边)  @hint  默认隐藏
└─ Obstacle  Sprite(锁定道具图标)  @obstacle  默认隐藏  障碍格标记（设计稿为程序生成 ×，见报告）
```

### PieceCell

拼块单格（对象池）

- 文件：`assets/bundles/common/prefabs/items/PieceCell.prefab`
- 脚本：`assets/scripts/game/features/board/PieceCell.ts`（PieceCell extends Component）　参数：setLook(colorIndex 0–4, landed: boolean)
- 来源：T02-01_普通异形拼图_三块　功能：F010、F030
- 动态内容：frames[color*2 + (landed?1:0)]：5 色 × 无花/落地
- 动效（延后）：FX-09、FX-10
- 资源属性：frames=金色无花母件_fffc6eb821/金色落地母件_cd24968629/蓝色无花母件_571c35df73/蓝色落地母件_c9b53c8c1d/粉色无花母件_81f23ace92/粉色落地母件_0a5de39746/绿色无花母件_7bc3788324/绿色落地母件_3dc49c9fbf/紫色无花母件_2e873cf200/紫色落地母件_320e46d3b1

```
PieceCell  [PieceCell]
└─ Body  Sprite(金色无花母件)  @body
```

### ChallengeFailPopup

限步失败救局（拼图局之上）

- 文件：`assets/bundles/puzzle/prefabs/popups/ChallengeFailPopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/ChallengeFailPopup.ts`（ChallengeFailPopup extends PopupBase）　参数：{ level: number, remainingPieces: number, adSteps: number, adAvailable: boolean }
- 来源：T08-01_限步失败救局　功能：F011、F054
- 动态内容：待完成块数；视频续步数（参数 {count}）
- 状态节点：BtnContinueAd：无广告额度时隐藏

```
ChallengeFailPopup  [ChallengeFailPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Dim  Sprite(局内独立遮罩)
└─ Content  @content
   ├─ Panel  Sprite(空白主面板)
   ├─ LeafL  Sprite(标题左花叶)
   ├─ LeafR  Sprite(标题右花叶)
   ├─ Title  
   │  ├─ Board  Sprite(关卡木牌)
   │  └─ Text  Label「还差一点」 key=block.b3ebda463141.text.065c8903bb20
   ├─ Message  Label「步数用完了，拼图还在」 key=block.b3ebda463141.text.c443ef8ffa25
   ├─ Card  
   │  ├─ Bg  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(粉色无花母件)
   │  ├─ Value  Label「2」  @remainLabel
   │  └─ Caption  Label「块待完成」 key=block.b3ebda463141.text.8b01bc0e5386
   ├─ BtnRetry  → onRetry
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「免费重试」 key=block.b3ebda463141.text.55cb35c7623e
   ├─ BtnContinueAd  → onContinueAd  @adButton
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「视频 · 继续 +3 步」 key=block.b3ebda463141.text.38ac6307c4f7  @adLabel
   └─ BtnMap  → onMap
      ├─ Bg  Sprite(再来一次按钮)
      └─ Text  Label「返回地图」 key=block.b3ebda463141.text.036ebab33b47
```

### FeaturedPopup

每日精选复玩（3 题）

- 文件：`assets/bundles/puzzle/prefabs/popups/FeaturedPopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/FeaturedPopup.ts`（FeaturedPopup extends PopupBase）　参数：无（按 dayKey 选出 3 个已通关普通关）
- 来源：T10-01_每日精选复玩　功能：F021
- 动态内容：3 个 FeaturedEntry 固定槽：关号、复玩奖励、题目缩略；今日复玩花蜜次数
- 状态节点：已通关不足 3 题时多余条目隐藏

```
FeaturedPopup  [FeaturedPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ RopeL  Sprite(左悬绳)
   │  ├─ RopeR  Sprite(右悬绳)
   │  ├─ Board  Sprite(好友标题木牌)
   │  └─ Text  Label「今日精选」 key=block.895665d5e835.text.5ce2d4cc8539
   ├─ Quota  Label「复玩花蜜 0/5 次」 key=block.895665d5e835.text.13d7ce0196ca  @quotaLabel
   ├─ Entries  
   │  ├─ Entry1  [FeaturedEntry]  @entries[]
   │  │  ├─ Bg  Sprite(好友行底板_1)
   │  │  ├─ PreviewRoot  Slot  @previewRoot  题目缩略（程序生成）
   │  │  ├─ Level  Label「第 2 关」 key=block.895665d5e835.text.20d62ff09b72  @levelLabel
   │  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
   │  │  ├─ Reward  Label「+20」  @rewardLabel
   │  │  └─ BtnPlay  → onPlay
   │  │     ├─ Bg  Sprite(下一关按钮)
   │  │     └─ Text  Label「再拼一次」 key=block.895665d5e835.text.33767ea932d6
   │  ├─ Entry2  [FeaturedEntry]  @entries[]
   │  │  ├─ Bg  Sprite(好友行底板_1)
   │  │  ├─ PreviewRoot  Slot  @previewRoot  题目缩略（程序生成）
   │  │  ├─ Level  Label「第 3 关」 key=block.895665d5e835.text.48e1078a0b27  @levelLabel
   │  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
   │  │  ├─ Reward  Label「+20」  @rewardLabel
   │  │  └─ BtnPlay  → onPlay
   │  │     ├─ Bg  Sprite(下一关按钮)
   │  │     └─ Text  Label「再拼一次」 key=block.895665d5e835.text.33767ea932d6
   │  └─ Entry3  [FeaturedEntry]  @entries[]
   │     ├─ Bg  Sprite(好友行底板_1)
   │     ├─ PreviewRoot  Slot  @previewRoot  题目缩略（程序生成）
   │     ├─ Level  Label「第 4 关」 key=block.895665d5e835.text.ee918bc316bb  @levelLabel
   │     ├─ HoneyIcon  Sprite(蜂蜜货币)
   │     ├─ Reward  Label「+20」  @rewardLabel
   │     └─ BtnPlay  → onPlay
   │        ├─ Bg  Sprite(下一关按钮)
   │        └─ Text  Label「再拼一次」 key=block.895665d5e835.text.33767ea932d6
   ├─ Note  Label「与普通复玩共用每日5次花蜜额度」 key=block.895665d5e835.text.cba4ba9f1d75
   ├─ BtnContinue  → onContinue
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「继续主线」 key=block.895665d5e835.text.95911a26a2ac
   └─ Bottom  Widget:bottom
      ├─ Bee  Sprite(抱蜜罐蜜蜂)
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### HintEmptyPopup

提示不足（拼图局之上）

- 文件：`assets/bundles/puzzle/prefabs/popups/HintEmptyPopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/HintEmptyPopup.ts`（HintEmptyPopup extends PopupBase）　参数：{ adAvailable: boolean, freeAvailable: boolean }
- 来源：T41-01_提示不足　功能：F016、F053、F057
- 动态内容：当前提示库存
- 状态节点：BtnHintAd：无广告额度时隐藏；BtnFree：今日免费已领时隐藏

```
HintEmptyPopup  [HintEmptyPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Dim  Sprite(局内独立遮罩)
└─ Content  @content
   ├─ Panel  Sprite(空白主面板)
   ├─ LeafL  Sprite(标题左花叶)
   ├─ LeafR  Sprite(标题右花叶)
   ├─ Title  
   │  ├─ Board  Sprite(关卡木牌)
   │  └─ Text  Label「要一点灵感吗？」 key=block.de722da5de02.text.065c8903bb20
   ├─ Message  Label「库存为 0，仍可继续自己拼」 key=block.de722da5de02.text.c443ef8ffa25
   ├─ Card  
   │  ├─ Bg  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(提示灯泡)
   │  ├─ Value  Label「0」  @stockLabel
   │  └─ Caption  Label「提示库存」 key=block.de722da5de02.text.8b01bc0e5386
   ├─ BtnResume  → onResume
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「继续自己拼」 key=block.de722da5de02.text.990173aca226
   ├─ BtnHintAd  → onHintAd  @adButton
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「视频 +1 提示」 key=block.de722da5de02.text.3fe2ef7385fd
   └─ BtnFree  → onFreeHint  @freeButton
      ├─ Bg  Sprite(再来一次按钮)
      └─ Text  Label「每日免费 +1」 key=block.de722da5de02.text.0f0d0475dabe
```

### LevelPreviewPopup

开局预览（普通 / 限步共用）

- 文件：`assets/bundles/puzzle/prefabs/popups/LevelPreviewPopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/LevelPreviewPopup.ts`（LevelPreviewPopup extends PopupBase）　参数：{ level: number }
- 来源：T01-01_普通拼图开局、T04-01_限步关开局　功能：F009、F021
- 动态内容：BoardRoot/TrayRoot 用与拼图局相同的 BoardView 只读预览；剩余数（拼块数或步数）、目标格数、提示库存、本次可得花蜜
- 状态节点：Remain 标题与 Reward 文案按普通/限步、首通/复玩切换 key（props）
- 资源属性：remainKeyPieces="block.fb14446e7454.text.55a87ff8eb1b"；remainKeyMoves="block.92709cf7dc5a.text.55a87ff8eb1b"；rewardKeyFirst="block.92709cf7dc5a.text.594272093dde"；rewardKeyReplay="block.fb14446e7454.text.594272093dde"

```
LevelPreviewPopup  [LevelPreviewPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(玩法_完整裸背景)
└─ Content  @content
   ├─ BoardRoot  Slot [HexBoard]  @board  属性:cellPrefab,piecePrefab  只读棋盘预览
   │  ├─ Frame  Graphics  @frame
   │  ├─ Cells  Slot  @cells
   │  └─ Pieces  Slot  @pieces
   ├─ Top  Widget:top
   │  ├─ Hud  [TopHud]
   │  │  ├─ Avatar  → onAvatar
   │  │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  │  ├─ Hints  
   │  │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  │  ├─ Count  Label「5」  @hintLabel
   │  │  │  └─ Caption  Label「提示」 key=block.fb14446e7454.text.3a7b9e292b57
   │  │  ├─ Honey  
   │  │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  │  └─ Count  Label「360」  @honeyLabel
   │  │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   │  ├─ Sign  
   │  │  ├─ Board  Sprite(关卡木牌)
   │  │  └─ Title  Label「第 1 关」 key=block.fb14446e7454.text.5ce2d4cc8539  @titleLabel
   │  └─ Stats  
   │     ├─ RopeL  Sprite(金编绳面板连接件)
   │     ├─ RopeR  Sprite(金编绳面板连接件)
   │     ├─ Remain  
   │     │  ├─ Panel  Sprite(步数空底板)
   │     │  ├─ Title  Label「剩余拼块」 key=block.fb14446e7454.text.55a87ff8eb1b  @remainTitleLabel
   │     │  └─ Value  Label「3」  @remainLabel
   │     ├─ Target  
   │     │  ├─ Panel  Sprite(目标空底板)
   │     │  ├─ Icon  Sprite(目标蜂蜜)
   │     │  └─ Value  Label「0/18」  @targetLabel
   │     └─ HintStock  
   │        ├─ Panel  Sprite(提示空底板)
   │        ├─ Icon  Sprite(提示灯泡)
   │        ├─ Add  Sprite(提示增加按钮)
   │        └─ Value  Label「5」  @hintStockLabel
   └─ Bottom  Widget:bottom
      ├─ Tray  Sprite(空待放托盘)
      ├─ TrayRoot  Slot  @trayRoot  只读托盘预览
      ├─ Platform  Sprite(底部木地台)
      ├─ Reward  Label「本次复玩可得 20 花蜜」 key=block.fb14446e7454.text.594272093dde  @rewardLabel
      ├─ BtnStart  → onStart
      │  ├─ Bg  Sprite(下一关按钮)
      │  └─ Text  Label「免费开始」 key=block.fb14446e7454.text.153474c76815
      └─ BtnBack  Label「返回地图」 key=block.fb14446e7454.text.a56e8056bd25  → onBack
```

### MapPage

主线地图（唯一主界面，12 页 × 8 关）

- 文件：`assets/bundles/puzzle/prefabs/pages/MapPage.prefab`
- 脚本：`assets/scripts/game/features/map/MapPage.ts`（MapPage extends ViewBase）　参数：{ page?: number }（默认当前可玩关所在页）
- 来源：微信图片_20261019173444_81_187、T09-01_未完成拼图续玩　功能：F007、F008、F013、F021、F029、F035、F041、F043、F045、F050、F057
- 动态内容：8 个 LevelNode 固定槽，翻页只刷新数据（关号、金/灰盾、0–3 星、限步标记）；CurrentGlow/CurrentMarker 移到当前关；入口红点；花园总进度与填充；无尽最高分或解锁条件
- 状态节点：LevelNode: ShieldGold（盖在灰盾上）、Star*/Gold（盖在灰星上）、Challenge；Entry: RedDot；Endless: Locked/Best 二选一；PagePrev/PageNext 首末页隐藏
- 动效（延后）：FX-12（翻页过渡）

```
MapPage  [MapPage]
├─ Background  Sprite(微信图片_20261019173444_81_187_完整裸背景)
├─ CurrentGlow  Sprite(当前关卡高亮光晕)  @currentGlow  移到当前关
├─ Levels  
│  ├─ Level1  [LevelNode]  → onTap  @levels[]
│  │  ├─ ShieldGrey  Sprite(灰色关卡盾牌母件)
│  │  ├─ ShieldGold  Sprite(金色关卡盾牌母件)  @shieldGold  已解锁显示金盾，否则露出灰盾
│  │  ├─ Number  Label「1」  @numberLabel
│  │  ├─ Challenge  Label「限步」 key=block.84d00cb6c99a.text.6791f5354445  @challengeMark  默认隐藏
│  │  ├─ Star1  
│  │  │  ├─ Grey  Sprite(灰色星级母件)
│  │  │  └─ Gold  Sprite(金色星级母件)  @starsGold[]  金星盖在灰星上，按星数显示
│  │  ├─ Star2  
│  │  │  ├─ Grey  Sprite(灰色星级母件)
│  │  │  └─ Gold  Sprite(金色星级母件)  @starsGold[]  金星盖在灰星上，按星数显示
│  │  └─ Star3  
│  │     ├─ Grey  Sprite(灰色星级母件)
│  │     └─ Gold  Sprite(金色星级母件)  @starsGold[]  金星盖在灰星上，按星数显示
│  └─ Level2 … Level8  同 Level1 结构（共 8 个）
├─ CurrentMarker  Sprite(当前关卡头像标记)  @currentMarker  移到当前关上方
├─ DecorBee  Sprite(抱蜜罐蜜蜂)
├─ LeftRail  
│  ├─ Entry_signin  [MapEntry]  → onClick(signin)  @entries[]
│  │  ├─ Icon  Sprite(每日签到)
│  │  ├─ Caption  Label「七日礼物」 key=block.84d00cb6c99a.text.3bf5ad45d0c9
│  │  └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
│  ├─ Entry_achievement  [MapEntry]  → onClick(achievement)  @entries[]
│  │  ├─ Icon  Sprite(R-12_入口_成就)
│  │  ├─ Caption  Label「本机成就」 key=block.84d00cb6c99a.text.9625723fe73c
│  │  └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
│  ├─ Entry_tasks  [MapEntry]  → onClick(tasks)  @entries[]
│  │  ├─ Icon  Sprite(每日任务)
│  │  ├─ Caption  Label「每日任务」 key=block.84d00cb6c99a.text.daily
│  │  └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
│  └─ Entry_companions  [MapEntry]  → onClick(companions)  @entries[]
│     ├─ Icon  Sprite(R-12_入口_蜂友)
│     ├─ Caption  Label「蜂友」 key=block.84d00cb6c99a.text.d9447737b55d
│     └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
├─ RightRail  
│  ├─ Entry_supply  [MapEntry]  → onClick(supply)  @entries[]
│  │  ├─ Icon  Sprite(R-11_礼盒_小)
│  │  ├─ Caption  Label「每日补给」 key=block.84d00cb6c99a.text.9af7e2326efe
│  │  └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
│  ├─ Entry_event  [MapEntry]  → onClick(event)  @entries[]
│  │  ├─ Icon  Sprite(R-12_入口_活动)
│  │  ├─ Caption  Label「花园野餐」 key=block.84d00cb6c99a.text.ab71911861b9
│  │  └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
│  ├─ Entry_album  [MapEntry]  → onClick(album)  @entries[]
│  │  ├─ Icon  Sprite(R-12_入口_相册)
│  │  ├─ Caption  Label「旅行相册」 key=block.84d00cb6c99a.text.6ac5ddaa2f0b
│  │  └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
│  └─ Entry_mail  [MapEntry]  → onClick(mail)  @entries[]
│     ├─ Icon  Sprite(R-12_入口_信箱)
│     ├─ Caption  Label「信箱」 key=hg.map.mailbox
│     └─ RedDot  Sprite(每日签到红点)  @redDot  默认隐藏
├─ Paging  
│  ├─ PageNext  Sprite(arrow)  → onPageNext  @pageNext  向上翻（更高关）
│  ├─ PagePrev  Sprite(arrow)  → onPagePrev  @pagePrev  翻转  向下翻（更低关），箭头上下翻转
│  └─ PageRange  Label「第 {first}-{last} 关」 key=hg.map.page_range  @pageRangeLabel
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.hud.player_level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
└─ Bottom  Widget:bottom
   ├─ GardenEntry  → onGarden
   │  ├─ Button  Sprite(建造花园)
   │  ├─ Text  Label「建设花园」 key=block.84d00cb6c99a.text.f8cf7dc2f59a
   │  ├─ Bar  Sprite(花园入口进度底轨)
   │  ├─ Fill  Sprite(花园入口进度填充)  @gardenFill  横向填充
   │  ├─ Gift  Sprite(树屋奖励礼物)
   │  └─ Progress  Label「6 / 25」 key=block.84d00cb6c99a.text.63491346ea01  @gardenProgressLabel
   └─ EndlessEntry  → onEndless
      ├─ Button  Sprite(无尽模式)
      ├─ Text  Label「无尽模式」 key=block.84d00cb6c99a.text.be356d405aec
      ├─ Locked  @endlessLocked
      │  ├─ Lock  Sprite(模式锁)
      │  └─ Condition  Label「第4普通关后解锁」 key=block.84d00cb6c99a.text.e359424f4e40  @endlessConditionLabel
      └─ Best  @endlessBest  默认隐藏
         ├─ Bar  Sprite(我的排名底板)
         └─ Score  Label「最高分 {score}」 key=hg.map.endless_best  @endlessBestLabel
```

### PausePopup

局内暂停（拼图局之上）

- 文件：`assets/bundles/puzzle/prefabs/popups/PausePopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/PausePopup.ts`（PausePopup extends PopupBase）　参数：无
- 来源：T36-01_局内暂停　功能：F013、F046、F047
- 动态内容：无
- 状态节点：重新开始/保存回主界面先打开 ConfirmPopup（T38-01 / T37-01）

```
PausePopup  [PausePopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Dim  Sprite(局内独立遮罩)
└─ Content  @content
   ├─ Panel  Sprite(空白主面板)
   ├─ LeafL  Sprite(标题左花叶)
   ├─ LeafR  Sprite(标题右花叶)
   ├─ Title  
   │  ├─ Board  Sprite(关卡木牌)
   │  └─ Text  Label「暂停」 key=block.ac66e1a5547e.text.065c8903bb20
   ├─ Message  Label「当前摆放与进度已保留」 key=block.ac66e1a5547e.text.c443ef8ffa25
   ├─ BtnResume  → onResume
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「继续玩」 key=block.ac66e1a5547e.text.57dfbfb773aa
   ├─ BtnSettings  → onSettings
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「设置」 key=block.ac66e1a5547e.text.11955f1a10f9
   ├─ BtnRestart  → onRestart
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「重新开始」 key=block.ac66e1a5547e.text.cd2705687070
   └─ BtnExit  → onExit
      ├─ Bg  Sprite(再来一次按钮)
      └─ Text  Label「保存回主界面」 key=block.ac66e1a5547e.text.9457d3d25182
```

### PuzzlePage

拼图局（普通 / 限步共用）

- 文件：`assets/bundles/puzzle/prefabs/pages/PuzzlePage.prefab`
- 脚本：`assets/scripts/game/features/puzzle/PuzzlePage.ts`（PuzzlePage extends ViewBase）　参数：{ level: number, resume?: boolean }
- 来源：T02-01_普通异形拼图_三块、T02-02_普通异形拼图_六块托盘、T03-01_拼图提示轮廓、T05-01_限步异形拼图_局内、T05-02_限步拼图_七块托盘规格　功能：F010、F011、F012、F013、F016、F046
- 动态内容：BoardRoot 内由 BoardView 按题目生成木框（Graphics 一次）与 BoardCell（对象池）；TrayRoot 内按 3/6/7 块布局 PieceCell（对象池）；剩余数、目标进度、提示库存随局刷新
- 状态节点：Remain 标题：普通「剩余拼块」/限步「剩余步数」（props 中两个 key）；HintUsed 使用提示后短暂显示；返回键与 Pause 按钮打开 PausePopup
- 动效（延后）：FX-09、FX-10
- 资源属性：remainKeyPieces="block.5d8513851521.text.55a87ff8eb1b"；remainKeyMoves="block.4cfc10f27941.text.55a87ff8eb1b"

```
PuzzlePage  [PuzzlePage]
├─ Background  Sprite(玩法_完整裸背景)
├─ BoardRoot  Slot [HexBoard]  @board  属性:cellPrefab,piecePrefab  棋盘：木纹底与木边程序绘制一次 + BoardCell/PieceCell 池
│  ├─ Frame  Graphics  @frame
│  ├─ Cells  Slot  @cells
│  └─ Pieces  Slot  @pieces
├─ HintUsed  Label「提示  5 → 4」 key=block.6718e437201f.text.0361de7fdb51  @hintUsedLabel  默认隐藏
├─ Top  Widget:top
│  ├─ Hud  [TopHud]
│  │  ├─ Avatar  → onAvatar
│  │  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  │  ├─ Hints  
│  │  │  ├─ Bar  Sprite(透明计数底条)
│  │  │  ├─ Icon  Sprite(灯泡道具)
│  │  │  ├─ Count  Label「5」  @hintLabel
│  │  │  └─ Caption  Label「提示」 key=block.5d8513851521.text.3a7b9e292b57
│  │  ├─ Honey  
│  │  │  ├─ Bar  Sprite(透明计数底条)
│  │  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  │  └─ Count  Label「360」  @honeyLabel
│  │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
│  ├─ Pause  Sprite(R-13_图标_暂停)  → onPause  设计稿无暂停按钮，用 R-13 补充图标
│  ├─ Sign  
│  │  ├─ Board  Sprite(关卡木牌)
│  │  └─ Title  Label「第 1 关」 key=block.5d8513851521.text.5ce2d4cc8539  @titleLabel
│  └─ Stats  
│     ├─ RopeL  Sprite(金编绳面板连接件)
│     ├─ RopeR  Sprite(金编绳面板连接件)
│     ├─ Remain  
│     │  ├─ Panel  Sprite(步数空底板)
│     │  ├─ Title  Label「剩余拼块」 key=block.5d8513851521.text.55a87ff8eb1b  @remainTitleLabel
│     │  └─ Value  Label「3」  @remainLabel
│     ├─ Target  
│     │  ├─ Panel  Sprite(目标空底板)
│     │  ├─ Icon  Sprite(目标蜂蜜)
│     │  └─ Value  Label「0/18」  @targetLabel
│     └─ HintStock  → onHintAdd
│        ├─ Panel  Sprite(提示空底板)
│        ├─ Icon  Sprite(提示灯泡)
│        ├─ Add  Sprite(提示增加按钮)
│        └─ Value  Label「5」  @hintStockLabel
└─ Bottom  Widget:bottom
   ├─ Tray  Sprite(空待放托盘)
   ├─ TrayRoot  Slot  @trayRoot  托盘：3/6/7 块，PieceCell 池
   ├─ Platform  Sprite(底部木地台)
   ├─ BtnHint  → onHint
   │  ├─ Bg  Sprite(道具空按钮)
   │  ├─ Icon  Sprite(提示灯泡)
   │  └─ Text  Label「提示轮廓」 key=block.5d8513851521.text.ca250a09cdb7
   ├─ BtnUndo  → onUndo  @undoButton
   │  ├─ Bg  Sprite(道具空按钮)
   │  ├─ Icon  Sprite(撤销道具图标)
   │  └─ Text  Label「取回拼块」 key=block.5d8513851521.text.4ec9b563fe1e
   └─ BtnHelp  → onHelp
      ├─ Bg  Sprite(道具空按钮)
      ├─ Icon  Label「?」 key=block.5d8513851521.text.364618ff2948
      └─ Text  Label「图示帮助」 key=block.5d8513851521.text.8681c94f6d9c
```

### PuzzleWinPopup

拼图胜利结算（普通/限步星级）

- 文件：`assets/bundles/puzzle/prefabs/popups/PuzzleWinPopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/PuzzleWinPopup.ts`（PuzzleWinPopup extends PopupBase）　参数：{ level, mode, reward, stars, bestStars, bonusAd }
- 来源：T06-01_普通拼图成功、T07-01_限步星级结算　功能：F014、F015、F056
- 状态节点：Stars/StarLight（限步关显示）、Best（限步关显示历史最佳）、BtnBonusAd（无额度或已领时隐藏）；标题 key 普通「闯关成功」/限步「挑战完成」
- 动效（延后）：FX-01、FX-03、FX-11
- 资源属性：emptyStar=R-05_结算空星；challengeTitleKey="block.5a183ef06031.text.5ce2d4cc8539"

```
PuzzleWinPopup  [PuzzleWinPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(结算_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.6」 key=block.common.level  @levelLabel
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
   ├─ Level  Label「第 5 关」 key=block.30171313d141.text.fbeb832f1681  @levelLabel
   ├─ Reward  
   │  ├─ Card  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(蜂蜜货币)
   │  └─ Amount  Label「+80」  @rewardLabel
   ├─ Best  Label「历史最佳 3星」 key=block.5a183ef06031.text.dd7c87d6fe9c  @bestLabel  默认隐藏
   ├─ Claimed  Label「正常奖励已到账」 key=block.30171313d141.text.e9f9c74a6be3
   ├─ BtnNext  → onNext
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「下一关」 key=block.30171313d141.text.53c74482122c
   ├─ BtnBonusAd  → onBonusAd  @bonusAdButton
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「视频加领 +40」 key=block.30171313d141.text.be73b533883d  @bonusAdLabel
   ├─ CheerBee  Sprite(欢呼蜜蜂)
   └─ Bottom  Widget:bottom
      ├─ BtnBack  Sprite(返回按钮)  → onBack
      └─ BtnHome  Sprite(主页按钮)  → onHome
```

### ResumePopup

未完成拼图续玩卡（地图之上）

- 文件：`assets/bundles/puzzle/prefabs/popups/ResumePopup.prefab`
- 脚本：`assets/scripts/game/features/puzzle/ResumePopup.ts`（ResumePopup extends PopupBase）　参数：{ level: number, placed: number, total: number }
- 来源：T09-01_未完成拼图续玩　功能：F013
- 动态内容：原局布局快照（BoardView 缩略，SnapshotRoot）；已放块数
- 状态节点：重新开始先打开 ConfirmPopup（T38-01）；Backdrop 透明，仅拦截点击

```
ResumePopup  [ResumePopup]
├─ Backdrop  @backdrop  BlockInputEvents
└─ Content  @content
   └─ Card  
      ├─ Panel  Sprite(空白主面板)
      ├─ Board  Sprite(好友标题木牌)
      ├─ Title  Label「第 1 关 · 还没拼完」 key=block.84d00cb6c99a.text.20ccde52e281  @titleLabel
      ├─ SnapshotRoot  Slot  @snapshotRoot  原局棋盘缩略（程序生成）
      ├─ Progress  Label「已放 1 / 3 块」 key=block.84d00cb6c99a.text.204e8ac6cc91  @progressLabel
      ├─ BtnResume  → onResume
      │  ├─ Bg  Sprite(下一关按钮)
      │  └─ Text  Label「继续拼图」 key=block.84d00cb6c99a.text.6830f1a00c3a
      └─ BtnRestart  Label「重新开始」 key=block.84d00cb6c99a.text.765ecbae38eb  → onRestart
```

## garden

### ChapterCompletePopup

整园完工奖励（每园唯一一次）

- 文件：`assets/bundles/garden/prefabs/popups/ChapterCompletePopup.prefab`
- 脚本：`assets/scripts/game/features/garden/ChapterCompletePopup.ts`（ChapterCompletePopup extends PopupBase）　参数：{ chapter, honey, hints, claimed }
- 来源：T16-01_整园完工奖励　功能：F026
- 动态内容：Photo 按园换图（向阳取本页合影，清风水湾/云上蜂谷取 meta/photos/<theme>_group）；ChapterName 参数 {name,value_1,value_2}；奖励数值
- 状态节点：BtnClaim（已领取后隐藏，仅保留回家园）
- 动效（延后）：FX-01、FX-02、FX-03

```
ChapterCompletePopup  [ChapterCompletePopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Title  
   │  ├─ RopeL  Sprite(左悬绳)
   │  ├─ RopeR  Sprite(右悬绳)
   │  ├─ Sign  Sprite(好友标题木牌)
   │  └─ Text  Label「花园建好啦！」 key=block.1267453358ce.text.5ce2d4cc8539
   ├─ Panel  Sprite(空白主面板)
   ├─ ChapterName  Label「向阳花园 · 25/25」 key=hg.garden.chapter_completion  @chapterNameLabel
   ├─ Photo  Sprite(向阳花园本次整园合影)  @photo
   ├─ Rewards  
   │  ├─ HoneyIcon  Sprite(蜂蜜货币)
   │  ├─ Honey  Label「+100」  @honeyLabel
   │  ├─ HintIcon  Sprite(灯泡道具)
   │  └─ Hints  Label「+1」  @hintLabel
   ├─ PhotoNote  Label「整园合影已准备好」 key=block.1267453358ce.text.4d8182bdeb69
   ├─ BtnClaim  → onClaim  @claimButton
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「收下完工礼物」 key=block.1267453358ce.text.5b82de815d4c
   ├─ BtnHome  → onHome
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「回家园」 key=block.1267453358ce.text.ed9dc3a4a562
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### GardenPage

家园：三园共用，5 栋建筑直接升级

- 文件：`assets/bundles/garden/prefabs/pages/GardenPage.prefab`
- 脚本：`assets/scripts/game/features/garden/GardenPage.ts`（GardenPage extends ViewBase）　参数：{ chapter }（当前园 0/1/2，默认取存档）
- 来源：T15-01_家园_五级建设基础、T15-02_家园_单栋满级、T15-03_家园_升级动画关键帧、T15-04_家园_花蜜不足回流、T15-05_家园_第三园全部完成　功能：F023、F024、F025、F026、F028
- 动态内容：Terrain 换 garden/terrain/<theme>；每个 BuildingSlot.body 换 garden/buildings/<theme>/<building>_<lv>（换图后按图片原尺寸显示）；向阳的落位取本页坐标，清风水湾/云上蜂谷由运行时落位配置（PNG/补充/R-01_清风水湾建筑落位.json 及云上蜂谷对应数据，转为 garden 包配置）重设 Body 位置与宽度；WaterRotor 仅水车 1–5 级显示并换 _rotor 图；价格/等级/总进度文字与填充宽度按存档刷新
- 状态节点：BuildingSlot.MaxMark（满级，T15-02/T15-05）、Scaffolds[i]（升级中，与 slots 同序）、UpgradeFx（T15-03 升级反馈，挂到被升级建筑上方）；Summary 文案 key：建设中 hg.garden.summary.building / 花蜜不足 hg.garden.summary.shortage(T15-04) / 全部完成 hg.garden.summary.done(T15-05)；ChapterReward 礼物在 25/25 时可领
- 动效（延后）：FX-05、FX-06、FX-03

```
GardenPage  [GardenPage]
├─ Terrain  Sprite(向阳花园完整无建筑裸地形)  @terrain
├─ Buildings  
│  ├─ Treehouse  [BuildingSlot]  @slots[]
│  │  ├─ Body  Sprite(向阳花园_树屋_2级_原生母件)  → onUpgrade  @body  点建筑本体与点价签执行同一升级命令（F023）
│  │  └─ Tag  @tag  按 layout.json 随建筑移动（authored 位置对应向阳花园）
│  │     ├─ Plate  Sprite(树屋进度容器)
│  │     ├─ Track  Sprite(树屋进度底轨)
│  │     ├─ Fill  Sprite(树屋进度填充)  @fill  横向填充  fillRange = 等级/5
│  │     ├─ Price  Label「树屋 · 60花蜜」 key=hg.garden.price  @priceLabel  参数 {name,count}；满级时 setKey(hg.garden.max, {name})
│  │     ├─ Level  Label「2/5」  @levelLabel
│  │     ├─ BtnUpgrade  Sprite(树屋进入按钮)  → onUpgrade  @upgradeButton
│  │     └─ MaxMark  Sprite(完成勾)  @maxMark  默认隐藏
│  ├─ Garden  [BuildingSlot]  @slots[]
│  │  ├─ Body  Sprite(向阳花园_花园_1级_原生母件)  → onUpgrade  @body  点建筑本体与点价签执行同一升级命令（F023）
│  │  └─ Tag  @tag  按 layout.json 随建筑移动（authored 位置对应向阳花园）
│  │     ├─ Plate  Sprite(花园进度容器)
│  │     ├─ Track  Sprite(花园进度底轨)
│  │     ├─ Fill  Sprite(花园进度填充)  @fill  横向填充  fillRange = 等级/5
│  │     ├─ Price  Label「花园 · 40花蜜」 key=hg.garden.price  @priceLabel  参数 {name,count}；满级时 setKey(hg.garden.max, {name})
│  │     ├─ Level  Label「1/5」  @levelLabel
│  │     ├─ BtnUpgrade  Sprite(花园进入按钮)  → onUpgrade  @upgradeButton
│  │     └─ MaxMark  Sprite(完成勾)  @maxMark  默认隐藏
│  ├─ Workshop  [BuildingSlot]  @slots[]
│  │  ├─ Body  Sprite(向阳花园_蜂蜜工坊_1级_原生母件)  → onUpgrade  @body  点建筑本体与点价签执行同一升级命令（F023）
│  │  └─ Tag  @tag  按 layout.json 随建筑移动（authored 位置对应向阳花园）
│  │     ├─ Plate  Sprite(蜂蜜工坊进度容器)
│  │     ├─ Track  Sprite(蜂蜜工坊进度底轨)
│  │     ├─ Fill  Sprite(蜂蜜工坊进度填充)  @fill  横向填充  fillRange = 等级/5
│  │     ├─ Price  Label「蜂蜜工坊 · 40花蜜」 key=hg.garden.price  @priceLabel  参数 {name,count}；满级时 setKey(hg.garden.max, {name})
│  │     ├─ Level  Label「1/5」  @levelLabel
│  │     ├─ BtnUpgrade  Sprite(蜂蜜工坊进入按钮)  → onUpgrade  @upgradeButton
│  │     └─ MaxMark  Sprite(完成勾)  @maxMark  默认隐藏
│  ├─ Watermill  [BuildingSlot]  @slots[]
│  │  ├─ Body  Sprite(向阳花园_小溪水车_1级_无轮静态本体_原生母件)  → onUpgrade  @body  点建筑本体与点价签执行同一升级命令（F023）
│  │  └─ Tag  @tag  按 layout.json 随建筑移动（authored 位置对应向阳花园）
│  │     ├─ Plate  Sprite(小溪水车进度容器)
│  │     ├─ Track  Sprite(小溪水车进度底轨)
│  │     ├─ Fill  Sprite(小溪水车进度填充)  @fill  横向填充  fillRange = 等级/5
│  │     ├─ Price  Label「小溪水车 · 40花蜜」 key=hg.garden.price  @priceLabel  参数 {name,count}；满级时 setKey(hg.garden.max, {name})
│  │     ├─ Level  Label「1/5」  @levelLabel
│  │     ├─ BtnUpgrade  Sprite(小溪水车进入按钮)  → onUpgrade  @upgradeButton
│  │     └─ MaxMark  Sprite(完成勾)  @maxMark  默认隐藏
│  └─ Greenhouse  [BuildingSlot]  @slots[]
│     ├─ Body  Sprite(向阳花园_温室_1级_原生母件)  → onUpgrade  @body  点建筑本体与点价签执行同一升级命令（F023）
│     └─ Tag  @tag  按 layout.json 随建筑移动（authored 位置对应向阳花园）
│        ├─ Plate  Sprite(温室进度容器)
│        ├─ Track  Sprite(温室进度底轨)
│        ├─ Fill  Sprite(温室进度填充)  @fill  横向填充  fillRange = 等级/5
│        ├─ Price  Label「温室 · 40花蜜」 key=hg.garden.price  @priceLabel  参数 {name,count}；满级时 setKey(hg.garden.max, {name})
│        ├─ Level  Label「1/5」  @levelLabel
│        ├─ BtnUpgrade  Sprite(温室进入按钮)  → onUpgrade  @upgradeButton
│        └─ MaxMark  Sprite(完成勾)  @maxMark  默认隐藏
├─ WaterRotor  Sprite(向阳花园_小溪水车_1级_独立水轮转子_原生母件)  @waterRotor  水车 0 级隐藏
├─ Scaffolds  与 slots 同序；施工期间显示
│  ├─ Treehouse  Sprite(R-22_施工脚手架)  @scaffolds[]  默认隐藏
│  ├─ Garden  Sprite(R-22_施工脚手架)  @scaffolds[]  默认隐藏
│  ├─ Workshop  Sprite(R-22_施工脚手架)  @scaffolds[]  默认隐藏
│  ├─ Watermill  Sprite(R-22_施工脚手架)  @scaffolds[]  默认隐藏
│  └─ Greenhouse  Sprite(R-22_施工脚手架)  @scaffolds[]  默认隐藏
├─ SceneBees  @sceneBees  装饰；向阳专属位置，其他园隐藏
│  ├─ TreehouseBee  Sprite(树屋飞行蜜蜂)
│  ├─ GardenBee  Sprite(花园蜜蜂)
│  ├─ WorkshopBee  Sprite(工坊蜜蜂)
│  ├─ WatermillBee  Sprite(水车蜜蜂)
│  ├─ GreenhouseBee  Sprite(温室蜜蜂与浇水壶)
│  └─ Duck  Sprite(河中白鸭)
├─ UpgradeFx  @upgradeFx  默认隐藏
│  ├─ Glow  Sprite(星光放射)
│  ├─ LevelUp  Label「2/5 ↑」 key=block.dc50bc188175.text.ce9fc925652f  @upgradeLevelLabel
│  └─ Spent  Label「−40」 key=block.dc50bc188175.text.35c074d3d4b0  @spentLabel
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Title  Widget:top
│  ├─ Sign  Sprite(花园标题木牌)
│  ├─ Name  Label「向阳花园」 key=hg.garden.theme.sunny  @themeNameLabel  setKey(hg.garden.theme.<theme>)
│  └─ BtnHelp  → onHelp
│     ├─ Bg  Sprite(帮助)
│     └─ Mark  Label「?」 key=block.accb65126848.text.bf71243e4dc0
├─ SideEntries  Widget:top
│  ├─ BtnAlbum  → onAlbum
│  │  ├─ Icon  Sprite(图鉴图标)
│  │  └─ Text  Label「相册」 key=block.accb65126848.text.6d72861abe46
│  ├─ BtnTasks  → onTasks
│  │  ├─ Icon  Sprite(任务图标)
│  │  └─ Text  Label「任务」 key=block.accb65126848.text.b8e2336942bc
│  └─ BtnWorldMap  → onWorldMap  设计稿无此入口，按相册/任务样式补位
│     ├─ Icon  Sprite(金色关卡盾牌母件)
│     └─ Text  Label「世界地图」 key=block.000a71cd764f.text.5ce2d4cc8539
└─ Bottom  Widget:bottom
   ├─ Panel  Sprite(花园总进度面板)
   ├─ Track  Sprite(花园总进度底轨)
   ├─ Fill  Sprite(花园总进度填充)  @totalFill  横向填充  fillRange = 总等级/25
   ├─ Summary  Label「花园建设进度」 key=hg.garden.summary.building  @summaryLabel
   ├─ Total  Label「6/25」  @totalLabel
   ├─ BtnBack  Sprite(返回)  → onBack
   └─ ChapterReward  Sprite(花园总奖励)  → onChapterReward  @chapterReward
```

### JourneyCompletePopup

当前内容完成：三园全部建成后的回流入口

- 文件：`assets/bundles/garden/prefabs/popups/JourneyCompletePopup.prefab`
- 脚本：`assets/scripts/game/features/garden/JourneyCompletePopup.ts`（JourneyCompletePopup extends PopupBase）　参数：无
- 来源：T18-01_当前内容完成　功能：F028
- 动态内容：无（三园纪念照为静态图）
- 动效（延后）：FX-01

```
JourneyCompletePopup  [JourneyCompletePopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.96」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Title  
   │  ├─ RopeL  Sprite(左悬绳)
   │  ├─ RopeR  Sprite(右悬绳)
   │  ├─ Sign  Sprite(好友标题木牌)
   │  └─ Text  Label「旅程还在继续」 key=block.34c55af7111c.text.5ce2d4cc8539
   ├─ Panel  Sprite(空白主面板)
   ├─ Desc  Label「三座家园，都由你亲手建起」 key=block.34c55af7111c.text.1c61606be643
   ├─ Memories  
   │  ├─ Sunny  
   │  │  ├─ Photo  Sprite(向阳花园完成纪念)
   │  │  └─ Name  Label「向阳花园」 key=block.34c55af7111c.text.7cd6fe1b841f
   │  ├─ Water  
   │  │  ├─ Photo  Sprite(清风水湾完成纪念)
   │  │  └─ Name  Label「清风水湾」 key=block.34c55af7111c.text.9e04718a2b1d
   │  └─ Cloud  
   │     ├─ Photo  Sprite(云上蜂谷完成纪念)
   │     └─ Name  Label「云上蜂谷」 key=block.34c55af7111c.text.ccca320127a3
   ├─ Next  Label「收藏故事，继续刷新自己的纪录」 key=block.34c55af7111c.text.05ae1d6b8dce
   ├─ BtnFeatured  → onFeatured
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「每日精选」 key=block.34c55af7111c.text.9a1b4216f834
   ├─ BtnEndless  → onEndless
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「挑战无尽纪录」 key=block.34c55af7111c.text.c362cb1d6a1d
   ├─ BtnAlbum  → onAlbum
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「旅行相册」 key=block.34c55af7111c.text.26b45d44bfda
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### NextThemePopup

下一主题：前往清风水湾 / 云上蜂谷

- 文件：`assets/bundles/garden/prefabs/popups/NextThemePopup.prefab`
- 脚本：`assets/scripts/game/features/garden/NextThemePopup.ts`（NextThemePopup extends PopupBase）　参数：{ nextChapter }（1=清风水湾，2=云上蜂谷）
- 来源：T17-01_下一主题_清风水湾、T17-02_下一主题_云上蜂谷　功能：F027、F037
- 动态内容：Preview 按下一园换 previewFrames[nextChapter-1]；ThemeName setKey(hg.garden.theme.<theme>)
- 状态节点：无；出发成功（存档 chapter+1）后打开 StoryPopup 章节剧情
- 动效（延后）：FX-12
- 资源属性：previewFrames=清风水湾真实主题预览_ce45805647/云上蜂谷真实主题预览_194f3ef029

```
NextThemePopup  [NextThemePopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Title  
   │  ├─ RopeL  Sprite(左悬绳)
   │  ├─ RopeR  Sprite(右悬绳)
   │  ├─ Sign  Sprite(好友标题木牌)
   │  └─ Text  Label「下一座花园」 key=block.124c9145f76e.text.5ce2d4cc8539
   ├─ Panel  Sprite(空白主面板)
   ├─ ThemeName  Label「清风水湾」 key=hg.garden.theme.water  @themeNameLabel
   ├─ Preview  Sprite(清风水湾真实主题预览)  @preview
   ├─ Desc  Label「新的景色，继续亲手建设」 key=block.124c9145f76e.text.f7547630e883
   ├─ BtnGo  → onGo
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「前往下一园」 key=block.124c9145f76e.text.6a7335d5b62a
   ├─ BtnHome  → onHome
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「先回家园」 key=block.124c9145f76e.text.b69752aad192
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### WorldMapPage

三园世界地图

- 文件：`assets/bundles/garden/prefabs/pages/WorldMapPage.prefab`
- 脚本：`assets/scripts/game/features/garden/WorldMapPage.ts`（WorldMapPage extends ViewBase）　参数：无
- 来源：T27-01_三园世界地图　功能：F027
- 动态内容：每个 WorldMapNode：Progress「x/25」（已开放园）、Shield 金/灰（shieldFrames[0]=金 已开放，[1]=灰 未开放）、Index 章号
- 状态节点：WorldMapNode.BtnHome（当前园显示）、WorldMapNode.Lock 与 Locked 文案（未开放显示）、Progress（已开放显示）
- 动效（延后）：FX-12
- 资源属性：shieldFrames=金色关卡盾牌母件_747dc74440/灰色关卡盾牌母件_bad4bb901e

```
WorldMapPage  [WorldMapPage]
├─ Background  Sprite(R-18_世界地图背景)  R-18（原稿借用关卡选择背景）
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Title  Widget:top
│  ├─ Sign  Sprite(关卡木牌)
│  ├─ Text  Label「世界地图」 key=block.000a71cd764f.text.5ce2d4cc8539
│  └─ Intro  Label「一座花园，一段新故事」 key=block.000a71cd764f.text.fcd05a2f7377
├─ Nodes  
│  ├─ Sunny  [WorldMapNode]  @nodes[]
│  │  ├─ Row  Sprite(好友行底板_1)
│  │  ├─ Thumb  Sprite(向阳花园实景地图缩略图)
│  │  ├─ Name  Label「向阳花园」 key=block.000a71cd764f.text.59729b2597bc
│  │  ├─ Progress  Label「2/25」  @progressLabel
│  │  ├─ Locked  Label「前园完工解锁」 key=block.000a71cd764f.text.756bc93a74e5  @lockedLabel  默认隐藏
│  │  ├─ Shield  Sprite(金色关卡盾牌母件)  @shield
│  │  ├─ Index  Label「1」  @indexLabel
│  │  ├─ BtnHome  → onHome  @homeButton
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「回家园」 key=block.000a71cd764f.text.ed9dc3a4a562
│  │  └─ Lock  @lockGroup  默认隐藏
│  │     ├─ Icon  Sprite(锁定道具图标)
│  │     └─ Text  Label「未解锁」 key=block.000a71cd764f.text.1571bbd05b53
│  ├─ Water  [WorldMapNode]  @nodes[]
│  │  ├─ Row  Sprite(好友行底板_1)
│  │  ├─ Thumb  Sprite(清风水湾实景地图缩略图)
│  │  ├─ Name  Label「清风水湾」 key=block.000a71cd764f.text.a17c8603a1e9
│  │  ├─ Progress  Label「0/25」  @progressLabel  默认隐藏
│  │  ├─ Locked  Label「前园完工解锁」 key=block.000a71cd764f.text.756bc93a74e5  @lockedLabel
│  │  ├─ Shield  Sprite(灰色关卡盾牌母件)  @shield
│  │  ├─ Index  Label「2」  @indexLabel
│  │  ├─ BtnHome  → onHome  @homeButton  默认隐藏
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「回家园」 key=block.000a71cd764f.text.ed9dc3a4a562
│  │  └─ Lock  @lockGroup
│  │     ├─ Icon  Sprite(锁定道具图标)
│  │     └─ Text  Label「未解锁」 key=block.000a71cd764f.text.1571bbd05b53
│  └─ Cloud  [WorldMapNode]  @nodes[]
│     ├─ Row  Sprite(好友行底板_1)
│     ├─ Thumb  Sprite(云上蜂谷实景地图缩略图)
│     ├─ Name  Label「云上蜂谷」 key=block.000a71cd764f.text.689eded5d147
│     ├─ Progress  Label「0/25」  @progressLabel  默认隐藏
│     ├─ Locked  Label「前园完工解锁」 key=block.000a71cd764f.text.77f0bf835447  @lockedLabel
│     ├─ Shield  Sprite(灰色关卡盾牌母件)  @shield
│     ├─ Index  Label「3」  @indexLabel
│     ├─ BtnHome  → onHome  @homeButton  默认隐藏
│     │  ├─ Bg  Sprite(下一关按钮)
│     │  └─ Text  Label「回家园」 key=block.000a71cd764f.text.ed9dc3a4a562
│     └─ Lock  @lockGroup
│        ├─ Icon  Sprite(锁定道具图标)
│        └─ Text  Label「未解锁」 key=block.000a71cd764f.text.3d486bb8051c
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

## endless

### EndlessPage

无尽模式局内：37 格三轴消除

- 文件：`assets/bundles/endless/prefabs/pages/EndlessPage.prefab`
- 脚本：`assets/scripts/game/features/endless/EndlessPage.ts`（EndlessPage extends ViewBase）　参数：{ resume: boolean }
- 来源：T13-01_无尽主动收获确认、无尽模式　功能：F030、F031、F032、F033、F034
- 动态内容：BoardRoot：运行时按 37 格坐标从对象池生成 BoardCell（木框/凹槽按 block_hex_runtime 生成一次）；TraySlots：3 个候选块挂点，块由 PieceCell 池拼成；分数、最高分
- 状态节点：Undo（每局 1 次，用完置灰：UndoCount=0）、Combo 评语 4 张（不错/太棒了/完美/超级连击，按连击档显示一张）；收获确认用 ConfirmPopup（T13-01 遮罩层），无位置用 EndlessRevivePopup
- 动效（延后）：FX-09、FX-10、FX-03

```
EndlessPage  [EndlessPage]
├─ Background  Sprite(无尽模式_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(无尽模式_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  ├─ Count  Label「5」  @hintLabel
│  │  └─ Caption  Label「提示」 key=block.51ad87ae47a3.text.3a7b9e292b57
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Header  Widget:top
│  ├─ Title  
│  │  ├─ Sign  Sprite(无尽模式吊牌)
│  │  └─ Text  Label「无尽模式」 key=block.51ad87ae47a3.text.8f2ae07b8aab
│  ├─ Score  
│  │  ├─ Panel  Sprite(得分空底板)
│  │  ├─ ScoreCaption  Label「当前得分」 key=block.51ad87ae47a3.text.404a10ae22f5
│  │  ├─ Score  Label「1800」  @scoreLabel
│  │  ├─ BestCaption  Label「本机最高」 key=block.51ad87ae47a3.text.58a97b0ee6eb
│  │  └─ Best  Label「2800」  @bestLabel
│  ├─ Bee  Sprite(欢呼蜜蜂)
│  ├─ BtnRecords  → onRecords  本机纪录（成就页），非排行榜
│  │  ├─ Icon  Sprite(排行榜按钮)
│  │  └─ Text  Label「本机纪录」 key=block.51ad87ae47a3.text.3c89dfe659c2
│  └─ BtnSupply  → onSupply  每日补给 F057
│     ├─ Icon  Sprite(每日奖励按钮)
│     └─ Text  Label「每日奖励」 key=block.51ad87ae47a3.text.a3d996c59209
├─ BoardRoot  Slot [HexBoard]  @board  属性:cellPrefab,piecePrefab  37 格棋盘（BoardCell 对象池）
│  ├─ Frame  Graphics  @frame
│  ├─ Cells  Slot  @cells
│  └─ Pieces  Slot  @pieces
├─ Combo  @comboRoot  连击评语与加分飘字，按档位显示一张
│  ├─ Good  Sprite(R-19_评语_不错)  @comboWords[]  默认隐藏
│  ├─ Great  Sprite(R-19_评语_太棒了)  @comboWords[]  默认隐藏
│  ├─ Perfect  Sprite(R-19_评语_完美)  @comboWords[]  默认隐藏
│  ├─ Super  Sprite(R-19_评语_超级连击)  @comboWords[]  默认隐藏
│  └─ Gain  Label「+120」  @gainLabel  默认隐藏
├─ Undo  → onUndo  @undoButton  设计稿无此按钮，按道具按钮样式补位
│  ├─ Bg  Sprite(道具空按钮)
│  ├─ Icon  Sprite(撤销道具图标)
│  └─ Count  Label「1」  @undoCountLabel
├─ BtnPause  → onPause  设计稿无此按钮，补位
│  └─ Icon  Sprite(R-13_图标_暂停)
├─ Tray  Widget:bottom
│  ├─ Board  Sprite(空待放托盘)
│  ├─ Slot1  Slot  @traySlots[]
│  ├─ Slot2  Slot  @traySlots[]
│  └─ Slot3  Slot  @traySlots[]
└─ Bottom  Widget:bottom
   ├─ RuleBar  Sprite(玩法提示条)
   ├─ Rule  Label「任意完整直线填满即可消除」 key=block.51ad87ae47a3.text.bb8467ee62ce
   ├─ BtnHelp  → onHelp
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「玩法帮助」 key=block.51ad87ae47a3.text.2071ebcb6a07
   └─ BtnHarvest  → onHarvest
      ├─ Bg  Sprite(下一关按钮)
      └─ Text  Label「收获花蜜」 key=block.51ad87ae47a3.text.c565f7da56bc
```

### EndlessIntroPopup

无尽入口：开始新局 / 继续未完成的一局

- 文件：`assets/bundles/endless/prefabs/popups/EndlessIntroPopup.prefab`
- 脚本：`assets/scripts/game/features/endless/EndlessIntroPopup.ts`（EndlessIntroPopup extends PopupBase）　参数：{ hasActiveRun, score, best }
- 来源：T11-01_无尽玩法入口　功能：F029
- 动态内容：分数（有保局时为该局分数，否则 0）、最高分
- 状态节点：BtnStart 文案：有保局 key 原稿「继续这一局」，无保局 setKey(hg.endless.start)
- 动效（延后）：FX-12

```
EndlessIntroPopup  [EndlessIntroPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(无尽模式_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(无尽模式_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  ├─ Count  Label「5」  @hintLabel
   │  │  └─ Caption  Label「提示」 key=block.8c3dc731f21b.text.3a7b9e292b57
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Header  Widget:top
   │  ├─ Title  
   │  │  ├─ Sign  Sprite(无尽模式吊牌)
   │  │  └─ Text  Label「无尽模式」 key=block.8c3dc731f21b.text.8f2ae07b8aab
   │  ├─ Score  
   │  │  ├─ Panel  Sprite(得分空底板)
   │  │  ├─ ScoreCaption  Label「当前得分」 key=block.8c3dc731f21b.text.404a10ae22f5
   │  │  ├─ Score  Label「1800」  @scoreLabel
   │  │  ├─ BestCaption  Label「本机最高」 key=block.8c3dc731f21b.text.58a97b0ee6eb
   │  │  └─ Best  Label「2800」  @bestLabel
   │  ├─ Bee  Sprite(欢呼蜜蜂)
   │  ├─ BtnRecords  → onRecords
   │  │  ├─ Icon  Sprite(排行榜按钮)
   │  │  └─ Text  Label「本机纪录」 key=block.8c3dc731f21b.text.3c89dfe659c2
   │  └─ BtnSupply  → onSupply
   │     ├─ Icon  Sprite(每日奖励按钮)
   │     └─ Text  Label「每日奖励」 key=block.8c3dc731f21b.text.a3d996c59209
   └─ Bottom  Widget:bottom
      ├─ RuleBar  Sprite(玩法提示条)
      ├─ Rule  Label「任意完整直线填满即可消除」 key=block.8c3dc731f21b.text.bb8467ee62ce
      └─ BtnStart  → onStart
         ├─ Bg  Sprite(下一关按钮)
         └─ Text  Label「继续这一局」 key=block.8c3dc731f21b.text.ee92c5c44254  @startLabel
```

### EndlessRevivePopup

无尽无位置：收获结束或看视频清出空间续局

- 文件：`assets/bundles/endless/prefabs/popups/EndlessRevivePopup.prefab`
- 脚本：`assets/scripts/game/features/endless/EndlessRevivePopup.ts`（EndlessRevivePopup extends PopupBase）　参数：{ honey, adAvailable }
- 来源：T12-01_无尽无位置续局　功能：F033、F055
- 动态内容：本局可收花蜜
- 状态节点：BtnClearAd（广告额度用完或本局已用过时隐藏）；本弹窗叠在 EndlessPage 上，只取 T12 遮罩以上的层
- 动效（延后）：FX-12

```
EndlessRevivePopup  [EndlessRevivePopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Mask  Sprite(局内独立遮罩)
└─ Content  @content
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ LeafL  Sprite(标题左花叶)
   │  ├─ LeafR  Sprite(标题右花叶)
   │  ├─ Sign  Sprite(关卡木牌)
   │  └─ Text  Label「暂时放不下了」 key=block.22a262e99bc5.text.065c8903bb20
   ├─ Desc  Label「可清出指定空间，继续原局」 key=block.22a262e99bc5.text.c443ef8ffa25
   ├─ Reward  
   │  ├─ Card  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(目标蜂蜜)
   │  ├─ Amount  Label「120」  @honeyLabel
   │  └─ Caption  Label「本局可收花蜜」 key=block.22a262e99bc5.text.8b01bc0e5386
   ├─ BtnHarvest  → onHarvest
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「收获并结束」 key=block.22a262e99bc5.text.e4b2f63c5678
   └─ BtnClearAd  → onClearAd  @clearAdButton
      ├─ Bg  Sprite(再来一次按钮)
      └─ Text  Label「视频 · 清出空间」 key=block.22a262e99bc5.text.51edf76b6590
```

### EndlessResultPopup

无尽成绩结算

- 文件：`assets/bundles/endless/prefabs/popups/EndlessResultPopup.prefab`
- 脚本：`assets/scripts/game/features/endless/EndlessResultPopup.ts`（EndlessResultPopup extends PopupBase）　参数：{ score, best, newRecord, honey, bonusAd }
- 来源：T14-01_无尽成绩结算　功能：F031、F034、F056
- 动态内容：本局分数（千分位）、本机最高 {count}、实际花蜜（受每日上限 240）
- 状态节点：Trophy（刷新纪录时显示）；标题 newRecord 用原稿「刷新纪录」，否则 setKey(hg.endless.result_title)；BtnBonusAd（无额度或已领时隐藏）
- 动效（延后）：FX-01、FX-03

```
EndlessResultPopup  [EndlessResultPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(结算_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「480」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Trophy  Sprite(排行榜)  @trophy
   ├─ Title  
   │  ├─ LeafL  Sprite(标题左花叶)
   │  ├─ LeafR  Sprite(标题右花叶)
   │  ├─ Ribbon  Sprite(闯关成功红飘带)
   │  └─ Text  Label「刷新纪录」 key=block.6fd5045cc24d.text.5ce2d4cc8539  @titleLabel
   ├─ ScoreCaption  Label「本局得分」 key=block.6fd5045cc24d.text.3cab7659e353
   ├─ Score  Label「3,450」  @scoreLabel
   ├─ Best  Label「本机最高 3,450」 key=block.6fd5045cc24d.text.3f68775fb6ca  @bestLabel
   ├─ Reward  
   │  ├─ Card  Sprite(任务空白行_1)
   │  ├─ Icon  Sprite(蜂蜜货币)
   │  ├─ Amount  Label「+120」  @rewardLabel
   │  └─ Claimed  Label「正常奖励已到账」 key=block.6fd5045cc24d.text.e9f9c74a6be3
   ├─ BtnAgain  → onAgain
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「再来一局」 key=block.6fd5045cc24d.text.4c8a25d2eb63
   ├─ BtnBonusAd  → onBonusAd  @bonusAdButton
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「视频加领 +60」 key=block.6fd5045cc24d.text.dd00130371c3  @bonusAdLabel
   ├─ CheerBee  Sprite(欢呼蜜蜂)
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

## meta

### AlbumPage

旅行相册（3 册分页，每册 6 张）

- 文件：`assets/bundles/meta/prefabs/pages/AlbumPage.prefab`
- 脚本：`assets/scripts/game/features/collection/AlbumPage.ts`（AlbumPage extends ViewBase）　参数：{ book? }（默认当前园）
- 来源：T24-01_旅行相册　功能：F039、F040
- 动态内容：页签切换 3 册（选中/未选中底图由 tabOn/tabOff 换图）；6 个 PhotoCell（固定）按册加载照片（bundles/meta/photos/<园>_<建筑>，向阳花园用页面素材照片）
- 状态节点：PhotoCell：已收录（Photo+Done）/ 待记录（Pending）/ 新获得（New）；未解锁的册页签置灰
- 动效（延后）：—
- 资源属性：tabOn=我的好友_选中页签_dc3ecbc337；tabOff=添加好友_未选中页签_69a281099f

```
AlbumPage  [AlbumPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Title  Widget:top
│  ├─ 原好友左悬绳  Sprite(左悬绳)
│  ├─ 原好友右悬绳  Sprite(右悬绳)
│  ├─ 原好友无字标题木牌  Sprite(好友标题木牌)
│  └─ Text  Label「旅行相册」 key=block.f279e3a2a674.text.5ce2d4cc8539
├─ Panel  Sprite(空白主面板)
├─ Tabs  
│  ├─ Frame  Sprite(页签木质背框)
│  ├─ Tab0  → onTab(0)
│  │  ├─ Bg  Sprite(我的好友_选中页签)  @tabBgs[]
│  │  └─ Text  Label「向阳花园」 key=block.f279e3a2a674.text.e9919f74d48e
│  ├─ Tab1  → onTab(1)
│  │  ├─ Bg  Sprite(添加好友_未选中页签)  @tabBgs[]
│  │  └─ Text  Label「清风水湾」 key=block.f279e3a2a674.text.cba4fc9a8dbb
│  └─ Tab2  → onTab(2)
│     ├─ Bg  Sprite(添加好友_未选中页签)  @tabBgs[]
│     └─ Text  Label「云上蜂谷」 key=block.f279e3a2a674.text.010056208a03
├─ BookName  Label「向阳花园 · 已记录的故事」 key=block.f279e3a2a674.text.0271a1048e3a  @bookNameLabel
├─ Photo0  [PhotoCell]  → onSelect  @photos[]
│  ├─ Frame  Sprite(好友行底板_1)
│  ├─ Photo  Sprite(树屋已收录照片)  @photo
│  ├─ Done  Sprite(完成勾)  @doneNode
│  ├─ Pending  @pendingNode  默认隐藏
│  │  ├─ Lock  Sprite(锁定道具图标)
│  │  └─ Text  Label「待记录」 key=block.f279e3a2a674.text.c03fa4c81a34
│  ├─ New  Label「新」 key=hg.collection.photo_new  @newNode  默认隐藏
│  └─ Name  Label「树屋」 key=block.f279e3a2a674.text.14425dc39f5d
├─ Photo1  [PhotoCell]  → onSelect  @photos[]
│  ├─ Frame  Sprite(好友行底板_1)
│  ├─ Photo  Sprite(树屋已收录照片)  @photo
│  ├─ Done  Sprite(完成勾)  @doneNode
│  ├─ Pending  @pendingNode  默认隐藏
│  │  ├─ Lock  Sprite(锁定道具图标)
│  │  └─ Text  Label「待记录」 key=block.f279e3a2a674.text.c03fa4c81a34
│  ├─ New  Label「新」 key=hg.collection.photo_new  @newNode  默认隐藏
│  └─ Name  Label「花园」 key=block.f279e3a2a674.text.71f3d37c254a
├─ Photo2  [PhotoCell]  → onSelect  @photos[]
│  ├─ Frame  Sprite(好友行底板_1)
│  ├─ Photo  Sprite(树屋已收录照片)  @photo  默认隐藏
│  ├─ Done  Sprite(完成勾)  @doneNode  默认隐藏
│  ├─ Pending  @pendingNode
│  │  ├─ Lock  Sprite(锁定道具图标)
│  │  └─ Text  Label「待记录」 key=block.f279e3a2a674.text.c03fa4c81a34
│  ├─ New  Label「新」 key=hg.collection.photo_new  @newNode  默认隐藏
│  └─ Name  Label「蜂蜜工坊」 key=block.f279e3a2a674.text.339fa174e1fe
├─ Photo3  [PhotoCell]  → onSelect  @photos[]
│  ├─ Frame  Sprite(好友行底板_1)
│  ├─ Photo  Sprite(树屋已收录照片)  @photo  默认隐藏
│  ├─ Done  Sprite(完成勾)  @doneNode  默认隐藏
│  ├─ Pending  @pendingNode
│  │  ├─ Lock  Sprite(锁定道具图标)
│  │  └─ Text  Label「待记录」 key=block.f279e3a2a674.text.c03fa4c81a34
│  ├─ New  Label「新」 key=hg.collection.photo_new  @newNode  默认隐藏
│  └─ Name  Label「小溪水车」 key=block.f279e3a2a674.text.523060ec78d8
├─ Photo4  [PhotoCell]  → onSelect  @photos[]
│  ├─ Frame  Sprite(好友行底板_1)
│  ├─ Photo  Sprite(树屋已收录照片)  @photo  默认隐藏
│  ├─ Done  Sprite(完成勾)  @doneNode  默认隐藏
│  ├─ Pending  @pendingNode
│  │  ├─ Lock  Sprite(锁定道具图标)
│  │  └─ Text  Label「待记录」 key=block.f279e3a2a674.text.c03fa4c81a34
│  ├─ New  Label「新」 key=hg.collection.photo_new  @newNode  默认隐藏
│  └─ Name  Label「温室」 key=block.f279e3a2a674.text.4ed5a5fcb02e
├─ Photo5  [PhotoCell]  → onSelect  @photos[]
│  ├─ Frame  Sprite(好友行底板_1)
│  ├─ Photo  Sprite(树屋已收录照片)  @photo  默认隐藏
│  ├─ Done  Sprite(完成勾)  @doneNode  默认隐藏
│  ├─ Pending  @pendingNode
│  │  ├─ Lock  Sprite(锁定道具图标)
│  │  └─ Text  Label「待记录」 key=block.f279e3a2a674.text.c03fa4c81a34
│  ├─ New  Label「新」 key=hg.collection.photo_new  @newNode  默认隐藏
│  └─ Name  Label「全园合影」 key=block.f279e3a2a674.text.e99dd8ab8476
├─ Progress  Label「已收录 2/6」 key=block.f279e3a2a674.text.182b4b27b54d  @progressLabel
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### AlbumRewardPopup

相册集齐奖励（三册共用，换图换文案）

- 文件：`assets/bundles/meta/prefabs/popups/AlbumRewardPopup.prefab`
- 脚本：`assets/scripts/game/features/collection/AlbumRewardPopup.ts`（AlbumRewardPopup extends PopupBase）　参数：{ book }（0/1/2）
- 来源：T26-01_相册集齐_第一册、T26-02_相册集齐_第二册、T26-03_相册集齐_第三册　功能：F040
- 动态内容：整园合影按册取 bookPhotos[book]；标题「第{n}册完成」、相册名、外观奖励（花朵帽/水湾丝带/云朵胸针）按册换 key 与图
- 状态节点：领取后关闭；重复打开只回看不再发奖（幂等键 album:{book}）
- 动效（延后）：FX-02、FX-03
- 资源属性：bookPhotos=真实整园合影_d9ef12d9d8/真实整园合影_6de1ed2f1d/真实整园合影_20dbd52c8c

```
AlbumRewardPopup  [AlbumRewardPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(结算_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ LeafL  Sprite(标题左花叶)
   │  ├─ LeafR  Sprite(标题右花叶)
   │  ├─ Ribbon  Sprite(闯关成功红飘带)
   │  └─ Text  Label「第1册完成」 key=block.1781209bff21.text.5ce2d4cc8539  @titleLabel
   ├─ BookPhoto  Sprite(真实整园合影)  @bookPhoto
   ├─ BookIcon  Sprite(图鉴图标)
   ├─ BookName  Label「向阳花园」 key=block.1781209bff21.text.9723dfb6616f  @bookNameLabel
   ├─ Count  Label「6 / 6 张照片」 key=block.1781209bff21.text.d3975ec78825  @countLabel
   ├─ Rewards  
   │  ├─ Hint  
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Amount  Label「+1」  @hintRewardLabel
   │  └─ Outfit  
   │     ├─ Icon  Sprite(outfit_flower_hat)  @outfitIcon
   │     └─ Name  Label「花朵帽」 key=block.1781209bff21.text.8ccb94cc372a  @outfitNameLabel
   ├─ Once  Label「每册不同装饰 · 只领一次」 key=block.1781209bff21.text.285fb2bd718f
   ├─ BtnClaim  → onClaim
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「收下礼物」 key=block.1781209bff21.text.4fecf8b0da58
   ├─ CheerBee  Sprite(欢呼蜜蜂)
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### CompanionDecorPopup

蜂友专属装饰（亲密 30）

- 文件：`assets/bundles/meta/prefabs/popups/CompanionDecorPopup.prefab`
- 脚本：`assets/scripts/game/features/collection/CompanionDecorPopup.ts`（CompanionDecorPopup extends PopupBase）　参数：{ beeId }
- 来源：T22-01_蜂友专属装饰　功能：F038
- 动态内容：标题/说明按蜂友换 key；未佩戴/已佩戴两张立绘与饰物图按蜂友换图（R-16 专属饰物）
- 状态节点：BtnToggle 文案「取下」/「佩戴」；佩戴状态标签随之切换
- 动效（延后）：—

```
CompanionDecorPopup  [CompanionDecorPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Title  Widget:top
   │  ├─ 左标题吊绳  Sprite(左悬绳)
   │  ├─ 右标题吊绳  Sprite(右悬绳)
   │  ├─ 好友系原生标题木牌  Sprite(好友标题木牌)
   │  └─ Text  Label「花花的纪念饰物」 key=block.3775287dfa71.text.5ce2d4cc8539  @titleLabel
   ├─ Panel  Sprite(空白主面板)
   ├─ Subtitle  Label「亲密30已解锁 · 随蜂友一起出现」 key=block.3775287dfa71.text.13d7ce0196ca  @subtitleLabel
   ├─ Before  
   │  ├─ Portrait  Sprite(角色主体)  @portraitBefore
   │  ├─ Plate  Sprite(好友行底板_1)
   │  └─ State  Label「未佩戴」 key=block.3775287dfa71.text.a5a0f82fe8d6
   ├─ Arrow  Sprite(arrow)
   ├─ After  
   │  ├─ Portrait  Sprite(角色主体)  @portraitAfter
   │  ├─ Decor  Sprite(标题左花叶)  @decor
   │  ├─ Plate  Sprite(好友行底板_1)
   │  └─ State  Label「已佩戴」 key=block.3775287dfa71.text.ae17ae38ad81  @wornLabel
   ├─ Desc  Label「花花的纪念饰物」 key=block.3775287dfa71.text.dd85d2b603aa  @descLabel
   ├─ BtnToggle  → onToggleWear
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「取下」 key=block.3775287dfa71.text.9a94b9239a19  @toggleLabel
   ├─ BtnDetail  → onBack  回蜂友成长 = 关闭
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「回蜂友成长」 key=block.3775287dfa71.text.986ba0a0178b
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### CompanionDetailPage

蜂友成长（亲密度与 5/15/30 里程碑）

- 文件：`assets/bundles/meta/prefabs/pages/CompanionDetailPage.prefab`
- 脚本：`assets/scripts/game/features/collection/CompanionDetailPage.ts`（CompanionDetailPage extends ViewBase）　参数：{ beeId }
- 来源：T21-01_蜂友成长　功能：F036、F037、F038、F035（跟随）
- 动态内容：立绘按蜂友换图；亲密 x/30 与进度条；3 个 AffinityNode（固定）
- 状态节点：AffinityNode.Done / Lock；BtnFollow 文案「正在跟随」/「设为跟随」
- 动效（延后）：—

```
CompanionDetailPage  [CompanionDetailPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Title  Widget:top
│  ├─ 左标题吊绳  Sprite(左悬绳)
│  ├─ 右标题吊绳  Sprite(右悬绳)
│  ├─ 好友系原生标题木牌  Sprite(好友标题木牌)
│  └─ Text  Label「蜂友成长」 key=block.a4903119b5bc.text.5ce2d4cc8539
├─ Panel  Sprite(空白主面板)
├─ Subtitle  Label「每日任务亲密+1 · 每天最多3点」 key=block.a4903119b5bc.text.13d7ce0196ca  @subtitleLabel
├─ Portrait  Sprite(角色主体)  @portrait
├─ Name  Label「花花」 key=block.a4903119b5bc.text.24dff20df46d  @nameLabel
├─ Affinity  
│  ├─ Value  Label「12 / 30」 key=block.a4903119b5bc.text.e8886265b1ae  @affinityLabel
│  ├─ Track  Sprite(赠送进度空槽)
│  └─ Fill  Sprite(赠送进度填充)  @affinityFill  横向填充
├─ Milestone0  [AffinityNode]  → onSelect  @milestones[]  亲密5 招手
│  ├─ Card  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(style_hand)
│  ├─ Name  Label「招手」 key=block.a4903119b5bc.text.e86782f815d2
│  ├─ Done  Sprite(完成勾)  @doneNode
│  ├─ Lock  Sprite(模式锁)  @lockNode  默认隐藏
│  └─ Condition  Label「已解锁」 key=block.a4903119b5bc.text.e588bf415649  @conditionLabel
├─ Milestone1  [AffinityNode]  → onSelect  @milestones[]  亲密15 故事 → StoryPopup
│  ├─ Card  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(图鉴图标)
│  ├─ Name  Label「故事」 key=block.a4903119b5bc.text.4a69fb3f74a4
│  ├─ Done  Sprite(完成勾)  @doneNode  默认隐藏
│  ├─ Lock  Sprite(模式锁)  @lockNode
│  └─ Condition  Label「亲密 15」 key=block.a4903119b5bc.text.f4c975738b3e  @conditionLabel
├─ Milestone2  [AffinityNode]  → onSelect  @milestones[]  亲密30 装饰 → CompanionDecorPopup
│  ├─ Card  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(树屋奖励礼物)
│  ├─ Name  Label「装饰」 key=block.a4903119b5bc.text.e23ddd22495a
│  ├─ Done  Sprite(完成勾)  @doneNode  默认隐藏
│  ├─ Lock  Sprite(模式锁)  @lockNode
│  └─ Condition  Label「亲密 30」 key=block.a4903119b5bc.text.82302f435a82  @conditionLabel
├─ BtnFollow  → onFollow
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「正在跟随」 key=block.a4903119b5bc.text.ef1bd1183f44  @followLabel
├─ BtnTasks  → onTasks
│  ├─ Bg  Sprite(再来一次按钮)
│  └─ Text  Label「去做任务」 key=block.a4903119b5bc.text.05789fd54d45
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### CompanionListPage

三位蜂友列表（家园伙伴）

- 文件：`assets/bundles/meta/prefabs/pages/CompanionListPage.prefab`
- 脚本：`assets/scripts/game/features/collection/CompanionListPage.ts`（CompanionListPage extends ViewBase）　参数：无
- 来源：T20-01_三位蜂友列表　功能：F035、F036
- 动态内容：3 张 CompanionCard（固定数量，非滚动列表）：头像、名字、身份、亲密 x/30、成长按钮；未认识时显示锁与条件；总亲密进度条宽度按 total/90
- 状态节点：Card.Unlocked / Card.Locked（未开放蜂友）、Card.Following（当前跟随）；小蜜外观挂件 XiaomiOutfit 随衣柜更换
- 动效（延后）：—

```
CompanionListPage  [CompanionListPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Title  Widget:top
│  ├─ 左标题吊绳  Sprite(左悬绳)
│  ├─ 右标题吊绳  Sprite(右悬绳)
│  ├─ 好友系原生标题木牌  Sprite(好友标题木牌)
│  └─ Text  Label「家园伙伴」 key=block.978ff2056577.text.5ce2d4cc8539
├─ Panel  Sprite(空白主面板)
├─ Subtitle  Label「伙伴成长 16/90」 key=block.978ff2056577.text.13d7ce0196ca  @subtitleLabel
├─ Card0  [CompanionCard]  @cards[]
│  ├─ Row  Sprite(好友行底板_1)
│  ├─ Portrait  Sprite(bee_xiaomi)  @portrait
│  ├─ Name  Label「小蜜」 key=block.978ff2056577.text.4d23c369b947  @nameLabel
│  ├─ Role  Label「一路同行」 key=block.978ff2056577.text.8876e7e4f7b9  @roleLabel
│  ├─ Unlocked  @unlockedNode
│  │  ├─ Affinity  Label「4/30」  @affinityLabel
│  │  ├─ BtnGrow  → onSelect
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「成长」 key=block.978ff2056577.text.63da7eba4753
│  │  └─ Following  Label「跟随中」 key=hg.collection.following  @followingTag  默认隐藏
│  └─ Locked  @lockedNode  默认隐藏
│     ├─ Lock  Sprite(模式锁)
│     └─ Condition  Label「第2园完工后认识」 key=block.978ff2056577.text.c625aa38c534  @conditionLabel
├─ Card1  [CompanionCard]  @cards[]
│  ├─ Row  Sprite(好友行底板_1)
│  ├─ Portrait  Sprite(角色主体)  @portrait
│  ├─ Name  Label「花花」 key=block.978ff2056577.text.bb6e58786a3d  @nameLabel
│  ├─ Role  Label「照料花园」 key=block.978ff2056577.text.79ede51289b5  @roleLabel
│  ├─ Unlocked  @unlockedNode
│  │  ├─ Affinity  Label「4/30」  @affinityLabel
│  │  ├─ BtnGrow  → onSelect
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「成长」 key=block.978ff2056577.text.63da7eba4753
│  │  └─ Following  Label「跟随中」 key=hg.collection.following  @followingTag  默认隐藏
│  └─ Locked  @lockedNode  默认隐藏
│     ├─ Lock  Sprite(模式锁)
│     └─ Condition  Label「第2园完工后认识」 key=block.978ff2056577.text.c625aa38c534  @conditionLabel
├─ Card2  [CompanionCard]  @cards[]
│  ├─ Row  Sprite(好友行底板_1)
│  ├─ Portrait  Sprite(bee_agong)  @portrait
│  ├─ Name  Label「阿工」 key=block.978ff2056577.text.b07a82568bea  @nameLabel
│  ├─ Role  Label「建造能手」 key=block.978ff2056577.text.610e9b9fdf2d  @roleLabel
│  ├─ Unlocked  @unlockedNode  默认隐藏
│  │  ├─ Affinity  Label「4/30」  @affinityLabel
│  │  ├─ BtnGrow  → onSelect
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「成长」 key=block.978ff2056577.text.63da7eba4753
│  │  └─ Following  Label「跟随中」 key=hg.collection.following  @followingTag  默认隐藏
│  └─ Locked  @lockedNode
│     ├─ Lock  Sprite(模式锁)
│     └─ Condition  Label「第2园完工后认识」 key=block.978ff2056577.text.c625aa38c534  @conditionLabel
├─ XiaomiOutfit  Sprite(bee_xiaomi_独立晴天围巾)  @xiaomiOutfit  小蜜当前外观
├─ Total  
│  ├─ Label  Label「伙伴成长 16 / 90」 key=block.978ff2056577.text.7b676d4342f2  @totalLabel
│  ├─ Track  Sprite(赠送进度空槽)
│  └─ Fill  Sprite(赠送进度填充)  @totalFill  横向填充
├─ BtnGrowth  → onGrowth
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「伙伴成长」 key=block.978ff2056577.text.d685e572f6b3
├─ BtnAlbum  → onAlbum
│  ├─ Bg  Sprite(再来一次按钮)
│  └─ Text  Label「旅行相册」 key=block.978ff2056577.text.26b45d44bfda
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### PhotoDetailPopup

照片详情

- 文件：`assets/bundles/meta/prefabs/popups/PhotoDetailPopup.prefab`
- 脚本：`assets/scripts/game/features/collection/PhotoDetailPopup.ts`（PhotoDetailPopup extends PopupBase）　参数：{ book, photoId }
- 来源：T25-01_照片详情　功能：F039
- 动态内容：照片图按 photoId 加载；建筑名、所属相册、获得来源为模板参数
- 动效（延后）：—

```
PhotoDetailPopup  [PhotoDetailPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Title  Widget:top
   │  ├─ 原好友左悬绳  Sprite(左悬绳)
   │  ├─ 原好友右悬绳  Sprite(右悬绳)
   │  ├─ 原好友无字标题木牌  Sprite(好友标题木牌)
   │  └─ Text  Label「照片详情」 key=block.c646c5e7d780.text.5ce2d4cc8539
   ├─ Panel  Sprite(空白主面板)
   ├─ BookIcon  Sprite(图鉴图标)
   ├─ Name  Label「树屋」 key=block.c646c5e7d780.text.fb6c414cc851  @nameLabel
   ├─ Book  Label「向阳花园」 key=block.c646c5e7d780.text.e3055c74aa36  @bookLabel
   ├─ Photo  
   │  ├─ Frame  Sprite(好友行底板_1)
   │  └─ Image  Sprite(树屋原生场景纪念照片)  @photo
   ├─ Note  Label「这一刻，已经好好收藏。」 key=block.c646c5e7d780.text.d9b0f87902bf
   ├─ Source  Label「来源：亲手建起树屋」 key=block.c646c5e7d780.text.ab4afe5ba146  @sourceLabel
   ├─ BtnAlbum  → onBack  回相册 = 关闭
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「回相册」 key=block.c646c5e7d780.text.2f6432a1fa5f
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### StoryPopup

章节剧情 / 蜂友故事（三步，可回看）

- 文件：`assets/bundles/meta/prefabs/popups/StoryPopup.prefab`
- 脚本：`assets/scripts/game/features/collection/StoryPopup.ts`（StoryPopup extends PopupBase）　参数：{ storyId }（story.json 中的 chapter.* 或 bee.*）
- 来源：T19-01_蜂友章节剧情与回看　功能：F037
- 动态内容：主图（章节 R-17 剧情图 / 蜂友立绘）、标题、副标题、三步文字全部来自 bundles/meta/config/story.json + 语言表 story.*；三步配图 StepIcon 可在 story.json 中按步配置
- 状态节点：章节剧情：主按钮「继续」(onContinue) 回新园，返回=稍后；蜂友故事：主按钮「回蜂友成长」。主按钮文案 key 由脚本切换
- 动效（延后）：—

```
StoryPopup  [StoryPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Title  Widget:top
   │  ├─ 左标题吊绳  Sprite(左悬绳)
   │  ├─ 右标题吊绳  Sprite(右悬绳)
   │  ├─ 好友系原生标题木牌  Sprite(好友标题木牌)
   │  └─ Text  Label「花花的小花园」 key=block.d13ddbe877d3.text.5ce2d4cc8539  @titleLabel
   ├─ Panel  Sprite(空白主面板)
   ├─ Subtitle  Label「亲密15解锁 · 随时重看」 key=block.d13ddbe877d3.text.13d7ce0196ca  @subtitleLabel
   ├─ Image  Sprite(角色主体)  @image
   ├─ Step0  
   │  ├─ Frame  Sprite(奖励格_1_1)
   │  ├─ Icon  Sprite(向阳花园_花园_0级_原生母件)  @stepIcons[]
   │  └─ Text  Label「种下花籽」 key=block.d13ddbe877d3.text.e897b55fddfe  @stepLabels[]
   ├─ Step1  
   │  ├─ Frame  Sprite(奖励格_1_1)
   │  ├─ Icon  Sprite(温室蜜蜂与浇水壶)  @stepIcons[]
   │  └─ Text  Label「细心照料」 key=block.d13ddbe877d3.text.b5a46e6b5179  @stepLabels[]
   ├─ Step2  
   │  ├─ Frame  Sprite(奖励格_1_1)
   │  ├─ Icon  Sprite(标题左花叶)  @stepIcons[]
   │  └─ Text  Label「满园花开」 key=block.d13ddbe877d3.text.2640d052f2f6  @stepLabels[]
   ├─ Note  Label「随时重看，不重复领奖」 key=block.d13ddbe877d3.text.c1395fdf6e9b
   ├─ BtnContinue  → onContinue
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「回蜂友成长」 key=block.d13ddbe877d3.text.986ba0a0178b  @continueLabel
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### WardrobePage

外观衣柜（小蜜 5 件外观）

- 文件：`assets/bundles/meta/prefabs/pages/WardrobePage.prefab`
- 脚本：`assets/scripts/game/features/collection/WardrobePage.ts`（WardrobePage extends ViewBase）　参数：无
- 来源：T23-01_外观衣柜　功能：F038
- 动态内容：5 个 OutfitCell（固定）；预览小蜜佩戴所选外观（R-24 组合图或挂件图）；当前装备格图标
- 状态节点：OutfitCell.Using / Lock，状态文字「正在使用 / 已拥有 / 未拥有+来源」；BtnUse 文案「正在使用」/「换上」
- 动效（延后）：—

```
WardrobePage  [WardrobePage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Title  Widget:top
│  ├─ 左标题吊绳  Sprite(左悬绳)
│  ├─ 右标题吊绳  Sprite(右悬绳)
│  ├─ 好友系原生标题木牌  Sprite(好友标题木牌)
│  └─ Text  Label「外观衣柜」 key=block.81aac8ddce5a.text.5ce2d4cc8539
├─ Panel  Sprite(空白主面板)
├─ Subtitle  Label「换个好心情」 key=block.81aac8ddce5a.text.13d7ce0196ca
├─ Preview  
│  ├─ Bee  Sprite(bee_xiaomi)  @previewBee
│  └─ Outfit  Sprite(bee_xiaomi_独立晴天围巾)  @previewOutfit
├─ Current  
│  ├─ Frame  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(bee_xiaomi_独立晴天围巾)  @currentIcon
│  └─ Text  Label「正在使用」 key=block.81aac8ddce5a.text.96dab22a52cd
├─ Outfit0  [OutfitCell]  → onSelect  @outfits[]
│  ├─ Frame  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(bee_xiaomi_独立晴天围巾)
│  ├─ Name  Label「晴天围巾」 key=block.81aac8ddce5a.text.f9b2556cb876
│  ├─ Using  Sprite(完成勾)  @usingNode
│  ├─ Lock  Sprite(模式锁)  @lockNode  默认隐藏
│  └─ Status  Label「正在使用」 key=block.81aac8ddce5a.text.5f87dbef88f4  @statusLabel
├─ Outfit1  [OutfitCell]  → onSelect  @outfits[]
│  ├─ Frame  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(outfit_picnic_hat)
│  ├─ Name  Label「野餐帽」 key=block.81aac8ddce5a.text.ac1971380e4d
│  ├─ Using  Sprite(完成勾)  @usingNode  默认隐藏
│  ├─ Lock  Sprite(模式锁)  @lockNode
│  └─ Status  Label「未拥有签到第7天」 key=block.81aac8ddce5a.text.7a3037b885bb  @statusLabel
├─ Outfit2  [OutfitCell]  → onSelect  @outfits[]
│  ├─ Frame  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(outfit_flower_hat)
│  ├─ Name  Label「花朵帽」 key=block.81aac8ddce5a.text.8406b693252b
│  ├─ Using  Sprite(完成勾)  @usingNode  默认隐藏
│  ├─ Lock  Sprite(模式锁)  @lockNode
│  └─ Status  Label「未拥有第1册相册」 key=block.81aac8ddce5a.text.4093cb96b2b8  @statusLabel
├─ Outfit3  [OutfitCell]  → onSelect  @outfits[]
│  ├─ Frame  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(outfit_water_ribbon)
│  ├─ Name  Label「水湾丝带」 key=block.81aac8ddce5a.text.e5a9d37b1bfb
│  ├─ Using  Sprite(完成勾)  @usingNode  默认隐藏
│  ├─ Lock  Sprite(模式锁)  @lockNode
│  └─ Status  Label「未拥有第2册相册」 key=block.81aac8ddce5a.text.76057c0bf123  @statusLabel
├─ Outfit4  [OutfitCell]  → onSelect  @outfits[]
│  ├─ Frame  Sprite(奖励格_1_1)
│  ├─ Icon  Sprite(outfit_cloud_brooch)
│  ├─ Name  Label「云朵胸针」 key=block.81aac8ddce5a.text.e5d9acaa2940
│  ├─ Using  Sprite(完成勾)  @usingNode  默认隐藏
│  ├─ Lock  Sprite(模式锁)  @lockNode
│  └─ Status  Label「未拥有第3册相册」 key=block.81aac8ddce5a.text.0b46941aeaa8  @statusLabel
├─ BtnUse  → onUse
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「正在使用」 key=block.81aac8ddce5a.text.ad5ffd26cb5c  @useLabel
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### WeeklyStampPopup

每周纪念印记回看

- 文件：`assets/bundles/meta/prefabs/popups/WeeklyStampPopup.prefab`
- 脚本：`assets/scripts/game/features/collection/WeeklyStampPopup.ts`（WeeklyStampPopup extends PopupBase）　参数：{ weekKey }
- 来源：T28-01_每周纪念回看　功能：F042
- 动态内容：纪念日期（weekKey，数值文字）、达成条件（局数/活跃天数模板参数）
- 动效（延后）：FX-02

```
WeeklyStampPopup  [WeeklyStampPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(结算_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ LeafL  Sprite(标题左花叶)
   │  ├─ LeafR  Sprite(标题右花叶)
   │  ├─ Ribbon  Sprite(闯关成功红飘带)
   │  └─ Text  Label「每周纪念」 key=block.5f41a9986f14.text.5ce2d4cc8539
   ├─ Stamp  Sprite(stamp)
   ├─ Name  Label「本周纪念」 key=block.5f41a9986f14.text.45fb60b074fd
   ├─ Date  Label「2026-10-19」  @dateLabel
   ├─ Condition  Label「15局 · 活跃4天」 key=block.5f41a9986f14.text.62db4711b79c  @conditionLabel
   ├─ Owned  Label「已收藏 · 可随时回看」 key=block.5f41a9986f14.text.a3b8cf736df2
   ├─ BtnTasks  → onBack  回每日任务 = 关闭
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「回每日任务」 key=block.5f41a9986f14.text.19af0c9e494c
   ├─ CheerBee  Sprite(欢呼蜜蜂)
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### AchievementPage

成就与本机纪录

- 文件：`assets/bundles/meta/prefabs/pages/AchievementPage.prefab`
- 脚本：`assets/scripts/game/features/daily/AchievementPage.ts`（AchievementPage extends ViewBase）　参数：无
- 来源：T31-01_成就与本机纪录　功能：F044
- 动态内容：3 行 AchievementRow：徽章（R-10 达成/未达成）、名称、进度、按钮文案；本机纪录行（无尽最高分、已通关数）
- 状态节点：徽章 badgeFrames[行×2：未达成, 达成]；BtnAction 可收藏/去挑战/已收藏（按钮文案 key 切换）
- 动效（延后）：FX-02（收藏徽章光效）
- 资源属性：badgeFrames=R-10_成就_拼图达人_未达成/R-10_成就_拼图达人_达成/R-10_成就_无尽高手_未达成/R-10_成就_无尽高手_达成/R-10_成就_花园旅人_未达成/R-10_成就_花园旅人_达成

```
AchievementPage  [AchievementPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ RopeL  Sprite(左悬绳)
│  ├─ RopeR  Sprite(右悬绳)
│  ├─ Board  Sprite(好友标题木牌)
│  └─ Text  Label「成就与本机纪录」 key=block.52ea23b04b5c.text.5ce2d4cc8539
├─ Subtitle  Label「每一步，都闪闪发光」 key=block.52ea23b04b5c.text.13d7ce0196ca
├─ Rows  
│  ├─ Achievement1  [AchievementRow]  @rows[]
│  │  ├─ Bg  Sprite(好友行底板_1)
│  │  ├─ Badge  Sprite(R-10_成就_拼图达人_未达成)  @badge
│  │  ├─ Name  Label「拼图好手」 key=block.52ea23b04b5c.text.d99405d07077  @nameLabel
│  │  ├─ Progress  Label「10/10」  @progressLabel
│  │  └─ BtnAction  → onAction  @actionButton
│  │     ├─ Bg  Sprite(下一关按钮)
│  │     └─ Text  Label「收藏徽章」 key=block.52ea23b04b5c.text.e2bd277de25a  @actionLabel  收藏徽章 / 去挑战 / 已收藏
│  ├─ Achievement2  [AchievementRow]  @rows[]
│  │  ├─ Bg  Sprite(好友行底板_1)
│  │  ├─ Badge  Sprite(R-10_成就_无尽高手_未达成)  @badge
│  │  ├─ Name  Label「消除达人」 key=block.52ea23b04b5c.text.b470babd0808  @nameLabel
│  │  ├─ Progress  Label「2,800/5,000」  @progressLabel
│  │  └─ BtnAction  → onAction  @actionButton
│  │     ├─ Bg  Sprite(再来一次按钮)
│  │     └─ Text  Label「去挑战」 key=block.52ea23b04b5c.text.f6ac8e1767a4  @actionLabel  收藏徽章 / 去挑战 / 已收藏
│  └─ Achievement3  [AchievementRow]  @rows[]
│     ├─ Bg  Sprite(好友行底板_1)
│     ├─ Badge  Sprite(R-10_成就_花园旅人_未达成)  @badge
│     ├─ Name  Label「家园伙伴」 key=block.52ea23b04b5c.text.5e5ab519a2c1  @nameLabel
│     ├─ Progress  Label「0/1」  @progressLabel
│     └─ BtnAction  → onAction  @actionButton
│        ├─ Bg  Sprite(再来一次按钮)
│        └─ Text  Label「去挑战」 key=block.52ea23b04b5c.text.f6ac8e1767a4  @actionLabel  收藏徽章 / 去挑战 / 已收藏
├─ Records  Label「无尽最高 {score} 分 · 已通关 {levels} 关」 key=hg.daily.local_records  @recordsLabel  参数{score,levels}
├─ BtnHome  → onHome
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「回主界面」 key=block.52ea23b04b5c.text.26d11c931dfd
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### EventDetailPage

花园野餐进度

- 文件：`assets/bundles/meta/prefabs/pages/EventDetailPage.prefab`
- 脚本：`assets/scripts/game/features/daily/EventDetailPage.ts`（EventDetailPage extends ViewBase）　参数：无
- 来源：T34-01_花园野餐进度　功能：F045
- 动态内容：活动进度文字参数、进度条填充、4 个 MilestoneNode（数值、完成勾）
- 状态节点：MilestoneNode.check：已达成显示；满 20 点且未领时自动打开 EventRewardPopup

```
EventDetailPage  [EventDetailPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ RopeL  Sprite(左悬绳)
│  ├─ RopeR  Sprite(右悬绳)
│  ├─ Board  Sprite(好友标题木牌)
│  └─ Text  Label「花园野餐」 key=block.23ff10b6a57e.text.5ce2d4cc8539
├─ Subtitle  Label「正常游玩，准备一场相聚」 key=block.23ff10b6a57e.text.13d7ce0196ca
├─ Picnic  Sprite(picnic)
├─ Bee  Sprite(角色主体)
├─ ProgressTitle  Label「野餐准备」 key=block.23ff10b6a57e.text.0150270a4d1b
├─ Progress  Label「8 / 20」 key=block.23ff10b6a57e.text.0997444d772d  @progressLabel
├─ Bar  
│  ├─ Track  Sprite(赠送进度空槽)
│  └─ Fill  Sprite(赠送进度填充)  @progressFill  横向填充
├─ Milestones  
│  ├─ Milestone1  [MilestoneNode]  @milestones[]
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Value  Label「5」  @valueLabel
│  │  └─ Check  Sprite(完成勾)  @check
│  ├─ Milestone2  [MilestoneNode]  @milestones[]
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Value  Label「10」  @valueLabel
│  │  └─ Check  Sprite(完成勾)  @check  默认隐藏
│  └─ Milestone3 … Milestone4  同 Milestone2 结构（共 3 个）
├─ Rule  Label「普通成功或无尽有效结算，每次 +1 点」 key=block.23ff10b6a57e.text.c7b8d7dd7916  @ruleLabel
├─ RewardNote  Label「20点奖励100花蜜 · 只领一次」 key=block.23ff10b6a57e.text.6af5ee9fe879  @rewardNoteLabel
├─ BtnPlay  → onPlay
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「继续闯关」 key=block.23ff10b6a57e.text.ce23e10699f1
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### EventPage

主题活动总览（花园野餐）

- 文件：`assets/bundles/meta/prefabs/pages/EventPage.prefab`
- 脚本：`assets/scripts/game/features/daily/EventPage.ts`（EventPage extends ViewBase）　参数：无
- 来源：T33-01_主题活动总览　功能：F045
- 动态内容：活动进度文字参数、进度条填充、4 个 MilestoneNode（数值、完成勾）
- 状态节点：MilestoneNode.check：已达成显示

```
EventPage  [EventPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ RopeL  Sprite(左悬绳)
│  ├─ RopeR  Sprite(右悬绳)
│  ├─ Board  Sprite(好友标题木牌)
│  └─ Text  Label「主题挑战」 key=block.536db988ffcf.text.5ce2d4cc8539
├─ Subtitle  Label「花园野餐」 key=block.536db988ffcf.text.13d7ce0196ca
├─ Picnic  Sprite(picnic)
├─ Bee  Sprite(角色主体)
├─ ProgressTitle  Label「野餐准备」 key=block.536db988ffcf.text.0150270a4d1b
├─ Progress  Label「8 / 20」 key=block.536db988ffcf.text.0997444d772d  @progressLabel
├─ Bar  
│  ├─ Track  Sprite(赠送进度空槽)
│  └─ Fill  Sprite(赠送进度填充)  @progressFill  横向填充
├─ Milestones  
│  ├─ Milestone1  [MilestoneNode]  @milestones[]
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Value  Label「5」  @valueLabel
│  │  └─ Check  Sprite(完成勾)  @check
│  ├─ Milestone2  [MilestoneNode]  @milestones[]
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Value  Label「10」  @valueLabel
│  │  └─ Check  Sprite(完成勾)  @check  默认隐藏
│  └─ Milestone3 … Milestone4  同 Milestone2 结构（共 3 个）
├─ RewardNote  Label「20点奖励100花蜜 · 只领一次」 key=block.536db988ffcf.text.6af5ee9fe879  @rewardNoteLabel
├─ BtnDetail  → onDetail
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「去看看」 key=block.536db988ffcf.text.320607c55328
└─ Bottom  Widget:bottom
   └─ BtnBack  Sprite(返回按钮)  → onBack
```

### EventRewardPopup

花园野餐活动奖励

- 文件：`assets/bundles/meta/prefabs/popups/EventRewardPopup.prefab`
- 脚本：`assets/scripts/game/features/daily/EventRewardPopup.ts`（EventRewardPopup extends PopupBase）　参数：{ honey }
- 来源：T35-01_活动奖励　功能：F045
- 动态内容：奖励花蜜数
- 动效（延后）：FX-02（奖励光效）、FX-03

```
EventRewardPopup  [EventRewardPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(结算_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ LeafL  Sprite(标题左花叶)
   │  ├─ LeafR  Sprite(标题右花叶)
   │  ├─ Ribbon  Sprite(闯关成功红飘带)
   │  └─ Text  Label「野餐准备好啦」 key=block.ce4597983b50.text.5ce2d4cc8539
   ├─ Picnic  Sprite(picnic)
   ├─ Reward  
   │  ├─ Card  Sprite(奖励空白底板)
   │  ├─ Icon  Sprite(蜂蜜货币)
   │  └─ Amount  Label「+100」  @rewardLabel
   ├─ Note  Label「达成20点后领取，仅领一次」 key=block.ce4597983b50.text.41347196be37  @noteLabel
   ├─ BtnClaim  → onClaim
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「收下野餐礼」 key=block.ce4597983b50.text.45a1d01626d3
   └─ Bottom  Widget:bottom
      ├─ BtnBack  Sprite(返回按钮)  → onBack
      └─ CheerBee  Sprite(欢呼蜜蜂)
```

### MailDetailPopup

信件详情

- 文件：`assets/bundles/meta/prefabs/popups/MailDetailPopup.prefab`
- 脚本：`assets/scripts/game/features/daily/MailDetailPopup.ts`（MailDetailPopup extends PopupBase）　参数：{ mailId }
- 来源：T49-01_信件详情　功能：F050
- 动态内容：标题、两段正文、署名按信件配置的 key 设置（LocalizedLabel.setKey）
- 状态节点：无附件；点「我知道啦」记已读并关闭

```
MailDetailPopup  [MailDetailPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(好友界面_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ RopeL  Sprite(左悬绳)
   │  ├─ RopeR  Sprite(右悬绳)
   │  ├─ Board  Sprite(好友标题木牌)
   │  └─ Text  Label「你好，家园伙伴」 key=block.320eb5537d2f.text.5ce2d4cc8539  @titleLabel
   ├─ Stationery  Sprite(图鉴图标)
   ├─ Body1  Label「你的闯关、花蜜与建设进度，都会保存在本机。」 key=block.320eb5537d2f.text.afe30f6ed6e7  @body1Label
   ├─ Body2  Label「在这里，可以慢慢拼图、试试无尽消除，也可以直接点击建筑，建起自己的花园。这封信没有道具附件。」 key=block.320eb5537d2f.text.4fe715d04b85  @body2Label
   ├─ Signature  Label「小蜜」 key=block.320eb5537d2f.text.5bdb7e3aacfe  @signatureLabel
   ├─ BtnOk  → onOk
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「我知道啦」 key=block.320eb5537d2f.text.bac1b3a0bb9f
   └─ Bottom  Widget:bottom
      ├─ BtnBack  Sprite(返回按钮)  → onBack
      ├─ Bee  Sprite(bee_xiaomi)
      └─ Scarf  Sprite(bee_xiaomi_独立晴天围巾)
```

### MailboxPage

小蜜的信箱（本地信件）

- 文件：`assets/bundles/meta/prefabs/pages/MailboxPage.prefab`
- 脚本：`assets/scripts/game/features/daily/MailboxPage.ts`（MailboxPage extends ViewBase）　参数：无
- 来源：T48-01_本地信箱　功能：F050
- 动态内容：Mails：信件列表（MailRow，数量随本地信件变化，ScrollableItemGrid）
- 状态节点：Empty：无信件时显示大信封插画与说明

```
MailboxPage  [MailboxPage]
├─ Background  Sprite(好友界面_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ RopeL  Sprite(左悬绳)
│  ├─ RopeR  Sprite(右悬绳)
│  ├─ Board  Sprite(好友标题木牌)
│  └─ Text  Label「小蜜的信箱」 key=block.caf516d83022.text.5ce2d4cc8539
├─ Subtitle  Label「这里收好旅程消息」 key=block.caf516d83022.text.13d7ce0196ca
├─ Envelope  Sprite(envelope)  @envelope
├─ Mails  List → MailRow（ScrollableItemGrid，动态）  @mails
├─ NoAttachment  Label「消息保存在本机 · 无道具附件」 key=block.caf516d83022.text.dab990264bb3
├─ BtnRead  → onReadLatest  @readButton  打开最新未读信件
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「阅读信件」 key=block.caf516d83022.text.dacedbd790fd
└─ Bottom  Widget:bottom
   ├─ BtnBack  Sprite(返回按钮)  → onBack
   ├─ Bee  Sprite(bee_xiaomi)
   └─ Scarf  Sprite(bee_xiaomi_独立晴天围巾)
```

### MailRow

信件行

- 文件：`assets/bundles/meta/prefabs/items/MailRow.prefab`
- 脚本：`assets/scripts/game/features/daily/MailRow.ts`（MailRow extends ItemGridCell）　参数：onRefresh({ mailId, titleKey, read })
- 来源：T48-01_本地信箱　功能：F050
- 状态节点：Unread / Read 信封二选一（R-13）；状态文字 key 新信件/已读

```
MailRow  [MailRow]
├─ Bg  Sprite(好友行底板_1)  → onOpen
├─ Envelope  
│  ├─ Unread  Sprite(R-13_信封_未读)  @unreadIcon
│  └─ Read  Sprite(R-13_信封_已读)  @readIcon  默认隐藏
├─ Title  Label「欢迎来到小蜜的家园」 key=block.caf516d83022.text.94786df67145  @titleLabel
└─ Status  Label「新信件 · 旅程消息」 key=block.caf516d83022.text.ffa067a9c5fc  @statusLabel  key hg.daily.mail_unread / mail_read
```

### SigninPage

七日礼物：累计签到

- 文件：`assets/bundles/meta/prefabs/pages/SigninPage.prefab`
- 脚本：`assets/scripts/game/features/daily/SigninPage.ts`（SigninPage extends ViewBase）　参数：无
- 来源：T32-01_七日礼物　功能：F043
- 动态内容：7 个 SigninCell（days[0..6]）：天数、花蜜、提示加成、状态文字随签到进度刷新
- 状态节点：SigninCell.states[可领, 已领, 未到] 三选一；Check 已领；Hint 仅有提示奖励的天显示；第 7 天已领时显示野餐帽，否则显示 R-11 大礼盒
- 动效（延后）：FX-04（签到领取）、FX-03

```
SigninPage  [SigninPage]
├─ Background  Sprite(每日任务_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ Art  Sprite(每日奖励标题插画)
│  └─ Text  Label「七日礼物」 key=block.c93ff5bc5bec.text.5ce2d4cc8539
├─ Subtitle  Label「累计登录，漏签不回退」 key=block.c93ff5bc5bec.text.13d7ce0196ca
├─ Days  
│  ├─ Day1  [SigninCell]  @days[]
│  │  ├─ BgClaimable  Sprite(R-11_签到格_可领)  @states[]  默认隐藏
│  │  ├─ BgClaimed  Sprite(R-11_签到格_已领)  @states[]  默认隐藏
│  │  ├─ BgLocked  Sprite(R-11_签到格_未到)  @states[]
│  │  ├─ Day  Label「第1天」 key=block.c93ff5bc5bec.text.6b1b68fe262d  @dayLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Honey  Label「40」  @honeyLabel
│  │  ├─ Hint  @hint  默认隐藏
│  │  │  ├─ Icon  Sprite(灯泡道具)
│  │  │  └─ Count  Label「+1」  @hintLabel
│  │  ├─ Check  Sprite(完成勾)  @check
│  │  └─ State  Label「已领取」 key=block.c93ff5bc5bec.text.005e85599325  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
│  ├─ Day2  [SigninCell]  @days[]
│  │  ├─ BgClaimable  Sprite(R-11_签到格_可领)  @states[]  默认隐藏
│  │  ├─ BgClaimed  Sprite(R-11_签到格_已领)  @states[]  默认隐藏
│  │  ├─ BgLocked  Sprite(R-11_签到格_未到)  @states[]
│  │  ├─ Day  Label「第2天」 key=block.c93ff5bc5bec.text.32bf92e0d376  @dayLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Honey  Label「40」  @honeyLabel
│  │  ├─ Hint  @hint  默认隐藏
│  │  │  ├─ Icon  Sprite(灯泡道具)
│  │  │  └─ Count  Label「+1」  @hintLabel
│  │  ├─ Check  Sprite(完成勾)  @check
│  │  └─ State  Label「已领取」 key=block.c93ff5bc5bec.text.10e180aa7b9a  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
│  ├─ Day3  [SigninCell]  @days[]
│  │  ├─ BgClaimable  Sprite(R-11_签到格_可领)  @states[]  默认隐藏
│  │  ├─ BgClaimed  Sprite(R-11_签到格_已领)  @states[]  默认隐藏
│  │  ├─ BgLocked  Sprite(R-11_签到格_未到)  @states[]
│  │  ├─ Day  Label「第3天」 key=block.c93ff5bc5bec.text.f2bb60d0bc7f  @dayLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Honey  Label「60」  @honeyLabel
│  │  ├─ Hint  @hint
│  │  │  ├─ Icon  Sprite(灯泡道具)
│  │  │  └─ Count  Label「+1」  @hintLabel
│  │  ├─ Check  Sprite(完成勾)  @check  默认隐藏
│  │  └─ State  Label「今日可领」 key=block.c93ff5bc5bec.text.e10c0abcfa59  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
│  ├─ Day4  [SigninCell]  @days[]
│  │  ├─ BgClaimable  Sprite(R-11_签到格_可领)  @states[]  默认隐藏
│  │  ├─ BgClaimed  Sprite(R-11_签到格_已领)  @states[]  默认隐藏
│  │  ├─ BgLocked  Sprite(R-11_签到格_未到)  @states[]
│  │  ├─ Day  Label「第4天」 key=block.c93ff5bc5bec.text.cc00ac47136b  @dayLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Honey  Label「60」  @honeyLabel
│  │  ├─ Hint  @hint  默认隐藏
│  │  │  ├─ Icon  Sprite(灯泡道具)
│  │  │  └─ Count  Label「+1」  @hintLabel
│  │  ├─ Check  Sprite(完成勾)  @check  默认隐藏
│  │  └─ State  Label「待签到」 key=block.c93ff5bc5bec.text.bb5f2aee9328  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
│  ├─ Day5  [SigninCell]  @days[]
│  │  ├─ BgClaimable  Sprite(R-11_签到格_可领)  @states[]  默认隐藏
│  │  ├─ BgClaimed  Sprite(R-11_签到格_已领)  @states[]  默认隐藏
│  │  ├─ BgLocked  Sprite(R-11_签到格_未到)  @states[]
│  │  ├─ Day  Label「第5天」 key=block.c93ff5bc5bec.text.fb0c8aab6a1f  @dayLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Honey  Label「80」  @honeyLabel
│  │  ├─ Hint  @hint  默认隐藏
│  │  │  ├─ Icon  Sprite(灯泡道具)
│  │  │  └─ Count  Label「+1」  @hintLabel
│  │  ├─ Check  Sprite(完成勾)  @check  默认隐藏
│  │  └─ State  Label「待签到」 key=block.c93ff5bc5bec.text.f4de50d54370  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
│  └─ Day6  [SigninCell]  @days[]
│     ├─ BgClaimable  Sprite(R-11_签到格_可领)  @states[]  默认隐藏
│     ├─ BgClaimed  Sprite(R-11_签到格_已领)  @states[]  默认隐藏
│     ├─ BgLocked  Sprite(R-11_签到格_未到)  @states[]
│     ├─ Day  Label「第6天」 key=block.c93ff5bc5bec.text.35d5f282e579  @dayLabel
│     ├─ HoneyIcon  Sprite(蜂蜜货币)
│     ├─ Honey  Label「80」  @honeyLabel
│     ├─ Hint  @hint  默认隐藏
│     │  ├─ Icon  Sprite(灯泡道具)
│     │  └─ Count  Label「+1」  @hintLabel
│     ├─ Check  Sprite(完成勾)  @check  默认隐藏
│     └─ State  Label「待签到」 key=block.c93ff5bc5bec.text.7a8879694a71  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
├─ Day7  [SigninCell]  @days[]
│  ├─ Bg  Sprite(任务空白行_1)
│  ├─ GiftClaimable  Sprite(R-11_第7天大礼盒)  @states[]  默认隐藏
│  ├─ Outfit  Sprite(outfit_picnic_hat)  @states[]  默认隐藏
│  ├─ GiftLocked  Sprite(R-11_第7天大礼盒)  @states[]
│  ├─ Day  Label「第7天」 key=block.c93ff5bc5bec.text.4fdfce0a050a  @dayLabel
│  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  ├─ Honey  Label「120」  @honeyLabel
│  ├─ Hint  @hint
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「+1」  @hintLabel
│  ├─ Check  Sprite(完成勾)  @check  默认隐藏
│  └─ State  Label「待签到」 key=hg.daily.signin_waiting  @stateLabel  hg.daily.signin_claimable / signin_claimed / signin_waiting
├─ Note  Label「第7天野餐帽 · 不需广告补签」 key=block.c93ff5bc5bec.text.a6868dded0e8  @noteLabel
├─ BtnClaim  → onClaim  @claimButton
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「收下今日礼物」 key=block.c93ff5bc5bec.text.6d234ac1fabe
└─ Bottom  Widget:bottom
   ├─ BtnBack  Sprite(返回按钮)  → onBack
   └─ Bee  Sprite(抱蜜罐蜜蜂)
```

### SupplyPopup

每日补给：免费提示与视频花蜜

- 文件：`assets/bundles/meta/prefabs/popups/SupplyPopup.prefab`
- 脚本：`assets/scripts/game/features/daily/SupplyPopup.ts`（SupplyPopup extends PopupBase）　参数：无
- 来源：T47-01_每日补给　功能：F057、F052
- 动态内容：视频补给剩余次数（补给条件1 参数）
- 状态节点：FreeClaimed：今日免费提示已领（覆盖免费按钮）；BtnVideo 无额度或冷却中置灰，冷却时打开 AdStatusPopup
- 动效（延后）：FX-03

```
SupplyPopup  [SupplyPopup]
├─ Backdrop  @backdrop  BlockInputEvents
│  └─ Background  Sprite(每日任务_完整裸背景)
└─ Content  @content
   ├─ Hud  [TopHud]  Widget:top
   │  ├─ Avatar  → onAvatar
   │  │  ├─ Frame  Sprite(玩法_头像空白等级)
   │  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
   │  ├─ Honey  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(蜂蜜货币)
   │  │  └─ Count  Label「360」  @honeyLabel
   │  ├─ Hints  
   │  │  ├─ Bar  Sprite(透明计数底条)
   │  │  ├─ Icon  Sprite(灯泡道具)
   │  │  └─ Count  Label「5」  @hintLabel
   │  └─ Settings  Sprite(设置木质齿轮)  → onSettings
   ├─ Panel  Sprite(空白主面板)
   ├─ Title  
   │  ├─ Art  Sprite(每日奖励标题插画)
   │  └─ Text  Label「每日补给」 key=block.3f5007dc1f02.text.5ce2d4cc8539
   ├─ Subtitle  Label「小蜜的补给篮」 key=block.3f5007dc1f02.text.13d7ce0196ca
   ├─ Bee  Sprite(抱蜜罐蜜蜂)
   ├─ AdLimit  Label「每日总视频上限6次 · 间隔120秒」 key=block.3f5007dc1f02.text.eedfeea9924a  @adLimitLabel
   ├─ FreeRow  
   │  ├─ Bg  Sprite(任务空白行_1)
   │  ├─ Icon  Sprite(灯泡道具)
   │  ├─ Name  Label「每日提示」 key=block.3f5007dc1f02.text.f7267d2b7efb
   │  ├─ Amount  Label「+1」
   │  └─ Condition  Label「每日一次」 key=block.3f5007dc1f02.text.b93c494a3096
   ├─ VideoRow  
   │  ├─ Bg  Sprite(任务空白行_1)
   │  ├─ Icon  Sprite(蜂蜜货币)
   │  ├─ Name  Label「视频补给」 key=block.3f5007dc1f02.text.b2c1933e2dc1
   │  ├─ Amount  Label「+60」  @videoAmountLabel
   │  └─ Condition  Label「每日最多2次」 key=block.3f5007dc1f02.text.a6183a4c2e41  @videoConditionLabel
   ├─ VoluntaryNote  Label「视频自愿观看 · 正常游玩也能获得花蜜」 key=block.3f5007dc1f02.text.5fbfdb3f8a63
   ├─ BtnFree  → onFreeHint  @freeButton
   │  ├─ Bg  Sprite(下一关按钮)
   │  └─ Text  Label「免费领取1提示」 key=block.3f5007dc1f02.text.2f94ab7972c7  @freeLabel
   ├─ FreeClaimed  Sprite(已领取按钮)  @freeClaimed  默认隐藏
   ├─ BtnVideo  → onVideo  @videoButton  Widget:bottom
   │  ├─ Bg  Sprite(再来一次按钮)
   │  └─ Text  Label「视频 +60花蜜」 key=block.3f5007dc1f02.text.925057881d05  @videoButtonLabel
   └─ Bottom  Widget:bottom
      └─ BtnBack  Sprite(返回按钮)  → onBack
```

### TasksPage

每日奖励：三任务与周目标、七日礼物入口

- 文件：`assets/bundles/meta/prefabs/pages/TasksPage.prefab`
- 脚本：`assets/scripts/game/features/daily/TasksPage.ts`（TasksPage extends ViewBase）　参数：无
- 来源：T29-01_三任务与周签到入口　功能：F041、F042、F043
- 动态内容：3 行任务（TaskRow 组件）：标题 key、进度、奖励随当日任务刷新
- 状态节点：TaskRow：Done/Check 完成勾、BtnClaim 可领、Claimed 已领、Locked 未解锁（四选一）；设计无进度条，进度用文字
- 动效（延后）：FX-03（领取花蜜飞向 HUD）

```
TasksPage  [TasksPage]
├─ Background  Sprite(每日任务_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ Art  Sprite(每日奖励标题插画)
│  └─ Text  Label「每日奖励」 key=block.e7d315756d9b.text.5ce2d4cc8539
├─ Tasks  
│  ├─ Task1  [TaskRow]  @rows[]
│  │  ├─ Bg  Sprite(任务空白行_1)
│  │  ├─ Done  
│  │  │  ├─ Base  Sprite(任务勾底板_1)
│  │  │  └─ Check  Sprite(完成勾)  @doneMark
│  │  ├─ Title  Label「开心玩三局」 key=block.e7d315756d9b.text.3703dde51f57  @titleLabel  任务 key 由脚本按当日任务设置
│  │  ├─ Progress  Label「3/3」  @progressLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Reward  Label「+120」  @rewardLabel
│  │  ├─ BtnClaim  → onClaim  @claimButton
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「领取」 key=block.e7d315756d9b.text.d33fc2404ebe
│  │  ├─ Claimed  Sprite(已领取按钮)  @claimedMark  默认隐藏
│  │  └─ Locked  Sprite(模式锁)  @lockedMark  默认隐藏
│  ├─ Task2  [TaskRow]  @rows[]
│  │  ├─ Bg  Sprite(任务空白行_1)
│  │  ├─ Done  
│  │  │  ├─ Base  Sprite(任务勾底板_1)
│  │  │  └─ Check  Sprite(完成勾)  @doneMark
│  │  ├─ Title  Label「建好一阶」 key=block.e7d315756d9b.text.c87f02e3432c  @titleLabel  任务 key 由脚本按当日任务设置
│  │  ├─ Progress  Label「1/1」  @progressLabel
│  │  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  │  ├─ Reward  Label「+40」  @rewardLabel
│  │  ├─ BtnClaim  → onClaim  @claimButton
│  │  │  ├─ Bg  Sprite(下一关按钮)
│  │  │  └─ Text  Label「领取」 key=block.e7d315756d9b.text.d33fc2404ebe
│  │  ├─ Claimed  Sprite(已领取按钮)  @claimedMark  默认隐藏
│  │  └─ Locked  Sprite(模式锁)  @lockedMark  默认隐藏
│  └─ Task3  [TaskRow]  @rows[]
│     ├─ Bg  Sprite(任务空白行_1)
│     ├─ Done  
│     │  ├─ Base  Sprite(任务勾底板_1)
│     │  └─ Check  Sprite(完成勾)  @doneMark
│     ├─ Title  Label「收获十二块」 key=block.e7d315756d9b.text.fe603ae2120f  @titleLabel  任务 key 由脚本按当日任务设置
│     ├─ Progress  Label「12/12」  @progressLabel
│     ├─ HoneyIcon  Sprite(蜂蜜货币)
│     ├─ Reward  Label「+20」  @rewardLabel
│     ├─ BtnClaim  → onClaim  @claimButton
│     │  ├─ Bg  Sprite(下一关按钮)
│     │  └─ Text  Label「领取」 key=block.e7d315756d9b.text.d33fc2404ebe
│     ├─ Claimed  Sprite(已领取按钮)  @claimedMark  默认隐藏
│     └─ Locked  Sprite(模式锁)  @lockedMark  默认隐藏
├─ BtnWeekly  → onWeekly
│  ├─ Bg  Sprite(再来一次按钮)
│  └─ Text  Label「每周目标」 key=block.e7d315756d9b.text.d5b8814ffafd
├─ BtnSignin  → onSignin
│  ├─ Bg  Sprite(再来一次按钮)
│  └─ Text  Label「七日礼物」 key=block.e7d315756d9b.text.73fae92a7bd5
├─ BtnMap  → onMap
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「回到地图」 key=block.e7d315756d9b.text.b0d1b8e9c826
└─ Bottom  Widget:bottom
   ├─ BtnBack  Sprite(返回按钮)  → onBack
   └─ Bee  Sprite(抱蜜罐蜜蜂)
```

### WeeklyPage

每周目标：活跃日、局数进度与周礼

- 文件：`assets/bundles/meta/prefabs/pages/WeeklyPage.prefab`
- 脚本：`assets/scripts/game/features/daily/WeeklyPage.ts`（WeeklyPage extends ViewBase）　参数：无
- 来源：T30-01_每周目标　功能：F042
- 动态内容：7 个活跃日（dayChecks/dayLabels 按序号）、本周进度文字参数、进度条填充宽度、周礼花蜜
- 状态节点：每天 Check（已活跃）与 Num（未活跃）互斥；BtnClaim 未达成时置灰、已领取时隐藏并显示 Claimed
- 动效（延后）：FX-03、FX-02（纪念印记）

```
WeeklyPage  [WeeklyPage]
├─ Background  Sprite(每日任务_完整裸背景)
├─ Hud  [TopHud]  Widget:top
│  ├─ Avatar  → onAvatar
│  │  ├─ Frame  Sprite(玩法_头像空白等级)
│  │  └─ Level  Label「Lv.14」 key=block.common.level  @levelLabel
│  ├─ Honey  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(蜂蜜货币)
│  │  └─ Count  Label「360」  @honeyLabel
│  ├─ Hints  
│  │  ├─ Bar  Sprite(透明计数底条)
│  │  ├─ Icon  Sprite(灯泡道具)
│  │  └─ Count  Label「5」  @hintLabel
│  └─ Settings  Sprite(设置木质齿轮)  → onSettings
├─ Panel  Sprite(空白主面板)
├─ Title  
│  ├─ Art  Sprite(每日奖励标题插画)
│  └─ Text  Label「每周目标」 key=block.2b34deb2605b.text.5ce2d4cc8539
├─ Subtitle  Label「这周，也来见面」 key=block.2b34deb2605b.text.13d7ce0196ca
├─ Calendar  Sprite(任务图标)
├─ Days  
│  ├─ Day1  
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Check  Sprite(完成勾)  @dayChecks[]
│  │  └─ Num  Label「1」  @dayLabels[]  默认隐藏
│  ├─ Day2  
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Check  Sprite(完成勾)  @dayChecks[]
│  │  └─ Num  Label「2」  @dayLabels[]  默认隐藏
│  ├─ Day3  
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Check  Sprite(完成勾)  @dayChecks[]
│  │  └─ Num  Label「3」  @dayLabels[]  默认隐藏
│  ├─ Day4  
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Check  Sprite(完成勾)  @dayChecks[]
│  │  └─ Num  Label「4」  @dayLabels[]  默认隐藏
│  ├─ Day5  
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Check  Sprite(完成勾)  @dayChecks[]  默认隐藏
│  │  └─ Num  Label「5」  @dayLabels[]
│  ├─ Day6  
│  │  ├─ Base  Sprite(任务勾底板_1)
│  │  ├─ Check  Sprite(完成勾)  @dayChecks[]  默认隐藏
│  │  └─ Num  Label「6」  @dayLabels[]
│  └─ Day7  
│     ├─ Base  Sprite(任务勾底板_1)
│     ├─ Check  Sprite(完成勾)  @dayChecks[]  默认隐藏
│     └─ Num  Label「7」  @dayLabels[]
├─ Progress  Label「15/15局 · 活跃4/4天」 key=block.2b34deb2605b.text.4b32ca1b5c76  @progressLabel
├─ Bar  
│  ├─ Track  Sprite(赠送进度空槽)
│  └─ Fill  Sprite(赠送进度填充)  @progressFill  横向填充
├─ Reward  
│  ├─ Bg  Sprite(任务空白行_1)
│  ├─ HoneyIcon  Sprite(蜂蜜货币)
│  ├─ Honey  Label「+300」  @rewardLabel
│  ├─ Stamp  Sprite(stamp)  @stamp
│  └─ StampText  Label「纪念印记」 key=block.2b34deb2605b.text.062b66c9a1e3
├─ BtnClaim  → onClaim  @claimButton
│  ├─ Bg  Sprite(下一关按钮)
│  └─ Text  Label「收下周礼」 key=block.2b34deb2605b.text.513603e68dea
├─ Claimed  Sprite(已领取按钮)  @claimedMark  默认隐藏
└─ Bottom  Widget:bottom
   ├─ BtnBack  Sprite(返回按钮)  → onBack
   └─ Bee  Sprite(抱蜜罐蜜蜂)
```
