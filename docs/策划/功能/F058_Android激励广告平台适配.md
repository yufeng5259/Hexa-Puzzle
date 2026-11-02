# F058 Android激励广告平台适配

更新：2026-10-28。当前状态：**业务未接入**；本篇是后续开发合同，本轮仅文档核对，未运行服务、Creator或平台SDK。

## 目标与依赖

让Android真实激励SDK通过统一Adapter接入F052，保留原生回执直到领域奖励确认持久化。

前置：[F052 激励广告事务状态与频控](F052_激励广告事务状态与频控.md)。优先复用现有app/Controller/Session/服务，不新增第二套存档或奖励权威。

## 当前证据与缺口

native/engine/android仍有SDKHandleClass，使用BuildConfig.IAA_ADS_ENABLED门禁、Activity弱引用、hostGeneration及RewardLedger；已有Java不能证明新assets/scripts装配已调用，也不能恢复旧TS框架宣称完成。先核对桥协议、原生依赖与新app注入边界。

具体依据：[SDKHandleClass.java 第1行](../../../native/engine/android/app/src/com/hexa/block/puzzlegame/SDKHandleClass.java)；[Cocos落地验收规范.md 第49行](../../../../prototype/Cocos落地验收规范.md)。路由、来源与Prefab登记见[功能清单](../功能清单.json)。

## 页面、美术与入口

原型路由：无独立页面，沿所属业务入口/开发流程触发。唯一原型[prototype](../../../../prototype/index.html)固定4291端口。美术以[现行原型策划](../../../../prototype/策划案.md)与[验收规范](../../../../prototype/Cocos落地验收规范.md)为来源，不另绘已有成品。

无本功能专属Prefab；复用上述前置功能的正式资源及现有资源所有权边界。

## 规则与状态

由业务请求创建并持久pending后调用桥，SDK加载、展示、取消、无填充、错误、奖励回调映射为有限状态；关闭并非完整观看。仅真实奖励回调可进入待提交，超时不补奖。Activity暂停/恢复/重建与进程重启分别处理，线程切换和host generation防止回调送错实例。广告关闭后只释放本广告暂停令牌，免费玩法能继续。

## 数据、事务与幂等

桥消息携带requestId/profile与协议版本，新TS回执入口仍交F052核验原归属。原生receiptId与请求快照建立稳定索引，领域durable commit后才ACK；写失败、未知profile、无法识别旧V3请求均保留原生队列，不猜归属、不ACK。原生持久队列不并入GM导出，dev默认使用模拟Adapter，prod迟到回执不写dev。初始化、消费和ACK都应可重试并幂等。

## 接入与生命周期

本功能没有独立页面Prefab；平台/验收能力经现有组合层和窄端口装配，需要反馈时复用前置功能正式UI，不另造整页。涉及现有页面的字段仍用typed @property和序列化固定事件。 显示时订阅、隐藏解除，销毁使请求代次失效，先销毁实例再释放scope资源；异步迟到不复活旧页，不releaseAll，不动只读BigHero。必需绑定缺失初始化明确报错。

## 验收清单

1. 授权Android设备用测试广告ID真测完整观看一次到账，记录SDK/包版本与requestId脱敏证据。
2. 取消、无填充、加载/展示异常均无成功额、无奖励，免费返回可用。
3. 重复/迟到回执、Activity重建、后台及进程重启重放只提交一次。
4. 注入TS存储失败验证原生回执仍在，成功重试后才ACK。
5. prod pending期间切dev，prod归属不变；未知旧请求留待诊断。
6. IAA关闭包不初始化SDK但游戏可启动；生产ID/授权/正式包另行实测。

## 待确认与交付边界

最终SDK版本、生产广告位ID、签名/商店资质和授权设备状态尚需实证；只记录是否具备，不将ID、凭据或鉴权头写日志。 实施交付须附真实业务调用点、有效组件/资源引用及当前构建证据；静态JSON/模拟引擎不代替真实Creator或SDK设备验证。本期文档状态不自动提升实现状态。
