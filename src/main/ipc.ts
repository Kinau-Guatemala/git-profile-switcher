import { ipcMain, app, shell } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { loadProfiles, saveProfiles } from '../core/profiles/storage'
import { loadState, saveState } from '../core/profiles/state'
import { Profile, ProfileInput, ProfileInputSchema } from '../core/profiles/schema'
import { ensureManagedIncludeInstalled } from '../core/git/managedInclude'
import { applyProfile } from '../core/git/identity'
import { verifyGlobal } from '../core/verify/globalVerify'
import { verifyInRepo } from '../core/verify/repoVerify'
import { detectExistingProfiles } from '../core/git/detectProfiles'
import { generateSSHKey, addToSSHConfig, testSSHConnection } from '../core/git/sshKeyGen'
import { parseSSHConfig } from '../core/git/sshConfig'
import { openProfilesWindow, openVerifyWindow } from './windows'

const userDataPath = app.getPath('userData')

export function setupIpcHandlers(rebuildTray: () => void): void {
  ipcMain.handle('profiles:list', async () => {
    try {
      return await loadProfiles(userDataPath)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('profiles:save', async (_event, input: ProfileInput) => {
    try {
      ProfileInputSchema.parse(input)

      const profiles = await loadProfiles(userDataPath)
      const now = new Date().toISOString()

      const newProfile: Profile = {
        ...input,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now
      }

      profiles.push(newProfile)
      await saveProfiles(userDataPath, profiles)
      rebuildTray()

      return newProfile
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('profiles:delete', async (_event, profileId: string) => {
    try {
      const profiles = await loadProfiles(userDataPath)
      const filtered = profiles.filter(p => p.id !== profileId)
      await saveProfiles(userDataPath, filtered)
      rebuildTray()
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('profiles:apply', async (_event, profileId: string) => {
    try {
      const profiles = await loadProfiles(userDataPath)
      const profile = profiles.find(p => p.id === profileId)

      if (!profile) {
        throw new Error('Profile not found')
      }

      const state = await loadState(userDataPath)

      const { managedPath } = await ensureManagedIncludeInstalled(state.includePosition)
      await applyProfile(profile, managedPath)

      if (state.activeProfileId) {
        state.undoStack = [
          { profileId: state.activeProfileId, at: new Date().toISOString() },
          ...state.undoStack.slice(0, 2)
        ]
      }

      state.activeProfileId = profileId
      await saveState(userDataPath, state)
      rebuildTray()

      return { ok: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('settings:get', async () => {
    try {
      const state = await loadState(userDataPath)
      return { includePosition: state.includePosition }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('settings:setIncludePosition', async (_event, position: 'start' | 'end') => {
    try {
      if (position !== 'start' && position !== 'end') {
        throw new Error(`Invalid include position: ${position}`)
      }
      const state = await loadState(userDataPath)
      state.includePosition = position
      await saveState(userDataPath, state)
      await ensureManagedIncludeInstalled(position)
      return { ok: true as const }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('verify:global', async () => {
    try {
      return await verifyGlobal()
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('verify:inRepo', async (_event, repoPath: string) => {
    try {
      return await verifyInRepo(repoPath)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('app:openWindow', async (_event, name: 'profiles' | 'verify') => {
    try {
      if (name === 'profiles') {
        openProfilesWindow()
      } else if (name === 'verify') {
        openVerifyWindow()
      }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('profiles:detect', async () => {
    try {
      return await detectExistingProfiles()
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('ssh:generate', async (_event, email: string, accountName: string, passphrase?: string) => {
    try {
      return await generateSSHKey(email, accountName, passphrase)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('shell:openExternal', async (event, url: string) => {
    // Validate IPC sender origin
    if (!event.senderFrame || new URL(event.senderFrame.url).protocol !== 'file:') {
      throw new Error('Unauthorized IPC sender')
    }
    // Only allow http/https URLs to prevent arbitrary protocol execution
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Disallowed URL protocol: ${parsed.protocol}`)
    }
    await shell.openExternal(url)
  })

  ipcMain.handle('ssh:addToConfig', async (_event, host: string, privateKeyPath: string, comment: string) => {
    try {
      await addToSSHConfig(host, privateKeyPath, comment)
      return { success: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('ssh:listHosts', async () => {
    try {
      const hosts = await parseSSHConfig()
      // Filter out wildcard patterns and split multi-pattern Host entries
      return hosts.filter(h => !h.host.includes('*') && !h.host.includes('?'))
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('ssh:test', async (_event, host: string) => {
    return await testSSHConnection(host)
  })
}
