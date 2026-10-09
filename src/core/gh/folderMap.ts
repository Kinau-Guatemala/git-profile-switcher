import { realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { cmdSafePath, toMsysPath, GH_FOLDER_MAP, GH_FOLDER_MAP_CMD } from './wrapper'

// git's includeIf gitdir: only applies inside a repository, so a mapped folder
// that isn't one (where you run `gh repo clone`) would fall back to the global
// profile. The gh wrapper reads these maps outside repositories instead.
export { GH_FOLDER_MAP, GH_FOLDER_MAP_CMD }

export interface FolderAccount {
  dir: string
  /** gh login, or '' when the folder's profile has no account. */
  login: string
}

const trimSlashes = (p: string) => p.replace(/[\\/]+$/, '')
// "-" stands for no account: shells collapse empty tab-separated fields.
const loginField = (login: string) => login || '-'

/** For the sh wrapper: `login<TAB>folder` per line, folders as `pwd -P` prints them. */
export function shFolderMap(entries: FolderAccount[], platform: NodeJS.Platform): string {
  return entries
    .map(e => `${loginField(e.login)}\t${trimSlashes(platform === 'win32' ? toMsysPath(e.dir) : e.dir)}\n`)
    .join('')
}

/**
 * For gh.cmd: `length<TAB>login<TAB>folder`. Batch has no strlen, so the length
 * of "folder\" is precomputed; non-ASCII user folders become %USERPROFILE%-style
 * variables (cmd reads files in the OEM code page) and other non-ASCII folders
 * are left out.
 */
export function cmdFolderMap(entries: FolderAccount[], env: NodeJS.ProcessEnv): string {
  const lines: string[] = []
  for (const e of entries) {
    const dir = trimSlashes(e.dir)
    let safe: string
    try {
      safe = cmdSafePath(dir, env)
    } catch {
      continue
    }
    lines.push(`${dir.length + 1}\t${loginField(e.login)}\t${safe}\r\n`)
  }
  return lines.join('')
}

/**
 * Write the folder maps in `home`, or remove them when nothing is linked.
 * `anyLinked` counts every profile: a folder whose profile has no account must
 * still override a linked global profile (as the empty includeIf value does).
 */
export async function writeGhFolderMaps(
  home: string,
  entries: FolderAccount[],
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  anyLinked = entries.some(e => e.login)
): Promise<void> {
  const shPath = join(home, GH_FOLDER_MAP)
  const cmdPath = join(home, GH_FOLDER_MAP_CMD)
  if (!entries.length || !anyLinked) {
    await rm(shPath, { force: true })
    await rm(cmdPath, { force: true })
    return
  }
  // Resolve symlinks so entries match `pwd -P` (macOS tmp, symlinked homes).
  const resolved = await Promise.all(entries.map(async e => ({ ...e, dir: await realpath(e.dir).catch(() => e.dir) })))
  await writeFile(shPath, shFolderMap(resolved, platform), 'utf-8')
  if (platform === 'win32') await writeFile(cmdPath, cmdFolderMap(resolved, env), 'utf-8')
  else await rm(cmdPath, { force: true })
}
