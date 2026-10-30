import { describe, expect, it } from 'vitest'
import { launchWindowArgs } from './launch-window-args'

describe('launchWindowArgs', () => {
  it('reads the launcher path and title, keeping spaces', () => {
    expect(
      launchWindowArgs([
        'orca-ide',
        '--new-window',
        '--open-path=/src/app',
        '--window-title=Legacy Server'
      ])
    ).toEqual({ openPath: '/src/app', title: 'Legacy Server' })
  })

  it('ignores missing or empty values', () => {
    expect(launchWindowArgs(['orca-ide', '--open-path='])).toEqual({
      openPath: undefined,
      title: undefined
    })
  })
})
