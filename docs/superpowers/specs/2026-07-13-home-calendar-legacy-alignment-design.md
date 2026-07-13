# 首页与日历旧版行为对齐设计

## 目标

在现有 Schedule v2 平台边界内，修复首页 Todo、月视图、周视图和新增表单中已确认的问题，并以 `release/1.2.0` 与用户提供的截图作为行为和视觉基准。

本次不移植旧版 Store、EventBus、Luxon 或 Electron 类型，不引入 TanStack Query，也不重构无关页面。

## 已确认的旧版行为

Todo 截止状态严格恢复旧版规则：

- 已过期：红色。
- 今天截止且尚未过期：橙色。
- 明天截止：黑色。
- 后天及以后：灰色。
- 已完成：灰色；若同时已过期，过期红色优先。

截止时间显示为 `MM-dd HH:mm`。Name 和 Deadline 都可进入所属日程详情页。Action 使用旧版 Play 矢量图标，Done 使用复选框。

## 方案选择

采用“现有 v2 边界内的忠实修复”：保留当前 `PlatformGateway`、Occurrence DTO、Vue 页面和 Naive UI 组件，只在现有解析、展示函数和组件内修复根因。

不采用整块移植旧组件，因为它会重新引入 Luxon、旧 Store/EventBus 和多套宿主耦合。不采用纯 CSS 修补，因为它无法修复 `setpos`、逻辑日归属与表单校验。

## 解析与实例展开

当前实例展开按日期逐日匹配 `frequency` 与 `by`，但忽略 `by[setpos]`，因此用例 15 中每个工作日都成为实例。

月频率展开按月形成候选集：

1. 在当前月份内应用 `by[month]`、`by[monthday]`、`by[day]`、`by[yearday]` 和 `by[weekno]`。
2. 对筛选后的有序候选集应用 `by[setpos]`；正数从头计数，负数从尾计数。
3. 去重并保持日期顺序。
4. 再受原始起止日期、间隔和 count 约束。

用例 `2026/7/1-8/31 17:00-18:00 monthly by[day[1,2,3,4,5],setpos[-1]];` 只生成 2026-07-31 与 2026-08-31 两个实例。

## Todo 侧栏

Todo 状态计算从组件渲染中分离为纯函数，输入 deadline、done、时区与当前 instant，输出旧版状态。组件提供默认当前时间，同时允许测试注入固定 instant。

侧栏使用 Naive UI 的表格、按钮组、图标和复选框能力：

- 标题和截止时间为可聚焦、可点击控件。
- 标题保持旧版单行省略，不在窄列中任意换行。
- 截止时间固定使用目标时区的 `MM-dd HH:mm`。
- `Not Expired` 与 `Not Done` 保留当前过滤语义，按下态与 month/week 按钮共用样式。
- Done 样式只影响文字与图标，不破坏复选框可见性和可操作性。

## 月视图

首页工作区改为纵向弹性布局：工具栏占固定内容高度，当前日历视图占据剩余空间并允许内部组件获得明确的 `height: 100%`。没有实例时，Naive UI Calendar 仍填满可用区域。

月卡片保持单行：标题可收缩并省略，时间不换行。每个卡片由 `NTooltip` 包裹，悬浮内容恢复旧版结构：标题、日期与起止时间、备注。悬浮时保留绿色边框反馈。

工具栏删除 Add 右侧的刷新占位按钮。

## 新增表单

Name 与 rTime 是必填项；exTime 与 Comment 可选。使用 Naive UI `NForm` 的 model、rules 和 form ref 完成校验：

- 必填标签显示标记。
- 空值提交时对应控件显示红色边框和错误说明。
- 校验失败不发出 submit。
- 校验通过后按现有 DTO 形状发出 submit 并关闭弹窗。
- Ctrl+Enter 与 Confirm 走同一校验入口。

## 周视图

周视图同样填满工具栏下方的剩余高度。日程实例按逻辑日分列：当地墙钟时间早于 day start 的实例归入前一个日历日。设置 day start 为 06:00 时，`2026/7/18 start-end` 归入 7 月 17 日列，并从该逻辑日的 18:00 位置开始展示。

卡片位置按相对逻辑日起点的分钟数取模计算；跨午夜事件保留真实持续时间。列裁切自身内容，避免长卡片覆盖相邻列。

颜色使用旧版色板，但通过 schedule ID 的稳定散列选色，使同一日程的多个实例颜色一致且避免刷新和截图测试抖动。默认背景使用半透明色，边框使用实色；悬浮时提高背景不透明度、阴影和层级。

每张卡片使用 `NTooltip`，内容结构与月视图一致。原有只改变本地视觉偏移的拖动行为保持不变。

## 图标

当前 UI 不再使用 Emoji 或文本符号充当图标。导航、用户、Play 和灯泡恢复为与旧版对应的矢量图标，并通过 Naive UI `NIcon` 呈现。所有仅图标按钮提供可访问名称。

## 数据流与错误处理

页面继续通过现有 occurrence 查询获得 DTO，不向 Vue 组件暴露解析器上下文、数据库或 Electron 类型。

解析错误继续沿用现有 diagnostic 与应用错误通道。表单客户端必填校验只负责即时反馈，不替代现有契约和平台边界校验。Tooltip 无备注时保留结构但不虚构内容。

## 测试与验收

所有行为改动遵循 RED → GREEN → REFACTOR：

- 解析测试覆盖月末最后一个工作日和 `setpos` 正负位置。
- Todo 测试以 2026-07-13 固定时钟覆盖过期、今天、明天、后天以后、完成优先级、格式、过滤和两个详情入口。
- 表单测试覆盖必填标记、红框与错误信息、可选空值、键盘和按钮提交。
- 月视图测试覆盖空状态高度、单行省略、Tooltip 内容和详情选择。
- 周视图测试覆盖逻辑日归属、全天事件、稳定色板、透明度、悬浮态、Tooltip 和原有拖动。
- UI 源码约束测试拒绝关键界面中的 Emoji 图标。

最终运行：

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

再运行与首页相关的 Electron UI 测试。所有修改保持手术式范围，并保留未提交的 `AGENTS.md` 用户修改。
