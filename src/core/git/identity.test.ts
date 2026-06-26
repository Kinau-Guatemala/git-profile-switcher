import { describe, it, expect, afterEach } from 'vitest'
import { readFile, rm, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyProfile, bareHostFromAlias, aliasRewriteSources } from './identity'
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

describe('bareHostFromAlias', () => {
  it('strips the account label after the first dash', () => {
    expect(bareHostFromAlias('github.com-diegoauyon')).toBe('github.com')
    expect(bareHostFromAlias('github.com-diegoauyon-styleseat')).toBe('github.com')
  })

  it('returns a bare host unchanged', () => {
    expect(bareHostFromAlias('github.com')).toBe('github.com')
  })
})

describe('aliasRewriteSources', () => {
  const personal = makeProfile({ label: 'p', advanced: { sshHost: 'github.com-diegoauyon' } })
  const work = makeProfile({ label: 'w', advanced: { sshHost: 'github.com-diegoauyon-styleseat' } })

  it('lists every profile alias to normalize back to the bare host', () => {
    expect(aliasRewriteSources('github.com', [personal, work])).toEqual([
      'git@github.com-diegoauyon-styleseat:',
      'git@github.com-diegoauyon:'
    ])
  })
})

describe('applyProfile', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('forces the profile key via core.sshCommand and normalizes aliases to plain', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-'))
    const managed = join(dir, '.gitconfig-switcher')

    const personal = makeProfile({
      label: 'personal',
      userName: 'diegoauyon',
      userEmail: 'diegoauyon@gmail.com',
      // sshKeyPath set explicitly so the test does not depend on `ssh -G`.
      advanced: { sshHost: 'github.com-diegoauyon', sshKeyPath: '~/.ssh/personal_key' }
    })
    const work = makeProfile({
      label: 'work',
      advanced: { sshHost: 'github.com-diegoauyon-styleseat', sshKeyPath: '~/.ssh/id_ed25519' }
    })

    await applyProfile(personal, managed, [personal, work])
    const content = await readFile(managed, 'utf-8')

    expect(content).toContain('email = diegoauyon@gmail.com')
    expect(content).toContain('sshCommand = ssh -i ~/.ssh/personal_key -o IdentitiesOnly=yes')
    expect(content).toContain('[url "git@github.com:"]')
    // The other profile's alias is normalized to the plain host.
    expect(content).toContain('insteadOf = git@github.com-diegoauyon-styleseat:')
  })

  it('truncates stale config from a previously-active profile on re-apply', async () => {
    dir = await mkdtemp(join(tmpdir(), 'gps-'))
    const managed = join(dir, '.gitconfig-switcher')

    const work = makeProfile({
      label: 'work',
      userEmail: 'work@styleseat.com',
      advanced: { sshHost: 'github.com-diegoauyon-styleseat', sshKeyPath: '~/.ssh/id_ed25519', signingKey: 'ABC123' }
    })
    const personal = makeProfile({
      label: 'personal',
      userEmail: 'diegoauyon@gmail.com',
      advanced: { sshHost: 'github.com-diegoauyon', sshKeyPath: '~/.ssh/personal_key' }
    })

    await applyProfile(work, managed, [personal, work])
    await applyProfile(personal, managed, [personal, work])
    const content = await readFile(managed, 'utf-8')

    expect(content).toContain('email = diegoauyon@gmail.com')
    expect(content).toContain('sshCommand = ssh -i ~/.ssh/personal_key -o IdentitiesOnly=yes')
    expect(content).not.toContain('work@styleseat.com')
    expect(content).not.toContain('ABC123')
    expect(content).not.toContain('id_ed25519')
  })
})
