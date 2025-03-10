<template>
  <div class="schedule-info">
    <div v-for="row in rows" :key="row.key" class="row">
      <template v-if="row.visible ?? true">
        <div class="label">{{ row.label }}</div>
        <div :style="{ whiteSpace: row.whiteSpace || 'normal' }">
          <template v-if="row.render">
            <component :is="row.render(props.schedule[row.key])" />
          </template>
          <template v-else>
            {{ props.schedule[row.key] }}
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'
import { Schedule } from '@prisma/client'
import { DateTime } from 'luxon'

const props = defineProps<{
  schedule: Schedule & { _created: DateTime; _updated: DateTime; _syncAt?: DateTime }
}>()

type Row = {
  label: string
  key: string
  render?: (value: any) => ReturnType<typeof h>
  visible?: boolean
  whiteSpace?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line' | 'break-spaces'
}

const rows: Row[] = [
  {
    label: 'Name',
    key: 'name'
  },
  {
    label: 'Type',
    key: 'type',
    render: (value) => {
      return h(NTag, { type: 'success' }, value)
    }
  },
  {
    label: 'Comment',
    key: 'comment',
    whiteSpace: 'pre-line'
  },
  {
    label: 'rTime',
    key: 'rTimeCode',
    whiteSpace: 'pre-line'
  },
  {
    label: 'exTime',
    key: 'exTimeCode',
    whiteSpace: 'pre-line'
  },
  {
    label: 'Done',
    key: 'done',
    visible: props.schedule.type === 'todo',
    render: (value) => {
      return h(NTag, { type: value ? 'success' : 'error' }, value)
    }
  },
  {
    label: 'Deleted',
    key: 'deleted',
    render: (value) => {
      return h(NTag, { type: value ? 'success' : 'error' }, value)
    }
  },
  {
    label: 'Created',
    key: '_created',
    render: (value) => {
      return h('span', value?.toLocaleString(DateTime.DATETIME_FULL))
    }
  },
  {
    label: 'Updated',
    key: '_updated',
    render: (value) => {
      return h('span', value?.toLocaleString(DateTime.DATETIME_FULL))
    }
  },
  {
    label: 'SyncAt',
    key: '_syncAt',
    render: (value) => {
      if (!value) {
        return h(NTag, { type: 'error' }, 'null')
      }
      return h('span', value.toLocaleString(DateTime.DATETIME_FULL))
    }
  },
  {
    label: 'Version',
    key: 'version'
  }
]
</script>

<style scoped lang="less">
.schedule-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;

  div {
    display: flex;
    gap: 1rem;
    font-size: medium;
  }

  .label {
    display: inline-block;
    width: 5rem;
    text-align: left;
    font-weight: bold;
    margin: 0 1rem 0 0;
  }
}
</style>
