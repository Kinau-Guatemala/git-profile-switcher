import { describe, it, expect } from 'vitest'
import { access } from 'node:fs/promises'
import { verifyProfile } from './profileVerify'
import { Profile } from '../profiles/schema'

function makeProfile(over: Partial<Profile> & { label: string }): Profile {
  return {
    id: '00000000-0000-0000-0000-000000000000',
    userName: 'x',
    userEmail: 'x@example.com',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...over
  } as Profile
}

describe('verifyProfile', () => {
  it('previews what applying the profile would write, without touching real config', async () => {
    const personal = makeProfile({
      label: 'personal',
      userName: 'Jamie Rivera',
      userEmail: 'jamie@example.com',
      advanced: { sshHost: 'github.com-personal', sshKeyPath: '~/.ssh/personal_key' }
    })
    const work = makeProfile({
      label: 'work',
      userEmail: 'jamie@example.org',
      advanced: { sshHost: 'github.com-work', sshKeyPath: '~/.ssh/id_ed25519' }
    })

    const result = await verifyProfile(personal, [personal, work])

    expect(result.effectiveName).toBe('Jamie Rivera')
    expect(result.effectiveEmail).toBe('jamie@example.com')
    expect(result.warnings[0]).toContain('Preview only')

    const values = result.origins.map(o => `${o.key}=${o.value}`)
    expect(values).toContain('core.sshcommand=ssh -i ~/.ssh/personal_key -o IdentitiesOnly=yes')
    expect(values).toContain('url.git@github.com:.insteadof=git@github.com-work:')
  })

  it('cleans up the scratch preview file after reading it', async () => {
    const profile = makeProfile({ label: 'solo', advanced: { signingKey: 'ABC123' } })
    const result = await verifyProfile(profile, [profile])

    const previewFile = result.origins[0]?.originFile
    expect(previewFile).toBeTruthy()
    await expect(access(previewFile)).rejects.toThrow()
  })
})
