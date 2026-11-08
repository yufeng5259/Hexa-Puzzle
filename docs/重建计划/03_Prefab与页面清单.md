# 03 Prefab 与页面清单

> 历史全量清单：本次只实施 [五页首版需求](五页首版_需求与流程.md) 的页面和必要弹窗；实际Prefab接缝见 [技术契约](五页首版_配置与技术契约.md)。下方旧外围页面不恢复。

- **效果图**：`arts/效果预览/`（原始9页），以及 `arts/效果预览/缺少/<T码>_<名称>.png`。
- **页面配置**（各层坐标）：`arts/游戏素材/页面配置/<页名>.json`，以及 `…/页面配置/缺少/<T码>_<名称>.json`。
- **Prefab 路径**：`assets/bundles/<包>/prefabs/{pages,popups,items}/<名称>.prefab`，View 类与 Prefab 同名。
- **阶段**：指在哪个里程碑做出可用版本（见 [04_开发计划](04_开发计划.md)）。M6 统一做动效打磨。

同一页面的不同状态（如家园的满级、不足、升级中）**不拆成多个 Prefab**，用同一个 Prefab 内预置的状态节点切换。

## 1. 主包 `resources/`

| Prefab | View 类 | 说明 | 效果图 | 阶段 |
|---|---|---|---|---|
| `framework/Toast` | `Toast` | 飘字 | 无，按通用风格 | M0 |
| `framework/ConfirmPopup` | `ConfirmPopup` | 通用确认框：标题、正文、1–2个按钮 | T37-01 / T38-01 / T13-01 | M0 |
| `framework/LoadingMask` | `LoadingMask` | 加载遮罩，带转圈 | T42-01 | M0 |
| `boot/LoadingView` | `LoadingView` | 启动页：标题插画加进度条 | 主图（S01） | M0 |

## 2. `common` 包

### 2.1 公共组件（嵌套 Prefab）

| Prefab | 说明 | 取样来源 | 阶段 |
|---|---|---|---|
| `items/TopHud` | 头像与等级、花蜜、提示、设置 | T15-01 | M1 |
| `items/JellyButton_Green/Blue/Yellow/Gray` | 果冻按钮4色 | T01-01、结算 | M0 |
| `items/IconButton` | 圆形木质图标按钮，含红点和角标节点 | T02-01 | M0 |
| `items/WoodTitle` | 挂绳木牌标题 | T39-01 | M0 |
| `items/PanelFrame` | 奶油面板加木框（九宫格） | T36-01 | M0 |
| `items/RibbonTitle` | 红飘带标题 | 结算、每日任务 | M1 |
| `items/RewardItem` | 奖励图标加数量 | T06-01 | M1 |
| `items/ProgressBar` | 进度条 | 主图、T15-01 | M0 |
| `items/ToggleSwitch` | 开关 | T39-01（需要补美术） | M4 |
| `items/RedDot` | 红点 | 地图侧栏 | M4 |
| `items/RewardedAdButton` | 视频按钮（带图标、冷却状态） | T08-01（需要补视频图标） | M5（M1 先做占位） |

### 2.2 公共弹窗

| Prefab | View 类 | 效果图 | 功能 | 阶段 |
|---|---|---|---|---|
| `popups/SettingsPopup` | `SettingsPopup` | T39-01 | F047 | M4（M1 先做音乐、音效开关） |
| `popups/AdStatusPopup` | `AdStatusPopup` | T42–T45（4种状态） | F052 | M5 |
| `popups/RewardPopup` | `RewardPopup` | 通用领奖展示 | F020 | M1 |
| `popups/HelpPopup` | `HelpPopup` | T40-01～04（目录加3篇） | F046 | M4 |
| `popups/PrivacyPopup` | `PrivacyPopup` | T50-01 | F051 | M4 |
| `popups/LocalSavePopup` | `LocalSavePopup` | T46-01 | F065 | M4 |
| `popups/GuideOverlay` | `GuideOverlay` | T51-01～08（8种变体，1个 Prefab） | F048/F049 | M2 |

## 3. `puzzle` 包（主线）

### 3.1 页面

| Prefab | View 类 | 效果图 / 配置 | 功能 | 阶段 |
|---|---|---|---|---|
| `pages/MapPage` | `MapPage` | `微信图片_20261019173444_81_187`（主界面地图） | F007/F008 | M1 |
| `pages/PuzzlePage` | `PuzzlePage` | T02-01、T02-02、T03-01、T05-01（普通和限步共用，限步多一个步数栏） | F010–F016 | M1 |

**MapPage 的结构**：
- 地图背景；
- 关卡节点区：12页×8关，分页切换，只实例化当前页的8个节点；
- 左侧入口：每日任务、签到、蜂友；
- 右侧入口：活动、相册、信箱、成就；
- 底部两个大按钮：建造花园（带进度）、无尽模式；
- 顶部 TopHud。

效果图中的排行榜、超值礼包、新手礼包、限时活动入口改为上面这些单机入口。

**PuzzlePage 的结构**：
- TopHud；
- 关卡木牌；
- 信息栏：限步时显示剩余步数，普通关显示目标，另有提示按钮；
- 棋盘区 `BoardView`；
- 托盘区 `TrayView`（3/6/7个槽，按块数布局）；
- 底部按钮：暂停、帮助。

### 3.2 单元 Prefab

| Prefab | 说明 | 阶段 |
|---|---|---|
| `items/LevelNode` | 关卡六角盾牌：金色/灰色/当前高亮、关号、0–3星、限步标记、当前关头像 | M1 |
| `items/HexCell` | 棋盘格：凹槽/障碍/提示轮廓 | M1 |
| `items/PieceCell` | 拼块单格：5色 × 无花/落地 | M1 |
| `items/TraySlot` | 托盘槽 | M1 |

### 3.3 弹窗

| Prefab | View 类 | 效果图 | 功能 | 阶段 |
|---|---|---|---|---|
| `popups/LevelPreviewPopup` | `LevelPreviewPopup` | T01-01 / T04-01（普通和限步共用） | F009 | M1 |
| `popups/ResumePopup` | `ResumePopup` | T09-01 | F013 | M1 |
| `popups/PuzzleWinPopup` | `PuzzleWinPopup` | T06-01 / T07-01（普通和限步星级共用） | F014/F015 | M1 |
| `popups/ChallengeFailPopup` | `ChallengeFailPopup` | T08-01 | F011/F054 | M1 |
| `popups/PausePopup` | `PausePopup` | T36-01 | F046 | M1 |
| `popups/HintEmptyPopup` | `HintEmptyPopup` | T41-01 | F016/F053 | M1 |
| `popups/FeaturedPopup` | `FeaturedPopup` | T10-01 | F021 | M4 |

退出确认（T37-01）和重开确认（T38-01）使用 `ConfirmPopup`。

## 4. `garden1/2/3` 包与家园

家园页的结构和代码只有一份，放在 `common` 包；三园只是资源不同，各放在自己的包里。

| Prefab | View 类 | 效果图 / 配置 | 功能 | 阶段 |
|---|---|---|---|---|
| `common/pages/GardenPage` | `GardenPage` | T15-01～05 | F023–F025、F028 | M2 |
| `common/items/BuildingSlot` | `BuildingSlot`：建筑图（0–5级，水车另有转子节点）、价签、进度、满级标记 | T15-01 / T15-02 | F023/F024 | M2 |
| `common/items/BuildingPriceTag` | 价签与升级按钮 | T15-01 | F023 | M2 |
| `common/popups/ChapterCompletePopup` | 整园完工奖励 | T16-01 | F026 | M2 |
| `common/popups/NextThemePopup` | 下一主题（两种版式用同一 Prefab 换图） | T17-01 / T17-02 | F027 | M2 |
| `common/popups/JourneyCompletePopup` | 当前内容完成 | T18-01 | F028 | M2 |
| `common/pages/WorldMapPage` | 三园世界地图 | T27-01 | F027 | M2 |
| `gardenN/config/layout.json` | 该园5栋建筑的落位坐标和层级 | T15-01（向阳）、T15-05（云上）；**清风水湾缺少，见美术需求 R-01** | — | M2 |

## 5. `endless` 包

| Prefab | View 类 | 效果图 | 功能 | 阶段 |
|---|---|---|---|---|
| `pages/EndlessPage` | `EndlessPage`：分数面板、最高分、37格棋盘、3块托盘、撤回、收获 | T13-01 底层 / 无尽模式原图 | F030–F032 | M3 |
| `popups/EndlessIntroPopup` | 无尽入口与“继续无尽” | T11-01 | F029 | M3 |
| `popups/EndlessRevivePopup` | 无位置续局 | T12-01 | F033/F055 | M3 |
| `popups/EndlessResultPopup` | 成绩结算 | T14-01 | F034 | M3 |
| `items/ScorePopText` | “太棒了 +120” 飘字（对象池） | 无尽模式原图 | F031 | M3（M6 打磨） |

主动收获确认（T13-01）使用 `ConfirmPopup`。

## 6. `meta` 包（回流系统）

| Prefab | View 类 | 效果图 | 功能 | 阶段 |
|---|---|---|---|---|
| `pages/TasksPage` | 每日三任务、周目标入口、签到入口 | T29-01 | F041 | M4 |
| `items/TaskRow` | 任务行 | T29-01 | F041 | M4 |
| `pages/WeeklyPage` | 每周目标 | T30-01 | F042 | M4 |
| `popups/WeeklyStampPopup` | 每周纪念回看 | T28-01 | F042 | M4 |
| `pages/SigninPage` | 七日礼物 | T32-01 | F043 | M4 |
| `items/SigninDayCell` | 签到格 | T32-01 | F043 | M4 |
| `pages/AchievementPage` | 成就与本机纪录 | T31-01 | F044 | M4 |
| `items/AchievementRow` | 成就行 | T31-01 | F044 | M4 |
| `pages/CompanionListPage` | 三位蜂友 | T20-01 | F035 | M4 |
| `items/CompanionCard` | 蜂友卡 | T20-01 | F035 | M4 |
| `pages/CompanionDetailPage` | 蜂友成长（5/15/30） | T21-01 | F036 | M4 |
| `items/AffinityNode` | 亲密节点 | T21-01 | F036 | M4 |
| `popups/StoryPopup` | 章节剧情与蜂友故事回看 | T19-01 | F037 | M4 |
| `popups/CompanionDecorPopup` | 蜂友专属装饰 | T22-01 | F038 | M4 |
| `pages/WardrobePage` | 外观衣柜 | T23-01 | F038 | M4 |
| `items/OutfitCell` | 衣柜格 | T23-01 | F038 | M4 |
| `pages/AlbumPage` | 旅行相册（3册分页） | T24-01 | F039 | M4 |
| `items/PhotoCell` | 照片格 | T24-01 | F039 | M4 |
| `popups/PhotoDetailPopup` | 照片详情 | T25-01 | F039 | M4 |
| `popups/AlbumRewardPopup` | 相册集齐（三册换图） | T26-01～03 | F040 | M4 |
| `pages/EventPage` | 活动总览 | T33-01 | F045 | M4 |
| `pages/EventDetailPage` | 花园野餐进度 | T34-01 | F045 | M4 |
| `items/MilestoneNode` | 里程碑节点 | T34-01 | F045 | M4 |
| `popups/EventRewardPopup` | 活动奖励 | T35-01 | F045 | M4 |
| `pages/MailboxPage` | 本地信箱 | T48-01 | F050 | M4 |
| `items/MailRow` | 信件行 | T48-01 | F050 | M4 |
| `popups/MailDetailPopup` | 信件详情 | T49-01 | F050 | M4 |
| `popups/SupplyPopup` | 每日补给 | T47-01 | F057 | M4（视频部分 M5） |

## 7. `gm` 包（只进开发构建）

| Prefab | 说明 | 功能 | 阶段 |
|---|---|---|---|
| `GmPanel` | 字典驱动的命令按钮列表，参考 BigHero 的做法 | F060/F061 | M0 起，随功能增加命令 |

## 8. 数量汇总

| 类型 | 数量 |
|---|---|
| 页面（含 LoadingView） | 17 |
| 弹窗（含 ConfirmPopup、GuideOverlay） | 29 |
| 单元 / 公共组件 | 约30 |
| 合计 | 约76个 Prefab |

原工程把同一页的不同状态拆成了多个 Prefab，本计划改为状态节点切换，因此数量略少。
