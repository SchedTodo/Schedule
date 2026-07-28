<script setup lang="ts">
import { computed, h, inject, ref } from 'vue'
import {
  NButton,
  NCard,
  NDataTable,
  NInput,
  NInputNumber,
  NRadio,
  NRadioGroup,
  NSelect,
  NSwitch,
  type DataTableColumns
} from 'naive-ui'
import { useOperationFeedback } from '../app/app-feedback'
import { platformGatewayKey } from '../app/injection-keys'
import { defaultSettings, type SettingsDto } from '../contracts/settings.contract'
import { createTimeZoneOptions } from '../features/settings/time-zone-options'
import type { Preferences } from '../stores/preferences'
import { usePreferencesStore } from '../stores/preferences'
import { useI18n } from 'vue-i18n'
import type { SupportedLocale } from '../i18n/locale'

const preferences = usePreferencesStore()
const { t, locale } = useI18n()
const { showResult } = useOperationFeedback()
const gateway = inject(platformGatewayKey)
const settings = ref<SettingsDto>({ ...defaultSettings })
const timeZoneOptions = computed(() => createTimeZoneOptions(settings.value.timeZone))
const abbreviation = ref('')
const abbreviationTimeZone = ref('UTC')
interface TimeZoneAbbreviationRow {
  readonly abbreviation: string
  readonly timeZone: string
}
const abbreviationRows = computed<TimeZoneAbbreviationRow[]>(() =>
  Object.entries(settings.value.timeZoneAbbreviations)
    .map(([value, timeZone]) => ({ abbreviation: value, timeZone }))
    .sort((left, right) => left.abbreviation.localeCompare(right.abbreviation))
)
const abbreviationColumns = computed<DataTableColumns<TimeZoneAbbreviationRow>>(() => [
  { title: t('settings.abbreviation'), key: 'abbreviation' },
  { title: t('settings.ianaTimeZone'), key: 'timeZone' },
  {
    title: t('common.action'),
    key: 'actions',
    render: (row) => h(
      NButton,
      { size: 'small', onClick: () => { void removeAbbreviation(row.abbreviation) } },
      { default: () => t('common.delete') }
    )
  }
])
const weekStarts = computed(() => Array.from({ length: 7 }, (_, index) => ({
  label: new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(2024, 0, index + 1))),
  value: index + 1
})))
const localeOptions = computed(() => [
  { label: t('appearance.english'), value: 'en-US' },
  { label: t('appearance.simplifiedChinese'), value: 'zh-CN' }
])
const themeOptions = computed(() => [
  { label: t('appearance.system'), value: 'system' },
  { label: t('appearance.light'), value: 'light' },
  { label: t('appearance.dark'), value: 'dark' }
])
if (gateway) {
  void gateway.settings.get().then((result) => {
    if (showResult(result)) settings.value = result.value
  })
}
function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
  preferences.update({ [key]: value })
}
function updateLocale(value: SupportedLocale) {
  preferences.update({ locale: value })
  locale.value = value
}
/** 持久化单项应用设置，并仅在宿主确认成功后更新页面状态。 */
async function updateSetting<K extends keyof SettingsDto>(key: K, value: SettingsDto[K]) {
  if (!gateway) return false
  const result = await gateway.settings.update({ [key]: value })
  if (showResult(result)) settings.value = result.value
  return result.ok
}
async function addAbbreviation() {
  const key = abbreviation.value.trim().toUpperCase()
  if (
    key === '' ||
    abbreviationTimeZone.value === '' ||
    Object.hasOwn(settings.value.timeZoneAbbreviations, key)
  ) return
  const updated = {
    ...settings.value.timeZoneAbbreviations,
    [key]: abbreviationTimeZone.value
  }
  if (await updateSetting('timeZoneAbbreviations', updated)) abbreviation.value = ''
}
async function removeAbbreviation(value: string) {
  const updated = Object.fromEntries(
    Object.entries(settings.value.timeZoneAbbreviations)
      .filter(([key]) => key !== value)
  )
  await updateSetting('timeZoneAbbreviations', updated)
}
</script>

<template>
  <div class="settings-page">
    <NCard segmented>
      <template #header>
        <b>RRule</b>
      </template>
      <div class="settings-group">
        <label>{{ t('settings.timeZone') }}</label><div class="setting-field setting-field--select">
          <NSelect
            :value="settings.timeZone"
            :options="timeZoneOptions"
            filterable
            @update:value="updateSetting('timeZone', $event)"
          />
        </div>
        <label>{{ t('settings.timeZoneAbbreviations') }}</label><div class="setting-field setting-field--abbreviations">
          <div class="abbreviation-editor">
            <NInput
              v-model:value="abbreviation"
              :maxlength="32"
              :aria-label="t('settings.timeZoneAbbreviation')"
              :placeholder="t('settings.abbreviation')"
            />
            <NSelect
              v-model:value="abbreviationTimeZone"
              :options="timeZoneOptions"
              :aria-label="t('settings.abbreviationIana')"
              filterable
            />
            <NButton @click="addAbbreviation">
              {{ t('common.add') }}
            </NButton>
          </div>
          <NDataTable
            :columns="abbreviationColumns"
            :data="abbreviationRows"
            :pagination="false"
            :row-key="(row: TimeZoneAbbreviationRow) => row.abbreviation"
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
        <b>{{ t('settings.alarm') }}</b>
      </template>
      <div class="settings-group">
        <label>{{ t('common.todo') }}</label><div class="setting-field">
          <NSwitch
            :value="settings.todoAlarmEnabled"
            @update:value="updateSetting('todoAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.todoAlarmBeforeMinutes"
            @update:value="updateSetting('todoAlarmBeforeMinutes', $event ?? 0)"
          /> {{ t('settings.minutes') }}
        </div>
        <label>{{ t('common.event') }}</label><div class="setting-field">
          <NSwitch
            :value="settings.eventAlarmEnabled"
            @update:value="updateSetting('eventAlarmEnabled', $event)"
          />
          <NInputNumber
            :value="settings.eventAlarmBeforeMinutes"
            @update:value="updateSetting('eventAlarmBeforeMinutes', $event ?? 0)"
          /> {{ t('settings.minutes') }}
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>{{ t('settings.preferences') }}</b>
      </template>
      <div class="settings-group">
        <label>{{ t('settings.priority') }}</label><div class="setting-field">
          <NRadioGroup
            :value="settings.calendarMode"
            @update:value="updateSetting('calendarMode', $event); update('calendarMode', $event)"
          >
            <NRadio value="month">
              {{ t('settings.monthView') }}
            </NRadio><NRadio value="week">
              {{ t('settings.weekView') }}
            </NRadio>
          </NRadioGroup>
        </div>
        <label>{{ t('settings.weekViewDays') }}</label><div class="setting-field">
          <NInputNumber
            :value="settings.weekViewDays"
            @update:value="updateSetting('weekViewDays', $event ?? 5)"
          />
        </div>
        <label>{{ t('settings.weekViewStartTime') }}</label><div class="setting-field setting-field--time">
          <NInputNumber
            :value="settings.logicalDayStartHour"
            @update:value="updateSetting('logicalDayStartHour', $event ?? 0)"
          /> : <NInputNumber
            :value="settings.logicalDayStartMinute"
            @update:value="updateSetting('logicalDayStartMinute', $event ?? 0)"
          />
        </div>
        <label>{{ t('settings.openAtLogin') }}</label><div class="setting-field">
          <NSwitch
            :value="settings.openAtLogin"
            @update:value="updateSetting('openAtLogin', $event)"
          />
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>{{ t('settings.pomodoro') }}</b>
      </template>
      <div class="settings-group">
        <label>{{ t('settings.focusTime') }}</label><div class="setting-field">
          <NInputNumber
            :value="settings.focusMinutes"
            @update:value="updateSetting('focusMinutes', $event ?? 25)"
          /> {{ t('settings.minutes') }}
        </div>
        <label>{{ t('settings.smallBreak') }}</label><div class="setting-field">
          <NInputNumber
            :value="settings.smallBreakMinutes"
            @update:value="updateSetting('smallBreakMinutes', $event ?? 5)"
          /> {{ t('settings.minutes') }}
        </div>
        <label>{{ t('settings.bigBreak') }}</label><div class="setting-field">
          <NInputNumber
            :value="settings.bigBreakMinutes"
            @update:value="updateSetting('bigBreakMinutes', $event ?? 20)"
          /> {{ t('settings.minutes') }}
        </div>
      </div>
    </NCard>
    <NCard segmented>
      <template #header>
        <b>{{ t('appearance.appearance') }}</b>
      </template>
      <div class="settings-group">
        <label>{{ t('appearance.language') }}</label><div class="setting-field setting-field--select">
          <NSelect
            :value="preferences.locale"
            :options="localeOptions"
            @update:value="updateLocale"
          />
        </div>
        <label>{{ t('appearance.theme') }}</label><div class="setting-field setting-field--select">
          <NSelect
            :value="preferences.themeMode"
            :options="themeOptions"
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
.setting-field--abbreviations { align-items: stretch; flex-direction: column; inline-size: min(50rem, 100%); }
.abbreviation-editor { display: grid; grid-template-columns: 10rem minmax(15rem, 1fr) auto; gap: 0.75rem; }
.setting-field :deep(.n-input-number) { inline-size: 8rem; }
.setting-field--time :deep(.n-input-number) { inline-size: 6rem; }
</style>
