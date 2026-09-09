import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export function getRecordingsDir(): string {
  const dir = path.join(app.getPath('videos'), 'Mediacript Recordings')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

/** Saves a raw recording buffer to a timestamped file in the recordings folder and returns its path. */
export function saveRawRecording(buffer: Buffer): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(getRecordingsDir(), `screencast_${timestamp}.webm`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}
