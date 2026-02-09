import { ipcMain } from 'electron'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { loadProfiles, saveProfiles } from '../core/profiles/storage'
import { loadState, saveState } from '../core/profiles/state'
import { Profile, ProfileInput, ProfileInputSchema } from '../core/profiles/schema'
import { ensureManagedIncludeInstalled } from '../core/git/managedInclude'
import { applyProfile } from '../core/git/identity'
import { verifyGlobal } from '../core/verify/globalVerify'
import { verifyInRepo } from '../core/verify/repoVerify'
import { detectExistingProfiles } from '../core/git/detectProfiles'
import { generateSSHKey, addToSSHConfig } from '../core/git/sshKeyGen'
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

      const { managedPath } = await ensureManagedIncludeInstalled()
      await applyProfile(profile, managedPath)

      const state = await loadState(userDataPath)

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

  ipcMain.handle('profiles:detectSSH', async (_event, sshConfigPath: string) => {
    try {
      const { readFile } = await import('fs/promises')
      const content = await readFile(sshConfigPath, 'utf-8')

      // Parse SSH config
      const lines = content.split('\n')
      const profiles: any[] = []

      let currentComment: string | null = null
      let currentHost: string | null = null
      let identityFile: string | null = null

      for (const line of lines) {
        const trimmed = line.trim()

        if (trimmed.startsWith('#')) {
          currentComment = trimmed.substring(1).trim()
          continue
        }

        const hostMatch = trimmed.match(/^Host\s+github\.com-(\w+)$/i)
        if (hostMatch) {
          if (currentHost && identityFile) {
            profiles.push({
              sshHost: currentHost,
              comment: currentComment || `GitHub account (${currentHost})`,
              sshCommand: `ssh -F ~/.ssh/config`
            })
          }

          currentHost = `github.com-${hostMatch[1]}`
          identityFile = null
          continue
        }

        const identityMatch = trimmed.match(/^IdentityFile\s+(.+)$/i)
        if (identityMatch && currentHost) {
          identityFile = identityMatch[1].trim()
          continue
        }
      }

      if (currentHost && identityFile) {
        profiles.push({
          sshHost: currentHost,
          comment: currentComment || `GitHub account (${currentHost})`,
          sshCommand: `ssh -F ~/.ssh/config`
        })
      }

      return profiles
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('ssh:generate', async (_event, email: string, accountName: string) => {
    try {
      return await generateSSHKey(email, accountName)
    } catch (error: any) {
      throw new Error(error.message)
    }
  })

  ipcMain.handle('ssh:addToConfig', async (_event, host: string, privateKeyPath: string, comment: string) => {
    try {
      await addToSSHConfig(host, privateKeyPath, comment)
      return { success: true }
    } catch (error: any) {
      throw new Error(error.message)
    }
  })
}
