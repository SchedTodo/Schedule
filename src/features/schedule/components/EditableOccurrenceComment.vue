<script setup lang="ts">
import type { InputInst } from 'naive-ui'
import { nextTick, ref } from 'vue'
import { NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ value: string }>()
const emit = defineEmits<{ commit: [value: string] }>()
const editing = ref(false)
const draft = ref('')
const input = ref<InputInst | null>(null)
const { t } = useI18n()

function beginEdit() {
  draft.value = props.value
  editing.value = true
  void nextTick(() => input.value?.focus())
}

function finishEdit() {
  editing.value = false
  if (draft.value !== props.value) emit('commit', draft.value)
}
</script>

<template>
  <NInput
    v-if="editing"
    ref="input"
    v-model:value="draft"
    :aria-label="t('schedule.comment')"
    @blur="finishEdit"
    @keyup.enter="finishEdit"
  />
  <div
    v-else
    data-comment-display
    class="comment-display"
    @dblclick="beginEdit"
  >
    {{ value }}
  </div>
</template>

<style scoped>
.comment-display {
  min-block-size: 1.5rem;
  inline-size: 100%;
  cursor: pointer;
}
</style>
