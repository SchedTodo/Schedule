<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NInput, NPopover } from 'naive-ui'

const storageKey = 'schedule-v2-ideas'
const show = ref(false)
const ideas = ref(typeof localStorage === 'undefined' ? '' : (localStorage.getItem(storageKey) ?? ''))

function updateIdeas(value: string) {
  ideas.value = value
  localStorage.setItem(storageKey, value)
}
</script>

<template>
  <div class="idea-pane">
    <NPopover
      v-model:show="show"
      placement="left-start"
      trigger="manual"
    >
      <template #trigger>
        <NButton
          text
          class="idea-trigger"
          aria-label="Idea"
          @click="show = !show"
        >
          💡
        </NButton>
      </template>
      <NInput
        :value="ideas"
        type="textarea"
        :autosize="{ minRows: 16, maxRows: 20 }"
        style="width: 30vw; min-width: 18rem"
        @update:value="updateIdeas"
      />
    </NPopover>
  </div>
</template>
