import { app } from 'electron'
import { checkGitInstalled } from '../core/git/gitRunner'
import { setupIpcHandlers } from './ipc'
import { createTray, rebuildTrayMenu } from './tray'
import { openProfilesWindow } from './windows'

app.whenReady().then(async () => {
  try {
    await checkGitInstalled()
  } catch (error: any) {
    console.error(error.message)
    app.quit()
    return
  }

  setupIpcHandlers(rebuildTrayMenu)
  await createTray()

  openProfilesWindow()
})

app.on('window-all-closed', (e: Event) => {
  e.preventDefault()
})

app.on('before-quit', () => {
  app.exit(0)
})
