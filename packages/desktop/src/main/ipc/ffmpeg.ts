import { ipcMain } from 'electron'
import { getFfmpegStatus } from 'mediacript'
import type { FfmpegStatus } from '../../shared/types'

export function registerFfmpegIpc(): void {
  ipcMain.handle('ffmpeg:check', (): FfmpegStatus => {
    return getFfmpegStatus()
  })
}
