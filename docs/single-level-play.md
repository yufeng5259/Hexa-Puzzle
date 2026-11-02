# 单关可玩闭环

本批在现有82个Prefab和110题正式目录上接入普通/限步玩法。启动入口、原稿、资源manifest和唯一原型目录沿用已有实现；不新增正式Prefab。

## 规则与会话

`features/puzzle/model/PuzzleModel.ts`只校验整块平移、目标范围、障碍、重叠和目标填满，不依赖Cocos或原答案配色。`session/PuzzleSession.ts`持有attemptId、摆放、步数、选择、最近放置顺序及active/completed/failed状态，输出深冻结快照。

成功放置或位置改变计一步，已落盘拼块取回也计一步。原位、非法、空取回、取消触摸和打开帮助不计步。最后一步先判成功，未完成才判限步耗尽。普通关没有步数失败。备份只作规则审查参考，本批没有整体恢复旧GameplaySession或旧资源。

`app/PuzzleAttemptStore.ts`按原题ID保存本次进程内的Session。切页面不销毁纯会话；再次进入同题继续原attempt。确认重开和失败免费重试才建立新attempt。新页面准备失败/取消不提交候选尝试。

## 输入与Prefab

每个实际拼图版式预挂`PuzzleController`，Inspector绑定既有棋盘显示组件及新增的固定拖动层、候选轮廓层和Graphics。开局预览保持只读，无Controller。正式层级和组件由原生成器保存，业务实现独立于生成的View绑定。

Controller负责单触点、实际六角拾取、缩略到棋盘半径的坐标换算、候选预览、松手提交与取消。规则不持有Node；棋盘按快照更新位置、进度和剩余块数/步数。托盘保留原空底板，拖动不留下旧块影像。

Creator先派发UI事件，可能截住全局input，因此控制器同时使用页面根节点捕获阶段监听及全局空白区入口；同一触摸重复派发只提交一次。场景装配层显式注入Canvas相机，通过屏幕反投影后进入节点局部坐标，避免当前相机中心与UI设计中心不同导致拾取偏移。

已落盘拼块盘内非法释放回原位；主动拖到棋盘矩形外松开按当前原型视为取回。触摸取消、隐藏、弹窗、后台和resize撤销临时拖动，不当作主动取回。已有盘面占用在拖动过程中不永久删除。

## 导航与生命周期

UIFlow只导航，通过窄端口连接实际操作。导航准备期间暂停旧页输入；弹窗关闭恢复同一会话。普通完成进入普通结果，限步完成进入限步结果，耗尽打开失败弹窗。终态不可继续摆放，规则结果不重复提交。

结果资源加载失败时，顶部显示可点击的重试通知；重试保留attemptId、步数和摆放。该恢复入口在发布模式同样可用，不自动无限重试。真实局拒绝开发演示通关入口。

`PlayStatusPresentation`绑定实际文字槽与不可用按钮，显示本次运行内保局、奖励0、广告/存档未接入，隐藏尚无依据的历史星级。固定按钮继续使用序列化事件。

资源仍由页面scope持有，Session不持有资源引用；先销毁实例再释放scope。生成器保留Creator先导入的手写脚本UUID，并使用该UUID序列化组件类型；受管理的生成脚本仍使用原身份保护，不能绕过人工修改冲突。

## 阶段边界

本批没有持久存档、旧档迁移、解锁、花蜜/提示库存、首通/复玩奖励、广告续关、建设或无尽。杀进程后不恢复本局。普通/限步可玩通过不表示最终美术通过，原稿高光、阴影和纹理接缝仍需独立视觉验收。

触摸取消有明确验证边界：Chrome CDP的touchCancel会产生cancelable=false事件，而Creator 3.8.8的Web触摸适配器仍调用preventDefault，输出一条浏览器错误；该失败原报告保留，未修改引擎或过滤错误。正式验收分别记录真实CDP双指加暂停生命周期取消、明确标记为合成且可取消的DOM touchcancel分支，以及取消后真实单指恢复。它们不代表真实设备硬件取消已验收，双端真机仍需补测。

## 验证

测试入口为`npm test`、`npm run typecheck`、`npm run audit`；真实操作入口为`npm run play:verify-native`，复用当前Creator 3.8.8预览。新画册位于唯一原型的`review/cocos-production/prefab-foundation/single-level-play/`；临时报告位于`tmp/prototype/single-level-play/`。

<!-- SINGLE_PLAY_VERIFICATION_START -->
验证完成于2026-10-28T14:37:04.109Z；正式画册发布前再次执行206项回归、TypeScript和静态审核，均通过。

- Creator 3.8.8逐一加载、实例化并启用82个Prefab；静态审核4056节点、401按钮、50376处引用通过。
- 单关实际操作129条记录，四尺寸3/4/6/7块共16组真实解题，包含32张完成前/结果实屏及1张限步失败实屏。
- 真实指针验证普通/限步完成、最后一步成功优先、限步耗尽及免费重试；暂停/帮助/设置/地图往返保持attempt、摆放和步数。
- 多指生命周期取消、合成DOM取消分支及取消后单指恢复分别记录；硬件取消限制见上节与保留的原始失败报告。
- 本轮操作创建119个scope、释放117个，只保留当前地图和启动目录2个持有者；操作阶段存储写入0，当前验收运行错误/警告/资源失败均0。
- 既有24种UI夹具版式、真实关卡身份与四尺寸展示复验通过；夹具导航演示与真实玩法分开报告。
- 独立审查发现并修复结算加载失败恢复问题；重复派发start/move/end/cancel的独立探针确认一次提交、取消不计步、销毁后监听清零。
- [正式可玩画册](../../prototype/review/cocos-production/prefab-foundation/single-level-play/index.html)、[原生报告](../../prototype/review/cocos-production/prefab-foundation/single-level-play/native-report.json)、[完整回归与审核记录](../../prototype/review/cocos-production/prefab-foundation/verification.json)。
<!-- SINGLE_PLAY_VERIFICATION_END -->
