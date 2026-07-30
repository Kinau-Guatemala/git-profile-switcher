import { homedir } from 'node:os'
import { join } from 'node:path'
import { mkdir, writeFile, readdir, rm } from 'node:fs/promises'
import { loadProfiles } from '../profiles/storage'
import { loadState } from '../profiles/state'
import { applyProfile } from './identity'
import {
  buildManagedRegion,
  ensureManagedFile,
  writeManagedRegion,
  RegionEntry
} from './managedInclude'

export function folderConfigDir(userDataPath: string): string {
  return join(userDataPath, 'folder-configs')
}

export function folderConfigPath(userDataPath: string, profileId: string): string {
  return join(folderConfigDir(userDataPath), `${profileId}.gitconfig`)
}

/**
 * Regenerate everything the app owns from the current state + profiles:
 *   1. the global managed file (~/.git-profile-switcher) for the active profile,
 *   2. one per-profile managed file for each referenced folder mapping (pruning
 *      files that are no longer referenced),
 *   3. the marker-delimited region in ~/.gitconfig wiring it all together.
 *
 * This is the single entry point all mutations (apply, toggle, folder add/remove,
 * profile save/delete) call so on-disk git config can never drift from app state.
 */
export async function syncManagedGitconfig(
  userDataPath: string,
  opts?: { home?: string }
): Promise<void> {
  const home = opts?.home ?? homedir()
  const state = await loadState(userDataPath)
  const profiles = await loadProfiles(userDataPath)

  // 1. Global managed file for the active profile (empty if none selected).
  const paths = await ensureManagedFile(home)
  const active = profiles.find(p => p.id === state.activeProfileId)
  if (active) {
    await applyProfile(active, paths.managedPath, profiles)
  } else {
    await writeFile(paths.managedPath, '', 'utf-8')
  }

  // 2. Per-folder config files. Ignore mappings whose profile no longer exists.
  const dir = folderConfigDir(userDataPath)
  await mkdir(dir, { recursive: true })

  const validMappings = state.folderMappings.filter(m =>
    profiles.some(p => p.id === m.profileId)
  )
  const referencedIds = new Set(validMappings.map(m => m.profileId))

  for (const id of referencedIds) {
    const profile = profiles.find(p => p.id === id)!
    await applyProfile(profile, folderConfigPath(userDataPath, id), profiles)
  }

  // Prune managed folder-config files that are no longer referenced.
  const existing = await readdir(dir).catch(() => [] as string[])
  for (const file of existing) {
    if (!file.endsWith('.gitconfig')) continue
    const id = file.slice(0, -'.gitconfig'.length)
    if (!referencedIds.has(id)) {
      await rm(join(dir, file), { force: true })
    }
  }

  // 3. Rewrite the managed region in ~/.gitconfig.
  const entries: RegionEntry[] = validMappings.map(m => ({
    gitdir: m.path,
    configPath: folderConfigPath(userDataPath, m.profileId)
  }))
  const region = buildManagedRegion({
    includeGlobal: state.applyGlobally,
    managedPath: paths.managedPath,
    entries
  })
  await writeManagedRegion(region, state.includePosition, home)
}
