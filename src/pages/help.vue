<template>
  <div class="help-page">
    <h1>Help</h1>
    <h2>Keyboard Shortcuts</h2>
    <dl>
      <dt>Ctrl + Arrow Left / Right</dt><dd>Switch navigation pages</dd>
      <dt>Ctrl + Arrow Up</dt><dd>Open Add schedule dialog</dd>
      <dt>Ctrl + Arrow Down</dt><dd>Close Add schedule dialog</dd>
      <dt>Ctrl + Enter</dt><dd>Confirm Add schedule dialog</dd>
    </dl>
    <h2>Schedule Syntax</h2>
    <dl>
      <dt>Date</dt><dd><code>2026/7/12</code>, <code>7/12</code>, <code>tdy</code>, or <code>tmr</code></dd>
      <dt>Todo</dt><dd><code>2026/7/12 18:00</code></dd>
      <dt>Event</dt><dd><code>2026/7/12 10:00-11:00</code>; an earlier end hour crosses midnight</dd>
      <dt>Date range</dt><dd><code>2026/7/12-31 10:00 daily</code></dd>
      <dt>Frequency</dt><dd><code>daily</code>, <code>weekly</code>, <code>monthly</code>, or <code>yearly</code>; use <code>i2</code> for interval and <code>c5</code> for count</dd>
      <dt>Selectors</dt><dd><code>by[month[1,6],day[1,3],monthday[1,-1]]</code>; weekno, yearday, and setpos are also supported</dd>
      <dt>Time zone</dt><dd>Append an IANA zone such as <code>Asia/Shanghai</code></dd>
      <dt>Unknown time</dt><dd>Use <code>?</code> for an unknown hour or minute in event ranges</dd>
      <dt>Multiple rules</dt><dd>Separate statements with semicolons</dd>
      <dt>Exclusions</dt><dd>Use the exTime field to remove matching concrete occurrences</dd>
    </dl>
  </div>
</template>

<style scoped>
.help-page { padding: 6vh 8vw; }
dl { display: grid; grid-template-columns: 16rem 1fr; gap: 0.8rem 1.5rem; }
dt { font-weight: 700; }
</style>
