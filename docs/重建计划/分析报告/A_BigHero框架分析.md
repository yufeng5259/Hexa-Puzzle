# BigHero2415 框架分析报告(供 Hexa-Puzzle / Cocos Creator 3.8.8 复用)

> 分析对象:`/e/temp/gm/bighero2415`(只读,未做任何修改)
> 目标工程:`/e/temp/gm/Hexa-Puzzle`(Creator 3.8.8,Android + 微信小游戏;未修改)
> 辅助脚本(只读解析 prefab/scene,非交付物):`/e/temp/gm/_analysis/_tools/`(`dump_prefab.js`、`dump_scene.js`、`uuidmap.js`、`map.json`)

---

## 0. 结论摘要

1. **引擎版本 Creator 2.4.15**(`project.json: "version": "2.4.15"`,`engine: cocos-creator-js`,`creator.d.ts` 是 2.x 的 `cc` 全局命名空间)。**语言 100% TypeScript**(919 个 `.ts`,0 个业务 `.js`),`tsconfig` 为 `target es5 / strict / experimentalDecorators`。
2. 这不是一个"原生写出来"的工程,而是**把一个已上线的 2.x 混淆/反编译游戏("source"、`ui/ModeBackpackHero/...` 等旧路径)重写成可读 TS** 的工程(`builder.json` title=`bighero-rewrite`)。所以代码里到处是"保留源行为"的兼容层:旧路径→新资源路径的映射表(`SourceViewRoutes`、`SourceSpritePaths` 共 1100+ 行)、数字事件 ID(1018、1083…)、模拟 CommonJS 的 SDK 模块缓存(`SourceModuleCache`)、`cc` 原型扩展(`CocosNodeExtensions`),还有若干故意保留的原 bug(注释里写着 "Source intentionally…")。
3. **架构特征**:组合根(`CocosApplication`,479 行)手写全部依赖注入。所有 prefab 实例化后都要经过 `configureNodeTree(root)`,**递归遍历整棵节点树的所有组件**,由各个 `CocosXxxViewBindings` 程序集用 `instanceof` 判断类型,再调 `component.configureXxx(ports)` 注入端口。UI 节点引用以 **`@property` 在 Inspector 绑定**为主(676 处),但仍有 291 处 `getChildByName` 和 26 处 `cc.find`。
4. **可复用价值主要在"纯逻辑内核"和"UI 基类的算法"**:事件总线、Timeline 定时器、对象池、配置表、存储(含 Proxy 自动存档的 JsonRecord)、随机数、LZString 编解码、ViewComponent 生命周期与 UI 栈、ScrollableItemGrid 的虚拟列表算法、弹窗过渡动画。其中**约 40 个文件完全不引用 `cc.`,可以原样拷到 3.8.8**。UI/资源/音频这几层要做 2.x→3.x 的 API 改写。平台 SDK、组合根、业务、旧路径映射、`cc` 原型扩展**都不要拷**。
5. 目标工程 `AGENTS.md` 已经定了约束:框架代码放 `assets/scripts/framework/`,通用 prefab 放 `assets/resources/framework/`,禁止运行时扫描名称和补整棵 UI 树,复制代码时要建 `tools/framework/reference-manifest.json`。这些约束和本报告的建议一致。**BigHero 的 `configureNodeTree` 全树扫描注入正是要摒弃的做法**,迁移时改成"只给根 View 注入 context,子组件由 `@property` 拿到引用后由 View 显式下发"。

---

## 1. 工程基本信息与目录

### 1.1 版本与配置
| 项 | 值 |
|---|---|
| `project.json` | `{"engine":"cocos-creator-js","version":"2.4.15"}` |
| `creator.d.ts` | 2.x 全局 `cc` 命名空间声明 |
| `tsconfig.json` | `module commonjs, target es5, strict, experimentalDecorators`,include `assets/scripts/**/*.ts` |
| 设计分辨率 | 750×1334,`fit-height: true, fit-width: false`(`settings/project.json`) |
| 分组/碰撞 | group-list: default/UI/Game/Monsetr/Role/Neutrality/Bullet/Goods/Wall + collision-matrix |
| 启动场景 | `assets/scenes/application_boot.fire`(uuid 8abad442…) |
| Bundle | **只有 `resources` 一个 bundle**(`assets/resources.meta isBundle:true`),没有自定义子包 |
| 资源量 | png 1075, prefab 338, skel(Spine) 183, atlas 191, mp3 67, 配置 txt 54 |

### 1.2 assets 目录
```
assets/
├─ scenes/
│   ├─ application_boot.fire     # 正式启动场景
│   └─ foundation_boot.fire      # FoundationProbe 引擎能力自测场景
├─ effects/                      # 自定义 effect(particles/ui)
├─ resources/                    # 唯一 bundle,全部动态加载资源
│   ├─ config/                   # *.txt = LZString(Base64) 压缩的 JSON 配置表(54 张)
│   │   └─ source_json/          # 原始 JSON(人读/生成源)
│   ├─ common/                   # 通用:alerts/audio/badges/boot/fonts/guide/items/loading/ui/...
│   └─ features/<feature>/       # 按功能:shop/settings/lobby/backpack/modes/...
│        ├─ xxx_view.prefab      # 页面/弹窗 prefab(snake_case)
│        └─ media/               # 该功能的图片
└─ scripts/
    ├─ app/            (≈85 文件) 组合根、各业务程序集 CocosXxxViewBindings、启动、旧路径映射
    ├─ core/           纯逻辑:collections / config / diagnostics / encoding / events / mvc / ports / protocol / random / time
    ├─ infrastructure/ 引擎/平台适配:cocos(UI/资源/音频/池/渲染)/ localization / network / persistence / platform / analytics / modules
    ├─ shared/         跨功能共享:ui(基类、Grid、List、过渡)/ advertising / alerts / badges / items / loading / profile / tutorial / ...
    └─ features/<feature>/  业务功能:XxxFlow(控制器)+ XxxProfile(数据模型)+ ui/XxxView + ui/XxxPorts
```

---

## 2. 框架架构

### 2.1 启动 / Boot 流程
场景 `application_boot.fire` 的节点树(用 `dump_scene.js` 解析):
```
- ScriptRoot  [CocosEngineEntry, ApplicationBoot, GameLauncher]
- Canvas      [cc.Canvas, cc.Widget]
  - SceneBackground / UICamera / GameCamera
  - BootLoadingLayer  (Logo、LoadingProgressTrack(ProgressBar)、LoadingProgressText、健康游戏公告、版权/备案)
```
执行顺序靠 `@executionOrder` 保证:

| 顺序 | 组件 | 职责 |
|---|---|---|
| -1100 | `app/CocosEngineEntry.ts`(113 行) | 读 `@property` 绑定的 Canvas/GameCamera/地图节点路径,调用 `createCocosProductionDependencies()` 装配各业务程序集(catalogue/shop/tasks…),然后 `installCocosApplicationDependencies(factory)` |
| -1000 | `app/ApplicationBoot.ts`(17 行) | `createInstalledCocosApplication(launcher)` → `new CocosApplication(...)`,在构造函数里装好所有服务,再 `launcher.configure(ports)` |
| 0 | `app/GameLauncher.ts`(221 行) | `onLoad`:常驻节点、多点触控、适配。`start`:SDK init → **并行加载全部配置表** → 语言 → `initializeUi()`(建 UI 根和 ViewCoordinator)→ `constructApplicationModules()`(按固定顺序 new 24 个 Flow 控制器)→ `LoginCoordinator`(时间/预加载 view/音乐/存档/开关/SDK 登录/分享配置,带进度条)→ 收到 1018 `Login_Finish` 后 `startGame()` → 发 1127 打开大厅 |
| 每帧 | `GameLauncher.update(dt)` | `services.advance(dt)`(驱动 GameClock/Timeline,并发 `Game_Update=1` 事件)+ `views.update(dt)`(loading 遮罩倒计时) |

```ts
// GameLauncher.start(节选)
this.startupTask = this.loadConfigurations().then(() => {
    ports.language.publishTable('tpdg', ports.language.getTable());
    ports.initializeUi();
    constructApplicationModules(ports.modules);
    ports.createLoginCoordinator(this.progressLabel, this.progressBar);
});
public update(seconds: number): void {
    this.ports.services.advance(seconds);
    this.ports.views.update(seconds);
}
```

**场景用法**:整个游戏**只有一个场景**。UI 全部挂在常驻根 `_UIRoot` 下按层管理(`cc.game.addPersistRootNode`),战斗/模式也是以 `ViewLayer.Scene` 层 prefab 的形式打开的,不切场景。

### 2.2 组合根 / DI
- `app/CocosApplication.ts`(479 行):持有 `services / resources / pools / prefabPool / platform / language / textWriter / audio(lazy) / views / alerts / configuration / runtime(ControllerRegistry+网络+http)`,实现接口 `CocosApplicationEngineContext`。
- `app/ApplicationServices.ts`(104 行):纯逻辑服务集合,含 `bus`(NotificationBus)、`timeline`、`clock`(GameClock)、`random`、`weightedSelection`、`configurations`(ConfigurationCatalog)、`codec`(LZString)、`session`(UserSession)、`storage`(PlatformStorage)、`remoteSave`、`recordDependencies`。
- `app/ApplicationManager.ts`:旧版 `cc._gameManager` 全局门面的兼容层(只为兼容,**不要拷**)。
- **组件注入协议**(`app/CocosBusinessViews.ts`):
```ts
export interface CocosComponentAssembly {
    readonly name: string;
    createViewDefinitions(services: ViewServices): ReadonlyArray<RegisteredViewDefinition>; // 注册页面元数据
    configureComponent(component: cc.Component): 'configured' | 'unowned';               // 给组件注入 ports
}
public configureNodeTree(root: cc.Node): void {     // 每个 prefab 实例化后都会调用:全树遍历
    if (root.parent !== null) throw new Error('Business prefab configuration requires a detached root');
    const visit = (node: cc.Node): void => {
        for (const component of node.getComponents(cc.Component)) this.configureComponent(component);
        for (const child of node.children) visit(child);
    };
    visit(root);
}
```
另外 `infrastructure/cocos/CocosDynamicComponentInstaller.ts` 会 hook 组件生命周期,给运行时 `addComponent` 出来的组件也做注入。**这一套重、隐式,而且违反目标工程"禁止补整棵 UI 树"的约束,不建议照搬。**

### 2.3 UI 管理器(页面/弹窗栈、层级、开关、返回)
文件:
- `infrastructure/cocos/ViewCoordinator.ts`(288 行):UIManager 本体
- `infrastructure/cocos/ViewRoots.ts`(112 行):建立 `_UIRoot` 和各层根节点,处理分辨率变化
- `infrastructure/cocos/CocosViewFactory.ts`(101 行):加载/实例化/读取元数据;`ViewAssetHandlers` 负责加载与释放回调
- `shared/ui/ViewComponent.ts`(217 行):**所有页面的抽象基类**(继承 `ResourceLease`)
- `shared/ui/PopupView.ts`(59 行):业务弹窗/页面常用基类,带通用 `nodeBindings/labelBindings` 数组、暂停战斗、上报、`openReferencedView`
- `shared/ui/ViewArgs.ts`(41 行):打开参数(链式 builder)
- `shared/ui/ViewMetadata.ts`(44 行):layer/queue/transition/bgm 元数据表
- `shared/ui/ViewTransition.ts`(134 行)、`ScalePopupTransition.ts`(55)、`EaseOpacityTransition.ts`(57):显隐过渡

**层与队列**:
```ts
export enum ViewLayer { Scene = 1, Main = 2, Panel = 3, Popup = 4, SubPopup = 5, Tips = 6, Guide = 7, Loading = 8, Max = 9 }
export enum ViewQueue { Scene = 1, Panel = 2, Popup = 3, Guide = 4, None = 5 }
```
- **Layer** 决定挂到哪个层根节点(`<LayerName>_Root`),也就是渲染层级。
- **Queue** 决定是否进"互斥栈":同一 queue 新开页面时,把栈顶页面 `hide()`(不销毁);关闭时 `pop` 并 `show()` 回上一个。`ViewQueue.None` 表示不进栈(叠加型弹窗)。
- 另有一个全局的**排队弹窗** `OpenInQueue / StoreInQueue / OpenInQueueByFirst`(按 sort 排序,关一个开下一个),用来串行弹出奖励、公告这类窗口。

**主要 API**:
```ts
ViewCoordinator.Init();
views.open(path: string, args?: ViewArgs)      // 按 args.delaySeconds 延迟;同 path 已打开则重新 setOpenArgs + open
views.close(path, afterClose?)                  // 或 view.close()
views.getView(path) / getTopViewByQueue(q) / closeAllByLayer(layer) / closeQueues(q?)
views.openInQueue(path, args, sort) / storeInQueue / openInQueueByFirst / cleanQueue
new ViewArgs().setParam({...}).setCallback(r => ...).setOpenCallback(v => ...).setIsNeedLoading(false).setDelaySeconds(0.2)
```
其中 path 就是 resources 下的 prefab 路径,例如 `features/shop/energy_purchase`。加载超过 0.1s 会发 `Game_LoadingView(5)` 显示 loading。

**ViewComponent 生命周期**(子类必须实现 8 个抽象钩子):
```
open():  [首次] 注册 blockEvents(touchend 吞掉) → services.onOpen(入栈/计数) → onOpen() → args.onOpenCallback → show()
         [每次] setInfo()
show():  setUIMaskActive(true) → changeListener(true) → transition.show() → onShow() → 播放 bgm
showFinish(): 关闭 UIMask → onShowFinish() → 上报 'show'
hide():  changeListener(false) → transition.hide() → onHide()
close(): args.callback(0|1) → hide → hideFinish → finishClose: onClose() → services.onClose(出栈) → node.destroy() → defer(afterClose)
```
`setNodeInfo` 会给根节点补一个 `UIMask` 子节点(`BlockInputEvents`,zIndex 最高),**在过渡动画期间屏蔽点击**,动画结束才关掉。

**元数据注册**:原 2.x 写法是 `@uilayer(...)`、`@uiqueue(...)`、`@transition(...)`,内部用 `cc._RF.peek()`(**3.x 没有**)。重写后改成由程序集 `createViewDefinitions()` 显式声明,再按 **prefab 根节点名**(`VIEW_METADATA_NAMES[ClassName] = [rootNodeName]`,见 `app/ViewMetadataNames.ts`,526 行)登记。

**返回键**:**全工程没有 Android 返回键处理**(搜不到 `KEY.back/escape`、`onBackPressed`)。只有开发用的键盘快捷键(`DeveloperFlow` 里 `cc.systemEvent KEY_DOWN`:g 开 GM、p 暂停)。Hexa-Puzzle 需要自己补:`input.on(Input.EventType.KEY_DOWN)` 监听 `KeyCode.MOBILE_BACK`,关闭 `getTopViewByQueue(Popup)`,或交给栈顶 View 的 `onBack()`。

### 2.4 资源加载与释放
文件:`infrastructure/cocos/ResourceLoader.ts`(404 行)、`ResourceLease.ts`(63 行)
- `ResourceLoader.loadRes(url, [type], [onProgress], [onCompleted], [bundle])`:可变参数解析(`makeLoadResArgs`);默认 bundle 是 `cc.resources`;先 `bundle.get` 命中缓存,`https:` 开头的走 `loadRemote`。
- 高层 Promise API:`loadSpriteAsync / loadSpriteToSprite(path, sprite, owner) / loadSpriteFrameList / loadSpriteAtlas / loadPrefab / loadPrefabResource / loadSpine / loadDragonBones / instantiate(prefab)`。
- **引用计数**:`ResourceLease`(原名 ResKeeper)是挂在节点上的组件,`autoReleaseResource({asset})` 时 `addRef`,`onDestroy` 时统一 `decRef`。`setAutoRelease(asset, owner, createOnOwner)` 会沿父链找最近的 Lease,找不到就用全局 fallback。`ViewComponent extends ResourceLease`,所以**页面销毁时自动释放它加载过的资源**;`instantiate(prefab)` 会给 prefab 本身 addRef。
```ts
public instantiate(prefab: ReferenceCountedAsset): ResourceOwnerNode {
    const node = this.runtime.instantiate(prefab);
    this.setAutoRelease(prefab, node, true);   // prefab 的引用归属到实例节点
    return node;
}
```
- 已知缺陷:`loadSpriteAsync` 在 path 为空时 Promise 永远 pending;`loadSpriteToSprite` 在 sprite 无效时也永不 resolve。异步结果迟到时只检查了 `sprite.isValid`。移植时要修。
- 已有 bundle 参数,但工程只用了 resources。Hexa-Puzzle 已有 `assets/bundles/*`,需要加 `assetManager.loadBundle` 和 bundle 级释放。

### 2.5 事件总线
文件:`core/events/NotificationBus.ts`(92)、`OrderedEvents.ts`(171)、`SingleQueries.ts`(55)、协议 `core/protocol/EventProtocols.ts / NotificationProtocols.ts / QueryProtocols.ts / StorageProtocols.ts`
- 两种通道:
  - **事件(多播,带优先级)** `addListener/removeListener/changeListener(enabled, id, fn, ctx, prior)` 和 `send(id, ...args)`。按 priority(-200 到 200)插入,反向派发,派发期间允许增删。
  - **查询(单播 RPC)** `addCall/removeCall/changeCall` 和 `call(id, ...args) → result`,每个 id 只能注册一个处理器(重复注册报错)。
- ID 都是数字常量(`EventIds.Item_GoodsChange = 1079`、`QueryIds.Fight_GetCutMode = 1009`、`NotificationIds.Game_Update = 1`)。代码里大量直接写魔法数字(`bus.send(1083, true)`)。
- 惯用法:View 在 `changeListener(enabled)` 里统一 `bus.changeListener(enabled, ...)`,show 时开、hide 时关。
```ts
protected changeListener(enabled: boolean): void {
    ports.notifications.changeListener(enabled, ids.MoreGame_Refresh, this.refreshKnifePage, this);
}
```
- 全局单例 `app/ApplicationNotifications.ts`:`applicationNotifications` 和兼容门面 `Notifier`。

### 2.6 数据 / 存档(本地存储)
- `infrastructure/persistence/PlatformStorage.ts`(281):包装 `cc.sys.localStorage`,提供 `get/setBool/Number/String/Object/Array`,可选 LZString 压缩(`getItem/setItem`)、`setPersonKey` 账号前缀的 `getPrivy*`、云存档 `CloudSaveGateway`、`RemoteSaveQueue`(延迟 10s 合并上传),`SAVELIST` 是写死的业务 key 列表。
- `infrastructure/persistence/JsonRecord.ts`(225):**推荐复用**。基于 Proxy 的自动存档记录,修改字段即自动保存;内置每日重置(`checkDailyData/resetForNewDay`,订阅 `Time_NewDay=7`);key 规则是 `TPDG-Record-${name}`。
- `infrastructure/persistence/InventoryStore.ts`(180):物品/货币仓库(`has/getValue/addGoods/useUp/forEach/filter`、过期检查),变更时发 `Item_GoodsChange(1079)`。
- `shared/profile/UserSession.ts`(108)、`UserProfile.ts`(87)、`RuntimeSwitches.ts`(156):用户数据(`userdata`)和后台开关,业务味很重。

### 2.7 配置表
- `core/config/ConfigurationResources.ts`:逻辑名到资源名的清单(`['MiniGameLv','mini_game_levels']` → `config/mini_game_levels`)。
- `core/config/ConfigurationCatalog.ts`(119)、`ConfigurationTable.ts`(131):
```ts
table.get(id) / tryGet(id) / find({type: 30}) / findBy(fn) / filter({type: 30}) / forEach / getAll / getArray / lookup(srcField, valField, key)
```
- 加载:`infrastructure/cocos/ConfigurationLoader.ts`(79)、`ConfigurationFacade.ts`(394)。`cc.resources.load(path, cc.TextAsset)` 之后 `codec.decompressFromBase64(text)` 再 `JSON.parse`,得到 `{id: row}` 映射。另支持 `initRemoteConfig`(HTTP 拉取,失败回退本地)。
- 编解码:`core/encoding/DictionaryTextCodec.ts`(291,LZString 的 `compressToBase64/decompressFromBase64` 实现)。
- `core/config/readers/*Configuration.ts`(约 60 个,每个 10-15 行)是每张表的行类型声明,全是业务。

### 2.8 音频
- `infrastructure/cocos/AudioService.ts`(312):音乐(`cc.AudioSource`,带淡入淡出音量)和音效(`cc.audioEngine.playEffect`,11 个通道,`delta` 防连播)。按 **Sound 表 id** 播放:`playMusic(id, loop)`、`playAudio(id, channel)`;开关和音量:`setMusicEnable/setEnableAudio/setMusicVolume/setAudioVolume`;另有 `pauseMusic/resumeMusic`、`setMusicClip` 预缓存。
- `CocosAudioSystem.ts`(34):建常驻节点 `application_audio`,订阅 `Game_Update(1)` 和 `Game_Pause(3)`。
- `AudioAdapter.ts` 给 SDK 用(微信音频中断时恢复);`RenamedAudioLoader.ts` 和 `SourceAudioPaths.ts` 是旧路径映射。
- 设置持久化在 `features/settings/SettingsProfile.ts`(`setting_data`)。

### 2.9 定时器 / 调度
- `core/time/Timeline.ts`(94)、`ScheduledWatcher.ts`(85)、`core/collections/MinimumSortedList.ts`(109)、`FifoObjectPool.ts`(30):**纯逻辑的帧驱动延时调度**。用最小堆排序,任务对象池化。
```ts
const task = timeline.schedule(seconds, cb, arg, ctx, repetitions); // 返回 ScheduledTask{id, cancel(), setTag()}
timeline.cancelById(id) / cancelByTag(tag) / advance(dt)
```
  `contextIsActive(ctx)` 在 ctx 不活跃时跳过回调。
- `core/time/GameClock.ts`(142):服务器时间同步(`setServerTime / serverTimeMs`)、跨天检测(发 7)、时间缩放(平滑 `setScale(value, duration)`),自己实现 `DelayScheduler`(委托给 Timeline)。
- `CocosGameScheduler.ts`、`FrameRateRegulator.ts`:小工具。
- 组件内部的短动画仍直接用 `this.scheduleOnce` 和 `cc.tween`。

### 2.10 对象池
- `core/collections/ReusablePool.ts`(306,纯逻辑):`ReusablePoolManager → ReusablePool(poolType) → ReusablePoolSpawner(id)`。支持 preload、cullAbove 上限、smoothClear 分帧清理;条目实现 `ReusablePoolItem {unuse/reuse/destroy}`。
- `infrastructure/cocos/PrefabNodePool.ts`(60)、`PooledPrefabNode.ts`(94):按 prefab 路径池化节点,`spawn(path) / spawnASync(path) / despawn(item)`。
- `PooledSpineEffect.ts`(70):Spine 特效池。
- 另有两处直接用 `cc.NodePool`:AlertService 的 tip 和 text。
- `shared/ui/grid/ModuloNodePool.ts`(72,纯逻辑):Grid 专用的取模槽位池。

### 2.11 列表 / 虚拟滚动
**ScrollableItemGrid**(`shared/ui/ScrollableItemGrid.ts`,468 行,加上 `shared/ui/grid/*` 11 个文件约 450 行,`@menu('util/ScrollableItemGrid')`)

- Inspector 属性:`gridOrientation`(水平/竖直)、`horizontalAlignment/verticalAlignment`、`cellSpacing: Vec2`、`scrollView`、`cellTemplate: Prefab`、`lineCellCount`(每行/列格数)、`contentNode`、`autoScaleCells`。
- 原理:`initialize()` 先实例化一个模板样本测出 cell 尺寸,再算 `poolCapacity = (ceil(视口长度/步长)+1) * lineCellCount`,用 `ModuloNodePool` 按 `index % capacity` 复用节点;`loadData(items)` 设置 content 尺寸并刷新可见区间。`node.on('scrolling')` 触发 `refresh()`,用区间差(`IndexInterval` 的交集与单侧差)把离开视口的节点隐藏、把新进入的排队刷新。刷新通过 `ScheduledGridRefresh` 分帧执行(`setRefreshGapSeconds`,默认 0.02s),避免一帧内刷太多。
- Cell 基类 `shared/ui/ItemGridCell.ts`(31):`onInit()`(首次创建)、`onRefresh(data, index)`;如果子类定义了 `onRefreshState`,会在 enable/disable 时自动监听 `Refresh_Item`。另外有 `dataCallback(node, data, index)` 和 `addCellCreateHandler()` 两个钩子。
- API:`loadData(items, force?)`、`scrollToCell(index)`、`moveToTop()`、`refreshVisibleNow()`、`setClickHandler`、`param`。
- 依赖:要先 `configureScrollableItemGrid(bus, timeline, {configureNodeTree})` 才能用,否则 `initialize` 会抛错;用到私有 API `node._onSiblingIndexChanged()`、`scrollView._unregisterEvent()`、`prefab.data.getAnchorPoint()`。

另外一个更简单的 **RecycledListView**(`shared/ui/lists/RecycledListView.ts`,186)+ `RecycledListItem`、`ListDataAdapter`:单列/单行定间距复用列表,按 `updateInterval` 节流。

### 2.12 View 基类和 Prefab 绑定方式
- 继承链:`cc.Component → ResourceLease → ViewComponent(抽象)→ PopupView → 业务 View(EnergyPurchaseView / GameCatalogueView …)`
- **绑定方式**:
  1. 稳定引用用 `@property(cc.Label) diamondCost` 在 Inspector 拖拽绑定(主流做法);
  2. `PopupView` 提供通用数组 `@property([cc.Node]) nodeBindings`、`@property([cc.Label]) labelBindings`,业务里用 `this.nodeBindings[5]` 这种下标访问(可读性差,**不推荐**);
  3. 按钮事件在 prefab 的 `cc.Button.clickEvents` 里绑定到根组件方法(`close`、`purchaseWithDiamonds`),`customEventData` 传参;
  4. 仍然有运行时查找:`getChildByName(nodeNames.disabledOverlay)`,以及扩展方法 `node.getComByChild(cc.Label,'title')` 和 `getComByPath(cc.Button,'Layout/openGame')`(这些是 `CocosNodeExtensions` 往 `cc.Node.prototype` 注入的)。
- 端口注入:每个 View 定义 `configureXxx(ports: XxxPorts)`,把 ports 存进 `WeakMap` 或私有字段;用的时候通过 `runtime()` 取,没有就抛 `TypeError`。

### 2.13 平台 / SDK 抽象
- `infrastructure/platform/BasePlatform.ts`(108):基类,广告、分享、支付、存储等能力默认都是空实现。
- `providers/`:`WeChatMiniPlatform`(208)、`ByteDanceMiniPlatform`(260)、`KwaiMiniPlatform`、`BilibiliMiniPlatform`、`OppoMicroPlatform`、`VivoMicroPlatform`、`AlipayRewardPlatform`、`NativeAndroidPlatform`(60,`jsb.reflection.callStaticMethod('org/cocos2dx/javascript/AppActivity', ...)`,Java 回调挂在 `cc.nativeAndroid.*`)、`JuheAndroidPlatform`、`IosNativePlatform`。
- 写法是**模拟 CommonJS**:`createWeChatMiniPlatform(ports, exports)` 内部 `ports.requireModule('Notifier'/'BaseSdk'/...)`,由 `infrastructure/modules/SourceModuleCache.ts` 和 `app/CocosBackendSdkModules.ts` 拼装,全局 `window.wonderSdk`。`StartupPlatformAdapter`(53)只是对它的命名适配。
- `PlatformCodes.ts`:`RewardVideoCode { Complete=0, NotSupported, NotReady, UnknownAdId, NotCompleted, AdError, ShowSucceeded }`、`ShareKind`。
- 广告:`shared/advertising/AdvertisingFlow.ts`(81,监听 `Ad_ShowVideo 1034`,支持广告券抵扣)、`RewardedVideoButton.ts`(156,按压动画、`rewardEvents: EventHandler[]` 在 prefab 绑定、带打点)、`VideoStatusIcon.ts`(60)。
- 打点:`infrastructure/analytics/*`(约 20 个文件,ThinkingAnalytics),网络:`infrastructure/network/*`(Pomelo/protobuf/HTTP)。

### 2.14 本地化
- `infrastructure/localization/LanguageCatalog.ts`(83)、`LanguageText.ts`(69):中文 key 字典(`localization` 配置表发布到 `window.tpdg`)。`check(text)` 在中文/繁体时原样返回,否则查字典;支持简繁转换(`CharacterConversionData`);`format('%d…', v)` 做格式化。
- `LocalizedNode.ts`(23):挂在 Label 上,onEnable 时翻译一次,然后自毁。
- `infrastructure/cocos/LocalizedTextWriter.ts`(216):hook 了 `cc.Label/RichText` 的 string setter,实现自动翻译、字体替换(**原型 hack,不要拷**)。
- 语言选择在 `GameLauncher.selectLanguageCode()`(zh/tc/jp/kr/vn/en/ina)。

### 2.15 日志
- `core/diagnostics/RuntimeLogger.ts`(130):`runtimeLogger.log/debug/warn/error/time`,默认关闭(`setLogEnable`),输出带 `[Log]:` 前缀。其余地方直接用 `cc.log/cc.warn/cc.error`。后台开关可以 `console.log = () => {}`(`disableConsoleLog`)。

### 2.16 GM / 调试
- `features/developer/DeveloperFlow.ts`(85):监听 `Test_OpenView(1131)`;键盘 g 开面板,p 暂停等。
- `features/developer/ui/DeveloperTestPanel.ts`(197):`PopupView` 子类,把 `Record<string, action>` 字典(如 `'无广告'`、`'下一天数据'`、`'通关+5'`)动态生成按钮(`buttonTemplate` 克隆到 `layoutList`),按关卡/模式分组。prefab 在 `resources/features/developer/ui/developer_test_panel`。
- `DeveloperProfile.ts`:把内部对象挂到 `window.W` 方便控制台调试。
- `app/FoundationProbe.ts`(263)+ `foundation_boot.fire`:引擎能力自检场景(动画、碰撞、prefab 等)。
- 开启方式:后台开关 `RuntimeSwitches` → `activateDeveloperControls()`。

---

## 3. 范例剖析

### 3.1 energy_purchase.prefab / EnergyPurchaseView
文件:`assets/resources/features/shop/energy_purchase.prefab`、`assets/scripts/features/shop/ui/EnergyPurchaseView.ts`(73 行)、`ShopDialogPorts.ts`(69)、`app/CocosShopViewBindings.ts`

Prefab 结构(`dump_prefab.js` 解析):
```
- EnergyPurchaseRoot [750x1334]  EnergyPurchaseView{diamondCost->Label@DiamondCostLabel; paidEnergy->@DiamondEnergyAmount;
                                   paidRemaining->@DiamondRemainingCount; videoEnergy->@VideoEnergyAmount;
                                   videoRemaining->@VideoRemainingCount; videoButtonNode->#VideoEnergyButton;
                                   purchaseButton->Button@DiamondEnergyButton}
  - BackdropTapMask [750x1334] Widget                 ← children[0]:ScalePopupTransition 把它当遮罩并做透明度动画
  - DialogStage [750x1334] Widget                     ← children[1]:ScalePopupTransition 对它做 0.1→1 backOut 缩放
    - DimmedMask  Sprite|Widget
    - ChoicePanel
      - PanelBackdrop / OfferBackdrop / TitleRibbon(TitleLabel "购买体力")
      - CloseButton  Button{click: EnergyPurchaseRoot.EnergyPurchaseView.close()}
      - VideoEnergyButton  RewardedVideoButton{rewardEvents: EnergyPurchaseView.claimVideoEnergy()}
        - VideoButtonBackground(VideoCurrencyIcon[VideoStatusIcon], VideoCostLabel) / VideoEnergyAmount / VideoRemainingCount
        - DisabledOverlay (inactive)
      - DiamondEnergyButton  Button{click: EnergyPurchaseView.purchaseWithDiamonds()}
        - DiamondButtonBackground(...) / DiamondEnergyAmount / DiamondRemainingCount / DisabledOverlay (inactive)
```
要点:
- **根节点名 `EnergyPurchaseRoot`** 就是元数据 key(`ViewMetadataNames.ts`:`"EnergyPurchaseView": ["EnergyPurchaseRoot"]`)。
- **固定结构契约**:`children[0]` 是遮罩、`children[1]` 是内容,`ScalePopupTransition` 按下标取节点。这个约定隐式又脆弱,3.x 版本应改成 `@property` 绑定 backdrop/content。
- 全部 Label 和 Button 都用 `@property` 绑定,按钮回调在 prefab 里配好;只有 `DisabledOverlay` 是运行时 `getChildByName` 取的(可以改成 `@property`)。

脚本:
```ts
@ccclass
@menu('ViewComponent/Shop/EnergyPurchaseView')
export class EnergyPurchaseView extends PopupView {
    @property(cc.Label) diamondCost: cc.Label | null = null;
    @property(cc.Node)  videoButtonNode: cc.Node | null = null;
    @property(cc.Button) purchaseButton: cc.Button | null = null;
    private ports: ShopDialogPorts | undefined;
    configureShopDialog(ports: ShopDialogPorts): void { this.ports = ports; }
    protected onOpen(): void { /* 读开关/每日次数 → 填 Label、置灰按钮 */ }
    purchaseWithDiamonds(): void { /* 扣钻石 → 加体力 → tips → bus.send(Item_GoodsChange) → this.close() */ }
    claimVideoEnergy(): void { /* RewardedVideoButton 回调 */ }
}
```
注册(`CocosShopViewBindings`):
```ts
// ShopDialogPorts.ts
EnergyPurchaseView: { layer: ViewLayer.Popup, queue: ViewQueue.None, bgm: 0, transition: ScalePopupTransition },
// configureComponent
if (dialogTypes.some(T => component instanceof T)) {
    (component as PopupView).configurePopup(this.popupPorts());
    (component as EnergyPurchaseView).configureShopDialog(this.dialogPorts());
    return 'configured';
}
```
打开:`BackpackProfile.ts:148 this.ports.ui.open('ui/ModeBackpackHero/M20_Pop_GetEnergy', new ViewArgs())`。这里传的是旧路径,经 `SOURCE_VIEW_ROUTES` 映射到 `features/shop/energy_purchase`。

### 3.2 game_catalogue_view.prefab / GameCatalogueView + ScrollableItemGrid
文件:`resources/features/settings/game_catalogue_view.prefab`、`game_catalogue_cell.prefab`、`scripts/features/settings/ui/GameCatalogueView.ts`(235)、`GameCatalogueCell.ts`(90)、`GameCatalogPorts.ts`(89)、`app/CocosGameCatalogueViewBindings.ts`(155)

```
- MoreGamesView [750x1334]  GameCatalogueView{nodeBindings->[#content,#content,#M30_ItemView,#page_pub,#page_knife,#icon_down,#icon_up,#icon_vs,#scrollview_knife];
                              labelBindings->[lockTips]; startGameBtn->@openGame; videoBtn->RewardedVideoButton@video;
                              knifeToggle/bulletsToggle/tideToggle->Toggle; myGridView->ScrollableItemGrid@page_pub; toggleContainer}
  - maskbg  Widget|BlockInputEvents
  - bg
    - page_pub [750x1069]  cc.ScrollView{content->#content} | Widget | ScrollableItemGrid{scrollView->@page_pub; contentNode->#content;
                                                                           cellTemplate=game_catalogue_cell.prefab; lineCellCount=1; autoScaleCells=false}
      - view  Mask|Widget
        - content [750x320]  Widget                   ← 由 Grid 设置尺寸、放置池化 cell
    - page_knife (inactive) …  scrollview_knife(ScrollView+Layout,非虚拟列表,子节点 M30_ItemView 运行时克隆)
    - Layout/openGame Button{click: GameCatalogueView.onClickOpenGame()} / video RewardedVideoButton{rewardEvents: onVideoUnlock()}
  - top/button_return Button{click: close()};  DiffSelect/btn{click: openReferencedView("ui/ModeChains/M33_Pop_DiffSelectGeneral")}
  - bottom/New ToggleContainer  toggle1..7 {checkEvents: GameCatalogueView.onClickToggle(30..36)}   ← customEventData 传模式 ID

game_catalogue_cell.prefab:
- MoreGamesItem [630x180]  GameCatalogueCell{lbl_name->@title; lbl_lv->@level_id; icon->@icon}
  - bg / tagbg / icon / title / level_id / lockTips / zbTips
  - Layout/openGame Button{click: MoreGamesItem.GameCatalogueCell.onClickOpenGame()}  / video RewardedVideoButton / notUnlock Button
```
要点:
- **ScrollableItemGrid 和 cc.ScrollView 挂在同一个节点上**(`page_pub`),结构是标准的 `view(Mask)/content`。cell 模板是独立 prefab,在 Inspector 里拖给 `cellTemplate`。
- 填数据只需一行:`this.myGridView.loadData(GameCatalogueRules.sortVisibleLevels(cfg.MiniGameLv.filter({type: mode}), ports))`。cell 的 `onRefresh(row, index)` 负责渲染。
- 反例(**不要学**):`nodeBindings[0..8]` 靠下标取节点;cell 内部又用 `getComByChild(cc.Label,'lockTips')`、`getComByPath(cc.Button,'Layout/openGame')` 做运行时查找,还在运行时改 `clickEvents[0].customEventData`。
- 注册:`{component: GameCatalogueView, layer: Main, queue: Panel, bgm: 101, transition: DeferredViewTransition}`;Grid 需要额外注入 `configureScrollableItemGrid(bus, timeline, {configureNodeTree})`。

---

## 4. 模块清单与复用判定

判定说明:
- **A = 原样复制到 3.8.8**(纯 TS,不引用 `cc.`;只需改 import 路径,可选清理"保留源 bug"的注释和行为)
- **B = 移植并修改**(列出需要的 2.x→3.x 改动)
- **C = 不复制**(业务、SDK、旧版兼容)

### 4.1 Core(纯逻辑)
| 模块 | 文件(行数) | 关键 API | 判定 | 依赖 / 备注 |
|---|---|---|---|---|
| 运行时端口 | `core/ports/RuntimePorts.ts`(41) | `Diagnostics, WallClock, DelayScheduler, ScheduledTask, StringStorage` | **A** | 所有模块的接口基础 |
| 事件总线 | `core/events/NotificationBus.ts`(92) `OrderedEvents.ts`(171) `SingleQueries.ts`(55) | `addListener/changeListener/send/isExist`、`addCall/call` | **A** | 依赖 RuntimePorts。删掉 `bindSourceNotifier` 兼容门面;建议把数字 ID 改成字符串或 `enum`,避免魔法数字 |
| 事件协议 | `core/protocol/*.ts` | `EventIds/QueryIds/NotificationIds/StorageKeys` | **C**(只借鉴形式) | 业务 ID,自己重新定义 |
| 定时器 | `core/time/Timeline.ts`(94) `ScheduledWatcher.ts`(85) `core/collections/MinimumSortedList.ts`(109) `FifoObjectPool.ts`(30) | `schedule/delay/cancelById/cancelByTag/advance` | **A** | 一组整体复制 |
| 游戏时钟 | `core/time/GameClock.ts`(142) | `serverTimeMs/setServerTime/advance/setScale` | **A** | 依赖 Timeline;单机游戏可删掉服务器时间部分,保留跨天和缩放 |
| 帧率/组件调度 | `core/time/FrameRateRegulator.ts`(22) `CocosGameScheduler.ts`(17) | — | B(价值低) | 可不要 |
| 通用对象池 | `core/collections/ReusablePool.ts`(306) `MutableValueMap.ts`(61) | `ReusablePoolManager/createSpawner/spawn/despawn` | **A** | runtime 注入 `schedule/createMap/getClassByName`;3.x 下 `js.createMap`、`js.getClassByName` 在 `cc` 的 `js` 里 |
| 配置表 | `core/config/ConfigurationTable.ts`(131) `ConfigurationCatalog.ts`(119) | `get/find/filter/lookup/getArray` | **A** | 依赖 Diagnostics |
| 配置清单/行类型 | `core/config/ConfigurationResources.ts`、`readers/*`、`*Table.ts`、`enums/*` | — | **C** | 业务表,按 Hexa 的表重写 |
| LZString | `core/encoding/DictionaryTextCodec.ts`(291) | `compressToBase64/decompressFromBase64` | **A** | 配置和存档压缩都用它 |
| MD5/AES/Base64 等 | `core/encoding/Md5Digest.ts`(153) `AesBlockCipher.ts`(144) `Base64Bytes.ts`(85) `BinaryBuffer.ts`(745) `Ieee754Bytes.ts` `LegacyMd5Digest.ts` | — | A(按需) | 单机一般只需要 Md5(存档校验);BinaryBuffer 是 protobuf 网络用的,**不需要** |
| 随机 | `core/random/SeededRandom.ts`(42) `WeightedSelection.ts`(144) | 种子随机、`weightedOne/weightedIndex/chance` | **A** | 关卡生成、每日题目可用 |
| MVC 控制器 | `core/mvc/FeatureController.ts`(86) `ControllerRegistry.ts`(43) `ModelRules.ts`(20) | `FeatureController<TModel>` + `setup/changeListener/isNewDay/setDay` | B(可选) | 带网络协议(`registerProtocol/httpPost`)。单机建议精简成 `Flow + Profile` 两个普通类 |
| `MvcOwners.ts` | (33) | 旧 MVC 全局门面 | **C** | 兼容层 |
| 日志 | `core/diagnostics/RuntimeLogger.ts`(130) | `runtimeLogger.log/warn/error/setLogEnable` | **A**(去掉 SDK 部分) | 默认 sink 是 `cc`,3.x 改成 `console` 或 `import {log, warn, error} from 'cc'`;删掉 `bindSdkLoggerType` |

### 4.2 UI 框架
| 模块 | 文件(行数) | 关键 API | 判定 | 需要的 3.x 改动 |
|---|---|---|---|---|
| 打开参数 | `shared/ui/ViewArgs.ts`(41) | `setParam/setCallback/setOpenCallback/setDelaySeconds/setIsNeedLoading` | **A** | 去掉 `nodeGroup`(2.x groupIndex),或改成 Layer |
| View 基类 | `shared/ui/ViewComponent.ts`(217) | 8 个抽象钩子、`open/show/hide/close/setNodeInfo/setUIMaskActive` | **B** | `cc._decorator` → `import {_decorator, Component, Node, BlockInputEvents, UITransform} from 'cc'`;`node.width/height` → `UITransform.setContentSize`;`mask.scale = x` → `setScale(v3)`;`addChild(mask, cc.macro.MAX_ZINDEX, 'UIMask')` → `addChild` 后 `setSiblingIndex(children.length-1)`;`cc.Event` → `EventTouch`;`'touchend'` → `Node.EventType.TOUCH_END`。建议把 `ResourceLease` 从继承改成组合(独立组件或 View 持有一个 lease) |
| UI 管理器 | `infrastructure/cocos/ViewCoordinator.ts`(288) | `open/close/getView/getTopViewByQueue/closeAllByLayer/closeQueues/openInQueue…` | **B** | 逻辑本身几乎不碰 `cc`,只用到 `cc.isValid` 和 `node.groupIndex`(删掉);新增 `onBack()` 返回键处理和 bundle 路径支持(`bundle:path`);去掉 `copyViews/forReverseDelayIds` 这类兼容注入,`emitViewEvent` 打点改成可选 |
| UI 根/分层 | `infrastructure/cocos/ViewRoots.ts`(112) | `initializeRoot/addSubCanvas/resetPosition` | **B** | 3.x 的 UI 节点必须在 Canvas 下才会渲染,所以**不要再建脱离 Canvas 的常驻 `_UIRoot`**。改为在启动场景 Canvas 下预置各层节点(prefab 或场景里用 `@property` 绑定,配 Widget 全屏);`cc.winSize` → `view.getVisibleSize()`;`cc.game.addPersistRootNode` → `director.addPersistRootNode`(只在需要跨场景时用);`cc.view.on('design-resolution-changed')` → `view.on('design-resolution-changed')` 或 `screen.on('window-resize')` |
| 页面工厂 | `infrastructure/cocos/CocosViewFactory.ts`(101) | `ViewAssetHandlers`、`load/instantiate/describe` | **B** | 删除 `metadataNames/eventSceneIdentity/source-rewrite`;元数据直接用 `@uiView({layer, queue, transition, bgm})` 装饰器写进 `Map<Constructor, Def>`(3.x 装饰器能直接拿到 class,不需要 `_RF.peek`) |
| 元数据 | `shared/ui/ViewMetadata.ts`(44) | `uilayer/uiqueue/transition/viewbgm` 装饰器 | **B** | `cc._RF.peek()` 是 2.x 内部 API,3.x 不可用,必须改写成 class 装饰器 |
| 过渡动画 | `shared/ui/ViewTransition.ts`(134) `ScalePopupTransition.ts`(55) `EaseOpacityTransition.ts`(57) | `Deferred/Scale/Opacity/ClipViewTransition` | **B** | `cc.tween(node).to(t,{opacity})` → 对 `UIOpacity` 组件做 tween;`{scale: 0.1}` → `{scale: new Vec3(0.1,0.1,1)}`;`cc.easing.backOut` → `{easing: 'backOut'}`;`stopAllActions` → `Tween.stopAllByTarget`;`node.children[0/1]` 下标契约 → `@property backdrop/content`;`cc.Animation.play('Show')` 在 3.x 基本兼容(`Animation` 组件) |
| 弹窗基类 | `shared/ui/PopupView.ts`(59) | `configurePopup`、`pauseCategory`、`openReferencedView` | **B** | 删掉 `nodeBindings/labelBindings` 数组和旧路径 `resolveLegacyPath`;暂停逻辑改成可选事件 |
| 虚拟网格 | `shared/ui/ScrollableItemGrid.ts`(468) + `shared/ui/grid/*`(11 个,约 450) | `loadData/scrollToCell/moveToTop/refreshVisibleNow` | **B**(核心推荐) | `grid/` 下 `IndexInterval/ModuloNodePool/RangeClamp/ScheduledGridRefresh/GridLayoutAlignment/GridViewProtocol/HorizontalGridLayout` 是纯逻辑,**A**;`VerticalGridLayout/GridCellScale/ItemLayout` 用到 `cc.Vec2`,改成 `Vec2` import。Grid 本体要改:`node.width/height` → `UITransform`;`node.position = cc.v2` → `setPosition(x,y,0)`;`node.scale *= r` → `setScale`;`node.on('scrolling')` → `scrollView.node.on(ScrollView.EventType.SCROLLING)`;`content.y`(3.x 是 `position.y`);`prefab.data.getAnchorPoint()` → `prefab.data.getComponent(UITransform).anchorPoint`;删掉私有 API `_onSiblingIndexChanged`、`_unregisterEvent`;`cc.Enum` → `Enum`;`configureScrollableItemGrid` 的强制注入改成可选(Timeline 用组件自己的 `schedule` 代替);用 `instantiate()` 替代 `configureNodeTree` |
| Grid Cell 基类 | `shared/ui/ItemGridCell.ts`(31) | `onInit/onRefresh(data,index)/onRefreshState` | **B** | 小改 import;总线注入改成全局 `App.bus` 或由 Grid 下发 |
| 回收列表 | `shared/ui/lists/RecycledListView.ts`(186) `RecycledListItem.ts`(15) `ListDataAdapter.ts`(8) | `adapter/initItem/updateItem` | B(备选) | 与 Grid 二选一,建议只保留 Grid |
| 抽屉/杂项 | `shared/ui/drawer/*` `SteppedSpriteProgress` `PlatformVisibility` `ResultTitleText` `PauseItem` | — | B(按需) | — |
| 安全区适配 | `infrastructure/cocos/visualadapters/SafeAreaWidgetAdjustment.ts`(64) | TOP/BOTTOM | B 或直接用 3.x 自带的 `SafeArea` 组件 | **推荐直接用 3.x 内置 `SafeArea`** |
| 数字滚动/星级 | `visualadapters/AnimatedNumericLabel.ts`(60) `TieredStarRating.ts`(69) | — | B(按需) | 结算页可用 |
| 新手引导遮罩 | `shared/tutorial/TutorialOverlay.ts`(223) `TutorialProgress.ts`(75) `TutorialFlow.ts`(56) | 聚焦挖孔、手指动画 | B(参考) | 业务耦合较重(Guide 表),参考思路后重写 |
| 红点 | `shared/badges/RedPointTree.ts`(104) `BadgePoint.ts`(69) `BadgeProfile.ts`(126) | 树状红点 | B(按需) | RedPointTree 基本是纯逻辑 |
| Alert/Toast | `infrastructure/cocos/AlertService.ts`(206) + `shared/alerts/*` | `showNormalTips/showAlert/showCommonTips/…` | B(参考) | 依赖大量业务(货币表、伤害飘字),建议只重写 `Toast + ConfirmDialog` 两种 |
| Loading 遮罩 | `shared/loading/LoadingView.ts`(44) `InputBlockerView.ts`(45) `LoadingFlow.ts`(68) | 监听 `Game_LoadingView` | B | 简单,改 import |
| `cc` 原型扩展 | `infrastructure/cocos/CocosNodeExtensions.ts`(165) `LocalizedTextWriter.ts`(216) `RuntimeGlobalUtilities.ts`(40) | `getComByChild/setActive/setAttribute/...` | **C** | 往引擎原型里注入方法,3.x 下不安全,也违反"禁止运行时扫描"的约束 |
| 动态组件安装器 | `infrastructure/cocos/CocosDynamicComponentInstaller.ts`(179) | hook 生命周期做注入 | **C** | — |
| 业务程序集 | `app/CocosBusinessViews.ts`(279) `CocosXxxViewBindings.ts`(30+ 个) | `configureNodeTree` 全树注入 | **C**(模式也不建议照搬) | — |

### 4.3 资源 / 音频 / 池(引擎层)
| 模块 | 文件(行数) | 判定 | 3.x 改动 |
|---|---|---|---|
| 资源加载 | `infrastructure/cocos/ResourceLoader.ts`(404) | **B** | `cc.resources` → `resources`;`cc.assetManager` → `assetManager`;**SpriteFrame 路径必须加 `/spriteFrame` 后缀**(或按 `SpriteFrame` 类型加载 `xxx/spriteFrame`);`new cc.SpriteFrame(texture)` → `const sf = new SpriteFrame(); sf.texture = tex`;`loadRemote` 远程图片 → `ImageAsset` 再转 `Texture2D` 再转 `SpriteFrame`;`sp.SkeletonData` → `import {sp} from 'cc'`;DragonBones 要额外 import `dragonBones`,不用可以删;**补上 bundle 加载**(`assetManager.loadBundle(name)`)和 bundle 级释放;修掉"永不 resolve"的 Promise 和迟到回调 |
| 引用计数归属 | `infrastructure/cocos/ResourceLease.ts`(63) | **B** | 只改 decorator import;`addRef/decRef` 在 3.x 的 `Asset` 上同名,可用 |
| 节点池 | `infrastructure/cocos/PrefabNodePool.ts`(60) `PooledPrefabNode.ts`(94) | **B** | `node.active/parent` 一致;依赖 ReusablePool 和 ResourceLoader;或直接用 3.x 的 `NodePool` |
| Spine 特效池 | `PooledSpineEffect.ts`(70) `ManagedSpine.ts`(154) | B(按需) | `sp.Skeleton` API 在 3.x 基本兼容 |
| 音频 | `infrastructure/cocos/AudioService.ts`(312) `CocosAudioSystem.ts`(34) | **B** | **`cc.audioEngine` 在 3.x 已删除**:音效改成 `AudioSource.playOneShot(clip, volume)`(多通道用多个 AudioSource),音乐用一个 `AudioSource` 设 `clip/loop/play`;`cc.AudioClip` → `AudioClip`;常驻节点改用 `director.addPersistRootNode`;建议播放接口改成 `play(key)`(字符串 key 或配置 id 都行),删掉 `RenamedAudioLoader/SourceAudioPaths`;微信小游戏音频中断时要在平台层调用 `pause/resume` |
| 配置加载 | `infrastructure/cocos/ConfigurationLoader.ts`(79) | **B** | `cc.resources.load(path, cc.TextAsset)` → `resources.load(path, TextAsset)`;也可以直接用 `JsonAsset` 不压缩(Hexa 自定) |
| 配置门面 | `infrastructure/cocos/ConfigurationFacade.ts`(394) | C(或大幅精简) | 远程配置、旧名映射单机用不上 |
| 视口 | `app/ApplicationViewport.ts`(23) `GameLauncher.fitDesignResolution` | B(参考) | 3.x 用 `view.setDesignResolutionSize(750,1334, ResolutionPolicy.FIXED_HEIGHT/SHOW_ALL)` 加 Widget |
| 自定义渲染 | `infrastructure/cocos/rendering/*` `engineleaves/*`(Assembler、shader uniform) | **C** | 2.x Assembler 和 3.x 渲染管线完全不同 |

### 4.4 数据 / 存档
| 模块 | 文件(行数) | 判定 | 备注 |
|---|---|---|---|
| 存储包装 | `infrastructure/persistence/PlatformStorage.ts`(281) | **B**(精简) | 保留 `get/set Bool/Number/String/Object` 和压缩;删掉 `SAVELIST`、云存档、RemoteSaveQueue(单机可后续再接微信云存档);`RawStorage` 由 `sys.localStorage` 注入(3.x 在微信小游戏下会自动适配 `wx.setStorageSync`) |
| 自动存档记录 | `infrastructure/persistence/JsonRecord.ts`(225) | **A**(推荐) | 纯逻辑,依赖 `StringStorage + DelayScheduler + WallClock + NewDayEvents`;`CoordinateValues.create` 注入 `v2` |
| 物品仓库 | `infrastructure/persistence/InventoryStore.ts`(180) | **A**(按需) | 道具/金币适用;依赖 `GoodsKind`(`shared/items/Goods.ts`,62 行,一起带上) |
| 同步存储/浏览器选择 | `SynchronousPlatformStorage.ts`(29) `BrowserSelectedStorage.ts`(25) | A(按需) | — |
| 用户会话 | `shared/profile/UserSession.ts` `UserProfile.ts` `RuntimeSwitches.ts` | **C** | 业务字段 |

### 4.5 平台 / SDK / 网络 / 打点
| 模块 | 文件 | 判定 | 备注 |
|---|---|---|---|
| 平台基类 | `infrastructure/platform/BasePlatform.ts`(108) | B(只借鉴接口) | 能力清单可以参考:`showVideoAD/showBanner/showInsertAd/vibrate/share/login/getStorageItem` |
| 微信 | `providers/WeChatMiniPlatform.ts`(208) | **C**(参考实现) | 写法是模拟 CommonJS 加全局变量。可借鉴的:`wx.createRewardedVideoAd` 的 onClose/isEnded 处理、1s 防连点、`onAudioInterruptionBegin/End`、`getUpdateManager`、`showShareMenu`。3.x 中 `wx` 是全局变量(需要 `declare const wx`) |
| Android 原生 | `providers/NativeAndroidPlatform.ts`(60) | **C**(参考实现) | 3.x 里 `jsb.reflection.callStaticMethod` → `native.reflection.callStaticMethod`(`import {native} from 'cc'`);Java 调 JS 要用 `CocosJavascriptJavaBridge.evalString` 回调到全局对象;类名 `com/cocos/game/AppActivity`(3.x 模板) |
| 其他渠道 | ByteDance/Kwai/Bilibili/Oppo/Vivo/Alipay/iOS/Juhe | **C** | 不在目标平台范围 |
| SDK 核心/模块缓存 | `platform/sdkcore/*` `modules/SourceModuleCache.ts` `app/CocosBackendSdkModules.ts` `StartupPlatformAdapter.ts` `SdkProtocolConfiguration.ts` | **C** | 旧 WonderSdk 兼容 |
| 网络 | `infrastructure/network/*`(Pomelo/protobuf/HTTP/WebSocket) | **C** | 单机不需要;以后要 HTTP 再写一个轻量的 `HttpClient` |
| 打点 | `infrastructure/analytics/*`(约 20 个) | **C** | ThinkingAnalytics |
| 广告编排 | `shared/advertising/AdvertisingFlow.ts`(81) `RewardedVideoButton.ts`(156) `VideoStatusIcon.ts`(60) | **B**(推荐 RewardedVideoButton) | 按钮:`@property([EventHandler]) rewardEvents` 在 prefab 里绑定奖励回调这个做法很好;要改:`cc.Component.EventHandler` → `EventHandler`、`cc.tween` scale 用 Vec3、`node.scale` 数值 → Vec3;删掉广告券和打点 |
| 登录协调 | `app/LoginCoordinator.ts`(214) | C(只参考步骤) | 带进度的启动步骤序列可以参考 |

### 4.6 本地化 / GM / 其他
| 模块 | 文件 | 判定 | 备注 |
|---|---|---|---|
| 语言目录/文本 | `infrastructure/localization/LanguageCatalog.ts`(83) `LanguageText.ts`(69) `CharacterConversionData.ts`(58) | **B** | 逻辑是纯的,但字典挂在 `window[name]` 上,改成实例字段;`cc.sys.language` → `sys.languageCode` |
| 本地化组件 | `LocalizedNode.ts`(23) | **B** | 改 import;建议做成常驻组件(带 `key`,监听语言切换),不要一次性自毁 |
| GM 面板 | `features/developer/*` | B(只拷模式) | "`Record<名称, 动作>` 字典 + 按钮模板克隆"的做法简单好用;动作要按 Hexa 重写;键盘监听 `cc.systemEvent` → `input.on(Input.EventType.KEY_DOWN)` |
| 自检场景 | `app/FoundationProbe.ts` `foundation_boot.fire` | C | — |
| 工具函数 | `shared/GameUtilities.ts`(431) | B(挑着拷) | `formatSeconds/changeSecondToClock/prefixZero/splitThousands/compareVersion/secondsUntilNextDay` 值得要;其中 `cc.Vec2` 相关改成 `Vec2/Vec3` |
| 旧路径映射 | `app/SourceViewRoutes.ts` `SourceViewRequests.ts` `SourceViewCloseKeys.ts` `SourceViewEventScenes.ts` `ViewMetadataNames.ts` `infrastructure/cocos/SourcePrefabPaths.ts` `SourceSpritePaths.ts`(1133) `SourceSpinePaths.ts` `SourceAudioPaths.ts` `FontResourceIdentity.ts` | **C** | 只服务于"重写旧游戏" |
| 兼容空壳 | `shared/compatibility/*`(13 个 2 行文件) | **C** | — |
| 战斗/模式/业务 | `features/*`(combat、modes、backpack…)、`app/Cocos*ActorBindings/ManagerPorts` | **C** | 包括 `features/modes/zqddn_physics/*`(物理解谜,约 3000 行,2.x 物理 API,与六边形拼图无关) |

### 4.7 模块依赖关系(建议复制顺序)
```
RuntimePorts
 ├─ RuntimeLogger
 ├─ NotificationBus(OrderedEvents, SingleQueries)
 ├─ FifoObjectPool → MinimumSortedList → ScheduledWatcher → Timeline → GameClock
 ├─ ReusablePool → PrefabNodePool/PooledPrefabNode(+ResourceLoader)
 ├─ ConfigurationTable → ConfigurationCatalog ← ConfigurationLoader(+DictionaryTextCodec, resources)
 ├─ DictionaryTextCodec → PlatformStorage → JsonRecord / InventoryStore(+Goods)
 └─ SeededRandom / WeightedSelection
ResourceLease → ResourceLoader
ViewArgs, ViewTransition(→ScalePopup/Opacity) ──┐
ResourceLease → ViewComponent ──────────────────┼→ ViewCoordinator(+ViewRoots, ViewFactory/ViewMetadata, Timeline 作为 DelayScheduler, Audio 作为 bgm)
                                                 └→ PopupView → 业务 View
grid/*(纯逻辑) → ScrollableItemGrid → ItemGridCell(+NotificationBus)
AudioService(+ResourceLoader, Sound 配置表, NotificationBus 的 update/pause)
LanguageCatalog → LanguageText → LocalizedNode
```

---

## 5. 编码约定

### 5.1 命名
- **脚本文件 / 类名**:PascalCase,文件名和类名一致(`EnergyPurchaseView.ts` → `class EnergyPurchaseView`),一个文件一个主类,具名导出(`export class`,少数地方额外 `export default`)。
- **后缀语义**:`XxxView`(页面组件)、`XxxCell / XxxItem / XxxCard`(列表单元)、`XxxFlow`(控制器,原 Controller)、`XxxProfile`(数据模型,原 Model)、`XxxPorts`(依赖接口)、`XxxRules`(纯规则函数)、`CocosXxxViewBindings`(装配/注入程序集)、`XxxPresentation`(layer/queue 声明)。
- **资源**:prefab 和图片都用 snake_case(`energy_purchase.prefab`、`game_catalogue_cell.prefab`、`media/energy_purchase_background.png`);按功能分目录 `resources/features/<feature>/`,图片放 `media/` 子目录。
- **prefab 内节点名**:PascalCase 语义名(`DiamondEnergyButton`、`DisabledOverlay`)。老 prefab 里仍有 `lbl_name`、`btn`、`New Node` 这类旧名。
- **组件菜单**:`@menu('ViewComponent/<Feature>/<ViewName>')`,工具组件用 `@menu('util/…')`。
- **成员**:camelCase;`@property` 字段初始化为 `null` 并声明 `| null`;私有端口字段 `ports` 配 `runtime` getter,缺失时抛 `TypeError('Xxx requires ...')`。
- 注释和提示文案大量使用中文;代码注释英文。

### 5.2 一个功能一个文件夹
```
scripts/features/shop/
  ShopFlow.ts            # 控制器:订阅事件、打开页面
  ShopProfile.ts         # 数据:JsonRecord/InventoryStore
  ui/ShopPageView.ts  ui/EnergyPurchaseView.ts  ui/ShopProductCard.ts ...
  ui/ShopDialogPorts.ts  # 该组 View 的依赖接口 + PRESENTATION(layer/queue/transition)
resources/features/shop/
  energy_purchase.prefab  shop_page.prefab ...  media/*.png
scripts/app/CocosShopViewBindings.ts   # 注册 + 注入
```

### 5.3 BigHero 中新增一个页面的完整步骤
1. **写脚本** `scripts/features/<f>/ui/FooView.ts`:
   ```ts
   const { ccclass, property, menu } = cc._decorator;
   @ccclass @menu('ViewComponent/<F>/FooView')
   export class FooView extends PopupView {
       @property(cc.Label) titleLabel: cc.Label | null = null;
       private ports?: FooPorts;
       configureFoo(ports: FooPorts) { this.ports = ports; }
       protected onOpen() { /* 读 this.openArgs.param,填 UI */ }
       protected setInfo() {}
       protected onClose() {}
       onClickConfirm() { ...; this.close(); }
   }
   ```
   需要的话另写 `FooPorts.ts` 声明依赖接口。
2. **做 prefab** `resources/features/<f>/foo_view.prefab`:根节点(全屏 750×1334)挂 `FooView`;用 `ScalePopupTransition` 时 **children[0] 必须是遮罩、children[1] 必须是内容**;`@property` 在 Inspector 里拖好;按钮 `clickEvents` 绑到根节点 `FooView.onClickConfirm` / `close`。
3. **登记元数据**:在 `app/ViewMetadataNames.ts` 添加 `"FooView": ["<prefab 根节点名>"]`。
4. **注册和注入**:在对应 `CocosXxxViewBindings` 的 `createViewDefinitions()` 里加 `{component: FooView, createDefinition: () => ({layer: ViewLayer.Popup, queue: ViewQueue.None, bgm: 0, transition: new ScalePopupTransition(services.defer)})}`;在 `configureComponent()` 里加 `if (component instanceof FooView) { component.configurePopup(...); component.configureFoo(...); return 'configured'; }`。新建的程序集要加到 `CocosEngineEntry.createCocosProductionDependencies` 的 `componentAssemblies` 数组里。
5. (仅在需要旧路径调用时)在 `SOURCE_VIEW_ROUTES` 里加旧路径映射。
6. **打开**:`context.views.open('features/<f>/foo_view', new ViewArgs().setParam({...}))`,或者在某个 Flow 里监听事件后打开。

> 一个页面要改 4~5 个地方(其中 2 个是全局大文件),而且注册写错只能在运行时发现。Hexa-Puzzle 应该改成"一个装饰器加 prefab 路径常量"的方式(见第 6 节)。

---

## 6. 迁移到 Hexa-Puzzle(3.8.8)的建议

### 6.1 目标目录(遵循目标工程 AGENTS.md)
```
assets/scripts/framework/
  core/      RuntimePorts, Logger, events/(NotificationBus...), time/(Timeline, GameClock...), collections/(ReusablePool, MinimumSortedList, FifoObjectPool), random/, encoding/(LZString, Md5)
  config/    ConfigTable, ConfigCatalog, ConfigLoader(3.x)
  storage/   LocalStorage(PlatformStorage 精简版), JsonRecord, InventoryStore
  res/       ResLoader(3.x, 支持 bundle), ResourceLease
  ui/        UIManager(=ViewCoordinator), ViewBase(=ViewComponent), PopupBase, ViewArgs, uiView 装饰器, transitions/, grid/(ScrollableItemGrid + helpers), ItemGridCell
  audio/     AudioService(AudioSource 版)
  i18n/      LanguageCatalog, LanguageText, LocalizedLabel
  platform/  IPlatform + WebPlatform / WeChatPlatform / AndroidPlatform(新写,参考 bighero 的广告/中断/JNI 处理)
  debug/     GmPanel(字典驱动)
assets/resources/framework/   通用 prefab:toast、confirm_dialog、loading_mask、gm_panel、ui_layers
tools/framework/reference-manifest.json   每个复制文件登记 来源路径 / 判定(A/B)/ 改动摘要
```

### 6.2 关键改造点
1. **注入方式**:删掉 `configureNodeTree` 全树扫描。改为 `UIManager` 实例化 prefab 后,**只对根 View 调用 `view.init(ctx)`**,ctx 是 `App` 单例上下文(bus/res/audio/storage/config/platform)。子组件(cell、按钮)要依赖时,由 View 通过 `@property` 拿到引用后显式传入,或者直接读 `App` 单例。这样同时满足"禁止运行时扫描名称、补整棵 UI 树"。
2. **元数据**:用 3.x class 装饰器直接注册:
   ```ts
   @ccclass('EnergyPurchaseView')
   @uiView({ path: 'framework/xxx' /* 或 bundle:path */, layer: UILayer.Popup, queue: UIQueue.None, transition: ScaleTransition })
   export class EnergyPurchaseView extends PopupBase { ... }
   UIManager.open(EnergyPurchaseView, args)   // 用类型打开,不再写字符串路径
   ```
3. **过渡动画**:backdrop 和 content 用 `@property` 绑定,不再靠 children 下标;透明度动画用 `UIOpacity`。
4. **UI 分层**:启动场景 Canvas 下预置 `Layer_Scene … Layer_Loading` 节点(Widget 全屏),UIManager 用 `@property` 引用它们;不建脱离 Canvas 的 `_UIRoot`。
5. **返回键**:UIManager 统一处理 `KeyCode.MOBILE_BACK`(Android):关闭 Popup 栈顶;栈空时交给当前 Panel 的 `onBack()`;最终弹出"退出游戏"确认。微信小游戏没有物理返回键。
6. **资源**:ResLoader 支持 `bundleName`;页面关闭时由 ResourceLease 统一 decRef;异步回调要检查 `isValid` 并统一 reject/resolve,防止迟到结果写到已销毁节点上;Hexa 已有 `assets/bundles/*`,View 路径可写成 `bundle:path`。
7. **音频**:用 AudioSource 重写,微信下由平台层注册 `wx.onAudioInterruptionBegin/End` 调 `pause/resume`。
8. **事件 ID**:改成 `enum`(数字或字符串都可以)按模块分段,禁止在调用处写魔法数字。
9. **修掉 BigHero 故意保留的源 bug**(注释里写着 "Source intentionally…" 或 "The original … can throw" 的地方),例如 `ViewCoordinator.onClose` 里队列下标越界、`PlatformStorage.isEmpty` 把 `0/false` 当成空、`ConfigurationTable.lookup` 跨重载缓存、`ResourceLoader` 的 Promise 永久 pending。

### 6.3 2.x → 3.x API 对照(本工程实际用到的)
| 2.4 | 3.8 |
|---|---|
| `const {ccclass, property} = cc._decorator` / 全局 `cc.Xxx` | `import { _decorator, Component, Node, Label, ... } from 'cc'`;`@ccclass('ClassName')` 需显式写类名 |
| `cc.Class` | 本工程没用(已经是 TS 装饰器) |
| `node.width/height/anchorX/anchorY/getContentSize` | `node.getComponent(UITransform).width/.setContentSize/.anchorPoint` |
| `node.opacity` | `UIOpacity` 组件 |
| `node.scale = 0.9`(数字)、`node.scaleX` | `node.setScale(0.9, 0.9, 1)` / `node.scale = v3(...)` |
| `node.position = cc.v2(x,y)`、`node.x/y` | `node.setPosition(x, y, 0)`、`node.position.x`(只读,需要 set) |
| `node.zIndex`、`cc.macro.MAX_ZINDEX` | `node.setSiblingIndex()` |
| `node.groupIndex`、collisionMatrix | `node.layer`(Layers)/ 物理分组在项目设置里 |
| `node.angle` | 3.x 同名(`angle`)可用 |
| `cc.winSize` / `cc.view.getCanvasSize` | `view.getVisibleSize()` / `screen.windowSize` |
| `cc.game.addPersistRootNode` | `director.addPersistRootNode` |
| `cc.Canvas.fitHeight/fitWidth` | `view.setResolutionPolicy(ResolutionPolicy.FIXED_HEIGHT)` 或项目设置 |
| `cc.audioEngine.playEffect/playMusic` | `AudioSource.playOneShot` / `AudioSource.play`(audioEngine 已删除) |
| `cc.loader.loadRes`(本工程只剩 2 处) / `cc.resources.load` | `resources.load` / `assetManager.loadBundle(...).load` |
| 加载 SpriteFrame:`'img/a'` | `'img/a/spriteFrame'`(或按 Texture `'img/a/texture'`) |
| `new cc.SpriteFrame(texture)` | `const sf = new SpriteFrame(); sf.texture = tex;` |
| `cc.tween(n).to(t,{scale:1, opacity:255},{easing: cc.easing.backOut})` | `tween(n).to(t,{scale: v3(1,1,1)},{easing:'backOut'})`;opacity 对 `UIOpacity` 做 tween |
| `node.stopAllActions()` | `Tween.stopAllByTarget(node)` |
| `cc.Component.EventHandler` | `EventHandler` |
| `cc.Enum`、`cc.js.formatStr`、`cc.misc.lerp` | `Enum`、`js.formatStr`、`math.lerp` |
| `cc.sys.localStorage`、`cc.sys.language` | `sys.localStorage`、`sys.languageCode` |
| `cc.systemEvent.on(KEY_DOWN)`、`cc.macro.KEY.g` | `input.on(Input.EventType.KEY_DOWN)`、`KeyCode.KEY_G`;返回键 `KeyCode.MOBILE_BACK` |
| `cc.Event.stopPropagation()`、`'touchend'` | `EventTouch` / `Node.EventType.TOUCH_END`;`propagationStopped = true` |
| `cc.director.getPhysicsManager()` | `PhysicsSystem2D.instance` |
| `cc.isValid` | `isValid` |
| `CC_EDITOR` | `import { EDITOR } from 'cc/env'` |
| `jsb.reflection.callStaticMethod` | `native.reflection.callStaticMethod` |
| `cc._RF.peek()`(装饰器取当前脚本) | 不可用,直接用 class 装饰器参数 |
| `cc.LabelOutline` 组件 | 3.8 用 `Label.enableOutline/outlineColor/outlineWidth`(LabelOutline 已废弃) |
| `cc.RenderComponent` / 自定义 Assembler | 3.x 渲染管线完全不同,不移植 |
| 2.x `.prefab` / `.fire` / `.meta` | **不能直接复制**,必须在 3.8.8 中按结构重建(目标 AGENTS.md 也禁止复制) |

### 6.4 可以直接参照的 prefab 制作规范(取自两个范例)
- 页面/弹窗根节点全屏(750×1334 + Widget),**根节点挂 View 组件,节点名稳定**;
- 弹窗统一结构 `Root{View} / Backdrop(遮罩, BlockInputEvents) / Content(面板)`,Backdrop 和 Content 用 `@property` 绑定给过渡动画;
- 所有要访问的 Label/Sprite/Button/子节点都用 `@property` 绑定(不使用 `nodeBindings[i]` 下标数组);
- 按钮点击在 prefab 的 `clickEvents` 里绑到根 View 的 public 方法,参数用 `customEventData`;
- 列表:`ScrollView + view(Mask) + content` 与 `ScrollableItemGrid` 挂在同一节点,`cellTemplate` 指向独立的 cell prefab;cell 根节点挂 `ItemGridCell` 子类,其内部引用也用 `@property`;
- 置灰、禁用状态做成 prefab 里预置的 inactive 节点(如 `DisabledOverlay`),用 `@property` 引用后切换 `active`;
- 广告按钮:`RewardedVideoButton` 加 `rewardEvents` 在 prefab 里绑定奖励回调。

---

## 附录 A:A 类(可原样复制)文件清单
```
core/ports/RuntimePorts.ts
core/events/NotificationBus.ts  OrderedEvents.ts  SingleQueries.ts
core/time/Timeline.ts  ScheduledWatcher.ts  GameClock.ts
core/collections/FifoObjectPool.ts  MinimumSortedList.ts  ReusablePool.ts  MutableValueMap.ts
core/config/ConfigurationTable.ts  ConfigurationCatalog.ts
core/encoding/DictionaryTextCodec.ts  Md5Digest.ts (按需 Base64Bytes / AesBlockCipher)
core/random/SeededRandom.ts  WeightedSelection.ts
core/diagnostics/RuntimeLogger.ts (删除 SDK logger 部分)
infrastructure/persistence/JsonRecord.ts  InventoryStore.ts  SynchronousPlatformStorage.ts
infrastructure/localization/LanguageCatalog.ts  LanguageText.ts  CharacterConversionData.ts (window 依赖需改实例字段)
shared/ui/ViewArgs.ts
shared/ui/grid/IndexInterval.ts  ModuloNodePool.ts  RangeClamp.ts  ScheduledGridRefresh.ts  GridLayoutAlignment.ts  GridViewProtocol.ts  HorizontalGridLayout.ts  GridHelperExports.ts
shared/ui/lists/ListDataAdapter.ts
shared/items/Goods.ts (InventoryStore 依赖)
```
(以上文件通过 `grep -c 'cc\.'` 验证为 0 次引用 `cc.`。)

## 附录 B:关键路径速查
- 启动:`assets/scenes/application_boot.fire`、`scripts/app/CocosEngineEntry.ts`、`ApplicationBoot.ts`、`GameLauncher.ts`、`CocosApplication.ts`、`ApplicationServices.ts`、`LoginCoordinator.ts`
- UI:`scripts/infrastructure/cocos/ViewCoordinator.ts`、`ViewRoots.ts`、`CocosViewFactory.ts`;`scripts/shared/ui/ViewComponent.ts`、`PopupView.ts`、`ViewArgs.ts`、`ViewMetadata.ts`、`ViewTransition.ts`、`ScalePopupTransition.ts`
- 列表:`scripts/shared/ui/ScrollableItemGrid.ts`、`shared/ui/grid/*`、`shared/ui/ItemGridCell.ts`、`shared/ui/lists/*`
- 范例:`resources/features/shop/energy_purchase.prefab` + `scripts/features/shop/ui/EnergyPurchaseView.ts` + `ShopDialogPorts.ts` + `app/CocosShopViewBindings.ts`;`resources/features/settings/game_catalogue_view.prefab` / `game_catalogue_cell.prefab` + `scripts/features/settings/ui/GameCatalogueView.ts` / `GameCatalogueCell.ts` + `app/CocosGameCatalogueViewBindings.ts`
- 资源:`scripts/infrastructure/cocos/ResourceLoader.ts`、`ResourceLease.ts`、`PrefabNodePool.ts`
- 事件:`scripts/core/events/*`、`core/protocol/*`、`app/ApplicationNotifications.ts`
- 存档:`scripts/infrastructure/persistence/*`
- 配置:`scripts/core/config/*`、`infrastructure/cocos/ConfigurationLoader.ts`、`resources/config/*.txt`
- 音频:`scripts/infrastructure/cocos/AudioService.ts`、`CocosAudioSystem.ts`
- 平台:`scripts/infrastructure/platform/BasePlatform.ts`、`providers/WeChatMiniPlatform.ts`、`providers/NativeAndroidPlatform.ts`
- 本地化:`scripts/infrastructure/localization/*`
- GM:`scripts/features/developer/*`
