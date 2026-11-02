# F004 通用Prefab组件与绑定

基线日期：2026-10-28。分类：基础框架；当前状态：**基础已具备**。本篇为开发交接策划，不是新增实现或验收报告；后续完成状态以功能完成目录与对应新证据为准。

## 目标、边界与前置

正式Prefab预挂组件与Inspector引用，复用现有按钮、HUD、标题、进度与提示组件；视觉稿差异另验。

前置：[F003 资源加载与页面所有权](F003_资源加载与页面所有权.md)

## 当前事实与确切来源

SerializedView保存stateRoots、stateIds、sourceLayouts并验证长度与空引用。通用按钮、HUD、标题、对话框、进度、开关、Toast有正式Prefab与类型化字段；存在模板不代表钱包、设置或奖励业务已经接入。

当前证据：[Project/docs/prefab-foundation.md:61](../../../docs/prefab-foundation.md#L61)；[Project/assets/scripts/ui/common/SerializedView.ts:1](../../../assets/scripts/ui/common/SerializedView.ts#L1)。规则参考以[唯一原型策划案](../../../../prototype/策划案.md)、[落地方案](../../../../prototype/Cocos落地开发方案.md)为来源；原型脚本不等于生产已接入。旧G005–G010、备份工程和全套Prefab存在均不作当前业务完成证明。

## 数值规则与状态流程

组件展示输入数据并输出意图，不持有经济和关卡权威。普通按钮防重复动作由业务事务配合；HUD显示真实快照，未接业务显示阶段说明，不能把原稿数字当余额。Toast不阻塞免费路径，进度约束在合法区间；开关保存成功才确认最终状态。

## 数据权威、提交与幂等

公共展示模型仅含text、icon/assetId、value、max、enabled、selected等只读输入；实际字段按已有组件接口接入，不把这些策划名当现成API。唯一玩家值来自F017，经济通过F019事务；固定按钮事件归对应功能组件。

## 页面、美术与Prefab接入

无独立产品页面；通过所属页面或应用装配接入，不新增平行入口。

下列清单逐件列出真实资源与绑定。页面中优先复用现成子Prefab，固定层级、锚点、Widget/Layout、Button与事件在Prefab保存；稳定引用用具体@property类型，必需字段缺失即报错。禁止按长路径找节点或运行时补树。

- [CommonButton.prefab](../../../assets/resources/framework/CommonButton.prefab)，脚本[CommonButtonView.ts](../../../assets/scripts/ui/common/CommonButtonView.ts)；现有typed绑定：`content:Node`、`button:Button`、`background:Sprite`、`label:Label`。美术来源：T01-01_普通拼图开局。
- [IconButton.prefab](../../../assets/resources/framework/IconButton.prefab)，脚本[IconButtonView.ts](../../../assets/scripts/ui/common/IconButtonView.ts)；现有typed绑定：`content:Node`、`button:Button`、`icon:Sprite`。美术来源：T02-01_普通异形拼图_三块。
- [ResourceHUD.prefab](../../../assets/resources/framework/ResourceHUD.prefab)，脚本[ResourceHUDView.ts](../../../assets/scripts/ui/common/ResourceHUDView.ts)；现有typed绑定：`content:Node`、`honeyLabel:Label`、`hintLabel:Label`、`avatar:Sprite`、`settingsButton:Button`。美术来源：T15-01_家园_五级建设基础。
- [ResourceCounter.prefab](../../../assets/resources/framework/ResourceCounter.prefab)，脚本[ResourceCounterView.ts](../../../assets/scripts/ui/common/ResourceCounterView.ts)；现有typed绑定：`content:Node`、`icon:Sprite`、`valueLabel:Label`、`addButton:Button`。美术来源：T15-01_家园_五级建设基础。
- [TitleBar.prefab](../../../assets/resources/framework/TitleBar.prefab)，脚本[TitleBarView.ts](../../../assets/scripts/ui/common/TitleBarView.ts)；现有typed绑定：`content:Node`。美术来源：T39-01_声音与易用设置。
- [DialogFrame.prefab](../../../assets/resources/framework/DialogFrame.prefab)，脚本[DialogFrameView.ts](../../../assets/scripts/ui/common/DialogFrameView.ts)；现有typed绑定：`content:Node`。美术来源：T36-01_局内暂停。
- [ProgressDisplay.prefab](../../../assets/resources/framework/ProgressDisplay.prefab)，脚本[ProgressDisplayView.ts](../../../assets/scripts/ui/common/ProgressDisplayView.ts)；现有typed绑定：`content:Node`、`progressBar:ProgressBar`、`valueLabel:Label`。美术来源：主图。
- [SettingToggle.prefab](../../../assets/resources/framework/SettingToggle.prefab)，脚本[SettingToggleView.ts](../../../assets/scripts/ui/common/SettingToggleView.ts)；现有typed绑定：`content:Node`、`button:Button`、`onRoot:Node`、`offRoot:Node`、`label:Label`。美术来源：T39-01_声音与易用设置。
- [ToastView.prefab](../../../assets/resources/framework/ToastView.prefab)，脚本[ToastView.ts](../../../assets/scripts/ui/common/ToastView.ts)；现有typed绑定：`content:Node`、`messageLabel:Label`。美术来源：通用组件，无独立整页原稿。

原稿/切图登记沿用[source-art-manifest](../../../assets/resources/framework/config/source-art-manifest.json)与[prefab-registry](../../../assets/resources/framework/config/prefab-registry.json)；静态装饰保留来源布局，真实文字、数值和状态独立绑定。未列业务字段需在所属正式Prefab补typed@property及序列化事件，不扫描名称或补整棵树。

## 生命周期与失败处理

显示时订阅，隐藏解除，销毁取消延迟Toast与异步图请求；重绑必须重置文字、禁用态与回调。晚到图只允许覆盖匹配的绑定身份；所有组件借用所在页面scope，不清另一页面资源。

## 开发验收场景

1. 逐个正式Prefab实例化校验，缺任一必填字段时报组件与字段名。
2. HUD绑定0和大数后切页再回，数值来自统一快照且无旧图残留。
3. 按钮连击由调用方事务只提交一次，禁用时不触发。
4. 开关保存失败回旧态并提示，不能显示已保存。
5. 反复show/hide/close和图片迟到回调无监听增长、无复活节点。

## 未知与交付边界

公共组件完整视觉差异与业务适配逐页面验收；不因九个模板存在把全部页面标完成。 本次仅编写策划，未运行Creator、生成器、服务或测试。唯一原型仍为prototype/及4291，参考BigHero只读；后续遵守[项目约束](../../../../docs/PROJECT_CONSTRAINTS.md)。
