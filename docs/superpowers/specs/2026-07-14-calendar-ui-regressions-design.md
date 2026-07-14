# 日历 UI 回归修复设计

## 目标

修复 MonthView 事件悬停时宽度随内容变化、暗色模式下选中按钮不明显、WeekView 表头仍使用浅色背景，以及从日程详情返回首页时 month/week 模式丢失的问题。

## 现状与根因

- `MonthScheduleView.vue` 在 `.schedule-card:hover` 中设置 `inline-size: auto`。按钮因此脱离单元格的固定宽度约束，并随标题、时间或 Tooltip 内容表现出伸缩。
- 首页 month/week 按钮使用固定的黑色半透明背景和内阴影。该值源自旧版浅色界面，在暗色表面上缺少可见对比。
- `WeekScheduleView.vue` 的日期表头写死为 `#fafafc`，边框也写死为 `#eee`，没有跟随主题 token。
- 首页通过 `const view = ref(preferences.calendarMode)` 将 Store 值复制到页面局部状态。切换时仅修改局部 `ref`；进入详情页后首页组件被卸载，返回重建时再次读取默认值，所以 week 会回到 month。

`release/1.2.0` 使用应用级 Pinia `runtimeStore.homepage.priority` 保存当前首页视图。详情页使用 `router.back()`，而 Store 不随首页组件卸载，因此返回后仍保留进入详情前的 month/week 模式。

## 状态设计

恢复按页面组织的运行时 Store：

```ts
interface RuntimeState {
  homepage: {
    priority: 'month' | 'week'
  }
}
```

新增 `src/stores/runtime.ts`，导出 `useRuntimeStore`。Store 只保存当前应用运行期间的 UI 状态，不读写 `localStorage`，也不承载服务端、数据库或路由数据。

应用启动时，在 preferences 完成同步 hydration 后，以 `preferences.calendarMode` 初始化 `runtimeStore.homepage.priority`。首页直接读取和修改 `runtimeStore.homepage.priority`，不再创建局部 `view` 副本。

两类状态保持不同职责：

- `preferences.calendarMode` 是跨应用重启保留的默认视图。
- `runtimeStore.homepage.priority` 是当前运行期间首页实际显示的视图。

临时切换 month/week 不写持久化设置。设置页修改默认视图时仍使用现有 preferences 与 settings 流程；本次修复不扩展设置页行为。

## 视觉设计

### MonthView 悬停

删除 hover 状态中的 `inline-size: auto` 和宽度相关变化。事件卡片始终保持 `inline-size: 100%`、单行省略和固定单元格约束。悬停只改变边框、背景或其他不影响布局的视觉属性。

### 暗色模式选中按钮

在 `tokens.css` 中增加选中按钮所需的主题 token，包括背景和内阴影颜色。亮色主题保持接近旧版的凹下效果；暗色主题使用与暗色表面有清晰对比的浅色高光与边界。

首页 month/week 按钮以及现有 Todo 筛选按钮共用这些 token，避免继续使用固定的 `rgba(0, 14, 28, ...)`。不增加新的按钮组件或抽象层。

### WeekView 表头

日期表头的背景、文字与边框改用现有或新增的主题 token。WeekView 其余 Grid 布局、事件定位、拖动偏移和配色逻辑保持不变。

## 导航数据流

1. 应用启动并 hydrate preferences。
2. runtime Store 用持久化默认值初始化 `homepage.priority`。
3. 用户点击 month 或 week，首页只更新 runtime Store。
4. 用户点击任一 MonthView 或 WeekView 事件，沿用现有 `schedule-detail` 路由。
5. 详情页调用 `router.back()`。
6. 首页重建后读取同一个 runtime Store，恢复进入详情前的模式。

本设计只要求保留 month/week 模式，不保留日历面板日期、滚动位置、侧栏折叠状态或 WeekView 拖动偏移。

## 测试策略

所有行为修改遵循失败测试、最小实现、通过验证的顺序。

- Store 单元测试：默认值初始化一次；month/week 更新保留在同一 Pinia 实例中；不写 preferences storage。
- 首页组件测试：点击 week 更新 `runtimeStore.homepage.priority`；卸载并重新挂载首页后仍渲染 WeekView；month 同理。
- 路由回归测试：从 MonthView 和 WeekView 点击事件进入详情，再返回时保持原模式。
- MonthView 样式回归：hover 规则不含 `inline-size: auto`，卡片固定为 `inline-size: 100%`。
- 主题回归：亮色和暗色 token 均定义选中背景及内阴影；按钮使用 token，不再绑定固定浅色界面值。
- WeekView 样式回归：表头不含 `#fafafc`/`#eee`，使用主题背景、文字和边框 token。
- 完成后运行项目规定的 ESLint、Vue TypeScript、Vitest 与 Vite build 验证；涉及真实返回导航的覆盖若现有单元路由测试不足，则增加 focused Electron Playwright 场景。

## 约束与非目标

- 不修改 `release/1.2.0`。
- 不改变日程详情页的 `router.back()` 语义。
- 不把临时 UI 状态加入 URL、数据库或平台网关。
- 不引入 TanStack Query、新依赖或通用状态框架。
- 不重构无关样式、路由或现有 preferences Store。
- 保留用户未提交的 `AGENTS.md` 修改。
