import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { convertVideo, type ConversionOptions } from '../../src/utils/ffmpegOperations.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SAMPLE_FILE = path.resolve(__dirname, '../sample/1773154046775_6a5b5f00_interviewrecording.webm')

interface CompressionCase {
  description: string
  options: ConversionOptions
}

interface CompressionResult {
  description: string
  'Output File': string
  'Input Size': string
  'Output Size': string
  'Duration (s)': string
  'Compression Ratio': string
}

const compressionCases: CompressionCase[] = [
//   {
//     description: 'H.264 ultrafast (CRF 23)',
//     options: { preset: 'ultrafast', crf: 23, outputName: 'out_h264_ultrafast_crf23' }
//   },
//   {
//     description: 'H.264 veryfast (CRF 23)',
//     options: { preset: 'veryfast', crf: 23, outputName: 'out_h264_veryfast_crf23' }
//   },
//   {
//     description: 'H.264 fast (CRF 23)',
//     options: { preset: 'fast', crf: 23, outputName: 'out_h264_fast_crf23' }
//   },
//   {
//     description: 'H.264 medium (CRF 23) — default',
//     options: { preset: 'medium', crf: 23, outputName: 'out_h264_medium_crf23' }
//   },
//   {
//     description: 'H.264 slow (CRF 23)',
//     options: { preset: 'slow', crf: 23, outputName: 'out_h264_slow_crf23' }
//   },
//   {
//     description: 'H.264 medium (CRF 18 — high quality)',
//     options: { preset: 'medium', crf: 18, outputName: 'out_h264_medium_crf18_hq' }
//   },
//   {
//     description: 'H.264 medium (CRF 28 — smaller size)',
//     options: { preset: 'medium', crf: 28, outputName: 'out_h264_medium_crf28_small' }
//   },
//   {
//     description: 'Custom: H.264 fast + yuv420p',
//     options: {
//       outputName: 'out_custom_h264_fast_yuv420p',
//       customParams: [
//         '-c:v', 'libx264',
//         '-preset', 'fast',
//         '-crf', '23',
//         '-pix_fmt', 'yuv420p',
//         '-c:a', 'aac',
//         '-b:a', '128k'
//       ]
//     }
//   },
//   {
//     description: 'Custom: H.264 slow + film tune + high profile',
//     options: {
//       outputName: 'out_custom_h264_slow_film_high',
//       customParams: [
//         '-c:v', 'libx264',
//         '-preset', 'slow',
//         '-crf', '18',
//         '-tune', 'film',
//         '-profile:v', 'high',
//         '-pix_fmt', 'yuv420p',
//         '-c:a', 'aac',
//         '-b:a', '192k',
//         '-movflags', '+faststart'
//       ]
//     }
//   },
//   {
//     description: 'Custom: VP9 (CRF 30, cpu-used 2)',
//     options: {
//       outputName: 'out_custom_vp9_crf30',
//       customParams: [
//         '-c:v', 'libvpx-vp9',
//         '-crf', '30',
//         '-b:v', '0',
//         '-cpu-used', '2',
//         '-c:a', 'libopus',
//         '-b:a', '128k'
//       ]
//     }
//   },
  {
    description: 'Custom: genpts + force 24fps',
    options: {
      outputName: 'out_custom_genpts_24fps',
      customParams: [
        '-c:v','libx264','-preset','ultrafast','-crf','23','-c:a', 'aac',
      ]
    }
  },
//   {
//     description: 'Custom: genpts + force 24fps',
//     options: {
//       outputName: 'out_custom_genpts_24fps',
//       customParams: [
//         '-fflags', '+genpts',
//         '-r', '24',
//       ]
//     }
//   },
]

const SAMPLE_DIR = path.dirname(SAMPLE_FILE)

describe('WebM Compression Performance Tests', () => {
  let testVideoPath: string
  let inputSize: number
  const results: CompressionResult[] = []

  beforeAll(() => {
    if (!fs.existsSync(SAMPLE_FILE)) {
      throw new Error(`Sample file not found: ${SAMPLE_FILE}`)
    }

    testVideoPath = SAMPLE_FILE
    inputSize = fs.statSync(SAMPLE_FILE).size

    console.log(`\nSample file: ${SAMPLE_FILE}`)
    console.log(`Output dir:  ${SAMPLE_DIR}`)
    console.log(`Input size:  ${(inputSize / 1024 / 1024).toFixed(2)} MB\n`)
  })

  compressionCases.forEach(({ description, options }) => {
    test(description, async () => {
      const startTime = Date.now()
      const outputPath = await convertVideo(testVideoPath, SAMPLE_DIR, options)
      const duration = (Date.now() - startTime) / 1000

      const outputSize = fs.statSync(outputPath).size
      const compressionRatio = inputSize / outputSize

      expect(outputSize).toBeGreaterThan(0)

      const inputMB = (inputSize / 1024 / 1024).toFixed(2)
      const outputMB = (outputSize / 1024 / 1024).toFixed(2)

      console.log(`\n  [${description}]`)
      console.log(`  Input:       ${inputMB} MB`)
      console.log(`  Output:      ${outputMB} MB  →  ${path.basename(outputPath)}`)
      console.log(`  Duration:    ${duration.toFixed(2)}s`)
      console.log(`  Compression: ${compressionRatio.toFixed(2)}x`)

      results.push({
        description,
        'Output File': path.basename(outputPath),
        'Input Size': `${inputMB} MB`,
        'Output Size': `${outputMB} MB`,
        'Duration (s)': duration.toFixed(2),
        'Compression Ratio': `${compressionRatio.toFixed(2)}x`
      })
    }, 300000)
  })

  test('summary table', () => {
    if (results.length === 0) return
    console.log('\n')
    console.table(results)
  })
})
