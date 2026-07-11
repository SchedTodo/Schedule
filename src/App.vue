<script setup lang="ts">
import { computed } from 'vue'
import { darkTheme, NConfigProvider } from 'naive-ui'

import { naiveThemeOverrides } from './app/naive-theme'
import { usePreferencesStore } from './stores/preferences'

const preferences = usePreferencesStore()
preferences.hydrate()
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
    <main
      data-testid="app-shell"
      :class="[{ 'theme-dark': usesDarkTheme, 'density-compact': preferences.compactDensity }]"
    >
      <RouterView />
    </main>
  </NConfigProvider>
</template>
