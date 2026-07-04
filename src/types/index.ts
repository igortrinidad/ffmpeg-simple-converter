export interface Config {
  openaiApiKey?: string
  groqApiKey?: string
  anthropicApiKey?: string
  geminiApiKey?: string
  openrouterApiKey?: string
}

export interface TranscriptSegment {
  start: number
  end: number
  text: string
}

export interface HighlightSegment {
  start: number
  end: number
  title: string
  reason?: string
}

export interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  result?: any
  error?: string
  startTime?: number
  endTime?: number
}

export interface WorkflowState {
  steps: WorkflowStep[]
  currentStepIndex: number
  inputFile: string
  intermediateFiles: {
    convertedVideo?: string
    extractedAudio?: string
    transcriptionText?: string
    subtitlesFile?: string
    highlightClips?: string[]
  }
}

export type OperationType = 'convert-video' | 'extract-audio' | 'convert-audio' | 'transcribe'

export interface Operation {
  type: OperationType
  name: string
  description: string
  requiresInput: 'video' | 'audio' | 'any'
}
