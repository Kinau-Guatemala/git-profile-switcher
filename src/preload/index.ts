import { contextBridge, ipcRenderer } from 'electron'
import { Profile, ProfileInput } from '../core/profiles/schema'
import { VerifyResult } from '../core/verify/types'
import { SSHHost } from '../core/git/sshConfig'

export interface DetectedProfile {
  userName?: string
  userEmail?: string
  signingKey?: string
  sshCommand?: string
  sshHost?: string
  comment?: string
}

const api = {
  profiles: {
    list: (): Promise<Profile[]> => ipcRenderer.invoke('profiles:list'),
    save: (profile: ProfileInput): Promise<Profile> => ipcRenderer.invoke('profiles:save', profile),
    delete: (profileId: string): Promise<void> => ipcRenderer.invoke('profiles:delete', profileId),
    apply: (profileId: string): Promise<{ ok: true }> => ipcRenderer.invoke('profiles:apply', profileId),
    detect: (): Promise<DetectedProfile[]> => ipcRenderer.invoke('profiles:detect'),
    detectSSH: (sshConfigPath: string): Promise<DetectedProfile[]> => ipcRenderer.invoke('profiles:detectSSH', sshConfigPath)
  },
  verify: {
    global: (): Promise<VerifyResult> => ipcRenderer.invoke('verify:global'),
    inRepo: (repoPath: string): Promise<VerifyResult> => ipcRenderer.invoke('verify:inRepo', repoPath)
  },
  app: {
    openWindow: (name: 'profiles' | 'verify'): Promise<void> => ipcRenderer.invoke('app:openWindow', name)
  },
  ssh: {
    generate: (email: string, accountName: string): Promise<any> => ipcRenderer.invoke('ssh:generate', email, accountName),
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
