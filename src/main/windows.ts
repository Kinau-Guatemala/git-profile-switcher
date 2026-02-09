import { BrowserWindow } from 'electron'
import { join } from 'path'

let profilesWindow: BrowserWindow | null = null
let verifyWindow: BrowserWindow | null = null

const preload = join(__dirname, '../preload/index.js')

export function openProfilesWindow(): void {
  if (profilesWindow && !profilesWindow.isDestroyed()) {
    profilesWindow.focus()
    return
  }

  profilesWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    profilesWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/profiles`)
  } else {
    profilesWindow.loadFile(join(__dirname, '../../dist/index.html'), { hash: '/profiles' })
  }

  profilesWindow.on('closed', () => {
    profilesWindow = null
  })
}

export function openVerifyWindow(): void {
  if (verifyWindow && !verifyWindow.isDestroyed()) {
    verifyWindow.focus()
    return
  }

  verifyWindow = new BrowserWindow({
    width: 700,
    height: 500,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    verifyWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/verify`)
  } else {
    verifyWindow.loadFile(join(__dirname, '../../dist/index.html'), { hash: '/verify' })
  }

  verifyWindow.on('closed', () => {
    verifyWindow = null
  })
}
