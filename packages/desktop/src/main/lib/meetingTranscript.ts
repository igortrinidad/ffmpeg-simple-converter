import type { MeetingSegment, MeetingTrack } from '../../shared/types'

export const TRACK_LABELS: Record<MeetingTrack, string> = {
  mic: 'Você',
  system: 'Participantes'
}

function normalizeForCompare(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Jaccard similarity over word sets — enough to spot the same sentence transcribed twice. */
function textSimilarity(a: string, b: string): number {
  const setA = new Set(normalizeForCompare(a))
  const setB = new Set(normalizeForCompare(b))
  if (!setA.size || !setB.size) return 0

  let shared = 0
  for (const word of setA) {
    if (setB.has(word)) shared++
  }
  return shared / (setA.size + setB.size - shared)
}

function overlapSeconds(a: MeetingSegment, b: MeetingSegment): number {
  return Math.min(a.end, b.end) - Math.max(a.start, b.start)
}

/**
 * Interleaves both tracks into one chronological transcript.
 *
 * When the user isn't wearing headphones the microphone also picks up the
 * speakers, so the same sentence gets transcribed on both tracks. Where a mic
 * segment overlaps a system segment in time AND says roughly the same thing,
 * the mic copy is dropped: the loopback capture is the cleaner source, and
 * keeping both would make the AI think everyone repeated themselves.
 */
export function mergeTrackSegments(
  micSegments: MeetingSegment[],
  systemSegments: MeetingSegment[]
): MeetingSegment[] {
  const SIMILARITY_THRESHOLD = 0.6
  const MIN_OVERLAP_SECONDS = 0.5

  const keptMic = micSegments.filter(
    (mic) =>
      !systemSegments.some(
        (system) =>
          overlapSeconds(mic, system) > MIN_OVERLAP_SECONDS &&
          textSimilarity(mic.text, system.text) >= SIMILARITY_THRESHOLD
      )
  )

  return [...keptMic, ...systemSegments].sort((a, b) => a.start - b.start || a.end - b.end)
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** The speaker-labelled, timestamped transcript — both what gets saved and what the AI reads. */
export function buildTranscriptText(segments: MeetingSegment[]): string {
  return segments
    .map((segment) => `[${formatTimestamp(segment.start)}] ${TRACK_LABELS[segment.track]}: ${segment.text}`)
    .join('\n')
}
