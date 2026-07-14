<script setup lang="ts">
import { inject, ref, watch } from 'vue'
import { NCard, NDatePicker, NInput, NSelect, NTag } from 'naive-ui'
import { useRouter } from 'vue-router'
import { platformGatewayKey } from '../app/injection-keys'
import type { ScheduleKind, SchedulePageItemDto } from '../contracts/schedule.contract'

const gateway = inject(platformGatewayKey)
if (!gateway) throw new Error('Platform gateway is not available')
const platform = gateway
const router = useRouter()
const search = ref('')
const kind = ref<ScheduleKind | null>(null)
const dates = ref<[number, number] | null>(null)
const starred = ref<'all' | 'starred' | 'unstarred'>('all')
const deleted = ref<'active' | 'deleted'>('active')
const page = ref(1)
const pageSize = 20
const items = ref<readonly SchedulePageItemDto[]>([])
const total = ref(0)

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
    ...(starred.value === 'all' ? {} : { starred: starred.value === 'starred' }),
    deleted: deleted.value === 'deleted',
    page: page.value,
    pageSize
  })
  if (result.ok) {
    items.value = result.value.items
    total.value = result.value.total
  }
}

async function restore(id: string) {
  await platform.schedules.setDeleted({ id, deleted: false })
  await refresh()
}

function previousPage() {
  page.value -= 1
  void refresh()
}

function nextPage() {
  page.value += 1
  void refresh()
}

watch(
  [search, kind, dates, starred, deleted],
  () => {
    page.value = 1
    void refresh()
  },
  { immediate: true }
)
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
          <span class="sr-only">Start Date</span>
          <NDatePicker
            v-model:value="dates"
            type="daterange"
            start-placeholder="Start Date"
            end-placeholder="End Date"
          />
          <span>Type</span>
          <NSelect
            :value="kind"
            placeholder="Type"
            clearable
            :options="[
              { label: 'todo', value: 'todo' },
              { label: 'event', value: 'event' }
            ]"
            style="width: 12rem"
            @update:value="kind = $event"
          />
          <NSelect
            v-model:value="starred"
            aria-label="Star filter"
            placeholder="Star"
            :options="[
              { label: 'All Stars', value: 'all' },
              { label: 'Starred', value: 'starred' },
              { label: 'Not Starred', value: 'unstarred' }
            ]"
            style="width: 9rem"
          />
          <NSelect
            v-model:value="deleted"
            aria-label="Deleted filter"
            :options="[
              { label: 'Active', value: 'active' },
              { label: 'Deleted', value: 'deleted' }
            ]"
            style="width: 9rem"
          />
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Deleted</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Type</th>
              <th>Star</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in items"
              :key="item.id"
              @click="router.push({ name: 'schedule-detail', params: { id: item.id } })"
            >
              <td>{{ item.id }}</td>
              <td>{{ item.title }}</td>
              <td>
                <NTag type="error">
                  {{ item.deleted }}
                </NTag>
              </td>
              <td>{{ new Date(item.createdAt).toLocaleString() }}</td>
              <td>{{ new Date(item.updatedAt).toLocaleString() }}</td>
              <td>
                <NTag type="success">
                  {{ item.kind }}
                </NTag>
              </td>
              <td>
                {{ item.starred ? '★' : '☆' }}
                <button
                  v-if="item.deleted"
                  type="button"
                  @click.stop="restore(item.id)"
                >
                  Restore
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="database-pagination">
          Total is {{ total }}.
          <button
            :disabled="page === 1"
            @click="previousPage"
          >
            ‹
          </button><button class="active">
            {{ page }}
          </button><button
            :disabled="page * pageSize >= total"
            @click="nextPage"
          >
            ›
          </button>
        </div>
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
.database-filter > :first-of-type {
  max-inline-size: 28rem;
}
table {
  inline-size: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.85rem;
  border-block-end: 1px solid var(--color-border);
  text-align: start;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}
.database-pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}
.database-pagination button {
  min-inline-size: 2rem;
  padding: 0.3rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: inherit;
}
.database-pagination button.active {
  border-color: #18a058;
  color: #18a058;
}
.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
