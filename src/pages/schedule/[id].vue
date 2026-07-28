<script setup lang="ts">
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import { computed, h, inject, reactive, ref } from 'vue'
import {
  NAlert,
  NButton,
  NButtonGroup,
  NCard,
  NDataTable,
  NEmpty,
  NIcon,
  NPageHeader,
  NPopconfirm,
  NSpin,
  NTag
} from 'naive-ui'
import { Star } from '@vicons/ionicons5'
import { useRoute, useRouter } from 'vue-router'

import { useOperationFeedback } from '../../app/app-feedback'
import { platformGatewayKey } from '../../app/injection-keys'
import type { ScheduleOccurrenceDto } from '../../contracts/occurrence.contract'
import type { ConcentrationRecordDto } from '../../contracts/record.contract'
import type { CreateScheduleInput } from '../../contracts/schedule.contract'
import { defaultSettings } from '../../contracts/settings.contract'
import EditableOccurrenceComment from '../../features/schedule/components/EditableOccurrenceComment.vue'
import ScheduleModal from '../../features/schedule/components/ScheduleModal.vue'
import { formatInstant } from '../../features/schedule/occurrence-time'
import {
  formatOccurrenceDateTime,
  isPastOccurrence,
  occurrenceWeekday,
  sortDetailOccurrences
} from '../../features/schedule/schedule-detail-presentation'
import { useScheduleDetail } from '../../features/schedule/use-schedule-detail'
import { useI18n } from 'vue-i18n'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const { showResult } = useOperationFeedback()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
if (!id) throw new Error('Schedule id is required')
const scheduleId = id
const detail = useScheduleDetail(platform, scheduleId, showResult)
const timeZone = ref(defaultSettings.timeZone)
const occurrences = ref<ScheduleOccurrenceDto[]>([])
const records = ref<ConcentrationRecordDto[]>([])
const checkedRowKeys = ref<DataTableRowKey[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 5,
  showSizePicker: true,
  pageSizes: [5, 10, 15, 20]
})
const format = (value: string) =>
  formatInstant(value, timeZone.value, locale.value)
const formatTimeCode = (value: string) => value.replace(/;\s*/g, ';\n')
const formatDuration = (start: string, end: string) => {
  const seconds = Math.floor((Date.parse(end) - Date.parse(start)) / 1000)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
const sortedOccurrences = computed(() =>
  sortDetailOccurrences(occurrences.value, timeZone.value)
)
const editValue = computed<CreateScheduleInput>(() => {
  const schedule = detail.schedule.value
  return schedule === null ? {
    title: '', recurrenceCode: '', exclusionCode: '', comment: ''
  } : {
    title: schedule.title,
    recurrenceCode: schedule.recurrenceCode,
    exclusionCode: schedule.exclusionCode,
    comment: schedule.comment
  }
})

/** 加载当前日程所有可见 occurrence，并按详情页规则排序。 */
async function refreshOccurrences() {
  const result = await platform.occurrences.listVisibleBySchedule(scheduleId)
  if (showResult(result)) {
    occurrences.value = [...result.value]
    checkedRowKeys.value = []
  }
}

/** 加载当前日程关联的专注记录。 */
async function refreshRecords() {
  const result = await platform.records.listBySchedule(scheduleId)
  if (showResult(result)) records.value = [...result.value]
}

async function refreshSettings() {
  const result = await platform.settings.get()
  if (showResult(result)) timeZone.value = result.value.timeZone
}

/** 切换当前日程收藏状态，并用宿主返回值更新详情模型。 */
async function toggleStar() {
  const schedule = detail.schedule.value
  if (!schedule || schedule.deleted) return
  const result = await platform.schedules.setStarred({
    id: scheduleId,
    starred: !schedule.starred
  })
  if (showResult(result)) await detail.refresh()
}

/** 保存编辑内容，随后刷新日程详情和 occurrence。 */
async function saveEdit(input: CreateScheduleInput) {
  const result = await platform.schedules.update({ id: scheduleId, ...input })
  if (showResult(result, { success: true })) {
    await Promise.all([detail.refresh(), refreshOccurrences()])
  }
}

/** 软删除当前日程，并返回首页。 */
async function removeSchedule() {
  const result = await platform.schedules.setDeleted({ id: scheduleId, deleted: true })
  if (showResult(result, { success: true })) await router.push({ name: 'database' })
}

/** 批量排除选中的 occurrence，成功后清空选择并刷新详情数据。 */
async function excludeSelected() {
  if (checkedRowKeys.value.length === 0) return
  const result = await platform.occurrences.excludeMany({
    ids: checkedRowKeys.value.map(String)
  })
  if (showResult(result, { success: true })) {
    await Promise.all([detail.refresh(), refreshOccurrences()])
  }
}

/** 更新单个 occurrence 的备注并刷新详情列表。 */
async function updateComment(id: string, comment: string) {
  const result = await platform.occurrences.updateComment(id, comment)
  if (showResult(result, { success: true })) await refreshOccurrences()
}

const columns = computed<DataTableColumns<ScheduleOccurrenceDto>>(() => [
  { type: 'selection' },
  {
    title: t('schedule.start'),
    key: 'start',
    render: (row) => row.start === null
      ? '-'
      : formatOccurrenceDateTime(
          row.start,
          row.startMark,
          timeZone.value,
          locale.value
        )
  },
  {
    title: t('schedule.end'),
    key: 'end',
    render: (row) => formatOccurrenceDateTime(
      row.end,
      row.endMark,
      timeZone.value,
      locale.value
    )
  },
  {
    title: t('schedule.weekday'),
    key: 'weekday',
    render: (row) => occurrenceWeekday(row, timeZone.value, locale.value)
  },
  {
    title: t('common.comment'),
    key: 'comment',
    render: (row) => h(EditableOccurrenceComment, {
      value: row.comment,
      onCommit: (value) => void updateComment(row.id, value)
    })
  }
])

void refreshOccurrences()
void refreshRecords()
void refreshSettings()
</script>

<template>
  <div class="detail-page">
    <NPageHeader
      :title="t('schedule.schedule')"
      :show-breadcrumb="false"
      @back="router.back()"
    />
    <NSpin
      v-if="detail.loading.value"
      :description="t('common.loading')"
    />
    <div v-else-if="detail.error.value" />
    <template v-else-if="detail.schedule.value">
      <NCard segmented>
        <template #header>
          <b>{{ t('schedule.info') }}</b>
        </template>
        <template #header-extra>
          <NButton
            class="star-button"
            text
            :disabled="detail.schedule.value.deleted"
            :color="detail.schedule.value.starred ? '#ffe742' : '#c2c2c2'"
            :aria-label="detail.schedule.value.starred ? t('schedule.unstar') : t('schedule.star')"
            @click="toggleStar"
          >
            <NIcon class="star-icon">
              <Star />
            </NIcon>
          </NButton>
          <NButtonGroup
            v-if="!detail.schedule.value.deleted"
            class="schedule-actions"
          >
            <ScheduleModal
              mode="edit"
              :initial-value="editValue"
              :time-zone="timeZone"
              @submit="saveEdit"
            />
            <NPopconfirm @positive-click="removeSchedule">
              <template #trigger>
                <NButton>{{ t('common.delete') }}</NButton>
              </template>
              {{ t('schedule.deleteSchedule') }}
            </NPopconfirm>
          </NButtonGroup>
        </template>
        <div class="schedule-info">
          <b>{{ t('common.name') }}</b><span>{{ detail.schedule.value.title }}</span>
          <b>{{ t('common.type') }}</b><NTag
            class="schedule-type"
            type="success"
          >
            {{ detail.schedule.value.kind === 'event' ? t('common.event') : t('common.todo') }}
          </NTag>
          <b>{{ t('common.comment') }}</b><span class="pre-line">{{ detail.schedule.value.comment }}</span>
          <b>rTime</b><span class="pre-line recurrence-code">{{ formatTimeCode(detail.schedule.value.recurrenceCode) }}</span>
          <b>exTime</b><span class="pre-line exclusion-code">{{ formatTimeCode(detail.schedule.value.exclusionCode) }}</span>
          <b>{{ t('common.deleted') }}</b><NTag :type="detail.schedule.value.deleted ? 'success' : 'error'">
            {{ detail.schedule.value.deleted }}
          </NTag>
          <b>{{ t('common.created') }}</b><span>{{ format(detail.schedule.value.createdAt) }}</span>
          <b>{{ t('common.updated') }}</b><span>{{ format(detail.schedule.value.updatedAt) }}</span>
        </div>
      </NCard>
      <NCard
        v-if="detail.schedule.value.kind === 'todo'"
        segmented
      >
        <template #header>
          <b>{{ t('schedule.records') }}</b>
        </template>
        <NEmpty
          v-if="records.length === 0"
          :description="t('common.noRecords')"
        />
        <table v-else>
          <thead><tr><th>{{ t('schedule.start') }}</th><th>{{ t('schedule.end') }}</th><th>{{ t('schedule.duration') }}</th></tr></thead>
          <tbody>
            <tr
              v-for="record in records"
              :key="record.id"
            >
              <td>{{ format(record.start) }}</td>
              <td>{{ format(record.end) }}</td>
              <td>{{ formatDuration(record.start, record.end) }}</td>
            </tr>
          </tbody>
        </table>
      </NCard>
      <NCard segmented>
        <template #header>
          <b>{{ t('schedule.times') }}</b>
        </template>
        <template
          v-if="!detail.schedule.value.deleted"
          #header-extra
        >
          <NPopconfirm @positive-click="excludeSelected">
            <template #trigger>
              <NButton>{{ t('common.delete') }}</NButton>
            </template>
            {{ t('schedule.deleteTimes') }}
          </NPopconfirm>
        </template>
        <NDataTable
          v-model:checked-row-keys="checkedRowKeys"
          :columns="columns"
          :data="sortedOccurrences"
          :row-key="(row: ScheduleOccurrenceDto) => row.id"
          :row-class-name="(row: ScheduleOccurrenceDto) => isPastOccurrence(row, timeZone) ? 'row-before-today' : ''"
          :pagination="pagination"
        />
      </NCard>
    </template>
    <NAlert
      v-else
      type="warning"
    >
      {{ t('schedule.notFound') }}
    </NAlert>
  </div>
</template>

<style scoped>
.detail-page { display: flex; flex-direction: column; gap: 1rem; padding: 6vh 8vw; }
.schedule-info { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: 1rem 2rem; }
.schedule-info > .n-tag { justify-self: start; }
.schedule-type { align-self: start; inline-size: fit-content; }
.schedule-actions :deep(.n-button) { border-radius: 3px; }
.star-button { margin-inline-end: var(--space-4); }
.star-icon { font-size: 1.5rem; }
.pre-line { white-space: pre-line; }
table { inline-size: 100%; border-collapse: collapse; }
th, td { padding: 0.6rem; border-block-end: 1px solid var(--color-border); text-align: start; }
:deep(.row-before-today) {
  --n-td-text-color: var(--color-text-muted);
}
</style>
