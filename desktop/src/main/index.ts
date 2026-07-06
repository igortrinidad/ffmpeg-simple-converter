import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerConfigIpc } from './ipc/config'
import { registerFilesIpc } from './ipc/files'
import { registerJobsIpc } from './ipc/jobs'
import { registerHistoryIpc } from './ipc/history'
import { registerFfmpegIpc } from './ipc/ffmpeg'
import { registerHighlightChatIpc } from './ipc/highlightChat'
import { registerAgentsIpc } from './ipc/agents'
import { registerMediaProtocol } from './lib/mediaProtocol'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Mediacript',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerMediaProtocol()
  registerConfigIpc()
  registerFilesIpc()
  registerJobsIpc()
  registerHistoryIpc()
  registerFfmpegIpc()
  registerHighlightChatIpc()
  registerAgentsIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
