# Cocos 仓库维护与输入边界

## 2026-11-03 整理范围与行为保护

本次仅整理提交边界、忽略规则和历史文件，不重新生成运行资源，不恢复被删除的旧页面。当前 assets、新工具、测试及旧资源删除属于同一次工程替换。Android 的 SDKHandleClass.java、RewardJson.java、RewardLedger.java 独立审查，不混入 Cocos 提交。

整理顺序：先运行现有测试与审核；补齐必需 JSON、fixture 和当前文档白名单；移除失效 legacy 命令；把旧文档逐文件复制校验到工程外后清出项目；清理可重建缓存；在 Creator 干净导入后复验，审查暂存文件再提交。不清空原稿、arts、签名、玩家数据或未确认用途的产物。

## 保留与退役

- 保留 docs/策划 的 65 项功能文档、开发计划与完成目录，以及当前 Prefab、单关、Loading、地图和界面链路说明。
- docs/generated、migration、ui-refresh-v5、version-1、version-1-upgrade-brief.md 退出当前工程；旧 IAA V2 docx 保留历史原件于工程外归档。
- 旧 Android/IAA/tools/tests 工具留作本地历史资料，不纳入当前工具链；原 package 的 test:legacy / audit:legacy 入口已退役。旧报告不能作为新工程验收。
- build、library、temp、profiles、本机设置、node_modules、日志、签名和私有配置不提交；定制 native 源码与 build-templates 保留。
- arts 是唯一正式独立美术交付，保留本地成果，不把它当作缓存清理；其与 assets 的职责不同。

## 独立检出与配套输入

Git 根是 Project。已提交 assets 足以交付运行资源；使用 Creator 3.8.8 导入工程会生成 library/temp，其中包含 tsconfig 继承的 temp/tsconfig.cocos.json。不得把这些缓存提交。

生成器、部分回归和审核需要同级 ../prototype 的唯一原型输入：block-data.js、app.js、meta.js、level-data.js、mainline.js、assets/block 的素材清单/原图/运行参考组件。版本指纹登记在 source-inputs.json，原稿身份也登记于 assets/resources/framework/config/source-art-manifest.json。独立克隆 Project 不会自动得到这些输入；需配套同一工作区输入，不复制第二套正式原型，也不声称单仓可完整重建。

运行 npm test、npm run audit、npm run typecheck；Creator 路径可通过 COCOS_CREATOR_ROOT 指定，部分测试的 TypeScript 路径可用 TYPESCRIPT_PATH 指定，原生预览验证的 Playwright 用 PLAYWRIGHT_PATH 指定。实际支持边界以各工具读取的变量为准，未安装 Creator 时不能以缓存或模拟检查冒充实际导入。

## 开发约束

参考 BigHero 的 Prefab 与组件分工，使用 Creator 3.8.8 API；固定 UI 在 Prefab 中制作并序列化具体类型属性/按钮事件。复用现有 framework/app/features，不创建第二套入口、存档或奖励权威。core 不依赖引擎/业务；隐藏解除监听，销毁实例后释放所属资源，保护异步迟到请求。

页面按功能分组，仅真实多模式保留状态组；只有真实列表项接列表复用合同。不恢复统一空根节点、空占位或旧代码拼整页 UI。保留稳定 UUID、已有人工布局及 853×1844 设计尺寸。参考项目只读，复制纯 TS 时记录来源和哈希，禁止直接复制 2.x Prefab/meta、私有 SDK 或历史兼容缺陷。

若父工作区约束文件可用，应同时遵守；当前引用的 ../docs/PROJECT_CONSTRAINTS.md 缺失，独立检出可从本文件和 AGENTS.md 了解上述工程边界。

## 本次核验记录

- 工作区 239 项回归、资源审核和 TypeScript 检查通过。
- 从 Git 暂存区单独导出的临时检出目录，配套指向唯一原型输入的目录链接，239 项回归及资源审核通过；没有借用原工作树中被忽略的工具或 fixture。
- 旧文档共 1853 个文件已逐件复制、回读 SHA-256 校验后清出工程，归档位于 `D:/CodexData/Artifacts/cocos-repository-cleanup-20261103/historical-docs/`，完整清单为同级 `docs-manifest.json`。历史 IAA docx 保留在归档中。
- Android 奖励账本的 JDK 17 编译及 13 项测试通过；旧花园协议测试运行 9 项后因已删除的旧 AdProtocol.ts 契约缺失而中止，不能当作完整通过。相关三个 Java 修改保留在工作树，不随当前 Cocos 提交。
- `.gitattributes` 固定生成源码/JSON/Prefab/meta 的 LF 换行，PNG 按二进制保存，以免 Windows 检出破坏生成所有权哈希。暂存区不包含缓存、构建包、签名或私有配置。
- 构建目录 10260 个普通文件、13148571954 字节已复制并回读 SHA-256 全量校验后清出 Project；归档位于上述 D 盘目录的 build/，清单为 build-manifest.json。内部 android/assets → android/data 链接仅记录恢复信息，不递归归档或删除链接目标。

## 后续提交补齐（2026-11-04）

用户明确要求提交所有剩余可提交改动后，美术规范/交付约束和三个 Android 奖励代码修改分别提交。上文“三个 Java 修改保留在工作树”是 2026-11-03 的历史状态，不再表示当前未提交。

Android 部分重新使用 JDK 17 编译当前生产 RewardLedger、RewardJson 与 host 测试，13 项账本测试通过。旧花园协议测试前 9 项通过后，仍因读取退役的 assets/scripts/ads/AdProtocol.ts 而中止；没有恢复旧业务代码或放宽断言。未执行 Android 完整构建、真实 JSON tokenizer、SharedPreferences、广告 SDK 或设备验证。
