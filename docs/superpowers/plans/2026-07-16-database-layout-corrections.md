# Database Layout Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Database 搜索框撑满剩余空间、将 ID 列限制为 `8rem` 单行省略，并使 Restore 控件与已确认的方案 A 一致。

**Architecture:** 只修改现有 Database 页面，通过语义类直接控制搜索框和 ID 单元格，避免位置选择器和整表固定布局。Restore 继续使用 Naive UI 按钮，但替换为线框环形图标并恢复低强调边框。

**Tech Stack:** Node.js 24 LTS、pnpm 11.11.0、TypeScript 6 strict、Vue 3、Naive UI、Ionicons 5、Vitest。

## Global Constraints

- 使用 Node.js 24 LTS 和 `packageManager` 固定的 `pnpm@11.11.0`。
- 先运行失败测试，再修改生产代码。
- `src` 保持浏览器可运行且平台无关。
- 不新增依赖，不修改锁文件，不引入 TanStack Query。
- 只修改 Database 页面及其独立测试，不改动现有未提交的详情页文件。
- 新提交使用 Conventional Commit 类型加简洁中文描述。

---

### Task 1: 修正 Database 搜索框、ID 列和 Restore 控件

**Files:**
- Modify: `src/pages/database.vue`
- Create: `tests/unit/features/database-page-source.test.ts`
- Test: `tests/unit/features/database-page.test.ts`

**Interfaces:**
- Consumes: 已有 `.database-star-filter`、`.database-deleted-cell` 和 `.database-restore` 页面结构。
- Produces: `.database-search`、`.database-id-cell` 稳定样式定位点，以及 `ReloadOutline` Restore 图标。

- [ ] **Step 1: 编写失败的源代码约束测试**

创建 `tests/unit/features/database-page-source.test.ts`：

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(process.cwd(), 'src/pages/database.vue'), 'utf8')

describe('Database page source', () => {
  it('lets the search field fill the remaining filter width', () => {
    expect(source).toContain('class="database-search"')
    expect(source).toContain('.database-search {')
    expect(source).toContain('flex: 1 1 auto;')
    expect(source).toContain('min-inline-size: 0;')
    expect(source).toContain('max-inline-size: none;')
    expect(source).not.toContain('.database-filter > :first-of-type')
  })

  it('limits the ID column to a single ellipsized 8rem line', () => {
    expect(source).toContain('<th class="database-id-cell">ID</th>')
    expect(source).toContain('<td class="database-id-cell">{{ item.id }}</td>')
    expect(source).toContain('.database-id-cell {')
    expect(source).toContain('inline-size: 8rem;')
    expect(source).toContain('max-inline-size: 8rem;')
    expect(source).toContain('overflow: hidden;')
    expect(source).toContain('text-overflow: ellipsis;')
    expect(source).toContain('white-space: nowrap;')
  })

  it('uses the outlined circular Restore control from option A', () => {
    expect(source).toContain("import { ReloadOutline, Star } from '@vicons/ionicons5'")
    expect(source).toContain('<NIcon><ReloadOutline /></NIcon>')
    expect(source).toContain('size="tiny"')
    expect(source).not.toContain('ArrowUndo')
  })
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/database-page-source.test.ts
```

Expected: FAIL；页面没有 `.database-search` 和 `.database-id-cell`，仍使用 `ArrowUndo`。

- [ ] **Step 3: 给搜索框和 ID 列添加语义类**

在 `src/pages/database.vue` 中修改模板：

```vue
<NInput
  v-model:value="search"
  class="database-search"
  placeholder="Search Name or Comment..."
  :input-props="{ id: 'database-search' }"
  clearable
/>
```

```vue
<th class="database-id-cell">ID</th>
```

```vue
<td class="database-id-cell">{{ item.id }}</td>
```

- [ ] **Step 4: 添加搜索框和 ID 列最小样式**

删除 `.database-filter > :first-of-type` 规则，并加入：

```css
.database-search {
  flex: 1 1 auto;
  min-inline-size: 0;
  max-inline-size: none;
}
.database-id-cell {
  inline-size: 8rem;
  max-inline-size: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: 将 Restore 改为方案 A 的环形图标按钮**

替换图标导入：

```ts
import { ReloadOutline, Star } from '@vicons/ionicons5'
```

Restore 按钮不再使用 `text`，改为：

```vue
<NButton
  v-if="item.deleted"
  size="tiny"
  class="database-restore"
  aria-label="Restore schedule"
  @click.stop="restore(item.id)"
>
  <NIcon><ReloadOutline /></NIcon>
</NButton>
```

并将样式调整为：

```css
.database-restore {
  inline-size: 1.75rem;
  min-inline-size: 1.75rem;
  block-size: 1.75rem;
  margin-inline-start: 0.35rem;
  padding: 0;
  color: var(--color-text-muted);
}
```

- [ ] **Step 6: 运行聚焦测试并确认 GREEN**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/features/database-page-source.test.ts tests/unit/features/database-page.test.ts tests/unit/features/secondary-pages.test.ts
```

Expected: PASS，三个测试文件全部通过。

- [ ] **Step 7: 运行静态验证和 Web 构建**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vite.cmd build
```

Expected: 三条命令退出码均为 `0`。

- [ ] **Step 8: 检查并提交改动**

```powershell
git diff --check -- src/pages/database.vue tests/unit/features/database-page-source.test.ts
git add src/pages/database.vue tests/unit/features/database-page-source.test.ts
git commit -m "fix(database): 修正筛选布局与恢复图标"
```
