import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { shFolderMap, cmdFolderMap, writeGhFolderMaps, GH_FOLDER_MAP, GH_FOLDER_MAP_CMD } from './folderMap'

describe('shFolderMap', () => {
  it('writes login<TAB>folder lines, "-" for no account, without trailing slashes', () => {
    expect(shFolderMap([
      { dir: '/home/u/work/', login: 'work-acct' },
      { dir: '/home/u/José repos', login: '' }
    ], 'linux')).toBe('work-acct\t/home/u/work\n-\t/home/u/José repos\n')
  })

  it('uses Git Bash paths on Windows', () => {
    expect(shFolderMap([{ dir: 'C:\\Users\\José\\Dev\\work\\', login: 'w' }], 'win32')).toBe('w\t/c/Users/José/Dev/work\n')
  })
})

describe('cmdFolderMap', () => {
  const env = { USERPROFILE: 'C:\\Users\\José' }

  it('writes length<TAB>login<TAB>folder with user folders as %VAR%', () => {
    // "C:\Users\José\Dev\work" is 22 chars: the batch file compares the first
    // 23 characters of "%CD%\" against "folder\".
    expect(cmdFolderMap([{ dir: 'C:\\Users\\José\\Dev\\work', login: 'w' }], env))
      .toBe('23\tw\t%USERPROFILE%\\Dev\\work\r\n')
  })

  it('skips folders cmd could not read and marks no account with "-"', () => {
    expect(cmdFolderMap([
      { dir: 'D:\\Año\\repos', login: 'w' },
      { dir: 'D:\\repos\\', login: '' }
    ], env)).toBe('9\t-\tD:\\repos\r\n')
  })
})

describe('writeGhFolderMaps', () => {
  let home: string
  afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }) })
  const exists = (p: string) => stat(p).then(() => true, () => false)

  it('writes the map with resolved folder paths when any folder has an account', async () => {
    home = await mkdtemp(join(tmpdir(), 'gps-map-'))
    const work = join(home, 'work')
    await mkdir(work)
    await writeGhFolderMaps(home, [{ dir: work, login: 'w' }], process.platform, {})
    const text = await readFile(join(home, GH_FOLDER_MAP), 'utf-8')
    // Resolved like `pwd -P`, so a symlinked tmp (macOS /var → /private/var) still
    // matches; Git Bash paths (/c/…) on Windows, which also gets the cmd twin.
    expect(text).toMatch(/^w\t\/.*\/work\n$/)
    expect(await exists(join(home, GH_FOLDER_MAP_CMD))).toBe(process.platform === 'win32')
  })

  it('removes the maps when no folder has an account', async () => {
    home = await mkdtemp(join(tmpdir(), 'gps-map-'))
    await writeFile(join(home, GH_FOLDER_MAP), 'old\t/x\n')
    await writeGhFolderMaps(home, [{ dir: '/x', login: '' }], 'linux', {})
    expect(await exists(join(home, GH_FOLDER_MAP))).toBe(false)
  })
})
