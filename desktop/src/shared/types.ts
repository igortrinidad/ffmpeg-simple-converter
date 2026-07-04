import type {
  Config as MediacriptConfig,
  AIProviderName as MediacriptAIProviderName,
  HighlightFallbackModel as MediacriptHighlightFallbackModel,
  HighlightSegment as MediacriptHighlightSegment,
  TranscriptSegment as MediacriptTranscriptSegment
} from 'mediacript'

// Reuse the root project's types (same shared config.json) instead of
// redefining a parallel shape that could drift out of sync.
export type Config = MediacriptConfig
export type AIProviderName = MediacriptAIProviderName
export type HighlightFallbackModel = MediacriptHighlightFallbackModel
export type HighlightSegment = MediacriptHighlightSegment
export type TranscriptSegment = MediacriptTranscriptSegment

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
  | 'video-highlights-chat'
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

export type JobLogLevel = 'log' | 'warn' | 'error' | 'progress'

/** A line of console output from the underlying library, mirrored live so the user can see what's actually happening during a job (ffmpeg progress, AI provider retries/fallbacks, etc.) */
export interface JobLogLine {
  jobId: string
  filePath: string
  level: JobLogLevel
  text: string
  timestamp: string
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

// --- Highlight chat -------------------------------------------------------

export interface HighlightChatOptions {
  provider: AIProviderName
  model: string
}

export interface HighlightChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HighlightChatStartRequest {
  jobId: string
  options: HighlightChatOptions
}

export interface HighlightChatStartResult {
  sessionId: string
  /** So the renderer can show a live transcript-text preview while the user drags a highlight's start/end sliders. */
  segments: TranscriptSegment[]
  /** URL (custom `mediacript-media://` scheme) an `<audio>` element can use directly as `src` to play the extracted audio. */
  audioUrl: string
}

export interface HighlightChatSendRequest {
  sessionId: string
  message: string
}

export interface HighlightChatSendResult {
  reply: string
  highlights: HighlightSegment[]
}

export interface HighlightChatCutRequest {
  sessionId: string
  marginSeconds: number
}

export interface HighlightChatCutResult {
  outputFiles: string[]
}

/** A line of console/ffmpeg output mirrored live while `processCuts` runs, so the user can see it's actually working. */
export interface HighlightChatLogLine {
  sessionId: string
  level: JobLogLevel
  text: string
  timestamp: string
}

export interface HighlightChatRemoveRequest {
  sessionId: string
  index: number
}

export interface HighlightChatRemoveResult {
  highlights: HighlightSegment[]
}

export interface HighlightChatUpdateRequest {
  sessionId: string
  index: number
  start: number
  end: number
}

export interface HighlightChatUpdateResult {
  highlights: HighlightSegment[]
}
