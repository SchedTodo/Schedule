# Database Legacy Filter Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 恢复旧版 Database 的搜索、日期、Type、Star 图标筛选，并让默认列表同时展示未删除和已删除日程，同时把 Restore 图标放到 Deleted 状态旁。

**Architecture:** 将 `ScheduleSearchQuerySchema.deleted` 改为可选字段，以“省略即全部、布尔值即精确过滤”统一 Web 内存网关、应用服务、IPC 和 SQLite 仓库的语义。Database 页面只发送用户可见的旧版筛选条件；Restore 继续调用现有 `setDeleted` 能力，但作为 Deleted 单元格内的低强调图标呈现。

**Tech Stack:** Node.js 24 LTS、pnpm 11.11.0、TypeScript 6 strict、Vue 3、Naive UI、Zod 4、Drizzle ORM、better-sqlite3、Vitest、Vue Test Utils。

## Global Constraints

- 使用 Node.js 24 LTS 和 `packageManager` 固定的 `pnpm@11.11.0`。
- 对行为变更严格执行测试驱动开发：先看到目标测试失败，再写最小实现。
- `src` 保持浏览器可运行且平台无关；Electron 专属实现只放在 `src-electron`。
- 进程、IPC、文件和持久化边界继续由 Zod 校验，不降低 TypeScript strictness。
- 不引入 TanStack Query，不增加依赖，不修改锁文件。
- 保留当前工作区内与本任务无关的用户改动；`tests/unit/features/secondary-pages.test.ts` 已有用户改动，只能暂存本任务产生的 Database 测试小块。
- 新提交使用 Conventional Commit 类型加简洁中文描述。

---

### Task 1: 统一全部删除状态的查询语义

**Files:**
- Modify: `src/contracts/schedule.contract.ts`
- Modify: `src/platform/browser/in-memory-gateway.ts`
- Modify: `src-electron/adapters/db/schedule-repository.ts`
- Test: `tests/contracts/schedule-management.contract.test.ts`
- Test: `tests/unit/platform/schedule-management.test.ts`
- Test: `tests/integration/database/schedule-management.test.ts`

**Interfaces:**
- Consumes: `ScheduleSearchQuerySchema`、`ScheduleSearchQuery`、`ScheduleGateway.searchPage(query)` 和 `ScheduleRepository.searchPage(query)`。
- Produces: `deleted?: boolean` 查询语义；省略时返回全部，`false` 只返回未删除，`true` 只返回已删除。

- [ ] **Step 1: 修改契约测试，要求省略 deleted 时不注入默认值**

将 `tests/contracts/schedule-management.contract.test.ts` 中 Database 筛选断言改为：

```ts
it('validates database filters and paging', () => {
  const parsed = ScheduleSearchQuerySchema.parse({ page: 2, pageSize: 25, starred: true })
  expect(parsed).toMatchObject({ page: 2, pageSize: 25, starred: true })
  expect(parsed).not.toHaveProperty('deleted')
  expect(ScheduleSearchQuerySchema.parse({ deleted: false }).deleted).toBe(false)
  expect(ScheduleSearchQuerySchema.parse({ deleted: true }).deleted).toBe(true)
  expect(ScheduleSearchQuerySchema.safeParse({ page: 0, pageSize: 201 }).success).toBe(false)
})
```

- [ ] **Step 2: 增加内存网关的全部/未删除/已删除查询测试**

在 `tests/unit/platform/schedule-management.test.ts` 的管理测试中，在恢复日程之前加入：

```ts
const active = await gateway.schedules.create({
  title: 'Planning', recurrenceCode: '2026/7/14 10:00-11:00;', exclusionCode: '', comment: ''
})
if (!active.ok) throw new Error(active.error.message)

const all = await gateway.schedules.searchPage({ page: 1, pageSize: 20, search: '' })
expect(all.ok && all.value.items.map(({ id }) => id)).toEqual(
  expect.arrayContaining([schedule.id, active.value.id])
)
const activeOnly = await gateway.schedules.searchPage({ deleted: false, page: 1, pageSize: 20, search: '' })
expect(activeOnly.ok && activeOnly.value.items.map(({ id }) => id)).toEqual([active.value.id])
const deletedOnly = await gateway.schedules.searchPage({ deleted: true, page: 1, pageSize: 20, search: '' })
expect(deletedOnly.ok && deletedOnly.value.items.map(({ id }) => id)).toEqual([schedule.id])
```

- [ ] **Step 3: 增加 SQLite 仓库的全部/未删除/已删除查询测试**

在 `tests/integration/database/schedule-management.test.ts` 新增：

```ts
it('queries all deletion states when deleted is omitted', async () => {
  const active = {
    id: '10000000-0000-4000-8000-000000000001', kind: 'event' as const,
    title: 'Active', recurrenceCode: '2026/7/13 10:00-11:00;', exclusionCode: '',
    comment: '', starred: false, createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
  }
  const deleted = {
    ...active,
    id: '10000000-0000-4000-8000-000000000002',
    title: 'Deleted'
  }
  await repository.save(active)
  await repository.save(deleted)
  await repository.setDeleted(deleted.id, true, '2026-07-11T09:00:00Z')

  const all = await repository.searchPage({ search: '', page: 1, pageSize: 20 })
  expect(all.ok && all.value.items.map(({ id }) => id)).toEqual(
    expect.arrayContaining([active.id, deleted.id])
  )
  const activeOnly = await repository.searchPage({ search: '', deleted: false, page: 1, pageSize: 20 })
  expect(activeOnly.ok && activeOnly.value.items.map(({ id }) => id)).toEqual([active.id])
  const deletedOnly = await repository.searchPage({ search: '', deleted: true, page: 1, pageSize: 20 })
  expect(deletedOnly.ok && deletedOnly.value.items.map(({ id }) => id)).toEqual([deleted.id])
})
```

- [ ] **Step 4: 运行目标测试并确认失败原因**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/schedule-management.contract.test.ts tests/unit/platform/schedule-management.test.ts tests/integration/database/schedule-management.test.ts
```

Expected: FAIL；契约仍注入 `deleted: false`，内存网关和 SQLite 仓库在省略字段时仍只返回未删除日程。

- [ ] **Step 5: 将 deleted 改为可选契约字段**

在 `src/contracts/schedule.contract.ts` 中替换字段定义：

```ts
export const ScheduleSearchQuerySchema = z.object({
  search: z.string().trim().max(200).default(''),
  start: z.iso.datetime({ offset: true }).optional(),
  end: z.iso.datetime({ offset: true }).optional(),
  kind: ScheduleKindSchema.optional(),
  starred: z.boolean().optional(),
  deleted: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(200).default(20)
}).strict().refine((value) =>
  value.start === undefined || value.end === undefined || Date.parse(value.start) <= Date.parse(value.end),
{ message: 'Search start must not follow end', path: ['end'] })
```

- [ ] **Step 6: 让浏览器内存网关仅在显式传值时过滤删除状态**

在 `src/platform/browser/in-memory-gateway.ts` 的 `searchPage` 过滤器中使用：

```ts
const matches = schedules.filter((schedule) => {
  if (
    parsed.data.deleted !== undefined &&
    deletedScheduleIds.has(schedule.id) !== parsed.data.deleted
  ) return false
  if (parsed.data.kind && schedule.kind !== parsed.data.kind) return false
  if (parsed.data.starred !== undefined && schedule.starred !== parsed.data.starred) return false
  const search = parsed.data.search.toLocaleLowerCase()
  return search === '' || schedule.title.toLocaleLowerCase().includes(search) || schedule.comment.toLocaleLowerCase().includes(search)
})
```

- [ ] **Step 7: 让 SQLite 仓库按需添加删除状态条件**

在 `src-electron/adapters/db/schedule-repository.ts` 的 `searchPage` 开头使用：

```ts
const conditions: SQL[] = []
if (query.deleted !== undefined) {
  conditions.push(query.deleted ? isNotNull(schedules.deletedAt) : isNull(schedules.deletedAt))
}
if (query.kind !== undefined) conditions.push(eq(schedules.kind, query.kind))
if (query.starred !== undefined) conditions.push(eq(schedules.starred, query.starred))
if (query.search !== '') conditions.push(like(schedules.title, `%${query.search}%`))
let rows = this.database.select().from(schedules).where(and(...conditions))
  .orderBy(desc(schedules.updatedAt)).all()
```

- [ ] **Step 8: 运行目标测试并确认通过**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/schedule-management.contract.test.ts tests/unit/platform/schedule-management.test.ts tests/integration/database/schedule-management.test.ts
```

Expected: PASS，三个测试文件全部通过。

- [ ] **Step 9: 提交查询语义改动**

```powershell
git add src/contracts/schedule.contract.ts src/platform/browser/in-memory-gateway.ts src-electron/adapters/db/schedule-repository.ts tests/contracts/schedule-management.contract.test.ts tests/unit/platform/schedule-management.test.ts tests/integration/database/schedule-management.test.ts
git commit -m "fix(database): 支持查询全部删除状态"
```

### Task 2: 恢复旧版筛选栏并安置 Restore 图标

**Files:**
- Modify: `src/pages/database.vue`
- Create: `tests/unit/features/database-page.test.ts`
- Modify surgically: `tests/unit/features/secondary-pages.test.ts`

**Interfaces:**
- Consumes: `ScheduleGateway.searchPage` 的可选 `deleted` 语义和 `ScheduleGateway.setDeleted({ id, deleted })`。
- Produces: `.database-star-filter`、`.database-deleted-cell`、`.database-restore` 三个稳定的页面测试定位点。

- [ ] **Step 1: 新建 Database 页面测试夹具**

创建 `tests/unit/features/database-page.test.ts`，包含两个日程、内存网关和 `/database` 路由：

```ts
import { mount } from '@vue/test-utils'
import { NSelect } from 'naive-ui'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import { platformGatewayKey } from '../../../src/app/injection-keys'
import type { ScheduleDto } from '../../../src/contracts/schedule.contract'
import DatabasePage from '../../../src/pages/database.vue'
import { createInMemoryGateway } from '../../../src/platform/browser/in-memory-gateway'

const active: ScheduleDto = {
  id: '10000000-0000-4000-8000-000000000001', kind: 'event', title: 'Active',
  recurrenceCode: '2026/7/13 10:00-11:00;', exclusionCode: '', comment: '', starred: false,
  createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-11T08:00:00Z'
}
const deleted: ScheduleDto = {
  ...active,
  id: '10000000-0000-4000-8000-000000000002',
  title: 'Archived review'
}

async function mountDatabase() {
  const platform = createInMemoryGateway([active, deleted])
  await platform.schedules.setDeleted({ id: deleted.id, deleted: true })
  const searchPage = vi.spyOn(platform.schedules, 'searchPage')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/database', name: 'database', component: DatabasePage },
      { path: '/schedule/:id', name: 'schedule-detail', component: { template: '<div />' } }
    ]
  })
  await router.push('/database')
  const wrapper = mount(DatabasePage, {
    global: { plugins: [router], provide: { [platformGatewayKey as symbol]: platform } }
  })
  await vi.waitFor(() => expect(wrapper.text()).toContain('Active'))
  await vi.waitFor(() => expect(wrapper.text()).toContain('Archived review'))
  return { platform, router, searchPage, wrapper }
}
```

- [ ] **Step 2: 增加旧版筛选栏与 Star 图标交互测试**

在同一文件加入：

```ts
describe('Database page', () => {
  it('uses the legacy filters and toggles the starred-only query', async () => {
    const { searchPage, wrapper } = await mountDatabase()
    expect(wrapper.findAllComponents(NSelect)).toHaveLength(1)
    expect(wrapper.find('[aria-label="Deleted filter"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Star filter"]').exists()).toBe(false)
    expect(searchPage.mock.calls[0]?.[0]).not.toHaveProperty('deleted')

    await wrapper.get('.database-star-filter').trigger('click')
    await vi.waitFor(() => expect(searchPage.mock.calls.at(-1)?.[0]).toMatchObject({ starred: true }))
    expect(searchPage.mock.calls.at(-1)?.[0]).not.toHaveProperty('deleted')
  })
```

- [ ] **Step 3: 增加 Restore 位置和阻止跳转测试**

在同一 `describe` 中加入：

```ts
it('restores a deleted row from the Deleted cell without navigating', async () => {
  const { platform, router, wrapper } = await mountDatabase()
  const deletedRow = wrapper.findAll('tbody tr').find((row) => row.text().includes('Archived review'))
  if (!deletedRow) throw new Error('Deleted row was not rendered')
  const cells = deletedRow.findAll('td')
  expect(cells[2]?.classes()).toContain('database-deleted-cell')
  expect(cells[2]?.find('.database-restore').exists()).toBe(true)
  expect(cells[6]?.find('.database-restore').exists()).toBe(false)

  await cells[2]!.get('.database-restore').trigger('click')
  await vi.waitFor(async () => {
    await expect(platform.schedules.findById(deleted.id)).resolves.toMatchObject({
      ok: true,
      value: { deleted: false }
    })
  })
  expect(router.currentRoute.value.name).toBe('database')
})
})
```

- [ ] **Step 4: 调整受旧 Deleted 下拉假设影响的现有测试**

在 `tests/unit/features/secondary-pages.test.ts` 的 `opens deleted schedules from Database for read-only detail` 测试中，仅删除：

```ts
wrapper.findAllComponents(NSelect)[2]!.vm.$emit('update:value', 'deleted')
```

保留该文件内所有现有用户改动；默认查询现在应直接渲染已删除日程。

- [ ] **Step 5: 运行页面测试并确认失败原因**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/database-page.test.ts tests/unit/features/secondary-pages.test.ts
```

Expected: FAIL；页面仍有三个 `NSelect`，缺少 `.database-star-filter`，Restore 仍位于 Star 单元格。

- [ ] **Step 6: 替换页面筛选状态和查询参数**

在 `src/pages/database.vue` 中使用：

```ts
import { ArrowUndo, Star } from '@vicons/ionicons5'
import { NButton, NCard, NDatePicker, NIcon, NInput, NSelect, NTag } from 'naive-ui'

const starredOnly = ref(false)

async function refresh() {
  const result = await platform.schedules.searchPage({
    search: search.value,
    ...(dates.value === null
      ? {}
      : { start: new Date(dates.value[0]).toISOString(), end: new Date(dates.value[1]).toISOString() }),
    ...(kind.value === null ? {} : { kind: kind.value }),
    ...(starredOnly.value ? { starred: true } : {}),
    page: page.value,
    pageSize
  })
  if (result.ok) {
    items.value = result.value.items
    total.value = result.value.total
  }
}

function toggleStarFilter() {
  starredOnly.value = !starredOnly.value
}

watch([search, kind, dates, starredOnly], () => {
  page.value = 1
  void refresh()
}, { immediate: true })
```

删除 `deleted` 和三态 `starred` ref，以及查询中的 `deleted` 参数。

- [ ] **Step 7: 将筛选模板恢复为 Type 下拉加 Star 图标**

删除可见的 `<span>Type</span>`、Star `NSelect` 和 Deleted `NSelect`，在 Type `NSelect` 后加入：

```vue
<NButton
  text
  class="database-star-filter"
  :aria-label="starredOnly ? 'Show all schedules' : 'Show starred schedules'"
  :color="starredOnly ? '#ffe742' : '#c2c2c2'"
  @click="toggleStarFilter"
>
  <NIcon><Star /></NIcon>
</NButton>
```

- [ ] **Step 8: 将 Restore 移到 Deleted 单元格并保持 Star 单元格纯粹**

用以下单元格替换当前 Deleted 和 Star 内容：

```vue
<td class="database-deleted-cell">
  <NTag type="error">{{ item.deleted }}</NTag>
  <NButton
    v-if="item.deleted"
    text
    class="database-restore"
    aria-label="Restore schedule"
    @click.stop="restore(item.id)"
  >
    <NIcon><ArrowUndo /></NIcon>
  </NButton>
</td>
```

```vue
<td>
  <NIcon :color="item.starred ? '#ffe742' : '#c2c2c2'">
    <Star />
  </NIcon>
</td>
```

在 scoped CSS 中加入：

```css
.database-star-filter {
  flex: 0 0 auto;
  font-size: 1.25rem;
}
.database-deleted-cell {
  white-space: nowrap;
}
.database-restore {
  margin-inline-start: 0.35rem;
  color: var(--color-text-muted);
}
```

- [ ] **Step 9: 运行页面测试并确认通过**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/database-page.test.ts tests/unit/features/secondary-pages.test.ts
```

Expected: PASS，两个测试文件全部通过。

- [ ] **Step 10: 检查并暂存仅属于本任务的改动**

Run:

```powershell
git diff -- src/pages/database.vue tests/unit/features/database-page.test.ts tests/unit/features/secondary-pages.test.ts
git add src/pages/database.vue tests/unit/features/database-page.test.ts
git add -p tests/unit/features/secondary-pages.test.ts
git diff --cached --check
```

Expected: `secondary-pages.test.ts` 只暂存删除旧 Deleted 下拉操作的测试小块，不包含用户已有的详情页测试改动。

- [ ] **Step 11: 提交页面改动**

```powershell
git commit -m "fix(database): 还原旧版筛选与恢复入口"
```

### Task 3: 完成项目级验证

**Files:**
- Verify only; no source files should change.

**Interfaces:**
- Consumes: Task 1 的统一查询语义和 Task 2 的 Database 页面交互。
- Produces: lint、Web 类型检查、单元/契约/解析器测试和 Web 构建通过的验证记录。

- [ ] **Step 1: 运行 ESLint**

```powershell
.\node_modules\.bin\eslint.cmd .
```

Expected: exit code 0，无 lint error。

- [ ] **Step 2: 运行 Web TypeScript 检查**

```powershell
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: exit code 0，无类型错误。

- [ ] **Step 3: 运行 Web 基础测试集**

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
```

Expected: exit code 0，全部测试通过。

- [ ] **Step 4: 运行 SQLite 聚焦集成测试**

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/database/schedule-management.test.ts
```

Expected: exit code 0，Database 查询语义测试通过。

- [ ] **Step 5: 构建 Web 应用**

```powershell
.\node_modules\.bin\vite.cmd build
```

Expected: exit code 0，生成 `dist-web`。

- [ ] **Step 6: 检查最终改动范围**

```powershell
git status --short
git diff --check
git diff --cached --check
```

Expected: 无空白错误；用户原有未提交改动仍保留，任务提交中没有无关文件。
