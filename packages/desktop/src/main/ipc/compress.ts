import { ipcMain } from 'electron'
import fs from 'fs'
import { compressVideoFile } from 'mediacript'
import type { CompressRequest, CompressResult } from '../../shared/types'

export function registerCompressIpc(): void {
  ipcMain.handle('compress:run', async (_event, request: CompressRequest): Promise<CompressResult> => {
    const result = await compressVideoFile(request.inputPath, request.targetSizeMB, {
      preset: request.preset,
      maxHeight: request.maxHeight,
      monoAudio: request.monoAudio
    })
    const { size } = fs.statSync(result.outputPath)
    return { outputPath: result.outputPath, sizeBytes: size }
  })
}
