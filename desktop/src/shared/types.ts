import type {
  Config as MediacriptConfig,
  AIProviderName as MediacriptAIProviderName,
  HighlightFallbackModel as MediacriptHighlightFallbackModel
} from 'mediacript'

// Reuse the root project's types (same shared config.json) instead of
// redefining a parallel shape that could drift out of sync.
export type Config = MediacriptConfig
export type AIProviderName = MediacriptAIProviderName
export type HighlightFallbackModel = MediacriptHighlightFallbackModel

export interface AIProviderOption {
  provider: AIProviderName
  label: string
  models: string[]
  hasApiKey: boolean
}

export type FileKind = 'video' | 'audio'

export type OperationId =
  | 'video-full'
  | 'video-extract-transcribe'
  | 'video-convert'
  | 'video-extract'
  | 'video-subtitles'
  | 'video-highlights'
  | 'audio-convert-transcribe'
  | 'audio-transcribe'
  | 'audio-convert'
  | 'audio-subtitles'

export type ConversionPreset = 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow'

export interface ConversionOptionsInput {
  preset: ConversionPreset
  hwaccel: boolean
}

export interface HighlightOptionsInput {
  provider: AIProviderName
  model: string
  prompt: string
  marginSeconds: number
}

export interface JobRequest {
  operation: OperationId
  filePaths: string[]
  conversionOptions?: ConversionOptionsInput
  highlightOptions?: HighlightOptionsInput
}

export type JobStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface JobStepState {
  name: string
  status: JobStepStatus
  error?: string
}

export interface JobEvent {
  jobId: string
  filePath: string
  fileIndex: number
  fileCount: number
  steps: JobStepState[]
  status: 'running' | 'completed' | 'failed'
  outputFiles?: string[]
  error?: string
}

export interface HistoryEntry {
  id: string
  operation: OperationId
  operationLabel: string
  inputFile: string
  outputFiles: string[]
  startedAt: string
  finishedAt: string
  status: 'completed' | 'failed'
  error?: string
  /** Options the job actually ran with, kept so it can be retried without retyping them */
  conversionOptions?: ConversionOptionsInput
  highlightOptions?: HighlightOptionsInput
}

/** What's needed to re-open the wizard pre-filled from a past history entry */
export interface RetryRequest {
  filePath: string
  operation: OperationId
  conversionOptions?: ConversionOptionsInput
  highlightOptions?: HighlightOptionsInput
}

export interface FfmpegStatus {
  installed: boolean
  version?: string
  error?: string
}
