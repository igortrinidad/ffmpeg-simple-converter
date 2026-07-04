import { randomUUID } from 'crypto'
import {
  continueVideoHighlightChat,
  cutHighlightClipsWithAssets,
  createOutputFolderForFile,
  getStoredConfig
} from 'mediacript'
import type { TranscriptSegment, HighlightSegment, HighlightChatMessage, HighlightAIOptions } from 'mediacript'
import { resolveHighlightApiKey, buildHighlightFallbackOptions } from './aiOptions'
import { buildMediaUrl } from './mediaProtocol'
import { captureConsole, type ConsoleLogLine } from './consoleCapture'
import type { HighlightChatOptions } from '../../shared/types'

interface PendingTranscript {
  filePath: string
  segments: TranscriptSegment[]
  audioFilePath: string
}

interface HighlightChatSession {
  filePath: string
  segments: TranscriptSegment[]
  audioFilePath: string
  history: HighlightChatMessage[]
  highlights: HighlightSegment[]
  aiOptions: HighlightAIOptions
  fallbackOptions: HighlightAIOptions[]
}

// In-memory only, like the rest of the desktop app's runtime state — lost on
// restart, which is fine for a single editing session.
const pendingTranscripts = new Map<string, PendingTranscript>()
const sessions = new Map<string, HighlightChatSession>()

/** Called once a transcribe-only job (`operation.startsHighlightChat`) finishes, so `startSession` has something to pick up. */
export function registerTranscript(
  jobId: string,
  filePath: string,
  segments: TranscriptSegment[],
  audioFilePath: string
): void {
  pendingTranscripts.set(jobId, { filePath, segments, audioFilePath })
}

export function startSession(
  jobId: string,
  options: HighlightChatOptions
): { sessionId: string; segments: TranscriptSegment[]; audioUrl: string } {
  const pending = pendingTranscripts.get(jobId)
  if (!pending) {
    throw new Error('Transcrição não encontrada para esse job — rode a transcrição novamente.')
  }
  pendingTranscripts.delete(jobId)

  const config = getStoredConfig()
  const aiOptions: HighlightAIOptions = {
    provider: options.provider,
    model: options.model,
    apiKey: resolveHighlightApiKey(options.provider, config)
  }
  const fallbackOptions = buildHighlightFallbackOptions(config, options)

  const sessionId = randomUUID()
  sessions.set(sessionId, {
    filePath: pending.filePath,
    segments: pending.segments,
    audioFilePath: pending.audioFilePath,
    history: [],
    highlights: [],
    aiOptions,
    fallbackOptions
  })

  return { sessionId, segments: pending.segments, audioUrl: buildMediaUrl(pending.audioFilePath) }
}

function getSession(sessionId: string): HighlightChatSession {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error('Sessão de chat não encontrada — ela pode ter sido encerrada.')
  }
  return session
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<{ reply: string; highlights: HighlightSegment[] }> {
  const session = getSession(sessionId)

  const result = await continueVideoHighlightChat(
    session.segments,
    session.history,
    message,
    session.highlights,
    session.aiOptions,
    session.fallbackOptions
  )

  session.history.push({ role: 'user', content: message }, { role: 'assistant', content: result.reply })
  session.highlights = result.highlights

  return result
}

/**
 * Lets the user manually drop a highlight the AI proposed, independent of the
 * chat. Mutates the session's own list (not just what the renderer shows) so
 * a later chat turn doesn't "see" the removed highlight as still selected,
 * and `processCuts` never cuts something the user explicitly discarded.
 */
export function removeHighlight(sessionId: string, index: number): { highlights: HighlightSegment[] } {
  const session = getSession(sessionId)

  if (index < 0 || index >= session.highlights.length) {
    throw new Error('Destaque não encontrado nessa posição.')
  }

  session.highlights = session.highlights.filter((_, i) => i !== index)

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
  const session = getSession(sessionId)

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

  return { highlights: session.highlights }
}

export async function processCuts(
  sessionId: string,
  marginSeconds: number,
  onLog?: (line: ConsoleLogLine) => void
): Promise<{ outputFiles: string[] }> {
  const session = getSession(sessionId)

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
    }

    return { outputFiles }
  } finally {
    stopCapture?.()
  }
}
