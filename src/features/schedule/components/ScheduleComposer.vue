<script setup lang="ts">
import { ref } from 'vue'
import { NAlert, NButton, NForm, NInput } from 'naive-ui'

import type { AppErrorDto } from '../../../contracts/result'
import type { CreateScheduleInput } from '../../../contracts/schedule.contract'
import { useI18n } from 'vue-i18n'

withDefaults(defineProps<{ loading?: boolean; error?: AppErrorDto | null }>(), {
  loading: false,
  error: null
})

const emit = defineEmits<{ submit: [input: CreateScheduleInput] }>()
const title = ref('')
const recurrenceCode = ref('')
const comment = ref('')
const validationMessage = ref('')
const { t, te } = useI18n()

/** 校验表单并向父组件提交规范化的创建输入。 */
function submit() {
  const normalizedTitle = title.value.trim()
  if (normalizedTitle === '') {
    validationMessage.value = t('schedule.titleRequired')
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
    <h2>{{ t('schedule.add') }}</h2>
    <NAlert
      v-if="error"
      type="error"
    >
      {{ te(error.messageKey) ? t(error.messageKey) : error.message }}
    </NAlert>
    <NAlert
      v-if="validationMessage"
      type="warning"
    >
      {{ validationMessage }}
    </NAlert>

    <div class="field">
      <label for="schedule-title">{{ t('common.name') }}</label>
      <NInput
        v-model:value="title"
        :disabled="loading"
        :input-props="{ id: 'schedule-title' }"
      />
    </div>
    <div class="field">
      <label for="schedule-recurrence">{{ t('schedule.recurrence') }}</label>
      <NInput
        v-model:value="recurrenceCode"
        :disabled="loading"
        :input-props="{ id: 'schedule-recurrence' }"
        placeholder="2026-07-12 10:00"
      />
    </div>
    <div class="field">
      <label for="schedule-comment">{{ t('common.comment') }}</label>
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
      {{ t('schedule.add') }}
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
