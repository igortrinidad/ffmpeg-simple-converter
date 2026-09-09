import type { HighlightSegment, TranscriptSegment } from '../types/index.js'

export function buildTimelineText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => `[${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s] ${segment.text.trim()}`)
    .join('\n')
}

export function isValidHighlight(value: any): value is HighlightSegment {
  return !!value
    && typeof value.start === 'number'
    && typeof value.end === 'number'
    && typeof value.title === 'string'
    && value.end > value.start
}

/**
 * Filters out malformed entries, clamps each highlight's times to
 * `[0, totalDuration]`, and sorts the result chronologically — the same
 * normalization every AI response (one-shot or chat) needs applied before
 * it's usable.
 */
export function normalizeHighlights(list: any[], totalDuration: number): HighlightSegment[] {
  return list
    .filter(isValidHighlight)
    .map((highlight: any): HighlightSegment => ({
      start: Math.max(0, highlight.start),
      end: Math.min(totalDuration, highlight.end),
      title: String(highlight.title).trim(),
      reason: highlight.reason ? String(highlight.reason).trim() : undefined,
      thumbnailPrompts: Array.isArray(highlight.thumbnailPrompts)
        ? highlight.thumbnailPrompts.map((p: any) => String(p).trim()).filter(Boolean)
        : []
    }))
    .filter((highlight: HighlightSegment) => highlight.end > highlight.start)
    .sort((a: HighlightSegment, b: HighlightSegment) => a.start - b.start)
}
