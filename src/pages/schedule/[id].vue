<script setup lang="ts">
import { inject } from 'vue'
import { NAlert, NDescriptions, NDescriptionsItem, NSpin } from 'naive-ui'
import { useRoute } from 'vue-router'

import { platformGatewayKey } from '../../app/injection-keys'
import { useScheduleDetail } from '../../features/schedule/use-schedule-detail'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')

const route = useRoute()
const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
if (!id) throw new Error('Schedule id is required')
const detail = useScheduleDetail(gateway, id)

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
</script>

<template>
  <section class="detail-page">
    <RouterLink to="/">
      返回日程
    </RouterLink>
    <NSpin
      v-if="detail.loading.value"
      description="正在加载日程"
    />
    <NAlert
      v-else-if="detail.error.value"
      type="error"
    >
      {{ detail.error.value.message }}
    </NAlert>
    <NAlert
      v-else-if="!detail.schedule.value"
      type="warning"
    >
      未找到该日程
    </NAlert>
    <article v-else>
      <h1>{{ detail.schedule.value.title }}</h1>
      <NDescriptions
        bordered
        :column="1"
      >
        <NDescriptionsItem label="类型">
          {{ detail.schedule.value.kind === 'event' ? '事件' : '待办' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="时间规则">
          {{ detail.schedule.value.recurrenceCode || '无' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="备注">
          {{ detail.schedule.value.comment || '无' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="星标">
          {{ detail.schedule.value.starred ? '已星标' : '未星标' }}
        </NDescriptionsItem>
        <NDescriptionsItem label="创建时间">
          {{ formatTimestamp(detail.schedule.value.createdAt) }}
        </NDescriptionsItem>
        <NDescriptionsItem label="更新时间">
          {{ formatTimestamp(detail.schedule.value.updatedAt) }}
        </NDescriptionsItem>
      </NDescriptions>
    </article>
  </section>
</template>

<style scoped>
.detail-page {
  display: grid;
  max-inline-size: 50rem;
  padding: 1.5rem;
  margin-inline: auto;
  gap: 1.5rem;
}
</style>
