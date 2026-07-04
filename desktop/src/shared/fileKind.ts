import type { FileKind } from './types'

const AUDIO_EXTS = new Set(['.ogg', '.wav', '.mp3', '.m4a', '.aac', '.flac'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi'])

/**
 * Detects file type by extension — mirrors src/utils/fileHelpers.ts's
 * detectFileType, duplicated here so the renderer can filter/label dropped
 * files without a round trip to the main process.
 */
export function detectFileKind(filePath: string): FileKind | null {
  const match = /\.[^./\\]+$/.exec(filePath)
  const ext = match ? match[0].toLowerCase() : ''

  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return null
}
