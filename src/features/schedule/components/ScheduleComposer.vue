<script setup lang="ts">
import { ref } from 'vue'
import { NAlert, NButton, NForm, NInput } from 'naive-ui'

import type { AppErrorDto } from '../../../contracts/result'
import type { CreateScheduleInput } from '../../../contracts/schedule.contract'

withDefaults(defineProps<{ loading?: boolean; error?: AppErrorDto | null }>(), {
  loading: false,
  error: null
})

const emit = defineEmits<{ submit: [input: CreateScheduleInput] }>()
const title = ref('')
const recurrenceCode = ref('')
const comment = ref('')
const validationMessage = ref('')

/** 校验表单并向父组件提交规范化的创建输入。 */
function submit() {
  const normalizedTitle = title.value.trim()
  if (normalizedTitle === '') {
    validationMessage.value = '请输入日程标题'
    return
  }

  validationMessage.value = ''
  emit('submit', {
    title: normalizedTitle,
    recurrenceCode: recurrenceCode.value,
    exclusionCode: '',
    comment: comment.value
  })
}
</script>

<template>
  <NForm
    class="schedule-composer"
    @submit.prevent="submit"
  >
    <h2>新建日程</h2>
    <NAlert
      v-if="error"
      type="error"
    >
      {{ error.message }}
    </NAlert>
    <NAlert
      v-if="validationMessage"
      type="warning"
    >
      {{ validationMessage }}
    </NAlert>

    <div class="field">
      <label for="schedule-title">标题</label>
      <NInput
        v-model:value="title"
        :disabled="loading"
        :input-props="{ id: 'schedule-title' }"
      />
    </div>
    <div class="field">
      <label for="schedule-recurrence">时间规则</label>
      <NInput
        v-model:value="recurrenceCode"
        :disabled="loading"
        :input-props="{ id: 'schedule-recurrence' }"
        placeholder="例如：2026-07-12 10:00"
      />
    </div>
    <div class="field">
      <label for="schedule-comment">备注</label>
      <NInput
        v-model:value="comment"
        :disabled="loading"
        :input-props="{ id: 'schedule-comment' }"
        type="textarea"
      />
    </div>
    <NButton
      attr-type="submit"
      type="primary"
      :loading="loading"
      :disabled="loading"
    >
      创建日程
    </NButton>
  </NForm>
</template>

<style scoped>
.schedule-composer,
.field {
  display: grid;
  gap: 0.75rem;
}

.field {
  gap: 0.375rem;
}

h2 {
  margin: 0;
}
</style>
