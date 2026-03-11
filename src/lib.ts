/**
 * MediaScript - Programmatic API
 * 
 * Use this module to integrate MediaScript functionality into your Node.js applications.
 */

import { verifyFfmpeg } from './utils/ffmpegCheck.js'
import { ensureConfig, loadConfig, hasApiKey } from './config/index.js'
import { listMediaFiles, detectFileType, type FileType } from './utils/fileHelpers.js'
import { 
  convertVideo, 
  extractAudio, 
  convertAudio,
  getAudioDuration,
  splitAudioIntoChunks,
  type ConversionOptions,
  type ConversionPreset,
  type HardwareAcceleration
} from './utils/ffmpegOperations.js'
import { transcribeAudio, saveTranscription } from './transcript/index.js'
import type { Config } from './types/index.js'

export interface MediaScriptOptions {

  /**
   * Output directory for converted files and transcriptions. 
   * Defaults to the same directory as the input file if not provided.
   */
  outputDir?: string | undefined
  
  groqApiKey?: string
  
  openaiApiKey?: string
  /** Video conversion options for speed/quality control */
  
  conversionOptions?: ConversionOptions
  /**
   * Skip video conversion and extract audio directly from the original file.
   * Useful for formats like .webm, .mkv, .mov where you only need the transcript.
   */
  skipVideoConversion?: boolean
}

export interface TranscriptionResult {
  text: string
  duration?: number
  filePath: string
}

export interface ConversionResult {
  outputPath: string
  originalPath: string
}

// Re-export conversion types for convenience
export type { ConversionOptions, ConversionPreset, HardwareAcceleration }

/**
 * Initialize MediaScript and verify dependencies
 * @throws Error if ffmpeg is not installed
 */
export async function initialize(): Promise<void> {
  await verifyFfmpeg()
}

/**
 * Load configuration from .env or create if doesn't exist
 * @returns Configuration object with API keys
 */
export async function getConfig(): Promise<Config> {
  await ensureConfig()
  return loadConfig()
}

/**
 * Check if at least one API key is configured
 * @returns true if either Groq or OpenAI key is configured
 */
export function isConfigured(): boolean {
  const config = loadConfig()
  return hasApiKey(config)
}

/**
 * Convert a video file to a more performant format (H.264/AAC)
 * @param inputPath - Path to the input video file
 * @param outputDir - Optional output directory (defaults to input file directory)
 * @param options - Optional conversion options for speed/quality control
 * @returns Promise with the output file path
 * 
 * @example
 * // Fast conversion (lower quality but much faster)
 * await convertVideoFile('video.webm', './output', { 
 *   preset: 'veryfast', 
 *   crf: 28 
 * })
 * 
 * @example
 * // Use hardware acceleration (NVIDIA GPU)
 * await convertVideoFile('video.webm', './output', { 
 *   hwaccel: 'auto',
 *   preset: 'fast'
 * })
 */
export async function convertVideoFile(
  inputPath: string,
  options?: ConversionOptions
): Promise<ConversionResult> {
  const outputPath = await convertVideo(inputPath, options)
  return {
    outputPath,
    originalPath: inputPath
  }
}

/**
 * Extract audio from a video file
 * @param inputPath - Path to the input video file
 * @param outputDir - Optional output directory (defaults to input file directory)
 * @returns Promise with the output audio file path
 */
export async function extractAudioFromVideo(
  inputPath: string,
  outputDir?: string
): Promise<ConversionResult> {
  const outputPath = await extractAudio(inputPath, outputDir)
  return {
    outputPath,
    originalPath: inputPath
  }
}

/**
 * Convert an audio file to MP3 format
 * @param inputPath - Path to the input audio file
 * @param outputDir - Optional output directory (defaults to input file directory)
 * @returns Promise with the output file path
 */
export async function convertAudioFile(
  inputPath: string,
  outputDir?: string
): Promise<ConversionResult> {
  const outputPath = await convertAudio(inputPath, outputDir)
  return {
    outputPath,
    originalPath: inputPath
  }
}

/**
 * Transcribe an audio file using Groq or OpenAI Whisper
 * Automatically handles files larger than 10MB by splitting into chunks
 * @param audioPath - Path to the audio file
 * @param options - Optional API keys (if not provided, will use config from .env)
 * @returns Promise with transcription result
 */
export async function transcribeAudioFile(
  audioPath: string,
  options?: MediaScriptOptions
): Promise<TranscriptionResult | null> {
  let config: Config
  
  if (options?.groqApiKey || options?.openaiApiKey) {
    // Use provided API keys
    config = {
      groqApiKey: options.groqApiKey || '',
      openaiApiKey: options.openaiApiKey || ''
    }
  } else {
    // Load from config
    config = loadConfig()
  }
  
  const text = await transcribeAudio(audioPath, config)
  
  if (!text) {
    return null
  }
  
  // Try to get duration
  let duration: number | undefined
  try {
    duration = await getAudioDuration(audioPath)
  } catch (err) {
    // Duration is optional
  }
  
  return {
    text,
    duration,
    filePath: audioPath
  }
}

/**
 * Save transcription text to a file
 * @param transcriptionText - The transcribed text
 * @param audioFilePath - Original audio file path (used to generate output filename)
 * @returns Promise with the saved file path
 */
export async function saveTranscriptionToFile(
  transcriptionText: string,
  audioFilePath: string
): Promise<string> {
  return saveTranscription(transcriptionText, audioFilePath)
}

/**
 * Get the duration of an audio file in seconds
 * @param audioPath - Path to the audio file
 * @returns Promise with duration in seconds
 */
export async function getAudioFileDuration(audioPath: string): Promise<number> {
  return getAudioDuration(audioPath)
}

/**
 * Split an audio file into smaller chunks
 * @param audioPath - Path to the audio file
 * @param maxSizeMB - Maximum size per chunk in megabytes
 * @returns Promise with array of chunk file paths
 */
export async function splitAudioFile(
  audioPath: string,
  maxSizeMB: number = 10
): Promise<string[]> {
  return splitAudioIntoChunks(audioPath, maxSizeMB)
}

/**
 * Detect the type of a media file (video or audio)
 * @param filePath - Path to the file
 * @returns File type ('video' or 'audio')
 */
export function detectMediaFileType(filePath: string): FileType {
  return detectFileType(filePath)
}

/**
 * List all media files in a directory
 * @param directory - Path to the directory
 * @returns Array of media file information
 */
export function listMediaFilesInDirectory(directory: string): Array<{ name: string; fullPath: string; type: FileType }> {
  return listMediaFiles(directory)
}

/**
 * Complete workflow: Convert video + Extract audio + Transcribe
 *
 * When `options.skipVideoConversion` is `true`, skips the MP4 conversion step and
 * extracts audio directly from the original video file (e.g. .webm, .mkv, .mov).
 *
 * @param videoPath - Path to the input video file
 * @param outputDir - Optional output directory
 * @param options - Optional API keys, conversion options and workflow flags
 * @returns Promise with all results. `convertedVideo` is `null` when conversion was skipped.
 *
 * @example
 * // Full workflow (convert → extract audio → transcribe)
 * await processVideo('video.webm', './output', {
 *   conversionOptions: { preset: 'veryfast', hwaccel: 'auto' }
 * })
 *
 * @example
 * // Skip video conversion — extract audio directly and transcribe
 * await processVideo('video.webm', './output', {
 *   skipVideoConversion: true,
 *   groqApiKey: process.env.GROQ_API_KEY
 * })
 */
export async function processVideo(
  videoPath: string,
  options?: MediaScriptOptions
): Promise<{
  convertedVideo: ConversionResult | null
  extractedAudio: ConversionResult
  transcription: TranscriptionResult | null
}> {
  let convertedVideo: ConversionResult | null = null
  let sourceForAudio = videoPath

  if (!options?.skipVideoConversion) {
    // Convert video to a performant format first
    convertedVideo = await convertVideoFile(videoPath, options?.conversionOptions)
    sourceForAudio = convertedVideo.outputPath
  }

  // Extract audio from the converted video (or directly from the original)
  const extractedAudio = await extractAudioFromVideo(sourceForAudio, options?.outputDir)

  // Transcribe
  const transcription = await transcribeAudioFile(extractedAudio.outputPath, options)

  return {
    convertedVideo,
    extractedAudio,
    transcription
  }
}

/**
 * Complete workflow: Extract audio from video + Transcribe
 * @param videoPath - Path to the input video file
 * @param outputDir - Optional output directory
 * @param options - Optional API keys for transcription
 * @returns Promise with results
 */
export async function extractAndTranscribe(
  videoPath: string,
  options?: MediaScriptOptions
): Promise<{
  extractedAudio: ConversionResult
  transcription: TranscriptionResult | null
}> {
  // Extract audio
  const extractedAudio = await extractAudioFromVideo(videoPath, options?.outputDir)
  
  // Transcribe
  const transcription = await transcribeAudioFile(extractedAudio.outputPath, options)
  
  return {
    extractedAudio,
    transcription
  }
}

/**
 * Complete workflow: Convert audio + Transcribe
 * @param audioPath - Path to the input audio file
 * @param options - Optional API keys for transcription
 * @returns Promise with results
 */
export async function convertAndTranscribe(
  audioPath: string,
  options?: MediaScriptOptions
): Promise<{
  convertedAudio: ConversionResult
  transcription: TranscriptionResult | null
}> {
  // Convert audio
  const convertedAudio = await convertAudioFile(audioPath, options?.outputDir)
  
  // Transcribe
  const transcription = await transcribeAudioFile(convertedAudio.outputPath, options)
  
  return {
    convertedAudio,
    transcription
  }
}

// Re-export types for consumers
export type { Config, FileType }
