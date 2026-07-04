import { createAIProvider } from '../ai/index.js'
import type { AIProviderName } from '../ai/types.js'
import type { HighlightSegment, TranscriptSegment } from '../types/index.js'

export interface HighlightExtractionOptions {
  provider: AIProviderName
  model: string
  apiKey: string
  temperature?: number
  maxTokens?: number
}

function buildTimelineText(segments: TranscriptSegment[]): string {
  return segments
    .map((segment) => `[${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s] ${segment.text.trim()}`)
    .join('\n')
}

function buildSystemPrompt(): string {
  return [
    'Você é um editor de vídeo especialista em encontrar os melhores momentos de uma gravação.',
    'Você recebe uma timeline com trechos transcritos, cada linha no formato "[inicioS - fimS] texto", onde os tempos estão em segundos a partir do início do vídeo.',
    'Sua tarefa é escolher os melhores trechos para virarem cortes/clipes, de acordo com o pedido do usuário.',
    'Responda APENAS com um JSON array, sem markdown, sem comentários, no formato:',
    '[{ "start": number, "end": number, "title": string, "reason": string, "thumbnailPrompts": string[] }]',
    'Regras:',
    '- "start" e "end" devem ser números em segundos, coerentes com os tempos fornecidos na timeline (não invente tempos fora do intervalo transcrito).',
    '- "end" deve ser maior que "start".',
    '- Prefira agrupar trechos consecutivos quando fizer sentido para o corte ficar completo e compreensível.',
    '- Ordene os resultados cronologicamente por "start".',
    '- "title" deve ser um título curto e chamativo para o corte.',
    '- "reason" deve explicar em 1 frase por que esse trecho foi escolhido.',
    '- "thumbnailPrompts" deve conter exatamente 3 ideias de prompt (em inglês, para ferramentas de geração de imagem como Midjourney/DALL-E) descrevendo uma thumbnail chamativa para esse corte, com base no conteúdo do trecho.',
    '- Se nenhum trecho relevante for encontrado, responda com um array vazio: []'
  ].join('\n')
}

function isValidHighlight(value: any): value is HighlightSegment {
  return !!value
    && typeof value.start === 'number'
    && typeof value.end === 'number'
    && typeof value.title === 'string'
    && value.end > value.start
}

/**
 * Uses an LLM (Anthropic/Gemini/OpenRouter) to pick the best highlight
 * segments from a transcript timeline, based on a free-text prompt.
 */
export async function extractHighlightsFromTranscript(
  segments: TranscriptSegment[],
  prompt: string,
  options: HighlightExtractionOptions
): Promise<HighlightSegment[]> {
  if (!segments.length) {
    throw new Error('Nenhum segmento de transcrição disponível para analisar')
  }

  const provider = createAIProvider(options.provider, {
    apiKey: options.apiKey,
    model: options.model,
    temperature: options.temperature ?? 0.2,
    maxTokens: options.maxTokens ?? 4096
  })

  const timelineText = buildTimelineText(segments)
  const totalDuration = segments[segments.length - 1].end

  console.log(`\n🤖 Analisando timeline com ${options.provider} (${options.model})...`)

  const raw = await provider.runJSON<any>([
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: [
        `Duração total do vídeo: ${totalDuration.toFixed(2)}s`,
        `Pedido do usuário: ${prompt}`,
        '',
        'Timeline transcrita:',
        timelineText
      ].join('\n')
    }
  ])

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.result)
      ? raw.result
      : Array.isArray(raw?.highlights)
        ? raw.highlights
        : null

  if (!list) {
    throw new Error(`Resposta da IA não é uma lista de highlights válida: ${JSON.stringify(raw).slice(0, 500)}`)
  }

  const highlights = list
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

  console.log(`✓ ${highlights.length} destaque(s) selecionado(s) pela IA`)

  return highlights
}

/**
 * Expands each highlight by `marginSeconds` on both sides — cutting exactly at
 * the AI-picked boundaries risks losing context (a word, a reaction, a setup)
 * right before/after the moment. Clamped to `[0, maxDurationSeconds]` when the
 * video's total duration is known, so the margin never overshoots past the
 * start or end of the source video.
 */
export function applyHighlightMargin(
  highlights: HighlightSegment[],
  marginSeconds: number,
  maxDurationSeconds?: number
): HighlightSegment[] {
  if (!marginSeconds) return highlights

  return highlights.map((highlight) => {
    const start = Math.max(0, highlight.start - marginSeconds)
    const end = typeof maxDurationSeconds === 'number'
      ? Math.min(maxDurationSeconds, highlight.end + marginSeconds)
      : highlight.end + marginSeconds

    return { ...highlight, start, end }
  })
}
