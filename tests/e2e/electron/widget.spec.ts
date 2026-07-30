import { expect, test } from '@playwright/test'

import { closeSchedule, launchSchedule } from '../support/electron'

test('shows and controls the isolated today widget window', async () => {
  test.setTimeout(60_000)
  const launched = await launchSchedule({
    databasePath: ':memory:',
    widget: true,
    tray: true
  })
  try {
    await expect.poll(
      () => launched.application.windows().length,
      { timeout: 20_000 }
    ).toBe(2)
    const widget = launched.application.windows()
      .find((window) => window.url().includes('#/widget'))
    expect(widget).toBeDefined()
    if (!widget) return
    await launched.application.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((window) => !window.webContents.getURL().includes('#/widget'))
        ?.close()
    })

    await expect(widget.getByTestId('desktop-widget')).toBeVisible()
    await expect(widget.getByText('Today Todo')).toBeVisible()
    await expect(widget.getByText('Today Schedule')).toBeVisible()
    await expect(widget.getByTestId('week-view')).toBeVisible()

    const beforeResize = await launched.application.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('#/widget'))
        ?.getBounds()
    )
    const resizeHandle = widget.locator('[data-resize-edge="se"]')
    const resizeBox = await resizeHandle.boundingBox()
    expect(resizeBox).not.toBeNull()
    if (resizeBox && beforeResize) {
      await widget.mouse.move(resizeBox.x + 3, resizeBox.y + 3)
      await widget.mouse.down()
      await widget.mouse.move(resizeBox.x + 63, resizeBox.y + 43, { steps: 4 })
      await widget.mouse.up()
      await expect.poll(() => launched.application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) => window.webContents.getURL().includes('#/widget'))
          ?.getBounds()
      )).toMatchObject({
        width: beforeResize.width + 60,
        height: beforeResize.height + 40
      })
    }

    await widget.getByRole('button', { name: 'Passthrough' }).click()
    await expect.poll(() => widget.evaluate(() => ({
      content: getComputedStyle(document.querySelector('.widget-content')!).pointerEvents,
      actions: getComputedStyle(document.querySelector('.widget-window-actions')!).pointerEvents
    }))).toEqual({ content: 'none', actions: 'auto' })

    await widget.getByRole('button', { name: 'Always on top' }).click()
    await expect.poll(() => launched.application.evaluate(({ BrowserWindow }) => {
      const target = BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('#/widget'))
      return target?.isAlwaysOnTop()
    })).toBe(true)

    await widget.getByRole('button', { name: 'Hide' }).click()
    await expect.poll(() => launched.application.evaluate(({ BrowserWindow }) => {
      const target = BrowserWindow.getAllWindows()
        .find((window) => window.webContents.getURL().includes('#/widget'))
      return target?.isVisible()
    })).toBe(false)
  } finally {
    await closeSchedule(launched)
  }
})
