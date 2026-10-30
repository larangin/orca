import { describe, expect, it } from 'vitest'
import {
  isSecondaryMainWindowWebContents,
  registerMainWindow,
  resetMainWindowRegistryForTest
} from './main-window-registry'

function fakeWindow() {
  const webContents = { isDestroyed: () => false }
  return { isDestroyed: () => false, webContents } as never as Electron.BrowserWindow
}

describe('main window registry', () => {
  it('keeps a primary reopened after secondaries out of the secondary set', () => {
    resetMainWindowRegistryForTest()
    const secondary = fakeWindow()
    const reopenedPrimary = fakeWindow()
    registerMainWindow(secondary)
    registerMainWindow(reopenedPrimary, 'primary')

    expect(isSecondaryMainWindowWebContents(reopenedPrimary.webContents)).toBe(false)
    expect(isSecondaryMainWindowWebContents(secondary.webContents)).toBe(true)
  })
})
