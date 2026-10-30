import { app, BrowserWindow, ipcMain, Menu, nativeTheme, type IpcMainEvent } from 'electron'
import { join } from 'node:path'
import {
  isSecondaryMainWindowWebContents,
  liveMainWindows,
  registerMainWindow
} from './main-window-registry'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'
import {
  MIN_HEIGHT,
  MIN_WIDTH,
  TITLEBAR_CSS_CENTER,
  TRAFFIC_LIGHT_RADIUS,
  TRAFFIC_LIGHT_X
} from './main-window-visual-lifecycle'

export const SECONDARY_WINDOW_ROLE_QUERY = 'orcaWindowRole'
const CASCADE_OFFSET = { x: 48, y: 44 }

/** Bounds a step down-right of the window the user is in, so the new one never hides it. */
function cascadedBounds(): Electron.Rectangle {
  const anchor =
    liveMainWindows().find((window) => window.isFocused()) ?? liveMainWindows().at(-1) ?? null
  const base = anchor?.getBounds() ?? { x: 80, y: 80, width: 1200, height: 800 }
  return {
    x: base.x + CASCADE_OFFSET.x,
    y: base.y + CASCADE_OFFSET.y,
    width: Math.max(MIN_WIDTH, base.width - CASCADE_OFFSET.x),
    height: Math.max(MIN_HEIGHT, base.height - CASCADE_OFFSET.y)
  }
}

let titlebarControlsInstalled = false

/** Linux/Windows custom titlebar buttons for secondary windows; the primary's handlers ignore them. */
function installSecondaryTitlebarControls(): void {
  if (titlebarControlsInstalled) {
    return
  }
  titlebarControlsInstalled = true
  const forSender =
    (action: (window: BrowserWindow) => void) =>
    (event: IpcMainEvent): void => {
      if (!isSecondaryMainWindowWebContents(event.sender)) {
        return
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      if (window && !window.isDestroyed()) {
        action(window)
      }
    }
  ipcMain.on(
    'window:minimize',
    forSender((window) => window.minimize())
  )
  ipcMain.on(
    'window:maximize',
    forSender((window) => (window.isMaximized() ? window.unmaximize() : window.maximize()))
  )
  // Why plain close: a secondary window owns no session, so it skips the primary's confirm flow.
  ipcMain.on(
    'window:request-close',
    forSender((window) => window.close())
  )
  ipcMain.on(
    'menu:popup',
    forSender((window) => Menu.getApplicationMenu()?.popup({ window }))
  )
}

/** File > New Window: one more main window on the same profile, starting with no workspace open. */
export function createSecondaryMainWindow(): BrowserWindow {
  installSecondaryTitlebarControls()
  const window = new BrowserWindow({
    ...cascadedBounds(),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    title: 'Orca',
    show: false,
    acceptFirstMouse: true,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#ffffff',
    titleBarStyle:
      process.platform === 'darwin'
        ? 'hiddenInset'
        : process.platform === 'win32'
          ? 'hidden'
          : undefined,
    ...(process.platform === 'linux' ? { frame: false } : {}),
    ...(process.platform === 'darwin'
      ? {
          trafficLightPosition: {
            x: TRAFFIC_LIGHT_X,
            y: TITLEBAR_CSS_CENTER - TRAFFIC_LIGHT_RADIUS
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      webviewTag: true
    }
  })
  registerMainWindow(window)
  window.once('ready-to-show', () => window.show())
  // Keeps the custom maximize button's icon in sync, as the primary's state lifecycle does.
  window.on('maximize', () => window.webContents.send('window:maximize-changed', true))
  window.on('unmaximize', () => window.webContents.send('window:maximize-changed', false))
  const query = { [SECONDARY_WINDOW_ROLE_QUERY]: 'secondary' }
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    const url = new URL(process.env.ELECTRON_RENDERER_URL)
    url.searchParams.set(SECONDARY_WINDOW_ROLE_QUERY, 'secondary')
    void window.loadURL(url.toString())
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }
  return window
}

/** What a secondary window starts from: every workspace's tabs, none open and nothing to reconnect. */
export function secondaryWindowStartSession(session: WorkspaceSessionState): WorkspaceSessionState {
  return {
    ...session,
    activeRepoId: null,
    activeWorkspaceKey: null,
    activeWorktreeId: null,
    activeTabId: null,
    activeWorktreeIdsOnShutdown: [],
    activeConnectionIdsAtShutdown: []
  }
}
