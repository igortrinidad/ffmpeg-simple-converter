import { ipcMain, BrowserWindow } from 'electron'
import { runJob } from '../lib/jobRunner'
import { registerTranscript } from '../lib/highlightChatRunner'
import { getOperation } from '../../shared/operations'
import type { JobRequest } from '../../shared/types'

export function registerJobsIpc(): void {
  ipcMain.handle('jobs:run', async (event, request: JobRequest): Promise<void> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const operation = getOperation(request.operation)

    await runJob(
      request,
      (jobEvent) => window?.webContents.send('jobs:event', jobEvent),
      (logLine) => window?.webContents.send('jobs:log', logLine),
      operation.startsHighlightChat ? registerTranscript : undefined
    )
  })
}
