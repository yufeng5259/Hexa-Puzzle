# 全项目约束入口

当前仓库提交边界、配套原型输入、可执行检查和独立检出约束见 [仓库维护说明](docs/repository-maintenance.md)。父工作区文件缺失时，先按该说明核对输入，不恢复历史工程或建立第二套正式原型。

## Block 正式交付位置（2026-11-03）

- 本对话生成及后续更新的 Block／Hexa Puzzle 最终独立美术交付，统一保存到 `F:/qiguobing/git/Hexa Puzzle/Project/arts/`，此处为唯一正式交付目录。直接在 `arts/` 根层保留 `index.html`、`游戏素材/`、`PSD/`、`效果预览/`、`素材设计板/`、`页面对照/` 和清单说明，不嵌套另一层“Block独立交付”。
- 现有 `H:/projects/luocheng/Block独立交付/` 已授权完整复制到此；H 盘保留为制作／历史副本，不再作为最终交付权威入口。以后既有工具如仍写 H 盘，必须完成对正式 `arts/` 的同步及校验后才可宣布交付完成。
- 后续修改同步唯一 PNG、真实文本 PSD、配置、本地化、素材清单、效果预览、页面对照、运行参考组件和入口；包内链接保持相对路径。冲突文件覆盖前在目录外备份并核验，复制后逐文件校验 SHA-256，并在目标实际打开 `arts/index.html` 复验。不删除未确认归属的文件，缓存和备份不放入最终包。
- 本规则仅授权美术交付及约束维护；复制到 `Project/arts/` 不等于已接入 `Project/assets/`、Prefab 或运行逻辑。


本 Cocos 项目属于上级 `Hexa Puzzle` 工作区。所有对话和子代理必须先阅读并遵守 [全项目约束规范](../docs/PROJECT_CONSTRAINTS.md) 与 [根目录协作约束](../AGENTS.md)。

原型唯一目录固定为 `../prototype/`，登记在 `../prototype.config.json`。不得在本目录、`output/` 或其他位置新建另一套原型；临时工作统一放在上级 `../tmp/prototype/`。原型改动不自动授权修改 Cocos 生产代码。

## Cocos 框架与制作规范入口

必须遵守上级 `AGENTS.md` 的「Cocos 开发规则：以 BigHero 的 Prefab 与组件制作方式为基准」全部条款；详细来源与适配边界见 [框架分析](../docs/BIGHERO_FRAMEWORK.md)。不能因为从本目录开启对话而遗漏这些规则。本轮交付仅为分析与开发约束。

- 本工程为 Creator 3.8.8；后续通用框架代码约定归入 `assets/scripts/framework/`，通用 Prefab 约定归入 `assets/resources/framework/`。这是后续目录约定，本轮不创建框架实现。
- 页面、弹窗、列表和 item 做 Prefab，预挂功能组件；稳定节点/组件/Prefab 引用用 `@property` 在 Inspector 绑定；固定按钮事件在 Prefab 绑定。禁止运行时扫描名称、补整棵 UI 树或 `getComponent(node.name)`。
- 参考项目的 `game_catalogue_view.prefab` / `ScrollableItemGrid`、`energy_purchase.prefab` / `EnergyPurchaseView` 是制作范例；本项目邮件正文/隐私滚动容器与 GM 命令列表可作为后续分批迁移候选，本轮不实施。
- 源页面资源沿用 `GardenAssetStore`；通用资源统一加载并明确所有权；隐藏解除监听，销毁释放实例与资源，处理异步迟到结果。
- 实际复制代码时建立 `tools/framework/reference-manifest.json` 登记来源与差异；不得直接复制参考工程的 2.x Prefab/.meta、旧业务、SDK 配置与兼容缺陷。
- 保留当前未提交修改和删除。新功能采用组件制作，存量页面按功能分批迁移；不得恢复旧 resources/prefabs 或另建运行工程。
