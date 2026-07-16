import { describe, expect, it, vi } from 'vitest'

import { ElectronExternalLink } from '../../../src-electron/adapters/electron-external-link'
import {
  createMainWindowOptions,
  installWindowOpenHandler,
  type WindowOpenHandler
} from '../../../src-electron/main/window'

describe('secure Electron window boundary', () => {
  it('creates the main window hidden with strict renderer isolation', () => {
    expect(createMainWindowOptions('D:/app/preload.js')).toMatchObject({
      show: false,
      webPreferences: {
        preload: 'D:/app/preload.js',
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false
      }
    })
  })

  it.each([
    'http://example.com',
    'file:///C:/secret.txt',
    'javascript:alert(1)',
    'data:text/plain,secret',
    'mailto:owner@example.com',
    'not a url'
  ])('rejects an unapproved external link: %s', async (value) => {
    const openExternal = vi.fn(async () => undefined)
    const links = new ElectronExternalLink({ openExternal })
    await expect(links.open(value)).rejects.toThrow()
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('opens an approved HTTPS link through the system shell', async () => {
    const openExternal = vi.fn(async () => undefined)
    const links = new ElectronExternalLink({ openExternal })
    await links.open('https://example.com/help')
    expect(openExternal).toHaveBeenCalledWith('https://example.com/help')
  })

  it('always denies Electron child windows and reports rejected links', async () => {
    let handler: WindowOpenHandler | undefined
    const open = vi.fn(async () => { throw new Error('blocked') })
    const reportError = vi.fn()
    installWindowOpenHandler(
      { setWindowOpenHandler: (value) => { handler = value } },
      { open },
      reportError
    )

    expect(handler?.({ url: 'file:///C:/secret.txt' })).toEqual({ action: 'deny' })
    await vi.waitFor(() => { expect(reportError).toHaveBeenCalledWith(expect.any(Error)) })
  })

  it('denies approved links inside Electron while delegating them externally', async () => {
    let handler: WindowOpenHandler | undefined
    const open = vi.fn(async () => undefined)
    const reportError = vi.fn()
    installWindowOpenHandler(
      { setWindowOpenHandler: (value) => { handler = value } },
      { open },
      reportError
    )

    expect(handler?.({ url: 'https://example.com/help' })).toEqual({ action: 'deny' })
    await vi.waitFor(() => { expect(open).toHaveBeenCalledWith('https://example.com/help') })
    expect(reportError).not.toHaveBeenCalled()
  })
})
