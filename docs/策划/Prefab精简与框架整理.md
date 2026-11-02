# Prefab 精简与框架整理

## 目标与范围

按已确认的分析结论原位整理现有 82 个 Prefab，不建立第二套运行资源，不重建人工维护的 LoadingPage、MainlineMapPage，不移植 BigHero 的 2.4 引擎实现。保留 853×1844、原稿坐标与层序、资源 UUID、导航、拼图规则、会话及资源所有权。

## 行为保护与基线

整理前运行全部 230 项测试：227 通过，3 项地图相关失败。失败涉及人工地图保存后的 registry 根组件索引和实际绑定；先核对现有人工结构并修复引用，不用旧生成器覆盖人工布局。详细原始结果位于工作区 `tmp/prototype/framework-simplification/baseline-tests.log`。

现有测试覆盖棋盘会话、拖放、导航、异步呈现、资源释放、虚拟列表、关卡与原稿几何。新增结构回归须证明：无强制双根、单态无状态数组、无占位字段/按钮、列表合同仅挂真正列表项、原图及文字在正式 Prefab 可见、资源与事件引用有效、生成可重复且不会恢复旧模板。

## 整理顺序

1. 移除生成器的统一 VisualRoot/DynamicRoot 和不存在实际控件时的隐藏占位；按真实绑定生成组件。
2. 原稿图片和默认文字正式序列化；原稿溯源、槽位及几何审核信息移至 tools 元数据，移除运行态 SourceLayout。保留 GardenAssetStore 和现有资源 scope。
3. 单态 View 使用 BaseView；只在真实多态 View 保留状态选择。状态组按用途命名。删除单态平行字段数组。
4. 仅真正列表模板挂 VirtualListItem，并按唯一实际点击路径绑定。保留普通 item 的视觉渲染、动态图片和拼块预览层职责。
5. 同步组合入口、棋盘定位、生成元数据、审核及测试；修复人工地图实际缺失的绑定，保留其人工布局。
6. 运行回归、TypeScript、引用审核、幂等生成及真实 Creator 预览，记录截图与已知限制。

## 边界与风险分类

- 隐藏占位及统一目录推断列表行为属于模板冗余，直接移除。
- 真正棋盘、页面模式、异步身份和资源失败检查是行为边界，迁移引用后保留，不能删成静默兜底。
- 现有 ManagedOutputs 的人工修改保护继续保留；不绕过哈希冲突。人工页面不重新纳入生成所有权。
- 本轮不新增依赖或复制没有实际需求的 BigHero 工具，因此不虚构代码移植登记。

## 验收

- 所有正式资源保持单套；无 VisualRoot/DynamicRoot、SourceLayout 运行组件和无用途隐藏占位。
- 真实多态及列表仍可用；普通单态 View Inspector 仅显示实际控件。
- 图片在 Creator 中有正式引用；页面切换、拖放、重复开关、尺寸变化、迟到加载及释放保持正确。
- 基线失败单独追踪并修复，不修改断言来掩盖错误。

## 已完成结果（2026-10-30）

- 82 个正式 Prefab 全部原位整理，保留稳定资源 UUID。LoadingPage 保持原文件；MainlineMapPage 只修复丢失的 presentation 引用，69 个节点及人工布局保持原样，registry 更新实际根组件索引。
- 全部移除 VisualRoot / DynamicRoot，删除运行时 SourceLayout 脚本、组件与无消费者的 source-layouts.json。原稿槽位、状态来源和几何审核信息保存在 `Project/tools/prefab-foundation/layout-manifest.json`。
- 单态 View 使用 BaseView；9 个真实多态 View 保留状态选择，且仅它们生成状态字段数组。普通页面按连续绘制顺序组织 Header / Content / Actions / Footer 等功能组，不打乱原稿覆盖关系。
- 只有实际被 VirtualList 使用的 item 挂列表组件；删除自动占位和普通 item 的通用根按钮。SceneCompanionItem 只剩根节点与蜜蜂 Sprite，View 仅有 icon 字段。
- 拼块使用有实际用途的 PiecePreview 与 PieceCells，保留真实棋盘、拖放、会话、异步身份和资源所有权。默认图片及文字现在正式保存到 Prefab，编辑器内即可显示。
- 运行节点 4008 → 3954，View 业务绑定 351 → 210，Button 393 → 360。未引入第二套框架、运行资源或依赖，也未复制 BigHero 的旧引擎实现。
- 修复导入器按稳定 UUID 复用人工改名/移动的纹理，加载页保留 `bj.png`。删除仅在首轮生成时被旧工具恢复的同 UUID 文件；新增内容冲突、重复 UUID、跨 bundle 等明确失败检查。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 全部自动回归 | 239 / 239 通过；原有 3 个地图失败已修复 |
| 原稿外观回归 | 从改动前 ZIP 提取 80 个 Prefab、106 个版式、2695 条图文；资源、文字、坐标、尺寸、样式和绘制顺序保持一致 |
| TypeScript / 静态审核 | 通过；82 Prefab、371 原图、188 派生图、48125 个引用检查通过 |
| 重复生成 | 166 个受检查文件哈希不变；人工改名图片未恢复旧路径 |
| Creator 3.8.8 全 Prefab 验证 | 全部 82 个加载、实例化、激活和绑定验证通过；虚拟列表与资源释放通过；14 张实屏截图；0 脚本错误、0 资源请求失败 |
| Creator 界面链路 | 真实按钮、页面与弹窗、快速切页、加载失败、各版式、资源释放通过；14 张页面及 2 张变体截图 |
| Creator 单关玩法 | 拖放、多点触摸/取消、弹窗和尺寸变化中断、四种视口、挑战最后一步成功、失败重试、资源所有权通过；17 张截图 |
| 独立复查 | 未发现阻塞性问题；23 项针对回归通过 |

实屏已人工检查地图、家园、拼图与设置页。此验收证明本轮结构整理保持现有功能，不代表此前尚未开发的经济、花园建设、广告、存档等奖励系统已实现。

过程证据统一位于工作区 `tmp/prototype/framework-simplification/`；Creator 原生报告分别位于 `tmp/prototype/prefab-foundation/native/report.json`、`tmp/prototype/ui-integration/native/report.json`、`tmp/prototype/single-level-play/native/report.json`。改动前资源可从 `tmp/prototype/framework-simplification/before-structure.zip` 恢复。

## 后续制作约定

- 页面直接按功能组织节点，只有承担布局、裁剪、动画或真实模式切换的容器才保留。不统一添加空根节点、空字段、空状态组或点击组件。
- 简单 item 仅绑定自己的 Sprite、Label 或实际控件；实际列表项才接列表复用合同。
- 固定控件和默认素材在 Creator / Prefab 中制作，运行代码只更新业务数据；动态棋盘及列表继续实例化独立 item Prefab。
- 生成器继续执行人工改动保护。人工维护的页面不恢复旧模板，纹理改名后按 UUID 保留身份；已删旧资源不作为兜底重建。
