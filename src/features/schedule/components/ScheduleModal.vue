<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { NButton, NCard, NForm, NFormItem, NInput, NModal } from 'naive-ui'

import type { CreateScheduleInput } from '../../../contracts/schedule.contract'
import { Temporal } from '../../../domain/shared/temporal'

const props = withDefaults(defineProps<{
  timeZone: string
  loading?: boolean
  error?: string | null
  mode?: 'add' | 'edit'
  initialValue?: CreateScheduleInput
}>(), {
  loading: false,
  error: null,
  mode: 'add',
  initialValue: () => ({
    title: '',
    recurrenceCode: '',
    exclusionCode: '',
    comment: ''
  })
})
const emit = defineEmits<{ submit: [input: CreateScheduleInput] }>()
const show = ref(false)
const formRef = ref<FormInst | null>(null)
const model = reactive({
  title: '',
  recurrenceCode: '',
  exclusionCode: '',
  comment: ''
})
const rules: FormRules = {
  title: [{ required: true, message: 'Please input name', trigger: ['input', 'blur'] }],
  recurrenceCode: [{ required: true, message: 'Please input rTime', trigger: ['input', 'blur'] }]
}

function resetDraft() {
  Object.assign(model, props.initialValue ?? {
    title: '',
    recurrenceCode: '',
    exclusionCode: '',
    comment: ''
  })
}

function open() {
  resetDraft()
  show.value = true
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  emit('submit', {
    title: model.title.trim(),
    recurrenceCode: model.recurrenceCode,
    exclusionCode: model.exclusionCode,
    comment: model.comment
  })
  show.value = false
}

function handleKeyboard(event: KeyboardEvent) {
  if (!event.ctrlKey) return
  if (!show.value && props.mode === 'add' && event.key === 'ArrowUp') open()
  else if (show.value && event.key === 'ArrowDown') show.value = false
  else if (show.value && event.key === 'Enter') void submit()
  else if (show.value && /^[1-7]$/.test(event.key)) {
    const focusedElement = document.activeElement
    if (!(focusedElement instanceof HTMLTextAreaElement)) return
    const field = focusedElement.getAttribute('aria-label')
    if (field !== 'rTime' && field !== 'exTime') return

    const weekday = Number(event.key)
    const today = Temporal.Instant.fromEpochMilliseconds(Date.now())
      .toZonedDateTimeISO(props.timeZone)
      .toPlainDate()
    const daysUntilWeekday = (weekday - today.dayOfWeek + 7) % 7 || 7
    const nextDate = today.add({ days: daysUntilWeekday })
    const date = `${nextDate.year}/${String(nextDate.month).padStart(2, '0')}/${String(nextDate.day).padStart(2, '0')}`
    const value = `${focusedElement.value.slice(0, focusedElement.selectionStart)}${date}${focusedElement.value.slice(focusedElement.selectionEnd)}`

    if (field === 'rTime') model.recurrenceCode = value
    else model.exclusionCode = value
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyboard))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyboard))
</script>

<template>
  <NButton
    :type="mode === 'add' ? 'primary' : 'default'"
    @click="open"
  >
    {{ mode === 'add' ? 'Add' : 'Edit' }}
  </NButton>
  <NModal v-model:show="show">
    <NCard
      class="schedule-modal"
      :title="mode === 'add' ? 'Add' : 'Edit'"
      :bordered="false"
      role="dialog"
    >
      <NForm
        ref="formRef"
        :model="model"
        :rules="rules"
        label-placement="left"
        label-align="right"
        label-width="auto"
        size="large"
      >
        <NFormItem
          label="Name"
          path="title"
        >
          <NInput
            v-model:value="model.title"
            :input-props="{ 'aria-label': 'Name' }"
          />
        </NFormItem>
        <NFormItem
          label="rTime"
          path="recurrenceCode"
        >
          <NInput
            v-model:value="model.recurrenceCode"
            type="textarea"
            :input-props="{ 'aria-label': 'rTime' }"
            :autosize="{ minRows: 4, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem
          label="exTime"
          path="exclusionCode"
        >
          <NInput
            v-model:value="model.exclusionCode"
            type="textarea"
            :input-props="{ 'aria-label': 'exTime' }"
            :autosize="{ minRows: 4, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem
          label="Comment"
          path="comment"
        >
          <NInput
            v-model:value="model.comment"
            type="textarea"
            :input-props="{ 'aria-label': 'Comment' }"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NButton
          type="primary"
          attr-type="button"
          :loading="loading"
          @click="void submit()"
        >
          Confirm
        </NButton>
      </template>
    </NCard>
  </NModal>
</template>

<style scoped>
.schedule-modal {
  inline-size: 58vw;
  min-inline-size: 32rem;
}
</style>
