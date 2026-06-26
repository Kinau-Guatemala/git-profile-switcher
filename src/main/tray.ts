import { app, Menu, Tray, nativeImage } from 'electron'
import { loadProfiles } from '../core/profiles/storage'
import { loadState, saveState } from '../core/profiles/state'
import { ensureManagedIncludeInstalled } from '../core/git/managedInclude'
import { applyProfile } from '../core/git/identity'
import { verifyGlobal } from '../core/verify/globalVerify'
import { openProfilesWindow, openVerifyWindow } from './windows'

let tray: Tray | null = null
const userDataPath = app.getPath('userData')

export async function createTray(): Promise<void> {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Git Config Switcher')

  await rebuildTrayMenu()
}

export async function rebuildTrayMenu(): Promise<void> {
  if (!tray) return

  const profiles = await loadProfiles(userDataPath)
  const state = await loadState(userDataPath)

  let activeDisplay = 'No active profile'
  try {
    const verify = await verifyGlobal()
    if (verify.effectiveName && verify.effectiveEmail) {
      activeDisplay = `${verify.effectiveName} <${verify.effectiveEmail}>`
    }
  } catch {
    activeDisplay = 'Unknown'
  }

  const switchItems = profiles.map(profile => ({
    label: `${profile.label} (${profile.userEmail})`,
    type: 'radio' as const,
    checked: state.activeProfileId === profile.id,
    click: async () => {
      try {
        const { managedPath } = await ensureManagedIncludeInstalled(state.includePosition)
        await applyProfile(profile, managedPath)

        if (state.activeProfileId) {
          state.undoStack = [
            { profileId: state.activeProfileId, at: new Date().toISOString() },
            ...state.undoStack.slice(0, 2)
          ]
        }

        state.activeProfileId = profile.id
        await saveState(userDataPath, state)
        await rebuildTrayMenu()
      } catch (error: any) {
        console.error('Failed to apply profile:', error)
      }
    }
  }))

  const contextMenu = Menu.buildFromTemplate([
    { label: `Active: ${activeDisplay}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Switch Profile',
      submenu: switchItems.length > 0 ? switchItems : [{ label: 'No profiles', enabled: false }]
    },
    { type: 'separator' },
    { label: 'Verify...', click: openVerifyWindow },
    { label: 'Manage Profiles...', click: openProfilesWindow },
    {
      label: 'Undo Last Switch',
      enabled: state.undoStack.length > 0,
      click: async () => {
        if (state.undoStack.length === 0) return

        const lastEntry = state.undoStack[0]
        const profiles = await loadProfiles(userDataPath)
        const profile = profiles.find(p => p.id === lastEntry.profileId)

        if (profile) {
          try {
            const { managedPath } = await ensureManagedIncludeInstalled(state.includePosition)
            await applyProfile(profile, managedPath)

            state.activeProfileId = lastEntry.profileId
            state.undoStack = state.undoStack.slice(1)
            await saveState(userDataPath, state)
            await rebuildTrayMenu()
          } catch (error: any) {
            console.error('Failed to undo:', error)
          }
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)
}
