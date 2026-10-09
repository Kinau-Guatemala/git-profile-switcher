import { ipcMain } from 'electron'
import { homedir } from 'node:os'
import { join, win32 } from 'node:path'
import { loadProfiles, saveProfiles } from '../core/profiles/storage'
import { syncManagedGitconfig } from '../core/git/folderConfigs'
import { setProfileGhUser, autoLinkAndSync, suggestGhAccount } from '../core/gh/profileLink'
import { userShellEnv } from '../core/gh/shellEnv'
import { getGhStatus, GhStatus } from '../core/gh/ghStatus'
import { wrapperLayout, wrapperStatus, installWrapper, removeWrapper, pathHint, findRealGh, isWrapperFile, WrapperStatus } from '../core/gh/wrapper'
import { readRegistryPath, writeRegistryPath, hasPathEntry, prependPathEntry, removePathEntry, PathScope } from '../core/gh/windowsPath'
import { loadPathScopes, savePathScopes } from '../core/gh/pathScopes'
import { agentStatuses, applyAgentRule, removeAgentRule, assertAgentId, AgentEnv, AgentId } from '../core/agents/agents'

export interface GhTabStatus {
  platform: NodeJS.Platform
  gh: GhStatus
  wrapper: WrapperStatus
  resolvesToWrapper: boolean
  pathHint: string | null
  windows: { pathReadable: boolean; userPathHasDir: boolean; machinePathHasDir: boolean; realGhOnMachinePath: boolean } | null
  /** Profiles linked by name during this status call. */
  autoLinked: { label: string; login: string }[]
  autoLinkError: string | null
  /** suggested: the account the profile's names match, when it's linked to a different one. */
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
  const agentEnv: AgentEnv = { home: homedir(), platform, hookDir: join(userDataPath, 'agent-hooks'), vars: process.env }

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

    // Profiles that never had a gh choice get linked to the account their names
    // match. A failed sync is rolled back and reported, never breaking the tab.
    const { profiles, linked: autoLinked, error: autoLinkError } = logins.length
      ? await autoLinkAndSync(userDataPath, logins, new Date().toISOString())
      : { profiles: await loadProfiles(userDataPath), linked: [], error: null }

    let windows: GhTabStatus['windows'] = null
    let resolvesToWrapper: boolean
    if (platform === 'win32') {
      // process.env.PATH is frozen at launch; the registry is the truth for new terminals.
      // A failed read (PowerShell blocked or missing) only costs the PATH check, not the tab.
      const [user, machine] = await Promise.all([
        readRegistryPath('User').catch(() => null),
        readRegistryPath('Machine').catch(() => null)
      ])
      const realDir = wrapper.realGh ? win32.dirname(wrapper.realGh) : null
      windows = {
        pathReadable: user !== null && machine !== null,
        userPathHasDir: user !== null && hasPathEntry(user, layout.dir),
        machinePathHasDir: machine !== null && hasPathEntry(machine, layout.dir),
        realGhOnMachinePath: machine !== null && realDir !== null && hasPathEntry(machine, realDir)
      }
      resolvesToWrapper = wrapper.installed &&
        (windows.machinePathHasDir || (windows.userPathHasDir && !windows.realGhOnMachinePath))
    } else {
      // By marker, not path string: a symlinked dir or home still counts as the wrapper.
      resolvesToWrapper = wrapper.installed && !!wrapper.firstGh && await isWrapperFile(wrapper.firstGh)
    }

    return {
      platform, gh, wrapper, resolvesToWrapper, windows,
      pathHint: platform === 'win32' ? null : pathHint(process.env.SHELL, layout.dir, platform),
      autoLinked,
      autoLinkError,
      profiles: profiles.map(p => ({
        id: p.id,
        label: p.label,
        ghUser: p.advanced?.ghUser || null, // '' is an explicit "none"
        suggested: suggestGhAccount(p, logins, profiles)
      }))
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

  /** Put the wrapper dir first in a Windows PATH scope, remembering if the app is the one that added it. */
  async function addToPath(scope: PathScope) {
    const raw = await readRegistryPath(scope)
    const wasThere = hasPathEntry(raw, layout.dir)
    await writeRegistryPath(scope, prependPathEntry(raw, layout.dir))
    if (!wasThere) await savePathScopes(userDataPath, { ...(await loadPathScopes(userDataPath)), [scope]: true })
  }

  handle('gh:installWrapper', async () => {
    await requireMultiAccount()
    await installWrapper(layout, await userShellEnv(), platform)
    if (platform === 'win32') await addToPath('User')
    return status()
  })

  handle('gh:removeWrapper', async () => {
    if (platform === 'win32') {
      // Undo only the PATH entries this app added, system first: if the UAC
      // prompt is declined the wrapper is still installed, so Remove can be retried.
      const scopes = await loadPathScopes(userDataPath)
      for (const scope of ['Machine', 'User'] as const) {
        if (!scopes[scope]) continue
        const raw = await readRegistryPath(scope)
        if (hasPathEntry(raw, layout.dir)) await writeRegistryPath(scope, removePathEntry(raw, layout.dir))
        scopes[scope] = false
        await savePathScopes(userDataPath, scopes)
      }
    }
    await removeWrapper(layout)
    return status()
  })

  handle('gh:elevateSystemPath', async () => {
    if (platform !== 'win32') throw new Error('Only needed on Windows.')
    await addToPath('Machine')
    return status()
  })

  handle('agents:status', () => agentStatuses(agentEnv))

  handle('agents:apply', async (id: string) => {
    await requireMultiAccount()
    const ids: AgentId[] = id === 'all'
      // Skip what's already blocked or needs a manual edit, so "all" doesn't end in an error.
      ? (await agentStatuses(agentEnv)).filter(s => s.detected && !s.blocked && !s.manualSnippet).map(s => s.id)
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
