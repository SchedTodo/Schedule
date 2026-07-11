import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const electronPackagePath = require.resolve('electron/package.json')
const installScriptPath = resolve(dirname(electronPackagePath), 'install.js')

const result = spawnSync(process.execPath, [installScriptPath], {
  env: {
    ...process.env,
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
  },
  stdio: 'inherit'
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
