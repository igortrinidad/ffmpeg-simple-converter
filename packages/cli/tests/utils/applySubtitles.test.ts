import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { applyHardSubtitles, applySoftSubtitles } from '../../src/utils/ffmpegOperations.js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('Apply subtitles', () => {
  let testDir: string
  let testVideoPath: string
  let srtPath: string

  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacript-subs-test-'))
    testVideoPath = path.join(testDir, 'test-video.mp4')

    execSync(
      `ffmpeg -f lavfi -i testsrc=duration=3:size=640x360:rate=25 ` +
        `-f lavfi -i sine=frequency=1000:duration=3 ` +
        `-c:v libx264 -pix_fmt yuv420p -c:a aac -y "${testVideoPath}"`,
      { stdio: 'ignore' }
    )

    srtPath = path.join(testDir, 'subs.srt')
    fs.writeFileSync(srtPath, '1\n00:00:00,000 --> 00:00:03,000\nHello world\n', 'utf-8')
  })

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('applyHardSubtitles', () => {
    test('produces a non-empty mp4 with the subtitle burned in', async () => {
      const result = await applyHardSubtitles(testVideoPath, srtPath, { outputDir: testDir })

      expect(fs.existsSync(result)).toBe(true)
      expect(result).toContain('_hardsub.mp4')
      expect(fs.statSync(result).size).toBeGreaterThan(0)
    }, 120000)

    test('succeeds when the .srt path contains an apostrophe, comma and spaces', async () => {
      const trickyDir = path.join(testDir, "test dir, with comma")
      fs.mkdirSync(trickyDir, { recursive: true })
      const trickySrtPath = path.join(trickyDir, "sub's file.srt")
      fs.copyFileSync(srtPath, trickySrtPath)

      const result = await applyHardSubtitles(testVideoPath, trickySrtPath, {
        outputDir: testDir,
        outputName: 'tricky_hardsub_out'
      })

      expect(fs.existsSync(result)).toBe(true)
      expect(fs.statSync(result).size).toBeGreaterThan(0)
    }, 120000)
  })

  describe('applySoftSubtitles', () => {
    test('produces an mp4 with a mov_text subtitle stream', async () => {
      const result = await applySoftSubtitles(testVideoPath, srtPath, { outputDir: testDir })

      expect(fs.existsSync(result)).toBe(true)
      expect(result).toContain('_softsub.mp4')

      const probeOutput = execSync(
        `ffprobe -v error -select_streams s -show_entries stream=codec_name -of csv=p=0 "${result}"`
      )
        .toString()
        .trim()
      expect(probeOutput).toBe('mov_text')
    }, 60000)
  })
})
