import fs from 'fs'
import path from 'path'
import type { TranscriptSegment } from '../types/index.js'

/**
 * Formats seconds as an SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const hours = Math.floor(clamped / 3600)
  const minutes = Math.floor((clamped % 3600) / 60)
  const seconds = Math.floor(clamped % 60)
  const milliseconds = Math.round((clamped - Math.floor(clamped)) * 1000)

  const pad2 = (n: number) => String(n).padStart(2, '0')
  const pad3 = (n: number) => String(n).padStart(3, '0')

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(milliseconds)}`
}

/**
 * Converts transcript segments (with start/end in seconds) into SRT subtitle content.
 */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((segment, index) => {
      const text = segment.text.trim()
      return `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${text}\n`
    })
    .join('\n')
    .trim() + '\n'
}

/**
 * Writes an SRT file with the full timeline for a media file, next to it.
 * @param segments - Transcript segments with timestamps
 * @param mediaFilePath - Original media file path (used to derive the output filename)
 * @param outputDir - Optional output directory (defaults to media file directory)
 * @returns Path to the generated .srt file
 */
export function saveSrtFile(
  segments: TranscriptSegment[],
  mediaFilePath: string,
  outputDir?: string
): string {
  const dir = outputDir || path.dirname(mediaFilePath)
  const baseName = path.basename(mediaFilePath, path.extname(mediaFilePath))
  const outputPath = path.join(dir, `${baseName}.srt`)

  fs.writeFileSync(outputPath, segmentsToSrt(segments), 'utf-8')
  return outputPath
}
