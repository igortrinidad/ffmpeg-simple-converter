export type ExportFormatId =
  | '16-9'
  | '9-16'
  | '1-1'
  | 'instagram-reels'
  | 'meta-ads'
  | 'tiktok'
  | 'youtube'
  | 'youtube-shorts'

export type QualityPresetId = 'draft' | 'standard' | 'high' | 'original'

export type FramingMode = 'crop' | 'blur-pad'

export interface ExportFormatDefinition {
  id: ExportFormatId
  label: string
  width: number
  height: number
}

/**
 * Several ids intentionally share the same pixel dimensions (e.g. TikTok/YouTube
 * Shorts/Instagram Reels/9-16 are all 1080x1920) — they're kept as distinct,
 * separately selectable entries because the user picks export targets by
 * platform, not just by aspect ratio, and each produces its own named output file.
 */
export const EXPORT_FORMATS: ExportFormatDefinition[] = [
  { id: '16-9', label: '16:9 (Paisagem)', width: 1920, height: 1080 },
  { id: '9-16', label: '9:16 (Retrato)', width: 1080, height: 1920 },
  { id: '1-1', label: '1:1 (Quadrado)', width: 1080, height: 1080 },
  { id: 'instagram-reels', label: 'Instagram Reels', width: 1080, height: 1920 },
  { id: 'meta-ads', label: 'Meta Ads', width: 1080, height: 1080 },
  { id: 'tiktok', label: 'TikTok', width: 1080, height: 1920 },
  { id: 'youtube', label: 'YouTube', width: 1920, height: 1080 },
  { id: 'youtube-shorts', label: 'YouTube Shorts', width: 1080, height: 1920 }
]

export interface QualityPresetDefinition {
  id: QualityPresetId
  label: string
  preset: string
  crf: number
}

/**
 * `original`'s preset/crf are only used when reframing forces a re-encode
 * (source and target aspect ratios differ) — a near-lossless fallback. When
 * the aspect ratio already matches, `exportClipToFormat` remuxes with
 * `-c copy` instead, ignoring these values entirely.
 */
export const QUALITY_PRESETS: QualityPresetDefinition[] = [
  { id: 'draft', label: 'Rascunho (rápido)', preset: 'veryfast', crf: 30 },
  { id: 'standard', label: 'Padrão', preset: 'medium', crf: 23 },
  { id: 'high', label: 'Alta', preset: 'slow', crf: 18 },
  { id: 'original', label: 'Mesma qualidade do input', preset: 'slow', crf: 14 }
]

export function getExportFormat(id: ExportFormatId): ExportFormatDefinition {
  const format = EXPORT_FORMATS.find((f) => f.id === id)
  if (!format) throw new Error(`Formato de export desconhecido: ${id}`)
  return format
}

export function getQualityPreset(id: QualityPresetId): QualityPresetDefinition {
  const preset = QUALITY_PRESETS.find((q) => q.id === id)
  if (!preset) throw new Error(`Preset de qualidade desconhecido: ${id}`)
  return preset
}
