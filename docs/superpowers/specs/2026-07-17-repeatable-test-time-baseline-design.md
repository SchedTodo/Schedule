# 可重复测试时间基线设计

## 背景

部分 v2 首页测试使用 2026 年 7 月的 fixture，但页面查询、展示 helper 和组件默认值仍可能读取真实系统时间。当前测试通过网关注入的 `Clock`、`new Date()`、`Date.now()`、`Temporal.Now.instant()` 和显式 `now` 参数获取时间，缺少统一测试基线；格式化代码还可能读取执行机器的默认时区或 locale。这会使“今天”、逻辑日、到期状态、日历范围和提醒窗口随执行环境变化。

## 目标

- 所有 Vitest 单元、组件、契约和 parser 测试默认运行在同一固定 instant。
- 首页、Todo、日历、详情、专注和提醒测试使用同一组基线常量或由其派生的 fake timer。
- 时间相关断言显式指定业务时区和 locale，不读取宿主默认值。
- 保持现有 fixture 日期和断言语义，不通过推迟日期或放宽断言规避问题。
- 项目规定的 lint、类型检查、单元测试和 Web 构建从任意系统日期运行均通过。

## 非目标

- 不把所有生产代码改造成 `Clock` 依赖注入。
- 不改变运行时对用户系统时区或 locale 的正常使用。
- 不调整 Electron E2E fixture；GAP-04 的验收范围是 Vitest 单元和组件测试及 Web 验证链。
- 不引入新依赖。

## 方案

### 统一基线

新增测试支持模块，导出唯一基线：

- 固定 instant：`2026-07-13T04:00:00.000Z`。
- 默认测试时区：`Asia/Shanghai`。
- 默认测试 locale：`zh-CN`。

Vitest setup 在每个测试前仅冻结 `Date` 并设置固定系统时间，在每个测试后恢复真实 timer。这样，未显式注入时间的 `new Date()`、`Date.now()` 和 Temporal polyfill 的 `Temporal.Now.instant()` 都获得相同 instant，同时普通异步 timer 仍可正常驱动 `vi.waitFor`。

专注测试需要控制 interval，因此在全局 Date 基线之上调用 `vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })`，并重设同一固定系统时间。它不创建第二个时间基线。

### 套件接入

- 首页：删除本地重复的 before/after fake timer；网关 `FixedClock` 使用共享 instant。验证 Todo 查询的 `now` 和周视图范围均来自该基线。
- Todo：组件 `now` prop 使用共享 instant；到期、今天、明天和未来断言保持不变。
- 日历：对依赖默认开始日的路径增加基线回归，业务时区继续显式传入。
- 详情：排序 helper 使用共享 instant；星期文本显式使用共享 locale。
- 专注：保留 interval fake timer，但初始时间改用共享 instant。
- 提醒：传入共享 instant 派生的轮询时刻，继续验证窗口边界，而不是依赖真实时钟。

### 时区和 locale

全局 setup 不篡改 `Intl` 实现，也不把产品运行时默认 locale 固定为测试值。所有对文本或日期边界敏感的测试必须显式传入业务时区和 locale。测试支持模块中的时区与 locale 常量用于消除散落字符串，但不会改变生产接口。

## 测试策略

1. 先增加基线回归测试，并在尚未注册 Vitest setup 时观察其因真实日期而失败。
2. 注册 setup 后确认 `Date.now()`、`new Date()` 和 `Temporal.Now.instant()` 都等于固定 instant。
3. 逐个迁移首页、Todo、日历、详情、专注和提醒测试，运行聚焦套件。
4. 在不同 `TZ` 环境变量下运行聚焦套件，确认业务结果不变。
5. 运行项目最低验证：ESLint、Vue TypeScript、Vitest unit/contracts/parser 和 Vite Web build。

## 风险与约束

- fake timer 若包含 timeout，可能阻止 `vi.waitFor` 推进；全局基线只 fake `Date`，不 fake timeout/interval。
- 测试覆盖范围包含 legacy parser 兼容测试；每个测试后必须恢复 timer，防止跨文件泄漏。
- 与 GAP-04 无关的用户改动和未跟踪文件保持不动。

## 验收映射

- 不依赖当前日期：全局固定 `Date`/Temporal 基线。
- 不依赖时区或 locale：时间敏感断言显式传入共享时区和 locale。
- 指定模块统一：六类套件引用同一测试支持模块。
- 完整构建可重复：运行项目规定的四项 Web 验证，并补充不同 `TZ` 的聚焦验证。
- 不规避断言：保留 2026 年 7 月 fixture 和现有分类、排序、范围及提醒窗口断言。
