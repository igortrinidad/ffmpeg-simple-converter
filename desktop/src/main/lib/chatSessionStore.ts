import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getConfigDirectory } from 'mediacript'
import type { AIProviderName, TranscriptSegment, HighlightSegment } from 'mediacript'
import type { ChatMessageEntry, ChatSessionSummary, ExportOptionsInput } from '../../shared/types'

/**
 * On-disk shape of a chat session. Deliberately does NOT store a resolved API
 * key — only `provider`/`model` — so secrets stay only in config.json instead
 * of being duplicated across every session file. Callers re-resolve the key
 * from the stored config each time they need to call the AI.
 */
export interface PersistedChatSession {
  id: string
  filePath: string
  segments: TranscriptSegment[]
  audioFilePath: string
  history: ChatMessageEntry[]
  highlights: HighlightSegment[]
  provider: AIProviderName
  model: string
  agentId?: string
  objective?: string
  status: 'active' | 'finished'
  exportOptions?: ExportOptionsInput
  outputFiles?: string[]
  createdAt: string
  updatedAt: string
}

function getSessionsDir(): string {
  return path.join(getConfigDirectory(), 'chat-sessions')
}

function getSessionFilePath(id: string): string {
  return path.join(getSessionsDir(), `${id}.json`)
}

function ensureSessionsDir(): void {
  const dir = getSessionsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function createSession(
  input: Omit<PersistedChatSession, 'id' | 'status' | 'history' | 'highlights' | 'createdAt' | 'updatedAt'>
): PersistedChatSession {
  const now = new Date().toISOString()
  const session: PersistedChatSession = {
    ...input,
    id: randomUUID(),
    history: [],
    highlights: [],
    status: 'active',
    createdAt: now,
    updatedAt: now
  }
  saveSession(session)
  return session
}

export function loadSession(id: string): PersistedChatSession {
  const filePath = getSessionFilePath(id)
  if (!fs.existsSync(filePath)) {
    throw new Error('Sessão de chat não encontrada — ela pode ter sido encerrada.')
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedChatSession
}

export function saveSession(session: PersistedChatSession): void {
  ensureSessionsDir()
  session.updatedAt = new Date().toISOString()
  fs.writeFileSync(getSessionFilePath(session.id), JSON.stringify(session, null, 2), 'utf-8')
}

export function listSessions(): ChatSessionSummary[] {
  try {
    const dir = getSessionsDir()
    if (!fs.existsSync(dir)) return []

    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const session = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as PersistedChatSession
        return {
          id: session.id,
          filePath: session.filePath,
          agentId: session.agentId,
          status: session.status,
          messageCount: session.history.length,
          highlightCount: session.highlights.length,
          updatedAt: session.updatedAt,
          outputFiles: session.outputFiles
        }
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch (error) {
    console.error('Error reading chat sessions:', error)
    return []
  }
}

export function deleteSession(id: string): void {
  const filePath = getSessionFilePath(id)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}
