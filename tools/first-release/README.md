# 五页首版工程入口

Creator 3.8.8 打开 `Project/`，运行 `assets/scenes/Main.scene`。唯一组合入口为 `FirstReleaseBoot`；首次运行进入拼图教学，完成升级后普通启动进主页。引擎浏览器预览使用 Creator 自己的服务，本机验收端口为7456；唯一旧原型4291没有变更。

- 配置：编辑 `config/excel/` 七个独立工作簿，双击 `tools/meta/_build.bat`，统一生成 `assets/resources/config/game-config.json`。体力间隔为 Constants 的 `energyRecoverSeconds=300`。使用说明见 `tools/meta/README.md`。
- `npm test`：保留框架、源题几何、棋盘显示、输入和会话的有效回归，增加存档/经济/体力/建造/引导及导表测试。退役路线页、侧栏和旧产品流程测试保留历史源码，不纳入当前产品断言；迁移110题/原96编排的来源验证仍保留。
- `npm run typecheck`：使用Creator 3.8.8的实际类型定义检查当前脚本。
- `npm run audit`：核验当前资源UUID、序列化引用、内容哈希、生成所有权、配置资源与主线题库引用。
- `npm run firstrelease:generate`：唯一受管生成入口，先拒绝覆盖外部编辑的生成产物，再串行重建本次五个Prefab和启动注册。内部 `generate-ui.mjs` / `generate-app.mjs` 由集成人维护，不作为常规命令。旧全量生成器已有退役门禁。
- `npm run guide:verify-native`：实际引导动效、完整多边形目标、指尖、呼吸/循环、拖动取消/恢复及短屏专项；证据输出上级 `tmp/prototype/guide-motion/`。
- `npm run prefab:verify-native`：需要打开本工程的Creator预览和Chrome/Playwright。使用独立浏览器存档，实际拖放、点击五栋建筑、断点恢复，并记录截图和控制台；不会清空用户浏览器数据。输出在工作区 `tmp/prototype/first-release/native/`。后期七块关与地图满级明确使用测试进度/钱包，首轮教学从新档真实操作。

新Prefab及PNG只允许更新自身负责资源，UUID保持稳定。美术正式来源保留在 `arts/`，运行副本在 `assets/`；修改正式PNG需同步派生和资源登记。资源由View/scope持有，不使用全局释放。

`cleanup.mjs` 默认只列清单，`--apply` 才按引用闭包退役运行废项。执行前须冻结并行资产写入。它先将删除文件、meta和将覆写的注册/所有权清单复制到D盘，逐项SHA-256回读，先保存恢复receipt、再复核源哈希，最后精确删除；framework、arts、参考工程和玩家存档不在退役范围。恢复按receipt路径复制回原处，同时恢复对应注册清单，不运行旧全量生成器。

当前需求、技术接口和唯一任务状态见 `docs/重建计划/README.md`。不运行平台构建、SDK、广告支付、音频或Spine制作。

`npm run tray:verify-native`：托盘自动补位与0.22秒cubicOut缓动专项。使用独立浏览器存档和真实拖放，覆盖三步强制引导的新槽位、错放/取消、重复快照、重载、撤回和多屏收缩；七块关卡与后台取消使用明示测试条件。证据输出上级tmp/prototype/first-release/tray-native/。动画不改变拼图尺寸或存档中的pieceId，不需要重生Prefab或切图。


障碍格原图通过tools/first-release/puzzle-art-additions.json登记，正式PNG位于arts/游戏素材/PNG/页面素材/五页首版拼图/UI/。firstrelease:generate校验源SHA并生成运行副本/meta、注册到source-art-manifest、绑定PuzzlePage.obstacleAssetId；不是通用底格灰度，也不占托盘。


npm run obstacle:verify-native：固定障碍原图接入专项，检查真实SpriteFrame、不可拖动、障碍处错放不计步及随后正确放置，含显式有/无障碍关卡的池复用测试条件；独立存档，证据输出上级tmp/prototype/first-release/obstacle-native/。


npm run buttons:verify-native：拼图撤销/重玩/提示的新图、165尺寸、独立说明文字及角上计数验证，包含真实点击/拖放和375×667短屏截图。欢迎奖励保留专用firstrelease.reward.hint灯泡图；旧rotate.png文件对应重玩动作，不是旋转。证据输出上级tmp/prototype/first-release/buttons-native/。


npm run homeicon:verify-native：返回主页小房子与底部原撤销箭头的资源、375/430布局及真实暂停/取消/保留本局回家、建造返回测试。默认Creator7457，可通过CREATOR_PREVIEW_URL覆盖；独立存档，输出root tmp/prototype/first-release/home-icon-native/。


npm run transition:verify-native：Creator逐绘制帧检查主页/慢加载/恢复/重玩/下一关的拼图转场，默认7457，可CREATOR_PREVIEW_URL覆盖。PuzzlePage根pageOpacity预设0，业务准备完成后统一显示，PageTransition正式Prefab负责覆盖/淡出和输入拦截；参数来自Constants.xlsx。预加载独立持有应用scope，不共享玩家数据存档。故障和持久进度测试使用独立存档及明确条件，输出root tmp/prototype/first-release/transition-native/。

美术静态导出表示准备完成的PuzzlePage（根opacity=255），不能把运行时初始透明状态当作正式美术效果；旧全量导出仍受其几何来源哈希门禁，不为本次转场重生整套美术。
