# 提醒时间与通知展示对齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 关闭 `GAP-03`，以统一的提醒协调器覆盖轮询、休眠恢复和影响提醒的变更，并按用户时区展示保留未知时间语义的通知。

**Architecture:** `src/application` 中的纯计算与 `AlarmCoordinator` 决定候选、左开右闭检查窗口、变更后立即提醒、补发及去重；Drizzle 只返回仍有效的提醒候选。`src-electron` 中的运行时串行化定时器、系统恢复和 IPC 变更触发，Electron notifier 只展示已经格式化的通知。

**Tech Stack:** TypeScript 6、Temporal、Zod、Drizzle ORM、Electron 43、Vitest。

## Global Constraints

- `release/1.2.0` 是不可变旧版参考；所有实现只进入 `main`。
- `src` 必须保持浏览器可运行且平台无关；Electron 类型只能出现在 `src-electron`。
- 不引入 TanStack Query，不增加持久化提醒队列表，不补发应用未运行或系统关机期间的提醒。
- 行为改动严格执行 RED–GREEN TDD；不得降低 TypeScript 严格度。
- 进程、持久化与 Electron 边界继续使用现有 DTO、`AppResult` 和 Zod 约束。
- 新提交使用 Conventional Commit 类型与简体中文祈使式描述。

---

## 文件结构

- Modify: `src/contracts/occurrence.contract.ts` — 定义内部提醒候选查询 DTO。
- Modify: `src/platform/ports.ts` — 为持久化端口增加候选查询。
- Modify: `src-electron/adapters/db/occurrence-repository.ts` — 查询未完成、未排除、未软删除且所属日程有效的候选。
- Modify: `src/application/alarm-scheduler.ts` — 只负责设置到提醒实例的纯计算与稳定键。
- Create: `src/application/alarm-notification.ts` — 只负责用户时区及未知时间标记的通知展示。
- Create: `src/application/alarm-coordinator.ts` — 统一检查窗口、重算、补发、去重与失败重试语义。
- Create: `src-electron/main/alarm-runtime.ts` — 串行化初始化、轮询、系统恢复与变更触发。
- Modify: `src-electron/main/ipc/register-handlers.ts` — 成功的提醒相关变更请求重算。
- Modify: `src-electron/main/index.ts` — 组合协调器、运行时、PowerMonitor 与数据库端口。
- Modify: `src-electron/adapters/electron-notifier.ts` — 只展示 `NotificationInput`。
- Modify/Create tests under `tests/contracts`, `tests/unit/application`, `tests/integration/database`, `tests/integration/ipc`, and `tests/integration/electron`.
- Modify: `docs/development/v2-feature-gaps.md` — 在验证通过后关闭 `GAP-03`。

---

### Task 1: 严格定义并实现提醒候选查询

**Files:**
- Modify: `src/contracts/occurrence.contract.ts`
- Modify: `src/platform/ports.ts`
- Modify: `src-electron/adapters/db/occurrence-repository.ts`
- Modify: `tests/contracts/occurrence.contract.test.ts`
- Modify: `tests/integration/database/occurrence-repository.test.ts`

**Interfaces:**
- Produces: `AlarmCandidateQuerySchema` and `AlarmCandidateQuery`.
- Produces: `OccurrenceRepository.listAlarmCandidates(query: AlarmCandidateQuery): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>`.
- Query semantics: Event requires `start !== null`, `end > checkedAt`, and `start <= through`; Todo requires `end <= through`. Both kinds exclude completed, excluded, occurrence-soft-deleted, and schedule-soft-deleted rows.

- [ ] **Step 1: Write failing contract tests**

Add to `tests/contracts/occurrence.contract.test.ts`:

```ts
import { AlarmCandidateQuerySchema } from '../../src/contracts/occurrence.contract'

it('validates bounded alarm candidate queries', () => {
  const query = {
    checkedAt: '2026-07-23T02:00:00Z',
    through: '2026-07-24T02:00:00Z'
  }
  expect(AlarmCandidateQuerySchema.safeParse(query).success).toBe(true)
  expect(AlarmCandidateQuerySchema.safeParse({
    ...query,
    through: '2026-07-23T01:59:59Z'
  }).success).toBe(false)
  expect(AlarmCandidateQuerySchema.safeParse({ ...query, extra: true }).success).toBe(false)
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts
```

Expected: FAIL because `AlarmCandidateQuerySchema` is not exported.

- [ ] **Step 3: Add the strict query contract and repository port**

Add to `src/contracts/occurrence.contract.ts`:

```ts
export const AlarmCandidateQuerySchema = z.object({
  checkedAt: z.iso.datetime({ offset: true }),
  through: z.iso.datetime({ offset: true })
}).strict().refine(
  (value) => Date.parse(value.checkedAt) <= Date.parse(value.through),
  { message: 'Alarm candidate bound must not precede check time', path: ['through'] }
)

export type AlarmCandidateQuery = z.infer<typeof AlarmCandidateQuerySchema>
```

Import `AlarmCandidateQuery` in `src/platform/ports.ts` and extend `OccurrenceRepository`:

```ts
listAlarmCandidates(
  query: AlarmCandidateQuery
): Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
```

- [ ] **Step 4: Run the contract test and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Write failing database tests for target selection and all exclusion states**

Add these explicit cases to `tests/integration/database/occurrence-repository.test.ts`. Insert the Todo schedule before calling `replaceForSchedule`:

```ts
it('lists only active alarm candidates through the target boundary', async () => {
  const eventScheduleId = '10000000-0000-4000-8000-000000000001'
  const todoScheduleId = '10000000-0000-4000-8000-000000000002'
  sqlite.prepare(`INSERT INTO schedule
    (id, kind, title, recurrence_code, exclusion_code, comment, starred, created_at, updated_at)
    VALUES (?, 'todo', 'Due todo', '', '', '', 0, 1, 1)`)
    .run(todoScheduleId)
  await repository.replaceForSchedule(eventScheduleId, [
    {
      id: '20000000-0000-4000-8000-000000000001',
      excluded: false,
      start: '2026-07-23T03:00:00Z',
      end: '2026-07-23T04:00:00Z',
      startMark: '11',
      endMark: '11',
      comment: '',
      done: false
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      excluded: false,
      start: '2026-07-23T01:00:00Z',
      end: '2026-07-23T02:00:00Z',
      startMark: '11',
      endMark: '11',
      comment: '',
      done: false
    }
  ])
  await repository.replaceForSchedule(todoScheduleId, [
    {
      id: '20000000-0000-4000-8000-000000000003',
      excluded: false,
      start: null,
      end: '2026-07-23T05:00:00Z',
      startMark: '11',
      endMark: '11',
      comment: '',
      done: false
    },
    {
      id: '20000000-0000-4000-8000-000000000004',
      excluded: false,
      start: null,
      end: '2026-07-23T05:00:01Z',
      startMark: '11',
      endMark: '11',
      comment: '',
      done: false
    }
  ])
  const result = await repository.listAlarmCandidates({
    checkedAt: '2026-07-23T02:00:00Z',
    through: '2026-07-23T05:00:00Z'
  })

  expect(result.ok && result.value.map(({ id }) => id)).toEqual([
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000003'
  ])
})

it('excludes completed, excluded, occurrence-deleted, and schedule-deleted alarm rows', async () => {
  const scheduleId = '10000000-0000-4000-8000-000000000001'
  const deletedScheduleId = '10000000-0000-4000-8000-000000000002'
  sqlite.prepare(`INSERT INTO schedule
    (id, kind, title, recurrence_code, exclusion_code, comment, starred, deleted_at, created_at, updated_at)
    VALUES (?, 'event', 'Deleted schedule', 'rule', '', '', 0, 1, 1, 1)`)
    .run(deletedScheduleId)
  await repository.replaceForSchedule(scheduleId, [
    { id: '20000000-0000-4000-8000-000000000001', excluded: false, start: '2026-07-23T03:00:00Z', end: '2026-07-23T04:00:00Z', startMark: '11', endMark: '11', comment: '', done: false },
    { id: '20000000-0000-4000-8000-000000000002', excluded: true, start: '2026-07-23T03:00:00Z', end: '2026-07-23T04:00:00Z', startMark: '11', endMark: '11', comment: '', done: false },
    { id: '20000000-0000-4000-8000-000000000003', excluded: false, start: '2026-07-23T03:00:00Z', end: '2026-07-23T04:00:00Z', startMark: '11', endMark: '11', comment: '', done: true },
    { id: '20000000-0000-4000-8000-000000000004', excluded: false, start: '2026-07-23T03:00:00Z', end: '2026-07-23T04:00:00Z', startMark: '11', endMark: '11', comment: '', done: false, deletedAt: '2026-07-23T01:00:00Z' }
  ])
  await repository.replaceForSchedule(deletedScheduleId, [
    { id: '20000000-0000-4000-8000-000000000005', excluded: false, start: '2026-07-23T03:00:00Z', end: '2026-07-23T04:00:00Z', startMark: '11', endMark: '11', comment: '', done: false }
  ])
  const result = await repository.listAlarmCandidates({
    checkedAt: '2026-07-23T02:00:00Z',
    through: '2026-07-23T05:00:00Z'
  })

  expect(result.ok && result.value.map(({ id }) => id))
    .toEqual(['20000000-0000-4000-8000-000000000001'])
})
```

Use explicit SQL fixture inserts in the existing in-memory database. Do not reuse `listRange` or `listTodos` assertions because their logical-day semantics differ from alarm candidates.

- [ ] **Step 6: Run the database test and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/database/occurrence-repository.test.ts
```

Expected: FAIL because `listAlarmCandidates` is not implemented.

- [ ] **Step 7: Implement the minimal Drizzle query**

Extend the Drizzle imports with `gt`, `isNotNull`, `lte`, and `or`. Implement `listAlarmCandidates` in `DrizzleOccurrenceRepository`:

```ts
async listAlarmCandidates(
  query: AlarmCandidateQuery
): Promise<AppResult<readonly ScheduleOccurrenceDto[]>> {
  const parsed = AlarmCandidateQuerySchema.safeParse(query)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_FAILED', message: '提醒候选查询无效' }
    }
  }
  try {
    const rows = this.database
      .select({ occurrence: scheduleOccurrences, schedule: schedules })
      .from(scheduleOccurrences)
      .innerJoin(schedules, eq(scheduleOccurrences.scheduleId, schedules.id))
      .where(and(
        isNull(scheduleOccurrences.deletedAt),
        isNull(schedules.deletedAt),
        eq(scheduleOccurrences.excluded, false),
        eq(scheduleOccurrences.done, false),
        or(
          and(
            eq(schedules.kind, 'event'),
            isNotNull(scheduleOccurrences.start),
            gt(scheduleOccurrences.end, new Date(parsed.data.checkedAt)),
            lte(scheduleOccurrences.start, new Date(parsed.data.through))
          ),
          and(
            eq(schedules.kind, 'todo'),
            lte(scheduleOccurrences.end, new Date(parsed.data.through))
          )
        )
      ))
      .orderBy(asc(scheduleOccurrences.end))
      .all()

    return {
      ok: true,
      value: rows.map(({ occurrence, schedule }) => ({
        id: occurrence.id,
        scheduleId: occurrence.scheduleId,
        kind: schedule.kind,
        title: schedule.title,
        excluded: occurrence.excluded,
        start: occurrence.start?.toISOString() ?? null,
        end: occurrence.end.toISOString(),
        startMark: occurrence.startMark,
        endMark: occurrence.endMark,
        comment: occurrence.comment,
        done: occurrence.done
      }))
    }
  } catch (error) {
    return { ok: false, error: persistenceError(error) }
  }
}
```

Import `AlarmCandidateQuerySchema` with the type. The explicit `safeParse` branch ensures the persistence boundary rejects malformed runtime values consistently.

- [ ] **Step 8: Run focused contracts and database tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/contracts/occurrence.contract.test.ts tests/integration/database/occurrence-repository.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit candidate querying**

```powershell
git add src/contracts/occurrence.contract.ts src/platform/ports.ts src-electron/adapters/db/occurrence-repository.ts tests/contracts/occurrence.contract.test.ts tests/integration/database/occurrence-repository.test.ts
git commit -m "feat(alarm): 增加有效提醒候选查询"
```

---

### Task 2: 纯计算提醒时间并格式化通知

**Files:**
- Modify: `src/application/alarm-scheduler.ts`
- Create: `src/application/alarm-notification.ts`
- Modify: `tests/unit/application/alarm-scheduler.test.ts`
- Create: `tests/unit/application/alarm-notification.test.ts`

**Interfaces:**
- Produces: `ScheduledAlarm { occurrence, alarmAt }`.
- Produces: `scheduledAlarms(occurrences, settings): readonly ScheduledAlarm[]`.
- Produces: `alarmKey(alarm): string`.
- Produces: `isAlarmDue(alarm, previous, current): boolean` with `(previous, current]`.
- Produces: `notificationForAlarm(alarm, timeZone): NotificationInput`.

- [ ] **Step 1: Replace the scheduler test expectations with explicit boundary tests**

In `tests/unit/application/alarm-scheduler.test.ts`, keep the deterministic fixture and add:

```ts
it('uses a left-open and right-closed polling interval', () => {
  const [alarm] = scheduledAlarms([event], {
    ...defaultSettings,
    eventAlarmBeforeMinutes: 5
  })
  expect(alarm).toBeDefined()
  const oneSecondBefore = new Date(Date.parse(alarm!.alarmAt) - 1_000).toISOString()
  const thirtySecondsAfter = new Date(Date.parse(alarm!.alarmAt) + 30_000).toISOString()
  expect(isAlarmDue(alarm!, alarm!.alarmAt, thirtySecondsAfter)).toBe(false)
  expect(isAlarmDue(
    alarm!,
    oneSecondBefore,
    alarm!.alarmAt
  )).toBe(true)
})

it('filters completed, excluded, and disabled candidates before scheduling', () => {
  expect(scheduledAlarms([
    { ...event, done: true },
    {
      ...event,
      id: '10000000-0000-4000-8000-000000000002',
      excluded: true
    }
  ], defaultSettings)).toEqual([])
  expect(scheduledAlarms([event], {
    ...defaultSettings,
    eventAlarmEnabled: false
  })).toEqual([])
})

it('uses a stable occurrence and alarm-time key', () => {
  const [alarm] = scheduledAlarms([event], defaultSettings)
  expect(alarmKey(alarm!)).toBe(`${event.id}:${alarm!.alarmAt}`)
})
```

- [ ] **Step 2: Run scheduler tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/alarm-scheduler.test.ts
```

Expected: FAIL because the new pure APIs do not exist.

- [ ] **Step 3: Implement the minimal pure scheduler**

Refactor `src/application/alarm-scheduler.ts` to expose:

```ts
export interface ScheduledAlarm {
  readonly occurrence: ScheduleOccurrenceDto
  readonly alarmAt: string
}

export function scheduledAlarms(
  occurrences: readonly ScheduleOccurrenceDto[],
  settings: SettingsDto
): readonly ScheduledAlarm[] {
  return occurrences.flatMap((occurrence) => {
    const enabled = occurrence.kind === 'todo'
      ? settings.todoAlarmEnabled
      : settings.eventAlarmEnabled
    if (!enabled || occurrence.done || occurrence.excluded) return []
    const target = occurrence.kind === 'todo' ? occurrence.end : occurrence.start
    if (target === null) return []
    const before = occurrence.kind === 'todo'
      ? settings.todoAlarmBeforeMinutes
      : settings.eventAlarmBeforeMinutes
    const alarm = Date.parse(target) - before * 60_000
    return [{
      occurrence,
      alarmAt: new Date(alarm).toISOString()
    }]
  })
}

export function alarmKey(alarm: ScheduledAlarm): string {
  return `${alarm.occurrence.id}:${alarm.alarmAt}`
}

export function isAlarmDue(
  alarm: ScheduledAlarm,
  previous: string,
  current: string
): boolean {
  const alarmTime = Date.parse(alarm.alarmAt)
  return alarmTime > Date.parse(previous) && alarmTime <= Date.parse(current)
}
```

Remove the polling-window calculation from this file; window ownership moves to the coordinator.

- [ ] **Step 4: Run scheduler tests and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Write failing notification presentation tests**

Create `tests/unit/application/alarm-notification.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { notificationForAlarm } from '../../../src/application/alarm-notification'
import type { ScheduleOccurrenceDto } from '../../../src/contracts/occurrence.contract'

const event: ScheduleOccurrenceDto = {
  id: '10000000-0000-4000-8000-000000000001',
  scheduleId: '20000000-0000-4000-8000-000000000001',
  kind: 'event',
  title: '评审',
  excluded: false,
  start: '2026-07-23T01:00:00Z',
  end: '2026-07-23T02:00:00Z',
  startMark: '11',
  endMark: '11',
  comment: '',
  done: false
}

const todo: ScheduleOccurrenceDto = {
  ...event,
  id: '10000000-0000-4000-8000-000000000002',
  kind: 'todo',
  title: '待办',
  start: null
}

it('formats a same-day Event in the selected time zone', () => {
  expect(notificationForAlarm({
    occurrence: {
      ...event,
      title: '评审',
      comment: '带材料',
      start: '2026-07-23T01:00:00Z',
      end: '2026-07-23T02:00:00Z'
    },
    alarmAt: '2026-07-23T00:55:00Z'
  }, 'Asia/Shanghai')).toEqual({
    title: 'Event: 评审',
    body: '带材料\n2026-07-23 09:00–10:00'
  })
})

it('shows both dates for a cross-day Event and preserves unknown marks', () => {
  expect(notificationForAlarm({
    occurrence: {
      ...event,
      start: '2026-07-23T15:30:00Z',
      end: '2026-07-23T17:00:00Z',
      startMark: '10',
      endMark: '01',
      comment: ''
    },
    alarmAt: '2026-07-23T15:25:00Z'
  }, 'Asia/Shanghai').body).toBe(
    '2026-07-23 23:?–2026-07-24 ?:00'
  )
})

it.each([
  ['11', '09:30'],
  ['10', '09:?'],
  ['01', '?:30'],
  ['00', '?:?']
] as const)('preserves Todo mark %s as %s', (endMark, expected) => {
  expect(notificationForAlarm({
    occurrence: {
      ...todo,
      end: '2026-07-23T01:30:00Z',
      endMark
    },
    alarmAt: '2026-07-23T01:25:00Z'
  }, 'Asia/Shanghai')).toEqual({
    title: 'Todo: 待办',
    body: `2026-07-23 ${expected}`
  })
})
```

- [ ] **Step 6: Run notification tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/alarm-notification.test.ts
```

Expected: FAIL because `alarm-notification.ts` does not exist.

- [ ] **Step 7: Implement deterministic notification formatting**

Create `src/application/alarm-notification.ts` using `Temporal.Instant.from(...).toZonedDateTimeISO(timeZone)`. Use these helpers and exact output rules:

```ts
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function localDate(instant: string, timeZone: string): string {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  return `${value.year}-${pad(value.month)}-${pad(value.day)}`
}

function localMarkedTime(
  instant: string,
  mark: KnownTimeMark,
  timeZone: string
): string {
  const value = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone)
  const hour = mark[0] === '1' ? pad(value.hour) : '?'
  const minute = mark[1] === '1' ? pad(value.minute) : '?'
  return `${hour}:${minute}`
}
```

For Event, omit the repeated end date only when start and end local dates match. For Todo, use `end` and `endMark`. Prefix a trimmed non-empty occurrence comment plus `\n`. Return only `NotificationInput`; do not import Electron.

- [ ] **Step 8: Run both pure test files**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/alarm-scheduler.test.ts tests/unit/application/alarm-notification.test.ts
```

Expected: PASS with no locale-dependent assertions.

- [ ] **Step 9: Commit pure alarm behavior**

```powershell
git add src/application/alarm-scheduler.ts src/application/alarm-notification.ts tests/unit/application/alarm-scheduler.test.ts tests/unit/application/alarm-notification.test.ts
git commit -m "feat(alarm): 明确提醒边界与通知时间展示"
```

---

### Task 3: 实现统一 AlarmCoordinator

**Files:**
- Create: `src/application/alarm-coordinator.ts`
- Create: `tests/unit/application/alarm-coordinator.test.ts`

**Interfaces:**
- Consumes: `Clock`, settings getter, alarm-candidate getter, and async notification function.
- Produces: `AlarmRecalculationReason = 'initialize' | 'poll' | 'resume' | 'mutation'`.
- Produces: `AlarmCoordinator.recalculate(reason): Promise<AppResult<void>>`.
- `poll` and `resume` use `(lastCheckedAt, checkedAt]`; `mutation` additionally delivers newly introduced already-due alarms.

- [ ] **Step 1: Write a failing coordinator test for startup, boundaries, and delayed polling**

Create a deterministic harness in `tests/unit/application/alarm-coordinator.test.ts` with a mutable `Clock`, in-memory candidate list, and fake notifier:

```ts
const FIRST_ID = '10000000-0000-4000-8000-000000000001'
const SECOND_ID = '10000000-0000-4000-8000-000000000002'
const THIRD_ID = '10000000-0000-4000-8000-000000000003'

class MutableClock implements Clock {
  private value = Temporal.Instant.from('2026-07-23T02:00:00Z')
  set(value: string) {
    this.value = Temporal.Instant.from(value)
  }
  now(): Temporal.Instant {
    return this.value
  }
}

function todoAt(end: string, id = FIRST_ID): ScheduleOccurrenceDto {
  return {
    id,
    scheduleId: id,
    kind: 'todo',
    title: `Todo ${id}`,
    excluded: false,
    start: null,
    end,
    startMark: '11',
    endMark: '11',
    comment: '',
    done: false
  }
}

function eventFromTo(start: string, end: string): ScheduleOccurrenceDto {
  return {
    ...todoAt(end),
    kind: 'event',
    title: 'Event',
    start
  }
}

let clock: MutableClock
let candidates: { value: readonly ScheduleOccurrenceDto[] }
let candidateResult: AppResult<readonly ScheduleOccurrenceDto[]>
let settings: { value: SettingsDto }
let notify: ReturnType<typeof vi.fn>
let coordinator: AlarmCoordinator

beforeEach(() => {
  clock = new MutableClock()
  candidates = { value: [] }
  candidateResult = { ok: true, value: [] }
  settings = {
    value: {
      ...defaultSettings,
      todoAlarmBeforeMinutes: 0,
      eventAlarmBeforeMinutes: 0
    }
  }
  notify = vi.fn(async () => undefined)
  coordinator = new AlarmCoordinator({
    clock,
    getSettings: async () => ({ ok: true, value: settings.value }),
    listCandidates: async () => candidateResult.ok
      ? { ok: true, value: candidates.value }
      : candidateResult,
    notify
  })
})

async function initializeAt(value: string): Promise<void> {
  clock.set(value)
  await coordinator.recalculate('initialize')
}
```

Add the startup test:

```ts
it('baselines startup without backfilling and covers every later instant once', async () => {
  clock.set('2026-07-23T02:00:00Z')
  candidates.value = [todoAt('2026-07-23T01:55:00Z')]
  await coordinator.recalculate('initialize')
  expect(notify).not.toHaveBeenCalled()

  candidates.value = [
    todoAt('2026-07-23T01:55:00Z'),
    todoAt('2026-07-23T02:00:30Z', SECOND_ID),
    todoAt('2026-07-23T02:01:20Z', THIRD_ID)
  ]
  clock.set('2026-07-23T02:01:20Z')
  await coordinator.recalculate('poll')
  await coordinator.recalculate('poll')

  expect(notify).toHaveBeenCalledTimes(2)
})
```

The fixture alarm-before value is zero so target and alarm time are identical.

- [ ] **Step 2: Add failing tests for resume and Event end semantics**

```ts
it('backfills every missed Todo after resume', async () => {
  await initializeAt('2026-07-23T02:00:00Z')
  candidates.value = [
    todoAt('2026-07-23T02:01:00Z'),
    todoAt('2026-07-23T08:00:00Z', SECOND_ID)
  ]
  clock.set('2026-07-23T09:00:00Z')

  await coordinator.recalculate('resume')

  expect(notify).toHaveBeenCalledTimes(2)
})

it.each([
  ['2026-07-23T03:59:59Z', 1],
  ['2026-07-23T04:00:00Z', 0],
  ['2026-07-23T04:00:01Z', 0]
])('delivers a missed Event only before its end at %s', async (checkedAt, count) => {
  await initializeAt('2026-07-23T02:00:00Z')
  candidates.value = [eventFromTo(
    '2026-07-23T03:00:00Z',
    '2026-07-23T04:00:00Z'
  )]
  clock.set(checkedAt)

  await coordinator.recalculate('resume')

  expect(notify).toHaveBeenCalledTimes(count)
})
```

- [ ] **Step 3: Add failing tests for mutation recalculation, disabled alarms, and failures**

```ts
it('immediately delivers a newly introduced already-due alarm after a mutation', async () => {
  await initializeAt('2026-07-23T02:00:00Z')
  candidates.value = [todoAt('2026-07-23T01:00:00Z')]

  await coordinator.recalculate('mutation')
  await coordinator.recalculate('mutation')

  expect(notify).toHaveBeenCalledOnce()
})

it('does not deliver disabled, completed, or excluded candidates', async () => {
  settings.value = { ...defaultSettings, todoAlarmEnabled: false }
  candidates.value = [
    todoAt('2026-07-23T02:01:00Z'),
    { ...todoAt('2026-07-23T02:01:00Z', SECOND_ID), done: true },
    { ...todoAt('2026-07-23T02:01:00Z', THIRD_ID), excluded: true }
  ]
  await initializeAt('2026-07-23T02:00:00Z')
  clock.set('2026-07-23T02:02:00Z')

  await coordinator.recalculate('poll')

  expect(notify).not.toHaveBeenCalled()
})

it('retries only failed notifications without advancing the successful boundary', async () => {
  await initializeAt('2026-07-23T02:00:00Z')
  candidates.value = [
    { ...todoAt('2026-07-23T02:01:00Z'), title: 'stable' },
    { ...todoAt('2026-07-23T02:01:00Z', SECOND_ID), title: 'retry' }
  ]
  let retryAttempts = 0
  notify.mockImplementation(async (input: NotificationInput) => {
    if (input.title !== 'Todo: retry') return
    retryAttempts += 1
    if (retryAttempts === 1) throw new Error('notification unavailable')
  })
  clock.set('2026-07-23T02:02:00Z')

  const firstResult = await coordinator.recalculate('poll')
  clock.set('2026-07-23T02:03:00Z')
  const secondResult = await coordinator.recalculate('poll')

  expect(firstResult.ok).toBe(false)
  expect(secondResult.ok).toBe(true)
  expect(notify.mock.calls.filter(([input]) =>
    (input as NotificationInput).title === 'Todo: stable')).toHaveLength(1)
  expect(notify.mock.calls.filter(([input]) =>
    (input as NotificationInput).title === 'Todo: retry')).toHaveLength(2)
})

it('does not advance the check boundary when candidate loading fails', async () => {
  await initializeAt('2026-07-23T02:00:00Z')
  candidates.value = [todoAt('2026-07-23T02:00:30Z')]
  candidateResult = {
    ok: false,
    error: { code: 'PERSISTENCE_FAILED', message: 'candidate read failed' }
  }
  clock.set('2026-07-23T02:01:00Z')
  expect((await coordinator.recalculate('poll')).ok).toBe(false)

  candidateResult = { ok: true, value: candidates.value }
  clock.set('2026-07-23T02:02:00Z')
  expect((await coordinator.recalculate('poll')).ok).toBe(true)
  expect(notify).toHaveBeenCalledOnce()
})
```

- [ ] **Step 4: Run coordinator tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/alarm-coordinator.test.ts
```

Expected: FAIL because `AlarmCoordinator` does not exist.

- [ ] **Step 5: Implement the coordinator with one recalculation entry**

Create `src/application/alarm-coordinator.ts` with:

```ts
import type { AlarmCandidateQuery, ScheduleOccurrenceDto } from '../contracts/occurrence.contract'
import type { NotificationInput } from '../contracts/notification.contract'
import type { AppResult } from '../contracts/result'
import type { SettingsDto } from '../contracts/settings.contract'
import type { Clock } from '../domain/shared/clock'
import { Temporal } from '../domain/shared/temporal'
import { notificationForAlarm } from './alarm-notification'
import { alarmKey, isAlarmDue, scheduledAlarms } from './alarm-scheduler'

export type AlarmRecalculationReason =
  | 'initialize'
  | 'poll'
  | 'resume'
  | 'mutation'

export interface AlarmCoordinatorDependencies {
  readonly clock: Clock
  readonly getSettings: () => Promise<AppResult<SettingsDto>>
  readonly listCandidates: (
    query: AlarmCandidateQuery
  ) => Promise<AppResult<readonly ScheduleOccurrenceDto[]>>
  readonly notify: (input: NotificationInput) => Promise<void>
}

const notificationFailure = {
  code: 'PLATFORM_UNAVAILABLE' as const,
  message: '系统通知发送失败'
}

export class AlarmCoordinator {
  private lastCheckedAt: string | undefined
  private knownKeys = new Set<string>()
  private readonly notifiedKeys = new Set<string>()

  constructor(private readonly dependencies: AlarmCoordinatorDependencies) {}

  async recalculate(reason: AlarmRecalculationReason): Promise<AppResult<void>> {
    const checkedAt = this.dependencies.clock.now().toString()
    if (this.lastCheckedAt === undefined) this.lastCheckedAt = checkedAt
    const baseline = this.lastCheckedAt

    const settingsResult = await this.dependencies.getSettings()
    if (!settingsResult.ok) return settingsResult
    const settings = settingsResult.value
    const maximumBeforeMinutes = Math.max(
      settings.todoAlarmBeforeMinutes,
      settings.eventAlarmBeforeMinutes
    )
    const query: AlarmCandidateQuery = {
      checkedAt,
      through: Temporal.Instant.from(checkedAt)
        .add({ minutes: maximumBeforeMinutes, seconds: 30 })
        .toString()
    }
    const candidateResult = await this.dependencies.listCandidates(query)
    if (!candidateResult.ok) return candidateResult

    const alarms = scheduledAlarms(candidateResult.value, settings)
    const currentKeys = new Set(alarms.map(alarmKey))
    let failed = false

    for (const alarm of alarms) {
      const key = alarmKey(alarm)
      const inWindow = isAlarmDue(alarm, baseline, checkedAt)
      const newlyDue = reason === 'mutation' &&
        !this.knownKeys.has(key) &&
        Date.parse(alarm.alarmAt) <= Date.parse(checkedAt)
      const eventStillActive = alarm.occurrence.kind === 'todo' ||
        Date.parse(checkedAt) < Date.parse(alarm.occurrence.end)
      const shouldDeliver = (inWindow || newlyDue) &&
        eventStillActive &&
        !this.notifiedKeys.has(key)
      if (!shouldDeliver) continue

      try {
        await this.dependencies.notify(
          notificationForAlarm(alarm, settings.timeZone)
        )
        this.notifiedKeys.add(key)
      } catch {
        failed = true
      }
    }

    if (failed) return { ok: false, error: notificationFailure }
    this.knownKeys = currentKeys
    this.lastCheckedAt = checkedAt
    return { ok: true, value: undefined }
  }
}
```

The extra 30 seconds in `through` snapshots the next polling window while the coordinator still delivers only alarms due at `checkedAt`. The first captured baseline is retained if initialization reads fail, so a later successful call still covers time elapsed since process startup. Do not add any second public scheduling path.

- [ ] **Step 6: Run coordinator tests and verify GREEN**

Run the command from Step 4.

Expected: PASS, including exact Event end equality and notification retry counts.

- [ ] **Step 7: Run all alarm unit tests**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application/alarm-scheduler.test.ts tests/unit/application/alarm-notification.test.ts tests/unit/application/alarm-coordinator.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the coordinator**

```powershell
git add src/application/alarm-coordinator.ts tests/unit/application/alarm-coordinator.test.ts
git commit -m "feat(alarm): 统一提醒重算与补发"
```

---

### Task 4: 接入 Electron 轮询、系统恢复与变更入口

**Files:**
- Create: `src-electron/main/alarm-runtime.ts`
- Create: `tests/integration/electron/alarm-runtime.test.ts`
- Modify: `src-electron/main/ipc/register-handlers.ts`
- Modify: `tests/integration/ipc/schedule-ipc.test.ts`
- Modify: `src-electron/adapters/electron-notifier.ts`
- Modify: `src-electron/main/index.ts`

**Interfaces:**
- Produces: `AlarmRuntime.start(): Promise<void>`, `request(reason): Promise<void>`, and `dispose(): void`.
- Consumes: a PowerMonitor-like `on('resume')`/`off('resume')` port and an `AlarmCoordinator`.
- Extends: `registerScheduleIpcHandlers(..., { onAlarmInputsChanged?(): void })`.

- [ ] **Step 1: Write a failing AlarmRuntime integration test**

Create `tests/integration/electron/alarm-runtime.test.ts` with fake timers and this fake resume monitor:

```ts
class FakePowerMonitor implements PowerMonitorPort {
  private handler: (() => void) | undefined
  on(_event: 'resume', handler: () => void): void {
    this.handler = handler
  }
  off(_event: 'resume', handler: () => void): void {
    if (this.handler === handler) this.handler = undefined
  }
  emitResume(): void {
    this.handler?.()
  }
}

let powerMonitor: FakePowerMonitor
let coordinator: { recalculate: ReturnType<typeof vi.fn> }
let reportError: ReturnType<typeof vi.fn>
let runtime: AlarmRuntime

beforeEach(() => {
  vi.useFakeTimers()
  powerMonitor = new FakePowerMonitor()
  coordinator = {
    recalculate: vi.fn(async () => ({ ok: true as const, value: undefined }))
  }
  reportError = vi.fn()
  runtime = new AlarmRuntime({ coordinator, powerMonitor, reportError })
})

afterEach(() => {
  runtime.dispose()
  vi.useRealTimers()
})

it('serializes initialization, polling, resume, and mutation recalculation', async () => {
  const calls: AlarmRecalculationReason[] = []
  coordinator.recalculate.mockImplementation(async (reason: AlarmRecalculationReason) => {
    calls.push(reason)
    return { ok: true as const, value: undefined }
  })

  await runtime.start()
  await vi.advanceTimersByTimeAsync(30_000)
  powerMonitor.emitResume()
  await runtime.request('mutation')

  expect(calls).toEqual(['initialize', 'poll', 'resume', 'mutation'])
})

it('unsubscribes resume and clears polling on dispose', async () => {
  await runtime.start()
  runtime.dispose()
  await vi.advanceTimersByTimeAsync(60_000)
  powerMonitor.emitResume()
  expect(coordinator.recalculate).toHaveBeenCalledTimes(1)
})

it('reports coordinator failures and keeps the queue usable', async () => {
  const failure = { code: 'PERSISTENCE_FAILED' as const, message: 'read failed' }
  coordinator.recalculate
    .mockResolvedValueOnce({ ok: false, error: failure })
    .mockResolvedValueOnce({ ok: true, value: undefined })
  await runtime.start()
  await runtime.request('mutation')
  expect(reportError).toHaveBeenCalledWith(failure)
  expect(coordinator.recalculate).toHaveBeenCalledTimes(2)
})
```

Restore real timers in `afterEach`.

- [ ] **Step 2: Run runtime tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/electron/alarm-runtime.test.ts
```

Expected: FAIL because `AlarmRuntime` does not exist.

- [ ] **Step 3: Implement the serialized runtime**

Create `src-electron/main/alarm-runtime.ts`:

```ts
import type {
  AlarmRecalculationReason
} from '../../src/application/alarm-coordinator'
import type { AppResult } from '../../src/contracts/result'

export interface PowerMonitorPort {
  on(event: 'resume', handler: () => void): void
  off(event: 'resume', handler: () => void): void
}

export interface AlarmCoordinatorPort {
  recalculate(reason: AlarmRecalculationReason): Promise<AppResult<void>>
}

export interface AlarmRuntimeDependencies {
  readonly coordinator: AlarmCoordinatorPort
  readonly powerMonitor: PowerMonitorPort
  readonly reportError: (error: unknown) => void
}

export class AlarmRuntime {
  private pending: Promise<void> = Promise.resolve()
  private timer: ReturnType<typeof setInterval> | undefined
  private started = false
  private disposed = false
  private readonly resumeHandler = () => {
    void this.request('resume')
  }

  constructor(private readonly dependencies: AlarmRuntimeDependencies) {}

  start(): Promise<void> {
    if (this.started || this.disposed) return this.pending
    this.started = true
    this.dependencies.powerMonitor.on('resume', this.resumeHandler)
    this.timer = setInterval(() => {
      void this.request('poll')
    }, 30_000)
    return this.request('initialize')
  }

  request(reason: AlarmRecalculationReason): Promise<void> {
    if (this.disposed) return this.pending
    this.pending = this.pending
      .then(async () => {
        const result = await this.dependencies.coordinator.recalculate(reason)
        if (!result.ok) this.dependencies.reportError(result.error)
      })
      .catch((error: unknown) => {
        this.dependencies.reportError(error)
      })
    return this.pending
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.timer !== undefined) clearInterval(this.timer)
    this.dependencies.powerMonitor.off('resume', this.resumeHandler)
  }
}
```

- [ ] **Step 4: Run runtime tests and verify GREEN**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Write failing IPC tests for exactly the alarm-affecting mutations**

Extend the test harness in `tests/integration/ipc/schedule-ipc.test.ts` to pass:

```ts
const onAlarmInputsChanged = vi.fn()
registerScheduleIpcHandlers(registrar, gateway, { onAlarmInputsChanged })
```

Add one table-driven test that invokes successful handlers for:

```ts
it('recalculates only after successful alarm-affecting mutations', async () => {
  const onAlarmInputsChanged = vi.fn()
  const { scheduleComment: _scheduleComment, ...occurrenceResult } = occurrence
  const { handlers } = createHarness({
    schedules: {
      create: vi.fn(async () => ({ ok: true as const, value: schedule })),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(async () => ({ ok: true as const, value: schedule })),
      setDeleted: vi.fn(async () => ({ ok: true as const, value: undefined })),
      setStarred: vi.fn(async () => ({ ok: true as const, value: schedule }))
    },
    occurrences: {
      excludeMany: vi.fn(async () => ({ ok: true as const, value: undefined })),
      setDone: vi.fn(async () => ({ ok: true as const, value: occurrenceResult })),
      updateComment: vi.fn(async () => ({ ok: true as const, value: occurrenceResult }))
    },
    settings: {
      update: vi.fn(async () => ({ ok: true as const, value: defaultSettings }))
    }
  }, { onAlarmInputsChanged })

  const successfulInputs = [
    [scheduleIpcChannels.create, {
      title: '评审',
      recurrenceCode: '2026-07-12 10:00'
    }],
    [scheduleIpcChannels.update, {
      id: schedule.id,
      title: '评审',
      recurrenceCode: '2026-07-12 10:00'
    }],
    [scheduleIpcChannels.setDeleted, { id: schedule.id, deleted: true }],
    [scheduleIpcChannels.excludeOccurrences, { ids: [occurrence.id] }],
    [scheduleIpcChannels.setOccurrenceDone, { id: occurrence.id, done: true }],
    [scheduleIpcChannels.updateSettings, { eventAlarmBeforeMinutes: 30 }]
  ] as const
  for (const [channel, input] of successfulInputs) {
    await handlers.get(channel)?.({}, input)
  }
  expect(onAlarmInputsChanged).toHaveBeenCalledTimes(6)

  await handlers.get(scheduleIpcChannels.setStarred)?.(
    {},
    { id: schedule.id, starred: true }
  )
  await handlers.get(scheduleIpcChannels.updateOccurrenceComment)?.(
    {},
    { id: occurrence.id, comment: 'note' }
  )
  expect(onAlarmInputsChanged).toHaveBeenCalledTimes(6)
})

it('does not recalculate after a failed alarm-affecting mutation', async () => {
  const onAlarmInputsChanged = vi.fn()
  const { handlers } = createHarness({
    schedules: {
      create: vi.fn(async () => ({
        ok: false as const,
        error: { code: 'PERSISTENCE_FAILED' as const, message: 'save failed' }
      })),
      findById: vi.fn(),
      list: vi.fn()
    }
  }, { onAlarmInputsChanged })

  await handlers.get(scheduleIpcChannels.create)?.({}, {
    title: '评审',
    recurrenceCode: '2026-07-12 10:00'
  })
  expect(onAlarmInputsChanged).not.toHaveBeenCalled()
})
```

Extend `createHarness` to accept partial `settings` overrides and the `ScheduleIpcHandlerOptions` argument, and return the same handler map. Import `defaultSettings` and `scheduleIpcChannels` explicitly.

- [ ] **Step 6: Run IPC tests and verify RED**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/ipc/schedule-ipc.test.ts
```

Expected: FAIL because `registerScheduleIpcHandlers` has no alarm callback and does not invoke it.

- [ ] **Step 7: Add the minimal success hook to IPC registration**

Extend the function signature:

```ts
export interface ScheduleIpcHandlerOptions {
  readonly onAlarmInputsChanged?: () => void
}

export function registerScheduleIpcHandlers(
  ipcMain: IpcMainRegistrar,
  gateway: PlatformGateway,
  options: ScheduleIpcHandlerOptions = {}
): void
```

Add:

```ts
function recalculateAfterSuccess<T>(
  result: AppResult<T>,
  callback: (() => void) | undefined
): AppResult<T> {
  if (result.ok) callback?.()
  return result
}
```

Wrap only create, update, setDeleted, excludeMany, setDone, and settings.update operation results. Do not await the callback inside IPC; `AlarmRuntime` owns serialization and error reporting, so a notification failure cannot turn a committed mutation into a false IPC failure.

- [ ] **Step 8: Run IPC tests and verify GREEN**

Run the command from Step 6.

Expected: PASS.

- [ ] **Step 9: Replace the inline Electron alarm loop with composed services**

In `src-electron/adapters/electron-notifier.ts`, retain only:

```ts
export class ElectronNotifier {
  notifyMessage(input: NotificationInput): void {
    new Notification(input).show()
  }
}
```

In `src-electron/main/index.ts`:

1. Import `powerMonitor`, `AlarmCoordinator`, and `AlarmRuntime`.
2. Remove the `dueAlarms` import, `notified` set, and inline `setInterval`.
3. Instantiate `AlarmCoordinator` with the existing `SystemClock`, settings repository, `occurrenceRepository.listAlarmCandidates`, and an async wrapper around `notifier.notifyMessage`.
4. Instantiate `AlarmRuntime` with Electron `powerMonitor` and the existing error reporter.
5. Pass `{ onAlarmInputsChanged: () => { void alarmRuntime.request('mutation') } }` to `registerScheduleIpcHandlers`.
6. Call `void alarmRuntime.start()`.
7. Return `alarmRuntime` as a disposable before the database connection so it stops querying before SQLite closes.

Keep `app.setLoginItemSettings` behavior inside the settings gateway unchanged.

- [ ] **Step 10: Run focused Electron, IPC, type, and database verification**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/unit/application tests/integration/database/occurrence-repository.test.ts tests/integration/ipc/schedule-ipc.test.ts tests/integration/electron/alarm-runtime.test.ts
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
```

Expected: all commands exit 0.

- [ ] **Step 11: Commit Electron integration**

```powershell
git add src-electron/main/alarm-runtime.ts src-electron/main/ipc/register-handlers.ts src-electron/main/index.ts src-electron/adapters/electron-notifier.ts tests/integration/electron/alarm-runtime.test.ts tests/integration/ipc/schedule-ipc.test.ts
git commit -m "feat(electron): 接入提醒重算与休眠恢复"
```

---

### Task 5: 关闭 GAP-03 并执行完整验证

**Files:**
- Modify: `docs/development/v2-feature-gaps.md`

**Interfaces:**
- Produces: verified `GAP-03` completion record.

- [ ] **Step 1: Run diff and requirement review before changing status**

Run:

```powershell
git diff --check
git status --short
```

Re-read `docs/superpowers/specs/2026-07-23-alarm-notification-alignment-design.md` and map every acceptance criterion to a passing test:

- `(lastCheckedAt, checkedAt]` and delayed polling;
- Todo resume backfill and Event strict end boundary;
- settings/schedule/exclusion/Todo completion recalculation;
- type plus schedule title;
- configured timezone plus `11`/`10`/`01`/`00`;
- completed/excluded/occurrence-deleted/schedule-deleted/disabled filtering.

Expected: no unexplained changed files and no uncovered requirement.

- [ ] **Step 2: Run the project-required Web checks**

Run:

```powershell
.\node_modules\.bin\eslint.cmd .
.\node_modules\.bin\vue-tsc.cmd --noEmit -p tsconfig.app.json
.\node_modules\.bin\vitest.cmd run tests/unit tests/contracts tests/parser
.\node_modules\.bin\vite.cmd build
```

Expected: every command exits 0.

- [ ] **Step 3: Run focused persistence, IPC, Electron, and Electron-build checks**

Run:

```powershell
.\node_modules\.bin\vitest.cmd run tests/integration/database/occurrence-repository.test.ts tests/integration/ipc/schedule-ipc.test.ts tests/integration/electron/alarm-runtime.test.ts
.\node_modules\.bin\tsc.cmd --noEmit -p tsconfig.electron.json
.\node_modules\.bin\vite.cmd build --config vite.electron-main.config.ts
.\node_modules\.bin\vite.cmd build --config vite.electron-preload.config.ts
```

Expected: every command exits 0. These tests use fakes and do not launch GUI processes.

- [ ] **Step 4: Mark the gap completed only after fresh evidence**

Update `docs/development/v2-feature-gaps.md`:

```md
### GAP-03：对齐提醒时间与通知展示

状态：`已完成`（2026-07-23）

优先级：`P1`

完成说明：提醒统一使用 `(lastCheckedAt, checkedAt]` 检查窗口；轮询、休眠恢复和提醒相关变更通过同一协调器重算。Todo 补发休眠期间所有仍有效的提醒，Event 仅在尚未结束时补发；通知按用户时区展示并保留未知小时、未知分钟语义。
```

Keep the acceptance checklist below it unchanged as the permanent closure record.

- [ ] **Step 5: Run final status verification**

Run:

```powershell
git diff --check
git status --short
```

Expected: only the intended GAP-03 implementation, tests, plan, and feature-gap status are changed.

- [ ] **Step 6: Commit the closure record**

```powershell
git add docs/development/v2-feature-gaps.md
git commit -m "docs: 记录提醒与通知差异关闭"
```

## Plan Self-Review

- Spec coverage: every GAP-03 acceptance criterion is owned by Tasks 1–4 and rechecked before closure in Task 5.
- Boundary consistency: all examples use `(previous, current]`; Event recovery uses the strict predicate `checkedAt < end`.
- Type consistency: `AlarmCandidateQuery` flows from contract to `OccurrenceRepository`; `ScheduledAlarm` flows from scheduler to presentation and coordinator; Electron receives only `NotificationInput`.
- Failure consistency: reads and notifications return a failed `AppResult`; the coordinator does not advance its boundary or candidate snapshot, while successful per-item keys remain deduplicated.
- Scope: no persistent delivery queue, cross-restart catch-up, Vue API expansion, TanStack Query, or unrelated desktop refactor is included.
- Placeholder scan: no implementation step relies on `TBD`, unspecified error handling, or a later design choice.
