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
