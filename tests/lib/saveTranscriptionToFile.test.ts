import { describe, test, expect, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { saveTranscriptionToFile } from '../../src/lib.js'

describe('saveTranscriptionToFile', () => {
  let testDir: string

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  test('writes the transcription text to a .txt file named after the audio path', async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacript-save-transcription-'))
    const audioPath = path.join(testDir, 'interview.mp3')

    const outputPath = await saveTranscriptionToFile('Olá, este é o texto transcrito.', audioPath)

    expect(outputPath).toBe(path.join(testDir, 'interview.txt'))
    expect(fs.readFileSync(outputPath, 'utf-8')).toBe('Olá, este é o texto transcrito.')
  })
})
