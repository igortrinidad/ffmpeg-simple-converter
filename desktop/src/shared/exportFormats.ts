import type { ExportFormatId, QualityPresetId } from './types'

export interface ExportFormatOption {
  id: ExportFormatId
  label: string
}

export interface QualityPresetOption {
  id: QualityPresetId
  label: string
}

/**
 * Mirrors mediacript's `EXPORT_FORMATS`/`QUALITY_PRESETS` (src/utils/exportFormats.ts),
 * duplicated here (same pattern as fileKind.ts) so renderer components can render
 * the catalog without importing the `mediacript` package's runtime code —
 * that package's entrypoint pulls in Node-only modules (child_process, fs) that
 * can't be bundled into the browser-context renderer.
 */
export const EXPORT_FORMATS: ExportFormatOption[] = [
  { id: '16-9', label: '16:9 (Paisagem)' },
  { id: '9-16', label: '9:16 (Retrato)' },
  { id: '1-1', label: '1:1 (Quadrado)' },
  { id: 'instagram-reels', label: 'Instagram Reels' },
  { id: 'meta-ads', label: 'Meta Ads' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'youtube-shorts', label: 'YouTube Shorts' }
]

export const QUALITY_PRESETS: QualityPresetOption[] = [
  { id: 'draft', label: 'Rascunho (rápido)' },
  { id: 'standard', label: 'Padrão' },
  { id: 'high', label: 'Alta' },
  { id: 'original', label: 'Mesma qualidade do input' }
]
