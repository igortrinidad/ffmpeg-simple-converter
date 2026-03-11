import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

export type ConversionPreset = 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow'
export type HardwareAcceleration = 'none' | 'auto' | 'nvenc' | 'qsv' | 'vaapi'

export interface ConversionOptions {
  /** 
   * Encoding speed preset (faster = lower quality/size, slower = better quality/size)
   * Default: 'medium'
   * For large files, use 'faster', 'veryfast', or 'superfast' for speed
   */
  preset?: ConversionPreset
  
  /** 
   * Quality (CRF - Constant Rate Factor)
   * Lower = better quality/larger file (18-28 recommended, 23 is default)
   * Higher values = faster encoding
   */
  crf?: number
  
  /** 
   * Hardware acceleration (much faster if available)
   * 'auto' - tries to detect and use available hardware
   * 'nvenc' - NVIDIA GPU (very fast)
   * 'qsv' - Intel Quick Sync
   * 'vaapi' - Intel/AMD GPU on Linux
   */
  hwaccel?: HardwareAcceleration
  
  /** Maximum number of threads to use (default: auto) */
  threads?: number
  
  /**
   * Custom ffmpeg parameters to pass to the conversion command
   * When provided, ONLY these parameters will be used — all other options
   * (codec, preset, crf, hwaccel, audio encoding, etc.) are completely ignored.
   * The final command will be: ffmpeg -i <input> ...customParams... -y <output>
   * 
   * Example: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac']
   * 
   * Use this for complete control over the ffmpeg command.
   */
  customParams?: string[]

  /**
   * 
   */
  outputDir?: string | undefined

  /**
   * Custom output file name (without extension).
   * Example: 'my-video-optimized'
   * If not provided, defaults to '<inputName>_converted'
   */
  outputName?: string
}

/**
 * Generates unique output file path
 */
export function uniqueOutputPath(dir: string, baseName: string, extWithDot: string): string {
  let candidate = path.join(dir, `${baseName}${extWithDot}`)
  if (!fs.existsSync(candidate)) return candidate

  for (let i = 1; i < 10_000; i++) {
    candidate = path.join(dir, `${baseName}_${i}${extWithDot}`)
    if (!fs.existsSync(candidate)) return candidate
  }

  throw new Error('Could not generate a unique output name.')
}

/**
 * Executes an ffmpeg command
 */
export function runFfmpegCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    ffmpeg.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString()
      // FFmpeg sends progress to stderr
      const lines = stderr.split('\n')
      const lastLine = lines[lines.length - 2] || ''
      
      // Display progress if there is time information
      if (lastLine.includes('time=')) {
        process.stdout.write(`\r${lastLine.trim()}`)
      }
    })

    ffmpeg.on('close', (code) => {
      process.stdout.write('\r')
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`FFmpeg failed with code ${code}\n${stderr}`))
      }
    })

    ffmpeg.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Detects available hardware acceleration
 */
async function detectHardwareAcceleration(): Promise<HardwareAcceleration> {
  try {
    // Try to get ffmpeg encoders
    const { execSync } = await import('child_process')
    const encoders = execSync('ffmpeg -encoders 2>/dev/null || true', { encoding: 'utf-8' })
    
    // Check for NVIDIA NVENC (also verify CUDA is available)
    if (encoders.includes('h264_nvenc')) {
      try {
        // Test if CUDA actually works with a quick probe
        execSync('ffmpeg -hide_banner -hwaccels 2>/dev/null | grep -q cuda', { encoding: 'utf-8' })
        return 'nvenc'
      } catch {
        // NVENC encoder exists but CUDA not available
      }
    }
    
    // Check for Intel Quick Sync
    if (encoders.includes('h264_qsv')) {
      return 'qsv'
    }
    
    // Check for VAAPI (Linux Intel/AMD)
    if (encoders.includes('h264_vaapi')) {
      return 'vaapi'
    }
  } catch (error) {
    // Ignore errors
  }
  
  return 'none'
}

/**
 * Checks if an error is related to hardware acceleration failure
 */
function isHardwareAccelerationError(error: Error): boolean {
  const errorMsg = error.message.toLowerCase()
  return (
    errorMsg.includes('cuda') ||
    errorMsg.includes('nvenc') ||
    errorMsg.includes('qsv') ||
    errorMsg.includes('vaapi') ||
    errorMsg.includes('device') ||
    errorMsg.includes('hwaccel') ||
    errorMsg.includes('hardware')
  )
}

/**
 * Converts video to performant format (H.264/AAC)
 */
export async function convertVideo(
  inputPath: string,
  options?: ConversionOptions
): Promise<string> {
  const dir = options?.outputDir || path.dirname(inputPath)
  const baseName = options?.outputName || `${path.basename(inputPath, path.extname(inputPath))}_converted`
  const outputPath = uniqueOutputPath(dir, baseName, '.mp4')

  // Default options
  const preset = options?.preset || 'medium'
  const crf = options?.crf || 23
  const hwaccel = options?.hwaccel || 'none'
  const threads = options?.threads

  console.log(`\n🎬 Converting video to performant format...`)
  if (!options?.customParams?.length) {
    console.log(`   Preset: ${preset} | CRF: ${crf} | HW Accel: ${hwaccel}`)
  }

  let detectedHwaccel = hwaccel
  
  if (hwaccel === 'auto') {
    detectedHwaccel = await detectHardwareAcceleration()
    console.log(`   Detected hardware: ${detectedHwaccel}`)
  }

  // Try with hardware acceleration first, fallback to CPU if it fails
  try {
    return await convertVideoInternal(inputPath, outputPath, preset, crf, detectedHwaccel, threads, options?.customParams)
  } catch (error) {
    // If hardware acceleration failed, retry with CPU
    if (detectedHwaccel !== 'none' && isHardwareAccelerationError(error as Error)) {
      console.log(`\n⚠️  Hardware acceleration failed, falling back to CPU...`)
      return await convertVideoInternal(inputPath, outputPath, preset, crf, 'none', threads, options?.customParams)
    }
    throw error
  }
}

/**
 * Internal function that performs the actual conversion
 */
async function convertVideoInternal(
  inputPath: string,
  outputPath: string,
  preset: ConversionPreset,
  crf: number,
  hwaccel: HardwareAcceleration,
  threads?: number,
  customParams?: string[]
): Promise<string> {
  const args: string[] = []

  // If custom params are provided, use ONLY them — no other parameters
  if (customParams && customParams.length > 0) {
    args.push('-i', inputPath)
    args.push(...customParams)
    args.push('-y', outputPath)

    console.log(args)

    await runFfmpegCommand(args)
    console.log(`\n✓ Video converted: ${path.basename(outputPath)}`)
    return outputPath
  }

  // Default parameters workflow (when no custom params provided)
  
  // Hardware acceleration setup
  let videoCodec = 'libx264'

  // Configure hardware acceleration
  if (hwaccel === 'nvenc') {
    args.push('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda')
    videoCodec = 'h264_nvenc'
  } else if (hwaccel === 'qsv') {
    args.push('-hwaccel', 'qsv')
    videoCodec = 'h264_qsv'
  } else if (hwaccel === 'vaapi') {
    args.push('-hwaccel', 'vaapi', '-hwaccel_device', '/dev/dri/renderD128', '-hwaccel_output_format', 'vaapi')
    videoCodec = 'h264_vaapi'
  }

  // Input file
  args.push('-i', inputPath)

  // Video encoding
  args.push('-c:v', videoCodec)

  // Preset (not available for some hardware encoders)
  if (videoCodec === 'libx264') {
    args.push('-preset', preset)
    args.push('-crf', String(crf))
  } else if (videoCodec === 'h264_nvenc') {
    // NVENC presets
    const nvencPresetMap: Record<string, string> = {
      'ultrafast': 'p1',
      'superfast': 'p2',
      'veryfast': 'p3',
      'faster': 'p4',
      'fast': 'p5',
      'medium': 'p6',
      'slow': 'p7'
    }
    args.push('-preset', nvencPresetMap[preset] || 'p6')
    args.push('-cq', String(crf))
  } else if (videoCodec === 'h264_qsv') {
    args.push('-preset', preset)
    args.push('-global_quality', String(crf))
  } else if (videoCodec === 'h264_vaapi') {
    args.push('-qp', String(crf))
  }

  // Threads
  if (threads) {
    args.push('-threads', String(threads))
  }

  // Audio encoding
  args.push('-c:a', 'aac', '-b:a', '128k')

  // MP4 optimizations
  args.push('-movflags', '+faststart')

  // Overwrite output
  args.push('-y', outputPath)

  await runFfmpegCommand(args)
  console.log(`\n✓ Video converted: ${path.basename(outputPath)}`)
  return outputPath
}

/**
 * Extracts audio from a video
 */
export async function extractAudio(
  inputPath: string,
  outputDir?: string
): Promise<string> {
  const dir = outputDir || path.dirname(inputPath)
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const outputPath = uniqueOutputPath(dir, `${baseName}_audio`, '.mp3')

  console.log(`\n🎵 Extracting audio from video...`)

  const args = [
    '-i', inputPath,
    '-vn',
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    '-y',
    outputPath
  ]

  await runFfmpegCommand(args)
  console.log(`\n✓ Audio extracted: ${path.basename(outputPath)}`)
  return outputPath
}

/**
 * Converts audio to performant format
 */
export async function convertAudio(
  inputPath: string,
  outputDir?: string
): Promise<string> {
  const dir = outputDir || path.dirname(inputPath)
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const outputPath = uniqueOutputPath(dir, `${baseName}_converted`, '.mp3')

  console.log(`\n🎵 Converting audio to MP3...`)

  const args = [
    '-i', inputPath,
    '-acodec', 'libmp3lame',
    '-b:a', '192k',
    '-y',
    outputPath
  ]

  await runFfmpegCommand(args)
  console.log(`\n✓ Audio converted: ${path.basename(outputPath)}`)
  return outputPath
}

/**
 * Gets the duration of an audio file in seconds
 */
export async function getAudioDuration(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ])

    let output = ''
    ffprobe.stdout.on('data', (data) => {
      output += data.toString()
    })

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim())
        resolve(duration)
      } else {
        reject(new Error(`Failed to get audio duration, code ${code}`))
      }
    })

    ffprobe.on('error', (err) => {
      reject(err)
    })
  })
}

/**
 * Splits an audio file into chunks of specified size (in MB)
 * Returns an array of chunk file paths
 */
export async function splitAudioIntoChunks(
  inputPath: string,
  maxSizeMB: number = 10
): Promise<string[]> {
  const dir = path.dirname(inputPath)
  const baseName = path.basename(inputPath, path.extname(inputPath))
  const ext = path.extname(inputPath).toLowerCase()
  
  // Create temp directory for chunks
  const tempDir = path.join(dir, `${baseName}_chunks_temp`)
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }

  console.log(`\n✂️  Splitting audio into chunks of max ${maxSizeMB}MB...`)

  // Get total duration
  const totalDuration = await getAudioDuration(inputPath)
  
  // Get file size
  const stats = fs.statSync(inputPath)
  const fileSizeMB = stats.size / (1024 * 1024)
  
  // Calculate approximate chunk duration to stay under maxSizeMB
  // We use 90% of target size to have a safety margin
  const targetSizeMB = maxSizeMB * 0.9
  const chunkDuration = Math.floor((totalDuration * targetSizeMB) / fileSizeMB)
  
  console.log(`📊 Total duration: ${Math.round(totalDuration)}s, splitting into ~${Math.ceil(totalDuration / chunkDuration)} chunks`)

  // Output pattern for chunks
  const outputPattern = path.join(tempDir, `chunk_%03d${ext}`)

  const args = [
    '-i', inputPath,
    '-f', 'segment',
    '-segment_time', chunkDuration.toString(),
    '-c', 'copy',
    '-reset_timestamps', '1',
    outputPattern
  ]

  await runFfmpegCommand(args)

  // Get all chunk files
  const chunkFiles = fs.readdirSync(tempDir)
    .filter(f => f.startsWith('chunk_') && f.endsWith(ext))
    .sort()
    .map(f => path.join(tempDir, f))

  console.log(`✓ Created ${chunkFiles.length} chunks`)
  
  return chunkFiles
}

/**
 * Deletes a directory and all its contents
 */
export function deleteDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true })
  }
}

