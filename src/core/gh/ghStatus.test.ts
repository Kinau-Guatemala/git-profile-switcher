import { describe, it, expect, afterEach } from 'vitest'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getGhStatus, parseGhAccounts, parseGhVersion } from './ghStatus'
import { extractMarkedPath } from './shellEnv'

describe.skipIf(process.platform === 'win32')('getGhStatus', () => {
  let dir: string
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })

  it('asks the gh binary it is given, not whatever `gh` is on PATH (which may be a broken wrapper)', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-ghstatus-'))
    const fake = join(dir, 'real gh')
    await writeFile(fake, [
      '#!/bin/sh',
      'if [ "$1" = --version ]; then echo "gh version 9.9.9 (fake)"; exit 0; fi',
      `echo '{"hosts":{"github.com":[{"login":"a","active":true},{"login":"b","active":false}]}}'`
    ].join('\n'))
    await chmod(fake, 0o755)

    expect(await getGhStatus({ ...process.env, PATH: '/nonexistent' }, fake)).toEqual({
      kind: 'ok', version: '9.9.9', accounts: [{ login: 'a', active: true }, { login: 'b', active: false }]
    })
  })

  it('reports missing when there is no real gh', async () => {
    expect(await getGhStatus(process.env, null)).toEqual({ kind: 'missing' })
  })
})

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
