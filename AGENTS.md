# 全项目约束入口

当前仓库提交边界、配套原型输入、可执行检查和独立检出约束见 [仓库维护说明](docs/repository-maintenance.md)。父工作区文件缺失时，先按该说明核对输入，不恢复历史工程或建立第二套正式原型。

## Block 正式交付位置（2026-11-03）

- 后续任何 Block 美术制作、修复及交付任务必须先完整阅读 [游戏美术素材制作与验收规范](docs/游戏美术素材制作与验收规范.md)。完整质量与生图规则已随项目迁入，本项目内即可读取，不依赖 H 盘工作区。

- 本对话生成及后续更新的 Block／Hexa Puzzle 最终独立美术交付，统一保存到 `F:/qiguobing/git/Hexa Puzzle/Project/arts/`，此处为唯一正式交付目录。直接在 `arts/` 根层保留 `index.html`、`游戏素材/`、`PSD/`、`效果预览/`、`素材设计板/`、`页面对照/` 和清单说明，不嵌套另一层“Block独立交付”。
- 迁移已完成。后续 Block／Hexa Puzzle 的新生成、修复、重生成与交付更新，直接在 `F:/qiguobing/git/Hexa Puzzle/Project/arts/` 对应目录进行；不再在 `H:/projects/luocheng/Block独立交付/` 生成或维护交付，也不采用先生成到 H 盘再同步的流程。旧工具必须先把正式输出根目录改为该 `arts/`；候选、中间文件、检查和备份保存在最终目录外。
- 旧 `H:/projects/luocheng/Block独立交付/` 为已迁移的退役副本，不是后续依赖。逐文件核验已迁移内容及新入口可用后，可按用户清理指令删除该旧交付目录；不因此删除 H 盘原始参考图、制作工具、其他游戏交付或规则文档，不自动重建旧目录。
- 后续修改同步唯一 PNG、真实文本 PSD、配置、本地化、素材清单、效果预览、页面对照、运行参考组件和入口；包内链接保持相对路径。冲突文件覆盖前在目录外备份并核验，复制后逐文件校验 SHA-256，并在目标实际打开 `arts/index.html` 复验。不删除未确认归属的文件，缓存和备份不放入最终包。
- 本规则仅授权美术交付及约束维护；复制到 `Project/arts/` 不等于已接入 `Project/assets/`、Prefab 或运行逻辑。


## Cocos 开发（2026-11-05 起）

Honey Garden 的 Cocos 3.8.8 工程按以下文档开发，所有对话和子代理先阅读：

- [开发方案](docs/开发方案/README.md)：架构、Prefab 生成方式、功能实现、执行顺序。
- [开发约束](docs/开发方案/开发约束.md)：流程、代码、Prefab、文字、资源、验证的全部条款。
- [重建计划](docs/重建计划/README.md)：架构细节、BigHero 复用清单、规则默认值；与开发方案冲突时以开发方案为准。
- 规则来源：`docs/策划/功能/F001–F065`。

要点：

- 直接在 `dev` 分支开发。旧工程（生成的空壳脚本、82 个旧 Prefab、`Main.scene`、`tools/prefab-foundation`、`GardenAssetStore`、`UIFlow`）已于 2026-11-05 删除，不恢复。原 `../prototype/` 不再是输入。
- 框架来自同级 `bighero2415/assets/scripts`（Creator 2.4.15），按 3.x 改写到 `assets/scripts/framework/`，来源登记在 `tools/framework/reference-manifest.json`；不复制 2.x 的 `.prefab/.fire/.meta`、SDK、整树注入。
- Prefab 只由 `tools/ui-gen` 根据 spec 生成；结构文档 `docs/开发方案/Prefab结构.md` 与 Prefab 同源。不手写单个 Prefab，结构定稿前不在 Creator 里手改生成结果。
- 引用用 `@property` 绑定，固定按钮在 Prefab 中绑定；禁止按名称查找节点、遍历节点树、`getComponent(node.name)`。
- 文字全部 Label + 本地化 key，系统默认字体，数字不用图片。
- 每个脚本/配置只有一份，修改在源文件上进行；不写兜底分支。
