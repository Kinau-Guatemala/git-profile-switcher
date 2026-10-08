import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadPathScopes, savePathScopes } from './pathScopes'

describe('path scopes the app added', () => {
  let dir: string
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })

  it('starts with nothing added and remembers what was', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-scopes-'))
    expect(await loadPathScopes(dir)).toEqual({ User: false, Machine: false })
    await savePathScopes(dir, { User: true, Machine: false })
    expect(await loadPathScopes(dir)).toEqual({ User: true, Machine: false })
  })
})
