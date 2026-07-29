<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { NButton, NCard, NForm, NFormItem, NInput, NModal } from 'naive-ui'

import type { CreateScheduleInput } from '../../../contracts/schedule.contract'
import { Temporal } from '../../../domain/shared/temporal'
import { useI18n } from 'vue-i18n'
import ScheduleCodeEditor from '../editor/ScheduleCodeEditor.vue'
import type { ScheduleEditorSettings } from '../editor/schedule-editor-support'
import { useShortcut, type ShortcutCommand } from '../../../app/shortcuts'

const props = withDefaults(defineProps<{
  settings: ScheduleEditorSettings
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
const recurrenceEditor = ref<InstanceType<typeof ScheduleCodeEditor> | null>(null)
const exclusionEditor = ref<InstanceType<typeof ScheduleCodeEditor> | null>(null)
const focusedEditor = ref<'recurrence' | 'exclusion' | null>(null)
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
  if (!recurrenceEditor.value?.validate() || !exclusionEditor.value?.validate()) return
  emit('submit', {
    title: model.title.trim(),
    recurrenceCode: model.recurrenceCode,
    exclusionCode: model.exclusionCode,
    comment: model.comment
  })
  show.value = false
}

function insertWeekday(weekday: number) {
  if (focusedEditor.value === null) return
  const today = Temporal.Instant.fromEpochMilliseconds(Date.now())
    .toZonedDateTimeISO(props.settings.timeZone)
    .toPlainDate()
  const daysUntilWeekday = (weekday - today.dayOfWeek + 7) % 7 || 7
  const nextDate = today.add({ days: daysUntilWeekday })
  const date = `${nextDate.year}/${String(nextDate.month).padStart(2, '0')}/${String(nextDate.day).padStart(2, '0')}`
  if (focusedEditor.value === 'recurrence') recurrenceEditor.value?.insertText(date)
  else exclusionEditor.value?.insertText(date)
}

useShortcut('schedule.openAdd', open, {
  enabled: () => props.mode === 'add' && !show.value,
  priority: 10
})
useShortcut('schedule.closeModal', () => { show.value = false }, {
  enabled: () => show.value,
  priority: 20
})
useShortcut('schedule.submitModal', () => { void submit() }, {
  enabled: () => show.value,
  priority: 20
})
const weekdayCommands: readonly ShortcutCommand[] = [
  'schedule.insertMonday',
  'schedule.insertTuesday',
  'schedule.insertWednesday',
  'schedule.insertThursday',
  'schedule.insertFriday',
  'schedule.insertSaturday',
  'schedule.insertSunday'
]
weekdayCommands.forEach((command, index) => {
  useShortcut(command, () => { insertWeekday(index + 1) }, {
    enabled: () => show.value && focusedEditor.value !== null,
    priority: 30
  })
})
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
          <ScheduleCodeEditor
            ref="recurrenceEditor"
            v-model="model.recurrenceCode"
            :settings="settings"
            v-bind="{ ariaLabel: 'rTime' }"
            @focus="focusedEditor = 'recurrence'"
            @blur="focusedEditor = null"
          />
        </NFormItem>
        <NFormItem
          :label="t('schedule.exclusion')"
          path="exclusionCode"
        >
          <ScheduleCodeEditor
            ref="exclusionEditor"
            v-model="model.exclusionCode"
            :settings="settings"
            v-bind="{ ariaLabel: 'exTime' }"
            allow-empty
            @focus="focusedEditor = 'exclusion'"
            @blur="focusedEditor = null"
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
