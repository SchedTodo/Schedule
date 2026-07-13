<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NCard, NInputNumber, NRadio, NRadioGroup, NSelect, NSwitch } from 'naive-ui'
import { platformGatewayKey } from '../app/injection-keys'
import { defaultSettings, type SettingsDto } from '../contracts/settings.contract'
import { createTimeZoneOptions } from '../features/settings/time-zone-options'
import type { Preferences } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()
const gateway = inject(platformGatewayKey)
const settings = ref<SettingsDto>({ ...defaultSettings })
const timeZoneOptions = computed(() => createTimeZoneOptions(settings.value.timeZone))
const weekStarts = [
  { label: 'MO', value: 1 },
  { label: 'TU', value: 2 },
  { label: 'WE', value: 3 },
  { label: 'TH', value: 4 },
  { label: 'FR', value: 5 },
  { label: 'SA', value: 6 },
  { label: 'SU', value: 7 }
] as const
if (gateway) {
  void gateway.settings.get().then((result) => {
    if (result.ok) settings.value = result.value
  })
}
function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  preferences.update({ [key]: value })
}
async function updateSetting<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]) {
  if (!gateway) return
  const result = await gateway.settings.update({ [key]: value })
  if (result.ok) settings.value = result.value
}
</script>

<template>
  <div class="settings-page">
    <NCard segmented>
      <template #header>
        <b>RRule</b>
      </template>
      <div class="settings-group">
        <label>Time Zone</label><div class="setting-field setting-field--select">
          <NSelect
            :value="settings.timeZone"
            :options="timeZoneOptions"
            filterable
            @update:value="updateSetting('timeZone', $event)"
          />
        </div>
        <label>WKST</label><div class="setting-field">
          <NRadioGroup
            :value="settings.weekStart"
            @update:value="updateSetting('weekStart', $event); update('weekStart', $event)"
          >
            <NRadio
              v-for="day in weekStarts"
              :key="day.value"
              :value="day.value"
            >
              {{ day.label }}
            </NRadio>
          </NRadioGroup>
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Alarm</b>
      </template>
      <div class="settings-group">
        <label>Todo</label><div class="setting-field">
          <NSwitch
            :value="settings.todoAlarmEnabled"
            @update:value="updateSetting('todoAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.todoAlarmBeforeMinutes"
            @update:value="updateSetting('todoAlarmBeforeMinutes', $event ?? 0)"
          /> minutes
        </div>
        <label>Event</label><div class="setting-field">
          <NSwitch
            :value="settings.eventAlarmEnabled"
            @update:value="updateSetting('eventAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.eventAlarmBeforeMinutes"
            @update:value="updateSetting('eventAlarmBeforeMinutes', $event ?? 0)"
          /> minutes
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Preferences</b>
      </template>
      <div class="settings-group">
        <label>Priority</label><div class="setting-field">
          <NRadioGroup
            :value="settings.calendarMode"
            @update:value="updateSetting('calendarMode', $event); update('calendarMode', $event)"
          >
            <NRadio value="month">
              MonthView
            </NRadio><NRadio value="week">
              WeekView
            </NRadio>
          </NRadioGroup>
        </div>
        <label>Week View Days</label><div class="setting-field">
          <NInputNumber
            :value="settings.weekViewDays"
            @update:value="updateSetting('weekViewDays', $event ?? 5)"
          />
        </div>
        <label>Week View Start Time</label><div class="setting-field setting-field--time">
          <NInputNumber
            :value="settings.logicalDayStartHour"
            @update:value="updateSetting('logicalDayStartHour', $event ?? 0)"
          /> : <NInputNumber
            :value="settings.logicalDayStartMinute"
            @update:value="updateSetting('logicalDayStartMinute', $event ?? 0)"
          />
        </div>
        <label>Open At Login</label><div class="setting-field">
          <NSwitch
            :value="settings.openAtLogin"
            @update:value="updateSetting('openAtLogin', $event)"
          />
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Pomodoro</b>
      </template>
      <div class="settings-group">
        <label>Focus Time</label><div class="setting-field">
          <NInputNumber
            :value="settings.focusMinutes"
            @update:value="updateSetting('focusMinutes', $event ?? 25)"
          /> minutes
        </div>
        <label>Small Break</label><div class="setting-field">
          <NInputNumber
            :value="settings.smallBreakMinutes"
            @update:value="updateSetting('smallBreakMinutes', $event ?? 5)"
          /> minutes
        </div>
        <label>Big Break</label><div class="setting-field">
          <NInputNumber
            :value="settings.bigBreakMinutes"
            @update:value="updateSetting('bigBreakMinutes', $event ?? 20)"
          /> minutes
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Appearance</b>
      </template>
      <div class="settings-group">
        <label>Theme</label><div class="setting-field setting-field--select">
          <NSelect
            :value="preferences.themeMode"
            :options="[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]"
            @update:value="update('themeMode', $event)"
          />
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 1rem; padding: 6vh 8vw; }
.settings-group { display: grid; grid-template-columns: 12rem minmax(0, 1fr); align-items: center; gap: 1rem 2rem; }
.settings-group > label { font-weight: 700; }
.setting-field { display: flex; align-items: center; justify-self: start; gap: 1rem; min-inline-size: 0; }
.setting-field--select { inline-size: 15rem; }
.setting-field :deep(.n-input-number) { inline-size: 8rem; }
.setting-field--time :deep(.n-input-number) { inline-size: 6rem; }
</style>
