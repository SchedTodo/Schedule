import { describe, expect, it, vi } from 'vitest'

import { loadMainWindow } from '../../../src-electron/main/window'

describe('Electron main window loading', () => {
  it('loads the Web development server when a URL is provided', async () => {
    const window = { loadURL: vi.fn(async () => undefined), loadFile: vi.fn() }

    await loadMainWindow(window, 'http://localhost:5173', 'D:/app/dist-web/index.html')

    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173')
    expect(window.loadFile).not.toHaveBeenCalled()
  })

  it('loads dist-web in production', async () => {
    const window = { loadURL: vi.fn(), loadFile: vi.fn(async () => undefined) }

    await loadMainWindow(window, undefined, 'D:/app/dist-web/index.html')

    expect(window.loadFile).toHaveBeenCalledWith('D:/app/dist-web/index.html')
    expect(window.loadURL).not.toHaveBeenCalled()
  })
})
