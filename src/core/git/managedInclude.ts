import { homedir } from 'node:os'
import { join } from 'node:path'
import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'

export type IncludePosition = 'start' | 'end'

export const REGION_START = '# >>> git-profile-switcher (managed) >>>'
export const REGION_END = '# <<< git-profile-switcher (managed) <<<'

export interface ManagedPaths {
  managedPath: string   // ~/.gitconfig-switcher (global active profile)
  gitconfigPath: string // ~/.gitconfig
}

export function getManagedPaths(home: string = homedir()): ManagedPaths {
  return {
    managedPath: join(home, '.gitconfig-switcher'),
    gitconfigPath: join(home, '.gitconfig')
  }
}

export interface RegionEntry {
  gitdir: string      // absolute folder path (trailing slash added automatically)
  configPath: string  // absolute path to the per-folder managed config file
}

function toForwardSlashes(p: string): string {
  return p.replaceAll('\\', '/')
}

function normalizeGitdir(p: string): string {
  const fwd = toForwardSlashes(p)
  return fwd.endsWith('/') ? fwd : `${fwd}/`
}

/**
 * Pure builder for the marker-delimited region the app owns inside `~/.gitconfig`.
 *
 * The global `[include]` is emitted first (when enabled) and the per-folder
 * `[includeIf "gitdir:..."]` blocks after it, so a folder mapping always wins
 * over the global default inside its directory (git: last value wins).
 */
export function buildManagedRegion(opts: {
  includeGlobal: boolean
  managedPath: string
  entries: RegionEntry[]
}): string {
  const lines: string[] = [REGION_START]

  if (opts.includeGlobal) {
    lines.push('[include]', `\tpath = ${toForwardSlashes(opts.managedPath)}`)
  }

  for (const entry of opts.entries) {
    lines.push(
      `[includeIf "gitdir:${normalizeGitdir(entry.gitdir)}"]`,
      `\tpath = ${toForwardSlashes(entry.configPath)}`
    )
  }

  lines.push(REGION_END)
  return lines.join('\n')
}

/** Remove the marker-delimited region (if present) from gitconfig content. */
export function stripManagedRegion(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []
  let inRegion = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === REGION_START) {
      inRegion = true
      continue
    }
    if (trimmed === REGION_END) {
      inRegion = false
      continue
    }
    if (!inRegion) result.push(line)
  }

  return result.join('\n')
}

/**
 * Remove a legacy `[include]` block that we own (one whose `path =` lines all
 * resolve to the managed switcher file). This handles configs written by older
 * versions of the app, before the marker region existed. Blocks that mix the
 * managed path with other, user-defined paths are left untouched.
 */
export function stripManagedInclude(content: string, absolutePath: string): string {
  const managedTargets = new Set([
    absolutePath,
    toForwardSlashes(absolutePath),
    '~/.gitconfig-switcher',
    '.gitconfig-switcher'
  ])

  const lines = content.split('\n')
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^\s*\[include\]\s*$/.test(line)) {
      const pathLines: string[] = []
      let j = i + 1
      while (j < lines.length && /^\s*path\s*=/.test(lines[j])) {
        pathLines.push(lines[j])
        j++
      }

      const allManaged = pathLines.length > 0 && pathLines.every(pl => {
        const match = pl.match(/path\s*=\s*(.+?)\s*$/)
        return match ? managedTargets.has(match[1].trim()) : false
      })

      if (allManaged) {
        i = j - 1
        continue
      }
    }

    result.push(line)
  }

  return result.join('\n')
}

/** Ensure the global managed file exists; return the managed paths. */
export async function ensureManagedFile(home: string = homedir()): Promise<ManagedPaths> {
  const paths = getManagedPaths(home)
  try {
    await access(paths.managedPath, constants.F_OK)
  } catch {
    await writeFile(paths.managedPath, '', 'utf-8')
  }
  return paths
}

/**
 * Write the managed region into `~/.gitconfig` at the chosen position, removing
 * any previous managed region and legacy managed include first. The user's own
 * configuration outside the region is preserved.
 */
export async function writeManagedRegion(
  region: string,
  position: IncludePosition,
  home: string = homedir()
): Promise<ManagedPaths> {
  const paths = await ensureManagedFile(home)

  let gitconfigContent = ''
  try {
    gitconfigContent = await readFile(paths.gitconfigPath, 'utf-8')
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error
  }

  const body = stripManagedRegion(stripManagedInclude(gitconfigContent, paths.managedPath))
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  let newContent: string
  if (position === 'start') {
    newContent = body ? `${region}\n\n${body}\n` : `${region}\n`
  } else {
    newContent = body ? `${body}\n\n${region}\n` : `${region}\n`
  }

  if (newContent !== gitconfigContent) {
    await writeFile(paths.gitconfigPath, newContent, 'utf-8')
  }

  return paths
}
