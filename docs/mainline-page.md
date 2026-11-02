# 地图单页精简

## 已确认范围与顺序

1. 先锁定现有坐标、侧栏事件、八个真实关卡挂点和分页行为；补充普通 BaseView 单页的绑定及运行回归。
2. 删除已由真实关卡 item 取代的 40 个隐藏底板、星星和号码。保留 8 个挂点、默认隐藏但运行时启用的分页控件、可见光晕和头像。
3. 移除 VisualRoot、单状态原稿容器和空 DynamicRoot。组合 header、footer、paging，补齐道具数量、花园进度和无尽排名的内部归属。复用现有图形与组件，保持原坐标和视觉层序。
4. 地图 View 直接继承 BaseView，仅以具体类型绑定 MainlineMapPresentation；保留 onAction。地图 Core 与分页组件预挂在页面根，移除重复 SourceLayout 和 PresentationGroup，装配层调用一次 render。
5. 同步资源登记、人工维护契约和原生检查；保留原图素材身份/中心/尺寸核验，删除旧的“必须保留隐藏原稿节点”要求。运行回归、类型与 Creator 原生检查并对照改前截图。

## 边界

原型唯一目录为上级 prototype，本次不修改；临时证据统一放在上级 tmp/prototype/prefab-foundation/map-page。保留已有人工作品和资源 UUID，不恢复旧贴图，不修改经济、存档与奖励规则。当前关卡光晕在关卡图形下，头像在其上，保持这两个节点的原层序，避免简单合并造成遮挡变化。

## 最终结果

- 正式 Prefab 从 111 个节点减至 69 个：删除 40 个重复原稿节点、三个模板容器和两个箭头包装节点，新增 header、footer、paging 三个组合容器。
- 页面根直接挂地图 View、CorePresentation 和 MainlineMapPresentation。八个挂点命名为 Slot1～Slot8；光晕和头像保留原来的前后层序。顶部数量、底部文案、进度与排名均随所属视觉单元一起移动。
- View 仅保留 presentation 绑定、绑定校验、render 和按钮 onAction。render 采用该名称以避开 BaseView 的私有 present 方法；装配层调用一次，其他多状态页面保持原调用路径。
- 生成器继续保留人工 Prefab；登记实际根组件索引 432、69 个节点、空 stateIds 和自定义组件绑定。脚本与 Prefab 的原 UUID 均保持。

## 验证结果

- npm test：230 项通过；npm run typecheck 通过。新增普通地图 View 生命周期/事件/live 与 fixture 呈现、缺绑定和失败传播回归；结构回归验证组合归属、原坐标、光晕层序与重复节点移除。
- Creator 3.8.8 原生结果为 PASS_NATIVE_MAP_PAGE，页面错误和资源请求失败均为 0。实测十二段全部 96 个关卡编号、前后分页边界、单次 Core 呈现、原稿预览、关闭后的迟到调用。
- 使用真实鼠标验证七个侧栏入口、两个红点、八个关卡入口、前后翻页、设置与建造花园，并返回地图；验证侧栏隐藏重排与恢复。
- 已检查 320、390 宽的实际截图。与上一步侧栏归组截图逐像素对照，分别只有 1、3 个像素不同，坐标和主要图形保持一致。
- 证据目录：../../tmp/prototype/prefab-foundation/map-page/，包含改前 Prefab、native-report.json、测试输出、两张截图、pixel-diff.json 及可重跑的 verify.cjs。专项证据不表示全项目资源审核通过。
- npm run audit 通过地图自定义组件、事件和引用检查后，仍停在此前公共 ProgressDisplay 已删除贴图（UUID db4cfcad…）；本次未恢复旧资源或放宽断言。
