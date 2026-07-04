import type { FileKind, OperationId } from './types'

export interface OperationDefinition {
  id: OperationId
  label: string
  description: string
  requiresType: FileKind
  steps: string[]
  needsConversionOptions: boolean
  needsHighlightOptions: boolean
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
    label: 'Gerar legendas (.srt) com timeline',
    description: 'Transcreve o vídeo e gera um arquivo de legenda com a linha do tempo completa.',
    requiresType: 'video',
    steps: ['Extrair áudio', 'Gerar legendas'],
    needsConversionOptions: false,
    needsHighlightOptions: false
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
    label: 'Gerar legendas (.srt) com timeline',
    description: 'Transcreve o áudio e gera um arquivo de legenda com a linha do tempo completa.',
    requiresType: 'audio',
    steps: ['Gerar legendas'],
    needsConversionOptions: false,
    needsHighlightOptions: false
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
