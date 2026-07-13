# 首页日历旧版对齐纠偏设计

## 目标与范围

修复上一轮旧版对齐中仍存在的三项偏差：Todo 表格与按钮样式、日历 Tooltip 缺少 Schedule Comment、WeekView 空白。`release/1.2.0` 的组件实现是视觉与交互基准；保留 Schedule v2 的平台边界、Vue 3、Naive UI 和现有 Grid 周视图。

本次不修改解析器、不重新引入旧 Store/EventBus/Luxon，不重构无关页面。

## Todo 与按钮

Todo 恢复旧版使用的 Naive UI `NDataTable`，不再用手写表头和 `NTable`：

- 通过 DataTable columns 定义 Name、Deadline、Action、Done。
- Name 与 Deadline 保持可点击并进入 Schedule 详情。
- Action 使用旧版 Play 矢量图标，Done 使用 `NCheckbox`。
- 由 `rowClassName` 应用 done、expired、today、tomorrow、future 状态，颜色优先级严格沿用旧版。
- 表格高度、列宽、单行省略和组件默认边框恢复旧版表现。

`Not Expired`、`Not Done`、`month`、`week` 均使用 `NButtonGroup` 与 `NButton`。激活状态使用旧版同一份内嵌背景和 inset shadow，不再依赖容易受层叠顺序影响的全局 `.active` 规则。

## 两类 Comment

Schedule v2 同时保存两种不同含义的备注：

- Schedule Comment：Add/Edit Schedule 表单中的 Comment，属于整个日程。
- Occurrence Comment：详情页中单独编辑的某个时间片备注，属于一次实例。

旧版 MonthView 和 WeekView 的 Tooltip 展示 Schedule Comment。当前 Calendar DTO 只暴露 Occurrence Comment，导致新生成实例显示空备注。

为避免继续混用字段，日历范围查询返回明确的 Schedule Comment 投影；Tooltip 只读取该投影。Schedule 详情及时间片编辑接口继续读取和更新 Occurrence Comment，两者互不覆盖。新建时间片的 Occurrence Comment 仍为空；修改规则时继续保留时间键相同实例的既有 Occurrence Comment。

## WeekView

WeekView 保留 CSS Grid：每个逻辑日是一列，列数仍由设置控制。最终视觉与旧版一致：

- Grid 填满工具栏下方的可用高度，日列有旧版标题、边框和背景。
- 卡片相对各自日列绝对定位，位置以逻辑日起点计算；06:00 前的实例归入前一天。
- 卡片使用旧版色板、半透明背景、实色边框、单行标题与右侧时间。
- 悬浮时提高不透明度、层级和阴影，并展示标题、时间和 Schedule Comment。
- 保留当前仅改变视觉偏移、不修改持久化时间的拖动行为。

先用 Electron 测试稳定复现“切换 week 后不可见”，记录 WeekView、日列和事件卡片的实际尺寸，再针对确认的布局根因做最小修改，不以猜测方式调整 CSS。

## 测试与验收

所有修复执行 RED → GREEN：

- Todo 组件测试确认渲染 `NDataTable`、旧版 columns、row class、按钮激活内嵌样式及详情/完成/专注交互。
- 网关/仓储契约测试确认日历范围返回 Schedule Comment，时间片详情仍返回 Occurrence Comment。
- Tooltip 测试确认 MonthView 与 WeekView 展示 Schedule Comment。
- Electron 回归测试创建带 Comment 的日程、切换 WeekView，断言周视图、日列和事件卡片具有非零可见尺寸，并验证 Tooltip comment。
- 最终运行 ESLint、Vue TypeScript、全部 unit/contracts/parser 测试、Web/Electron 构建及相关 Electron Playwright 测试。

验收以实际 Electron 窗口为准；仅有 jsdom 结构测试通过不视为视觉问题已修复。
