import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { convertVideo, extractAudio, convertAudio, uniqueOutputPath } from '../../src/utils/ffmpegOperations.js'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('FFmpeg Operations', () => {
  let testDir: string
  let testVideoPath: string

  beforeAll(async () => {
    // Create temp directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacript-test-'))
    
    // Create a small test video file (5 seconds, webm format)
    testVideoPath = path.join(testDir, 'test-video.webm')
    
    try {
      // Generate a 5-second test video with a color pattern
      execSync(
        `ffmpeg -f lavfi -i testsrc=duration=5:size=1280x720:rate=30 ` +
        `-f lavfi -i sine=frequency=1000:duration=5 ` +
        `-c:v libvpx -c:a libvorbis -y "${testVideoPath}"`,
        { stdio: 'ignore' }
      )
      console.log(`Test video created: ${testVideoPath}`)
    } catch (error) {
      console.error('Failed to create test video:', error)
      throw error
    }
  })

  afterAll(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('uniqueOutputPath', () => {
    test('should generate unique file path', () => {
      const result = uniqueOutputPath(testDir, 'test', '.mp4')
      expect(result).toContain('test.mp4')
      expect(path.dirname(result)).toBe(testDir)
    })

    test('should append number if file exists', () => {
      const firstPath = path.join(testDir, 'duplicate.mp4')
      fs.writeFileSync(firstPath, 'test')
      
      const result = uniqueOutputPath(testDir, 'duplicate', '.mp4')
      expect(result).toContain('duplicate_1.mp4')
      
      fs.unlinkSync(firstPath)
    })
  })

  describe('convertVideo', () => {
    test('should convert video with default options', async () => {
      const result = await convertVideo(testVideoPath, testDir)
      
      expect(fs.existsSync(result)).toBe(true)
      expect(result).toContain('_converted.mp4')
      
      const stats = fs.statSync(result)
      expect(stats.size).toBeGreaterThan(0)
    }, 120000)

    test('should convert video with fast preset', async () => {
      const result = await convertVideo(testVideoPath, testDir, {
        preset: 'fast',
        crf: 23
      })
      
      expect(fs.existsSync(result)).toBe(true)
      expect(result).toContain('_converted')
    }, 120000)

    test('should convert video with custom ffmpeg params', async () => {
      const result = await convertVideo(testVideoPath, testDir, {
        customParams: [
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '25',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '128k'
        ]
      })
      
      expect(fs.existsSync(result)).toBe(true)
    }, 120000)
  })

  describe('extractAudio', () => {
    test('should extract audio from video', async () => {
      const result = await extractAudio(testVideoPath, testDir)
      
      expect(fs.existsSync(result)).toBe(true)
      expect(result).toContain('_audio.mp3')
      
      const stats = fs.statSync(result)
      expect(stats.size).toBeGreaterThan(0)
    }, 60000)
  })

  describe('convertAudio', () => {
    test('should convert audio file', async () => {
      // First extract audio to have an audio file to convert
      const audioPath = await extractAudio(testVideoPath, testDir)
      const result = await convertAudio(audioPath, testDir)
      
      expect(fs.existsSync(result)).toBe(true)
      expect(result).toContain('_converted.mp3')
    }, 90000)
  })
})
