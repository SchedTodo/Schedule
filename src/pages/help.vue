<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="help-page">
    <h1>{{ t('help.title') }}</h1>
    <h2>{{ t('help.keyboard') }}</h2>
    <dl>
      <dt>Ctrl + Arrow Left / Right</dt><dd>{{ t('help.navigation') }}</dd>
      <dt>Ctrl + Arrow Up</dt><dd>{{ t('help.openAdd') }}</dd>
      <dt>Ctrl + Arrow Down</dt><dd>{{ t('help.closeAdd') }}</dd>
      <dt>Ctrl + Enter</dt><dd>{{ t('help.confirmAdd') }}</dd>
      <dt>Ctrl + 1/2/3/4/5/6/7</dt><dd>{{ t('help.insertWeekday') }}</dd>
    </dl>
    <h2>{{ t('help.syntax') }}</h2>
    <dl>
      <dt>{{ t('help.date') }}</dt><dd>{{ t('help.dateExamples', { full: '2026/7/12', short: '7/12' }) }}</dd>
      <dt>{{ t('help.todo') }}</dt><dd><code>2026/7/12 18:00</code></dd>
      <dt>{{ t('help.event') }}</dt><dd>{{ t('help.eventDescription', { example: '2026/7/12 10:00-11:00' }) }}</dd>
      <dt>{{ t('help.currentTime') }}</dt><dd>{{ t('help.nowDescription') }}</dd>
      <dt>{{ t('help.duration') }}</dt><dd>{{ t('help.durationDescription') }}</dd>
      <dt>{{ t('help.dateRange') }}</dt><dd><code>2026/7/12-31 10:00 daily</code></dd>
      <dt>{{ t('help.frequency') }}</dt><dd>{{ t('help.frequencyDescription') }}</dd>
      <dt>{{ t('help.selectors') }}</dt><dd>{{ t('help.selectorsDescription') }}</dd>
      <dt>{{ t('help.timeZone') }}</dt><dd>{{ t('help.timeZoneDescription') }}</dd>
      <dt>{{ t('help.unknownTime') }}</dt><dd>{{ t('help.unknownDescription') }}</dd>
      <dt>{{ t('help.multipleRules') }}</dt><dd>{{ t('help.multipleDescription') }}</dd>
      <dt>{{ t('help.exclusions') }}</dt><dd>{{ t('help.exclusionsDescription') }}</dd>
    </dl>
  </div>
</template>

<style scoped>
.help-page { padding: 6vh 8vw; }
dl { display: grid; grid-template-columns: 16rem 1fr; gap: 0.8rem 1.5rem; }
dt { font-weight: 700; }
</style>
