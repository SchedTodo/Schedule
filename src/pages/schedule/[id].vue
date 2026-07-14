<script setup lang="ts">
import { inject, ref } from 'vue'
import { NAlert, NButton, NCard, NEmpty, NInput, NPageHeader, NSpin, NTag } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { platformGatewayKey } from '../../app/injection-keys'
import type { ScheduleOccurrenceDto } from '../../contracts/occurrence.contract'
import type { ConcentrationRecordDto } from '../../contracts/record.contract'
import { defaultSettings } from '../../contracts/settings.contract'
import { formatInstant } from '../../features/schedule/occurrence-time'
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
const format = (value: string) => formatInstant(value, timeZone.value)
const occurrences = ref<ScheduleOccurrenceDto[]>([])
const records = ref<ConcentrationRecordDto[]>([])
const editing = ref(false)
const title = ref('')
const recurrenceCode = ref('')
const exclusionCode = ref('')
const comment = ref('')

async function refreshOccurrences() {
  const result = await platform.occurrences.listVisibleBySchedule(scheduleId)
  if (result.ok) occurrences.value = [...result.value]
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
  if (!schedule) return
  await platform.schedules.setStarred({ id: scheduleId, starred: !schedule.starred })
  await detail.refresh()
}
function beginEdit() {
  const schedule = detail.schedule.value
  if (!schedule) return
  title.value = schedule.title
  recurrenceCode.value = schedule.recurrenceCode
  exclusionCode.value = schedule.exclusionCode
  comment.value = schedule.comment
  editing.value = true
}
async function saveEdit() {
  const result = await platform.schedules.update({
    id: scheduleId,
    title: title.value,
    recurrenceCode: recurrenceCode.value,
    exclusionCode: exclusionCode.value,
    comment: comment.value
  })
  if (result.ok) {
    editing.value = false
    await Promise.all([detail.refresh(), refreshOccurrences()])
  }
}
async function removeSchedule() {
  const result = await platform.schedules.setDeleted({ id: scheduleId, deleted: true })
  if (result.ok) await router.push({ name: 'database' })
}
async function excludeOccurrence(occurrenceId: string) {
  await platform.occurrences.excludeMany({ ids: [occurrenceId] })
  await refreshOccurrences()
}
void refreshOccurrences()
void refreshRecords()
void refreshSettings()
</script>

<template>
  <div class="detail-page">
    <NPageHeader
      title="Schedule"
      :show-breadcrumb="false"
      @back="router.back()"
    />
    <NSpin
      v-if="detail.loading.value"
      description="Loading"
    />
    <NAlert
      v-else-if="detail.error.value"
      type="error"
    >
      {{ detail.error.value.message }}
    </NAlert>
    <template v-else-if="detail.schedule.value">
      <NCard segmented>
        <template #header>
          <b>Info</b>
        </template>
        <template #header-extra>
          <NButton
            text
            aria-label="Star"
            @click="toggleStar"
          >
            {{ detail.schedule.value.starred ? '★' : '☆' }}
          </NButton>
          <NButton @click="beginEdit">
            Edit
          </NButton><NButton @click="removeSchedule">
            Delete
          </NButton>
        </template>
        <div class="schedule-info">
          <b>Name</b><span>{{ detail.schedule.value.title }}</span> <b>Type</b><NTag type="success">
            {{ detail.schedule.value.kind }}
          </NTag>
          <b>Comment</b><span class="pre-line">{{ detail.schedule.value.comment }}</span>
          <b>rTime</b><span class="pre-line">{{ detail.schedule.value.recurrenceCode }}</span>
          <b>exTime</b><span class="pre-line">{{ detail.schedule.value.exclusionCode }}</span>
          <b>Star</b><span>{{ detail.schedule.value.starred }}</span> <b>Created</b><span>{{ format(detail.schedule.value.createdAt) }}</span> <b>Updated</b><span>{{ format(detail.schedule.value.updatedAt) }}</span>
        </div>
        <form
          v-if="editing"
          class="edit-form"
          @submit.prevent="saveEdit"
        >
          <NInput
            v-model:value="title"
            aria-label="Edit name"
          />
          <NInput
            v-model:value="recurrenceCode"
            type="textarea"
            aria-label="Edit recurrence"
          />
          <NInput
            v-model:value="exclusionCode"
            type="textarea"
            aria-label="Edit exclusion"
          />
          <NInput
            v-model:value="comment"
            type="textarea"
            aria-label="Edit comment"
          />
          <NButton attr-type="submit">
            Save
          </NButton>
          <NButton @click="editing = false">
            Cancel
          </NButton>
        </form>
      </NCard>
      <NCard segmented>
        <template #header>
          <b>Records</b>
        </template>
        <NEmpty
          v-if="records.length === 0"
          description="No Records"
        />
        <table v-else>
          <thead><tr><th>Start</th><th>End</th><th>Duration</th></tr></thead>
          <tbody>
            <tr
              v-for="record in records"
              :key="record.id"
            >
              <td>{{ format(record.start) }}</td>
              <td>{{ format(record.end) }}</td>
              <td>{{ Math.round((Date.parse(record.end) - Date.parse(record.start)) / 60000) }} min</td>
            </tr>
          </tbody>
        </table>
      </NCard>
      <NCard segmented>
        <template #header>
          <b>Times</b>
        </template>
        <NEmpty
          v-if="occurrences.length === 0"
          description="No Times"
        />
        <table v-else>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Comment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="occurrence in occurrences"
              :key="occurrence.id"
            >
              <td>{{ occurrence.start ? format(occurrence.start) : '—' }}</td>
              <td>{{ format(occurrence.end) }}</td>
              <td>{{ occurrence.comment }}</td>
              <td>
                <NButton @click="excludeOccurrence(occurrence.id)">
                  Delete
                </NButton>
              </td>
            </tr>
          </tbody>
        </table>
      </NCard>
    </template>
    <NAlert
      v-else
      type="warning"
    >
      Schedule not found
    </NAlert>
  </div>
</template>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 6vh 8vw;
}
.schedule-info {
  display: grid;
  grid-template-columns: 5rem 1fr;
  gap: 1rem 2rem;
}
.pre-line {
  white-space: pre-line;
}
.edit-form {
  display: grid;
  gap: 0.75rem;
  margin-block-start: 1rem;
}
table {
  inline-size: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.6rem;
  border-block-end: 1px solid var(--color-border);
  text-align: start;
}
</style>
