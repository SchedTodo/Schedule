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
  </div>
</template>

<style scoped>
.help-page { padding: 6vh 8vw; }
dl { display: grid; grid-template-columns: 16rem 1fr; gap: 0.8rem 1.5rem; }
dt { font-weight: 700; }
</style>
