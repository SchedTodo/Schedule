<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { NButton, NCard, NPageHeader, NProgress, NSelect } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'

import { platformGatewayKey } from '../../app/injection-keys'
import type { ScheduleOccurrenceDto } from '../../contracts/occurrence.contract'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const route = useRoute()
const router = useRouter()
const routeId = Array.isArray(route.params.timeId) ? route.params.timeId[0] : route.params.timeId
const todos = ref<readonly ScheduleOccurrenceDto[]>([])
const selectedId = ref(routeId ?? '')
const durationSeconds = ref(25 * 60)
const remainingSeconds = ref(25 * 60)
const active = ref(false)
const sessionStart = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | undefined

const selected = computed(() => todos.value.find(({ id }) => id === selectedId.value))
const percentage = computed(() => Math.round((1 - remainingSeconds.value / durationSeconds.value) * 100))
const display = computed(() => `${String(Math.floor(remainingSeconds.value / 60)).padStart(2, '0')}:${String(remainingSeconds.value % 60).padStart(2, '0')}`)

async function load() {
  const [settings, todoResult] = await Promise.all([
    platform.settings.get(),
    platform.occurrences.listTodos({ now: new Date().toISOString(), logicalDayStartHour: 0, logicalDayStartMinute: 0 })
  ])
  if (settings.ok) {
    durationSeconds.value = settings.value.focusMinutes * 60
    remainingSeconds.value = durationSeconds.value
  }
  if (todoResult.ok) todos.value = todoResult.value
}

function toggle() {
  active.value = !active.value
  if (active.value) {
    sessionStart.value ??= new Date().toISOString()
    timer = setInterval(() => {
      remainingSeconds.value = Math.max(0, remainingSeconds.value - 1)
      if (remainingSeconds.value === 0) active.value = false
    }, 1000)
  } else if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

async function submitSession() {
  const todo = selected.value
  if (!todo || sessionStart.value === null) return
  const end = new Date()
  if (end.getTime() - Date.parse(sessionStart.value) < 60_000) return
  await platform.records.create({ scheduleId: todo.scheduleId, start: sessionStart.value, end: end.toISOString() })
  sessionStart.value = null
}

onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
  void submitSession()
})
void load()
</script>

<template>
  <div class="concentrate-page">
    <NPageHeader
      title="Concentrate"
      :show-breadcrumb="false"
      @back="router.back()"
    />
    <NCard>
      <NSelect
        v-model:value="selectedId"
        :options="todos.map((todo) => ({ label: todo.title, value: todo.id }))"
      />
      <NProgress
        type="circle"
        :percentage="percentage"
      >
        {{ display }}
      </NProgress>
      <NButton @click="toggle">
        {{ active ? 'Pause' : 'Start' }}
      </NButton>
    </NCard>
  </div>
</template>

<style scoped>
.concentrate-page { min-block-size: 100%; padding: 6vh 8vw; background: #001428; color: white; }
.n-card { max-inline-size: 32rem; margin: 12vh auto 0; text-align: center; }
.n-progress { margin: 2rem; }
</style>
