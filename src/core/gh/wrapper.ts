import { chmod, mkdir, open, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { posix, win32 } from 'node:path'
import { expandWinEnv } from './windowsPath'

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
case "$1:$2" in
  # These refuse to run while GH_TOKEN is set; everything else, including
  # \`auth token\` and \`auth status\`, answers as the linked account.
  auth:login|auth:logout|auth:switch|auth:refresh) ;;
  # No account needed: skip the git config + keyring lookup on every keystroke.
  __complete*|completion:*|help:*|version:*|--version:*|--help:*|-h:*) ;;
  *)
    if [ -z "$GH_TOKEN$GITHUB_TOKEN" ]; then
      u=$(git config --get profileswitcher.ghUser 2>/dev/null)
      if [ -n "$u" ]; then
        t=$("$REAL_GH" auth token --user "$u" 2>/dev/null) && [ -n "$t" ] && GH_TOKEN=$t && export GH_TOKEN
      fi
    fi
    ;;
esac
exec "$REAL_GH" "$@"
`
}

export function cmdWrapper(realGh: string): string {
  return [
    '@echo off',
    `rem ${WRAPPER_MARKER} - do not edit.`,
    'setlocal',
    `set "REAL_GH=${realGh}"`,
    'set "GPS_GH_USER="',
    'if not "%GH_TOKEN%%GITHUB_TOKEN%"=="" goto run',
    // These refuse to run while GH_TOKEN is set.
    'if /i "%~1"=="auth" if /i "%~2"=="login" goto run',
    'if /i "%~1"=="auth" if /i "%~2"=="logout" goto run',
    'if /i "%~1"=="auth" if /i "%~2"=="switch" goto run',
    'if /i "%~1"=="auth" if /i "%~2"=="refresh" goto run',
    // No account needed.
    'if /i "%~1"=="__complete" goto run',
    'if /i "%~1"=="completion" goto run',
    'if /i "%~1"=="help" goto run',
    'if /i "%~1"=="version" goto run',
    'if /i "%~1"=="--version" goto run',
    'if /i "%~1"=="--help" goto run',
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

/**
 * Every gh on PATH, in PATH order (gh.exe on Windows, an executable file
 * elsewhere). Walked in Node: `where` prints in the console code page, which
 * mangles C:\Users\José, and `which` isn't always installed.
 */
export async function findGhCandidates(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): Promise<string[]> {
  const p = platform === 'win32' ? win32 : posix
  const key = Object.keys(env).find(k => k.toUpperCase() === 'PATH')
  const dirs = (key ? env[key] ?? '' : '').split(p.delimiter).map(d => d.replace(/^"(.*)"$/, '$1')).filter(Boolean)
  const found: string[] = []
  for (const dir of dirs) {
    const candidate = p.join(dir, platform === 'win32' ? 'gh.exe' : 'gh')
    const runnable = await stat(candidate).then(
      s => s.isFile() && (platform === 'win32' || (s.mode & 0o111) !== 0),
      () => false
    )
    if (runnable) found.push(candidate)
  }
  return found
}

/**
 * cmd reads .cmd files in the OEM code page, so a non-ASCII path baked into
 * gh.cmd (C:\Users\José\…) would be misread and every gh call would fail. Swap
 * the profile folder for its %VAR%, which cmd expands at run time; refuse what
 * is still non-ASCII.
 */
export function cmdSafePath(realGh: string, env: NodeJS.ProcessEnv): string {
  const nonAscii = /[^\x00-\x7f]/
  if (!nonAscii.test(realGh)) return realGh
  const vars = ['LOCALAPPDATA', 'APPDATA', 'USERPROFILE']
    .map(name => ({ name, value: env[Object.keys(env).find(k => k.toUpperCase() === name) ?? '']?.replace(/[\\/]+$/, '') }))
    .filter((v): v is { name: string; value: string } => !!v.value)
    .sort((a, b) => b.value.length - a.value.length) // most specific folder first
  const hit = vars.find(v => realGh.toLowerCase().startsWith(v.value.toLowerCase() + '\\'))
  const out = hit ? `%${hit.name}%${realGh.slice(hit.value.length)}` : realGh
  if (nonAscii.test(out)) {
    throw new Error(`gh is installed under a non-ASCII path cmd can't read (${realGh}). Install gh under an ASCII path to use the wrapper from cmd and PowerShell.`)
  }
  return out
}

/** True when the file is one of our wrappers, whatever path it was reached through. */
export async function isWrapperFile(path: string): Promise<boolean> {
  let fh
  try {
    fh = await open(path, 'r')
    const buf = Buffer.alloc(4096)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    return buf.subarray(0, bytesRead).toString('utf-8').includes(WRAPPER_MARKER)
  } catch {
    return false
  } finally {
    await fh?.close()
  }
}

/**
 * The real gh on PATH. Skips our wrapper dir and, via the marker, the wrapper
 * reached through any other spelling (symlinked dir, symlinked home) — baking
 * the wrapper into itself would make every gh call hang.
 */
export async function findRealGh(
  env: NodeJS.ProcessEnv,
  wrapperDir: string,
  platform: NodeJS.Platform
): Promise<string | null> {
  const candidates: string[] = []
  for (const c of await findGhCandidates(env, platform)) {
    if (!(await isWrapperFile(c))) candidates.push(c)
  }
  return pickRealGh(candidates, wrapperDir, platform)
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
  const baked = installed && primary ? readBakedRealGh(primary) : null
  // gh.cmd may hold %USERPROFILE%-style prefixes (see cmdSafePath).
  const realGh = baked && platform === 'win32' ? expandWinEnv(baked, env) : baked
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
  const realGh = await findRealGh(env, layout.dir, platform)
  if (!realGh) throw new Error('gh was not found on PATH.')

  // Build every file first so a refused path (cmdSafePath) writes nothing.
  const contents = layout.files.map(f => f.kind === 'cmd'
    ? cmdWrapper(cmdSafePath(realGh, env))
    : posixWrapper(platform === 'win32' ? toMsysPath(realGh) : realGh))
  await mkdir(layout.dir, { recursive: true })
  for (const [i, f] of layout.files.entries()) {
    await writeFile(f.path, contents[i], 'utf-8')
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
