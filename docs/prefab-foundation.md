# Prefab 与资源基础阶段

本阶段按用户确认的拆分制作 **80 个正式 Prefab、2 个开发用 Prefab**。这是框架与展示结构阶段，不表示玩法、存档、奖励、广告和整套业务已经接入。唯一原型仍为 `prototype/`；临时文件统一为 `tmp/prototype/prefab-foundation/`。本轮生成器只管理自身登记的新资源，不运行旧生成器恢复已删除的旧页面。

## 可执行登记

`tools/prefab-foundation/catalog.mjs` 是 82 项及 73 个原型评审路由的可执行清单。脚本只在工具端读取原型配置，不作为游戏运行时依赖。清单保留原稿全名、Prefab 目标路径、所属模块、分类、建议具体类型的绑定字段、动态图片与文字角色、合并版式和制作状态。

分类为 18 页面、28 独立内容根、1 引导层、23 重复单元、10 公共组件，另有 2 个 GM。`dialog` 是归档分类，不决定尺寸；精选、结算、剧情、设置、帮助、信件与隐私等独立内容维持各自原稿全屏画布，不统一改为小弹窗。真正叠加弹层单独记录基底。

73 个评审入口从当前 `prototype/app.js` 的 `mainPages` 和 `prototype/meta.js` 的 `pages` 解析，分组按 app 的实际合并规则生成，不手抄历史清单。原稿 `runtime.routes` 只用于追溯：真正渲染入口还要核查当前 renderer。

## 原稿与复用边界

- 地图采用 `微信图片_20261019173444_81_187`，不以历史“关卡选择”代替。
- 家园采用 T15 系列。5 个布局／状态保留独立 variant；建筑实体通过主题与等级数据换图，三园裸地形和建筑角色不是通用框架资源。
- 拼图采用 T02／T03／T05，开局采用 T01／T04；普通三块、普通六块、提示状态、限步及七块托盘的版式全部登记，不因共用一个业务 View 丢弃原图。
- 无尽局内使用 T13 的 `z < 85` 底页；T13 原稿的收获确认遮罩与内容属于确认层。T11 是无尽入口，不能用来冒充当前局内版式。
- 下一主题保留 T17-01／02；相册奖励保留 T26-01／02／03；确认、帮助详情和广告状态保留全部来源版式。合并只复用 View 职责，不把不同原稿强行改成同一布局。
- 引导只提取 T51 中提示框、文字、手指、聚光和拖影相关层，挂在真实页面之上，不重复导入整个底页。T51-03 的原稿底图是地图，但原型真实操作基底仍是家园，本清单保留该差异。
- 9 张早期基础配置仍保留在来源清单中；未被当前 renderer 采用的基础全页图不自动变成额外正式页面。

## 目录与所有权

```text
assets/
  scenes/Main.scene
  scripts/
    app/                       启动、导航装配、开发预览入口
    framework/
      core/                    无引擎依赖的能力
      resources/               加载、引用持有、请求身份与释放
      ui/                      View 生命周期、层管理、列表
      components/              通用功能组件
    features/<module>/ui/      页面及重复单元绑定组件
    ui/common/                 业务公共展示组件
    debug/                     GM 与预览代码
  resources/
    boot/                      最小启动资源
    framework/                 通用 Prefab
  bundles/<module>/
    prefabs/{pages,dialogs,items,guide,debug}/
    textures/
    config/
```

模块为 mainline、puzzle、endless、garden、collection、daily、services、common、debug。三园阶段美术可分别放 garden-sunny／garden-water／garden-cloud，避免一个家园 Prefab 序列化引用全部阶段。具体 Bundle 名以本轮资源登记输出为准，不能仅因目录存在宣称构建分包完成。脚本集中存放，不依赖原型或只读 BigHero 的绝对路径。

## 静态引用、动态加载与动态内容

固定背景、面板、按钮底图、标题装饰、固定角色挂点按原稿坐标、尺寸、锚点、层序、裁切、翻转、透明度、九宫格参数导入。固定视觉资源可由 Prefab 直接持有；不是把所有图片都放 `resources` 并在运行时按字符串找节点。

建筑阶段、主题裸地形、伙伴、外观、照片与内容图标按稳定 assetId 选择。建筑为三园 × 五建筑 × 六阶段共 90 个主体，水车独立转子 15 个；建筑主体 Prefab 绑定 Body Sprite、RotorRoot 与 Rotor Sprite；价签及进度由所属家园版式分别绑定，不把全部 105 张图片塞进 Inspector 数组。阶段配置记录主题、建筑、阶段、原稿 assetId、场景挂点、缩放及层序。主体和转子分别管理，转子投影旋转本阶段不实现。

原稿所有真实文字独立为 Label；库存、价格、进度、关号、倒计时、奖励和状态由后续数据接口赋值。静态预览值只是展示夹具，不写入存档或奖励权威。棋盘、拼块与提示轮廓保留可绑定动态容器；核心拼图页已按原稿格点生成异形盘面几何，展示格子与托盘复用 item Prefab，不把参考局面当成已完成玩法。

登记资产应包含原 assetId、原文件路径、源 SHA-256、目标 UUID、尺寸、所属包、派生关系。必要派生必须可重建，已交付成品优先使用。PSD、整张效果图、设计板、审核截图留在来源／审核目录，不进入运行依赖。

页面／scope 持有所加载资源并对称 addRef/decRef；先销毁实例再释放所属资源，禁止 releaseAll。异步完成检查请求身份与销毁状态，隐藏解除订阅，销毁取消任务。GardenAssetStore 的来源校验边界应继续有效，不因新加载器绕过 manifest。

## 绑定与空业务脚本

页面和独立内容根预挂 View，重复项预挂渲染组件。固定引用使用具体类型的 `@property`；Button 的固定事件序列化绑定公开处理方法。行为未接入的方法可以为空，但不得通过长路径查找、扫描名称、缺项自动补节点代替正式绑定。缺必需字段应清晰报错。

长列表必须有 ScrollView、viewport Mask、content、item Prefab 和列表组件，不对同一个 content 同时开启虚拟列表与 Layout。三项每日任务、七格签到等固定少量内容可用 Layout。邮件和隐私正文预挂滚动容器。

模板、已生成页面、已在 Main 中实例化的预览页面以及已接入真实业务的页面要分别统计；不能用同一“已完成”标签覆盖。catalog 的 `foundation-business-pending` 专指本阶段约束，不能当作 Creator 真实导入或美术验收通过。

## 验证记录与剩余边界

本清单已执行工具端导入核对：82 项、80 正式、2 开发，分类 18／28／1／23／10／2；73 个原型路由唯一且均有 Prefab 所属项，源配置前缀全部可解析。此证据仅验证登记，不替代 Creator 导入和实例化。

整体生成器验证、TypeScript、Prefab 引用及资源哈希检查由本轮实施报告记录。真实 Creator 3.8.8 的导入、实例化、页面实际打开、滚动／按钮操作、缺绑定、显示隐藏、加载失败重试、销毁时迟到结果、资源释放及原稿对照必须逐项填实测证据；未运行项目应明确标注未验证。

玩法判定、拖放吸附、花蜜收支、奖励去重、存档、解锁、广告 SDK、排行榜／账号网络能力均未包含在展示骨架范围。GM 只作本地开发入口，不生成生产经济数据。

## 执行与重新生成

### Loading 单页维护调整

本次调整保留人工重做的背景、标题和进度条层级，以 `BaseView` 的既有生命周期管理单页；回归先覆盖进度条/文字绑定、590 像素填充长度、初始进度与无旧状态组件，再去除 Loading 对多状态展示模板的依赖。其他页面继续使用现有生成及状态校验规则。

`LoadingPage.prefab` 和 `LoadingPageView.ts` 改为人工维护，登记为 `maintenance: manual`，不再属于生成文件保护清单。生成器只读取当前正式 Prefab 的实际组件索引、字段、节点数量、画布大小及哈希更新资源登记，不重新生成这两个文件。Prefab 与脚本 `.meta` UUID 保持不变；人工修改后需要同步资源登记并执行类型、绑定和真实 Creator 预览验证。

### 主线地图左右入口组合

`MainlineMapPage.prefab` 和对应 View 同样登记为人工维护。左侧依次为每日签到、排行榜、每日任务、好友；右侧依次为超值礼包、限时活动、新手礼包。红点、文案与 SALE 吊牌归所属入口，组合之间使用现有垂直 Layout。后续单页精简已将地图改为 `BaseView`，只绑定具体类型的 `MainlineMapPresentation`，状态登记为空；保留八个真实关卡挂点、分页及直接引用，移除重复原稿节点和模板包装。生成器读取实际根组件、绑定类型、尺寸及哈希，不再重建地图 Prefab 或 View；自定义组件绑定按脚本 `.meta` 校验。其他页面的生成保护与多状态验证继续保留。最终结构及验证见 [地图单页精简](mainline-page.md)。

在 `Project/` 中执行：

| 命令 | 范围 |
| --- | --- |
| `npm test` | 新基础阶段框架、素材及生成文件保护回归 |
| `npm run audit` | 新清单、UUID、Prefab 字段／事件、资源哈希与引用审核 |
| `npm run typecheck` | 当前 Creator 3.8.8 项目 TypeScript 诊断 |
| `npm run prefab:generate` | 按新登记重复生成自身负责的资源 |
| `npm run prefab:verify-native` | 复用实际 Creator 预览，逐个加载、实例化、启用，检查按钮、资源 scope、列表及两个尺寸截图 |
| `node tools/prefab-foundation/publish-review.mjs` | 只接受完整 PASS 原生报告，再执行测试、类型与静态审核并发布画册 |

`test:legacy` 与 `audit:legacy` 保留旧工具入口，针对重开发前工程，不能作为已清空后新基础阶段的验收基线，也不能用删除旧断言的方式伪造旧业务通过。

生成器登记保护清单内的生成 Prefab／TypeScript 文件，人工维护的 Loading 和主线地图除外；重复执行时先验证已登记文件哈希。人工在 Creator 或编辑器中修改、删除这些生成文件后，生成器拒绝覆盖，需先明确协调人工修改与生成规则。`.meta` 的 UUID 保持稳定，Creator／美术调整的导入选项保留。`Main.scene` 只在首次初始化时创建，之后交给 Creator 保存，不由重复生成覆盖；保留原场景 UUID `18d4953b-98af-4367-aed2-67c183a3faaf`，沿用默认预览启动引用。

## 核心界面链路接入

导航、动态 item、变体字段与生命周期接入见 [界面接入说明](ui-integration.md)；最新题库、分页选关和整块动态显示见 [真实关卡接入](level-prefabs.md)。新增 `npm run ui:verify-native` 复用当前 Creator 预览验证默认启动、真实按钮、覆盖栈、异步取消和资源释放。正式画册增加界面链路验收入口；普通展示页面与真实玩法仍按阶段边界区分。

## 正式对照画册与验收边界

### 编辑器打开报错修复（2026-10-28）

修复 `SourceLayout`／`SerializedView` 的字符串数组声明，改用 Creator `CCString`。Main 场景按 Creator 标准格式将 Scene 放在序列化对象 1，保留原场景资源 UUID，并恢复 Canvas 的独立节点 UUID；原错误文件已备份在临时目录。之前的文件中 Canvas 占用了场景资源 UUID，引擎加载时又给 Scene 设置同一个 UUID，导致编辑器层级树重复和递归栈溢出。运行时预览通过未覆盖编辑器层级树，此前验收存在缺口。

生成器现采用统一场景序列化检查；静态审核与回归覆盖对象顺序、UUID 冲突、层级循环、父子引用及断开节点。实际 Creator 编辑器通过公开消息执行两次 soft-reload／open-scene，并查询完整层级树，Scene、Canvas 及其他节点 UUID 各自唯一，验证期间日志没有新增上述警告或异常。正式证据另存 `prototype/review/cocos-production/prefab-foundation/editor-report.json`，本轮复验截图为同目录 `editor-final.png`。

正式目录固定为 `prototype/review/cocos-production/prefab-foundation/`。发布脚本只复制当前 PASS 报告中的 14 张实屏，连同原生报告、静态审核、测试命令输出、源码 SHA-256 指纹、素材来源和生成文件保护登记。发布前若任一检查失败，保留临时证据并拒绝更新正式画册；不能把失败报告改写为通过。

画册提供 Loading、主线地图、家园、拼图、设置、信件详情的原稿与 390／320 宽 Cocos 实屏三栏对照，以及虚拟列表独立样板。图片来自实际 Creator Canvas 截图，不用原型截图冒充生产工程。

本阶段没有整页像素相似度结论。核心页数值由只读展示数据驱动；地图尚未接入的菜单只显示阶段提示。核心拼图页已有原稿坐标的异形边界、木纹遮罩和格子展示，但高光、阴影与纹理接缝仍有差异。这些缺口随截图公开，不把节点／绑定通过说成全部视觉一致。

<!-- PUBLISHED_VERIFICATION_START -->
发布于 2026-10-28T14:44:06.676Z，原生状态为 `PASS_NATIVE_PREFAB_FOUNDATION`。

- 当前新基线测试 206 项，206 通过，0 失败；TypeScript 与静态审核均退出 0。
- 静态审核：82 个 Prefab、4056 个节点、401 个 Button、50376 处引用、371 张原图及 188 张派生。
- Creator 3.8.8 实际逐一加载并启用 82 个 Prefab，核验字段和事件引用；两个尺寸共 14 张实屏。
- 原生列表：`PASS_NATIVE_LIST`；资源引用所有权：`PASS_NATIVE_RESOURCE_OWNERSHIP`；活动 Main 页脚本错误 0、资源失败 0。
- [正式对照画册](../../prototype/review/cocos-production/prefab-foundation/index.html)、[原生报告](../../prototype/review/cocos-production/prefab-foundation/native-report.json)、[命令验证](../../prototype/review/cocos-production/prefab-foundation/verification.json)。

上述通过只涵盖本阶段框架、展示与绑定；业务及视觉差异仍遵循本节明确边界。
<!-- PUBLISHED_VERIFICATION_END -->

<!-- GENERATED_CATALOG_START -->
## 逐项制作清单

| # | ID | 名称 | 模块 / 分类 | 来源 | 路由 |
| --- | --- | --- | --- | --- | --- |
| 1 | loading | LoadingPage | boot / page | 主图 | loading |
| 2 | mainline-map | MainlineMapPage | mainline / page | 微信图片_20261019173444_81_187 | levels |
| 3 | garden | GardenPage | garden / page | T15-01_家园_五级建设基础<br>T15-02_家园_单栋满级<br>T15-03_家园_升级动画关键帧<br>T15-04_家园_花蜜不足回流<br>T15-05_家园_第三园全部完成 | home, home-max, build-upgrade, build-short, home-finished |
| 4 | puzzle | PuzzlePage | puzzle / page | T02-01_普通异形拼图_三块<br>T02-02_普通异形拼图_六块托盘<br>T03-01_拼图提示轮廓<br>T05-01_限步异形拼图_局内<br>T05-02_限步拼图_七块托盘规格 | puzzle, puzzle-six, puzzle-hint, challenge, challenge-seven |
| 5 | endless-intro | EndlessIntroPage | endless / page | T11-01_无尽玩法入口 | endless-intro |
| 6 | endless | EndlessPage | endless / page | T13-01_无尽主动收获确认 | endless |
| 7 | world-map | WorldMapPage | garden / page | T27-01_三园世界地图 | world-map |
| 8 | companion-list | CompanionListPage | collection / page | T20-01_三位蜂友列表 | bee-home |
| 9 | companion-detail | CompanionDetailPage | collection / page | T21-01_蜂友成长 | bee-detail |
| 10 | wardrobe | WardrobePage | collection / page | T23-01_外观衣柜 | wardrobe |
| 11 | album | AlbumPage | collection / page | T24-01_旅行相册 | album |
| 12 | daily-tasks | DailyTasksPage | daily / page | T29-01_三任务与周签到入口 | tasks |
| 13 | weekly-tasks | WeeklyTasksPage | daily / page | T30-01_每周目标 | weekly-tasks |
| 14 | achievements | AchievementsPage | daily / page | T31-01_成就与本机纪录 | achievements |
| 15 | signin | SigninPage | daily / page | T32-01_七日礼物 | signin |
| 16 | events | EventsPage | daily / page | T33-01_主题活动总览 | events |
| 17 | event-detail | EventDetailPage | daily / page | T34-01_花园野餐进度 | event-detail |
| 18 | mailbox | MailboxPage | services / page | T48-01_本地信箱 | mailbox |
| 19 | featured | FeaturedView | mainline / dialog | T10-01_每日精选复玩 | featured |
| 20 | puzzle-preview | PuzzlePreviewView | puzzle / dialog | T01-01_普通拼图开局<br>T04-01_限步关开局 | level-preview, challenge-preview |
| 21 | puzzle-resume | PuzzleResumeView | mainline / dialog | T09-01_未完成拼图续玩 | resume-puzzle |
| 22 | puzzle-result | PuzzleResultView | puzzle / dialog | T06-01_普通拼图成功 | puzzle-win |
| 23 | challenge-result | ChallengeResultView | puzzle / dialog | T07-01_限步星级结算 | challenge-win |
| 24 | challenge-fail | ChallengeFailView | puzzle / dialog | T08-01_限步失败救局 | challenge-fail |
| 25 | endless-revive | EndlessReviveView | endless / dialog | T12-01_无尽无位置续局 | endless-revive |
| 26 | endless-result | EndlessResultView | endless / dialog | T14-01_无尽成绩结算 | endless-result |
| 27 | chapter-reward | ChapterRewardView | garden / dialog | T16-01_整园完工奖励 | chapter-complete |
| 28 | chapter-next | ChapterNextView | garden / dialog | T17-01_下一主题_清风水湾<br>T17-02_下一主题_云上蜂谷 | chapter-next |
| 29 | journey-complete | JourneyCompleteView | garden / dialog | T18-01_当前内容完成 | journey-complete |
| 30 | story | StoryView | collection / dialog | T19-01_蜂友章节剧情与回看 | story, bee-story |
| 31 | companion-decor | CompanionDecorView | collection / dialog | T22-01_蜂友专属装饰 | bee-decor |
| 32 | photo-detail | PhotoDetailView | collection / dialog | T25-01_照片详情 | album-detail |
| 33 | album-reward | AlbumRewardView | collection / dialog | T26-01_相册集齐_第一册<br>T26-02_相册集齐_第二册<br>T26-03_相册集齐_第三册 | album-reward, album-water-reward, album-cloud-reward |
| 34 | weekly-stamp | WeeklyStampView | daily / dialog | T28-01_每周纪念回看 | weekly-stamp |
| 35 | event-reward | EventRewardView | daily / dialog | T35-01_活动奖励 | event-reward |
| 36 | pause | PauseView | services / dialog | T36-01_局内暂停 | pause |
| 37 | confirmation | ConfirmationView | services / dialog | T37-01_退出本局确认<br>T38-01_重新开始确认<br>T13-01_无尽主动收获确认 | exit-confirm, restart-confirm, endless-confirm |
| 38 | settings | SettingsView | services / dialog | T39-01_声音与易用设置 | settings |
| 39 | help-index | HelpIndexView | services / dialog | T40-01_图示帮助_目录 | help |
| 40 | help-detail | HelpDetailView | services / dialog | T40-02_图示帮助_拖放拼图<br>T40-03_图示帮助_三轴消除<br>T40-04_图示帮助_五级建设 | puzzle-help, endless-help, build-help |
| 41 | hint-empty | HintEmptyView | services / dialog | T41-01_提示不足 | hint-empty |
| 42 | ad-status | AdStatusView | services / dialog | T42-01_激励广告加载<br>T43-01_广告暂无可用<br>T44-01_广告奖励确认中<br>T45-01_视频冷却倒计时 | ad-loading, ad-unavailable, ad-pending, ad-cooldown |
| 43 | local-save | LocalSaveView | services / dialog | T46-01_本地存档 | local-save |
| 44 | daily-supply | DailySupplyView | services / dialog | T47-01_每日补给 | supply |
| 45 | mail-detail | MailDetailView | services / dialog | T49-01_信件详情 | mail-detail |
| 46 | privacy | PrivacyView | services / dialog | T50-01_隐私与数据说明 | privacy |
| 47 | guide-overlay | GuideOverlay | common / guide | T51-01_引导_01主界面进入建设<br>T51-02_引导_02首次建造<br>T51-03_引导_03返回地图闯关<br>T51-04_引导_04整块拖放<br>T51-05_引导_05成功收获回家<br>T51-06_引导_06再次升级<br>T51-07_引导_07自由探索<br>T51-08_引导_08无尽首次消除 | guide-garden-entry, guide-home, guide-menu, guide-puzzle, guide-return, guide-upgrade, guide-complete, guide-endless |
| 48 | level-node | LevelNodeItem | mainline / item | 微信图片_20261019173444_81_187 | 嵌入父级 |
| 49 | featured-item | FeaturedItem | mainline / item | T10-01_每日精选复玩 | 嵌入父级 |
| 50 | building | BuildingItem | garden / item | T15-01_家园_五级建设基础 | 嵌入父级 |
| 51 | building-price | BuildingPriceItem | garden / item | T15-01_家园_五级建设基础 | 嵌入父级 |
| 52 | scene-companion | SceneCompanionItem | garden / item | T15-01_家园_五级建设基础 | 嵌入父级 |
| 53 | companion-card | CompanionCardItem | collection / item | T20-01_三位蜂友列表 | 嵌入父级 |
| 54 | affinity-node | AffinityNodeItem | collection / item | T21-01_蜂友成长 | 嵌入父级 |
| 55 | outfit-item | OutfitItem | collection / item | T23-01_外观衣柜 | 嵌入父级 |
| 56 | photo-item | PhotoItem | collection / item | T24-01_旅行相册 | 嵌入父级 |
| 57 | theme-card | ThemeCardItem | garden / item | T27-01_三园世界地图 | 嵌入父级 |
| 58 | task-item | TaskItem | daily / item | T29-01_三任务与周签到入口 | 嵌入父级 |
| 59 | achievement-item | AchievementItem | daily / item | T31-01_成就与本机纪录 | 嵌入父级 |
| 60 | signin-cell | SigninCellItem | daily / item | T32-01_七日礼物 | 嵌入父级 |
| 61 | event-card | EventCardItem | daily / item | T33-01_主题活动总览 | 嵌入父级 |
| 62 | milestone-item | MilestoneItem | daily / item | T34-01_花园野餐进度 | 嵌入父级 |
| 63 | mail-item | MailItem | services / item | T48-01_本地信箱 | 嵌入父级 |
| 64 | tray-slot | TraySlotItem | puzzle / item | T02-01_普通异形拼图_三块 | 嵌入父级 |
| 65 | puzzle-piece | PuzzlePieceItem | puzzle / item | T02-01_普通异形拼图_三块 | 嵌入父级 |
| 66 | hex-cell | HexCellItem | puzzle / item | T02-01_普通异形拼图_三块 | 嵌入父级 |
| 67 | puzzle-tutorial | PuzzleTutorialItem | services / item | T40-02_图示帮助_拖放拼图 | 嵌入父级 |
| 68 | endless-tutorial | EndlessTutorialItem | services / item | T40-03_图示帮助_三轴消除 | 嵌入父级 |
| 69 | garden-tutorial | GardenTutorialItem | services / item | T40-04_图示帮助_五级建设 | 嵌入父级 |
| 70 | reward-item | RewardItem | common / item | T06-01_普通拼图成功 | 嵌入父级 |
| 71 | button | CommonButton | common / common | T01-01_普通拼图开局 | 嵌入父级 |
| 72 | icon-button | IconButton | common / common | T02-01_普通异形拼图_三块 | 嵌入父级 |
| 73 | resource-hud | ResourceHUD | common / common | T15-01_家园_五级建设基础 | 嵌入父级 |
| 74 | resource-counter | ResourceCounter | common / common | T15-01_家园_五级建设基础 | 嵌入父级 |
| 75 | title-bar | TitleBar | common / common | T39-01_声音与易用设置 | 嵌入父级 |
| 76 | dialog-frame | DialogFrame | common / common | T36-01_局内暂停 | 嵌入父级 |
| 77 | progress | ProgressDisplay | common / common | 主图 | 嵌入父级 |
| 78 | setting-toggle | SettingToggle | common / common | T39-01_声音与易用设置 | 嵌入父级 |
| 79 | virtual-list | VirtualList | common / common | 公共结构，无独立原稿 | 嵌入父级 |
| 80 | toast | ToastView | common / common | 公共结构，无独立原稿 | 嵌入父级 |
| 81 | gm-panel | GMPanel | debug / debug | 公共结构，无独立原稿 | 嵌入父级 |
| 82 | gm-command | GMCommandItem | debug / debug | 公共结构，无独立原稿 | 嵌入父级 |

## 73 个评审状态归属

| Route | 标题 | Prefab ID | 来源 / 基底 |
| --- | --- | --- | --- |
| loading | 启动 Loading | loading | 主图 |
| home | 家园主大厅 | garden | T15-01_家园_五级建设基础 |
| levels | 主界面 · 拼图地图 | mainline-map | 微信图片_20261019173444_81_187 |
| featured | 每日精选复玩 | featured | T10-01_每日精选复玩 |
| level-preview | 拼图开局 | puzzle-preview | T01-01_普通拼图开局 |
| puzzle | 真实拼图局内 | puzzle | T02-01_普通异形拼图_三块 |
| puzzle-help | 拖放动画教学 | help-detail | T40-02_图示帮助_拖放拼图 |
| puzzle-hint | 提示轮廓状态 | puzzle | T03-01_拼图提示轮廓 |
| puzzle-win | 拼图成功收获 | puzzle-result | T06-01_普通拼图成功 |
| challenge-preview | 限步挑战开局 | puzzle-preview | T04-01_限步关开局 |
| challenge | 限步局内 | puzzle | T05-01_限步异形拼图_局内 |
| challenge-win | 挑战星级结算 | challenge-result | T07-01_限步星级结算 |
| challenge-fail | 限步失败救局 | challenge-fail | T08-01_限步失败救局；底页 puzzle |
| endless-intro | 无尽玩法入口 | endless-intro | T11-01_无尽玩法入口 |
| endless | 37格无尽局内 | endless | T13-01_无尽主动收获确认 |
| endless-help | 满线消除教学 | help-detail | T40-03_图示帮助_三轴消除 |
| endless-revive | 无位置续局 | endless-revive | T12-01_无尽无位置续局；底页 endless |
| endless-confirm | 主动收获确认 | confirmation | T13-01_无尽主动收获确认；底页 endless |
| endless-result | 无尽成绩结算 | endless-result | T14-01_无尽成绩结算 |
| home-max | 建筑满级状态 | garden | T15-02_家园_单栋满级 |
| build-upgrade | 场景升级动画 | garden | T15-03_家园_升级动画关键帧 |
| build-short | 资源不足回流 | garden | T15-04_家园_花蜜不足回流 |
| chapter-complete | 整园完工奖励 | chapter-reward | T16-01_整园完工奖励 |
| chapter-next | 下一主题预览 | chapter-next | T17-01_下一主题_清风水湾 |
| journey-complete | 当前内容完成 | journey-complete | T18-01_当前内容完成 |
| story | 蜂友章节剧情 | story | T19-01_蜂友章节剧情与回看 |
| pause | 局内暂停 | pause | T36-01_局内暂停 |
| exit-confirm | 退出本局确认 | confirmation | T37-01_退出本局确认 |
| restart-confirm | 重新开始确认 | confirmation | T38-01_重新开始确认 |
| settings | 声音与易用设置 | settings | T39-01_声音与易用设置 |
| help | 图示帮助中心 | help-index | T40-01_图示帮助_目录 |
| hint-empty | 提示不足 | hint-empty | T41-01_提示不足 |
| ad-loading | 激励广告加载 | ad-status | T42-01_激励广告加载 |
| ad-unavailable | 广告暂无可用 | ad-status | T43-01_广告暂无可用 |
| ad-pending | 奖励确认中 | ad-status | T44-01_广告奖励确认中 |
| local-save | 本地存档恢复 | local-save | T46-01_本地存档 |
| challenge-seven | 七拼块挑战托盘 | puzzle | T05-02_限步拼图_七块托盘规格 |
| puzzle-six | 六拼块完整托盘 | puzzle | T02-02_普通异形拼图_六块托盘 |
| ad-cooldown | 视频冷却倒计时 | ad-status | T45-01_视频冷却倒计时 |
| build-help | 建造图示帮助 | help-detail | T40-04_图示帮助_五级建设 |
| guide-garden-entry | 新手 · 进入花园 | guide-overlay | T51-01_引导_01主界面进入建设；底页 mainline-map |
| guide-home | 新手 · 点建筑 | guide-overlay | T51-02_引导_02首次建造；底页 garden |
| guide-menu | 新手 · 前往主线 | guide-overlay | T51-03_引导_03返回地图闯关；底页 garden |
| guide-puzzle | 新手 · 拖动拼块 | guide-overlay | T51-04_引导_04整块拖放；底页 puzzle |
| guide-return | 新手 · 收获回家 | guide-overlay | T51-05_引导_05成功收获回家；底页 puzzle-result |
| guide-upgrade | 新手 · 再次升级 | guide-overlay | T51-06_引导_06再次升级；底页 garden |
| guide-complete | 新手 · 自由游玩 | guide-overlay | T51-07_引导_07自由探索；底页 garden |
| guide-endless | 无尽 · 首次轻引导 | guide-overlay | T51-08_引导_08无尽首次消除；底页 endless |
| resume-puzzle | 未完成关卡续玩 | puzzle-resume | T09-01_未完成拼图续玩 |
| home-finished | 满园后的家园 | garden | T15-05_家园_第三园全部完成 |
| bee-story | 蜂友故事回看 | story | T19-01_蜂友章节剧情与回看 |
| bee-decor | 蜂友专属装饰 | companion-decor | T22-01_蜂友专属装饰 |
| album-water-reward | 第二册专属奖励 | album-reward | T26-02_相册集齐_第二册 |
| album-cloud-reward | 第三册专属奖励 | album-reward | T26-03_相册集齐_第三册 |
| weekly-stamp | 每周纪念回看 | weekly-stamp | T28-01_每周纪念回看 |
| world-map | 世界地图 | world-map | T27-01_三园世界地图 |
| bee-home | 蜂友 | companion-list | T20-01_三位蜂友列表 |
| bee-detail | 蜂友成长 | companion-detail | T21-01_蜂友成长 |
| wardrobe | 外观 | wardrobe | T23-01_外观衣柜 |
| album | 旅行相册 | album | T24-01_旅行相册 |
| album-detail | 照片详情 | photo-detail | T25-01_照片详情 |
| album-reward | 相册集齐 | album-reward | T26-01_相册集齐_第一册 |
| tasks | 每日任务 | daily-tasks | T29-01_三任务与周签到入口 |
| weekly-tasks | 每周目标 | weekly-tasks | T30-01_每周目标 |
| achievements | 成就 | achievements | T31-01_成就与本机纪录 |
| signin | 七日礼物 | signin | T32-01_七日礼物 |
| events | 推荐活动 | events | T33-01_主题活动总览 |
| event-detail | 花园野餐 | event-detail | T34-01_花园野餐进度 |
| event-reward | 活动奖励 | event-reward | T35-01_活动奖励 |
| supply | 每日补给 | daily-supply | T47-01_每日补给 |
| mailbox | 信箱 | mailbox | T48-01_本地信箱 |
| mail-detail | 信件 | mail-detail | T49-01_信件详情 |
| privacy | 隐私说明 | privacy | T50-01_隐私与数据说明 |
<!-- GENERATED_CATALOG_END -->
