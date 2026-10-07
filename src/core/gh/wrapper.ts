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
