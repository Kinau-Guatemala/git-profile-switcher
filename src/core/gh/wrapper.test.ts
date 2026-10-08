import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, chmod, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import {
  wrapperLayout, posixWrapper, cmdWrapper, readBakedRealGh, toMsysPath, pickRealGh,
  installWrapper, removeWrapper, pathHint, findRealGh, findGhCandidates, cmdSafePath, WRAPPER_MARKER
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

  it('leaves the gh auth commands that refuse GH_TOKEN untouched', async () => {
    const { wrapper, repo, env } = await setup()
    for (const sub of ['login', 'logout', 'switch', 'refresh']) {
      const { stdout } = await execa(wrapper, ['auth', sub], { cwd: repo, env, extendEnv: false })
      expect(stdout).toBe(`GH_TOKEN= ARGS=auth ${sub}`)
    }
  })

  it('answers gh auth token and status as the linked account', async () => {
    const { wrapper, repo, env } = await setup()
    const { stdout } = await execa(wrapper, ['auth', 'status'], { cwd: repo, env, extendEnv: false })
    expect(stdout).toBe('GH_TOKEN=token-for-alice ARGS=auth status')
  })

  it('skips the token lookup for shell completion and help', async () => {
    const { wrapper, repo, env } = await setup()
    for (const args of [['__complete', 'pr', ''], ['completion', '-s', 'bash'], ['help'], ['--version']]) {
      const { stdout } = await execa(wrapper, args, { cwd: repo, env, extendEnv: false })
      expect(stdout).toBe(`GH_TOKEN= ARGS=${args.join(' ')}`)
    }
  })

  // Documents a known limit: includeIf gitdir only applies inside a repo, so a
  // mapped folder that isn't itself a repo falls back to the global profile.
  it('follows the global profile in a mapped folder that is not a git repo', async () => {
    const { wrapper, env } = await setup()
    const work = join(root, 'work')
    await mkdir(join(work, 'repo'), { recursive: true })
    await execa('git', ['init', '-q'], { cwd: join(work, 'repo') })
    const workConfig = join(root, 'work.gitconfig')
    const globalConfig = join(root, 'global.gitconfig')
    await writeFile(workConfig, '[profileswitcher]\n\tghUser = work-acct\n')
    await writeFile(globalConfig, `[profileswitcher]\n\tghUser = personal-acct\n[includeIf "gitdir:${work}/"]\n\tpath = ${workConfig}\n`)
    const withGlobal = { ...env, GIT_CONFIG_GLOBAL: globalConfig }

    const inRepo = await execa(wrapper, ['api', 'user'], { cwd: join(work, 'repo'), env: withGlobal, extendEnv: false })
    expect(inRepo.stdout).toBe('GH_TOKEN=token-for-work-acct ARGS=api user')
    const inFolder = await execa(wrapper, ['api', 'user'], { cwd: work, env: withGlobal, extendEnv: false })
    expect(inFolder.stdout).toBe('GH_TOKEN=token-for-personal-acct ARGS=api user')
  })
})

describe.skipIf(process.platform === 'win32')('findGhCandidates', () => {
  let root: string
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  it('walks PATH itself (no `which`), keeping only executable gh files', async () => {
    root = await mkdtemp(join(tmpdir(), 'gps-path-'))
    const [accented, plain, other] = ['José bin', 'plain', 'other'].map(d => join(root, d))
    for (const d of [accented, plain, other]) await mkdir(d)
    await writeFile(join(accented, 'gh'), '#!/bin/sh\n')
    await chmod(join(accented, 'gh'), 0o755)
    await writeFile(join(plain, 'gh'), 'not executable')
    await writeFile(join(other, 'gh'), '#!/bin/sh\n')
    await chmod(join(other, 'gh'), 0o755)

    // No /usr/bin on PATH, so `which` itself can't be found.
    expect(await findGhCandidates({ PATH: [accented, plain, join(root, 'missing'), other].join(':') }, 'linux'))
      .toEqual([join(accented, 'gh'), join(other, 'gh')])
  })
})

describe('cmdSafePath', () => {
  it('bakes non-ASCII profile folders as variables cmd expands at run time', () => {
    const env = { USERPROFILE: 'C:\\Users\\José', LOCALAPPDATA: 'C:\\Users\\José\\AppData\\Local' }
    expect(cmdSafePath('C:\\Users\\José\\scoop\\shims\\gh.exe', env)).toBe('%USERPROFILE%\\scoop\\shims\\gh.exe')
    expect(cmdSafePath('c:\\users\\josé\\appdata\\local\\Programs\\gh.exe', env)).toBe('%LOCALAPPDATA%\\Programs\\gh.exe')
  })

  it('leaves ASCII paths alone and refuses what cmd would misread', () => {
    expect(cmdSafePath('C:\\Program Files\\GitHub CLI\\gh.exe', {})).toBe('C:\\Program Files\\GitHub CLI\\gh.exe')
    expect(() => cmdSafePath('D:\\Herramientas\\Año\\gh.exe', {})).toThrow(/non-ASCII/)
  })
})

describe.skipIf(process.platform === 'win32')('findRealGh', () => {
  let root: string
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  it('never picks the wrapper reached through a symlinked directory', async () => {
    root = await mkdtemp(join(tmpdir(), 'gps-real-'))
    const wrapperDir = join(root, 'local-bin')
    const alias = join(root, 'bin-alias')
    const realDir = join(root, 'real')
    await mkdir(wrapperDir)
    await mkdir(realDir)
    await writeFile(join(wrapperDir, 'gh'), posixWrapper('/nowhere/gh'))
    await chmod(join(wrapperDir, 'gh'), 0o755)
    await writeFile(join(realDir, 'gh'), '#!/bin/sh\necho real\n')
    await chmod(join(realDir, 'gh'), 0o755)
    await symlink(wrapperDir, alias)

    const env = { ...process.env, PATH: `${alias}:${realDir}:/usr/bin:/bin` }
    expect(await findRealGh(env, wrapperDir, 'linux')).toBe(join(realDir, 'gh'))
  })
})

describe('cmd wrapper text', () => {
  it('clears an inherited GPS_GH_USER and only bypasses the auth commands that refuse GH_TOKEN', () => {
    const text = cmdWrapper('C:\\gh.exe')
    expect(text).toContain('set "GPS_GH_USER="')
    expect(text).not.toMatch(/if \/i "%~1"=="auth" goto run/)
    expect(text).toContain('if /i "%~2"=="switch" goto run')
    expect(text).toContain('if /i "%~1"=="__complete" goto run')
  })
})

describe.skipIf(process.platform !== 'win32')('cmd wrapper behaviour (Windows)', () => {
  let root: string
  afterEach(async () => { if (root) await rm(root, { recursive: true, force: true }) })

  async function setup() {
    root = await mkdtemp(join(tmpdir(), 'gps cmd '))
    const realDir = join(root, 'Program Files', 'GitHub CLI')
    await mkdir(realDir, { recursive: true })
    const fakeGh = join(realDir, 'gh.cmd')
    await writeFile(fakeGh, [
      '@echo off',
      'if "%~1 %~2"=="auth token" (echo token-for-%~4& exit /b 0)',
      'echo GH_TOKEN=%GH_TOKEN% ARGS=%*'
    ].join('\r\n'))
    const wrapper = join(root, 'gh.cmd')
    await writeFile(wrapper, cmdWrapper(fakeGh))
    const repo = join(root, 'repo')
    await mkdir(repo)
    await execa('git', ['init', '-q'], { cwd: repo })
    await execa('git', ['config', 'profileswitcher.ghUser', 'alice'], { cwd: repo })
    const env = { ...process.env, GH_TOKEN: '', GITHUB_TOKEN: '', GIT_CONFIG_GLOBAL: join(root, 'none'), GIT_CONFIG_NOSYSTEM: '1' }
    return { wrapper, repo, env }
  }

  it('injects the linked token through a Program Files path with spaces', async () => {
    const { wrapper, repo, env } = await setup()
    const { stdout } = await execa('cmd', ['/c', wrapper, 'api', 'user'], { cwd: repo, env })
    expect(stdout.trim()).toBe('GH_TOKEN=token-for-alice ARGS=api user')
  })

  it('ignores a GPS_GH_USER inherited from the environment', async () => {
    const { wrapper, env } = await setup()
    const { stdout } = await execa('cmd', ['/c', wrapper, 'api', 'user'], { cwd: root, env: { ...env, GPS_GH_USER: 'mallory' } })
    expect(stdout.trim()).toBe('GH_TOKEN= ARGS=api user')
  })

  it('runs a real gh under a non-ASCII user profile', async () => {
    const { repo, env } = await setup()
    const profile = join(root, 'José')
    await mkdir(join(profile, 'scoop'), { recursive: true })
    const fakeGh = join(profile, 'scoop', 'gh.cmd')
    await writeFile(fakeGh, [
      '@echo off',
      'if "%~1 %~2"=="auth token" (echo token-for-%~4& exit /b 0)',
      'echo GH_TOKEN=%GH_TOKEN% ARGS=%*'
    ].join('\r\n'))
    const profileEnv = { ...env, USERPROFILE: profile }
    const wrapper = join(root, 'gh-jose.cmd')
    await writeFile(wrapper, cmdWrapper(cmdSafePath(fakeGh, profileEnv)))

    const { stdout } = await execa('cmd', ['/c', wrapper, 'api', 'user'], { cwd: repo, env: profileEnv })
    expect(stdout.trim()).toBe('GH_TOKEN=token-for-alice ARGS=api user')
  })

  it('finds gh.exe in a non-ASCII PATH directory', async () => {
    await setup()
    const dir = join(root, 'José', 'bin')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'gh.exe'), '')
    expect(await findGhCandidates({ Path: dir }, 'win32')).toEqual([join(dir, 'gh.exe')])
  })
})
