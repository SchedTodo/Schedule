<script setup lang="ts">
import { NSelect, NSwitch } from 'naive-ui'

import type { Preferences } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()
const themeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' }
]
const calendarOptions = [
  { label: '月视图', value: 'month' },
  { label: '周视图', value: 'week' }
]
const weekStartOptions = [
  { label: '星期一', value: 1 },
  { label: '星期日', value: 0 }
]

function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  preferences.update({ [key]: value })
}
</script>

<template>
  <section class="settings-page">
    <RouterLink to="/">
      返回日程
    </RouterLink>
    <header>
      <p>Schedule v2</p>
      <h1>偏好设置</h1>
    </header>

    <div class="settings-grid">
      <div class="setting-field">
        <label id="theme-mode-label">主题</label>
        <NSelect
          :value="preferences.themeMode"
          :options="themeOptions"
          aria-labelledby="theme-mode-label"
          @update:value="update('themeMode', $event)"
        />
      </div>
      <div class="setting-field">
        <label id="calendar-mode-label">默认日历视图</label>
        <NSelect
          :value="preferences.calendarMode"
          :options="calendarOptions"
          aria-labelledby="calendar-mode-label"
          @update:value="update('calendarMode', $event)"
        />
      </div>
      <div class="setting-field">
        <label id="week-start-label">每周起始日</label>
        <NSelect
          :value="preferences.weekStart"
          :options="weekStartOptions"
          aria-labelledby="week-start-label"
          @update:value="update('weekStart', $event)"
        />
      </div>
      <div class="setting-field setting-toggle">
        <label id="density-label">紧凑密度</label>
        <NSwitch
          :value="preferences.compactDensity"
          aria-labelledby="density-label"
          @update:value="update('compactDensity', $event)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  display: grid;
  max-inline-size: 50rem;
  min-block-size: 100vh;
  padding: var(--space-6);
  margin-inline: auto;
  gap: var(--space-6);
}

header p,
header h1 {
  margin: 0;
}

.settings-grid,
.setting-field {
  display: grid;
  gap: var(--space-3);
}

.settings-grid {
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-medium);
  background: var(--color-surface);
  box-shadow: var(--elevation-surface);
}

.setting-toggle {
  align-items: center;
  grid-template-columns: 1fr auto;
}
</style>
