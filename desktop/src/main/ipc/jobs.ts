import { ipcMain, BrowserWindow } from 'electron'
import { runJob } from '../lib/jobRunner'
import type { JobRequest } from '../../shared/types'

export function registerJobsIpc(): void {
  ipcMain.handle('jobs:run', async (event, request: JobRequest): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender)

    await runJob(request, (jobEvent) => {
      window?.webContents.send('jobs:event', jobEvent)
    })
  })
}
