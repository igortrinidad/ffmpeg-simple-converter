import fs from 'fs'
import path from 'path'
import { createRunStamp, getFeatureOutputDir } from './outputPaths'

export function getRecordingsDir(): string {
  return getFeatureOutputDir('screencast')
}

/** Saves a raw recording buffer to a datetime-named file in the recordings folder and returns its path. */
export function saveRawRecording(buffer: Buffer): string {
  const filePath = path.join(getRecordingsDir(), `${createRunStamp()}_screencast.webm`)
  fs.writeFileSync(filePath, buffer)
  return filePath
}
