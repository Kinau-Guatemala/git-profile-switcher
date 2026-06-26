import { describe, it, expect, afterEach } from 'vitest'
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildManagedRegion,
  stripManagedRegion,
  stripManagedInclude,
  writeManagedRegion,
  REGION_START,
  REGION_END
} from './managedInclude'

describe('buildManagedRegion', () => {
  it('emits the global include before per-folder includeIf blocks', () => {
    const region = buildManagedRegion({
      includeGlobal: true,
      managedPath: '/home/u/.gitconfig-switcher',
      entries: [{ gitdir: '/home/u/Dev/work', configPath: '/data/folder-configs/abc.gitconfig' }]
    })

    const globalIdx = region.indexOf('path = /home/u/.gitconfig-switcher')
    const folderIdx = region.indexOf('[includeIf "gitdir:/home/u/Dev/work/"]')
    expect(globalIdx).toBeGreaterThan(-1)
    expect(folderIdx).toBeGreaterThan(globalIdx)
    expect(region.startsWith(REGION_START)).toBe(true)
    expect(region.trimEnd().endsWith(REGION_END)).toBe(true)
  })

  it('adds a trailing slash to gitdir paths', () => {
    const region = buildManagedRegion({
      includeGlobal: false,
      managedPath: '/x',
      entries: [{ gitdir: '/home/u/Dev/work', configPath: '/c.gitconfig' }]
    })
    expect(region).toContain('[includeIf "gitdir:/home/u/Dev/work/"]')
  })

  it('omits the global include when applyGlobally is off', () => {
    const region = buildManagedRegion({
      includeGlobal: false,
      managedPath: '/home/u/.gitconfig-switcher',
      entries: []
    })
    expect(region).not.toContain('[include]')
  })
})

describe('stripManagedRegion', () => {
  it('removes the marker region but preserves surrounding config', () => {
    const content = [
      '[user]',
      '\temail = me@example.com',
      REGION_START,
      '[include]',
      '\tpath = /x',
      REGION_END,
      '[fetch]',
      '\tprune = true'
    ].join('\n')

    const stripped = stripManagedRegion(content)
    expect(stripped).toContain('email = me@example.com')
    expect(stripped).toContain('prune = true')
    expect(stripped).not.toContain('[include]')
    expect(stripped).not.toContain(REGION_START)
  })
})

describe('stripManagedInclude (legacy)', () => {
  it('removes a bare managed [include] block from older versions', () => {
    const content = '[include]\n\tpath = /home/u/.gitconfig-switcher\n[user]\n\temail = a@b.c\n'
    const stripped = stripManagedInclude(content, '/home/u/.gitconfig-switcher')
    expect(stripped).not.toContain('.gitconfig-switcher')
    expect(stripped).toContain('email = a@b.c')
  })
})

describe('writeManagedRegion', () => {
  let home: string

  afterEach(async () => {
    if (home) await rm(home, { recursive: true, force: true })
  })

  it('appends the region at the end and is idempotent / replaceable', async () => {
    home = await mkdtemp(join(tmpdir(), 'gps-home-'))
    await writeFile(join(home, '.gitconfig'), '[user]\n\temail = me@example.com\n', 'utf-8')

    const r1 = buildManagedRegion({ includeGlobal: true, managedPath: join(home, '.gitconfig-switcher'), entries: [] })
    await writeManagedRegion(r1, 'end', home)
    let gc = await readFile(join(home, '.gitconfig'), 'utf-8')
    expect(gc).toContain('email = me@example.com')
    expect(gc.indexOf(REGION_START)).toBeGreaterThan(gc.indexOf('email = me@example.com'))

    // Re-applying a new region must replace, not duplicate.
    const r2 = buildManagedRegion({
      includeGlobal: false,
      managedPath: join(home, '.gitconfig-switcher'),
      entries: [{ gitdir: join(home, 'Dev/work'), configPath: '/c.gitconfig' }]
    })
    await writeManagedRegion(r2, 'end', home)
    gc = await readFile(join(home, '.gitconfig'), 'utf-8')
    expect(gc.split(REGION_START).length - 1).toBe(1)
    expect(gc).not.toContain('[include]\n')
    expect(gc).toContain('[includeIf "gitdir:')
  })
})
