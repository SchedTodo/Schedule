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

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const route = useRoute()
const router = useRouter()
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
if (!id) throw new Error('Schedule id is required')
const scheduleId = id
const detail = useScheduleDetail(platform, scheduleId)
const timeZone = ref(defaultSettings.timeZone)
const occurrences = ref<ScheduleOccurrenceDto[]>([])
const records = ref<ConcentrationRecordDto[]>([])
const checkedRowKeys = ref<DataTableRowKey[]>([])
const mutationError = ref<string | null>(null)
const pagination = reactive({
  page: 1,
  pageSize: 5,
  showSizePicker: true,
  pageSizes: [5, 10, 15, 20]
})
const format = (value: string) => formatInstant(value, timeZone.value)
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

async function refreshOccurrences() {
  const result = await platform.occurrences.listVisibleBySchedule(scheduleId)
  if (result.ok) {
    occurrences.value = [...result.value]
    checkedRowKeys.value = []
  }
}

async function refreshRecords() {
  const result = await platform.records.listBySchedule(scheduleId)
  if (result.ok) records.value = [...result.value]
}

async function refreshSettings() {
  const result = await platform.settings.get()
  if (result.ok) timeZone.value = result.value.timeZone
}

async function toggleStar() {
  const schedule = detail.schedule.value
  if (!schedule || schedule.deleted) return
  const result = await platform.schedules.setStarred({
    id: scheduleId,
    starred: !schedule.starred
  })
  if (result.ok) await detail.refresh()
  else mutationError.value = result.error.message
}

async function saveEdit(input: CreateScheduleInput) {
  const result = await platform.schedules.update({ id: scheduleId, ...input })
  if (result.ok) {
    mutationError.value = null
    await Promise.all([detail.refresh(), refreshOccurrences()])
  } else mutationError.value = result.error.message
}

async function removeSchedule() {
  const result = await platform.schedules.setDeleted({ id: scheduleId, deleted: true })
  if (result.ok) await router.push({ name: 'database' })
  else mutationError.value = result.error.message
}

async function excludeSelected() {
  if (checkedRowKeys.value.length === 0) return
  const result = await platform.occurrences.excludeMany({
    ids: checkedRowKeys.value.map(String)
  })
  if (result.ok) {
    mutationError.value = null
    await Promise.all([detail.refresh(), refreshOccurrences()])
  } else mutationError.value = result.error.message
}

async function updateComment(id: string, comment: string) {
  const result = await platform.occurrences.updateComment(id, comment)
  if (result.ok) await refreshOccurrences()
  else mutationError.value = result.error.message
}

const columns: DataTableColumns<ScheduleOccurrenceDto> = [
  { type: 'selection' },
  {
    title: 'Start',
    key: 'start',
    render: (row) => row.start === null
      ? '-'
      : formatOccurrenceDateTime(row.start, row.startMark, timeZone.value)
  },
  {
    title: 'End',
    key: 'end',
    render: (row) => formatOccurrenceDateTime(row.end, row.endMark, timeZone.value)
  },
  {
    title: 'Weekday',
    key: 'weekday',
    render: (row) => occurrenceWeekday(row, timeZone.value)
  },
  {
    title: 'Comment',
    key: 'comment',
    render: (row) => h(EditableOccurrenceComment, {
      value: row.comment,
      onCommit: (value) => void updateComment(row.id, value)
    })
  }
]

void refreshOccurrences()
void refreshRecords()
void refreshSettings()
</script>

<template>
  <div class="detail-page">
    <NPageHeader title="Schedule" :show-breadcrumb="false" @back="router.back()" />
    <NSpin v-if="detail.loading.value" description="Loading" />
    <NAlert v-else-if="detail.error.value" type="error">
      {{ detail.error.value.message }}
    </NAlert>
    <template v-else-if="detail.schedule.value">
      <NAlert v-if="mutationError" type="error" closable @close="mutationError = null">
        {{ mutationError }}
      </NAlert>
      <NCard segmented>
        <template #header><b>Info</b></template>
        <template #header-extra>
          <NButton
            text
            :disabled="detail.schedule.value.deleted"
            :color="detail.schedule.value.starred ? '#ffe742' : '#c2c2c2'"
            :aria-label="detail.schedule.value.starred ? 'Unstar schedule' : 'Star schedule'"
            @click="toggleStar"
          >
            <NIcon class="star-icon"><Star /></NIcon>
          </NButton>
          <NButtonGroup v-if="!detail.schedule.value.deleted" class="schedule-actions">
            <ScheduleModal mode="edit" :initial-value="editValue" @submit="saveEdit" />
            <NPopconfirm @positive-click="removeSchedule">
              <template #trigger><NButton>Delete</NButton></template>
              Delete the whole Schedule?
            </NPopconfirm>
          </NButtonGroup>
        </template>
        <div class="schedule-info">
          <b>Name</b><span>{{ detail.schedule.value.title }}</span>
          <b>Type</b><NTag class="schedule-type" type="success">{{ detail.schedule.value.kind }}</NTag>
          <b>Comment</b><span class="pre-line">{{ detail.schedule.value.comment }}</span>
          <b>rTime</b><span class="pre-line">{{ detail.schedule.value.recurrenceCode }}</span>
          <b>exTime</b><span class="pre-line">{{ detail.schedule.value.exclusionCode }}</span>
          <b>Deleted</b><NTag :type="detail.schedule.value.deleted ? 'success' : 'error'">{{ detail.schedule.value.deleted }}</NTag>
          <b>Created</b><span>{{ format(detail.schedule.value.createdAt) }}</span>
          <b>Updated</b><span>{{ format(detail.schedule.value.updatedAt) }}</span>
        </div>
      </NCard>
      <NCard v-if="detail.schedule.value.kind === 'todo'" segmented>
        <template #header><b>Records</b></template>
        <NEmpty v-if="records.length === 0" description="No Records" />
        <table v-else>
          <thead><tr><th>Start</th><th>End</th><th>Duration</th></tr></thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td>{{ format(record.start) }}</td>
              <td>{{ format(record.end) }}</td>
              <td>{{ Math.round((Date.parse(record.end) - Date.parse(record.start)) / 60000) }} min</td>
            </tr>
          </tbody>
        </table>
      </NCard>
      <NCard segmented>
        <template #header><b>Times</b></template>
        <template v-if="!detail.schedule.value.deleted" #header-extra>
          <NPopconfirm @positive-click="excludeSelected">
            <template #trigger><NButton>Delete</NButton></template>
            Delete selected times?
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
    <NAlert v-else type="warning">Schedule not found</NAlert>
  </div>
</template>

<style scoped>
.detail-page { display: flex; flex-direction: column; gap: 1rem; padding: 6vh 8vw; }
.schedule-info { display: grid; grid-template-columns: 5rem minmax(0, 1fr); gap: 1rem 2rem; }
.schedule-info > .n-tag { justify-self: start; }
.schedule-type { align-self: start; inline-size: fit-content; }
.schedule-actions :deep(.n-button) { border-radius: 3px; }
.star-icon { font-size: 1.5rem; }
.pre-line { white-space: pre-line; }
table { inline-size: 100%; border-collapse: collapse; }
th, td { padding: 0.6rem; border-block-end: 1px solid var(--color-border); text-align: start; }
:deep(.row-before-today td) { color: #ccc; }
</style>
