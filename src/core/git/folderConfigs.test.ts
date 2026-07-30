import { describe, it, expect, afterEach } from 'vitest'
import { readFile, rm, mkdtemp, mkdir, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { saveProfiles } from '../profiles/storage'
import { saveState, AppState } from '../profiles/state'
import { Profile } from '../profiles/schema'
import { syncManagedGitconfig, folderConfigPath, folderConfigDir } from './folderConfigs'
import { REGION_START } from './managedInclude'

const PERSONAL_ID = '11111111-1111-1111-1111-111111111111'
const WORK_ID = '22222222-2222-2222-2222-222222222222'

function profile(id: string, label: string, email: string, sshHost: string, sshKeyPath: string): Profile {
  return {
    id,
    label,
    userName: label,
    userEmail: email,
    // sshKeyPath set explicitly so the test does not depend on `ssh -G`.
    advanced: { sshHost, sshKeyPath },
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z'
  }
}

const profiles: Profile[] = [
  profile(PERSONAL_ID, 'personal', 'me@personal.com', 'github.com-me', '~/.ssh/personal'),
  profile(WORK_ID, 'work', 'me@work.com', 'github.com-me-work', '~/.ssh/work')
]

function state(over: Partial<AppState>): AppState {
  return {
    activeProfileId: PERSONAL_ID,
    undoStack: [],
    includePosition: 'end',
    applyGlobally: true,
    folderMappings: [],
    ...over
  }
}

describe('syncManagedGitconfig', () => {
  let home: string
  let userData: string

  async function setup(s: AppState) {
    home = await mkdtemp(join(tmpdir(), 'gps-home-'))
    userData = await mkdtemp(join(tmpdir(), 'gps-data-'))
    await saveProfiles(userData, profiles)
    await saveState(userData, s)
  }

  afterEach(async () => {
    if (home) await rm(home, { recursive: true, force: true })
    if (userData) await rm(userData, { recursive: true, force: true })
  })

  it('writes global include + per-folder includeIf and the folder config file', async () => {
    const workDir = join('/tmp/gps-Dev-work')
    await setup(state({ folderMappings: [{ path: workDir, profileId: WORK_ID }] }))

    await syncManagedGitconfig(userData, { home })

    const gitconfig = await readFile(join(home, '.gitconfig'), 'utf-8')
    expect(gitconfig).toContain(REGION_START)
    expect(gitconfig).toContain('[include]')
    // region paths are always forward-slashed; workDir is backslashed on Windows
    expect(gitconfig).toContain(`[includeIf "gitdir:${workDir.replaceAll('\\', '/')}/"]`)

    // global file = active (personal), forcing the personal key
    const globalFile = await readFile(join(home, '.git-profile-switcher'), 'utf-8')
    expect(globalFile).toContain('me@personal.com')
    expect(globalFile).toContain('sshCommand = ssh -i ~/.ssh/personal -o IdentitiesOnly=yes')

    // folder file = work profile, forcing the work key
    const folderFile = await readFile(folderConfigPath(userData, WORK_ID), 'utf-8')
    expect(folderFile).toContain('me@work.com')
    expect(folderFile).toContain('sshCommand = ssh -i ~/.ssh/work -o IdentitiesOnly=yes')
  })

  it('omits the global include when applyGlobally is off', async () => {
    await setup(state({ applyGlobally: false, folderMappings: [{ path: '/tmp/x', profileId: WORK_ID }] }))
    await syncManagedGitconfig(userData, { home })

    const gitconfig = await readFile(join(home, '.gitconfig'), 'utf-8')
    expect(gitconfig).not.toContain('[include]')
    expect(gitconfig).toContain('[includeIf "gitdir:/tmp/x/"]')
  })

  it('prunes folder config files that are no longer referenced', async () => {
    await setup(state({ folderMappings: [] }))
    // Seed a stale managed folder-config file.
    await mkdir(folderConfigDir(userData), { recursive: true })
    const stale = folderConfigPath(userData, WORK_ID)
    await writeFile(stale, '[user]\n\temail = stale@x.com\n', 'utf-8')

    await syncManagedGitconfig(userData, { home })

    await expect(access(stale)).rejects.toThrow()
  })

  it('ignores folder mappings whose profile was deleted', async () => {
    await setup(state({
      folderMappings: [{ path: '/tmp/gone', profileId: '33333333-3333-3333-3333-333333333333' }]
    }))
    await syncManagedGitconfig(userData, { home })

    const gitconfig = await readFile(join(home, '.gitconfig'), 'utf-8')
    expect(gitconfig).not.toContain('/tmp/gone')
  })
})
