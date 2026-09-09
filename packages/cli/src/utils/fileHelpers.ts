import fs from 'fs'
import path from 'path'

const AUDIO_EXTS = new Set(['.ogg', '.wav', '.mp3', '.m4a', '.aac', '.flac'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi'])

export type FileType = 'audio' | 'video' | 'unknown'

/**
 * Detects file type by extension
 */
export function detectFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase()
  
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return 'unknown'
}

/**
 * Lists audio/video files in directory
 */
export function listMediaFiles(dir: string): Array<{ name: string; fullPath: string; type: FileType }> {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => {
        const fullPath = path.join(dir, name)
        try {
          return fs.statSync(fullPath).isFile()
        } catch {
          return false
        }
      })
      .map((name) => {
        const fullPath = path.join(dir, name)
        return {
          name,
          fullPath,
          type: detectFileType(name)
        }
      })
      .filter((f) => f.type !== 'unknown')
      .sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Error listing files:', error)
    return []
  }
}

/**
 * Creates (if needed) and returns a folder named after `inputFile`'s basename,
 * used to group every output generated for that file (audio, subtitles, clips,
 * thumbnails, etc.) instead of scattering them next to the original file.
 */
export function createOutputFolderForFile(inputFile: string, baseOutputDir?: string): string {
  const parentDir = baseOutputDir || path.dirname(inputFile)
  const folderName = path.basename(inputFile, path.extname(inputFile))
  const dir = path.join(parentDir, folderName)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * Converts free text (e.g. an AI-generated clip title) into a filesystem-safe
 * slug, used to name per-clip output folders.
 */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return slug || 'clip'
}

/**
 * Checks if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

/**
 * Gets file size in bytes
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath)
    return stats.size
  } catch (error) {
    console.error('Error getting file size:', error)
    return 0
  }
}

/**
 * Converts bytes to MB
 */
export function bytesToMB(bytes: number): number {
  return bytes / (1024 * 1024)
}
