<script setup lang="ts">
import { NCard, NInputNumber, NRadio, NRadioGroup, NSelect, NSwitch } from 'naive-ui'
import type { Preferences } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()
function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  preferences.update({ [key]: value })
}
</script>

<template>
  <div class="settings-page">
    <NCard segmented>
      <template #header>
        <b>RRule</b>
      </template>
      <div class="settings-group">
        <label>Time Zone</label><NSelect
          value="Local"
          :options="[{ label: 'Local', value: 'Local' }]"
          disabled
          style="width: 15rem"
        />
        <label>WKST</label><NRadioGroup
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
    <NCard segmented>
      <template #header>
        <b>Alarm</b>
      </template>
      <div class="settings-group">
        <label>Todo</label><div>
          <NSwitch disabled /> <NInputNumber
            :value="1"
            disabled
          /> : <NInputNumber
            :value="0"
            disabled
          />
        </div>
        <label>Event</label><div>
          <NSwitch disabled /> <NInputNumber
            :value="0"
            disabled
          /> : <NInputNumber
            :value="15"
            disabled
          />
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Preferences</b>
      </template>
      <div class="settings-group">
        <label>Priority</label><NRadioGroup
          :value="preferences.calendarMode"
          @update:value="update('calendarMode', $event)"
        >
          <NRadio value="month">
            MonthView
          </NRadio><NRadio value="week">
            WeekView
          </NRadio>
        </NRadioGroup>
        <label>Week View Days</label><NInputNumber
          :value="5"
          disabled
        />
        <label>Week View Start Time</label><div>
          <NInputNumber
            :value="0"
            disabled
          /> : <NInputNumber
            :value="0"
            disabled
          />
        </div>
        <label>Open At Login</label><NSwitch disabled />
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Pomodoro</b>
      </template>
      <div class="settings-group">
        <label>Focus Time</label><div>
          <NInputNumber
            :value="0"
            disabled
          /> : <NInputNumber
            :value="25"
            disabled
          />
        </div>
        <label>Small Break</label><div>
          <NInputNumber
            :value="0"
            disabled
          /> : <NInputNumber
            :value="5"
            disabled
          />
        </div>
        <label>Big Break</label><div>
          <NInputNumber
            :value="0"
            disabled
          /> : <NInputNumber
            :value="20"
            disabled
          />
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Appearance</b>
      </template>
      <div class="settings-group">
        <label>Theme</label><NSelect
          :value="preferences.themeMode"
          :options="[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]"
          style="width: 15rem"
          @update:value="update('themeMode', $event)"
        />
        <label>Compact Density</label><NSwitch
          :value="preferences.compactDensity"
          @update:value="update('compactDensity', $event)"
        />
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 0.75rem; padding: 6vh 8vw; }
.settings-group { display: grid; grid-template-columns: 12rem 1fr; align-items: center; gap: 0.8rem 2rem; }
.settings-group > label { font-weight: 700; }
.settings-group > div { display: flex; align-items: center; gap: 0.5rem; }
.settings-group :deep(.n-input-number) { inline-size: 5rem; }
</style>
