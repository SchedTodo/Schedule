<script setup lang="ts">
import Bulb from '@vicons/ionicons5/es/Bulb'
import { ref } from 'vue'
import { NButton } from 'naive-ui/es/button'
import { NIcon } from 'naive-ui/es/icon'
import { NInput } from 'naive-ui/es/input'
import { NPopover } from 'naive-ui/es/popover'
import { useI18n } from 'vue-i18n'

const storageKey = 'schedule-v2-ideas'
const show = ref(false)
const { t } = useI18n()
const ideas = ref(typeof localStorage === 'undefined' ? '' : (localStorage.getItem(storageKey) ?? ''))

/** 更新灵感草稿并在浏览器存储可用时立即持久化。 */
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
          color="#ffe21e"
          class="idea-trigger"
          :aria-label="t('help.idea')"
          @click="show = !show"
        >
          <NIcon><Bulb /></NIcon>
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
