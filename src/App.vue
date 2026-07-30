<script setup lang="ts">
import { computed, inject, watch } from 'vue'
import { NConfigProvider } from 'naive-ui/es/config-provider'
import { NNotificationProvider } from 'naive-ui'
import { darkTheme } from 'naive-ui/es/themes'
import { dateEnUS, dateZhCN, enUS, zhCN } from 'naive-ui/es/locales'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { naiveThemeOverrides } from './app/naive-theme'
import AppFeedbackProvider from './app/components/AppFeedbackProvider.vue'
import AppShell from './app/components/AppShell.vue'
import { usePreferencesStore } from './stores/preferences'
import { useRuntimeStore } from './stores/runtime'
import { platformGatewayKey } from './app/injection-keys'

const preferences = usePreferencesStore()
const gateway = inject(platformGatewayKey)
const { locale } = useI18n()
const runtime = useRuntimeStore()
const route = useRoute()
const standalone = computed(() => route.meta.standalone === true)
runtime.init(preferences.calendarMode)
watch(
  () => preferences.locale,
  (value) => {
    locale.value = value
    void gateway?.settings.update({ locale: value })
  },
  { immediate: true }
)
const naiveLocale = computed(() => preferences.locale === 'zh-CN' ? zhCN : enUS)
const naiveDateLocale = computed(() =>
  preferences.locale === 'zh-CN' ? dateZhCN : dateEnUS
)
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
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <NNotificationProvider>
      <AppFeedbackProvider>
        <main
          data-testid="app-shell"
          :class="{ 'theme-dark': usesDarkTheme }"
        >
          <RouterView v-if="standalone" />
          <AppShell v-else />
        </main>
      </AppFeedbackProvider>
    </NNotificationProvider>
  </NConfigProvider>
</template>
