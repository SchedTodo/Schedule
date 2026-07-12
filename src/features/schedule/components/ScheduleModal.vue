<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { NButton, NCard, NForm, NFormItem, NInput, NModal } from 'naive-ui'

import type { CreateScheduleInput } from '../../../contracts/schedule.contract'

withDefaults(defineProps<{ loading?: boolean; error?: string | null }>(), {
  loading: false,
  error: null
})
const emit = defineEmits<{ submit: [input: CreateScheduleInput] }>()
const show = ref(false)
const name = ref('')
const recurrenceCode = ref('')
const exclusionCode = ref('')
const comment = ref('')
const validation = ref('')

function submit() {
  if (!name.value.trim() || !recurrenceCode.value.trim()) {
    validation.value = 'Please input name and time'
    return
  }
  validation.value = ''
  emit('submit', {
    title: name.value.trim(),
    recurrenceCode: recurrenceCode.value,
    exclusionCode: exclusionCode.value,
    comment: comment.value
  })
  show.value = false
}

function handleKeyboard(event: KeyboardEvent) {
  if (!event.ctrlKey) return
  if (!show.value && event.key === 'ArrowUp') show.value = true
  else if (show.value && event.key === 'ArrowDown') show.value = false
  else if (show.value && event.key === 'Enter') submit()
}

onMounted(() => window.addEventListener('keydown', handleKeyboard))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyboard))
</script>

<template>
  <NButton
    type="primary"
    @click="show = true"
  >
    Add
  </NButton>
  <NModal v-model:show="show">
    <NCard
      class="schedule-modal"
      title="Add"
      :bordered="false"
      role="dialog"
    >
      <NForm
        label-placement="left"
        label-align="right"
        label-width="auto"
        size="large"
      >
        <NFormItem label="Name">
          <NInput
            v-model:value="name"
            :input-props="{ 'aria-label': 'Name' }"
          />
        </NFormItem>
        <NFormItem label="rTime">
          <NInput
            v-model:value="recurrenceCode"
            type="textarea"
            :input-props="{ 'aria-label': 'rTime' }"
            :autosize="{ minRows: 4, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem label="exTime">
          <NInput
            v-model:value="exclusionCode"
            type="textarea"
            :input-props="{ 'aria-label': 'exTime' }"
            :autosize="{ minRows: 4, maxRows: 8 }"
          />
        </NFormItem>
        <NFormItem label="Comment">
          <NInput
            v-model:value="comment"
            type="textarea"
            :input-props="{ 'aria-label': 'Comment' }"
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NFormItem>
      </NForm>
      <p
        v-if="validation"
        role="alert"
      >
        {{ validation }}
      </p>
      <template #footer>
        <NButton
          type="primary"
          :loading="loading"
          @click="submit"
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
