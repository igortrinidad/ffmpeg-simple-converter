import { randomUUID } from 'crypto'
import {
  convertVideoFile,
  extractAudioFromVideo,
  convertAudioFile,
  transcribeAudioFile,
  saveTranscriptionToFile,
  saveSrtFile,
  extractVideoHighlights,
  cutHighlightClipsWithAssets,
  createOutputFolderForFile,
  getStoredConfig
} from 'mediacript'
import type { TranscriptSegment, HighlightSegment, HighlightAIOptions } from 'mediacript'
import { getOperation } from '../../shared/operations'
import { addHistoryEntry } from './historyStore'
import type { JobEvent, JobRequest, JobStepState } from '../../shared/types'

type EmitFn = (event: JobEvent) => void
type StoredConfig = ReturnType<typeof getStoredConfig>

/**
 * Runs one job (an operation applied to one or more files) sequentially,
 * emitting a JobEvent after every step so the renderer can show live progress.
 * Mirrors the CLI's executeWorkflow, but calls mediacript's primitives one at a
 * time (instead of the convenience composite functions) for finer-grained
 * progress reporting, and records a history entry per file.
 */
export async function runJob(request: JobRequest, emit: EmitFn): Promise<void> {
  const operation = getOperation(request.operation)
  const config = getStoredConfig()

  for (let fileIndex = 0; fileIndex < request.filePaths.length; fileIndex++) {
    await runJobForFile(request, operation, config, fileIndex, emit)
  }
}

async function runJobForFile(
  request: JobRequest,
  operation: ReturnType<typeof getOperation>,
  config: StoredConfig,
  fileIndex: number,
  emit: EmitFn
): Promise<void> {
  const filePath = request.filePaths[fileIndex]
  const jobId = randomUUID()
  const startedAt = new Date().toISOString()
  const steps: JobStepState[] = operation.steps.map((name) => ({ name, status: 'pending' }))
  const outputFiles: string[] = []

  const emitProgress = (status: JobEvent['status'], error?: string): void => {
    emit({
      jobId,
      filePath,
      fileIndex,
      fileCount: request.filePaths.length,
      steps: steps.map((s) => ({ ...s })),
      status,
      outputFiles: [...outputFiles],
      error
    })
  }

  const runStep = async (stepName: string, fn: () => Promise<void>): Promise<boolean> => {
    const step = steps.find((s) => s.name === stepName)!
    step.status = 'running'
    emitProgress('running')

    try {
      await fn()
      step.status = 'completed'
      emitProgress('running')
      return true
    } catch (error: any) {
      step.status = 'failed'
      step.error = error?.message || String(error)
      emitProgress('failed', step.error)
      return false
    }
  }

  let ok = true
  let currentFile = filePath
  let audioFile: string | undefined
  let transcriptSegments: TranscriptSegment[] | undefined
  let highlights: HighlightSegment[] | undefined

  // Highlight runs generate many files (audio, subtitles, clips, thumbnails),
  // so they get grouped into a folder named after the input file.
  const generatesHighlightClips = operation.steps.includes('Cortar clipes')
  const outputDir = generatesHighlightClips ? createOutputFolderForFile(filePath) : undefined

  try {
    if (ok && operation.steps.includes('Converter vídeo')) {
      ok = await runStep('Converter vídeo', async () => {
        const result = await convertVideoFile(currentFile, {
          preset: request.conversionOptions?.preset ?? 'medium',
          hwaccel: request.conversionOptions?.hwaccel ? 'auto' : 'none',
          outputDir
        })
        currentFile = result.outputPath
        outputFiles.push(result.outputPath)
      })
    }

    if (ok && operation.steps.includes('Converter áudio')) {
      ok = await runStep('Converter áudio', async () => {
        const result = await convertAudioFile(currentFile, outputDir)
        currentFile = result.outputPath
        outputFiles.push(result.outputPath)
      })
    }

    if (ok && operation.steps.includes('Extrair áudio')) {
      ok = await runStep('Extrair áudio', async () => {
        const result = await extractAudioFromVideo(currentFile, outputDir)
        audioFile = result.outputPath
        currentFile = result.outputPath
        outputFiles.push(result.outputPath)
      })
    }

    if (ok && operation.steps.includes('Transcrever áudio')) {
      ok = await runStep('Transcrever áudio', async () => {
        const fileToTranscribe = audioFile || currentFile
        const transcription = await transcribeAudioFile(fileToTranscribe, config)
        if (!transcription) {
          throw new Error('Falha ao transcrever com os provedores configurados (Groq/OpenAI)')
        }
        const textPath = await saveTranscriptionToFile(transcription.text, fileToTranscribe)
        outputFiles.push(textPath)
      })
    }

    if (ok && operation.steps.includes('Gerar legendas')) {
      ok = await runStep('Gerar legendas', async () => {
        const fileToTranscribe = audioFile || currentFile
        const transcription = await transcribeAudioFile(fileToTranscribe, config)
        if (!transcription || !transcription.segments?.length) {
          throw new Error('Falha ao gerar a timeline (Groq/OpenAI não retornaram segmentos)')
        }
        transcriptSegments = transcription.segments
        // Named after the original input file (nicer than the intermediate audio file)
        const srtPath = saveSrtFile(transcription.segments, filePath, outputDir)
        outputFiles.push(srtPath)
      })
    }

    if (ok && operation.steps.includes('Selecionar destaques com IA')) {
      ok = await runStep('Selecionar destaques com IA', async () => {
        if (!transcriptSegments?.length) {
          throw new Error('Nenhuma timeline disponível para analisar')
        }
        if (!request.highlightOptions) {
          throw new Error('Configuração da IA de destaques ausente')
        }

        highlights = await extractVideoHighlights(
          transcriptSegments,
          request.highlightOptions.prompt,
          {
            provider: request.highlightOptions.provider,
            model: request.highlightOptions.model,
            apiKey: resolveHighlightApiKey(request.highlightOptions.provider, config)
          },
          buildHighlightFallbackOptions(config, request.highlightOptions)
        )

        if (highlights.length === 0) {
          throw new Error('A IA não encontrou destaques relevantes para esse pedido')
        }
      })
    }

    if (ok && operation.steps.includes('Cortar clipes')) {
      ok = await runStep('Cortar clipes', async () => {
        const clips = await cutHighlightClipsWithAssets(filePath, highlights!, outputDir!, {
          marginSeconds: request.highlightOptions?.marginSeconds ?? 0
        })
        for (const clip of clips) {
          outputFiles.push(clip.clip.outputPath, ...clip.thumbnailFrames)
          if (clip.thumbnailPromptsFile) outputFiles.push(clip.thumbnailPromptsFile)
        }
      })
    }
  } catch (error: any) {
    ok = false
    emitProgress('failed', error?.message || String(error))
  }

  const finishedAt = new Date().toISOString()
  emitProgress(ok ? 'completed' : 'failed')

  addHistoryEntry({
    id: jobId,
    operation: request.operation,
    operationLabel: operation.label,
    inputFile: filePath,
    outputFiles,
    startedAt,
    finishedAt,
    status: ok ? 'completed' : 'failed',
    error: ok ? undefined : steps.find((s) => s.status === 'failed')?.error,
    conversionOptions: request.conversionOptions,
    highlightOptions: request.highlightOptions
  })
}

/**
 * Turns the user's configured fallback list (settings, provider+model only) into
 * ready-to-use AI options (resolving each one's API key). Entries whose provider
 * has no key configured, or that duplicate the primary provider+model already
 * being tried, are skipped rather than failing the whole run.
 */
function buildHighlightFallbackOptions(
  config: StoredConfig,
  primary: { provider: string; model: string }
): HighlightAIOptions[] {
  const fallbacks = config.highlightFallbackModels ?? []
  const options: HighlightAIOptions[] = []

  for (const fallback of fallbacks) {
    if (fallback.provider === primary.provider && fallback.model === primary.model) continue

    try {
      options.push({
        provider: fallback.provider,
        model: fallback.model,
        apiKey: resolveHighlightApiKey(fallback.provider, config)
      })
    } catch {
      // No API key configured for this fallback provider — skip it instead of failing the run.
    }
  }

  return options
}

function resolveHighlightApiKey(provider: string, config: StoredConfig): string {
  const key = ({
    anthropic: config.anthropicApiKey,
    gemini: config.geminiApiKey,
    openrouter: config.openrouterApiKey,
    openai: config.openaiApiKey,
    groq: config.groqApiKey
  } as Record<string, string | undefined>)[provider]

  if (!key) {
    throw new Error(`Nenhuma API key configurada para o provedor "${provider}"`)
  }
  return key
}
