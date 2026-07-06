import {
  continueVideoHighlightChat,
  cutHighlightClipsWithAssets,
  createOutputFolderForFile,
  exportClipToFormat,
  getStoredConfig
} from 'mediacript'
import type { TranscriptSegment, HighlightSegment, HighlightAIOptions } from 'mediacript'
import { resolveHighlightApiKey, buildHighlightFallbackOptions } from './aiOptions'
import { buildMediaUrl } from './mediaProtocol'
import { captureConsole, type ConsoleLogLine } from './consoleCapture'
import {
  createSession,
  loadSession,
  saveSession,
  listSessions as listPersistedSessions,
  deleteSession as deletePersistedSession,
  type PersistedChatSession
} from './chatSessionStore'
import type {
  HighlightChatOptions,
  ChatSessionSummary,
  HighlightChatResumeResult,
  ExportOptionsInput
} from '../../shared/types'

interface PendingTranscript {
  filePath: string
  segments: TranscriptSegment[]
  audioFilePath: string
}

// Short-lived handoff between a transcribe-only job finishing and the user
// picking an agent/starting the chat — not a "session" yet, so it doesn't need
// to survive a restart the way an actual chat session does.
const pendingTranscripts = new Map<string, PendingTranscript>()

/** Called once a transcribe-only job (`operation.startsHighlightChat`) finishes, so `startSession` has something to pick up. */
export function registerTranscript(
  jobId: string,
  filePath: string,
  segments: TranscriptSegment[],
  audioFilePath: string
): void {
  pendingTranscripts.set(jobId, { filePath, segments, audioFilePath })
}

function resolveAiOptions(session: Pick<PersistedChatSession, 'provider' | 'model'>): {
  aiOptions: HighlightAIOptions
  fallbackOptions: HighlightAIOptions[]
} {
  const config = getStoredConfig()
  const aiOptions: HighlightAIOptions = {
    provider: session.provider,
    model: session.model,
    apiKey: resolveHighlightApiKey(session.provider, config)
  }
  const fallbackOptions = buildHighlightFallbackOptions(config, session)
  return { aiOptions, fallbackOptions }
}

async function runTurn(
  session: PersistedChatSession,
  message: string
): Promise<{ reply: string; highlights: HighlightSegment[] }> {
  const { aiOptions, fallbackOptions } = resolveAiOptions(session)

  const result = await continueVideoHighlightChat(
    session.segments,
    session.history,
    message,
    session.highlights,
    aiOptions,
    fallbackOptions,
    session.objective
  )

  session.history.push({ role: 'user', content: message }, { role: 'assistant', content: result.reply })
  session.highlights = result.highlights

  return result
}

export async function startSession(
  jobId: string,
  options: HighlightChatOptions,
  agentId?: string,
  objective?: string
): Promise<{ sessionId: string; segments: TranscriptSegment[]; audioUrl: string; initialTurn?: { reply: string; highlights: HighlightSegment[] } }> {
  const pending = pendingTranscripts.get(jobId)
  if (!pending) {
    throw new Error('Transcrição não encontrada para esse job — rode a transcrição novamente.')
  }
  pendingTranscripts.delete(jobId)

  const session = createSession({
    filePath: pending.filePath,
    segments: pending.segments,
    audioFilePath: pending.audioFilePath,
    provider: options.provider,
    model: options.model,
    agentId,
    objective
  })

  let initialTurn: { reply: string; highlights: HighlightSegment[] } | undefined

  if (objective?.trim()) {
    initialTurn = await runTurn(session, objective.trim())
  }

  saveSession(session)

  return {
    sessionId: session.id,
    segments: session.segments,
    audioUrl: buildMediaUrl(session.audioFilePath),
    initialTurn
  }
}

export function listSessions(): ChatSessionSummary[] {
  return listPersistedSessions()
}

export function resumeSession(sessionId: string): HighlightChatResumeResult {
  const session = loadSession(sessionId)
  return {
    sessionId: session.id,
    segments: session.segments,
    audioUrl: buildMediaUrl(session.audioFilePath),
    history: session.history,
    highlights: session.highlights,
    agentId: session.agentId,
    exportOptions: session.exportOptions,
    status: session.status,
    outputFiles: session.outputFiles
  }
}

export function deleteSession(sessionId: string): void {
  deletePersistedSession(sessionId)
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<{ reply: string; highlights: HighlightSegment[] }> {
  const session = loadSession(sessionId)
  const result = await runTurn(session, message)
  saveSession(session)
  return result
}

/**
 * Lets the user manually drop a highlight the AI proposed, independent of the
 * chat. Mutates the session's own list (not just what the renderer shows) so
 * a later chat turn doesn't "see" the removed highlight as still selected,
 * and `processCuts` never cuts something the user explicitly discarded.
 */
export function removeHighlight(sessionId: string, index: number): { highlights: HighlightSegment[] } {
  const session = loadSession(sessionId)

  if (index < 0 || index >= session.highlights.length) {
    throw new Error('Destaque não encontrado nessa posição.')
  }

  session.highlights = session.highlights.filter((_, i) => i !== index)
  saveSession(session)

  return { highlights: session.highlights }
}

/**
 * Lets the user manually fine-tune a highlight's boundaries (e.g. via a
 * start/end slider in the UI), independent of the chat. Same rationale as
 * `removeHighlight`: mutates the session's own list so it's what a later
 * chat turn sees and what `processCuts` actually cuts.
 */
export function updateHighlightRange(
  sessionId: string,
  index: number,
  start: number,
  end: number
): { highlights: HighlightSegment[] } {
  const session = loadSession(sessionId)

  if (index < 0 || index >= session.highlights.length) {
    throw new Error('Destaque não encontrado nessa posição.')
  }
  if (!(start < end)) {
    throw new Error('O início do trecho deve ser menor que o fim.')
  }

  const totalDuration = session.segments[session.segments.length - 1].end

  session.highlights = session.highlights.map((h, i) =>
    i === index ? { ...h, start: Math.max(0, start), end: Math.min(totalDuration, end) } : h
  )
  saveSession(session)

  return { highlights: session.highlights }
}

export async function processCuts(
  sessionId: string,
  marginSeconds: number,
  exportOptions?: ExportOptionsInput,
  onLog?: (line: ConsoleLogLine) => void
): Promise<{ outputFiles: string[] }> {
  const session = loadSession(sessionId)

  if (!session.highlights.length) {
    throw new Error('Nenhum destaque definido ainda — converse com a IA antes de processar os cortes.')
  }

  // mediacript reports ffmpeg progress/step messages via plain console calls
  // with no structured event of their own — mirror them out so the UI can
  // show the user cutting is actually happening, same as the main wizard's
  // job progress log.
  const stopCapture = onLog ? captureConsole(onLog) : undefined

  try {
    const outputDir = createOutputFolderForFile(session.filePath)
    const clips = await cutHighlightClipsWithAssets(session.filePath, session.highlights, outputDir, { marginSeconds })

    const outputFiles: string[] = []
    for (const clip of clips) {
      outputFiles.push(clip.clip.outputPath, ...clip.thumbnailFrames)
      if (clip.thumbnailPromptsFile) outputFiles.push(clip.thumbnailPromptsFile)

      if (exportOptions?.formats.length) {
        for (const formatId of exportOptions.formats) {
          const exported = await exportClipToFormat(clip.clip.outputPath, formatId, exportOptions.quality, exportOptions.framing, clip.clipDir)
          outputFiles.push(exported.outputPath)
        }
      }
    }

    session.status = 'finished'
    session.exportOptions = exportOptions
    session.outputFiles = outputFiles
    saveSession(session)

    return { outputFiles }
  } finally {
    stopCapture?.()
  }
}
