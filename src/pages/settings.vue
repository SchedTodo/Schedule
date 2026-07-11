<script setup lang="ts">
import { NCard, NRadio, NRadioGroup, NSelect, NSwitch } from 'naive-ui'
import type { Preferences } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()
function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  preferences.update({ [key]: value })
}
</script>

<template>
  <div class="legacy-settings">
    <NCard segmented>
      <template #header>
        <b>Appearance</b>
      </template>
      <div class="settings-group">
        <label>Theme</label>
        <NSelect
          :value="preferences.themeMode"
          :options="[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]"
          style="width: 15rem"
          @update:value="update('themeMode', $event)"
        />
        <label>Compact Density</label>
        <NSwitch
          :value="preferences.compactDensity"
          @update:value="update('compactDensity', $event)"
        />
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Preferences</b>
      </template>
      <div class="settings-group">
        <label>Priority</label>
        <NRadioGroup
          :value="preferences.calendarMode"
          @update:value="update('calendarMode', $event)"
        >
          <NRadio value="month">
            MonthView
          </NRadio><NRadio value="week">
            WeekView
          </NRadio>
        </NRadioGroup>
        <label>WKST</label>
        <NRadioGroup
          :value="preferences.weekStart"
          @update:value="update('weekStart', $event)"
        >
          <NRadio :value="1">
            MO
          </NRadio><NRadio :value="0">
            SU
          </NRadio>
        </NRadioGroup>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.legacy-settings { display: flex; flex-direction: column; gap: 1rem; padding: 6vh 8vw; }
.settings-group { display: grid; grid-template-columns: 12rem 1fr; align-items: center; gap: 1rem 2rem; }
.settings-group > label { font-weight: 700; }
</style>
