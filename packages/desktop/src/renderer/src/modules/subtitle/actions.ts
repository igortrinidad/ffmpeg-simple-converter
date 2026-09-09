import type { FileKind, OperationId } from '@shared/types'

/**
 * What the Legendas module can do with a file. Each one maps to a different
 * operation per file kind — the module asks for the action first, then lets
 * the dropzone decide whether it's a video or an audio.
 */
export type SubtitleAction = 'apply' | 'srt' | 'text'

const OPERATION_BY_ACTION: Record<SubtitleAction, Record<FileKind, OperationId | null>> = {
  // Burning/muxing a subtitle only makes sense on a video.
  apply: { video: 'video-apply-subtitles', audio: null },
  srt: { video: 'video-subtitles', audio: 'audio-subtitles' },
  text: { video: 'video-subtitles-text', audio: 'audio-subtitles-text' }
}

export function operationFor(action: SubtitleAction, kind: FileKind): OperationId | null {
  return OPERATION_BY_ACTION[action][kind]
}

/** The reverse lookup, so History's "Tentar novamente" can reopen this module on the right action. */
export function actionFor(operation: OperationId): { action: SubtitleAction; kind: FileKind } | null {
  for (const action of Object.keys(OPERATION_BY_ACTION) as SubtitleAction[]) {
    for (const kind of ['video', 'audio'] as FileKind[]) {
      if (OPERATION_BY_ACTION[action][kind] === operation) return { action, kind }
    }
  }
  return null
}
