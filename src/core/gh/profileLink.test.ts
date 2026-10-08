import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  keepGhUser, setProfileGhUser, matchGhAccount, autoLinkGhAccounts, suggestGhAccount, autoLinkAndSync
} from './profileLink'
import { Profile } from '../profiles/schema'
import { loadProfiles, saveProfiles } from '../profiles/storage'

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

    // Unlinking is remembered as an explicit "none" so auto-linking won't undo it.
    const unlinked = setProfileGhUser(linked, base.id, null, now)
    expect(unlinked[0].advanced).toEqual({ ghUser: '' })
  })

  it('keeps other advanced settings when unlinking', () => {
    const out = setProfileGhUser([base], base.id, null, base.updatedAt)
    expect(out[0].advanced).toEqual({ sshHost: 'github.com-work', ghUser: '' })
  })

  it('throws for an unknown profile', () => {
    expect(() => setProfileGhUser([base], 'nope', 'x', base.updatedAt)).toThrow('Profile not found')
  })
})

describe('keepGhUser with an explicit "none"', () => {
  it('keeps the explicit none through a profile edit', () => {
    const input = { label: 'Work', userName: 'y', userEmail: 'y@example.com' }
    expect(keepGhUser({ ...base, advanced: { ghUser: '' } }, input).advanced).toEqual({ ghUser: '' })
  })
})

const LOGINS = ['diegoauyon', 'diegoauyon-styleseat']
const profile = (over: Partial<Profile>): Profile => ({ ...base, label: 'Imported Profile 1', userName: 'Diego Auyón', advanced: undefined, ...over })

describe('matchGhAccount', () => {
  it('matches the account part of the SSH alias', () => {
    expect(matchGhAccount(profile({ advanced: { sshHost: 'github.com-diegoauyon' } }), LOGINS)).toBe('diegoauyon')
    expect(matchGhAccount(profile({ advanced: { sshHost: 'github.com-diegoauyon-styleseat' } }), LOGINS)).toBe('diegoauyon-styleseat')
  })

  it('matches the user name or the label, ignoring case', () => {
    expect(matchGhAccount(profile({ userName: 'diegoauyon-styleseat' }), LOGINS)).toBe('diegoauyon-styleseat')
    expect(matchGhAccount(profile({ label: 'DiegoAuyon' }), LOGINS)).toBe('diegoauyon')
  })

  it('gives up when the names point at different accounts', () => {
    expect(matchGhAccount(profile({ userName: 'diegoauyon', advanced: { sshHost: 'github.com-diegoauyon-styleseat' } }), LOGINS)).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchGhAccount(profile({ advanced: { sshHost: 'github.com' } }), LOGINS)).toBeNull()
  })
})

describe('matchGhAccount edge cases', () => {
  it('only reads the account out of a github.com alias', () => {
    expect(matchGhAccount(profile({ advanced: { sshHost: 'gitlab.com-diegoauyon' } }), LOGINS)).toBeNull()
  })

  it('ignores user.name when another profile shares it', () => {
    const personal = profile({ id: '00000000-0000-0000-0000-0000000000a1', userName: 'diegoauyon' })
    const work = profile({ id: '00000000-0000-0000-0000-0000000000a2', label: 'Work', userName: 'diegoauyon' })
    expect(matchGhAccount(work, LOGINS, [personal, work])).toBeNull()
    // Alone, the user name is still a fair signal.
    expect(matchGhAccount(work, LOGINS, [work])).toBe('diegoauyon')
  })
})

describe('suggestGhAccount', () => {
  const p = (ghUser?: string) => profile({ advanced: { sshHost: 'github.com-diegoauyon', ghUser } })

  it('suggests only when the profile is linked to a different account', () => {
    expect(suggestGhAccount(p('diegoauyon-styleseat'), LOGINS, [])).toBe('diegoauyon')
    expect(suggestGhAccount(p('diegoauyon'), LOGINS, [])).toBeNull()
    expect(suggestGhAccount(p(''), LOGINS, [])).toBeNull() // explicit "none" is respected silently
    expect(suggestGhAccount(p(undefined), LOGINS, [])).toBeNull()
  })
})

describe('autoLinkAndSync', () => {
  let dir: string
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }) })
  const now = '2026-10-07T00:00:00.000Z'
  const fresh = () => profile({ advanced: { sshHost: 'github.com-diegoauyon' } })

  it('saves the links and syncs the gitconfig files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-autolink-'))
    await saveProfiles(dir, [fresh()])
    let synced = 0
    const out = await autoLinkAndSync(dir, LOGINS, now, async () => { synced++ })
    expect(out.linked).toEqual([{ label: 'Imported Profile 1', login: 'diegoauyon' }])
    expect(out.error).toBeNull()
    expect(synced).toBe(1)
    expect((await loadProfiles(dir))[0].advanced?.ghUser).toBe('diegoauyon')
  })

  it('rolls the save back when the sync fails, so the next load retries', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-autolink-'))
    await saveProfiles(dir, [fresh()])
    const out = await autoLinkAndSync(dir, LOGINS, now, async () => { throw new Error('.gitconfig is locked') })
    expect(out.linked).toEqual([])
    expect(out.error).toMatch(/locked/)
    expect((await loadProfiles(dir))[0].advanced?.ghUser).toBeUndefined()
  })
})

describe('autoLinkGhAccounts', () => {
  const now = '2026-10-07T00:00:00.000Z'

  it('links only profiles that never had a choice, and reports them', () => {
    const fresh = profile({ id: '00000000-0000-0000-0000-00000000000a', advanced: { sshHost: 'github.com-diegoauyon' } })
    const none = profile({ id: '00000000-0000-0000-0000-00000000000b', advanced: { sshHost: 'github.com-diegoauyon', ghUser: '' } })
    const chosen = profile({ id: '00000000-0000-0000-0000-00000000000c', advanced: { sshHost: 'github.com-diegoauyon', ghUser: 'diegoauyon-styleseat' } })
    const nomatch = profile({ id: '00000000-0000-0000-0000-00000000000d', label: 'Other' })

    const { profiles, linked } = autoLinkGhAccounts([fresh, none, chosen, nomatch], LOGINS, now)

    expect(linked).toEqual([{ label: 'Imported Profile 1', login: 'diegoauyon' }])
    expect(profiles[0].advanced?.ghUser).toBe('diegoauyon')
    expect(profiles[0].updatedAt).toBe(now)
    expect(profiles.slice(1)).toEqual([none, chosen, nomatch])
  })
})
