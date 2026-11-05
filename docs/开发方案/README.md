# Honey Garden Cocos 开发方案（dev 分支直接开发）

更新：2026-11-05　　状态：**已确认（2026-11-05）**，按本方案执行

本方案是 [重建计划](../重建计划/README.md) 的执行版。重建计划仍是架构、复用清单、规则默认值的来源；本文只记录**本次用户指令带来的变更**和**一天内的执行顺序**。两者冲突时以本文为准。开发约束见 [开发约束](开发约束.md)。

## 0. 本次指令对重建计划的变更

| 项 | 重建计划原默认 | 本次确定 |
|---|---|---|
| 分支（E01） | 新建 `rebuild` 分支 | **直接在 `dev` 开发**，不建分支 |
| Prefab 制作（E03） | Creator 编辑器扩展生成骨架 | **Node 脚本直接写 `.prefab` / `.meta` 文件**；结构先生成文档，确认后再出 Prefab |
| 字体（E05） | 正文系统字体 + 标题站酷快乐体 + 数字 BMFont | **全部默认系统字体**；数字用 Label，不用图片拼数字（R-20 数字字形不接入）。只有设计上要求的艺术字用图片：封面标题、R-19 连击评语 |
| 设计分辨率（E02） | 750×1334 | **853×1844，适配宽度**（沿用当前工程设置）。页面配置坐标 1:1 换算，不做 0.8793 缩放；顶部/底部区用 Widget 吸边，中间区居中，16:9 机型由中间区吸收高度差 |
| Android / 微信 / 广告 SDK（E06、M5） | 两端 SDK | **本轮不做**。只做 `WebPlatform`，激励视频走模拟实现（直接返回成功），流程能领奖即可 |
| 音频 | AudioService + 资源 | **本轮不做**。设置页的音乐/音效开关只存档，不发声 |
| Spine / 动效 | M6 打磨 | **本轮不做**，Spine 模块保持关闭。需要动效的位置登记在 §6 任务表，后续补 |
| 章节剧情台词（E10） | 等策划提供 | **先由开发设计占位文案写入配置**（§5.1），不满意直接改配置和语言表，不改代码 |
| 美术压缩/分包体积 | M0 流水线降采样、量化、图集 | 本轮只做**按显示尺寸降采样**（sharp 已安装），保证内存可用；量化、图集、微信包体留到平台阶段 |
| 旧代码 | 删除 | **已确认删除**：旧 114 个 `.ts`、82 个 Prefab、`Main.scene`、哈希命名纹理、`tools/prefab-foundation`（生成器序列化部分先抽出复用，见 §3）。git 历史可找回 |

## 1. 现状结论（摘要）

- **策划**：65 项功能规则完整（`docs/策划/功能/F001–F065`），题库 110 题可用，数值见重建计划 C 报告。
- **美术**：已齐。`arts/游戏素材/页面配置/` 79 个页面/状态 JSON，每层有坐标、尺寸、z 序、文件；**每个文字层有字号、颜色、描边、对齐、本地化 key、数据绑定（如 `wallet.honey`）和按钮动作**。补充美术 R-01～R-24 共 113 张已于 11-05 交付。
- **现有代码**：是从已不存在的原型生成的空壳，不延续。保留题库和 6 个纯逻辑文件（[07 复用清单](../重建计划/07_复用清单.md) §2）。
- **BigHero 框架**：`E:/temp/gm/bighero2415`（与本仓库同级），Creator 2.4.15。纯逻辑约 40 个文件可直接复制，UI/资源/列表按 3.x 改写（07 §1）。
- **Spine 来源**：`E:/linewell/projects/cs-game/coinbeach24/assets/LiveData/anim`，2.4.15 工程。其中 3.8.75 版本可直接用于 3.8.8；3.6.52 版本（coin、star、tutoria、loading、bomb、watchtv、Spin）**不兼容，不用**。
- **工具**：本机有 Creator 3.8.8（`C:/ProgramData/cocos/editors/Creator/3.8.8`）、`sharp`、`typescript`。可以用命令行构建 web-mobile 来校验 Prefab 导入和脚本编译。

## 2. 总体架构（沿用重建计划 02，列出要点）

```
assets/
  scenes/Boot.scene                 唯一场景：Canvas + UIRoot 各层 + App 组件
  scripts/
    framework/                      BigHero 移植，不依赖业务
      core/ config/ storage/ res/ ui/(UIManager, ViewBase, PopupBase, uiView, grid/) i18n/ platform/(WebPlatform)
    game/
      App.ts                        组合根（显式创建服务，不扫描节点树）
      save/                         SaveService：单存档、事务提交、幂等领取
      domain/                       纯 TS 规则，可 node 测试
      features/<模块>/              View 组件（与 Prefab 同名）
  resources/  boot/ framework/      主包最小内容
  bundles/    common puzzle endless garden1 garden2 garden3 meta gm
tools/
  ui-gen/                           ← 唯一的 Prefab 生成器（§3）
  art-import/                       ← 图片降采样导入 + meta 生成（§4）
  tests/                            domain 单元测试
```

依赖方向：`features → domain, framework`；`domain` 不 import `cc`；`framework` 不 import `game`。

## 3. Prefab 用脚本写文件：可行性与做法

**结论：可以。** 3.8.8 的 Prefab 是 JSON 序列化，仓库里已有一份验证过的序列化器（[builder.mjs](../../tools/prefab-foundation/builder.mjs)：脚本 UUID 压缩、`PrefabInfo`/`CompPrefabInfo`、Sprite/Label/Button/clickEvents）。新生成器在它的基础上写，不另起一套。

### 3.1 数据流（单一来源）

```
arts/游戏素材/页面配置/*.json   （坐标、图片、文字样式、本地化 key、绑定、按钮动作）
        +
tools/ui-gen/specs/<Prefab>.mjs （每个 Prefab 一份：选哪些层、节点分组、挂哪个脚本、
                                 哪些 @property 绑定、哪些是动态列表/状态节点、按钮→方法）
        ↓  node tools/ui-gen/gen.mjs --doc
docs/开发方案/Prefab结构.md       （先出文档，确认结构）
        ↓  node tools/ui-gen/gen.mjs --prefab
assets/**/prefabs/*.prefab        （同时写入 @property 引用和 clickEvents）
```

- 文档和 Prefab 来自**同一份 spec**，不会漂移。改结构只改 spec，重新生成。
- 生成器只写自己 spec 登记过的文件；不扫描、不删除别的文件。
- 脚本先写好 `.ts` 和 `.ts.meta`（固定 uuid），Prefab 里的组件类型 = 压缩后的脚本 uuid，`@property` 字段直接写 `{__id__: n}` 引用。

### 3.2 生成规则

| 来源 | 生成为 |
|---|---|
| `type: image` 层 | 节点 + `UITransform` + `Sprite`（spriteFrame 指向 §4 导入后的 uuid）；位置由左上原点换算到父节点中心坐标 |
| `type: text` 层 | 节点 + `Label`（系统字体、字号、颜色、描边、对齐、换行/缩小由 `fit`/`max_lines` 决定）+ `LocalizedLabel`（key = `localization_key`）。有 `binding` 的文字只放本地化模板，数值由 View 运行时赋值 |
| `runtime.actions` 中的按钮层 | 节点加 `Button`，`clickEvents` 指向根 View 的 public 方法，参数写 `customEventData` |
| `procedural` 层（棋盘木框、凹槽、轮廓） | 不出图，生成空容器节点，交给 `BoardView` 运行时画（参考 `运行组件/block_hex_runtime.js`） |
| HUD、引导示例盘面等 | spec 里排除，或改为公共部件的挂点 |
| 弹窗 | 统一 `Root(View) / Backdrop(遮罩+BlockInputEvents) / Content` |
| 页面根 | 全屏 `Widget`；顶部、底部分组节点加 `Widget` 吸边 |

### 3.3 公共部件与嵌套 Prefab

3.x 嵌套 Prefab 实例（`PrefabInstance` + `propertyOverrides`）手写容易出错。处理方式：

- 公共部件（`TopHud`、`RewardItem` 等）是独立 Prefab；页面里放一个**挂点节点**，View 通过 `@property(Prefab)` 在 `onLoad` 实例化到挂点。引用仍在 Inspector 绑定，不按名字查找。
- 列表 cell 同理：`@property(Prefab) cellPrefab`。

### 3.4 Prefab 结构文档格式（示例：结算 `PuzzleWinPopup`，来源 T06-01）

确认方案后，`Prefab结构.md` 会对每个 Prefab 输出以下内容：

```
PuzzleWinPopup  [bundles/puzzle/prefabs/popups/PuzzleWinPopup.prefab]  来源 T06-01_普通拼图成功 / T07-01
脚本：PuzzleWinPopup extends PopupBase   参数：{ level, reward, stars?, settlementId }
├─ Backdrop                     Sprite(结算_完整裸背景) BlockInputEvents         @property backdrop
├─ HudSlot                      挂点 → TopHud.prefab                             @property hudSlot
└─ Content                                                                       @property content
   ├─ Panel                     Sprite(结算原尺寸完整主框)
   ├─ PilotBee                  Sprite(飞行员蜜蜂)
   ├─ Title                     左花叶 / 右花叶 / 红飘带 + Label 闯关成功 [key]
   ├─ LevelLabel                Label 「第 {level} 关」 [key, binding mainline.level]  @property levelLabel
   ├─ StarsRow (状态节点)        3×Star(金/空)，仅限步关显示                       @property stars: Node[]
   ├─ RewardCard                Sprite(奖励卡) + Sprite(花蜜) + Label「+{n}」      @property rewardLabel
   ├─ ClaimedTip                Label 正常奖励已到账 [key]
   ├─ BtnNext      Button → onNext                                              
   ├─ BtnBonusAd   Button → onBonusAd   Label「视频加领 +{n}」                      @property bonusAdBtn
   ├─ CheerBee                  Sprite(欢呼蜜蜂)
   ├─ BtnBack      Button → onBack
   └─ BtnHome      Button → onHome
动态内容：无列表。状态节点：StarsRow（普通关隐藏）、BtnBonusAd（已领/无额度时置灰）。动效：FX-01、FX-03、FX-11
```

## 4. 美术导入

`tools/art-import/import.mjs`：

1. 从页面配置统计每张图的**最大显示尺寸**，用 sharp 等比降采样到该尺寸（不放大）。原图保留在 `arts/`。
2. 输出到 `assets/bundles/<包>/textures/<模块>/<英文名>.png`，并直接写 `.meta`（固定 uuid、spriteFrame 子资源 `@f9941`）。中文原名 → 新路径记录到 `tools/art-import/asset-map.json`，生成器按 asset id 查 uuid。
3. 九宫格：面板、底条、按钮按 spec 写入 meta 的 `border*`。
4. 不做量化、图集、JPG；后续平台阶段再做。

## 5. 功能实现方式（按策划）

| 模块 | 实现要点 | 动态内容 |
|---|---|---|
| 启动 Loading（主图） | `LoadingView` 在 `resources/boot`；进度 = 加载 common、puzzle 包 + 配置 + 语言 | 无 |
| 主线地图（`微信图片_…81_187`） | 12 页 × 8 关；页面预放 8 个 `LevelNode` 挂点，翻页只刷新数据；侧栏入口按策划换成单机入口（任务、签到、蜂友、活动、相册、信箱、成就） | 8 个固定槽，非滚动列表 |
| 开局预览 T01/T04 | 同一 Prefab，限步关显示步数与星级规则 | 无 |
| 拼图 T02/T03/T05 | 复用 `HexCoordinates / PuzzleModel / PuzzleSession / PuzzleLayout`；`BoardView` 运行时按题目生成格子（对象池）；`TrayView` 3/6/7 槽；`DragController` 拖放吸附（参考旧 `PuzzleController`） | 格子、拼块：对象池；托盘槽：按题目块数 |
| 结算 T06/T07/T08 | 存档提交成功后才播奖励表现；首通 80、复玩 20、限步 120 + 星级补差 | 无 |
| 家园 T15–T18、T27 | 一个 `GardenPage`，三园资源分包；5 个 `BuildingSlot` 固定槽，按等级换图（水车多一个转子节点）；整园完工 → 下一主题 | 5 个固定槽 |
| 无尽 T11–T14 | 37 格棋盘、3 块发牌（形状表见 06 E08）、三轴消除、连击、撤回 1 次、收获公式 | 格子池、3 块托盘 |
| 回流系统 T19–T35、T47–T50 | 任务 3 行、签到 7 格、成就 3 行、蜂友 3 卡、相册每册 6 张、衣柜 5 件，**都是固定数量的预置节点**；信箱用 `ScrollableItemGrid` | 仅信箱、帮助目录、GM 用 ScrollableItemGrid |
| 设置/帮助/隐私/存档 T39–T46、T50 | 通用弹窗；广告状态 T42–T45 合为一个 Prefab 的 4 个状态节点 | 无 |
| 引导 T51 | `GuideOverlay` 一个 Prefab，8 步数据驱动（挖孔位置取目标节点的世界坐标，目标节点由所在 View 通过接口提供，不按名字查找） | 无 |
| 存档 | `SaveService`：单 key、事务提交、幂等领取键、`schemaVersion` | — |
| 多语言 | `zh-CN.json` + `qps-ploc.json` 合并为 `bundles/common/i18n/`；所有 Label 挂 `LocalizedLabel`，模板参数由 View 填 | — |

### 5.1 剧情配置设计（F037，占位文案由开发先写）

剧情与蜂友故事全部数据驱动，放 `bundles/meta/config/story.json`，文字放语言表 `story.*`。改文案只改语言表，改结构只改配置，代码不动。

```json
{
  "stories": [
    { "id": "chapter.1", "kind": "chapter", "unlock": { "chapter": 1 }, "image": "R-17_剧情_1",
      "titleKey": "story.chapter.1.title", "steps": ["story.chapter.1.s1", "story.chapter.1.s2", "story.chapter.1.s3"] },
    { "id": "chapter.2", "kind": "chapter", "unlock": { "chapter": 2 }, "image": "R-17_剧情_2", "...": "..." },
    { "id": "chapter.end", "kind": "chapter", "unlock": { "allGardensDone": true }, "image": "R-17_剧情_3", "...": "..." },
    { "id": "bee.xiaomi", "kind": "companion", "unlock": { "bee": "xiaomi", "affinity": 15 }, "image": "bee_xiaomi",
      "titleKey": "story.bee.xiaomi.title", "steps": ["story.bee.xiaomi.s1", "story.bee.xiaomi.s2", "story.bee.xiaomi.s3"] }
  ]
}
```

| 故事 | 触发 | 标题 | 三步 |
|---|---|---|---|
| chapter.1 | 出发进入第二园 | 出发，清风水湾 | 向阳花园建好啦，小蜜收拾好行囊 / 顺着小溪一路向前飞 / 清风水湾到了，这里还是一片空地 |
| chapter.2 | 出发进入第三园 | 飞上云上蜂谷 | 水车转起来了，蜂友们都来送行 / 乘着暖风越飞越高 / 云上蜂谷到了，一起把它建起来吧 |
| chapter.end | 三园全部完工 | 三座花园都建好了 | 向阳、水湾、云谷都热闹起来 / 蜂友们在花园里开起了野餐 / 以后也常回来看看吧 |
| bee.xiaomi | 小蜜亲密 15 | 第一位家园伙伴 | 一起拼图 / 建起树屋 / 欢迎回家（F037 原文） |
| bee.huahua | 花花亲密 15 | 花花的小花园 | 种下花籽 / 细心照料 / 满园花开（F037 原文） |
| bee.agong | 阿工亲密 15 | 阿工的小水车 | 捡起木料 / 搭好水车 / 迎风转动（F037 原文） |

规则：只看不发奖；已读记录 `storyReadIds` 只用于已读标识；回看资格按 `unlock` 实时判断。

规则冲突 D01–D09 按 [06 待确认事项](../重建计划/06_待确认事项.md) 的默认方案执行。

## 6. 动效任务（延后，本轮不实现）

本轮页面只做静态状态切换和必要的数值刷新，不做动画、粒子、Spine。下表是后续要补的动效，结构文档中对应 Prefab 会标注「动效：FX-xx」。Spine 素材来源：coinbeach24 `assets/LiveData/anim` 中 `spine: 3.8.75` 的资源（3.6.52 版本不兼容 3.8.8，不用）；接入时开启 Spine 模块，只复制 `.json/.atlas/.png`。

| ID | 位置 | 效果 | 候选素材 |
|---|---|---|---|
| FX-01 | 结算 PuzzleWinPopup、整园完工 ChapterCompletePopup | 庆祝烟花 | Spine `YanHua_tx_01` |
| FX-02 | 奖励弹窗、相册集齐、活动奖励 | 奖励背后旋转光效 | Spine `JieMian_Gang_tx`；或 R-21 光圈 + tween 旋转 |
| FX-03 | 结算、无尽收获、签到、任务领取 | 花蜜飞向 HUD 计数 | tween + 花蜜图标对象池 |
| FX-04 | 签到领取 | 签到格领取特效 | Spine `QianDao_tx` |
| FX-05 | 家园建筑升级 | 施工脚手架 → 新等级出现，满级光效 | R-22 脚手架/满级光效 + Spine `ShengJiJieMian_01~03` |
| FX-06 | 水车 1–5 级 | 水轮转子持续旋转 | tween 旋转 |
| FX-07 | 引导 GuideOverlay | 手指点击/拖动 | Spine `YingDao_01` 或手指图 tween |
| FX-08 | 广告冷却 T45 | 倒计时圈 | Spine `CDtime_01` |
| FX-09 | 拼图拖动 | 拼块拖尾 | Spine `QiZi_tuowei_01` |
| FX-10 | 拼图/无尽 | 落子吸附弹性、消除闪光、连击评语（R-19）弹出 | tween + R-21 粒子/扫光 |
| FX-11 | 结算星级 | 星星逐个落下 | tween |
| FX-12 | 页面/弹窗 | 打开关闭过渡 | 框架过渡（本轮已有淡入/缩放，打磨时调参） |

## 7. 执行顺序

目标：**主循环完整可玩 + 全部 Prefab 落地**。回流系统按优先级做，做不完的在当天结束时如实列出。

| 步骤 | 内容 | 产出 / 验证 |
|---|---|---|
| 1 | 删除旧代码、旧 Prefab、旧纹理、`Main.scene`、`tools/prefab-foundation`；保留题库与 6 个纯逻辑文件（移到新位置）；更新 `AGENTS.md` | 一次提交 |
| 2 | 移植框架：core、config、storage、res、ui（UIManager / ViewBase / PopupBase / uiView / 过渡 / ScrollableItemGrid）、i18n、WebPlatform | `tsc --noEmit` 通过 |
| 3 | `tools/art-import`：降采样 + 写 meta + asset-map | 导入数量与页面配置引用一致 |
| 4 | `tools/ui-gen`：spec + 生成器，**输出 `Prefab结构.md`** | **暂停，等你确认** |
| 5 | 生成全部 Prefab 与 `Boot.scene`；写 View 脚本（`@property` 与按钮方法） | 命令行构建 web-mobile 无报错；请你用 Creator 打开一次 |
| 6 | domain + SaveService：钱包、主线、拼图、结算、家园、无尽 | node 单元测试 |
| 7 | 串主循环：Loading → 地图 → 预览 → 拼图 → 结算 → 家园 → 无尽 | 浏览器预览走通 |
| 8 | 回流系统：设置 → 任务/签到 → 成就 → 蜂友/剧情/相册/衣柜 → 活动 → 信箱 → 引导 | 按优先级 |

除第 4 步的确认和第 5 步打开一次 Creator 外，全程不需要编辑器，静默开发。

## 8. 需要你人工处理的事

1. 第 4 步：确认 `Prefab结构.md`。
2. 第 5 步：用 Creator 3.8.8 打开工程一次，让它导入资源，对照效果图看几个页面；有偏差告诉我，我改 spec 重新生成。结构定稿前不要在 Creator 里手改生成的 Prefab。
3. 剧情占位文案（§5.1）不满意时直接改配置/语言表，或告诉我改。
