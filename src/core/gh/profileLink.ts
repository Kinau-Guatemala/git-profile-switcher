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
