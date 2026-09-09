import fs from 'fs'
import { compressVideoFile } from 'mediacript'
import { captureConsole } from './consoleCapture'
import type { ScreencastLogLine, ScreencastProcessRequest, ScreencastProcessResult } from '../../shared/types'

type ProgressFn = (step: string, status: 'running' | 'completed' | 'failed', detail?: string) => void
type LogFn = (line: ScreencastLogLine) => void

const ANALYZE_STEP = 'Analisar gravação'
const OPTIMIZE_STEP = 'Otimizar vídeo (H.264 1080p)'
const FINISH_STEP = 'Finalizar arquivo'

// The raw MediaRecorder .webm is large and inefficient, so it gets re-encoded
// to a size-capped H.264 mp4 downscaled to 1080p. Budget ~8 Mbps of video
// (screen content stays crisp at 1080p) plus a small audio allowance, spread
// over the recorded duration — the compressor's -crf still keeps quality from
// exceeding what's actually needed.
const TARGET_VIDEO_KBPS = 8000
const TARGET_AUDIO_KBPS = 128
const MAX_HEIGHT = 1080

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Turns the raw screen recording into the final optimized mp4, reporting one
 * progress event per step and mirroring mediacript's console/ffmpeg output so
 * the renderer can show the same checklist + live log the conversion jobs do.
 */
export async function processRecording(
  request: ScreencastProcessRequest,
  emitProgress: ProgressFn,
  onLog: LogFn
): Promise<ScreencastProcessResult> {
  const stopCapture = captureConsole((line) => onLog({ ...line, timestamp: new Date().toISOString() }))

  try {
    emitProgress(ANALYZE_STEP, 'running')
    let rawSizeBytes: number
    let targetSizeMB: number
    try {
      if (!fs.existsSync(request.rawFilePath)) {
        throw new Error(`A gravação bruta não foi encontrada: ${request.rawFilePath}`)
      }
      rawSizeBytes = fs.statSync(request.rawFilePath).size
      const durationSeconds = Math.max(request.durationSeconds, 1)
      targetSizeMB = Math.max(5, Math.ceil(((TARGET_VIDEO_KBPS + TARGET_AUDIO_KBPS) * durationSeconds) / 8192))
      console.log(
        `\n🎥 Gravação bruta: ${formatMB(rawSizeBytes)} (${Math.round(durationSeconds)}s) → alvo de até ${targetSizeMB}MB`
      )
    } catch (error: any) {
      emitProgress(ANALYZE_STEP, 'failed', error?.message || String(error))
      throw error
    }
    emitProgress(ANALYZE_STEP, 'completed', `${formatMB(rawSizeBytes)} · alvo ${targetSizeMB}MB`)

    emitProgress(OPTIMIZE_STEP, 'running')
    let outputPath: string
    try {
      const result = await compressVideoFile(request.rawFilePath, targetSizeMB, {
        preset: 'slow',
        maxHeight: MAX_HEIGHT
      })
      outputPath = result.outputPath
    } catch (error: any) {
      emitProgress(OPTIMIZE_STEP, 'failed', error?.message || String(error))
      throw error
    }
    emitProgress(OPTIMIZE_STEP, 'completed')

    emitProgress(FINISH_STEP, 'running')
    let sizeBytes: number
    try {
      sizeBytes = fs.statSync(outputPath).size
      console.log(`✓ Gravação pronta: ${formatMB(sizeBytes)} (era ${formatMB(rawSizeBytes)})`)
    } catch (error: any) {
      emitProgress(FINISH_STEP, 'failed', error?.message || String(error))
      throw error
    }
    emitProgress(FINISH_STEP, 'completed', formatMB(sizeBytes))

    return { outputPath, sizeBytes, rawFilePath: request.rawFilePath, rawSizeBytes }
  } finally {
    stopCapture()
  }
}
