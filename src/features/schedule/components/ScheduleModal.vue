<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { NButton, NCard, NForm, NFormItem, NInput, NModal } from 'naive-ui'

import type { CreateScheduleInput } from '../../../contracts/schedule.contract'
import { Temporal } from '../../../domain/shared/temporal'
import { useI18n } from 'vue-i18n'

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
const { t } = useI18n()
const model = reactive({
  title: '',
  recurrenceCode: '',
  exclusionCode: '',
  comment: ''
})
const rules = computed<FormRules>(() => ({
  title: [{ required: true, message: t('schedule.titleRequired'), trigger: ['input', 'blur'] }],
  recurrenceCode: [{ required: true, message: t('schedule.recurrenceRequired'), trigger: ['input', 'blur'] }]
}))

/** 按新增或编辑模式恢复弹窗草稿，并清空上次校验信息。 */
function resetDraft() {
  Object.assign(model, props.initialValue ?? {
    title: '',
    recurrenceCode: '',
    exclusionCode: '',
    comment: ''
  })
}

/** 打开弹窗并根据当前模式重置草稿与校验状态。 */
function open() {
  resetDraft()
  show.value = true
}

/** 校验草稿并等待父组件完成保存，成功后关闭弹窗。 */
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

/** 实现 Ctrl+Enter 提交和 Escape 关闭的键盘交互。 */
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
    {{ mode === 'add' ? t('schedule.add') : t('schedule.edit') }}
  </NButton>
  <NModal v-model:show="show">
    <NCard
      class="schedule-modal"
      :title="mode === 'add' ? t('schedule.add') : t('schedule.edit')"
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
          :label="t('schedule.name')"
          path="title"
        >
          <NInput
            v-model:value="model.title"
            :input-props="{ 'aria-label': t('schedule.name') }"
          />
        </NFormItem>
        <NFormItem
          :label="t('schedule.recurrence')"
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
          :label="t('schedule.exclusion')"
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
          :label="t('schedule.comment')"
          path="comment"
        >
          <NInput
            v-model:value="model.comment"
            type="textarea"
            :input-props="{ 'aria-label': t('schedule.comment') }"
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
          {{ t('common.confirm') }}
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
