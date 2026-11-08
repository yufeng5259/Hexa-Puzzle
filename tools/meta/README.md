# 独立Excel打表

双击 `_build.bat`（需要Node.js）。首次根据本目录锁文件安装开发侧依赖，之后无需再次安装。也可以在本目录运行 `node app.cjs`。游戏运行不需要Node或Excel依赖。

源表为 `../../config/excel/` 下的 Constants、Maps、MapBuildings、BuildingStages、Mainline、Rewards、GuideSteps 七个独立 `.xlsx`。每个首工作表前三行为中文说明、类型、字段名，第四行起数据；不要改表头或移动运行数据到其他sheet。蓝色内容可编辑，深色表头用于约束。空可选字段导出null，0是有效值。

所有表统一输出 `../../assets/resources/config/game-config.json`。不要手改生成JSON。完整类型、ID、跨表、建筑等级、主线、目标声明与首引导可达性校验成功后才替换；失败保留上一份可用JSON，输出文件/sheet/行/字段。运行中不热重载，重新初始化加载新配置。

- 恢复秒数在Constants.energyRecoverSeconds，正式值300。初始币0、提示5、体力5；这些是可调首版默认。
- 每张地图五槽；坐标853×1844设计空间中心原点，非屏幕像素。建筑等级0为初始，费用表示升入该等级。
- Mainline使用已有110题：原96编排，剩余14挑战题追加。几何继续引用旧题库JSON，不另做编辑器。
- `schema.cjs` 是工具字段、允许目标及资源ID声明；运行资源可达性由集成资源审核再次确认。新增资源/动作需同步声明及实现，不能只填任意字符串。
- 首轮引导包含连续三步指定拖放、真实通关等待、回家、点击建造、指定slot1升级、欢迎领奖和结束。三次拖放分别对应首关三块拼图，仅开放当前指定拖放；真实通关等待不开放其他操作。Constants.welcomeRewardId引用Rewards.welcome（100蜜蜂币、1提示、0体力），初始体力在建档时已给满；首关100币和首次升级40币保留。升级后进入待领奖阶段，欢迎礼持久成功才结束；已完成引导的旧档不补弹窗或重发资源。
- GuideSteps.params.allowedActions使用注册操作标识，skippable=false为强制步骤；拖拽highlightProvider=puzzlePlacementPreview复用原生落点预览。强制步骤timeoutSeconds=0，不能靠超时跳过；新增动作需同步代码及校验声明。步骤不允许非法环，首次收益要覆盖首次费用，指定升级的下一步必须是欢迎领奖出口。

测试：`npm test`。配置管理由 `assets/scripts/features/config/MetaManager.ts` 提供，只读查询；存档与交易由业务服务负责。

本工具参考只读island/meta_dev的三行头与keys+ID数组编码，去除了服务器输出、旧业务和宽松转换。来源与哈希见 `reference-manifest.json`。样表由bundled artifact-tool生成并逐表渲染检查；无公式需要Excel重算。
