import { translateMain } from '../i18n/main-i18n'
import { createAppMenuQuitItems, type AppMenuQuitHandlers } from './app-menu-quit-item'

/** File menu: New Window when multi-window is on; Settings and Quit off macOS (the app menu has them there). */
export function createAppFileMenu(
  args: AppMenuQuitHandlers & {
    isMac: boolean
    settingsItem: Electron.MenuItemConstructorOptions
    onNewWindow?: () => void
  }
): Electron.MenuItemConstructorOptions {
  const newWindow: Electron.MenuItemConstructorOptions[] = args.onNewWindow
    ? [{ label: translateMain('menu.newWindow', 'New Window'), click: args.onNewWindow }]
    : []
  const rest: Electron.MenuItemConstructorOptions[] = [
    args.settingsItem,
    { type: 'separator' },
    ...createAppMenuQuitItems(args)
  ]
  return {
    label: translateMain('menu.file', 'File'),
    submenu: args.isMac
      ? newWindow
      : newWindow.length > 0
        ? [...newWindow, { type: 'separator' }, ...rest]
        : rest
  }
}
