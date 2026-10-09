# GitHub CLI Account per Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link each profile to a github.com `gh` account, make `gh` use that account per folder through a PATH wrapper, and optionally block `gh auth switch` in six coding agents — all managed from a new GitHub CLI tab.

**Architecture:** The profile's `ghUser` is written as `profileswitcher.ghUser` into the gitconfig files the app already generates, so `git config --get` resolves it per folder via the existing `includeIf`. A tiny `gh` shim placed ahead of the real binary reads that key and runs the real gh with `GH_TOKEN` from `gh auth token --user`. Agent rules are pure content/merge functions plus a thin filesystem layer; everything is wired through new IPC handlers into one React screen.

**Tech Stack:** Electron 28 + React + TypeScript, zod, execa 8, vitest 1. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-07-gh-account-per-profile-design.md`

## Global Constraints

- git config key: `profileswitcher.ghUser`. github.com only.
- Wrapper and generated files carry the marker `Managed by Git Profile Switcher`. Never overwrite or delete a file that lacks it.
- Never write an agent config file that is not plain JSON; show a manual snippet instead. Writes are atomic (temp + rename).
- Agent rule = block `gh auth switch` only. Agents: Claude Code, Codex, Cursor, Copilot CLI, Gemini CLI, OpenCode.
- Platforms: Linux, macOS, Windows. Linux/macOS wrapper at `~/.local/bin/gh`; Windows at `%LOCALAPPDATA%\git-profile-switcher\bin\` (`gh.cmd` + `gh` sh for Git Bash).
- The app never edits shell rc files; on Linux/macOS it shows a PATH hint.
- No new npm dependencies. Code, comments, UI copy in English.
- Commits: conventional style, **no `Co-Authored-By` or any attribution line**. Stage explicit paths only — `graphify-out/` is rewritten by a git hook and is committed separately at the end.
- Commands run from the worktree root. Tests: `npm run test:run`; types: `npm run typecheck`.

## Review Focus

- Editing a profile in the Profiles tab after linking a gh account → the link survives (`ProfileForm` rebuilds `advanced` from scratch). Test in Task 1.
- App launched from the desktop (macOS launchd PATH lacks Homebrew/`~/.local/bin`; login shell prints a banner) → gh is still found via the login shell's PATH. Test in Task 2.
- A file already at the wrapper location that is not ours (e.g. gh itself installed in `~/.local/bin`) → install refuses and leaves it untouched; remove never deletes it. Test in Task 3.
- Paths with spaces or quotes (`~/.config/Git Profile Switcher/…`, `C:\Program Files\GitHub CLI\gh.exe`) in the wrapper and hook commands → still run. Tests in Tasks 3 and 5.
- Re-applying an agent rule, or applying over a config with the user's own rules → idempotent, foreign entries preserved, removal restores them exactly. Tests in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/profiles/schema.ts` (modify) | `ghUser` field |
| `src/core/git/identity.ts` (modify) | write `profileswitcher.ghUser` |
| `src/core/gh/profileLink.ts` (create) | keep/set a profile's `ghUser` |
| `src/core/gh/shellEnv.ts` (create) | login-shell PATH for GUI launches |
| `src/core/gh/ghStatus.ts` (create) | gh version + accounts |
| `src/core/gh/wrapper.ts` (create) | wrapper content, layout, install/remove/status, PATH hint |
| `src/core/gh/windowsPath.ts` (create) | Windows registry PATH read/prepend/remove (UAC for Machine) |
| `src/core/agents/rules.ts` (create) | pure: guard scripts, own-file contents, JSON merges |
| `src/core/agents/agents.ts` (create) | fs: status/apply/remove per agent |
| `src/main/ghIpc.ts` (create) | IPC for the tab |
| `src/main/ipc.ts` (modify) | register gh IPC, keep `ghUser` on profile update |
| `src/preload/index.ts` (modify) | `api.gh`, `api.agents` |
| `src/renderer/screens/GitHubCLI.tsx` (create) | the tab |
| `src/renderer/App.tsx` (modify) | nav link + route |
| `.github/workflows/ci.yml` (modify) | OS matrix for tests |
| `README.md` (modify) | feature docs |

---

### Task 1: Profile data — `ghUser` written per folder and preserved on edit

**Files:**
- Modify: `src/core/profiles/schema.ts:3-9`
- Modify: `src/core/git/identity.ts` (inside `applyProfile`, after the `github.sshHost` write)
- Create: `src/core/gh/profileLink.ts`
- Modify: `src/main/ipc.ts` (`profiles:update` handler)
- Test: `src/core/git/identity.test.ts`, `src/core/gh/profileLink.test.ts`

**Interfaces:**
- Produces: `ProfileAdvanced.ghUser?: string`; `keepGhUser(existing: Profile, input: ProfileInput): ProfileInput`; `setProfileGhUser(profiles: Profile[], profileId: string, login: string | null, now: string): Profile[]`

- [ ] **Step 1: Install dependencies in the worktree**

Run: `npm ci`
Expected: completes; `node_modules/` exists.

- [ ] **Step 2: Write the failing tests**

Append to `src/core/git/identity.test.ts` (inside the existing `describe('applyProfile', …)`, reusing its `dir`/`afterEach`; add `import { runGit } from './gitRunner'` at the top):

```ts
  it('writes profileswitcher.ghUser when the profile links a gh account', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-'))
    const managed = join(dir, '.git-profile-switcher')
    const p = makeProfile({ label: 'p', advanced: { ghUser: 'octo-cat' } })

    await applyProfile(p, managed, [p])

    const { stdout } = await runGit(['config', '--file', managed, '--get', 'profileswitcher.ghUser'])
    expect(stdout.trim()).toBe('octo-cat')
  })

  it('omits profileswitcher.ghUser when no gh account is linked', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-'))
    const managed = join(dir, '.git-profile-switcher')
    const p = makeProfile({ label: 'p' })

    await applyProfile(p, managed, [p])

    expect(await readFile(managed, 'utf-8')).not.toContain('profileswitcher')
  })
```

Create `src/core/gh/profileLink.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { keepGhUser, setProfileGhUser } from './profileLink'
import { Profile } from '../profiles/schema'

const base: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  label: 'Work',
  userName: 'x',
  userEmail: 'x@example.com',
  advanced: { sshHost: 'github.com-work', ghUser: 'work-login' },
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z'
}

describe('keepGhUser', () => {
  it('keeps the linked gh account when the profile form omits it', () => {
    const input = { label: 'Work', userName: 'y', userEmail: 'y@example.com', advanced: { sshHost: 'github.com-work' } }
    expect(keepGhUser(base, input).advanced).toEqual({ sshHost: 'github.com-work', ghUser: 'work-login' })
  })

  it('keeps it even when the form sends no advanced block at all', () => {
    const input = { label: 'Work', userName: 'y', userEmail: 'y@example.com' }
    expect(keepGhUser(base, input).advanced).toEqual({ ghUser: 'work-login' })
  })

  it('returns the input untouched when nothing was linked', () => {
    const input = { label: 'Work', userName: 'y', userEmail: 'y@example.com' }
    expect(keepGhUser({ ...base, advanced: undefined }, input)).toBe(input)
  })
})

describe('setProfileGhUser', () => {
  it('links and unlinks an account, stamping updatedAt', () => {
    const now = '2026-10-07T00:00:00.000Z'
    const linked = setProfileGhUser([{ ...base, advanced: undefined }], base.id, 'octo', now)
    expect(linked[0].advanced).toEqual({ ghUser: 'octo' })
    expect(linked[0].updatedAt).toBe(now)

    const unlinked = setProfileGhUser(linked, base.id, null, now)
    expect(unlinked[0].advanced).toBeUndefined()
  })

  it('keeps other advanced settings when unlinking', () => {
    const out = setProfileGhUser([base], base.id, null, base.updatedAt)
    expect(out[0].advanced).toEqual({ sshHost: 'github.com-work' })
  })

  it('throws for an unknown profile', () => {
    expect(() => setProfileGhUser([base], 'nope', 'x', base.updatedAt)).toThrow('Profile not found')
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/core/git/identity.test.ts src/core/gh/profileLink.test.ts`
Expected: FAIL — `profileLink` module not found; the `ghUser` test fails (key absent).

- [ ] **Step 4: Implement**

In `src/core/profiles/schema.ts`, add to `ProfileAdvancedSchema`:

```ts
  hosts: z.array(z.string()).optional(),
  ghUser: z.string().optional()
```

In `src/core/git/identity.ts`, right after the `if (sshHost) { … 'github.sshHost' … }` block inside `if (profile.advanced)`:

```ts
    // Read by the gh wrapper (git config --get profileswitcher.ghUser) so gh
    // follows the same per-folder includes as the git identity.
    if (profile.advanced.ghUser) {
      await runGit(['config', '--file', managedPath, 'profileswitcher.ghUser', profile.advanced.ghUser])
    }
```

Create `src/core/gh/profileLink.ts`:

```ts
import { Profile, ProfileAdvanced, ProfileInput } from '../profiles/schema'

/**
 * The gh account link is owned by the GitHub CLI tab; the profile form rebuilds
 * `advanced` without it. Carry the existing link over unless the input sets one.
 */
export function keepGhUser(existing: Profile, input: ProfileInput): ProfileInput {
  const ghUser = existing.advanced?.ghUser
  if (!ghUser || input.advanced?.ghUser !== undefined) return input
  return { ...input, advanced: { ...input.advanced, ghUser } }
}

export function setProfileGhUser(
  profiles: Profile[],
  profileId: string,
  login: string | null,
  now: string
): Profile[] {
  if (!profiles.some(p => p.id === profileId)) throw new Error('Profile not found')
  return profiles.map(p => {
    if (p.id !== profileId) return p
    const advanced: ProfileAdvanced = { ...p.advanced }
    if (login) advanced.ghUser = login
    else delete advanced.ghUser
    return { ...p, advanced: Object.keys(advanced).length ? advanced : undefined, updatedAt: now }
  })
}
```

In `src/main/ipc.ts`, `profiles:update`: import `keepGhUser` from `'../core/gh/profileLink'` and spread the merged input instead of `input`:

```ts
      const updated: Profile = {
        ...existing,
        ...keepGhUser(existing, input),
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
      }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/core/git/identity.test.ts src/core/gh/profileLink.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/profiles/schema.ts src/core/git/identity.ts src/core/git/identity.test.ts src/core/gh/profileLink.ts src/core/gh/profileLink.test.ts src/main/ipc.ts
git commit -m "feat(profiles): link a gh account per profile via profileswitcher.ghUser"
```

---

### Task 2: gh detection (login-shell PATH, version, accounts)

**Files:**
- Create: `src/core/gh/shellEnv.ts`, `src/core/gh/ghStatus.ts`
- Test: `src/core/gh/ghStatus.test.ts`

**Interfaces:**
- Produces:
  - `extractMarkedPath(stdout: string): string | null`
  - `userShellEnv(): Promise<NodeJS.ProcessEnv>`
  - `interface GhAccount { login: string; active: boolean }`
  - `type GhStatus = { kind: 'missing' } | { kind: 'unsupported'; version: string } | { kind: 'ok'; version: string; accounts: GhAccount[] }`
  - `parseGhVersion(stdout: string): string`, `parseGhAccounts(json: string): GhAccount[]`, `getGhStatus(env: NodeJS.ProcessEnv): Promise<GhStatus>`

The minimum gh version is detected by capability, not number: if `gh auth status --json hosts` fails, status is `unsupported` and the tab asks to upgrade.

- [ ] **Step 1: Write the failing test**

Create `src/core/gh/ghStatus.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/core/gh/ghStatus.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `src/core/gh/shellEnv.ts`:

```ts
import { execa } from 'execa'

const MARK = '__GPS_PATH__'

export function extractMarkedPath(stdout: string): string | null {
  const m = stdout.match(new RegExp(`${MARK}([\\s\\S]*?)${MARK}`))
  return m && m[1] ? m[1] : null
}

/**
 * Apps launched from the desktop (macOS launchd, some Linux sessions) don't get
 * the PATH the user's terminal has, so Homebrew's or ~/.local/bin's gh would be
 * invisible. Ask the user's login shell for its PATH. Not cached on purpose:
 * the tab re-checks after the user follows the PATH hint.
 */
export async function userShellEnv(): Promise<NodeJS.ProcessEnv> {
  if (process.platform === 'win32') return process.env
  const shell = process.env.SHELL || '/bin/sh'
  try {
    const { stdout } = await execa(shell, ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`], { timeout: 5000 })
    const path = extractMarkedPath(stdout)
    return path ? { ...process.env, PATH: path } : process.env
  } catch {
    return process.env
  }
}
```

Create `src/core/gh/ghStatus.ts`:

```ts
import { execa } from 'execa'

export interface GhAccount {
  login: string
  active: boolean
}

export type GhStatus =
  | { kind: 'missing' }
  | { kind: 'unsupported'; version: string }
  | { kind: 'ok'; version: string; accounts: GhAccount[] }

export function parseGhVersion(stdout: string): string {
  return stdout.match(/gh version (\S+)/)?.[1] ?? 'unknown'
}

export function parseGhAccounts(json: string): GhAccount[] {
  const entries: unknown = JSON.parse(json)?.hosts?.['github.com']
  if (!Array.isArray(entries)) return []
  return entries
    .filter((e): e is { login: string; active?: boolean } => typeof e?.login === 'string')
    .map(e => ({ login: e.login, active: e.active === true }))
}

export async function getGhStatus(env: NodeJS.ProcessEnv): Promise<GhStatus> {
  let version: string
  try {
    version = parseGhVersion((await execa('gh', ['--version'], { env })).stdout)
  } catch {
    return { kind: 'missing' }
  }
  try {
    // `auth` is passed through untouched by our own wrapper, so this always
    // reports gh's real logins.
    const { stdout } = await execa('gh', ['auth', 'status', '--json', 'hosts'], { env })
    return { kind: 'ok', version, accounts: parseGhAccounts(stdout) }
  } catch {
    return { kind: 'unsupported', version }
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/core/gh/ghStatus.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Smoke-check against the real gh (Linux/macOS dev machine)**

Run: `npx tsx -e "import('./src/core/gh/ghStatus.ts').then(async m => console.log(JSON.stringify(await m.getGhStatus(process.env))))"` (if `tsx` is unavailable, skip; the IPC smoke test in Task 7 covers it)
Expected: `{"kind":"ok","version":"…","accounts":[…]}` listing your logins.

- [ ] **Step 6: Commit**

```bash
git add src/core/gh/shellEnv.ts src/core/gh/ghStatus.ts src/core/gh/ghStatus.test.ts
git commit -m "feat(gh): detect gh, its version and github.com accounts"
```

---

### Task 3: The `gh` wrapper — content, install, remove, status

**Files:**
- Create: `src/core/gh/wrapper.ts`
- Test: `src/core/gh/wrapper.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (env is passed in).
- Produces:
  - `WRAPPER_MARKER = 'Managed by Git Profile Switcher'`
  - `interface WrapperFile { path: string; kind: 'sh' | 'cmd' }`, `interface WrapperLayout { dir: string; files: WrapperFile[] }` (`files[0]` is the primary file: `gh` on posix, `gh.cmd` on Windows)
  - `wrapperLayout(platform: NodeJS.Platform, home: string, localAppData?: string): WrapperLayout`
  - `shQuote(s: string): string`, `toMsysPath(p: string): string`
  - `posixWrapper(realGh: string): string`, `cmdWrapper(realGh: string): string`, `readBakedRealGh(content: string): string | null`
  - `pickRealGh(candidates: string[], wrapperDir: string, platform: NodeJS.Platform): string | null`
  - `findGhCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<string[]>`
  - `interface WrapperStatus { dir: string; installed: boolean; foreignFile: string | null; realGh: string | null; realGhExists: boolean; firstGh: string | null }`
  - `wrapperStatus(layout: WrapperLayout, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<WrapperStatus>`
  - `installWrapper(layout: WrapperLayout, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<string>` (returns the baked real gh path)
  - `removeWrapper(layout: WrapperLayout): Promise<void>`
  - `pathHint(shell: string | undefined, dir: string, platform: NodeJS.Platform): string`

- [ ] **Step 1: Write the failing tests**

Create `src/core/gh/wrapper.test.ts`:

```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/core/gh/wrapper.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/core/gh/wrapper.ts`:

```ts
import { execa } from 'execa'
import { chmod, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { posix, win32 } from 'node:path'

export const WRAPPER_MARKER = 'Managed by Git Profile Switcher'

export interface WrapperFile { path: string; kind: 'sh' | 'cmd' }
export interface WrapperLayout { dir: string; files: WrapperFile[] }

export interface WrapperStatus {
  dir: string
  /** Every layout file exists and carries the marker. */
  installed: boolean
  /** A file without our marker sits where the wrapper goes. */
  foreignFile: string | null
  /** Real gh path baked into the installed wrapper. */
  realGh: string | null
  realGhExists: boolean
  /** What `gh` resolves to on PATH right now (posix only; Windows uses the registry). */
  firstGh: string | null
}

export function wrapperLayout(platform: NodeJS.Platform, home: string, localAppData?: string): WrapperLayout {
  if (platform === 'win32') {
    const dir = win32.join(localAppData ?? win32.join(home, 'AppData', 'Local'), 'git-profile-switcher', 'bin')
    return {
      dir,
      files: [
        { path: win32.join(dir, 'gh.cmd'), kind: 'cmd' }, // cmd.exe / PowerShell
        { path: win32.join(dir, 'gh'), kind: 'sh' }       // Git Bash, which coding agents use
      ]
    }
  }
  const dir = posix.join(home, '.local', 'bin')
  return { dir, files: [{ path: posix.join(dir, 'gh'), kind: 'sh' }] }
}

export function shQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

export function toMsysPath(p: string): string {
  const m = p.match(/^([A-Za-z]):[\\/](.*)$/)
  return m ? `/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : p.replace(/\\/g, '/')
}

export function posixWrapper(realGh: string): string {
  return `#!/bin/sh
# ${WRAPPER_MARKER} - do not edit.
# Runs gh as the account linked to the profile for the current folder
# (git config profileswitcher.ghUser). A token already in the env always wins.
REAL_GH=${shQuote(realGh)}
if [ -z "$GH_TOKEN$GITHUB_TOKEN" ] && [ "$1" != auth ]; then
  u=$(git config --get profileswitcher.ghUser 2>/dev/null)
  if [ -n "$u" ]; then
    t=$("$REAL_GH" auth token --user "$u" 2>/dev/null) && [ -n "$t" ] && GH_TOKEN=$t && export GH_TOKEN
  fi
fi
exec "$REAL_GH" "$@"
`
}

export function cmdWrapper(realGh: string): string {
  return [
    '@echo off',
    `rem ${WRAPPER_MARKER} - do not edit.`,
    'setlocal',
    `set "REAL_GH=${realGh}"`,
    'if not "%GH_TOKEN%%GITHUB_TOKEN%"=="" goto run',
    'if /i "%~1"=="auth" goto run',
    `for /f "delims=" %%u in ('git config --get profileswitcher.ghUser 2^>nul') do set "GPS_GH_USER=%%u"`,
    'if not defined GPS_GH_USER goto run',
    // `call` keeps cmd from stripping the quotes around a path with spaces.
    `for /f "delims=" %%t in ('call "%REAL_GH%" auth token --user "%GPS_GH_USER%" 2^>nul') do set "GH_TOKEN=%%t"`,
    ':run',
    '"%REAL_GH%" %*',
    'exit /b %ERRORLEVEL%',
    ''
  ].join('\r\n')
}

export function readBakedRealGh(content: string): string | null {
  const sh = content.match(/^REAL_GH='((?:[^']|'\\'')*)'$/m)
  if (sh) return sh[1].replace(/'\\''/g, "'")
  const cmd = content.match(/^set "REAL_GH=(.*)"\r?$/m)
  return cmd ? cmd[1] : null
}

export function pickRealGh(candidates: string[], wrapperDir: string, platform: NodeJS.Platform): string | null {
  const p = platform === 'win32' ? win32 : posix
  const norm = (s: string) => (platform === 'win32' ? p.normalize(s).toLowerCase() : p.normalize(s))
  const outside = candidates.filter(c => norm(p.dirname(c)) !== norm(wrapperDir))
  return (platform === 'win32' ? outside.find(c => /\.exe$/i.test(c)) : outside[0]) ?? null
}

export async function findGhCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<string[]> {
  try {
    const { stdout } = platform === 'win32'
      ? await execa('where', ['gh'], { env })
      : await execa('which', ['-a', 'gh'], { env })
    return stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  } catch {
    return []
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch (e: any) {
    if (e.code === 'ENOENT') return null
    throw e
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function wrapperStatus(
  layout: WrapperLayout,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): Promise<WrapperStatus> {
  let installed = true
  let foreignFile: string | null = null
  let primary: string | null = null
  for (const [i, f] of layout.files.entries()) {
    const content = await readIfExists(f.path)
    if (i === 0) primary = content
    if (content === null) installed = false
    else if (!content.includes(WRAPPER_MARKER)) {
      installed = false
      foreignFile ??= f.path
    }
  }
  const realGh = installed && primary ? readBakedRealGh(primary) : null
  const firstGh = platform === 'win32' ? null : (await findGhCandidates(env, platform))[0] ?? null
  return { dir: layout.dir, installed, foreignFile, realGh, realGhExists: realGh ? await exists(realGh) : false, firstGh }
}

export async function installWrapper(
  layout: WrapperLayout,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform
): Promise<string> {
  const status = await wrapperStatus(layout, env, platform)
  if (status.foreignFile) {
    throw new Error(`${status.foreignFile} already exists and is not managed by Git Profile Switcher. Move it before installing the wrapper.`)
  }
  const realGh = pickRealGh(await findGhCandidates(env, platform), layout.dir, platform)
  if (!realGh) throw new Error('gh was not found on PATH.')

  await mkdir(layout.dir, { recursive: true })
  for (const f of layout.files) {
    const content = f.kind === 'cmd'
      ? cmdWrapper(realGh)
      : posixWrapper(platform === 'win32' ? toMsysPath(realGh) : realGh)
    await writeFile(f.path, content, 'utf-8')
    if (f.kind === 'sh') await chmod(f.path, 0o755)
  }
  return realGh
}

export async function removeWrapper(layout: WrapperLayout): Promise<void> {
  for (const f of layout.files) {
    const content = await readIfExists(f.path)
    if (content?.includes(WRAPPER_MARKER)) await rm(f.path, { force: true })
  }
}

export function pathHint(shell: string | undefined, dir: string, platform: NodeJS.Platform): string {
  const name = posix.basename(shell ?? '')
  if (name === 'fish') return `fish_add_path -m ${dir}`
  const rc = name === 'zsh' ? '~/.zshrc'
    : name === 'bash' ? (platform === 'darwin' ? '~/.bash_profile' : '~/.bashrc')
    : '~/.profile'
  return `echo 'export PATH="${dir}:$PATH"' >> ${rc}`
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/core/gh/wrapper.test.ts && npm run typecheck`
Expected: PASS (the two on-disk suites are skipped on Windows).

- [ ] **Step 5: Commit**

```bash
git add src/core/gh/wrapper.ts src/core/gh/wrapper.test.ts
git commit -m "feat(gh): per-folder gh wrapper for sh and cmd with install/remove/status"
```

---

### Task 4: Windows PATH (user, and system via UAC)

**Files:**
- Create: `src/core/gh/windowsPath.ts`
- Test: `src/core/gh/windowsPath.test.ts`

**Interfaces:**
- Produces:
  - `type PathScope = 'User' | 'Machine'`
  - `expandWinEnv(s: string, env?: NodeJS.ProcessEnv): string`
  - `hasPathEntry(raw: string, dir: string, env?: NodeJS.ProcessEnv): boolean`
  - `prependPathEntry(raw: string, dir: string): string`, `removePathEntry(raw: string, dir: string): string`
  - `readPathScript(scope: PathScope): string`, `writePathScript(scope: PathScope, value: string): string`, `encodePs(script: string): string`
  - `readRegistryPath(scope: PathScope): Promise<string>`, `writeRegistryPath(scope: PathScope, value: string): Promise<void>` (Machine triggers one UAC prompt)

The raw registry value is read and written with `DoNotExpandEnvironmentNames` / `ExpandString`, so `%USERPROFILE%`-style entries survive. `[Environment]::SetEnvironmentVariable('Path', …)` is avoided because it expands and rewrites them as plain strings.

- [ ] **Step 1: Write the failing test**

Create `src/core/gh/windowsPath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hasPathEntry, prependPathEntry, removePathEntry, expandWinEnv, writePathScript, readPathScript, encodePs } from './windowsPath'

const DIR = 'C:\\Users\\u\\AppData\\Local\\git-profile-switcher\\bin'

describe('PATH entries', () => {
  it('prepends once, case- and trailing-slash-insensitively', () => {
    const raw = `C:\\Windows;c:\\users\\u\\appdata\\local\\git-profile-switcher\\bin\\;%USERPROFILE%\\bin`
    expect(prependPathEntry(raw, DIR)).toBe(`${DIR};C:\\Windows;%USERPROFILE%\\bin`)
  })

  it('removes only our entry and keeps unexpanded variables', () => {
    expect(removePathEntry(`${DIR};%USERPROFILE%\\bin;;`, DIR)).toBe('%USERPROFILE%\\bin')
  })

  it('matches entries written with variables', () => {
    const env = { ProgramFiles: 'C:\\Program Files' }
    expect(expandWinEnv('%PROGRAMFILES%\\GitHub CLI', env)).toBe('C:\\Program Files\\GitHub CLI')
    expect(hasPathEntry('%ProgramFiles%\\GitHub CLI\\', 'C:\\Program Files\\GitHub CLI', env)).toBe(true)
  })
})

describe('PowerShell scripts', () => {
  it('reads the raw value without expanding variables', () => {
    expect(readPathScript('User')).toContain("DoNotExpandEnvironmentNames")
    expect(readPathScript('Machine')).toContain('Session Manager\\Environment')
  })

  it('writes ExpandString and escapes single quotes', () => {
    const s = writePathScript('User', "C:\\it's;D:\\x")
    expect(s).toContain("'C:\\it''s;D:\\x'")
    expect(s).toContain("'ExpandString'")
  })

  it('encodes as UTF-16LE base64 for -EncodedCommand', () => {
    expect(Buffer.from(encodePs('echo hi'), 'base64').toString('utf16le')).toBe('echo hi')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/core/gh/windowsPath.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/core/gh/windowsPath.ts`:

```ts
import { execa } from 'execa'

export type PathScope = 'User' | 'Machine'

export function expandWinEnv(s: string, env: NodeJS.ProcessEnv = process.env): string {
  return s.replace(/%([^%]+)%/g, (whole, name: string) => {
    const key = Object.keys(env).find(k => k.toLowerCase() === name.toLowerCase())
    return key ? env[key] ?? whole : whole
  })
}

const norm = (p: string, env?: NodeJS.ProcessEnv) =>
  expandWinEnv(p.trim(), env).replace(/[\\/]+$/, '').toLowerCase()

const entries = (raw: string) => raw.split(';').filter(e => e.trim() !== '')

export function hasPathEntry(raw: string, dir: string, env?: NodeJS.ProcessEnv): boolean {
  return entries(raw).some(e => norm(e, env) === norm(dir, env))
}

export function prependPathEntry(raw: string, dir: string): string {
  return [dir, ...entries(raw).filter(e => norm(e) !== norm(dir))].join(';')
}

export function removePathEntry(raw: string, dir: string): string {
  return entries(raw).filter(e => norm(e) !== norm(dir)).join(';')
}

const KEY: Record<PathScope, string> = {
  User: "[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', WRITABLE)",
  Machine: "[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', WRITABLE)"
}

export function readPathScript(scope: PathScope): string {
  return `${KEY[scope].replace('WRITABLE', '$false')}.GetValue('Path', '', 'DoNotExpandEnvironmentNames')`
}

export function writePathScript(scope: PathScope, value: string): string {
  return [
    `$k = ${KEY[scope].replace('WRITABLE', '$true')}`,
    `$k.SetValue('Path', '${value.replace(/'/g, "''")}', 'ExpandString')`,
    // Setting and clearing a dummy variable broadcasts WM_SETTINGCHANGE, so
    // terminals opened afterwards see the new PATH.
    `[Environment]::SetEnvironmentVariable('GPS_PATH_REFRESH', '1', '${scope}')`,
    `[Environment]::SetEnvironmentVariable('GPS_PATH_REFRESH', $null, '${scope}')`
  ].join('; ')
}

export function encodePs(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

const PS = ['-NoProfile', '-NonInteractive']

export async function readRegistryPath(scope: PathScope): Promise<string> {
  const { stdout } = await execa('powershell', [...PS, '-EncodedCommand', encodePs(readPathScript(scope))])
  return stdout.trim()
}

export async function writeRegistryPath(scope: PathScope, value: string): Promise<void> {
  const encoded = encodePs(writePathScript(scope, value))
  if (scope === 'User') {
    await execa('powershell', [...PS, '-EncodedCommand', encoded])
    return
  }
  // The system PATH needs admin: one UAC prompt; the elevated child does the write.
  // Declining the prompt makes Start-Process fail, which rejects here.
  await execa('powershell', [...PS, '-Command',
    `Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}'`])
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/core/gh/windowsPath.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/gh/windowsPath.ts src/core/gh/windowsPath.test.ts
git commit -m "feat(gh): read and prepend Windows PATH entries without expanding variables"
```

---

### Task 5: Agent rules — block `gh auth switch` in six agents

**Files:**
- Create: `src/core/agents/rules.ts` (pure), `src/core/agents/agents.ts` (filesystem)
- Test: `src/core/agents/rules.test.ts`, `src/core/agents/agents.test.ts`

**Interfaces:**
- Consumes: `shQuote` from `src/core/gh/wrapper.ts`.
- Produces (`rules.ts`): `GUARD_BASENAME`, `GUARD_MESSAGE`, `GUARD_SH`, `GUARD_PS1`, `UnsupportedConfig`, `guardCommand(hookDir, platform, dialect: 'cursor' | 'copilot'): string`, `hasClaudeRule/addClaudeRule/removeClaudeRule`, `hasOpencodeRule/addOpencodeRule/removeOpencodeRule`, `hasCursorHook/addCursorHook(cfg, command)/removeCursorHook`, `codexRules(): string`, `geminiPolicy(): string`, `copilotHooks(command: string, platform): string`
- Produces (`agents.ts`): `type AgentId = 'claude' | 'codex' | 'cursor' | 'copilot' | 'gemini' | 'opencode'`, `AGENT_IDS`, `assertAgentId(id: string): AgentId`, `interface AgentEnv { home: string; platform: NodeJS.Platform; hookDir: string }`, `interface AgentStatus { id: AgentId; name: string; detected: boolean; blocked: boolean; file: string; manualSnippet: string | null }`, `agentStatuses(env): Promise<AgentStatus[]>`, `applyAgentRule(id, env): Promise<void>`, `removeAgentRule(id, env): Promise<void>`

Formats (from the spec's references):

| Agent | Detect dir | File | Kind |
|---|---|---|---|
| claude | `~/.claude` | `~/.claude/settings.json` | JSON merge |
| codex | `~/.codex` | `~/.codex/rules/git-profile-switcher.rules` | own file |
| cursor | `~/.cursor` | `~/.cursor/hooks.json` | JSON merge + guard script |
| copilot | `~/.copilot` | `~/.copilot/hooks/git-profile-switcher.json` | own file + guard script |
| gemini | `~/.gemini` | `~/.gemini/policies/git-profile-switcher.toml` | own file |
| opencode | `~/.config/opencode` | `opencode.json`, else an existing `opencode.jsonc` | JSON merge |

- [ ] **Step 1: Write the failing pure tests**

Create `src/core/agents/rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { execa } from 'execa'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  CLAUDE_DENY, addClaudeRule, removeClaudeRule, hasClaudeRule,
  OPENCODE_KEY, addOpencodeRule, removeOpencodeRule, UnsupportedConfig,
  addCursorHook, removeCursorHook, hasCursorHook, guardCommand,
  codexRules, geminiPolicy, copilotHooks, GUARD_SH, GUARD_PS1
} from './rules'

describe('Claude Code', () => {
  it('adds the deny once and keeps the user rules', () => {
    const user = { model: 'opus', permissions: { allow: ['Bash(ls)'], deny: ['Bash(rm:*)'] } }
    const once = addClaudeRule(user)
    expect(addClaudeRule(once)).toEqual(once)
    expect(once.permissions.deny).toEqual(['Bash(rm:*)', CLAUDE_DENY])
    expect(removeClaudeRule(once)).toEqual(user)
    expect(hasClaudeRule(once)).toBe(true)
  })

  it('refuses a deny that is not a list', () => {
    expect(() => addClaudeRule({ permissions: { deny: 'x' } })).toThrow(UnsupportedConfig)
  })
})

describe('OpenCode', () => {
  it('keeps a string catch-all and puts our rule last', () => {
    const out = addOpencodeRule({ permission: { bash: 'ask', edit: 'allow' } })
    expect(out.permission.bash).toEqual({ '*': 'ask', [OPENCODE_KEY]: 'deny' })
    expect(Object.keys(out.permission.bash)).toEqual(['*', OPENCODE_KEY])
    expect(out.permission.edit).toBe('allow')
  })

  it('moves our rule to the end when re-applied after user rules', () => {
    const out = addOpencodeRule({ permission: { bash: { [OPENCODE_KEY]: 'deny', '*': 'ask' } } })
    expect(Object.keys(out.permission.bash)).toEqual(['*', OPENCODE_KEY])
  })

  it('removes only our rule', () => {
    expect(removeOpencodeRule(addOpencodeRule({ permission: { bash: { 'git *': 'allow' } } })).permission.bash).toEqual({ 'git *': 'allow' })
  })

  it('refuses a single global permission action', () => {
    expect(() => addOpencodeRule({ permission: 'ask' })).toThrow(UnsupportedConfig)
  })
})

describe('Cursor', () => {
  it('appends the guard hook next to foreign hooks, once', () => {
    const cfg = { version: 1, hooks: { beforeShellExecution: [{ command: './audit.sh' }], afterFileEdit: [{ command: 'x' }] } }
    const cmd = guardCommand('/home/u/.config/Git Profile Switcher/agent-hooks', 'linux', 'cursor')
    const once = addCursorHook(cfg, cmd)
    expect(addCursorHook(once, cmd)).toEqual(once)
    expect(once.hooks.beforeShellExecution).toEqual([{ command: './audit.sh' }, { command: cmd }])
    expect(hasCursorHook(once)).toBe(true)
    expect(removeCursorHook(once)).toEqual(cfg)
  })

  it('quotes hook paths with spaces', () => {
    expect(guardCommand('/a b/hooks', 'linux', 'cursor')).toBe("sh '/a b/hooks/gh-auth-switch-guard.sh' cursor")
    expect(guardCommand('C:\\a b\\hooks', 'win32', 'copilot'))
      .toBe('powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\a b\\hooks\\gh-auth-switch-guard.ps1" copilot')
  })
})

describe('own files', () => {
  it('generates the Codex, Gemini and Copilot contents', () => {
    expect(codexRules()).toContain('pattern = ["gh", "auth", "switch"]')
    expect(codexRules()).toContain('decision = "forbidden"')
    expect(geminiPolicy()).toContain('commandPrefix = "gh auth switch"')
    expect(geminiPolicy()).toContain('decision = "deny"')
    const copilot = JSON.parse(copilotHooks('sh x copilot', 'linux'))
    expect(copilot).toEqual({ version: 1, hooks: { preToolUse: [{ type: 'command', bash: 'sh x copilot', timeoutSec: 10 }] } })
    expect(JSON.parse(copilotHooks('ps x', 'win32')).hooks.preToolUse[0].powershell).toBe('ps x')
  })
})

describe.skipIf(process.platform === 'win32')('guard script (sh)', () => {
  async function run(dialect: string, stdin: string) {
    const dir = await mkdtemp(join(tmpdir(), 'gps-guard-'))
    try {
      const script = join(dir, 'guard.sh')
      await writeFile(script, GUARD_SH)
      return (await execa('sh', [script, dialect], { input: stdin })).stdout
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  }

  it('denies gh auth switch anywhere in the command, for Cursor', async () => {
    const out = JSON.parse(await run('cursor', JSON.stringify({ command: 'bash -c "gh  auth switch --user x"' })))
    expect(out.permission).toBe('deny')
  })

  it('allows other commands for Cursor and stays silent for Copilot', async () => {
    expect(JSON.parse(await run('cursor', JSON.stringify({ command: 'gh pr list' })))).toEqual({ continue: true, permission: 'allow' })
    expect(await run('copilot', JSON.stringify({ toolName: 'bash', toolArgs: { command: 'gh pr list' } }))).toBe('')
  })

  it('uses the Copilot deny shape', async () => {
    const out = JSON.parse(await run('copilot', JSON.stringify({ toolName: 'bash', toolArgs: '{"command":"gh auth switch"}' })))
    expect(out.permissionDecision).toBe('deny')
    expect(out.permissionDecisionReason).toMatch(/blocked/)
  })
})

const hasPwsh = await execa('pwsh', ['-v']).then(() => true, () => false)

describe.skipIf(!hasPwsh)('guard script (PowerShell)', () => {
  it('denies for Copilot and allows for Cursor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gps-guard-'))
    try {
      const script = join(dir, 'guard.ps1')
      await writeFile(script, GUARD_PS1)
      const deny = await execa('pwsh', ['-NoProfile', '-File', script, 'copilot'], { input: '{"toolArgs":{"command":"gh auth switch"}}' })
      expect(JSON.parse(deny.stdout).permissionDecision).toBe('deny')
      const allow = await execa('pwsh', ['-NoProfile', '-File', script, 'cursor'], { input: '{"command":"gh pr list"}' })
      expect(JSON.parse(allow.stdout).permission).toBe('allow')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/core/agents/rules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `rules.ts`**

Create `src/core/agents/rules.ts`:

```ts
import { posix, win32 } from 'node:path'
import { shQuote } from '../gh/wrapper'

type Json = Record<string, any>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The agent config has a shape we won't rewrite automatically. */
export class UnsupportedConfig extends Error {}

export const GUARD_BASENAME = 'gh-auth-switch-guard'
export const GUARD_MESSAGE =
  'gh auth switch is blocked by Git Profile Switcher: gh already uses the account linked to this folder. Do not change the global gh account.'

// Hook scripts get the agent's JSON payload on stdin and search all of it, so
// `bash -c "gh auth switch"` is caught too. Exactly one JSON object on stdout.
export const GUARD_SH = `#!/bin/sh
# Managed by Git Profile Switcher. Usage: ${GUARD_BASENAME}.sh cursor|copilot
input=$(cat)
msg='${GUARD_MESSAGE}'
if printf '%s' "$input" | grep -Eq 'gh[[:space:]]+auth[[:space:]]+switch'; then
  if [ "$1" = copilot ]; then
    printf '{"permissionDecision":"deny","permissionDecisionReason":"%s"}\\n' "$msg"
  else
    printf '{"continue":true,"permission":"deny","user_message":"%s","agent_message":"%s"}\\n' "$msg" "$msg"
  fi
  exit 0
fi
if [ "$1" = cursor ]; then printf '{"continue":true,"permission":"allow"}\\n'; fi
exit 0
`

export const GUARD_PS1 = `# Managed by Git Profile Switcher. Usage: ${GUARD_BASENAME}.ps1 cursor|copilot
param([string]$Dialect)
$text = [Console]::In.ReadToEnd()
$msg = '${GUARD_MESSAGE}'
if ($text -match 'gh\\s+auth\\s+switch') {
  if ($Dialect -eq 'copilot') { [ordered]@{ permissionDecision = 'deny'; permissionDecisionReason = $msg } | ConvertTo-Json -Compress }
  else { [ordered]@{ continue = $true; permission = 'deny'; user_message = $msg; agent_message = $msg } | ConvertTo-Json -Compress }
  exit 0
}
if ($Dialect -eq 'cursor') { '{"continue":true,"permission":"allow"}' }
exit 0
`

export function guardCommand(hookDir: string, platform: NodeJS.Platform, dialect: 'cursor' | 'copilot'): string {
  return platform === 'win32'
    ? `powershell -NoProfile -ExecutionPolicy Bypass -File "${win32.join(hookDir, `${GUARD_BASENAME}.ps1`)}" ${dialect}`
    : `sh ${shQuote(posix.join(hookDir, `${GUARD_BASENAME}.sh`))} ${dialect}`
}

// ── Claude Code: ~/.claude/settings.json ──
export const CLAUDE_DENY = 'Bash(gh auth switch:*)'

export function hasClaudeRule(s: Json): boolean {
  return Array.isArray(s.permissions?.deny) && s.permissions.deny.includes(CLAUDE_DENY)
}

export function addClaudeRule(s: Json): Json {
  if (s.permissions !== undefined && !isObj(s.permissions)) throw new UnsupportedConfig('"permissions" is not an object')
  const deny = s.permissions?.deny ?? []
  if (!Array.isArray(deny)) throw new UnsupportedConfig('"permissions.deny" is not a list')
  if (deny.includes(CLAUDE_DENY)) return s
  return { ...s, permissions: { ...s.permissions, deny: [...deny, CLAUDE_DENY] } }
}

export function removeClaudeRule(s: Json): Json {
  if (!hasClaudeRule(s)) return s
  return { ...s, permissions: { ...s.permissions, deny: s.permissions.deny.filter((d: unknown) => d !== CLAUDE_DENY) } }
}

// ── OpenCode: permission.bash, last matching rule wins ──
export const OPENCODE_KEY = 'gh auth switch*'

export function hasOpencodeRule(c: Json): boolean {
  return isObj(c.permission) && isObj(c.permission.bash) && c.permission.bash[OPENCODE_KEY] === 'deny'
}

export function addOpencodeRule(c: Json): Json {
  if (c.permission !== undefined && !isObj(c.permission)) throw new UnsupportedConfig('"permission" is a single action for every tool')
  const bash = c.permission?.bash
  let rules: Json
  if (bash === undefined) rules = {}
  else if (typeof bash === 'string') rules = { '*': bash } // keep the existing catch-all
  else if (isObj(bash)) rules = { ...bash }
  else throw new UnsupportedConfig('"permission.bash" has an unknown shape')
  delete rules[OPENCODE_KEY]
  rules[OPENCODE_KEY] = 'deny' // must stay last to win
  return { ...c, permission: { ...c.permission, bash: rules } }
}

export function removeOpencodeRule(c: Json): Json {
  if (!hasOpencodeRule(c)) return c
  const rest = { ...c.permission.bash }
  delete rest[OPENCODE_KEY]
  return { ...c, permission: { ...c.permission, bash: rest } }
}

// ── Cursor: ~/.cursor/hooks.json ──
const isGuard = (h: unknown) => isObj(h) && typeof h.command === 'string' && h.command.includes(GUARD_BASENAME)

export function hasCursorHook(c: Json): boolean {
  return Array.isArray(c.hooks?.beforeShellExecution) && c.hooks.beforeShellExecution.some(isGuard)
}

export function addCursorHook(c: Json, command: string): Json {
  if (c.hooks !== undefined && !isObj(c.hooks)) throw new UnsupportedConfig('"hooks" is not an object')
  const list = c.hooks?.beforeShellExecution ?? []
  if (!Array.isArray(list)) throw new UnsupportedConfig('"hooks.beforeShellExecution" is not a list')
  return { version: 1, ...c, hooks: { ...c.hooks, beforeShellExecution: [...list.filter(h => !isGuard(h)), { command }] } }
}

export function removeCursorHook(c: Json): Json {
  if (!hasCursorHook(c)) return c
  return { ...c, hooks: { ...c.hooks, beforeShellExecution: c.hooks.beforeShellExecution.filter((h: unknown) => !isGuard(h)) } }
}

// ── Own files ──
export function codexRules(): string {
  return `# Managed by Git Profile Switcher.
prefix_rule(
    pattern = ["gh", "auth", "switch"],
    decision = "forbidden",
    justification = "${GUARD_MESSAGE}",
)
`
}

export function geminiPolicy(): string {
  return `# Managed by Git Profile Switcher.
[[rule]]
toolName = "run_shell_command"
commandPrefix = "gh auth switch"
decision = "deny"
priority = 100
`
}

export function copilotHooks(command: string, platform: NodeJS.Platform): string {
  const entry = { type: 'command', [platform === 'win32' ? 'powershell' : 'bash']: command, timeoutSec: 10 }
  return JSON.stringify({ version: 1, hooks: { preToolUse: [entry] } }, null, 2) + '\n'
}
```

- [ ] **Step 4: Run the pure tests to verify they pass**

Run: `npx vitest run src/core/agents/rules.test.ts`
Expected: PASS (the PowerShell suite runs only where `pwsh` exists).

- [ ] **Step 5: Write the failing filesystem tests**

Create `src/core/agents/agents.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agentStatuses, applyAgentRule, removeAgentRule, assertAgentId, AgentEnv } from './agents'
import { CLAUDE_DENY } from './rules'

let home: string
afterEach(async () => { if (home) await rm(home, { recursive: true, force: true }) })

async function setup(): Promise<AgentEnv> {
  home = await mkdtemp(join(tmpdir(), 'gps-agents-'))
  return { home, platform: 'linux', hookDir: join(home, 'Git Profile Switcher', 'agent-hooks') }
}

const exists = (p: string) => stat(p).then(() => true, () => false)

describe('agents', () => {
  it('detects agents by their config dir', async () => {
    const env = await setup()
    await mkdir(join(home, '.claude'))
    const s = await agentStatuses(env)
    expect(s.find(a => a.id === 'claude')!.detected).toBe(true)
    expect(s.find(a => a.id === 'codex')!.detected).toBe(false)
  })

  it('merges into Claude settings, idempotently, and removes cleanly', async () => {
    const env = await setup()
    const file = join(home, '.claude', 'settings.json')
    await mkdir(join(home, '.claude'))
    const original = { theme: 'dark', permissions: { deny: ['Bash(rm:*)'] } }
    await writeFile(file, JSON.stringify(original))

    await applyAgentRule('claude', env)
    await applyAgentRule('claude', env)
    const after = JSON.parse(await readFile(file, 'utf-8'))
    expect(after.permissions.deny).toEqual(['Bash(rm:*)', CLAUDE_DENY])
    expect(after.theme).toBe('dark')
    expect((await agentStatuses(env)).find(a => a.id === 'claude')!.blocked).toBe(true)

    await removeAgentRule('claude', env)
    expect(JSON.parse(await readFile(file, 'utf-8'))).toEqual(original)
  })

  it('never writes an OpenCode config with comments and offers a snippet', async () => {
    const env = await setup()
    const dir = join(home, '.config', 'opencode')
    await mkdir(dir, { recursive: true })
    const file = join(dir, 'opencode.jsonc')
    const text = '{\n  // mine\n  "model": "x"\n}\n'
    await writeFile(file, text)

    const status = (await agentStatuses(env)).find(a => a.id === 'opencode')!
    expect(status.file).toBe(file)
    expect(status.manualSnippet).toContain('gh auth switch*')
    await expect(applyAgentRule('opencode', env)).rejects.toThrow(/by hand/)
    expect(await readFile(file, 'utf-8')).toBe(text)
  })

  it('writes the Cursor hook and its guard script', async () => {
    const env = await setup()
    await mkdir(join(home, '.cursor'))
    await applyAgentRule('cursor', env)
    const hooks = JSON.parse(await readFile(join(home, '.cursor', 'hooks.json'), 'utf-8'))
    expect(hooks.version).toBe(1)
    // Exact quoting is pinned in rules.test.ts; here only that the hook points at our script.
    expect(hooks.hooks.beforeShellExecution[0].command).toContain('gh-auth-switch-guard.sh')
    expect(await exists(join(env.hookDir, 'gh-auth-switch-guard.sh'))).toBe(true)
  })

  it('creates and deletes own files for Codex, Gemini and Copilot', async () => {
    const env = await setup()
    for (const id of ['codex', 'gemini', 'copilot'] as const) {
      await applyAgentRule(id, env)
      const { file, blocked } = (await agentStatuses(env)).find(a => a.id === id)!
      expect(blocked).toBe(true)
      await removeAgentRule(id, env)
      expect(await exists(file)).toBe(false)
    }
  })

  it('rejects unknown agent ids', () => {
    expect(() => assertAgentId('vim')).toThrow()
  })
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx vitest run src/core/agents/agents.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `agents.ts`**

Create `src/core/agents/agents.ts`:

```ts
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import * as r from './rules'

export type AgentId = 'claude' | 'codex' | 'cursor' | 'copilot' | 'gemini' | 'opencode'
export const AGENT_IDS: AgentId[] = ['claude', 'codex', 'cursor', 'copilot', 'gemini', 'opencode']

export interface AgentEnv { home: string; platform: NodeJS.Platform; hookDir: string }

export interface AgentStatus {
  id: AgentId
  name: string
  detected: boolean
  blocked: boolean
  file: string
  /** Set when the config can't be edited automatically: what to paste by hand. */
  manualSnippet: string | null
}

type Json = Record<string, any>
type Agent = { name: string; dir: string; file: string } & (
  | { kind: 'json'; has(c: Json): boolean; add(c: Json): Json; remove(c: Json): Json }
  | { kind: 'own'; content(): string }
)

export function assertAgentId(id: string): AgentId {
  if (!AGENT_IDS.includes(id as AgentId)) throw new Error(`Unknown agent: ${id}`)
  return id as AgentId
}

const exists = (p: string) => stat(p).then(() => true, () => false)

async function resolveAgent(id: AgentId, env: AgentEnv): Promise<Agent> {
  const h = env.home
  switch (id) {
    case 'claude':
      return { kind: 'json', name: 'Claude Code', dir: join(h, '.claude'), file: join(h, '.claude', 'settings.json'),
        has: r.hasClaudeRule, add: r.addClaudeRule, remove: r.removeClaudeRule }
    case 'codex':
      return { kind: 'own', name: 'Codex', dir: join(h, '.codex'), file: join(h, '.codex', 'rules', 'git-profile-switcher.rules'),
        content: r.codexRules }
    case 'cursor': {
      const command = r.guardCommand(env.hookDir, env.platform, 'cursor')
      return { kind: 'json', name: 'Cursor', dir: join(h, '.cursor'), file: join(h, '.cursor', 'hooks.json'),
        has: r.hasCursorHook, add: c => r.addCursorHook(c, command), remove: r.removeCursorHook }
    }
    case 'copilot': {
      const command = r.guardCommand(env.hookDir, env.platform, 'copilot')
      return { kind: 'own', name: 'GitHub Copilot CLI', dir: join(h, '.copilot'), file: join(h, '.copilot', 'hooks', 'git-profile-switcher.json'),
        content: () => r.copilotHooks(command, env.platform) }
    }
    case 'gemini':
      return { kind: 'own', name: 'Gemini CLI', dir: join(h, '.gemini'), file: join(h, '.gemini', 'policies', 'git-profile-switcher.toml'),
        content: r.geminiPolicy }
    case 'opencode': {
      const dir = join(h, '.config', 'opencode')
      const json = join(dir, 'opencode.json')
      const jsonc = join(dir, 'opencode.jsonc')
      const file = !(await exists(json)) && (await exists(jsonc)) ? jsonc : json
      return { kind: 'json', name: 'OpenCode', dir, file,
        has: r.hasOpencodeRule, add: r.addOpencodeRule, remove: r.removeOpencodeRule }
    }
  }
}

type ReadResult = { kind: 'missing' } | { kind: 'ok'; value: Json } | { kind: 'invalid' }

async function readJson(file: string): Promise<ReadResult> {
  let text: string
  try {
    text = await readFile(file, 'utf-8')
  } catch (e: any) {
    if (e.code === 'ENOENT') return { kind: 'missing' }
    throw e
  }
  try {
    const value = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? { kind: 'ok', value } : { kind: 'invalid' }
  } catch {
    return { kind: 'invalid' }
  }
}

async function writeAtomic(file: string, text: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const tmp = `${file}.gps-tmp`
  await writeFile(tmp, text, 'utf-8')
  await rename(tmp, file)
}

const snippet = (a: Agent & { kind: 'json' }) => JSON.stringify(a.add({}), null, 2)

function byHand(a: Agent & { kind: 'json' }, why: string): Error {
  return new Error(`${a.name}: ${a.file} can't be edited automatically (${why}). Add this by hand:\n${snippet(a)}`)
}

async function writeGuardScripts(hookDir: string): Promise<void> {
  await mkdir(hookDir, { recursive: true })
  const sh = join(hookDir, `${r.GUARD_BASENAME}.sh`)
  await writeFile(sh, r.GUARD_SH, 'utf-8')
  await chmod(sh, 0o755)
  await writeFile(join(hookDir, `${r.GUARD_BASENAME}.ps1`), r.GUARD_PS1, 'utf-8')
}

export async function agentStatuses(env: AgentEnv): Promise<AgentStatus[]> {
  return Promise.all(AGENT_IDS.map(async id => {
    const a = await resolveAgent(id, env)
    const detected = await exists(a.dir)
    if (a.kind === 'own') {
      return { id, name: a.name, detected, blocked: await exists(a.file), file: a.file, manualSnippet: null }
    }
    const j = await readJson(a.file)
    return {
      id, name: a.name, detected, file: a.file,
      blocked: j.kind === 'ok' && a.has(j.value),
      manualSnippet: j.kind === 'invalid' ? snippet(a) : null
    }
  }))
}

export async function applyAgentRule(id: AgentId, env: AgentEnv): Promise<void> {
  const a = await resolveAgent(id, env)
  if (id === 'cursor' || id === 'copilot') await writeGuardScripts(env.hookDir)
  if (a.kind === 'own') return writeAtomic(a.file, a.content())

  const j = await readJson(a.file)
  if (j.kind === 'invalid') throw byHand(a, 'it is not plain JSON')
  let next: Json
  try {
    next = a.add(j.kind === 'ok' ? j.value : {})
  } catch (e) {
    if (e instanceof r.UnsupportedConfig) throw byHand(a, e.message)
    throw e
  }
  await writeAtomic(a.file, JSON.stringify(next, null, 2) + '\n')
}

export async function removeAgentRule(id: AgentId, env: AgentEnv): Promise<void> {
  const a = await resolveAgent(id, env)
  if (a.kind === 'own') return rm(a.file, { force: true })
  const j = await readJson(a.file)
  if (j.kind !== 'ok' || !a.has(j.value)) return
  await writeAtomic(a.file, JSON.stringify(a.remove(j.value), null, 2) + '\n')
}
```

- [ ] **Step 8: Run all agent tests to verify they pass**

Run: `npx vitest run src/core/agents && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Validate the Codex rule with Codex itself (when installed)**

Write the rule to a temp file:

```bash
RULES=$(mktemp --suffix=.rules)
npx tsx -e "import { codexRules } from './src/core/agents/rules.ts'; require('node:fs').writeFileSync(process.argv[1], codexRules())" "$RULES"
codex execpolicy check --help
```

Run `codex execpolicy check`, passing `$RULES` with the rules-file flag that `--help` shows, against the command `gh auth switch --user x`.
Expected: verdict `forbidden`. If `codex` or `tsx` isn't available, skip this step and say so in the task report; the content test above still pins the format from the docs.

- [ ] **Step 10: Commit**

```bash
git add src/core/agents/rules.ts src/core/agents/rules.test.ts src/core/agents/agents.ts src/core/agents/agents.test.ts
git commit -m "feat(agents): block gh auth switch in Claude Code, Codex, Cursor, Copilot CLI, Gemini CLI and OpenCode"
```

---

### Task 6: IPC and preload API

**Files:**
- Create: `src/main/ghIpc.ts`
- Modify: `src/main/ipc.ts` (call `registerGhIpc(userDataPath)` at the end of `setupIpcHandlers`)
- Modify: `src/preload/index.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 1–5.
- Produces:
  - `interface GhTabStatus { platform: NodeJS.Platform; gh: GhStatus; wrapper: WrapperStatus; resolvesToWrapper: boolean; pathHint: string | null; windows: { userPathHasDir: boolean; machinePathHasDir: boolean; realGhOnMachinePath: boolean } | null; profiles: { id: string; label: string; ghUser: string | null }[] }`
  - Channels: `gh:status`, `gh:setProfileAccount(profileId, login | null)`, `gh:installWrapper`, `gh:removeWrapper`, `gh:elevateSystemPath`, `agents:status`, `agents:apply(id | 'all')`, `agents:remove(id)`
  - `window.api.gh.{status, setProfileAccount, installWrapper, removeWrapper, elevateSystemPath}`, `window.api.agents.{status, apply, remove}`

- [ ] **Step 1: Implement `ghIpc.ts`**

Create `src/main/ghIpc.ts`:

```ts
import { ipcMain } from 'electron'
import { homedir } from 'node:os'
import { join, win32 } from 'node:path'
import { loadProfiles, saveProfiles } from '../core/profiles/storage'
import { syncManagedGitconfig } from '../core/git/folderConfigs'
import { setProfileGhUser } from '../core/gh/profileLink'
import { userShellEnv } from '../core/gh/shellEnv'
import { getGhStatus, GhStatus } from '../core/gh/ghStatus'
import { wrapperLayout, wrapperStatus, installWrapper, removeWrapper, pathHint, WrapperStatus } from '../core/gh/wrapper'
import { readRegistryPath, writeRegistryPath, hasPathEntry, prependPathEntry, removePathEntry } from '../core/gh/windowsPath'
import { agentStatuses, applyAgentRule, removeAgentRule, assertAgentId, AgentEnv, AgentId } from '../core/agents/agents'

export interface GhTabStatus {
  platform: NodeJS.Platform
  gh: GhStatus
  wrapper: WrapperStatus
  resolvesToWrapper: boolean
  pathHint: string | null
  windows: { userPathHasDir: boolean; machinePathHasDir: boolean; realGhOnMachinePath: boolean } | null
  profiles: { id: string; label: string; ghUser: string | null }[]
}

// Same error normalization as ipc.ts: always reject with a plain Error message.
function handle(channel: string, fn: (...args: any[]) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (error: any) {
      throw new Error(error?.message ?? String(error))
    }
  })
}

export function registerGhIpc(userDataPath: string): void {
  const platform = process.platform
  const layout = wrapperLayout(platform, homedir(), process.env.LOCALAPPDATA)
  const agentEnv: AgentEnv = { home: homedir(), platform, hookDir: join(userDataPath, 'agent-hooks') }

  async function requireMultiAccount() {
    const gh = await getGhStatus(await userShellEnv())
    if (gh.kind !== 'ok' || gh.accounts.length < 2) {
      throw new Error('This needs gh with two or more github.com accounts logged in.')
    }
    return gh
  }

  async function status(): Promise<GhTabStatus> {
    const env = await userShellEnv()
    const [gh, wrapper, profiles] = await Promise.all([
      getGhStatus(env),
      wrapperStatus(layout, env, platform),
      loadProfiles(userDataPath)
    ])

    let windows: GhTabStatus['windows'] = null
    let resolvesToWrapper: boolean
    if (platform === 'win32') {
      // process.env.PATH is frozen at launch; the registry is the truth for new terminals.
      const [user, machine] = await Promise.all([readRegistryPath('User'), readRegistryPath('Machine')])
      const realDir = wrapper.realGh ? win32.dirname(wrapper.realGh) : null
      windows = {
        userPathHasDir: hasPathEntry(user, layout.dir),
        machinePathHasDir: hasPathEntry(machine, layout.dir),
        realGhOnMachinePath: realDir ? hasPathEntry(machine, realDir) : false
      }
      resolvesToWrapper = wrapper.installed &&
        (windows.machinePathHasDir || (windows.userPathHasDir && !windows.realGhOnMachinePath))
    } else {
      resolvesToWrapper = wrapper.installed && wrapper.firstGh === layout.files[0].path
    }

    return {
      platform, gh, wrapper, resolvesToWrapper, windows,
      pathHint: platform === 'win32' ? null : pathHint(process.env.SHELL, layout.dir, platform),
      profiles: profiles.map(p => ({ id: p.id, label: p.label, ghUser: p.advanced?.ghUser ?? null }))
    }
  }

  handle('gh:status', status)

  handle('gh:setProfileAccount', async (profileId: string, login: string | null) => {
    if (login !== null) {
      const gh = await requireMultiAccount()
      if (!gh.accounts.some(a => a.login === login)) throw new Error(`gh account "${login}" is not logged in.`)
    }
    const profiles = await loadProfiles(userDataPath)
    await saveProfiles(userDataPath, setProfileGhUser(profiles, profileId, login, new Date().toISOString()))
    await syncManagedGitconfig(userDataPath)
    return { ok: true as const }
  })

  handle('gh:installWrapper', async () => {
    await requireMultiAccount()
    await installWrapper(layout, await userShellEnv(), platform)
    if (platform === 'win32') {
      await writeRegistryPath('User', prependPathEntry(await readRegistryPath('User'), layout.dir))
    }
    return status()
  })

  handle('gh:removeWrapper', async () => {
    await removeWrapper(layout)
    if (platform === 'win32') {
      const user = await readRegistryPath('User')
      if (hasPathEntry(user, layout.dir)) await writeRegistryPath('User', removePathEntry(user, layout.dir))
      const machine = await readRegistryPath('Machine')
      if (hasPathEntry(machine, layout.dir)) await writeRegistryPath('Machine', removePathEntry(machine, layout.dir))
    }
    return status()
  })

  handle('gh:elevateSystemPath', async () => {
    if (platform !== 'win32') throw new Error('Only needed on Windows.')
    await writeRegistryPath('Machine', prependPathEntry(await readRegistryPath('Machine'), layout.dir))
    return status()
  })

  handle('agents:status', () => agentStatuses(agentEnv))

  handle('agents:apply', async (id: string) => {
    await requireMultiAccount()
    const ids: AgentId[] = id === 'all'
      ? (await agentStatuses(agentEnv)).filter(s => s.detected).map(s => s.id)
      : [assertAgentId(id)]
    // Apply every agent even if one fails, then report all failures together.
    const errors: string[] = []
    for (const agentId of ids) {
      try {
        await applyAgentRule(agentId, agentEnv)
      } catch (e: any) {
        errors.push(e.message)
      }
    }
    if (errors.length) throw new Error(errors.join('\n\n'))
    return agentStatuses(agentEnv)
  })

  handle('agents:remove', async (id: string) => {
    await removeAgentRule(assertAgentId(id), agentEnv)
    return agentStatuses(agentEnv)
  })
}
```

- [ ] **Step 2: Register it**

In `src/main/ipc.ts`: add `import { registerGhIpc } from './ghIpc'` and, as the last statement inside `setupIpcHandlers`:

```ts
  registerGhIpc(userDataPath)
```

- [ ] **Step 3: Expose it in the preload**

In `src/preload/index.ts`, add the imports:

```ts
import type { GhTabStatus } from '../main/ghIpc'
import type { AgentId, AgentStatus } from '../core/agents/agents'
```

and add to the `api` object (after `shell`):

```ts
  gh: {
    status: (): Promise<GhTabStatus> => ipcRenderer.invoke('gh:status'),
    setProfileAccount: (profileId: string, login: string | null): Promise<{ ok: true }> =>
      ipcRenderer.invoke('gh:setProfileAccount', profileId, login),
    installWrapper: (): Promise<GhTabStatus> => ipcRenderer.invoke('gh:installWrapper'),
    removeWrapper: (): Promise<GhTabStatus> => ipcRenderer.invoke('gh:removeWrapper'),
    elevateSystemPath: (): Promise<GhTabStatus> => ipcRenderer.invoke('gh:elevateSystemPath')
  },
  agents: {
    status: (): Promise<AgentStatus[]> => ipcRenderer.invoke('agents:status'),
    apply: (id: AgentId | 'all'): Promise<AgentStatus[]> => ipcRenderer.invoke('agents:apply', id),
    remove: (id: AgentId): Promise<AgentStatus[]> => ipcRenderer.invoke('agents:remove', id)
  }
```

- [ ] **Step 4: Verify types and the full suite**

Run: `npm run typecheck && npm run test:run`
Expected: no type errors; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/ghIpc.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat(gh): IPC and preload API for the GitHub CLI tab"
```

---

### Task 7: The GitHub CLI tab

**Files:**
- Create: `src/renderer/screens/GitHubCLI.tsx`
- Modify: `src/renderer/App.tsx` (import, `NavLink` after "SSH Keys", `Route`)

**Interfaces:**
- Consumes: `window.api.gh.*`, `window.api.agents.*`, `GhTabStatus`, `AgentStatus`, `AgentId` from Task 6.

- [ ] **Step 1: Create the screen**

Create `src/renderer/screens/GitHubCLI.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { GhTabStatus } from '../../main/ghIpc'
import type { AgentId, AgentStatus } from '../../core/agents/agents'

// Electron prefixes rejected invokes with "Error invoking remote method '…': Error: ".
const cleanError = (e: any) => String(e?.message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export default function GitHubCLI() {
  const [status, setStatus] = useState<GhTabStatus | null>(null)
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const [s, a] = await Promise.all([window.api.gh.status(), window.api.agents.status()])
    setStatus(s)
    setAgents(a)
  }

  useEffect(() => {
    refresh().catch(e => setError(cleanError(e)))
  }, [])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(cleanError(e))
    } finally {
      await refresh().catch(() => {})
      setBusy(false)
    }
  }

  if (!status) {
    return (
      <div>
        <h1 className="page-title">▸ GITHUB CLI</h1>
        <p className="settings-hint">{error ?? 'Checking gh…'}</p>
      </div>
    )
  }

  const { gh, wrapper, windows } = status
  const accounts = gh.kind === 'ok' ? gh.accounts : []
  const ready = gh.kind === 'ok' && accounts.length >= 2

  return (
    <div>
      <h1 className="page-title">▸ GITHUB CLI</h1>

      {error && (
        <div className="pixel-card mb-md">
          <pre className="settings-hint" style={{ whiteSpace: 'pre-wrap' }}>✕ {error}</pre>
        </div>
      )}

      <div className="pixel-card pixel-card--highlight mb-md">
        <h2 className="section-title">◈ gh Accounts</h2>
        {gh.kind === 'missing' && (
          <p className="settings-hint">gh is not installed or not on your PATH. Install it from cli.github.com to use this tab.</p>
        )}
        {gh.kind === 'unsupported' && (
          <p className="settings-hint">gh {gh.version} is too old (no <code>gh auth status --json</code>). Upgrade gh to use this tab.</p>
        )}
        {gh.kind === 'ok' && (
          <>
            <p className="pixel-card__info">
              <strong>gh {gh.version}</strong> · {accounts.length} account{accounts.length === 1 ? '' : 's'} on github.com
            </p>
            {!ready && (
              <p className="settings-hint">
                Per-folder gh accounts need two or more logged-in accounts. Add one with <code>gh auth login</code>.
              </p>
            )}
          </>
        )}
      </div>

      <div className="pixel-card mb-md">
        <h2 className="section-title">◈ gh Wrapper</h2>
        <p className="settings-hint">
          A small <code>gh</code> placed ahead of the real one on your PATH. It runs gh as the account linked to the
          profile for the current folder, so parallel terminals and agents never fight over <code>gh auth switch</code>.
        </p>

        {wrapper.foreignFile && (
          <p className="pixel-card__info">✕ <code>{wrapper.foreignFile}</code> already exists and isn't ours. Move it to install the wrapper.</p>
        )}
        {wrapper.installed && !wrapper.realGhExists && (
          <p className="pixel-card__info">✕ The wrapper points to <code>{wrapper.realGh}</code>, which no longer exists. Reinstall it.</p>
        )}
        {wrapper.installed && wrapper.realGhExists && (
          <p className="pixel-card__info">
            {status.resolvesToWrapper ? '●' : '✕'} Installed in <code>{wrapper.dir}</code> → <code>{wrapper.realGh}</code>
            {status.resolvesToWrapper ? '' : ' — but `gh` still resolves to the real binary.'}
          </p>
        )}
        {!wrapper.installed && !wrapper.foreignFile && <p className="pixel-card__info">○ Not installed.</p>}

        {wrapper.installed && !status.resolvesToWrapper && status.pathHint && (
          <p className="settings-hint">Put <code>{wrapper.dir}</code> first on your PATH, then open a new terminal: <code>{status.pathHint}</code></p>
        )}
        {wrapper.installed && windows && windows.realGhOnMachinePath && !windows.machinePathHasDir && (
          <p className="settings-hint">
            gh is on the system PATH, which Windows searches before your user PATH. Putting the wrapper first there needs administrator rights.
          </p>
        )}

        <div className="btn-row mt-md mb-0">
          <button className="btn btn--primary btn--sm" disabled={!ready || busy || !!wrapper.foreignFile}
            onClick={() => run(() => window.api.gh.installWrapper())}>
            {wrapper.installed ? '↻ Reinstall' : '➕ Install'}
          </button>
          {windows && wrapper.installed && windows.realGhOnMachinePath && !windows.machinePathHasDir && (
            <button className="btn btn--ghost btn--sm" disabled={busy}
              onClick={() => run(() => window.api.gh.elevateSystemPath())}>
              🛡 Put first in system PATH (admin)
            </button>
          )}
          {wrapper.installed && (
            <button className="btn btn--danger btn--sm" disabled={busy}
              onClick={() => run(() => window.api.gh.removeWrapper())}>
              ✕ Remove
            </button>
          )}
        </div>
      </div>

      <div className="pixel-card mb-md">
        <h2 className="section-title">◈ Profile → gh Account</h2>
        {status.profiles.length === 0 && <p className="settings-hint">Create a profile first.</p>}
        {status.profiles.map(p => (
          <div className="form-group" key={p.id}>
            <label className="form-label">{p.label}</label>
            <select className="form-input" value={p.ghUser ?? ''} disabled={!ready || busy}
              onChange={e => run(() => window.api.gh.setProfileAccount(p.id, e.target.value || null))}>
              <option value="">— none —</option>
              {accounts.map(a => <option key={a.login} value={a.login}>{a.login}</option>)}
              {p.ghUser && !accounts.some(a => a.login === p.ghUser) && (
                <option value={p.ghUser}>{p.ghUser} (not logged in)</option>
              )}
            </select>
          </div>
        ))}
      </div>

      <div className="pixel-card mb-md">
        <h2 className="section-title">◈ Coding Agents</h2>
        <p className="settings-hint">
          Block <code>gh auth switch</code> in each agent's global settings so an agent can't flip the account
          another session is using. A guardrail, not a security boundary.
        </p>
        {agents.map(a => (
          <div className="detected-box mt-md" key={a.id}>
            <p className="pixel-card__info">
              <strong>{a.name}</strong> · {a.detected ? 'detected' : 'not detected'}
              {a.detected && (a.blocked ? ' · ● blocked' : ' · ○ not blocked')}
            </p>
            {a.manualSnippet && (
              <>
                <p className="settings-hint"><code>{a.file}</code> isn't plain JSON, so it won't be edited. Add this by hand:</p>
                <pre className="settings-hint">{a.manualSnippet}</pre>
              </>
            )}
            {a.detected && !a.manualSnippet && (
              <div className="btn-row mb-0">
                {a.blocked
                  ? <button className="btn btn--danger btn--sm" disabled={busy} onClick={() => run(() => window.api.agents.remove(a.id as AgentId))}>✕ Remove</button>
                  : <button className="btn btn--primary btn--sm" disabled={!ready || busy} onClick={() => run(() => window.api.agents.apply(a.id))}>➕ Apply</button>}
              </div>
            )}
          </div>
        ))}
        <div className="btn-row mt-md mb-0">
          <button className="btn btn--primary btn--sm" disabled={!ready || busy || !agents.some(a => a.detected && !a.blocked)}
            onClick={() => run(() => window.api.agents.apply('all'))}>
            ➕ Apply to all detected
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the route and nav link**

In `src/renderer/App.tsx`: add `import GitHubCLI from './screens/GitHubCLI'`; after the SSH Keys `NavLink`:

```tsx
            <NavLink
              to="/gh"
              className={({ isActive }) =>
                `nav-bar__link${isActive ? ' nav-bar__link--active' : ''}`
              }
            >
              ♦ GitHub CLI
            </NavLink>
```

and inside `<Routes>`, after the `/ssh` route:

```tsx
              <Route path="/gh" element={<GitHubCLI />} />
```

- [ ] **Step 3: Typecheck, test, build**

Run: `npm run typecheck && npm run test:run && npm run build:ci`
Expected: all succeed.

- [ ] **Step 4: Manual check in the running app (Linux dev machine)**

Run: `npm run dev`, open the **GitHub CLI** tab, then verify:
1. It shows the gh version and both accounts.
2. **Install** → `~/.local/bin/gh` exists with the marker; status shows ● and the real gh path.
3. Link profile A → account 1, profile B → account 2. In a repo under B's mapped folder: `gh api user --jq .login` prints account 2; in a repo under A's: account 1. `gh auth status` still shows the unchanged active account.
4. Edit profile B in the Profiles tab (change the name), save, and check the link in the GitHub CLI tab survived.
5. **Apply** for Claude Code → `~/.claude/settings.json` gains `Bash(gh auth switch:*)` and keeps your other keys; **Remove** takes it out again.
6. **Remove** the wrapper → `~/.local/bin/gh` is gone; `which gh` is the real one.

Expected: all six hold. Note anything that doesn't in the task report.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/screens/GitHubCLI.tsx src/renderer/App.tsx
git commit -m "feat(ui): GitHub CLI tab for gh accounts, wrapper and agent rules"
```

---

### Task 8: CI on three OSes, docs, graph refresh

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md` (Features table + new section after "How It Works")
- Regenerate: `graphify-out/`

- [ ] **Step 1: Add the OS matrix**

Replace the `validate` job header and the build step in `.github/workflows/ci.yml`:

```yaml
jobs:
  validate:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
```

```yaml
      - name: Build app bundles
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:ci
```

(Checkout, setup-node, `npm ci`, typecheck and `npm run test:run` stay as they are and now run on all three.)

- [ ] **Step 2: Document the feature**

Add a row to the README Features table:

```markdown
| **gh account per folder** | Link each profile to a GitHub CLI account; `gh` follows the folder's profile, and coding agents can be kept from running `gh auth switch`. |
```

Add a section after "How It Works":

````markdown
## GitHub CLI Accounts

`gh` keeps one active account for every terminal, so `gh auth switch` in one
session changes it for all of them. The **GitHub CLI** tab fixes that:

1. Link each profile to one of your logged-in github.com accounts. The app
   writes it as `profileswitcher.ghUser` into the same per-folder config files
   it already manages.
2. Install the wrapper: a small `gh` placed ahead of the real one on your PATH
   (`~/.local/bin/gh`, or `%LOCALAPPDATA%\git-profile-switcher\bin` on Windows).
   It runs gh with `GH_TOKEN` for the linked account. A `GH_TOKEN` you set
   yourself always wins, and `gh auth …` commands pass through untouched.
3. Optionally block `gh auth switch` in Claude Code, Codex, Cursor, GitHub
   Copilot CLI, Gemini CLI and OpenCode, so an agent can't flip the account
   another session relies on.

Requires gh with two or more accounts (`gh auth login`). Only github.com is
supported. Git over HTTPS through `gh auth git-credential` is not routed through
the wrapper; SSH remotes (what this app manages) are unaffected.
````

- [ ] **Step 3: Commit CI and docs**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: run tests on Linux, macOS and Windows; docs: GitHub CLI accounts"
```

- [ ] **Step 4: Refresh the knowledge graph**

Run: `graphify update .`
Then:

```bash
git add graphify-out
git commit -m "chore(graphify): refresh knowledge graph after gh account per profile"
```

- [ ] **Step 5: Push and watch CI**

Ask the user before pushing (`git push -u origin feat/gh-account-per-profile`). After the push, if a **pre-existing** test fails only on Windows or macOS, fix it minimally if the cause is obvious (e.g. path separators); otherwise mark it `it.skipIf(process.platform === 'win32')` with a one-line reason and report it to the user. Never skip the new tests.
