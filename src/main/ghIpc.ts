import { ipcMain } from 'electron'
import { homedir } from 'node:os'
import { join, win32 } from 'node:path'
import { loadProfiles, saveProfiles } from '../core/profiles/storage'
import { syncManagedGitconfig } from '../core/git/folderConfigs'
import { setProfileGhUser, autoLinkGhAccounts, matchGhAccount } from '../core/gh/profileLink'
import { userShellEnv } from '../core/gh/shellEnv'
import { getGhStatus, GhStatus } from '../core/gh/ghStatus'
import { wrapperLayout, wrapperStatus, installWrapper, removeWrapper, pathHint, findRealGh, WrapperStatus } from '../core/gh/wrapper'
import { readRegistryPath, writeRegistryPath, hasPathEntry, prependPathEntry, removePathEntry } from '../core/gh/windowsPath'
import { agentStatuses, applyAgentRule, removeAgentRule, assertAgentId, AgentEnv, AgentId } from '../core/agents/agents'

export interface GhTabStatus {
  platform: NodeJS.Platform
  gh: GhStatus
  wrapper: WrapperStatus
  resolvesToWrapper: boolean
  pathHint: string | null
  windows: { userPathHasDir: boolean; machinePathHasDir: boolean; realGhOnMachinePath: boolean } | null
  /** Profiles linked by name during this status call. */
  autoLinked: { label: string; login: string }[]
  /** suggested: the account the profile's names match, when it differs from the link. */
  profiles: { id: string; label: string; ghUser: string | null; suggested: string | null }[]
}

// Same error normalization as ipc.ts: always reject with a plain Error message.
function handle(channel: string, fn: (...args: any[]) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await fn(...args)
    } catch (error: any) {
      throw new Error(error?.message ?? String(error))
    }
  })
}

export function registerGhIpc(userDataPath: string): void {
  const platform = process.platform
  const layout = wrapperLayout(platform, homedir(), process.env.LOCALAPPDATA)
  const agentEnv: AgentEnv = { home: homedir(), platform, hookDir: join(userDataPath, 'agent-hooks') }

  // Always ask the real gh: the wrapper may be broken, and in a linked folder it
  // would answer as a single account.
  async function realGhStatus(env: NodeJS.ProcessEnv): Promise<GhStatus> {
    return getGhStatus(env, await findRealGh(env, layout.dir, platform))
  }

  async function requireMultiAccount() {
    const gh = await realGhStatus(await userShellEnv())
    if (gh.kind !== 'ok' || gh.accounts.length < 2) {
      throw new Error('This needs gh with two or more github.com accounts logged in.')
    }
    return gh
  }

  async function status(): Promise<GhTabStatus> {
    const env = await userShellEnv()
    const [gh, wrapper] = await Promise.all([realGhStatus(env), wrapperStatus(layout, env, platform)])
    const logins = gh.kind === 'ok' && gh.accounts.length >= 2 ? gh.accounts.map(a => a.login) : []

    // Profiles that never had a gh choice get linked to the account their names match.
    let profiles = await loadProfiles(userDataPath)
    let autoLinked: GhTabStatus['autoLinked'] = []
    if (logins.length) {
      const result = autoLinkGhAccounts(profiles, logins, new Date().toISOString())
      if (result.linked.length) {
        await saveProfiles(userDataPath, result.profiles)
        await syncManagedGitconfig(userDataPath)
        profiles = result.profiles
        autoLinked = result.linked
      }
    }

    let windows: GhTabStatus['windows'] = null
    let resolvesToWrapper: boolean
    if (platform === 'win32') {
      // process.env.PATH is frozen at launch; the registry is the truth for new terminals.
      const [user, machine] = await Promise.all([readRegistryPath('User'), readRegistryPath('Machine')])
      const realDir = wrapper.realGh ? win32.dirname(wrapper.realGh) : null
      windows = {
        userPathHasDir: hasPathEntry(user, layout.dir),
        machinePathHasDir: hasPathEntry(machine, layout.dir),
        realGhOnMachinePath: realDir ? hasPathEntry(machine, realDir) : false
      }
      resolvesToWrapper = wrapper.installed &&
        (windows.machinePathHasDir || (windows.userPathHasDir && !windows.realGhOnMachinePath))
    } else {
      resolvesToWrapper = wrapper.installed && wrapper.firstGh === layout.files[0].path
    }

    return {
      platform, gh, wrapper, resolvesToWrapper, windows,
      pathHint: platform === 'win32' ? null : pathHint(process.env.SHELL, layout.dir, platform),
      autoLinked,
      profiles: profiles.map(p => {
        const ghUser = p.advanced?.ghUser || null // '' is an explicit "none"
        const match = logins.length ? matchGhAccount(p, logins) : null
        return { id: p.id, label: p.label, ghUser, suggested: match && match !== ghUser ? match : null }
      })
    }
  }

  handle('gh:status', status)

  handle('gh:setProfileAccount', async (profileId: string, login: string | null) => {
    if (login !== null) {
      const gh = await requireMultiAccount()
      if (!gh.accounts.some(a => a.login === login)) throw new Error(`gh account "${login}" is not logged in.`)
    }
    const profiles = await loadProfiles(userDataPath)
    await saveProfiles(userDataPath, setProfileGhUser(profiles, profileId, login, new Date().toISOString()))
    await syncManagedGitconfig(userDataPath)
    return { ok: true as const }
  })

  handle('gh:installWrapper', async () => {
    await requireMultiAccount()
    await installWrapper(layout, await userShellEnv(), platform)
    if (platform === 'win32') {
      await writeRegistryPath('User', prependPathEntry(await readRegistryPath('User'), layout.dir))
    }
    return status()
  })

  handle('gh:removeWrapper', async () => {
    await removeWrapper(layout)
    if (platform === 'win32') {
      const user = await readRegistryPath('User')
      if (hasPathEntry(user, layout.dir)) await writeRegistryPath('User', removePathEntry(user, layout.dir))
      const machine = await readRegistryPath('Machine')
      if (hasPathEntry(machine, layout.dir)) await writeRegistryPath('Machine', removePathEntry(machine, layout.dir))
    }
    return status()
  })

  handle('gh:elevateSystemPath', async () => {
    if (platform !== 'win32') throw new Error('Only needed on Windows.')
    await writeRegistryPath('Machine', prependPathEntry(await readRegistryPath('Machine'), layout.dir))
    return status()
  })

  handle('agents:status', () => agentStatuses(agentEnv))

  handle('agents:apply', async (id: string) => {
    await requireMultiAccount()
    const ids: AgentId[] = id === 'all'
      ? (await agentStatuses(agentEnv)).filter(s => s.detected).map(s => s.id)
      : [assertAgentId(id)]
    // Apply every agent even if one fails, then report all failures together.
    const errors: string[] = []
    for (const agentId of ids) {
      try {
        await applyAgentRule(agentId, agentEnv)
      } catch (e: any) {
        errors.push(e.message)
      }
    }
    if (errors.length) throw new Error(errors.join('\n\n'))
    return agentStatuses(agentEnv)
  })

  handle('agents:remove', async (id: string) => {
    await removeAgentRule(assertAgentId(id), agentEnv)
    return agentStatuses(agentEnv)
  })
}
