import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

/**
 * Re-encodes a raw MediaRecorder track into what Whisper actually wants:
 * 16kHz mono mp3 at 32kbps. Speech recognition gains nothing from stereo or
 * from a higher sample rate, and the small file keeps a long meeting under the
 * transcription API's size limit — an hour lands around 14MB, versus ~86MB at
 * mediacript's default 192kbps stereo `convertAudio`.
 *
 * Spawns ffmpeg directly (same binary the rest of the app already requires on
 * PATH) because the library's audio conversion doesn't expose these knobs.
 */
export function toTranscriptionAudio(
  inputPath: string,
  outputPath: string,
  onLog?: (line: string) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-i', inputPath,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'libmp3lame',
      '-b:a', '32k',
      '-y',
      outputPath
    ]

    const ffmpeg = spawn('ffmpeg', args)
    let stderr = ''

    ffmpeg.stderr.on('data', (data) => {
      const text = data.toString()
      stderr += text
      // ffmpeg writes progress to stderr; forward only the progress lines so
      // the user sees movement without the codec banner noise.
      const progress = text.match(/time=\s*([0-9:.]+)/)
      if (progress && onLog) onLog(`Convertendo áudio… ${progress[1]}`)
    })

    ffmpeg.on('error', (error) => {
      reject(new Error(`Não foi possível executar o ffmpeg: ${error.message}`))
    })

    ffmpeg.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath)
        return
      }
      reject(new Error(`ffmpeg falhou ao converter ${path.basename(inputPath)}: ${stderr.slice(-400)}`))
    })
  })
}

/** True when a track file exists and actually holds recorded data (an empty/aborted stream is skipped). */
export function hasRecordedAudio(filePath?: string): filePath is string {
  if (!filePath || !fs.existsSync(filePath)) return false
  return fs.statSync(filePath).size > 1024
}
