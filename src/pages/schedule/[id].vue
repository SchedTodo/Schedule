<script setup lang="ts">
import { inject } from 'vue'
import { NAlert, NButton, NCard, NEmpty, NPageHeader, NSpin, NTag } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'
import { platformGatewayKey } from '../../app/injection-keys'
import { useScheduleDetail } from '../../features/schedule/use-schedule-detail'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const route = useRoute()
const router = useRouter()
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
if (!id) throw new Error('Schedule id is required')
const detail = useScheduleDetail(gateway, id)
const format = (value: string) => new Date(value).toLocaleString()
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
            disabled
            aria-label="Star"
          >
            {{ detail.schedule.value.starred ? '★' : '☆' }}
          </NButton>
          <NButton disabled>
            Edit
          </NButton><NButton disabled>
            Delete
          </NButton>
        </template>
        <div class="schedule-info">
          <b>Name</b><span>{{ detail.schedule.value.title }}</span>
          <b>Type</b><NTag type="success">
            {{ detail.schedule.value.kind }}
          </NTag>
          <b>Comment</b><span class="pre-line">{{ detail.schedule.value.comment }}</span>
          <b>rTime</b><span class="pre-line">{{ detail.schedule.value.recurrenceCode }}</span>
          <b>exTime</b><span class="pre-line">{{ detail.schedule.value.exclusionCode }}</span>
          <b>Star</b><span>{{ detail.schedule.value.starred }}</span>
          <b>Created</b><span>{{ format(detail.schedule.value.createdAt) }}</span>
          <b>Updated</b><span>{{ format(detail.schedule.value.updatedAt) }}</span>
        </div>
      </NCard>
      <NCard segmented>
        <template #header>
          <b>Times</b>
        </template>
        <template #header-extra>
          <NButton disabled>
            Delete
          </NButton>
        </template>
        <NEmpty description="No Times" />
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
.detail-page { display: flex; flex-direction: column; gap: 1rem; padding: 6vh 8vw; }
.schedule-info { display: grid; grid-template-columns: 5rem 1fr; gap: 1rem 2rem; }
.pre-line { white-space: pre-line; }
</style>
