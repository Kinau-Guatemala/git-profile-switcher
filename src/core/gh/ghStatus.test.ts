import { describe, it, expect } from 'vitest'
import { parseGhAccounts, parseGhVersion } from './ghStatus'
import { extractMarkedPath } from './shellEnv'

describe('parseGhAccounts', () => {
  it('reads github.com logins and the active flag', () => {
    const json = JSON.stringify({
      hosts: {
        'github.com': [
          { state: 'success', active: true, host: 'github.com', login: 'work', tokenSource: 'keyring', gitProtocol: 'ssh' },
          { state: 'success', active: false, host: 'github.com', login: 'personal', tokenSource: 'keyring', gitProtocol: 'ssh' }
        ],
        'ghe.example.com': [{ active: true, login: 'enterprise' }]
      }
    })
    expect(parseGhAccounts(json)).toEqual([
      { login: 'work', active: true },
      { login: 'personal', active: false }
    ])
  })

  it('returns no accounts when github.com is absent', () => {
    expect(parseGhAccounts('{"hosts":{}}')).toEqual([])
  })
})

describe('parseGhVersion', () => {
  it('extracts the version from gh --version', () => {
    expect(parseGhVersion('gh version 2.102.0 (2026-09-30)\nhttps://github.com/cli/cli/releases/tag/v2.102.0')).toBe('2.102.0')
  })
})

describe('extractMarkedPath', () => {
  it('ignores banner noise printed by an interactive login shell', () => {
    expect(extractMarkedPath('Welcome back!\n__GPS_PATH__/opt/homebrew/bin:/usr/bin__GPS_PATH__\nbye')).toBe('/opt/homebrew/bin:/usr/bin')
  })

  it('returns null when the marker is missing or empty', () => {
    expect(extractMarkedPath('nothing here')).toBeNull()
    expect(extractMarkedPath('__GPS_PATH____GPS_PATH__')).toBeNull()
  })
})
