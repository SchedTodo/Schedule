# 可重复测试时间基线实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有 Vitest 测试建立 2026 年 7 月的统一固定时间基线，并让首页、Todo、日历、详情、专注和提醒测试显式复用该基线。

**Architecture:** `tests/support/time.ts` 只保存测试常量，`tests/setup.ts` 负责每个测试的 Date fake timer 生命周期，`vite.config.ts` 统一注册 setup。各时间敏感套件从支持模块取值；专注套件仅额外 fake interval，生产代码保持不变。

**Tech Stack:** Node.js 24 LTS、pnpm 11.11.0、Vitest、Vue Test Utils、Temporal polyfill、TypeScript strict mode。

## Global Constraints

- 固定 instant 必须是 `2026-07-13T04:00:00.000Z`，默认测试时区必须是 `Asia/Shanghai`，默认测试 locale 必须是 `zh-CN`。
- 不引入新依赖，不修改生产运行时的时区或 locale 行为。
- 不推迟既有 fixture 日期，不放宽现有业务断言。
- 全局 fake timer 只 fake `Date`；专注测试按需额外 fake `setInterval` 和 `clearInterval`。
- 保留与 GAP-04 无关的用户改动和未跟踪文件。

---

### Task 1: 建立全局 Vitest 时间基线

**Files:**
- Create: `tests/support/time.ts`
- Create: `tests/setup.ts`
- Create: `tests/unit/test-time-baseline.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `TEST_NOW = '2026-07-13T04:00:00.000Z'`。
- Produces: `TEST_TIME_ZONE = 'Asia/Shanghai'`。
- Produces: `TEST_LOCALE = 'zh-CN'`。
- Produces: Vitest 每测试自动安装和恢复的 Date-only fake timer。

- [ ] **Step 1: 创建常量模块并写失败的基线回归测试**

创建 `tests/support/time.ts`：

```ts
export const TEST_NOW = '2026-07-13T04:00:00.000Z'
export const TEST_TIME_ZONE = 'Asia/Shanghai'
export const TEST_LOCALE = 'zh-CN'
```

创建 `tests/unit/test-time-baseline.test.ts`：

```ts
import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'

import { TEST_NOW } from '../support/time'

describe('test time baseline', () => {
  it('freezes Date and Temporal.Now at the shared instant', () => {
    expect(new Date().toISOString()).toBe(TEST_NOW)
    expect(Date.now()).toBe(Date.parse(TEST_NOW))
    expect(Temporal.Now.instant().toString()).toBe(TEST_NOW.replace('.000Z', 'Z'))
  })
})
```

- [ ] **Step 2: 运行回归测试并确认 RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/test-time-baseline.test.ts --reporter=verbose
```

Expected: FAIL，因为 `new Date()` 和 `Temporal.Now.instant()` 仍读取执行机器当前时间，而不是 `TEST_NOW`。

- [ ] **Step 3: 注册最小全局 setup**

创建 `tests/setup.ts`：

```ts
import { afterEach, beforeEach, vi } from 'vitest'

import { TEST_NOW } from './support/time'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})
```

在 `vite.config.ts` 的 `test` 配置中增加：

```ts
setupFiles: ['tests/setup.ts']
```

- [ ] **Step 4: 运行基线测试并确认 GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/test-time-baseline.test.ts --reporter=verbose
```

Expected: PASS，三个时间入口都等于共享 instant。

- [ ] **Step 5: 提交全局基线**

```powershell
git add vite.config.ts tests/setup.ts tests/support/time.ts tests/unit/test-time-baseline.test.ts
git commit -m "test: 建立统一测试时间基线"
```

### Task 2: 统一六类时间敏感套件

**Files:**
- Modify: `tests/unit/features/home-workspace.test.ts`
- Modify: `tests/unit/features/todo-sidebar.test.ts`
- Modify: `tests/unit/features/occurrence-calendar.test.ts`
- Modify: `tests/unit/features/schedule-detail-presentation.test.ts`
- Modify: `tests/unit/features/concentrate-page.test.ts`
- Modify: `tests/unit/application/alarm-scheduler.test.ts`

**Interfaces:**
- Consumes: `TEST_NOW`、`TEST_TIME_ZONE`、`TEST_LOCALE` from `tests/support/time.ts`。
- Produces: 首页 Todo 查询时间、默认周范围、Todo tone、详情排序、专注记录和提醒窗口的确定性覆盖。

- [ ] **Step 1: 写首页和默认日历范围的失败回归断言**

在 `home-workspace.test.ts` 中让 mount helper 接受可选网关，并新增断言，验证首页调用：

```ts
expect(listTodos).toHaveBeenCalledWith({
  now: TEST_NOW,
  timeZone: 'UTC',
  logicalDayStartHour: 0,
  logicalDayStartMinute: 0
})
```

在 `occurrence-calendar.test.ts` 中不传 `startDate` 挂载 `WeekScheduleView`，断言 2026-07-13 的 occurrence 出现在默认第一天：

```ts
const wrapper = mount(WeekScheduleView, {
  props: { items: [occurrences[0]!], timeZone: 'UTC', dayCount: 1 }
})
expect(wrapper.get('.day-card header').text()).toBe('2026/07/13')
expect(wrapper.get('[data-occurrence-id]').attributes('data-occurrence-id'))
  .toBe(occurrences[0]!.id)
```

- [ ] **Step 2: 临时禁用 setup 注册并确认新断言会 RED**

从 `vite.config.ts` 暂时删除 `setupFiles` 行后运行：

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/occurrence-calendar.test.ts --reporter=verbose
```

Expected: 至少一个新增断言 FAIL，因为页面和周视图默认值读取真实系统日期。确认后立即恢复 `setupFiles: ['tests/setup.ts']`，不提交临时删除。

- [ ] **Step 3: 用共享常量替换套件内的时间基线**

实施以下机械替换，同时保持现有断言内容：

```ts
// home-workspace.test.ts
import { TEST_NOW } from '../../support/time'
const fixedNow = TEST_NOW
// 删除该文件重复的 Date-only beforeEach/afterEach；全局 setup 负责生命周期。

// todo-sidebar.test.ts
import { TEST_NOW, TEST_TIME_ZONE } from '../../support/time'
// props.now = TEST_NOW，props.timeZone = TEST_TIME_ZONE

// schedule-detail-presentation.test.ts
import { TEST_LOCALE, TEST_NOW, TEST_TIME_ZONE } from '../../support/time'
// Temporal.Instant.from(TEST_NOW)、TEST_TIME_ZONE、TEST_LOCALE

// concentrate-page.test.ts
import { TEST_NOW } from '../../support/time'
const initialTime = TEST_NOW
// mountPage 继续额外 fake Date/setInterval/clearInterval，并 setSystemTime(TEST_NOW)。
```

`occurrence-calendar.test.ts` 对 UTC 和 Asia/Shanghai 场景继续显式传时区；新增默认范围测试使用全局基线。不要把 UTC 场景统一改成 Asia/Shanghai。

- [ ] **Step 4: 让提醒窗口从共享 instant 派生**

在 `alarm-scheduler.test.ts` 增加：

```ts
import { TEST_NOW } from '../../support/time'

const pollingNow = new Date(Date.parse(TEST_NOW) - 15_000).toISOString()
const alarmTarget = new Date(Date.parse(TEST_NOW) + 5 * 60_000).toISOString()
```

把 event 的 `start` 和 Todo 的 `end` 设为 `alarmTarget`，两个 `dueAlarms` 调用都传 `pollingNow`。保留“30 秒窗口、提前 5 分钟、禁用 event 后只返回 Todo”的原断言。

- [ ] **Step 5: 运行六类聚焦套件并确认 GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/schedule-detail-presentation.test.ts tests/unit/features/concentrate-page.test.ts tests/unit/application/alarm-scheduler.test.ts --reporter=verbose
```

Expected: PASS；首页异步等待不挂起，专注 interval 可推进，所有原业务断言保持通过。

- [ ] **Step 6: 在不同宿主时区下复验聚焦套件**

Run:

```powershell
$env:TZ='America/Los_Angeles'
.\node_modules\.bin\vitest.cmd run tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/schedule-detail-presentation.test.ts tests/unit/features/concentrate-page.test.ts tests/unit/application/alarm-scheduler.test.ts --reporter=verbose
Remove-Item Env:TZ
```

Expected: PASS，结果与 Asia/Shanghai 执行环境一致。

- [ ] **Step 7: 提交套件迁移**

```powershell
git add tests/unit/features/home-workspace.test.ts tests/unit/features/todo-sidebar.test.ts tests/unit/features/occurrence-calendar.test.ts tests/unit/features/schedule-detail-presentation.test.ts tests/unit/features/concentrate-page.test.ts tests/unit/application/alarm-scheduler.test.ts
git commit -m "test: 统一时间敏感场景基线"
```

### Task 3: 完整验证 GAP-04

**Files:**
- Modify only if a verification failure traces to GAP-04 files from Tasks 1-2.

**Interfaces:**
- Consumes: 全局 setup 和已迁移的时间敏感套件。
- Produces: lint、类型检查、单元测试和 Web 构建的最新验证证据。

- [ ] **Step 1: 检查时间入口和断言约束**

Run:

```powershell
rg -n "vi\.useFakeTimers|vi\.setSystemTime|Temporal\.Now|Date\.now|new Date\(" tests/unit tests/contracts tests/parser
git diff --check
```

Expected: 六类套件复用 `tests/support/time.ts`；没有推迟日期或删除业务断言；diff 无空白错误。

- [ ] **Step 2: 运行 ESLint**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
```

Expected: exit 0。

- [ ] **Step 3: 运行 Vue TypeScript 检查**

Run:

```powershell
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: exit 0。

- [ ] **Step 4: 运行规定的单元、契约和 parser 测试**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
```

Expected: 所有测试通过，0 failed。

- [ ] **Step 5: 运行 Web 构建**

Run:

```powershell
.\node_modules\.bin\vite.cmd build
```

Expected: exit 0，并生成 Web 构建产物。

- [ ] **Step 6: 核对工作区范围**

Run:

```powershell
git status --short
git diff --stat HEAD~2..HEAD
```

Expected: GAP-04 提交只包含计划列出的测试基建、测试文件和文档；既有未跟踪用户文件未被暂存或修改。

## Plan Self-Review

- Spec coverage: Task 1 覆盖全局日期基线，Task 2 覆盖首页、Todo、日历、详情、专注和提醒，Task 3 覆盖项目规定的四项 Web 验证和跨时区复验。
- Placeholder scan: 所有代码步骤都给出实际常量、API、命令和预期结果，没有待定实现。
- Type consistency: 三个共享常量均为字符串；`TEST_NOW` 可用于 `vi.setSystemTime`、`FixedClock` 和 `Temporal.Instant.from`，时区与 locale 只传给已有 string 参数。
- Scope control: 不修改生产代码、不添加依赖、不触碰 Electron E2E 或 legacy v1 源码。
