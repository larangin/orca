import type { PtyIpcSurface } from '../pty-host-bindings'
import type { PtyRendererDelivery } from '../session'
import {
  effectivePtyOwnerId,
  isMainWindowWebContents,
  liveMainWindows,
  notePtyOwner,
  ptyOwnerWebContents
} from '../../../window/main-window-registry'

// Only these say "this window is using that terminal"; every window reports on all it knows.
const CLAIMING_CHANNELS = new Set(['pty:spawn', 'pty:write', 'pty:writeAccepted', 'pty:resize'])
// A window's view of a terminal it does not show must not change how main delivers to the owner.
const OWNER_ONLY_CHANNELS = new Set([
  'pty:setActiveRendererPty',
  'pty:setHiddenRendererPty',
  'pty:setRendererPtyVisible',
  'pty:setPtyDeliveryInterest',
  'pty:reportGeometry',
  'pty:terminalViewAttributes'
])

/** Whether to run the listener; claims ownership on the way when the channel is a claim. */
function admitPtyEvent(
  channel: string,
  sender: Electron.WebContents | undefined,
  args: unknown[]
): boolean {
  const id = ptyIdOf(args[0])
  if (!id || !sender || !isMainWindowWebContents(sender)) {
    return true
  }
  if (CLAIMING_CHANNELS.has(channel)) {
    notePtyOwner(id, sender)
    return true
  }
  return effectivePtyOwnerId(id) === sender.id
}

function ptyIdOf(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const id = 'id' in payload ? payload.id : 'ptyId' in payload ? payload.ptyId : undefined
  return typeof id === 'string' ? id : null
}

function tracksOwnership(channel: string): boolean {
  return CLAIMING_CHANNELS.has(channel) || OWNER_ONLY_CHANNELS.has(channel)
}

/** Records which main window addresses each terminal, so its output can be routed back there. */
export function withPtyOwnerTracking(ipc: PtyIpcSurface): PtyIpcSurface {
  return {
    handle: (channel, listener) =>
      ipc.handle(
        channel,
        !tracksOwnership(channel)
          ? listener
          : (event, ...args) => {
              if (!admitPtyEvent(channel, event?.sender, args)) {
                return undefined
              }
              const result = listener(event, ...args)
              if (channel === 'pty:spawn') {
                void Promise.resolve(result).then(
                  (spawned) => {
                    const spawnedId = ptyIdOf(spawned)
                    const sender = event?.sender
                    if (spawnedId && sender && !sender.isDestroyed()) {
                      notePtyOwner(spawnedId, sender)
                    }
                  },
                  () => {}
                )
              }
              return result
            }
      ),
    on: (channel, listener) =>
      ipc.on(
        channel,
        !tracksOwnership(channel)
          ? listener
          : (event, ...args) => {
              if (admitPtyEvent(channel, event?.sender, args)) {
                listener(event, ...args)
              }
            }
      ),
    removeHandler: (channel) => ipc.removeHandler(channel),
    removeAllListeners: (channel) => ipc.removeAllListeners(channel)
  }
}

const primaryContentsByRoutedContents = new WeakMap<object, PtyRendererDelivery['webContents']>()

/** The real primary webContents behind a routed delivery, for sender identity checks. */
export function unwrapRoutedPtyWebContents(
  contents: PtyRendererDelivery['webContents']
): PtyRendererDelivery['webContents'] {
  return primaryContentsByRoutedContents.get(contents) ?? contents
}

/**
 * The primary window's delivery, except that a terminal's events go to the window that owns it.
 * ponytail: id-less events (delivery resync) stay on the primary; per-window flow control when it matters.
 */
export function routePtyDeliveryByOwner(primary: PtyRendererDelivery): PtyRendererDelivery {
  const primaryContents = primary.webContents
  const routedContents: PtyRendererDelivery['webContents'] = {
    id: primaryContents.id,
    isDestroyed: () => primaryContents.isDestroyed(),
    on: (event: never, listener: never) => primaryContents.on(event, listener),
    removeListener: (event: never, listener: never) =>
      primaryContents.removeListener(event, listener),
    send: (channel: string, ...args: unknown[]) => {
      const id = ptyIdOf(args[0])
      const owner = id ? ptyOwnerWebContents(id) : null
      if (owner && owner !== primaryContents) {
        owner.send(channel, ...args)
        return
      }
      primaryContents.send(channel, ...args)
    }
  }
  primaryContentsByRoutedContents.set(routedContents, primaryContents)
  return {
    isDestroyed: () => primary.isDestroyed(),
    isFocused: () => primary.isFocused() || liveMainWindows().some((window) => window.isFocused()),
    isVisible: () => primary.isVisible() || liveMainWindows().some((window) => window.isVisible()),
    isMinimized: () =>
      primary.isMinimized() && liveMainWindows().every((window) => window.isMinimized()),
    webContents: routedContents
  }
}
