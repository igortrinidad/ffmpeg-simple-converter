import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { getConfigDirectory } from 'mediacript'
import { createRunStamp, getFeatureOutputDir } from './outputPaths'
import type {
  AIProviderName,
  ChatMessageEntry,
  MeetingAudioSetup,
  MeetingSegment,
  MeetingStatus,
  MeetingSummary,
  MeetingTrack
} from '../../shared/types'

/**
 * On-disk shape of a meeting. Like `PersistedChatSession`, it stores only
 * `provider`/`model` and never a resolved API key — secrets stay in config.json.
 *
 * The JSON metadata lives in the config dir (small, app-owned) while the audio
 * and generated documents live in a user-visible folder under Documents, so
 * people can open/share the .md files without digging through app data.
 */
export interface PersistedMeeting {
  id: string
  title: string
  folderPath: string
  status: MeetingStatus
  durationSeconds: number
  setup: MeetingAudioSetup
  provider: AIProviderName
  model: string
  agentId?: string
  objective?: string
  /** Raw MediaRecorder output, one file per track, written incrementally while recording. */
  rawFiles: Partial<Record<MeetingTrack, string>>
  /** Transcription-ready mp3 produced from each raw file. */
  audioFiles: Partial<Record<MeetingTrack, string>>
  segments: MeetingSegment[]
  transcriptText?: string
  transcriptFilePath?: string
  minutes?: string
  minutesFilePath?: string
  history: ChatMessageEntry[]
  error?: string
  createdAt: string
  updatedAt: string
}

/** Filesystem-safe folder name for a meeting title (accents stripped, punctuation collapsed). */
function slugifyName(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'reuniao'
}

function getMeetingsMetaDir(): string {
  return path.join(getConfigDirectory(), 'meetings')
}

function getMeetingFilePath(id: string): string {
  return path.join(getMeetingsMetaDir(), `${id}.json`)
}

/** User-visible root for meeting audio + generated documents. */
export function getMeetingsRootDir(): string {
  return getFeatureOutputDir('meetings')
}

export function createMeeting(input: {
  title: string
  setup: MeetingAudioSetup
  provider: AIProviderName
  model: string
  agentId?: string
  objective?: string
}): PersistedMeeting {
  const now = new Date()
  const id = randomUUID()
  const folderPath = path.join(getMeetingsRootDir(), `${createRunStamp(now)}_${slugifyName(input.title)}`)
  fs.mkdirSync(folderPath, { recursive: true })

  const meeting: PersistedMeeting = {
    id,
    title: input.title,
    folderPath,
    status: 'recording',
    durationSeconds: 0,
    setup: input.setup,
    provider: input.provider,
    model: input.model,
    agentId: input.agentId,
    objective: input.objective,
    rawFiles: {},
    audioFiles: {},
    segments: [],
    history: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }

  saveMeeting(meeting)
  return meeting
}

export function loadMeeting(id: string): PersistedMeeting {
  const filePath = getMeetingFilePath(id)
  if (!fs.existsSync(filePath)) {
    throw new Error('Reunião não encontrada — ela pode ter sido excluída.')
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedMeeting
}

export function saveMeeting(meeting: PersistedMeeting): void {
  const dir = getMeetingsMetaDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  meeting.updatedAt = new Date().toISOString()
  fs.writeFileSync(getMeetingFilePath(meeting.id), JSON.stringify(meeting, null, 2), 'utf-8')
}

export function listMeetings(): MeetingSummary[] {
  try {
    const dir = getMeetingsMetaDir()
    if (!fs.existsSync(dir)) return []

    return fs
      .readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => {
        const meeting = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as PersistedMeeting
        return toSummary(meeting)
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch (error) {
    console.error('Error reading meetings:', error)
    return []
  }
}

export function toSummary(meeting: PersistedMeeting): MeetingSummary {
  return {
    id: meeting.id,
    title: meeting.title,
    status: meeting.status,
    durationSeconds: meeting.durationSeconds,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    hasMinutes: !!meeting.minutes,
    error: meeting.error
  }
}

/** Deletes the metadata and, optionally, the recorded audio/documents folder. */
export function deleteMeeting(id: string, removeFiles: boolean): void {
  let folderPath: string | null = null
  try {
    folderPath = loadMeeting(id).folderPath
  } catch {
    // Metadata already gone — nothing to look up, just make sure the file is removed below.
  }

  const filePath = getMeetingFilePath(id)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  if (removeFiles && folderPath && fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true })
  }
}

// --- Incremental recording writers ------------------------------------------

/**
 * Open write streams, keyed by `${meetingId}:${track}`. Chunks are appended as
 * the recorder produces them instead of being buffered in the renderer until
 * stop — a two-hour meeting must not live in memory, and a crash mid-meeting
 * should still leave a playable/transcribable file on disk.
 */
const openStreams = new Map<string, fs.WriteStream>()

function streamKey(meetingId: string, track: MeetingTrack): string {
  return `${meetingId}:${track}`
}

export function appendChunk(meetingId: string, track: MeetingTrack, chunk: Buffer): void {
  const key = streamKey(meetingId, track)
  let stream = openStreams.get(key)

  if (!stream) {
    const meeting = loadMeeting(meetingId)
    const filePath = path.join(meeting.folderPath, `${track}.webm`)
    stream = fs.createWriteStream(filePath)
    openStreams.set(key, stream)

    meeting.rawFiles[track] = filePath
    saveMeeting(meeting)
  }

  stream.write(chunk)
}

function closeStream(meetingId: string, track: MeetingTrack): Promise<void> {
  const key = streamKey(meetingId, track)
  const stream = openStreams.get(key)
  if (!stream) return Promise.resolve()

  openStreams.delete(key)
  return new Promise((resolve) => stream.end(() => resolve()))
}

/** Flushes every open track stream for a meeting — call before touching the raw files. */
export async function closeStreams(meetingId: string): Promise<void> {
  await Promise.all([closeStream(meetingId, 'mic'), closeStream(meetingId, 'system')])
}
