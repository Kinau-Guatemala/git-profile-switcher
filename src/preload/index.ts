import { contextBridge, ipcRenderer } from 'electron'
import { Profile, ProfileInput } from '../core/profiles/schema'
import { FolderMapping } from '../core/profiles/state'
import { VerifyResult } from '../core/verify/types'
import { SSHHost } from '../core/git/sshConfig'
import type { SSHKeyResult } from '../core/git/sshKeyGen'

export interface DetectedProfile {
  userName?: string
  userEmail?: string
  signingKey?: string
  sshCommand?: string
  sshHost?: string
  comment?: string
}

export interface DetectedFolderMappingSuggestion {
  path: string
  suggestedProfileId?: string
}

const api = {
  profiles: {
    list: (): Promise<Profile[]> => ipcRenderer.invoke('profiles:list'),
    save: (profile: ProfileInput): Promise<Profile> => ipcRenderer.invoke('profiles:save', profile),
    delete: (profileId: string): Promise<void> => ipcRenderer.invoke('profiles:delete', profileId),
    apply: (profileId: string): Promise<{ ok: true }> => ipcRenderer.invoke('profiles:apply', profileId),
    detect: (): Promise<DetectedProfile[]> => ipcRenderer.invoke('profiles:detect')
  },
  verify: {
    global: (): Promise<VerifyResult> => ipcRenderer.invoke('verify:global'),
    inRepo: (repoPath: string): Promise<VerifyResult> => ipcRenderer.invoke('verify:inRepo', repoPath)
  },
  app: {
    openWindow: (name: 'profiles' | 'verify'): Promise<void> => ipcRenderer.invoke('app:openWindow', name)
  },
  settings: {
    get: (): Promise<{ includePosition: 'start' | 'end'; applyGlobally: boolean }> =>
      ipcRenderer.invoke('settings:get'),
    setIncludePosition: (position: 'start' | 'end'): Promise<{ ok: true }> =>
      ipcRenderer.invoke('settings:setIncludePosition', position),
    setApplyGlobally: (applyGlobally: boolean): Promise<{ ok: true }> =>
      ipcRenderer.invoke('settings:setApplyGlobally', applyGlobally)
  },
  folders: {
    list: (): Promise<FolderMapping[]> => ipcRenderer.invoke('folders:list'),
    pick: (): Promise<string | null> => ipcRenderer.invoke('folders:pick'),
    add: (folderPath: string, profileId: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke('folders:add', folderPath, profileId),
    remove: (folderPath: string): Promise<{ ok: true }> =>
      ipcRenderer.invoke('folders:remove', folderPath),
    detectExisting: (): Promise<DetectedFolderMappingSuggestion[]> =>
      ipcRenderer.invoke('folders:detectExisting')
  },
  ssh: {
    generate: (email: string, accountName: string, passphrase?: string): Promise<SSHKeyResult> => ipcRenderer.invoke('ssh:generate', email, accountName, passphrase),
    addToConfig: (host: string, privateKeyPath: string, comment: string): Promise<any> => ipcRenderer.invoke('ssh:addToConfig', host, privateKeyPath, comment),
    listHosts: (): Promise<SSHHost[]> => ipcRenderer.invoke('ssh:listHosts'),
    test: (host: string): Promise<{ success: boolean; message: string }> => ipcRenderer.invoke('ssh:test', host)
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
