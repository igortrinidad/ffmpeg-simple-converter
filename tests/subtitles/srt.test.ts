import { describe, test, expect, afterEach } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { formatSrtTimestamp, segmentsToSrt, saveSrtFile } from '../../src/subtitles/srt.js'

describe('formatSrtTimestamp', () => {
  test('formats zero seconds', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000')
  })

  test('formats sub-minute timestamps with milliseconds', () => {
    expect(formatSrtTimestamp(5.25)).toBe('00:00:05,250')
  })

  test('formats hours/minutes/seconds', () => {
    expect(formatSrtTimestamp(3725.5)).toBe('01:02:05,500')
  })

  test('clamps negative values to zero', () => {
    expect(formatSrtTimestamp(-10)).toBe('00:00:00,000')
  })
})

describe('segmentsToSrt', () => {
  test('formats sequential numbered cues', () => {
    const srt = segmentsToSrt([
      { start: 0, end: 1.5, text: 'Olá mundo' },
      { start: 1.5, end: 3, text: 'Segundo trecho' }
    ])

    expect(srt).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nOlá mundo\n\n2\n00:00:01,500 --> 00:00:03,000\nSegundo trecho\n'
    )
  })

  test('trims segment text', () => {
    const srt = segmentsToSrt([{ start: 0, end: 1, text: '  com espaços  ' }])
    expect(srt).toContain('com espaços')
    expect(srt).not.toContain('  com espaços  ')
  })
})

describe('saveSrtFile', () => {
  let testDir: string

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  test('writes an .srt file next to the media file by default', () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacript-srt-test-'))
    const mediaPath = path.join(testDir, 'video.mp4')

    const outputPath = saveSrtFile([{ start: 0, end: 1, text: 'oi' }], mediaPath)

    expect(outputPath).toBe(path.join(testDir, 'video.srt'))
    expect(fs.existsSync(outputPath)).toBe(true)
    expect(fs.readFileSync(outputPath, 'utf-8')).toContain('oi')
  })

  test('writes to a custom output directory when provided', () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediacript-srt-test-'))
    const outDir = path.join(testDir, 'out')
    fs.mkdirSync(outDir)
    const mediaPath = path.join(testDir, 'video.mp4')

    const outputPath = saveSrtFile([{ start: 0, end: 1, text: 'oi' }], mediaPath, outDir)

    expect(outputPath).toBe(path.join(outDir, 'video.srt'))
    expect(fs.existsSync(outputPath)).toBe(true)
  })
})
