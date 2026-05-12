import { describe, expect, it } from 'vitest'
import { parseShowOrigin } from './originParser'

describe('parseShowOrigin', () => {
  it('parses git config --show-origin lines into structured entries', () => {
    const output = [
      'file:C:/Users/Admin/.gitconfig\tuser.name=Jane Dev',
      'file:C:/Users/Admin/.gitconfig-switcher\tuser.email=jane@example.com',
      'file:C:/Repos/app/.git/config\tcore.sshCommand=ssh -F ~/.ssh/config'
    ].join('\n')

    expect(parseShowOrigin(output)).toEqual([
      {
        originFile: 'C:/Users/Admin/.gitconfig',
        key: 'user.name',
        value: 'Jane Dev'
      },
      {
        originFile: 'C:/Users/Admin/.gitconfig-switcher',
        key: 'user.email',
        value: 'jane@example.com'
      },
      {
        originFile: 'C:/Repos/app/.git/config',
        key: 'core.sshCommand',
        value: 'ssh -F ~/.ssh/config'
      }
    ])
  })

  it('ignores empty or malformed lines', () => {
    const output = [
      '',
      'not-a-valid-line',
      'file:C:/Users/Admin/.gitconfig\tuser.name=Jane Dev'
    ].join('\n')

    expect(parseShowOrigin(output)).toEqual([
      {
        originFile: 'C:/Users/Admin/.gitconfig',
        key: 'user.name',
        value: 'Jane Dev'
      }
    ])
  })
})