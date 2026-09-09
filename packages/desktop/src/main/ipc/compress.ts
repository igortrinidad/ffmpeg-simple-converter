import { ipcMain } from 'electron'
import fs from 'fs'
import { compressVideoFile } from 'mediacript'
import { createRunStamp, getFeatureOutputDir, moveOutputInto } from '../lib/outputPaths'
import { recordActivity } from '../lib/historyStore'
import type { CompressRequest, CompressResult } from '../../shared/types'

export function registerCompressIpc(): void {
  ipcMain.handle('compress:run', async (_event, request: CompressRequest): Promise<CompressResult> => {
    const startedAt = new Date().toISOString()
    const label = `Comprimir vídeo (até ${request.targetSizeMB}MB)`

    try {
      const outputDir = getFeatureOutputDir('compress')
      const result = await compressVideoFile(request.inputPath, request.targetSizeMB, {
        preset: request.preset,
        maxHeight: request.maxHeight,
        monoAudio: request.monoAudio,
        outputDir
      })
      const outputPath = moveOutputInto(result.outputPath, outputDir, createRunStamp())
      const { size } = fs.statSync(outputPath)

      recordActivity({
        operation: 'compress',
        operationLabel: label,
        inputFile: request.inputPath,
        outputFiles: [outputPath],
        startedAt
      })

      return { outputPath, sizeBytes: size }
    } catch (error: any) {
      recordActivity({
        operation: 'compress',
        operationLabel: label,
        inputFile: request.inputPath,
        outputFiles: [],
        startedAt,
        error: error?.message || String(error)
      })
      throw error
    }
  })
}
