import { ipcMain, app, shell, dialog } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { loadProfiles, saveProfiles } from '../core/profiles/storage'
import { loadState, saveState, FolderMapping } from '../core/profiles/state'
import { Profile, ProfileInput, ProfileInputSchema } from '../core/profiles/schema'
import { syncManagedGitconfig } from '../core/git/folderConfigs'
import { verifyGlobal } from '../core/verify/globalVerify'
import { verifyInRepo } from '../core/verify/repoVerify'
import { detectExistingProfiles, detectFolderMappings } from '../core/git/detectProfiles'
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
      await syncManagedGitconfig(userDataPath)
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

      // Drop folder mappings (and the active selection) referencing the deleted profile.
      const state = await loadState(userDataPath)
      state.folderMappings = state.folderMappings.filter(m => m.profileId !== profileId)
      if (state.activeProfileId === profileId) {
        state.activeProfileId = undefined
      }
      await saveState(userDataPath, state)
      await syncManagedGitconfig(userDataPath)
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

      if (state.activeProfileId) {
        state.undoStack = [
          { profileId: state.activeProfileId, at: new Date().toISOString() },
          ...state.undoStack.slice(0, 2)
        ]
      }

      state.activeProfileId = profileId
      await saveState(userDataPath, state)
      await syncManagedGitconfig(userDataPath)
      rebuildTray()

      return { ok: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('settings:get', async () => {
    try {
      const state = await loadState(userDataPath)
      return { includePosition: state.includePosition, applyGlobally: state.applyGlobally }
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
      await syncManagedGitconfig(userDataPath)
      return { ok: true as const }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('settings:setApplyGlobally', async (_event, applyGlobally: boolean) => {
    try {
      const state = await loadState(userDataPath)
      state.applyGlobally = Boolean(applyGlobally)
      await saveState(userDataPath, state)
      await syncManagedGitconfig(userDataPath)
      return { ok: true as const }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('folders:list', async () => {
    try {
      const state = await loadState(userDataPath)
      return state.folderMappings
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('folders:pick', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder to assign a profile',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('folders:add', async (_event, folderPath: string, profileId: string) => {
    try {
      if (!folderPath || !profileId) {
        throw new Error('Folder path and profile are required')
      }
      const profiles = await loadProfiles(userDataPath)
      if (!profiles.some(p => p.id === profileId)) {
        throw new Error('Profile not found')
      }

      const state = await loadState(userDataPath)
      const mapping: FolderMapping = { path: folderPath, profileId }
      // Upsert: one profile per folder; replace an existing mapping for the path.
      state.folderMappings = [
        ...state.folderMappings.filter(m => m.path !== folderPath),
        mapping
      ]
      await saveState(userDataPath, state)
      await syncManagedGitconfig(userDataPath)
      return { ok: true as const }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('folders:remove', async (_event, folderPath: string) => {
    try {
      const state = await loadState(userDataPath)
      state.folderMappings = state.folderMappings.filter(m => m.path !== folderPath)
      await saveState(userDataPath, state)
      await syncManagedGitconfig(userDataPath)
      return { ok: true as const }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('folders:detectExisting', async () => {
    try {
      const [detected, profiles, state] = await Promise.all([
        detectFolderMappings(),
        loadProfiles(userDataPath),
        loadState(userDataPath)
      ])
      const tracked = new Set(state.folderMappings.map(m => m.path))
      return detected
        .filter(d => !tracked.has(d.path))
        .map(d => ({
          path: d.path,
          suggestedProfileId: d.email
            ? profiles.find(p => p.userEmail === d.email)?.id
            : undefined
        }))
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
