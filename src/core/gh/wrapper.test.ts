import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import {
  wrapperLayout, posixWrapper, cmdWrapper, readBakedRealGh, toMsysPath, pickRealGh,
  installWrapper, removeWrapper, pathHint, WRAPPER_MARKER
} from './wrapper'

describe('wrapperLayout', () => {
  it('uses ~/.local/bin/gh on posix', () => {
    expect(wrapperLayout('linux', '/home/u')).toEqual({ dir: '/home/u/.local/bin', files: [{ path: '/home/u/.local/bin/gh', kind: 'sh' }] })
  })

  it('uses LOCALAPPDATA with gh.cmd first and an sh twin for Git Bash on Windows', () => {
    const l = wrapperLayout('win32', 'C:\\Users\\u', 'C:\\Users\\u\\AppData\\Local')
    expect(l.dir).toBe('C:\\Users\\u\\AppData\\Local\\git-profile-switcher\\bin')
    expect(l.files.map(f => f.kind)).toEqual(['cmd', 'sh'])
    expect(l.files[0].path).toBe('C:\\Users\\u\\AppData\\Local\\git-profile-switcher\\bin\\gh.cmd')
  })
})

describe('wrapper contents', () => {
  it('round-trips a real gh path with spaces and quotes through the sh wrapper', () => {
    const real = "/opt/it's here/gh"
    const text = posixWrapper(real)
    expect(text).toContain(WRAPPER_MARKER)
    expect(readBakedRealGh(text)).toBe(real)
  })

  it('round-trips a Program Files path through the cmd wrapper', () => {
    const real = 'C:\\Program Files\\GitHub CLI\\gh.exe'
    const text = cmdWrapper(real)
    expect(text).toContain(WRAPPER_MARKER)
    expect(text).toContain('\r\n')
    expect(readBakedRealGh(text)).toBe(real)
  })

  it('converts Windows paths for Git Bash', () => {
    expect(toMsysPath('C:\\Program Files\\GitHub CLI\\gh.exe')).toBe('/c/Program Files/GitHub CLI/gh.exe')
  })
})

describe('pickRealGh', () => {
  it('skips the wrapper dir on posix', () => {
    expect(pickRealGh(['/home/u/.local/bin/gh', '/usr/bin/gh'], '/home/u/.local/bin', 'linux')).toBe('/usr/bin/gh')
  })

  it('prefers gh.exe outside the wrapper dir on Windows, case-insensitively', () => {
    const dir = 'C:\\Users\\u\\AppData\\Local\\git-profile-switcher\\bin'
    expect(pickRealGh([
      'c:\\users\\u\\appdata\\local\\git-profile-switcher\\bin\\gh.cmd',
      'C:\\Program Files\\GitHub CLI\\gh.exe'
    ], dir, 'win32')).toBe('C:\\Program Files\\GitHub CLI\\gh.exe')
  })

  it('returns null when only the wrapper is found', () => {
    expect(pickRealGh(['/home/u/.local/bin/gh'], '/home/u/.local/bin', 'linux')).toBeNull()
  })
})

describe('pathHint', () => {
  it('speaks the user shell', () => {
    expect(pathHint('/usr/bin/fish', '/home/u/.local/bin', 'linux')).toBe('fish_add_path -m /home/u/.local/bin')
    expect(pathHint('/bin/zsh', '/Users/u/.local/bin', 'darwin')).toBe(`echo 'export PATH="/Users/u/.local/bin:$PATH"' >> ~/.zshrc`)
    expect(pathHint('/bin/bash', '/Users/u/.local/bin', 'darwin')).toContain('~/.bash_profile')
  })
})

describe.skipIf(process.platform === 'win32')('install / remove on disk', () => {
  let home: string
  afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }) })

  it('refuses to overwrite a gh that is not ours, and remove leaves it alone', async () => {
    home = await mkdtemp(join(tmpdir(), 'gps-home-'))
    const layout = wrapperLayout('linux', home)
    await mkdir(layout.dir, { recursive: true })
    await writeFile(layout.files[0].path, 'REAL GH BINARY', 'utf-8')

    await expect(installWrapper(layout, process.env, 'linux')).rejects.toThrow(/not managed by Git Profile Switcher/)
    await removeWrapper(layout)
    expect(await readFile(layout.files[0].path, 'utf-8')).toBe('REAL GH BINARY')
  })
})

describe.skipIf(process.platform === 'win32')('sh wrapper behaviour', () => {
  let root: string
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  async function setup() {
    root = await mkdtemp(join(tmpdir(), 'gps wrap '))  // space on purpose
    const fakeGh = join(root, 'real gh')
    await writeFile(fakeGh, [
      '#!/bin/sh',
      'if [ "$1 $2" = "auth token" ]; then echo "token-for-$4"; exit 0; fi',
      'echo "GH_TOKEN=$GH_TOKEN ARGS=$*"'
    ].join('\n'))
    await chmod(fakeGh, 0o755)
    const wrapper = join(root, 'gh')
    await writeFile(wrapper, posixWrapper(fakeGh))
    await chmod(wrapper, 0o755)
    const repo = join(root, 'repo')
    await mkdir(repo)
    await execa('git', ['init', '-q'], { cwd: repo })
    await execa('git', ['config', 'profileswitcher.ghUser', 'alice'], { cwd: repo })
    const env = { PATH: process.env.PATH, HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
    return { wrapper, repo, env }
  }

  it('injects the linked account token inside a mapped repo', async () => {
    const { wrapper, repo, env } = await setup()
    const { stdout } = await execa(wrapper, ['api', 'user'], { cwd: repo, env, extendEnv: false })
    expect(stdout).toBe('GH_TOKEN=token-for-alice ARGS=api user')
  })

  it('passes through outside any mapping', async () => {
    const { wrapper, env } = await setup()
    const { stdout } = await execa(wrapper, ['api', 'user'], { cwd: root, env, extendEnv: false })
    expect(stdout).toBe('GH_TOKEN= ARGS=api user')
  })

  it('never overrides a token already in the environment', async () => {
    const { wrapper, repo, env } = await setup()
    const { stdout } = await execa(wrapper, ['pr', 'list'], { cwd: repo, env: { ...env, GH_TOKEN: 'preset' }, extendEnv: false })
    expect(stdout).toBe('GH_TOKEN=preset ARGS=pr list')
  })

  it('leaves gh auth commands untouched', async () => {
    const { wrapper, repo, env } = await setup()
    const { stdout } = await execa(wrapper, ['auth', 'status'], { cwd: repo, env, extendEnv: false })
    expect(stdout).toBe('GH_TOKEN= ARGS=auth status')
  })
})
