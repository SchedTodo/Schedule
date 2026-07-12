<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NCard, NInput, NSelect, NTag } from 'naive-ui'
import { useRouter } from 'vue-router'
import { platformGatewayKey } from '../app/injection-keys'
import type { ScheduleKind } from '../contracts/schedule.contract'
import { useScheduleList } from '../features/schedule/use-schedule-list'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const router = useRouter()
const list = useScheduleList(gateway, { offset: 0, limit: 200 })
const search = ref('')
const kind = ref<ScheduleKind | null>(null)
const filtered = computed(() => list.items.value.filter((item) => {
  if (kind.value && item.kind !== kind.value) return false
  const keyword = search.value.trim().toLocaleLowerCase()
  return keyword === '' || item.title.toLocaleLowerCase().includes(keyword) || item.comment.toLocaleLowerCase().includes(keyword)
}))
</script>

<template>
  <div class="database-page">
    <NCard segmented>
      <template #header>
        <b>Database</b>
      </template>
      <div class="database-wrapper">
        <div class="database-filter">
          <label
            class="sr-only"
            for="database-search"
          >Search Name or Comment</label>
          <NInput
            v-model:value="search"
            placeholder="Search Name or Comment..."
            :input-props="{ id: 'database-search' }"
            clearable
          />
          <span>Type</span>
          <NSelect
            :value="kind"
            placeholder="Type"
            clearable
            :options="[{ label: 'todo', value: 'todo' }, { label: 'event', value: 'event' }]"
            style="width: 12rem"
            @update:value="kind = $event"
          />
          <span aria-label="Star filter">☆</span>
        </div>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Created</th><th>Updated</th><th>Type</th><th>Star</th></tr></thead>
          <tbody>
            <tr
              v-for="item in filtered"
              :key="item.id"
              @click="router.push({ name: 'schedule-detail', params: { id: item.id } })"
            >
              <td>{{ item.id }}</td><td>{{ item.title }}</td><td>{{ new Date(item.createdAt).toLocaleString() }}</td><td>{{ new Date(item.updatedAt).toLocaleString() }}</td>
              <td>
                <NTag type="success">
                  {{ item.kind }}
                </NTag>
              </td><td>{{ item.starred ? '★' : '☆' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.database-page { padding: 6vh 8vw 4vh; }
.database-wrapper { display: grid; gap: 1rem; }
.database-filter { display: flex; align-items: center; justify-content: flex-end; gap: 1rem; }
.database-filter > :first-of-type { max-inline-size: 28rem; }
table { inline-size: 100%; border-collapse: collapse; }
th, td { padding: 0.85rem; border-block-end: 1px solid var(--color-border); text-align: start; }
tbody tr { cursor: pointer; }
tbody tr:hover { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
.sr-only { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
</style>
