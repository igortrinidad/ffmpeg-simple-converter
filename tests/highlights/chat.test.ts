import { describe, test, expect, jest, beforeAll, beforeEach } from '@jest/globals'
import type { TranscriptSegment, HighlightSegment } from '../../src/types/index.js'
import type { HighlightExtractionOptions } from '../../src/highlights/index.js'
import type { HighlightChatMessage, continueHighlightChat as ContinueHighlightChatFn } from '../../src/highlights/chat.js'

const runJSON = jest.fn<(messages: Array<{ role: string; content: string }>) => Promise<any>>()
const createAIProvider = jest.fn<(provider: string, options: Record<string, unknown>) => { runJSON: typeof runJSON }>(
  () => ({ runJSON })
)

jest.unstable_mockModule('../../src/ai/index.js', () => ({ createAIProvider }))

let continueHighlightChat: typeof ContinueHighlightChatFn

beforeAll(async () => {
  ;({ continueHighlightChat } = await import('../../src/highlights/chat.js'))
})

const segments: TranscriptSegment[] = [
  { start: 0, end: 5, text: 'Introdução do vídeo' },
  { start: 5, end: 12, text: 'Parte engraçada do vídeo' },
  { start: 12, end: 20, text: 'Encerramento' }
]

const options: HighlightExtractionOptions = { provider: 'anthropic', model: 'test-model', apiKey: 'test-key' }

const validHighlight: HighlightSegment = {
  start: 5,
  end: 12,
  title: 'Momento engraçado',
  reason: 'É engraçado',
  thumbnailPrompts: ['p1', 'p2', 'p3']
}

describe('continueHighlightChat', () => {
  beforeEach(() => {
    runJSON.mockReset()
    createAIProvider.mockClear()
  })

  test('parses the reply and normalized highlights from the AI response', async () => {
    runJSON.mockResolvedValueOnce({ reply: 'Adicionei o momento engraçado.', highlights: [validHighlight] })

    const result = await continueHighlightChat(segments, [], 'quero os melhores momentos de humor', [], options)

    expect(result.reply).toBe('Adicionei o momento engraçado.')
    expect(result.highlights).toEqual([validHighlight])
  })

  test('filters out malformed highlight entries', async () => {
    runJSON.mockResolvedValueOnce({
      reply: 'Aqui está.',
      highlights: [validHighlight, { start: 15, end: 10, title: 'Inválido (end < start)' }, { start: 1 }]
    })

    const result = await continueHighlightChat(segments, [], 'algum pedido', [], options)

    expect(result.highlights).toEqual([validHighlight])
  })

  test('returns the highlights unchanged when the model reports no change', async () => {
    const currentHighlights = [validHighlight]
    runJSON.mockResolvedValueOnce({ reply: 'Não encontrei mais nada relevante.', highlights: currentHighlights })

    const result = await continueHighlightChat(segments, [], 'tem mais algum momento bom?', currentHighlights, options)

    expect(result.highlights).toEqual(currentHighlights)
  })

  test('carries the prior conversation turns into the request sent to the provider', async () => {
    runJSON.mockResolvedValueOnce({ reply: 'Ok.', highlights: [] })
    const history: HighlightChatMessage[] = [
      { role: 'user', content: 'quero os melhores momentos de humor' },
      { role: 'assistant', content: 'Encontrei um momento engraçado.' }
    ]

    await continueHighlightChat(segments, history, 'remova esse', [validHighlight], options)

    const messages = runJSON.mock.calls[0][0]
    expect(messages[0].role).toBe('system')
    expect(messages.slice(1, 3)).toEqual(history)
    expect(messages[3].content).toContain('remova esse')
    expect(messages[3].content).toContain(JSON.stringify([validHighlight]))
  })

  test('falls back to the next configured provider when the primary fails', async () => {
    runJSON.mockRejectedValueOnce(new Error('provider down')).mockResolvedValueOnce({ reply: 'Ok.', highlights: [validHighlight] })
    const fallback: HighlightExtractionOptions = { provider: 'openai', model: 'fallback-model', apiKey: 'fallback-key' }

    const result = await continueHighlightChat(segments, [], 'algum pedido', [], options, [fallback])

    expect(result.highlights).toEqual([validHighlight])
    expect(createAIProvider).toHaveBeenNthCalledWith(1, 'anthropic', expect.objectContaining({ model: 'test-model' }))
    expect(createAIProvider).toHaveBeenNthCalledWith(2, 'openai', expect.objectContaining({ model: 'fallback-model' }))
  })

  test('throws once every configured provider (primary + fallbacks) has failed', async () => {
    runJSON.mockRejectedValue(new Error('always down'))

    await expect(continueHighlightChat(segments, [], 'algum pedido', [], options)).rejects.toThrow(
      /Todos os provedores de IA configurados falharam/
    )
  })
})
