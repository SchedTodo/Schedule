<script setup lang="ts">
import { computed } from 'vue'
import { NConfigProvider } from 'naive-ui/es/config-provider'
import { NNotificationProvider } from 'naive-ui'
import { darkTheme } from 'naive-ui/es/themes'

import { naiveThemeOverrides } from './app/naive-theme'
import AppFeedbackProvider from './app/components/AppFeedbackProvider.vue'
import AppShell from './app/components/AppShell.vue'
import { usePreferencesStore } from './stores/preferences'
import { useRuntimeStore } from './stores/runtime'

const preferences = usePreferencesStore()
preferences.hydrate()
const runtime = useRuntimeStore()
runtime.init(preferences.calendarMode)
const usesDarkTheme = computed(
  () =>
    preferences.themeMode === 'dark' ||
    (preferences.themeMode === 'system' &&
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-color-scheme: dark)').matches)
)
</script>

<template>
  <NConfigProvider
    :theme="usesDarkTheme ? darkTheme : null"
    :theme-overrides="naiveThemeOverrides"
  >
    <NNotificationProvider>
      <AppFeedbackProvider>
        <main
          data-testid="app-shell"
          :class="{ 'theme-dark': usesDarkTheme }"
        >
          <AppShell />
        </main>
      </AppFeedbackProvider>
    </NNotificationProvider>
  </NConfigProvider>
</template>
