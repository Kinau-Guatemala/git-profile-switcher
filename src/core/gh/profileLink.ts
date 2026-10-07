import { Profile, ProfileAdvanced, ProfileInput } from '../profiles/schema'

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

/** "github.com-diegoauyon" → "diegoauyon": the account part of the app's alias convention. */
function aliasAccount(alias: string | undefined): string | undefined {
  const dash = alias?.indexOf('-') ?? -1
  return alias && dash !== -1 ? alias.slice(dash + 1) : undefined
}

/**
 * The gh login a profile's names point to: its label, user.name, or SSH alias
 * account, compared case-insensitively. Null when none match or they disagree.
 */
export function matchGhAccount(profile: Profile, logins: string[]): string | null {
  const names = [profile.label, profile.userName, aliasAccount(profile.advanced?.sshHost)]
    .filter((n): n is string => !!n)
    .map(n => n.toLowerCase())
  const hits = logins.filter(l => names.includes(l.toLowerCase()))
  return hits.length === 1 ? hits[0] : null
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
    const login = matchGhAccount(p, logins)
    if (!login) return p
    linked.push({ label: p.label, login })
    return { ...p, advanced: { ...p.advanced, ghUser: login }, updatedAt: now }
  })
  return { profiles: next, linked }
}
