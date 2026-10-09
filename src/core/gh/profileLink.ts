import { Profile, ProfileAdvanced, ProfileInput } from '../profiles/schema'
import { loadProfiles, saveProfiles } from '../profiles/storage'
import { syncManagedGitconfig } from '../git/folderConfigs'
import { bareHostFromAlias } from '../git/identity'

// advanced.ghUser: undefined = never chosen (auto-linking may fill it),
// '' = explicitly none, anything else = a gh login.

/**
 * The gh account link is owned by the GitHub CLI tab; the profile form rebuilds
 * `advanced` without it. Carry the existing link over unless the input sets one.
 */
export function keepGhUser(existing: Profile, input: ProfileInput): ProfileInput {
  const ghUser = existing.advanced?.ghUser
  if (ghUser === undefined || input.advanced?.ghUser !== undefined) return input
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
    const advanced: ProfileAdvanced = { ...p.advanced, ghUser: login ?? '' }
    return { ...p, advanced, updatedAt: now }
  })
}

/** "github.com-diegoauyon" → "diegoauyon". Other hosts' aliases say nothing about a GitHub login. */
function githubAliasAccount(alias: string | undefined): string | undefined {
  if (!alias || bareHostFromAlias(alias) !== 'github.com' || alias === 'github.com') return undefined
  return alias.slice('github.com-'.length)
}

/**
 * The gh login a profile's names point to: its label, its SSH alias account,
 * and its user.name — unless another profile shares that user.name, since then
 * it can't tell them apart. Case-insensitive; null when none match or they disagree.
 */
export function matchGhAccount(profile: Profile, logins: string[], allProfiles: Profile[] = [profile]): string | null {
  const userName = profile.userName.toLowerCase()
  const nameShared = allProfiles.filter(p => p.userName.toLowerCase() === userName).length > 1
  const names = [profile.label, githubAliasAccount(profile.advanced?.sshHost), nameShared ? undefined : profile.userName]
    .filter((n): n is string => !!n)
    .map(n => n.toLowerCase())
  const hits = logins.filter(l => names.includes(l.toLowerCase()))
  return hits.length === 1 ? hits[0] : null
}

/** The matching account, offered only when the profile is linked to a different one. */
export function suggestGhAccount(profile: Profile, logins: string[], allProfiles: Profile[]): string | null {
  const linked = profile.advanced?.ghUser
  if (!linked) return null // never chosen (auto-link handles it) or an explicit "none"
  const match = matchGhAccount(profile, logins, allProfiles)
  return match && match !== linked ? match : null
}

/**
 * Auto-link, save, and sync the gitconfig files. If the sync fails, the save is
 * rolled back so the next load retries instead of showing a link the gh wrapper
 * can't see.
 */
export async function autoLinkAndSync(
  userDataPath: string,
  logins: string[],
  now: string,
  sync: (userDataPath: string) => Promise<void> = syncManagedGitconfig
): Promise<{ profiles: Profile[]; linked: { label: string; login: string }[]; error: string | null }> {
  const original = await loadProfiles(userDataPath)
  const { profiles, linked } = autoLinkGhAccounts(original, logins, now)
  if (!linked.length) return { profiles: original, linked, error: null }
  await saveProfiles(userDataPath, profiles)
  try {
    await sync(userDataPath)
    return { profiles, linked, error: null }
  } catch (e: any) {
    await saveProfiles(userDataPath, original)
    // Files written before the failure would keep the rolled-back link: rewrite them.
    await sync(userDataPath).catch(() => {})
    return { profiles: original, linked: [], error: `Couldn't link gh accounts automatically: ${e?.message ?? e}` }
  }
}

/** Link every profile that never had a gh choice to the account its names match. */
export function autoLinkGhAccounts(
  profiles: Profile[],
  logins: string[],
  now: string
): { profiles: Profile[]; linked: { label: string; login: string }[] } {
  const linked: { label: string; login: string }[] = []
  const next = profiles.map(p => {
    if (p.advanced?.ghUser !== undefined) return p
    const login = matchGhAccount(p, logins, profiles)
    if (!login) return p
    linked.push({ label: p.label, login })
    return { ...p, advanced: { ...p.advanced, ghUser: login }, updatedAt: now }
  })
  return { profiles: next, linked }
}
