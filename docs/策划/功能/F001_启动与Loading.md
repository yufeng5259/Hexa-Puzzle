# F001 启动与Loading

基线日期：2026-10-28。分类：基础框架；当前状态：**基础已具备**。本篇为开发交接策划，不是新增实现或验收报告；后续完成状态以功能完成目录与对应新证据为准。

## 目标、边界与前置

本地基础资源与题库准备完成后自动进入综合地图，保留现有唯一FoundationBoot。 已具备范围是资源启动链；接入玩家存档后要补启动恢复与失败原子性，不新增登录或离线菜单。

前置：无业务前置；遵守全项目素材、Prefab与资源生命周期约束。

## 当前事实与确切来源

FoundationBoot.start 校验 host、loadingPrefab、statusLabel 后打开Loading，读取 source-art-manifest 与 prefab-registry，再由独立 catalogScope 加载题库，成功后 replacePage(mainline-map)。当前不读取玩家档，不存在账号登录；ready只代表本地准备完成。

当前证据：[Project/assets/scripts/app/FoundationBoot.ts:64](../../../assets/scripts/app/FoundationBoot.ts#L64)；[Project/assets/scenes/Main.scene:635](../../../assets/scenes/Main.scene#L635)。规则参考以[唯一原型策划案](../../../../prototype/策划案.md)、[落地方案](../../../../prototype/Cocos落地开发方案.md)为来源；原型脚本不等于生产已接入。旧G005–G010、备份工程和全套Prefab存在均不作当前业务完成证明。

## 数值规则与状态流程

状态为未开始→准备登记→装载题库→展示地图；任何一步失败停留可理解的失败状态，不跳过校验进入半成品地图。后续接F017时，校验和恢复档案须在提交首页前完成；无档创建默认档，有坏档走恢复流程，不能直接覆盖。进度只反映真实阶段，不能以定时器伪装下载完成。

## 数据权威、提交与幂等

保留ready、disposed、当前请求身份、manifest/目录版本和启动失败原因；这些是运行态，不是奖励凭证。玩家状态只由F017装载和提交，启动重入不重发初始钱包或离线奖励。候选资源与候选玩家快照均成功才提交入口，失败保留原数据。

## 页面、美术与Prefab接入

目录页面标识：`loading`。这些是策划状态标识，运行时实际Prefab路由以UIFlow/登记表为准。

场景 Main.scene 的唯一 FoundationBoot 继续负责装配；host:ViewHost、loadingPrefab:Prefab、statusLabel:Label 为必填引用。LoadingPageView的状态文字和进度通过既有Label绑定；不要在start中建立第二套Canvas、菜单或Prefab树。

- [LoadingPage.prefab](../../../assets/resources/boot/LoadingPage.prefab)，脚本[LoadingPageView.ts](../../../assets/scripts/features/boot/ui/LoadingPageView.ts)；现有typed绑定：`visualRoot:Node`、`dynamicRoot:Node`、`statusLabel:Label`、`progressLabel:Label`。美术来源：主图。

原稿/切图登记沿用[source-art-manifest](../../../assets/resources/framework/config/source-art-manifest.json)与[prefab-registry](../../../assets/resources/framework/config/prefab-registry.json)；静态装饰保留来源布局，真实文字、数值和状态独立绑定。未列业务字段需在所属正式Prefab补typed@property及序列化事件，不扫描名称或补整棵树。

## 生命周期与失败处理

销毁置请求失效并释放启动目录scope，页面资源由页面释放；晚到的题库不能再次开首页。重试必须明确触发且复用同一入口，缺绑定报出字段名，读取失败不能记作新用户首次初始化成功。

## 开发验收场景

1. 新安装仅一个Loading，资源与目录成功后进入地图，不出现登录菜单。
2. 模拟题库装载失败：保留失败提示，不显示可点击半成品地图。
3. 加载中销毁入口，晚到回调不创建页面且scope被释放。
4. 重复启动/重试不产生第二入口，不重复写入初始余额。
5. 存在有效档/损坏档时分别恢复/保留备份，未保存成功不宣布就绪。

## 未知与交付边界

目前Loading的业务恢复与可操作重试需要后续接入；真实启动性能和目标设备证据不在本次策划中生成。 本次仅编写策划，未运行Creator、生成器、服务或测试。唯一原型仍为prototype/及4291，参考BigHero只读；后续遵守[项目约束](../../../../docs/PROJECT_CONSTRAINTS.md)。