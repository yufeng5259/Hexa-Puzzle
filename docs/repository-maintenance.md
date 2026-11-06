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

Git 根是 Project。使用 Creator 3.8.8 导入工程会生成 library/temp，不提交。运行所需输入只有本仓库的 `arts/`（美术来源）和 `assets/`；框架参考工程 `../bighero2415` 只在复制代码时读取，运行与构建不依赖它。

## 换电脑 / 第二台电脑开发（2026-11-06）

仓库里只提交源文件：`assets/`（含生成的 Prefab、导入后的图片及 .meta）、`settings/`、`native/`、`build-templates/`、`arts/`（不含 PSD）、`docs/`、`tools/` 及 `package.json` / `package-lock.json`。以下是过程文件，**不提交**，在本机重新生成：

| 目录 | 内容 | 如何重新生成 |
|---|---|---|
| `library/` `temp/` `profiles/` `.creator/` | Creator 缓存与本机设置 | 用 Creator 3.8.8 打开工程自动生成 |
| `build/` | 构建产物（web-mobile、android） | Creator 构建 |
| `node_modules/` `tools/smoke/node_modules/` | npm 依赖 | `npm i`；`cd tools/smoke && npm i` |
| `.test-build/` | 单元测试编译输出 | `npm test` |
| 仓库外 `../tmp/hexa-dev/` | 截图、日志、构建配置等临时文件 | 脚本自动创建 |

新电脑步骤：

1. 安装 Creator 3.8.8（默认路径 `C:/ProgramData/cocos/editors/Creator/3.8.8`；类型检查 `tools/tsconfig.json` 引用了这个路径下的 `cc.d.ts`，路径不同需同步修改）、Node 22、Chrome。
2. `git clone` 后在仓库根目录执行 `npm i`（安装 sharp、typescript），`cd tools/smoke && npm i`（安装 puppeteer-core）。
3. 用 Creator 打开工程一次，生成 `library/`。
4. 校验：`npm run typecheck`、`npm test`；构建 web-mobile 后 `node tools/smoke/smoke.mjs build/web-mobile <输出目录>`、`node tools/smoke/flows.mjs build/web-mobile`。
5. Android：在 Creator 里按原设置构建一次 android（生成 `build/android/cocos.compile.config.json`），之后用 `bash tools/android/deploy.sh` 出调试包并安装到连接的手机。脚本会修正生成工程名里的冒号，并让 Gradle 不走本机代理；Android Studio 的 JDK 路径不同时设置环境变量 `JAVA_HOME_ANDROID`。

生成文件的规则：Prefab、结构文档、缺少美术设计表由 `node tools/ui-gen/gen.mjs --prefab` 生成；图片由 `node tools/art-import/import.mjs` 导入；文本表由 `node tools/i18n/build.mjs` 合并。生成结果都提交，两台电脑不需要重新生成即可直接使用；改了 spec、美术或文案后重新运行对应脚本并一起提交。

## 开发约束

2026-11-05 起以 [开发方案](开发方案/README.md) 和 [开发约束](开发方案/开发约束.md) 为准。下文“本次核验记录”与“后续提交补齐”是历史记录，其中提到的旧工具、旧测试和 `../prototype` 输入已随旧工程删除。

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
