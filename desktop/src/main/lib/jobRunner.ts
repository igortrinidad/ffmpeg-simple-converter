import fs from 'fs'
import { randomUUID } from 'crypto'
import {
  convertVideoFile,
  extractAudioFromVideo,
  getExtractedAudioPath,
  convertAudioFile,
  transcribeAudioFile,
  saveTranscriptionToFile,
  saveSrtFile,
  getSrtOutputPath,
  loadSrtFile,
  extractVideoHighlights,
  cutHighlightClipsWithAssets,
  createOutputFolderForFile,
  exportClipToFormat,
  getStoredConfig
} from 'mediacript'
import type { TranscriptSegment, HighlightSegment } from 'mediacript'
import { getOperation } from '../../shared/operations'
import { addHistoryEntry } from './historyStore'
import { captureConsole } from './consoleCapture'
import { resolveHighlightApiKey, buildHighlightFallbackOptions } from './aiOptions'
import type { JobEvent, JobLogLine, JobRequest, JobStepState } from '../../shared/types'

type EmitFn = (event: JobEvent) => void
type LogFn = (line: JobLogLine) => void
type TranscriptReadyFn = (jobId: string, filePath: string, segments: TranscriptSegment[], audioFilePath: string) => void
type StoredConfig = ReturnType<typeof getStoredConfig>

/**
 * Runs one job (an operation applied to one or more files) sequentially,
 * emitting a JobEvent after every step so the renderer can show live progress.
 * Mirrors the CLI's executeWorkflow, but calls mediacript's primitives one at a
 * time (instead of the convenience composite functions) for finer-grained
 * progress reporting, and records a history entry per file.
 */
export async function runJob(
  request: JobRequest,
  emit: EmitFn,
  onLog: LogFn,
  onTranscriptReady?: TranscriptReadyFn
): Promise<void> {
  const operation = getOperation(request.operation)
  const config = getStoredConfig()

  for (let fileIndex = 0; fileIndex < request.filePaths.length; fileIndex++) {
    await runJobForFile(request, operation, config, fileIndex, emit, onLog, onTranscriptReady)
  }
}

async function runJobForFile(
  request: JobRequest,
  operation: ReturnType<typeof getOperation>,
  config: StoredConfig,
  fileIndex: number,
  emit: EmitFn,
  onLog: LogFn,
  onTranscriptReady?: TranscriptReadyFn
): Promise<void> {
  const filePath = request.filePaths[fileIndex]
  const jobId = randomUUID()
  const startedAt = new Date().toISOString()
  const wantsFormatExport = !!request.exportOptions?.formats.length
  // "Exportar formatos" isn't baked into OPERATIONS.steps — it's driven by the
  // user's export selection at run time, and applies across many operations.
  const stepNames = wantsFormatExport ? [...operation.steps, 'Exportar formatos'] : operation.steps
  const steps: JobStepState[] = stepNames.map((name) => ({ name, status: 'pending' }))
  const outputFiles: string[] = []
  // Subset of outputFiles eligible for platform re-export (final video outputs only —
  // not audio/text/srt/thumbnail files).
  const videoOutputFiles: string[] = []

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

  // If a previous run already produced the .srt for this exact file, reuse it
  // instead of paying for transcription again — the timeline doesn't change
  // unless the source file does.
  const existingSrtPath = operation.steps.includes('Gerar legendas')
    ? getSrtOutputPath(filePath, outputDir)
    : undefined
  const reuseExistingSrt = !!existingSrtPath && fs.existsSync(existingSrtPath)

  // The highlight chat needs the extracted audio to persist on disk for
  // in-panel playback, independent of whether the .srt was reused — so it
  // still gets extracted (from a stable, reusable path) even when transcription
  // itself is skipped, and reused across runs the same way the .srt is.
  const needsPersistedAudio = !!operation.startsHighlightChat
  const persistedAudioPath = needsPersistedAudio ? getExtractedAudioPath(filePath, outputDir) : undefined
  const persistedAudioExists = !!persistedAudioPath && fs.existsSync(persistedAudioPath)
  const canSkipAudioExtraction = needsPersistedAudio ? persistedAudioExists : reuseExistingSrt

  // mediacript logs what it's doing (ffmpeg progress, AI provider retries/
  // fallbacks, etc.) via plain console calls with no structured event of their
  // own — mirror them to the renderer so the user can see what's happening.
  const stopCapture = captureConsole((line) => {
    onLog({ jobId, filePath, ...line, timestamp: new Date().toISOString() })
  })

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
        videoOutputFiles.push(result.outputPath)
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
      if (canSkipAudioExtraction) {
        // Either the audio was only ever extracted to feed transcription and
        // the .srt is already on disk, or (for the highlight chat) the
        // persisted audio file itself is already there — nothing left to do.
        steps.find((s) => s.name === 'Extrair áudio')!.status = 'skipped'
        emitProgress('running')
        if (persistedAudioPath) {
          audioFile = persistedAudioPath
          currentFile = persistedAudioPath
        }
      } else {
        ok = await runStep('Extrair áudio', async () => {
          const result = await extractAudioFromVideo(currentFile, outputDir)
          audioFile = result.outputPath
          currentFile = result.outputPath
          outputFiles.push(result.outputPath)
        })
      }
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
        if (reuseExistingSrt && existingSrtPath) {
          const segments = loadSrtFile(existingSrtPath)
          if (!segments.length) {
            throw new Error(`O arquivo .srt existente está vazio ou não pôde ser lido: ${existingSrtPath}`)
          }
          console.log(`\n✓ Legendas já existiam, reaproveitando: ${existingSrtPath}`)
          transcriptSegments = segments
          outputFiles.push(existingSrtPath)
          onTranscriptReady?.(jobId, filePath, segments, audioFile ?? currentFile)
          return
        }

        const fileToTranscribe = audioFile || currentFile
        const transcription = await transcribeAudioFile(fileToTranscribe, config)
        if (!transcription || !transcription.segments?.length) {
          throw new Error('Falha ao gerar a timeline (Groq/OpenAI não retornaram segmentos)')
        }
        transcriptSegments = transcription.segments
        // Named after the original input file (nicer than the intermediate audio file)
        const srtPath = saveSrtFile(transcription.segments, filePath, outputDir)
        outputFiles.push(srtPath)
        onTranscriptReady?.(jobId, filePath, transcription.segments, audioFile ?? fileToTranscribe)
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
          videoOutputFiles.push(clip.clip.outputPath)
        }
      })
    }

    if (ok && wantsFormatExport) {
      ok = await runStep('Exportar formatos', async () => {
        const { formats, quality, framing } = request.exportOptions!
        for (const videoFile of videoOutputFiles) {
          for (const formatId of formats) {
            const exported = await exportClipToFormat(videoFile, formatId, quality, framing, outputDir)
            outputFiles.push(exported.outputPath)
          }
        }
      })
    }
  } catch (error: any) {
    ok = false
    emitProgress('failed', error?.message || String(error))
  } finally {
    stopCapture()
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
    highlightOptions: request.highlightOptions,
    exportOptions: request.exportOptions
  })
}
