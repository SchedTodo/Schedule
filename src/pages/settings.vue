<script setup lang="ts">
import { inject, ref } from 'vue'
import { NCard, NInputNumber, NRadio, NRadioGroup, NSelect, NSwitch } from 'naive-ui'
import { platformGatewayKey } from '../app/injection-keys'
import { defaultSettings, type SettingsDto } from '../contracts/settings.contract'
import type { Preferences } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'

const preferences = usePreferencesStore()
const gateway = inject(platformGatewayKey)
const settings = ref<SettingsDto>({ ...defaultSettings })
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
        <label>Time Zone</label><NSelect
          :value="settings.timeZone"
          :options="[{ label: 'UTC', value: 'UTC' }, { label: Intl.DateTimeFormat().resolvedOptions().timeZone, value: Intl.DateTimeFormat().resolvedOptions().timeZone }]"
          style="width: 15rem"
          @update:value="updateSetting('timeZone', $event)"
        />
        <label>WKST</label><NRadioGroup
          :value="settings.weekStart"
          @update:value="updateSetting('weekStart', $event); update('weekStart', $event)"
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
          <NSwitch
            :value="settings.todoAlarmEnabled"
            @update:value="updateSetting('todoAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.todoAlarmBeforeMinutes"
            @update:value="updateSetting('todoAlarmBeforeMinutes', $event ?? 0)"
          /> minutes
        </div>
        <label>Event</label><div>
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
        <label>Priority</label><NRadioGroup
          :value="settings.calendarMode"
          @update:value="updateSetting('calendarMode', $event); update('calendarMode', $event)"
        >
          <NRadio value="month">
            MonthView
          </NRadio><NRadio value="week">
            WeekView
          </NRadio>
        </NRadioGroup>
        <label>Week View Days</label><NInputNumber
          :value="settings.weekViewDays"
          @update:value="updateSetting('weekViewDays', $event ?? 5)"
        />
        <label>Week View Start Time</label><div>
          <NInputNumber
            :value="settings.logicalDayStartHour"
            @update:value="updateSetting('logicalDayStartHour', $event ?? 0)"
          /> : <NInputNumber
            :value="settings.logicalDayStartMinute"
            @update:value="updateSetting('logicalDayStartMinute', $event ?? 0)"
          />
        </div>
        <label>Open At Login</label><NSwitch
          :value="settings.openAtLogin"
          @update:value="updateSetting('openAtLogin', $event)"
        />
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>Pomodoro</b>
      </template>
      <div class="settings-group">
        <label>Focus Time</label><div>
          <NInputNumber
            :value="settings.focusMinutes"
            @update:value="updateSetting('focusMinutes', $event ?? 25)"
          /> minutes
        </div>
        <label>Small Break</label><div>
          <NInputNumber
            :value="settings.smallBreakMinutes"
            @update:value="updateSetting('smallBreakMinutes', $event ?? 5)"
          /> minutes
        </div>
        <label>Big Break</label><div>
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
