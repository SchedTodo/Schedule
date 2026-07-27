<script setup lang="ts">
import { useNotification } from 'naive-ui'
import { provide } from 'vue'

import { appFeedbackKey } from '../app-feedback'

const notification = useNotification()

provide(appFeedbackKey, {
  success: (title) => notification.success({ title, duration: 3000 }),
  error: (title, content) => notification.error({ title, content })
})
</script>

<template>
  <slot />
</template>
