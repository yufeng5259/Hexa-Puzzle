# Hexa-Puzzle（Cocos Creator 3.8.8）现有代码与资源分析

> 分析对象：`/e/temp/gm/Hexa-Puzzle`（只读分析，未改动任何文件）
> 目的：判断重建时哪些代码/资源值得**复制复用**，哪些应**丢弃**。不延续其原有开发计划。
> 题材：蜜蜂花园 + 六角异形拼图（原型名 BeeLevels / Block），竖屏，设计分辨率 **853×1844**。

---

## 0. 一句话结论

- **真正有价值的只有三样**：① `level-catalog.json`（110 题、96 关主线映射，可直接用）；② 纯逻辑层 `HexCoordinates / LevelCatalog / PuzzleModel / PuzzleSession / PuzzleLayout`（约 450 行，零引擎依赖，质量高）；③ `PuzzleController` 的拖放/吸附/命中算法和 `SourceGeometry` 的六角并集描边算法（需要改写适配）。
- **大部分代码是空壳**：114 个 .ts 共约 4700 行，其中 ~75 个 View 是**生成器自动产出的 16–26 行“只有 @property + requireBinding”的绑定壳**，没有业务。
- **82 个 Prefab 是 Node 脚本从原型 JSON 配置“逐图层”生成的**，节点量巨大（PuzzlePage 725 节点、1.75MB），带 SHA-256 所有权保护（在 Creator 里手改后再运行生成器会直接报错拒绝）。且生成依赖的 `../prototype/` **目录在当前机器上不存在**，生成器已无法再运行。→ Prefab 整体丢弃，按新框架手工重做。
- **贴图未做任何优化**：562 张 PNG / 145MB，559 张 `packable:false`，0 个自动图集；每个拼块小格用 1147×1003 的整张“母件”图缩放显示。微信小游戏不可接受，必须重新出图/打图集。

---

## 1. 已实现的架构

### 1.1 启动（Boot）

```
Main.scene
└─ Canvas (FoundationBoot + ViewHost 组件)
   ├─ Camera
   ├─ Pages      ← ViewHost.pageLayer
   ├─ Dialogs    ← ViewHost.dialogLayer
   ├─ Guides     ← ViewHost.guideLayer
   └─ PreviewNotice (Label + Button，DEBUG 提示/结算重试入口)
```

`app/FoundationBoot.ts`（376 行，组合根 / composition root）`start()` 流程：

1. `view.setDesignResolutionSize(853, 1844, SHOW_ALL)`（letterbox），并对每个页面根节点按可见尺寸 `fitNode` 整体缩放。
2. 从 Inspector 绑定的 `loadingPrefab`（`resources/boot/LoadingPage.prefab`）实例化 Loading 页。
3. `resources.load('framework/config/source-art-manifest')`（1.9MB JSON）+ `prefab-registry`（208KB JSON）。
4. `new GardenAssetStore(art, registry)` → 建 scope → 加载 `data:level-catalog`（puzzle 包内 JsonAsset）→ `new LevelCatalog(json)`（严格校验）。
5. 建 `PuzzleAttemptStore`（进程内会话缓存，无持久化）和 `UIFlow`（导航），`replacePage('mainline-map')`。

`FoundationBoot.prepare()` 是唯一的“挂载工厂”：按 id 查 registry → 建 scope → `scope.load('prefab:'+id)` → `ViewHost.open()` → 若是 `SerializedView` 则 `selectState(state)` 选版式 → 若是拼图页则找 `PuzzleBoardPresentation.present(level)`、绑定 `PuzzleController` 与 `PuzzleSession` → 注入 Canvas 相机用于触摸坐标反投影。**大量 if (id === 'puzzle') 之类的硬编码分支塞在组合根里**，扩展性差。

### 1.2 页面 / 弹窗导航（UIFlow）

`app/UIFlow.ts`（284 行，纯 TS，无引擎依赖）：

- 模型：**一个 page + overlay 栈**（`dialog`/`guide` 两层）。
- `replacePage(id,state,…)`：先准备新页（异步加载），成功后 `show` 新页、关闭全部 overlay、关闭旧页；失败保留旧页并提示。
- `openOverlay()`：新层 show 后隐藏下层；`closeOverlay()` 恢复下层。
- **请求身份（revision）+ cancel 清理**：连点/快速切换时旧请求的迟到结果被丢弃并释放资源——这是本工程写得最扎实的部分之一。
- `handle(actionId)`：一个巨大的字符串 switch（`select:mainline`、`map:next`、`open:pause`、`confirm:restart`、`play:next`、`help:puzzle`…），**导航、业务和演示逻辑混在一起**，96/12 等常量写死。
- 按钮事件：Prefab 中 `cc.Button.clickEvents → BaseView.onAction(event, customEventData=actionId)` → `node.emit('view-action')` → FoundationBoot 订阅 → `flow.handle()`。actionId 来自 `tools/prefab-foundation/core-actions.json`（1049 行），由生成器写入每个按钮的 `customEventData`。

### 1.3 View 基类与生命周期

- `framework/ui/BaseView.ts`：`validateBindings()`（缺绑定即抛错）、`show/hide/close`、`attachResourceScope`、`onDestroy` 中**延迟到 `EVENT_AFTER_UPDATE` 才释放 scope**（等引擎销毁完节点再 decRef）。
- `framework/core/ViewLifetime.ts`：可见期 cleanup、请求身份（纯 TS）。
- `framework/ui/ViewHost.ts`：只用场景里已序列化的三层节点，`open(prefab, layer, scope)` 实例化并登记。
- `ui/common/SerializedView.ts`：一个 Prefab 里放多个“版式根”（stateRoots/stateIds），按 state 只激活一个。例如 PuzzlePage 内含 T02-01/T02-02/T03-01/T05-01/T05-02 **5 套完整版式**，全部同时实例化，只显示一套。
- `framework/components/Binding.ts`：`requireBinding(owner, field, value)`——简单但好用。
- `framework/components/UIAction.ts`：按钮 actionId 组件（基本未被使用）。
- `framework/ui/VirtualList.ts` + `VirtualListItem.ts` + `core/VirtualWindow.ts`：固定行高单轴虚拟列表，带对象池；`listWindow()` 纯函数。

### 1.4 资源仓库（GardenAssetStore）

层次：`GardenAssetStore` → `ResourceLoader` → `ResourcePool` → `ResourceScope`/`OwnedResourceScope`。

- `GardenAssetStore`（121 行）：读取 `source-art-manifest.json`（371 原图 + 188 派生图，每条含 id/uuid/spriteFrameUuid/bundle/resourcePath/size/sourceSha256…）和 `prefab-registry.json`，**校验 UUID 格式、路径与 bundle 一致性、派生图来源哈希**，然后把每个资源登记为 `{id, bundle, path, type, uuid}`。白名单 bundle 名写死在 `BUNDLES` 集合；所有非 common 包自动依赖 `common`。
- `ResourceLoader`：按 id 找登记，先 `loadBundle`（含依赖、去重、失败可重试），再 `bundle.load(path, type)`，**并比较 `asset._uuid === record.uuid`** 防止错载。
- `ResourcePool`：同 key 只发一次原生加载；每个订阅 scope 持有一份 `addRef`，取消时 `decRef`；迟到结果也能正确释放。
- `ResourceScope`：一个页面一个 scope，`release()` 一次性归还全部引用。

评价：引用计数与迟到请求处理**设计正确**，可作为新框架资源层的参考；但“必须先有 1.9MB 的 manifest JSON 才能按字符串 id 取图”的做法过重，且与生成器/原型哈希强耦合——**ResourcePool/Scope 的思想可复用，GardenAssetStore 本身丢弃**。

### 1.5 Bundle 布局

| Bundle | 内容 | 体积 |
|---|---|---|
| `resources/boot` | LoadingPage.prefab + 10 张启动图（bj.png 3.2MB） | — |
| `resources/framework` | 11 个通用 Prefab（CommonButton、DialogFrame、TitleBar、Toast、VirtualList…）+ config（manifest/registry） | resources 合计 11MB |
| `common`（priority 6） | 137+154 张贴图（含拼块母件、木纹、凹槽、大量 853×1844 全屏图）、GuideOverlay、RewardItem | **81MB** |
| `mainline` | MainlineMapPage、FeaturedView、PuzzleResumeView、LevelNodeItem | 11MB |
| `puzzle` | PuzzlePage、4 个结算/开局弹窗、HexCellItem/PuzzlePieceItem/TraySlotItem、`config/level-catalog.json` | 4.7MB |
| `endless` | EndlessIntroPage、EndlessPage、复活/结算弹窗（**只有界面壳**） | 1.8MB |
| `garden` / `garden-sunny` / `garden-water` / `garden-cloud` | 家园页 + 三套园区建筑阶段图 | 3.5 / 14 / 9.2 / 14MB |
| `collection` / `daily` / `services` / `debug` | 蜂友、相册、任务、签到、活动、设置、帮助、信箱、隐私、广告状态、GM | 3.2 / 2.0 / 3.0MB / 32K |

`settings/v2/packages/builder.json`：微信小游戏下 bundle `compressionType: subpackage`、非远程。目录结构（按功能模块分包、三园分包）**思路可借鉴**，但当前体积远超微信小游戏包体限制（主包 4MB、全部分包合计约 30MB，超出部分只能走远程 CDN）。

### 1.6 Prefab 如何绑定脚本

- 每个 Prefab 根节点挂一个由生成器同时生成的 `XxxView extends BaseView/SerializedView` 脚本，字段全部是 `@property(Label|Button|Sprite|Prefab|ScrollView|Mask|Node)`，`validateBindings()` 里逐个 `requireBinding`。
- 生成器在写 Prefab JSON 时，直接把组件字段写成 `{__id__: n}` 引用（同 Prefab 内节点/组件）或 `{__uuid__, __expectedType__}`（外部 Prefab/SpriteFrame）。脚本组件类型用脚本 .meta 里的 UUID 压缩成 Cocos 的 23 位 classId（`builder.mjs: scriptType()`）。
- 业务逻辑放在**生成器不管理的**另一批组件（`PuzzleBoardPresentation`、`PuzzleController`、`CorePresentation`、`PresentationItem`、`PlayStatusPresentation`、`MainlineMapPresentation`），同样通过生成器在 Prefab 里预挂并绑定字段。
- 动态内容用 `CorePresentation`（挂点数组 + item Prefab 数组 + JSON 字符串 `itemData`/`previewData`）+ `PresentationItem`（body/rotor/accents Sprite + labels/labelKeys + bars/barKeys，按 assetId 换图、按 box 改位置尺寸）。即**用字符串 JSON + 字符串 key 驱动展示**，Inspector 里不可读、不可调。

---

## 2. 核心玩法实现

### 2.1 六角坐标几何

- 原题数据是 **odd-q 偏移坐标（tx, ty）**，导出时转为 **axial（q, r）**：`q = tx, r = ty - floor(tx/2)`（`HexCoordinates.offsetToAxial`）。
- 显示为 **flat-top（平顶）六角**，Cocos y 轴向上（`PuzzleLayout.ts`）：
  - `axialPoint(q,r,R) = { x: 1.5R·q, y: √3R·(r + q/2) }`
  - `axialFromPoint` + **cube rounding**（`nearestAxial`）做像素→格子吸附，负坐标对称处理正确。
  - `insideHex(point,R)`：精确六边形包含测试（不是矩形）。
  - `centeredCells / fitCells`：求包围盒并按容器尺寸算统一半径；`fitTray`：托盘 1–3 块一行、4–6 块 3 列 2 行、7 块 4 列 2 行，**所有拼块共用一个半径**保持比例。
- `SourceGeometry.ts`（187 行）：对格子并集求**边界环**（整数顶点坐标共享边抵消，支持内孔和不连通），用 `cc.Graphics` 画木底（作 GRAPHICS_STENCIL Mask，内铺 TILED 木纹 Sprite）、三层描边木框、阴影。算法好，但每关运行时 Graphics + Mask 重绘，draw call 不友好。

### 2.2 拼图块（Pieces）

- 数据：每块 `cells`（以第 0 格为原点的局部 axial 坐标）+ `targetCells`（原答案位置）+ `textureName`（12 种名，实际映射到 **5 张颜色母件**：金/蓝/…，`textureAssetIds` JSON 写在 PuzzlePage Prefab 上）。
- **只平移、不旋转、不翻转**。最多 7 格/块，每关 3–7 块。
- 显示：`PuzzlePiecePresentation` 一块 = 一个 PuzzlePieceItem Prefab 实例，内部每格实例化一个 HexCellItem（一个 Sprite 节点）。即 7 块 × 6 格 ≈ 40 个 Sprite 节点，每个 Sprite 用 1147×1003 母件贴图缩到 ~50px。
- 棋盘格：每个目标格/障碍格各一个 HexCellItem（凹槽图 124×117，障碍格用 `grayscale` 灰度）。

### 2.3 拖放（PuzzleController，214 行）

- 同时在页面根节点**捕获阶段**监听 TOUCH_* 和全局 `input` 监听（因为 3.8 UI 事件会吞掉全局 input），单指（pointerId 锁定）。
- 拾取：倒序遍历拼块，用 `containsLocal()`（逐格 `insideHex`）精确命中，不是矩形。记录抓取点相对块中心的偏移（以半径为单位，便于托盘缩略 → 棋盘尺寸）。
- 移动：把块 reparent 到 `dragRoot`，按棋盘半径/托盘半径比例缩放；`nearestAxial()` 求候选平移，`session.canPlace()` 判定合法，用 `Graphics` 画绿/红六角候选轮廓。
- 松手：棋盘矩形外松手且该块已在盘上 → 取回；合法 → `session.place()`；否则回原位。触摸取消/切后台/resize/弹窗 → 撤销拖动。
- 坐标：用注入的 Canvas 相机 `screenToWorld` 反投影，解决相机中心与设计中心不一致的偏移。
- 质量：逻辑周全；但每帧 `drawCandidate` 都 `new Color`、`convertToWorldSpaceAR` 逐顶点换算，可优化；与 `PuzzleBoardPresentation` 紧耦合。

### 2.4 规则与胜负

- `PuzzleModel`（64 行，纯 TS）：`canPlace(pieceId, translation)` = 每格平移后 ∈ 目标集 && ∉ 障碍 && 不与其他已放块重叠。**不要求放到原答案位置**，任何能铺满的解都算赢。`completed` = 已占格集合 == 目标格集合。
- `PuzzleSession`（97 行）：状态 `active/completed/failed`；成功放置或移动计 1 步，取回已放块也计 1 步；**最后一步先判胜再判限步失败**；限步关（challenge）`moves >= moveLimit` 判负；快照深冻结 + 订阅。
- `PuzzleAttemptStore`：进程内按 levelId 保留会话（切页面回来可续），重开/重试才新建；**无持久化存档**。

### 2.5 无尽模式

**未实现**。只有 `EndlessIntroPageView`/`EndlessPageView`/`EndlessReviveView`/`EndlessResultView` 4 个绑定壳和 Prefab。策划文档 `docs/策划/功能/F030_37格无尽发牌放置与三轴消除.md` 描述为“37 格六角盘（半径 3）发牌放置 + 三轴整线消除 + 分数连击 + 撤回 + 收获花蜜”，固定前两局种子 20261016/20261017。没有任何可复用代码。

### 2.6 其他业务

家园建设、蜂友、相册、任务、签到、活动、信箱、设置、广告、存档——**全部只有界面壳，无业务逻辑**（策划 65 项中仅 6 项基础 + 9 项部分实现）。

---

## 3. 模块清单与复用结论

质量：A=高质量可直接用；B=思路/算法好但需改写；C=空壳或强耦合；D=无价值。

| 模块 / 目录 | 作用 | 质量 | 结论 | 理由 |
|---|---|---|---|---|
| `bundles/puzzle/config/level-catalog.json` | 110 题 + 96 主线映射 | A | **原样复用** | 数据完整、经严格校验，见第 4 节 |
| `features/puzzle/data/HexCoordinates.ts` | offset→axial、主线编号映射 | A | **原样复用** | 14 行纯函数 |
| `features/puzzle/data/LevelDefinition.ts` | 关卡类型定义 | A | **原样复用** | 纯接口 |
| `features/puzzle/data/LevelCatalog.ts` | 题库严格校验 + 冻结 + 索引 | A- | **复用，小改** | 写死 110/96/80/30、texture 名正则、sources 路径，改成可配置即可 |
| `features/puzzle/model/PuzzleModel.ts` | 占格/合法性/完成判定 | A | **原样复用** | 纯 TS、无引擎依赖 |
| `features/puzzle/session/PuzzleSession.ts` | 步数、胜负、取回、快照 | A | **原样复用**（或按新框架事件机制改订阅） | 规则清晰、有回归测试 |
| `features/puzzle/presentation/PuzzleLayout.ts` | 六角像素换算、cube rounding、托盘排布 | A | **原样复用** | 纯数学 |
| `features/presentation/SourceGeometry.ts` | 六角并集边界、木框/阴影 Graphics 绘制 | B | **复用算法（sourceBoundary/loops）**，渲染方式改写 | Graphics+Stencil Mask 每关重画，draw call 高；建议改为烘焙 RenderTexture 或预制分块 Sprite |
| `features/puzzle/controller/PuzzleController.ts` | 触摸拖放、吸附、候选轮廓 | B+ | **复用并适配** | 拖放/取消/相机反投影逻辑可直接借；需解耦 PuzzleBoardPresentation、改用新框架输入与事件 |
| `features/puzzle/presentation/PuzzleBoardPresentation.ts` | 棋盘/托盘实例化与快照投影 | B- | **参考后重写** | 依赖 fixtureNodes、textureAssetIds JSON 字符串、SourceGeometry、PresentationItem；结构不适合新 Prefab |
| `features/puzzle/presentation/PuzzlePiecePresentation.ts` | 单块显示 + 精确命中 | B | **复用 containsLocal 逻辑**，其余重写 | 每格一节点一大图，性能差 |
| `features/puzzle/presentation/PlayStatusPresentation.ts` | 文字槽（“未发放奖励”等占位文案） | D | 丢弃 | 全是阶段性提示文案 |
| `app/PuzzleAttemptStore.ts` | 进程内续局 | B | 可借思路，按新存档重写 | 41 行 |
| `app/UIFlow.ts` | 页面+弹窗栈导航、请求身份 | B | **丢弃，以 bighero 框架为准**；可参考其“准备成功才替换 + 迟到结果取消” | handle() 大 switch 混业务，常量写死 |
| `app/FoundationBoot.ts` | 组合根 | C | 丢弃 | 硬编码 id 分支、DEBUG 画廊、预览提示逻辑 |
| `framework/resources/*`、`framework/core/ResourcePool.ts` | 引用计数资源池/作用域 | A- | **可复用**（若 bighero 框架没有等价物）或作为参考 | 迟到结果 decRef、同 key 去重，正确且有测试 |
| `features/garden/resources/GardenAssetStore.ts` | manifest 校验 + 登记 | C | 丢弃 | 依赖 1.9MB manifest 与生成器哈希体系 |
| `framework/ui/BaseView.ts`、`ViewHost.ts`、`core/ViewLifetime.ts` | View 生命周期/层 | B | 以 bighero 框架为准，丢弃 | 与新框架重叠 |
| `framework/ui/VirtualList.ts`、`VirtualListItem.ts`、`core/VirtualWindow.ts` | 虚拟列表 | B | 若新框架无列表组件可复用 | 固定行高、单轴，够用 |
| `framework/components/Binding.ts` | requireBinding | A | 可复用 | 8 行 |
| `framework/components/UIAction.ts` | 按钮 actionId | C | 丢弃 | 基本未使用 |
| `features/presentation/CorePresentation.ts`、`PresentationItem.ts`、`PresentationGroup.ts` | JSON 字符串驱动的通用展示 | C | 丢弃 | 字符串 key/JSON 不可维护，为“适配生成 Prefab”而存在 |
| `ui/common/SerializedView.ts` | 多版式切换 | C | 丢弃 | 导致一个 Prefab 含多套完整 UI |
| `ui/common/*View.ts`（CommonButton、DialogFrame、TitleBar、Toast…10 个） | 绑定壳 | D | 丢弃 | 生成的空壳 |
| `features/{collection,daily,endless,garden,mainline,services}/ui/*.ts`（约 60 个） | 绑定壳 | D | 丢弃 | 16–26 行，只有 @property + requireBinding，无业务 |
| `features/mainline/presentation/*` | 地图 8 槽分页、版式选择 | C | 丢弃（主线映射规则已在 HexCoordinates） | 绑定原稿 8 个固定挂点 |
| `features/boot/ui/LoadingPageView.ts` | 进度条 | C | 丢弃（新框架自有） | 24 行 |
| `debug/GM*.ts` | GM 壳 | D | 丢弃 | 空壳 |
| 82 个 `.prefab` | 全部 UI | C/D | **丢弃**，按新框架手工重做 | 见第 5 节 |
| `assets/bundles/**/textures`（562 PNG / 145MB） | 运行贴图 | C | **按需挑选源图，重新导出+打图集**；建议直接从 `arts/游戏素材/PNG`（372 张整理后的唯一母件）取 | 哈希文件名不可读、未压缩、不可合批 |
| `arts/`（767MB：游戏素材/PSD/效果预览/页面配置/本地化） | 美术正式交付 | A（作为素材源） | **作为素材源复用** | 已去重为 371 母件 + 参数化蜂巢方案（见 `arts/资源复用方案.md`） |
| `resources/framework/config/source-art-manifest.json`、`prefab-registry.json` | 资源登记 | D | 丢弃 | 只服务于生成器体系；可用来查“哈希文件名 ↔ 中文原名” |
| `tools/prefab-foundation/**`（生成器/审核/原生验证，约 15k 行含 JSON） | 生成 Prefab、审计、Playwright 验证 | C | 丢弃；`export-levels.mjs` 可留作数据来源说明 | 依赖缺失的 `../prototype/`，已无法运行 |
| `tools/prefab-foundation/tests/puzzle-session.test.mjs`、`level-data.test.mjs`、`play-input.test.mjs` 等 | 规则回归 | B | 可迁移为新工程单测 | 用 TypeScript transpile + vm 跑纯逻辑，需设置 TYPESCRIPT_PATH |
| `build-templates/wechatgame/*` | 微信 game.json（竖屏）、project.config.json（appid 空）、first-screen.js（引擎默认首屏） | C | 以 bighero 模板为准 | 无定制内容 |
| `build-templates/web-desktop` | 网页模板 | D | 丢弃 | 默认 |
| `settings/v2/packages/engine.json` | 模块裁剪 | C | 重新配置 | 勾选了 dragon-bones、spine-3.8、physics-2d-box2d、tiled-map、video、webview、particle-2d 等**本游戏用不到的模块**，增大包体 |
| `settings/v2/packages/builder.json` | 微信 bundle=subpackage | B | 参考 | |
| `native/engine/android/**` | Android 工程、广告 SDK（ADCenter、AdGoogleProvider、SDKHandleClass） | ? | 不在本次范围；按 bighero 的 Android/SDK 方案 | 维护文档说明这几个 Java 文件是独立审查、未随 Cocos 提交 |
| `docs/*.md`、`docs/策划/**` | 实施记录 + 65 项功能策划 | — | **策划可作为需求参考**（规则/数值/流程），实施记录无需保留 | 规则细节（计步、限步、无尽 37 格、解锁第 4 关等）有价值 |

---

## 4. 关卡数据

### 4.1 存储位置与格式

文件：`assets/bundles/puzzle/config/level-catalog.json`（586KB，格式化 JSON，单文件存全部关卡）。

```jsonc
{
  "schema": "hexa.level-catalog.v1",
  "sources": [
    { "path": "prototype/level-data.js", "sha256": "fed0f588…" },
    { "path": "prototype/mainline.js",   "sha256": "627b3ad9…" }
  ],
  "levels": [   // 共 110 项
    {
      "id": "classic-001",          // 原题 ID：classic-001..080 / challenge-001..030
      "mode": "classic",            // classic=普通（无步数限制）；challenge=限步
      "index": 1,                   // 模式内序号
      "mainlineNumber": 1,          // 主线关号 1..96；14 道储备题为 null
      "pieces": [
        {
          "id": "piece-0-1_png",    // "piece-<序号>-<textureName>"
          "textureName": "1_png",   // 颜色母件名（12 种名 → 5 张实际图）
          "cells": [ {"q":0,"r":0},{"q":0,"r":-1},{"q":-1,"r":0},{"q":-2,"r":1},{"q":-2,"r":2},{"q":-1,"r":2} ], // 局部形状，第0格为原点
          "targetCells": [ {"q":4,"r":0},{"q":4,"r":-1},{"q":3,"r":0},{"q":2,"r":1},{"q":2,"r":2},{"q":3,"r":2} ] // 原答案位置（cells + 锚点）
        },
        { "id": "piece-1-3_png", "textureName": "3_png", "cells": [/*7格*/], "targetCells": [/*…*/] },
        { "id": "piece-2-6_png", "textureName": "6_png", "cells": [/*5格*/], "targetCells": [/*…*/] }
      ],
      "targetCells":   [ /* 所有拼块 targetCells 的并集，18 格 */ ],
      "obstacleCells": [ {"q":3,"r":1} ],   // 障碍格（显示但不可放）
      "moveLimit": null                      // challenge 才有：7 或 8
    }
  ]
}
```

坐标为 axial（flat-top），全部题目范围 q∈[0,8]、r∈[-4,5]。

### 4.2 数量与 96 关映射

- 110 题 = **80 普通 + 30 限步**。
- 主线 96 关 = 每 6 关一组“5 普通 + 1 限步”，共 16 组：
  - 普通第 i 题 → 关号 `floor((i-1)/5)*6 + (i-1)%5 + 1`（1–5, 7–11, …, 91–95）
  - 限步第 i 题（i≤16）→ 关号 `6i`（6, 12, …, 96）
  - 限步 017–030 共 14 题 `mainlineNumber=null`（储备题，可用作额外关/每日精选）。
- 难度曲线：普通 3 块（1–11 关）→ 4 块 → 5 块 → 偶有 6 块；目标格 15–24；障碍 0–3。限步 4–7 块、23–27 格、moveLimit 7/8。最多 7 块、单块最多 7 格。
- 已核验：110 题无重复局面；每题拼块 targetCells 不重叠、并集 = targetCells、障碍不与目标重叠（`LevelCatalog` 构造时严格校验）。

### 4.3 来源

由 `tools/prefab-foundation/export-levels.mjs` 从原型 `prototype/level-data.js`（`window.BeeLevels = {classic:[80], challenge:[30]}`，原始格式为 `raw[]` 里 `edit_game_elements` 元素 + `data[{tx,ty}]` + `texureName`，`4_png` 为障碍；`meta.solutionWitness` 给出每块锚点）和 `prototype/mainline.js`（`BeeMainline.levels` 96 行映射）一次性导出。原始数据看起来源自某个现成关卡编辑器的导出（`texureName` 拼写、`edit_game_elements` 类型名）。**`prototype/` 目录当前不存在**，但导出产物已完整入库，不需要再导出。

### 4.4 是否可直接使用

**可以直接用**。建议：
- 直接拷贝 JSON + `LevelDefinition.ts` + `LevelCatalog.ts`（放宽写死的 110/96 校验）+ `HexCoordinates.ts`。
- 如需压缩包体：`cells` 可转成 `[[q,r],…]` 紧凑数组（预计 586KB → ~100KB）；`targetCells` 由 `cells + 锚点` 可推导，可只存锚点。
- `textureName` → 颜色的映射需在新工程定义（当前 12 名→5 色：1/9/16→金，3/10/17→蓝，6/11→色3，7/12→色4，8/13→色5）。
- 若要做“提示”功能，`pieces[].targetCells` 就是可用的标准答案。

---

## 5. Prefab 生成流水线

### 5.1 工作原理

入口 `npm run prefab:generate` → `tools/prefab-foundation/generate.mjs`：

1. `catalog.mjs` 用 `vm.runInNewContext` 读取原型 `prototype/block-data.js`（`window.BlockArt.configs`：每张设计稿的**图层清单**——图片、坐标、尺寸、锚点、层序、透明度、九宫格、文字样式）和 `app.js/meta.js` 的路由表，定义 82 项（id、Prefab 名、模块、分类、来源设计稿前缀如 `T02-01`、绑定字段）。
2. `import-assets.mjs` 从 `prototype/assets/block` 拷贝 PNG 到对应 bundle，用 Python（`raster.py`，写死了本机 Codex 运行时的 python.exe 路径）生成派生图，写 `source-art-manifest.json`；`.meta` 用 `stableUuid(sha256('hexa-prefab-foundation-v1:'+path))` 生成**确定性 UUID**，`packable:false`。
3. `select-layers.mjs` 从设计稿配置里挑出该 Prefab 用的图层/文字；`builder.mjs` 的 `Builder` 类**直接拼 Cocos 序列化 JSON 数组**（`cc.Node`/`cc.UITransform`/`cc.Sprite`/`cc.Label`/`cc.Button`/`cc.PrefabInfo`…，fileId 由 sha256 派生）——即**每个 PSD 图层 → 一个节点**；`groupControls()` 按中文名称正则（背景/按钮/关闭…）和 y 坐标自动分组为 Background/Header/Footer/Actions/Content。
4. 同时**生成 View 脚本**（`makeViewScript`：@property 字段 + requireBinding），`core-ui.mjs` 根据 `core-actions.json` 给按钮写 clickEvents，`level-ui.mjs`/`play-ui.mjs` 预挂 `PuzzleBoardPresentation`/`PuzzleController`/`PlayStatusPresentation` 等业务组件。
5. `managed-output.mjs`：所有输出的 SHA-256 记录在 `generated-files.json`（653 行）；**再次生成前 preflight 检查，任何文件被 Creator 或人工改过即报错拒绝覆盖**。仅 `loading` 和 `mainline-map` 两个标为 `maintenance:'manual'`（人工维护，生成器只校验绑定）。
6. 配套 `audit.mjs`（静态审计节点/引用）、`verify-*-native.mjs`（Playwright 驱动 Creator 预览截图验证）、21 个 node:test 测试文件。

### 5.2 是否适合在 Creator 里手工编辑

**不适合，结论：丢弃整条流水线与其产物。**

优点：
- 与设计稿像素级一致，坐标/层序/九宫格可追溯；UUID 确定、可重复生成；有所有权哈希防止误覆盖；有大量自动化校验。
- 一次性批量产出 82 个 Prefab 速度快。

缺点：
- **单向**：一旦在 Creator 中调整（加 Widget、换图、改层级），该文件即脱离生成器管理，再生成会报错；要么永远不手改，要么永远不再生成。
- **输入已丢失**：依赖的 `../prototype/`（block-data.js、app.js、meta.js、level-data.js、mainline.js、assets/block）不在当前工作区；Python 路径写死本机。生成器、过半测试和审计**现已无法运行**。
- **节点结构是“PSD 图层平铺”**而非 UI 结构：几乎没有 Widget/Layout（MainlineMapPage 只有 2 个 Widget、2 个 Layout），依赖 `fitNode` 整体缩放适配，不同屏幕比例适配差；文字使用系统字体“Microsoft YaHei”。
- 一个 Prefab 内嵌多套版式（PuzzlePage 5 套），节点数爆炸：PuzzlePage **725 节点 / 342 Sprite / 39 Graphics / 10 Mask / 1.75MB**；GardenPage 422 节点 / 1.16MB；PuzzlePreviewView 650KB。
- 节点名是中文原稿图层名，组件字段由生成器起名，人工难以理解和维护。
- 动态展示靠 JSON 字符串属性（`textureAssetIds`、`itemData`、`previewData`、`spec`），Inspector 不可视化编辑。
- 与目标框架（bighero 的 Prefab/组件制作方式，即手工搭 Prefab + 预挂组件 + Inspector 绑定）相冲突。

可借鉴的一点：`arts/页面配置/*.json`（设计稿图层坐标）仍可作为手工搭 UI 时的**对位参考**；`arts/效果预览`、`页面对照` 可作为视觉验收基准。

---

## 6. 性能问题

| 问题 | 现状 | 影响 / 建议 |
|---|---|---|
| 贴图总量 | 562 PNG、**145MB**（common 包 81MB）；71 张边长 > 1024；大量 853×1844 全屏图 3MB/张 | 微信小游戏主包 4MB、分包合计约 30MB，必须远程 CDN 或大幅压缩；建议全屏背景改 JPG/压缩纹理，去掉“整页底图”类资源 |
| 不可合批 | 559/562 张 `packable:false`，**0 个自动图集（.pac）** | 每换一张贴图打断合批，UI 页面 draw call 可达数十到上百；需按页面/模块建 Auto Atlas，图标类打入同图集 |
| 拼块贴图过大 | 每个拼块小格（~50px 显示）使用 **1147×1003** 的“颜色母件”整图；5 色 → 5 张大图常驻 | 显存浪费（单张 RGBA ≈ 4.6MB），且缩小采样无 mipmap（`mipfilter: none`）会闪烁；应导出 128px 级单格图并入同一图集 |
| 节点数量 | PuzzlePage 725 节点（5 套版式同时实例化）、GardenPage 422 节点 | 实例化慢、内存高；按需只建一套版式，拆分子 Prefab |
| Graphics + Mask | PuzzlePage 39 个 Graphics、10 个 Mask；棋盘底用 GRAPHICS_STENCIL Mask + TILED Sprite + 三层 Graphics 描边/阴影，每关重绘 | Mask 打断合批（每个 Mask 至少 +2~3 DC）、Graphics 每个单独 DC；建议每关一次性烘焙到 RenderTexture，或用预制六角格 Sprite 拼底+描边贴图 |
| 拖动预览 | 每次 touch move `graphics.clear()` 重画、逐顶点 `convertToWorldSpaceAR`、每次 `new Color` | 影响小但可优化：预览改用与拼块同形状的半透明 Sprite 节点 |
| 每格一节点 | 棋盘 ≤ 30 格 + 拼块 ≤ 49 格，各一个带 PresentationItem 的 Prefab 实例 | 数量可接受，但应保证同图集同材质才能合批；grayscale 障碍格会使用不同材质打断合批 |
| 启动 JSON | 启动即加载 1.9MB `source-art-manifest.json` + 208KB registry + 586KB level-catalog | 启动慢；新框架应去掉 manifest，关卡 JSON 压缩或按需加载 |
| 引擎模块 | 勾选 dragon-bones、spine-3.8、box2d、tiled-map、video、webview、particle-2d 等 | 显著增加引擎包体（微信首包），按实际需要裁剪 |
| 适配 | 853×1844 + SHOW_ALL + 每页手动整体缩放 | 非常规设计尺寸，宽屏/平板留黑边；建议沿用 bighero 的设计分辨率与 Widget 适配 |
| 文字 | 系统字体、`_cacheMode: 0`（NONE） | 大量 Label 每个单独 DC；可用 BITMAP/CHAR 缓存或位图字体 |

---

## 7. 推荐复用清单（可直接复制的文件）

```
assets/bundles/puzzle/config/level-catalog.json
assets/scripts/features/puzzle/data/HexCoordinates.ts
assets/scripts/features/puzzle/data/LevelDefinition.ts
assets/scripts/features/puzzle/data/LevelCatalog.ts          (放宽写死的数量/正则校验)
assets/scripts/features/puzzle/model/PuzzleModel.ts
assets/scripts/features/puzzle/session/PuzzleSession.ts
assets/scripts/features/puzzle/presentation/PuzzleLayout.ts
assets/scripts/framework/components/Binding.ts               (可选)
assets/scripts/framework/core/ResourcePool.ts + framework/resources/ResourceScope.ts (若新框架无等价引用计数方案)
assets/scripts/framework/core/VirtualWindow.ts + framework/ui/VirtualList*.ts (若新框架无虚拟列表)
```

改写后复用（取算法/逻辑）：
```
assets/scripts/features/puzzle/controller/PuzzleController.ts   拖放、吸附、取消、相机反投影
assets/scripts/features/presentation/SourceGeometry.ts           sourceBoundary()/loops() 并集边界算法
assets/scripts/features/puzzle/presentation/PuzzlePiecePresentation.ts  containsLocal() 精确命中
tools/prefab-foundation/tests/puzzle-session.test.mjs 等       规则回归用例
```

素材：从 `arts/游戏素材/PNG`（372 张去重母件、中文可读命名）重新挑选导入并打图集，不要拷 `assets/bundles/**/textures` 的哈希命名图。策划规则参考 `docs/策划/功能/F006–F016、F029–F034`。

其余（约 90 个 .ts 中的大部分、82 个 Prefab、Main.scene、GardenAssetStore、UIFlow、FoundationBoot、Presentation 系列、生成器/审计/原生验证工具、构建模板、引擎模块设置）**全部丢弃**。
