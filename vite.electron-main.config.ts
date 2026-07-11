import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: fileURLToPath(new URL('./dist-electron/main', import.meta.url)),
    emptyOutDir: true,
    target: 'node24',
    lib: {
      entry: fileURLToPath(new URL('./src-electron/main/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'index.mjs'
    },
    rollupOptions: {
      external: [/^electron$/, /^node:/, /^better-sqlite3$/]
    }
  }
})
