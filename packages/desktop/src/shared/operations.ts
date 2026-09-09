import type { FileKind, OperationId } from './types'

export interface OperationDefinition {
  id: OperationId
  label: string
  description: string
  requiresType: FileKind
  steps: string[]
  needsConversionOptions: boolean
  needsHighlightOptions: boolean
  /**
   * True for operations that only transcribe the file and then hand off into
   * the highlight chat panel instead of finishing normally — the AI picks
   * highlights and cuts clips through the conversation, not through
   * `needsHighlightOptions`'s upfront prompt/margin form.
   */
  startsHighlightChat?: boolean
  /**
   * True for the operations the Legendas module owns — applying a subtitle to
   * a video and extracting one out of a file. They're offered there, behind its
   * own action picker, instead of in the Convert wizard's function list.
   */
  belongsToSubtitleModule?: boolean
  /** True for the operation that applies a generated subtitle to the video (hardsub/softsub) — needs the Subtitle module's mode picker. */
  needsSubtitleOptions?: boolean
}

export const OPERATIONS: OperationDefinition[] = [
  {
    id: 'video-full',
    label: 'Converter vídeo + Extrair áudio + Transcrever',
    description: 'Otimiza o vídeo, extrai o áudio e gera a transcrição em texto.',
    requiresType: 'video',
    steps: ['Converter vídeo', 'Extrair áudio', 'Transcrever áudio'],
    needsConversionOptions: true,
    needsHighlightOptions: false
  },
  {
    id: 'video-extract-transcribe',
    label: 'Extrair áudio do vídeo + Transcrever',
    description: 'Extrai o áudio do vídeo original (sem converter) e gera a transcrição em texto.',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Transcrever áudio'],
    needsConversionOptions: false,
    needsHighlightOptions: false
  },
  {
    id: 'video-convert',
    label: 'Converter vídeo (H.264/AAC)',
    description: 'Otimiza o vídeo para um formato mais leve e compatível.',
    requiresType: 'video',
    steps: ['Converter vídeo'],
    needsConversionOptions: true,
    needsHighlightOptions: false
  },
  {
    id: 'video-extract',
    label: 'Extrair áudio do vídeo',
    description: 'Extrai apenas o áudio do vídeo, em MP3.',
    requiresType: 'video',
    steps: ['Extrair áudio'],
    needsConversionOptions: false,
    needsHighlightOptions: false
  },
  {
    id: 'video-subtitles',
    label: 'Extrair legenda (.srt) com timeline',
    description: 'Transcreve o vídeo e gera um arquivo de legenda com a linha do tempo completa.',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Gerar legendas'],
    needsConversionOptions: false,
    needsHighlightOptions: false,
    belongsToSubtitleModule: true
  },
  {
    id: 'video-subtitles-text',
    label: 'Extrair legenda em texto (sem timeline)',
    description: 'Transcreve o vídeo e salva só o texto da legenda, sem os tempos — pronto para copiar e revisar.',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Extrair texto'],
    needsConversionOptions: false,
    needsHighlightOptions: false,
    belongsToSubtitleModule: true
  },
  {
    id: 'video-apply-subtitles',
    label: 'Aplicar legenda ao vídeo (hardsub/softsub)',
    description: 'Transcreve o vídeo e grava as legendas nele — embutidas no vídeo (hardsub) ou como faixa separada que pode ser ligada/desligada (softsub).',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Gerar legendas', 'Aplicar legendas'],
    needsConversionOptions: false,
    needsHighlightOptions: false,
    belongsToSubtitleModule: true,
    needsSubtitleOptions: true
  },
  {
    id: 'video-highlights',
    label: 'Gerar cortes com IA (highlights)',
    description: 'Transcreve o vídeo e pede para uma IA escolher os melhores momentos, cortando um clipe para cada um.',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Gerar legendas', 'Selecionar destaques com IA', 'Cortar clipes'],
    needsConversionOptions: false,
    needsHighlightOptions: true
  },
  {
    id: 'video-highlights-chat',
    label: 'Escolher melhores trechos (conversar com IA)',
    description: 'Transcreve o vídeo e abre um chat para você e a IA definirem juntos os melhores momentos, antes de cortar os clipes.',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Gerar legendas'],
    needsConversionOptions: false,
    needsHighlightOptions: false,
    startsHighlightChat: true
  },
  {
    id: 'audio-convert-transcribe',
    label: 'Converter áudio + Transcrever',
    description: 'Converte o áudio para MP3 e gera a transcrição em texto.',
    requiresType: 'audio',
    steps: ['Converter áudio', 'Transcrever áudio'],
    needsConversionOptions: false,
    needsHighlightOptions: false
  },
  {
    id: 'audio-transcribe',
    label: 'Transcrever áudio',
    description: 'Gera a transcrição em texto do áudio.',
    requiresType: 'audio',
    steps: ['Transcrever áudio'],
    needsConversionOptions: false,
    needsHighlightOptions: false
  },
  {
    id: 'audio-convert',
    label: 'Converter áudio (MP3)',
    description: 'Converte o áudio para um formato mais leve e compatível.',
    requiresType: 'audio',
    steps: ['Converter áudio'],
    needsConversionOptions: false,
    needsHighlightOptions: false
  },
  {
    id: 'audio-subtitles',
    label: 'Extrair legenda (.srt) com timeline',
    description: 'Transcreve o áudio e gera um arquivo de legenda com a linha do tempo completa.',
    requiresType: 'audio',
    steps: ['Gerar legendas'],
    needsConversionOptions: false,
    needsHighlightOptions: false,
    belongsToSubtitleModule: true
  },
  {
    id: 'audio-subtitles-text',
    label: 'Extrair legenda em texto (sem timeline)',
    description: 'Transcreve o áudio e salva só o texto da legenda, sem os tempos — pronto para copiar e revisar.',
    requiresType: 'audio',
    steps: ['Extrair texto'],
    needsConversionOptions: false,
    needsHighlightOptions: false,
    belongsToSubtitleModule: true
  }
]

export function getOperation(id: OperationId): OperationDefinition {
  const operation = OPERATIONS.find((o) => o.id === id)
  if (!operation) throw new Error(`Operação desconhecida: ${id}`)
  return operation
}

export function operationsForType(type: FileKind): OperationDefinition[] {
  return OPERATIONS.filter((o) => o.requiresType === type)
}

/** True when the Legendas module — not the Convert wizard — is the one that runs this operation. */
export function isSubtitleOperation(id: OperationId): boolean {
  return !!getOperation(id).belongsToSubtitleModule
}
