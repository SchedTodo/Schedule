<script setup lang="ts">
import { ReloadOutline, Star } from '@vicons/ionicons5'
import { computed, h, inject, reactive, ref, watch } from 'vue'
import { NButton, NCard, NDataTable, NDatePicker, NIcon, NInput, NSelect, NTag } from 'naive-ui'
import type { DataTableColumns, PaginationProps } from 'naive-ui'
import { useRouter } from 'vue-router'
import { useOperationFeedback } from '../app/app-feedback'
import { platformGatewayKey } from '../app/injection-keys'
import type { ScheduleKind, SchedulePageItemDto } from '../contracts/schedule.contract'
import { useI18n } from 'vue-i18n'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const { showResult } = useOperationFeedback()
const router = useRouter()
const { t, locale } = useI18n()
const search = ref('')
const kind = ref<ScheduleKind | null>(null)
const dates = ref<[number, number] | null>(null)
const starredOnly = ref(false)
const items = ref<SchedulePageItemDto[]>([])

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [5, 10, 15, 20],
  prefix: ({ itemCount }) => t('database.total', { count: itemCount ?? 0 }),
  onChange(nextPage) {
    pagination.page = nextPage
    void refresh()
  },
  onUpdatePageSize(nextPageSize) {
    pagination.pageSize = nextPageSize
    pagination.page = 1
    void refresh()
  }
})

/** 按当前筛选和远程分页状态刷新数据库日程列表。 */
async function refresh() {
  const result = await platform.schedules.searchPage({
    search: search.value,
    ...(dates.value === null
      ? {}
      : {
          start: new Date(dates.value[0]).toISOString(),
          end: new Date(dates.value[1]).toISOString()
    }),
    ...(kind.value === null ? {} : { kind: kind.value }),
    ...(starredOnly.value ? { starred: true } : {}),
    page: pagination.page ?? 1,
    pageSize: pagination.pageSize ?? 10
  })
  if (showResult(result)) {
    items.value = [...result.value.items]
    pagination.itemCount = result.value.total
  }
}

/** 恢复软删除日程并刷新当前页，避免触发表格行导航。 */
async function restore(id: string) {
  const result = await platform.schedules.setDeleted({ id, deleted: false })
  if (showResult(result, { success: true })) await refresh()
}

function toggleStarFilter() {
  starredOnly.value = !starredOnly.value
}

/** 渲染删除状态，并为已删除行提供内联恢复操作。 */
function renderDeleted(item: SchedulePageItemDto) {
  return h('div', { class: 'database-deleted-content' }, [
    h(NTag, { type: 'error' }, { default: () => String(item.deleted) }),
    item.deleted
      ? h(
          NButton,
          {
            size: 'tiny',
            class: 'database-restore',
            'aria-label': t('schedule.restore'),
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              void restore(item.id)
            }
          },
          { default: () => h(NIcon, null, { default: () => h(ReloadOutline) }) }
        )
      : null
  ])
}

function renderKind(item: SchedulePageItemDto) {
  return h(NTag, { type: 'success' }, {
    default: () => t(item.kind === 'event' ? 'common.event' : 'common.todo')
  })
}

function renderStar(item: SchedulePageItemDto) {
  return h(
    NIcon,
    { color: item.starred ? '#ffe742' : '#c2c2c2' },
    { default: () => h(Star) }
  )
}

const columns = computed<DataTableColumns<SchedulePageItemDto>>(() => [
  {
    title: 'ID',
    key: 'id',
    width: '8rem',
    ellipsis: { tooltip: true },
    className: 'database-id-cell'
  },
  { title: t('common.name'), key: 'title' },
  {
    title: t('common.deleted'),
    key: 'deleted',
    className: 'database-deleted-cell',
    render: renderDeleted
  },
  {
    title: t('common.created'),
    key: 'createdAt',
    render: (item) => new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(item.createdAt))
  },
  {
    title: t('common.updated'),
    key: 'updatedAt',
    render: (item) => new Intl.DateTimeFormat(locale.value, {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(item.updatedAt))
  },
  { title: t('common.type'), key: 'kind', render: renderKind },
  { title: t('common.star'), key: 'starred', render: renderStar }
])

/** 为数据行绑定详情页导航属性。 */
function rowProps(item: SchedulePageItemDto) {
  return {
    onClick: () => void router.push({ name: 'schedule-detail', params: { id: item.id } })
  }
}

watch(
  [search, kind, dates, starredOnly],
  () => {
    pagination.page = 1
    void refresh()
  },
  { immediate: true }
)
</script>

<template>
  <div class="database-page">
    <NCard segmented>
      <template #header>
        <b>{{ t('database.database') }}</b>
      </template>
      <div class="database-wrapper">
        <div class="database-filter">
          <label
            class="sr-only"
            for="database-search"
          >{{ t('database.search') }}</label>
          <NInput
            v-model:value="search"
            class="database-search"
            :placeholder="t('database.searchPlaceholder')"
            :input-props="{ id: 'database-search' }"
            clearable
          />
          <span class="sr-only">{{ t('database.startDate') }}</span>
          <NDatePicker
            v-model:value="dates"
            type="daterange"
            :start-placeholder="t('database.startDate')"
            :end-placeholder="t('database.endDate')"
          />
          <NSelect
            :value="kind"
            :placeholder="t('database.type')"
            clearable
            :options="[
              { label: t('common.todo'), value: 'todo' },
              { label: t('common.event'), value: 'event' }
            ]"
            style="width: 12rem"
            @update:value="kind = $event"
          />
          <NButton
            text
            class="database-star-filter"
            :aria-label="starredOnly ? t('database.allSchedules') : t('database.starredSchedules')"
            :color="starredOnly ? '#ffe742' : '#c2c2c2'"
            @click="toggleStarFilter"
          >
            <NIcon><Star /></NIcon>
          </NButton>
        </div>
        <NDataTable
          remote
          :columns="columns"
          :data="items"
          :pagination="pagination"
          :row-props="rowProps"
        />
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.database-page {
  padding: 6vh 8vw 4vh;
}
.database-wrapper {
  display: grid;
  gap: 1rem;
}
.database-filter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
}
.database-search {
  flex: 1 1 auto;
  min-inline-size: 0;
  max-inline-size: none;
}
.database-star-filter {
  flex: 0 0 auto;
  font-size: 1.25rem;
}
:deep(.database-deleted-cell) {
  white-space: nowrap;
}
.database-deleted-content {
  display: flex;
  align-items: center;
}
.database-restore {
  inline-size: 1.75rem;
  min-inline-size: 1.75rem;
  block-size: 1.75rem;
  margin-inline-start: 0.35rem;
  padding: 0;
  color: var(--color-text-muted);
}
:deep(.database-id-cell) {
  inline-size: 8rem;
  max-inline-size: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.n-data-table-tbody .n-data-table-tr) {
  cursor: pointer;
}
.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
