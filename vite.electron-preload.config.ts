import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: fileURLToPath(new URL('./dist-electron/preload', import.meta.url)),
    emptyOutDir: true,
    target: 'node24',
    lib: {
      entry: fileURLToPath(new URL('./src-electron/preload/index.ts', import.meta.url)),
      formats: ['cjs'],
      fileName: () => 'index.cjs'
    },
    rollupOptions: {
      external: [/^electron$/, /^node:/]
    }
  }
})
