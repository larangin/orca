import type { BrowserWindow, WebContents } from 'electron'

// Every open main window, primary first. More than one exists only with experimentalMultiWindow.
// Why no 'closed' listener: entries are pruned on read, so the window's teardown order is untouched.
const windows: BrowserWindow[] = []
// A terminal's output goes to the window that last opened, typed in or resized it.
const ptyOwnerByPtyId = new Map<string, number>()
// Folder a launcher opened a secondary window on, keyed by webContents id.
const openPathByWebContentsId = new Map<number, string>()

export function registerMainWindow(
  window: BrowserWindow,
  role: 'primary' | 'secondary' = 'secondary'
): void {
  // Why front: a primary reopened after closing must not sit behind secondaries and be treated as one.
  if (role === 'primary') {
    windows.unshift(window)
  } else {
    windows.push(window)
  }
}

export function liveMainWindows(): BrowserWindow[] {
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    // Why isDestroyed first: reading webContents off a destroyed BrowserWindow throws.
    if (windows[index].isDestroyed() || windows[index].webContents.isDestroyed()) {
      windows.splice(index, 1)
    }
  }
  return windows.slice()
}

export function isMainWindowWebContents(sender: WebContents): boolean {
  // Why registry first: test and headless senders are not full WebContents.
  return liveMainWindows().some((window) => window.webContents === sender) && !sender.isDestroyed()
}

export function isSecondaryMainWindowWebContents(sender: WebContents): boolean {
  return liveMainWindows()
    .slice(1)
    .some((window) => window.webContents === sender)
}

export function setMainWindowOpenPath(window: BrowserWindow, openPath: string): void {
  openPathByWebContentsId.set(window.webContents.id, openPath)
}

export function mainWindowOpenPath(sender: WebContents): string | null {
  return openPathByWebContentsId.get(sender.id) ?? null
}

/** The live main window (primary or secondary) a launcher already opened on this folder, if any. */
export function mainWindowForOpenPath(openPath: string): BrowserWindow | null {
  return (
    liveMainWindows().find(
      (window) => openPathByWebContentsId.get(window.webContents.id) === openPath
    ) ?? null
  )
}

export function notePtyOwner(ptyId: string, sender: WebContents): void {
  if (isMainWindowWebContents(sender)) {
    ptyOwnerByPtyId.set(ptyId, sender.id)
  }
}

export function ptyOwnerWebContents(ptyId: string): WebContents | null {
  const owner = ptyOwnerByPtyId.get(ptyId)
  if (owner === undefined) {
    return null
  }
  return liveMainWindows().find((window) => window.webContents.id === owner)?.webContents ?? null
}

/** The window that owns a terminal: its live claimant, else the primary. */
export function effectivePtyOwnerId(ptyId: string): number | null {
  return (ptyOwnerWebContents(ptyId) ?? liveMainWindows()[0]?.webContents ?? null)?.id ?? null
}

export function resetMainWindowRegistryForTest(): void {
  windows.length = 0
  ptyOwnerByPtyId.clear()
  openPathByWebContentsId.clear()
}
