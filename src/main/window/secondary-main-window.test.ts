import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {},
  BrowserWindow: class {},
  ipcMain: { on: vi.fn() },
  Menu: {},
  nativeTheme: {}
}))

import { secondaryWindowStartSession, withActiveRepo } from './secondary-main-window'
import type { WorkspaceSessionState } from '../../shared/workspace-session-state-types'

const session = {
  activeRepoId: 'other',
  activeWorkspaceKey: 'worktree:other::/other',
  activeWorktreeId: 'other::/other',
  activeTabId: 'tab-1',
  tabsByWorktree: {},
  terminalLayoutsByTabId: {},
  activeWorktreeIdsOnShutdown: ['other::/other']
} as WorkspaceSessionState

describe('secondaryWindowStartSession', () => {
  it('starts empty without an open repo', () => {
    expect(secondaryWindowStartSession(session)).toMatchObject({
      activeRepoId: null,
      activeWorkspaceKey: null,
      activeWorktreeId: null,
      activeTabId: null,
      activeWorktreeIdsOnShutdown: []
    })
  })

  it("starts on the open repo's primary worktree", () => {
    expect(secondaryWindowStartSession(session, { id: 'repo', path: '/src/app' })).toMatchObject({
      activeRepoId: 'repo',
      activeWorkspaceKey: 'worktree:repo::/src/app',
      activeWorktreeId: 'repo::/src/app',
      activeTabId: null,
      activeWorktreeIdsOnShutdown: []
    })
  })
})

describe('withActiveRepo', () => {
  it('opens the repo and keeps reconnect state and its last tab', () => {
    const opened = withActiveRepo(
      { ...session, activeTabIdByWorktree: { 'repo::/src/app': 'tab-9' } },
      { id: 'repo', path: '/src/app' }
    )
    expect(opened).toMatchObject({
      activeRepoId: 'repo',
      activeWorktreeId: 'repo::/src/app',
      activeTabId: 'tab-9',
      activeWorktreeIdsOnShutdown: ['other::/other']
    })
  })
})
