import { createAIProvider } from '../ai/index.js'
import type { AIMessage } from '../ai/types.js'
import type { HighlightSegment, TranscriptSegment } from '../types/index.js'
import type { HighlightExtractionOptions } from './index.js'
import { buildTimelineText, normalizeHighlights } from './shared.js'

export interface HighlightChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface HighlightChatTurnResult {
  reply: string
  highlights: HighlightSegment[]
}

function buildChatSystemPrompt(timelineText: string, totalDuration: number): string {
  return [
    'Você é um editor de vídeo especialista, conversando com o usuário para juntos escolherem os melhores momentos de uma gravação para virarem cortes/clipes.',
    'Você recebe uma timeline com trechos transcritos, cada linha no formato "[inicioS - fimS] texto", onde os tempos estão em segundos a partir do início do vídeo.',
    `Duração total do vídeo: ${totalDuration.toFixed(2)}s`,
    'Timeline transcrita:',
    timelineText,
    '',
    'A cada mensagem do usuário, você recebe também o estado atual da lista de destaques escolhidos (pode estar vazia) e deve responder atualizando essa lista de acordo com o pedido.',
    'Responda APENAS com um JSON no formato:',
    '{ "reply": string, "highlights": [{ "start": number, "end": number, "title": string, "reason": string, "thumbnailPrompts": string[] }] }',
    'Regras:',
    '- "highlights" deve ser SEMPRE a lista completa e atualizada de destaques (não um diff) — inclua também os que não mudaram nesta rodada.',
    '- Se o pedido do usuário não exigir mudança na lista (ex.: uma pergunta, ou um comentário), devolva "highlights" exatamente igual ao estado atual recebido.',
    '- "start" e "end" devem ser números em segundos, coerentes com os tempos fornecidos na timeline (não invente tempos fora do intervalo transcrito).',
    '- "end" deve ser maior que "start".',
    '- Prefira agrupar trechos consecutivos quando fizer sentido para o corte ficar completo e compreensível.',
    '- Ordene os destaques cronologicamente por "start".',
    '- "title" deve ser um título curto e chamativo para o corte.',
    '- "reason" deve explicar em 1 frase por que esse trecho foi escolhido.',
    '- "thumbnailPrompts" deve conter exatamente 3 ideias de prompt (em inglês, prontos para colar em ferramentas de geração de imagem como Midjourney, DALL-E ou similares), para uma thumbnail chamativa e de alta conversão para esse corte. Cada um dos 3 prompts é uma única string autocontida e deve:',
    '  - Descrever a cena com riqueza de detalhes visuais (assunto, expressão/emoção, enquadramento, cenário, iluminação, paleta de cores), baseando-se no conteúdo real do trecho — nunca genérico.',
    '  - Pensar a composição como thumbnail: close-up expressivo no rosto/reação quando fizer sentido, alto contraste, cores vibrantes, e espaço negativo reservado para o texto.',
    '  - Incluir termos de qualidade/estilo que melhoram o resultado da IA de imagem (ex.: "hyper-detailed", "dramatic lighting", "vibrant high-contrast colors", "professional photography", "8k", "sharp focus").',
    '  - Indicar o texto curto (2 a 5 palavras, baseado no "title" do corte) que deve aparecer sobreposto na imagem, onde posicioná-lo (ex.: canto superior, faixa inferior) e uma tipografia bold/impactante com cor que contraste com o fundo.',
    '  - Especificar a proporção de imagem (aspect ratio) mais adequada ao uso (ex.: "16:9" para thumbnail de YouTube, "9:16" para Shorts/Reels/Stories, "1:1" para feed).',
    '  - Ser autocontido, sem depender de contexto externo — a pessoa só copia e cola na ferramenta de imagem.',
    '- "reply" deve ser uma mensagem curta e amigável, em português, explicando o que você mudou na lista (ou tirando a dúvida do usuário, se for uma pergunta).',
    '- Nunca inclua markdown, comentários ou texto fora do JSON.'
  ].join('\n')
}

function buildTurnMessage(currentHighlights: HighlightSegment[], userMessage: string): string {
  return [
    `Estado atual dos destaques (JSON): ${JSON.stringify(currentHighlights)}`,
    '',
    `Pedido do usuário: ${userMessage}`
  ].join('\n')
}

async function runChatTurn(
  segments: TranscriptSegment[],
  history: HighlightChatMessage[],
  userMessage: string,
  currentHighlights: HighlightSegment[],
  options: HighlightExtractionOptions
): Promise<HighlightChatTurnResult> {
  const provider = createAIProvider(options.provider, {
    apiKey: options.apiKey,
    model: options.model,
    temperature: options.temperature ?? 0.2,
    // Same rationale as the one-shot extractor: thumbnail prompts make each
    // highlight verbose, and the full list is echoed back every turn.
    maxTokens: options.maxTokens ?? 24576,
    maxRetries: options.maxRetries,
    thinkingBudget: 0
  })

  const timelineText = buildTimelineText(segments)
  const totalDuration = segments[segments.length - 1].end

  const messages: AIMessage[] = [
    { role: 'system', content: buildChatSystemPrompt(timelineText, totalDuration) },
    ...history,
    { role: 'user', content: buildTurnMessage(currentHighlights, userMessage) }
  ]

  const raw = await provider.runJSON<any>(messages)

  const reply = typeof raw?.reply === 'string' ? raw.reply.trim() : ''
  const list = Array.isArray(raw?.highlights) ? raw.highlights : null

  if (!reply || !list) {
    throw new Error(`Resposta da IA não está no formato esperado (reply/highlights): ${JSON.stringify(raw).slice(0, 500)}`)
  }

  return {
    reply,
    highlights: normalizeHighlights(list, totalDuration)
  }
}

/**
 * Advances an ongoing highlight-selection conversation by one turn: sends the
 * transcript timeline, the conversation so far, the current highlight
 * selection and the user's latest message to the AI, and gets back both a
 * chat reply and the updated highlight list.
 *
 * Mirrors `extractHighlightsFromTranscript`'s fallback behavior: if `options`
 * fails even after its own retries, each of `fallbackOptions` is tried next,
 * in order, until one succeeds or the list is exhausted.
 */
export async function continueHighlightChat(
  segments: TranscriptSegment[],
  history: HighlightChatMessage[],
  userMessage: string,
  currentHighlights: HighlightSegment[],
  options: HighlightExtractionOptions,
  fallbackOptions: HighlightExtractionOptions[] = []
): Promise<HighlightChatTurnResult> {
  if (!segments.length) {
    throw new Error('Nenhum segmento de transcrição disponível para analisar')
  }

  const attempts = [options, ...fallbackOptions]
  let lastError: Error | undefined

  for (let i = 0; i < attempts.length; i++) {
    const attemptOptions = attempts[i]
    try {
      if (i > 0) {
        console.log(`\n↪️ Tentando fallback ${i}/${fallbackOptions.length}: ${attemptOptions.provider} (${attemptOptions.model})...`)
      }
      return await runChatTurn(segments, history, userMessage, currentHighlights, attemptOptions)
    } catch (error: any) {
      lastError = error
      console.warn(`⚠️ Falha ao continuar a conversa de destaques com ${attemptOptions.provider} (${attemptOptions.model}): ${error.message}`)
    }
  }

  throw new Error(`Todos os provedores de IA configurados falharam. Último erro: ${lastError?.message}`)
}
