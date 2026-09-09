import fs from 'fs'
import { randomUUID } from 'crypto'
import {
  convertVideoFile,
  extractAudioFromVideo,
  convertAudioFile,
  transcribeAudioFile,
  saveTranscriptionToFile,
  saveSrtFile,
  loadSrtFile,
  extractVideoHighlights,
  cutHighlightClipsWithAssets,
  exportClipToFormat,
  applySubtitlesToVideo,
  getStoredConfig
} from 'mediacript'
import type { TranscriptSegment, HighlightSegment } from 'mediacript'
import { getOperation } from '../../shared/operations'
import { addHistoryEntry } from './historyStore'
import { saveSubtitleTextFile } from './subtitleText'
import {
  createRunOutputDir,
  createRunStamp,
  findPreviousOutput,
  findPreviousRunDir,
  getFeatureOutputDir,
  moveOutputInto,
  type OutputFeature
} from './outputPaths'
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
  let srtFilePath: string | undefined

  // Every output goes to the app's output root, inside the folder of the module
  // that produced it (see outputPaths.ts) — never next to the source file.
  // Highlight runs generate a whole set of files (audio, subtitles, clips,
  // thumbnails), so they get one datetime-named folder per run instead of a
  // datetime prefix on each file.
  const generatesHighlightClips = operation.steps.includes('Cortar clipes')
  const groupedRun = generatesHighlightClips || !!operation.startsHighlightChat
  const feature: OutputFeature = groupedRun
    ? 'highlights'
    : operation.belongsToSubtitleModule
      ? 'subtitle'
      : 'convert'
  const runStamp = createRunStamp()
  const outputDir = groupedRun
    ? createRunOutputDir(feature, filePath, runStamp)
    : getFeatureOutputDir(feature)

  /**
   * Files a step produced land in `outputDir`, named after the run — grouped
   * runs skip the datetime prefix since their folder already carries it.
   */
  const stamped = (producedPath: string): string =>
    moveOutputInto(producedPath, outputDir, groupedRun ? undefined : runStamp)

  // Where a previous run for this same source file left its reusable artifacts:
  // the module's folder for flat runs, the previous run's folder for grouped ones.
  const previousDirs = groupedRun
    ? [outputDir, findPreviousRunDir(feature, filePath, outputDir)].filter((dir): dir is string => !!dir)
    : [outputDir]

  // If a previous run already produced the .srt for this exact file, reuse it
  // instead of paying for transcription again — the timeline doesn't change
  // unless the source file does.
  const usesSubtitleTimeline =
    operation.steps.includes('Gerar legendas') || operation.steps.includes('Extrair texto')
  const existingSrtPath = usesSubtitleTimeline
    ? findPreviousOutput(previousDirs, filePath, '.srt')
    : undefined
  const reuseExistingSrt = !!existingSrtPath && fs.existsSync(existingSrtPath)

  // The highlight chat needs the extracted audio to persist on disk for
  // in-panel playback, independent of whether the .srt was reused — so it
  // still gets extracted (from a stable, reusable path) even when transcription
  // itself is skipped, and reused across runs the same way the .srt is.
  const needsPersistedAudio = !!operation.startsHighlightChat
  const persistedAudioPath = needsPersistedAudio
    ? findPreviousOutput(previousDirs, filePath, '_audio.mp3')
    : undefined
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
        currentFile = stamped(result.outputPath)
        outputFiles.push(currentFile)
        videoOutputFiles.push(currentFile)
      })
    }

    if (ok && operation.steps.includes('Converter áudio')) {
      ok = await runStep('Converter áudio', async () => {
        const result = await convertAudioFile(currentFile, outputDir)
        currentFile = stamped(result.outputPath)
        outputFiles.push(currentFile)
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
          audioFile = stamped(result.outputPath)
          currentFile = audioFile
          outputFiles.push(audioFile)
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
        outputFiles.push(stamped(textPath))
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
          srtFilePath = existingSrtPath
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
        const srtPath = stamped(saveSrtFile(transcription.segments, filePath, outputDir))
        srtFilePath = srtPath
        outputFiles.push(srtPath)
        onTranscriptReady?.(jobId, filePath, transcription.segments, audioFile ?? fileToTranscribe)
      })
    }

    if (ok && operation.steps.includes('Extrair texto')) {
      ok = await runStep('Extrair texto', async () => {
        // Unlike the .srt operations this one leaves no timeline file behind — but it
        // still reuses one from a previous run instead of transcribing again.
        let segments = transcriptSegments
        if (!segments?.length && reuseExistingSrt && existingSrtPath) {
          segments = loadSrtFile(existingSrtPath)
          if (segments.length) {
            console.log(`\n✓ Legendas já existiam, reaproveitando: ${existingSrtPath}`)
          }
        }

        if (!segments?.length) {
          const fileToTranscribe = audioFile || currentFile
          const transcription = await transcribeAudioFile(fileToTranscribe, config)
          if (!transcription || !transcription.segments?.length) {
            throw new Error('Falha ao transcrever com os provedores configurados (Groq/OpenAI)')
          }
          segments = transcription.segments
        }

        transcriptSegments = segments
        const textPath = stamped(saveSubtitleTextFile(segments, filePath, outputDir))
        outputFiles.push(textPath)
      })
    }

    if (ok && operation.steps.includes('Aplicar legendas')) {
      ok = await runStep('Aplicar legendas', async () => {
        if (!srtFilePath) {
          throw new Error('Nenhum arquivo de legenda disponível para aplicar')
        }
        const mode = request.subtitleOptions?.mode ?? 'hardsub'
        const result = await applySubtitlesToVideo(filePath, srtFilePath, mode, outputDir)
        const subtitledPath = stamped(result.outputPath)
        outputFiles.push(subtitledPath)
        videoOutputFiles.push(subtitledPath)
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
        const clips = await cutHighlightClipsWithAssets(filePath, highlights!, outputDir, {
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
            outputFiles.push(stamped(exported.outputPath))
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
    exportOptions: request.exportOptions,
    subtitleOptions: request.subtitleOptions
  })
}
