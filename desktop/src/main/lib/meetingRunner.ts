import fs from 'fs'
import path from 'path'
import { createAIProvider, getStoredConfig, transcribeAudioFile } from 'mediacript'
import type { AIProviderName } from 'mediacript'
import { resolveHighlightApiKey, buildHighlightFallbackOptions } from './aiOptions'
import { captureConsole, type ConsoleLogLine } from './consoleCapture'
import { buildMediaUrl } from './mediaProtocol'
import { toTranscriptionAudio, hasRecordedAudio } from './meetingAudio'
import { closeStreams, loadMeeting, saveMeeting, toSummary, type PersistedMeeting } from './meetingStore'
import { TRACK_LABELS, buildTranscriptText, formatTimestamp, mergeTrackSegments } from './meetingTranscript'
import type { MeetingDetail, MeetingProgressEvent, MeetingSegment, MeetingTrack } from '../../shared/types'

export interface MeetingRunnerCallbacks {
  onLog?: (line: ConsoleLogLine) => void
  onProgress?: (event: Omit<MeetingProgressEvent, 'meetingId'>) => void
}

// --- AI ---------------------------------------------------------------------

interface AICandidate {
  provider: AIProviderName
  model: string
  apiKey: string
}

/**
 * The primary provider/model plus the user's configured fallbacks. A meeting
 * transcript can't be reproduced (you can't re-run the meeting), so a single
 * provider outage should never be what loses the minutes.
 */
function buildCandidates(meeting: Pick<PersistedMeeting, 'provider' | 'model'>): AICandidate[] {
  const config = getStoredConfig()
  const candidates: AICandidate[] = []

  try {
    candidates.push({
      provider: meeting.provider,
      model: meeting.model,
      apiKey: resolveHighlightApiKey(meeting.provider, config)
    })
  } catch {
    // Primary provider has no API key configured — the fallbacks below may still work.
  }

  for (const fallback of buildHighlightFallbackOptions(config, meeting)) {
    candidates.push({
      provider: fallback.provider as AIProviderName,
      model: fallback.model,
      apiKey: fallback.apiKey
    })
  }

  if (!candidates.length) {
    throw new Error(
      `Nenhuma API key configurada para "${meeting.provider}" (nem para os modelos de fallback). Configure em Settings.`
    )
  }

  return candidates
}

async function runAI(
  meeting: PersistedMeeting,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxTokens: number
): Promise<string> {
  const candidates = buildCandidates(meeting)
  let lastError: unknown

  for (const candidate of candidates) {
    try {
      const provider = createAIProvider(candidate.provider, {
        apiKey: candidate.apiKey,
        model: candidate.model,
        temperature: 0.3,
        maxTokens,
        // A full meeting transcript is a big prompt — more room than the library default.
        timeout: 300000
      })
      const reply = await provider.run(messages)
      if (!reply?.trim()) throw new Error('Resposta vazia do modelo')
      return reply.trim()
    } catch (error) {
      lastError = error
      console.warn(
        `⚠️ Falha com ${candidate.provider}/${candidate.model}: ${(error as Error)?.message}. Tentando próximo modelo...`
      )
    }
  }

  throw new Error(`Nenhum modelo configurado conseguiu gerar o texto: ${(lastError as Error)?.message}`)
}

function buildMinutesSystemPrompt(meeting: PersistedMeeting): string {
  return [
    'Você é um secretário executivo experiente. A partir da transcrição de uma reunião, você escreve a ata/pauta final que será compartilhada com os participantes.',
    'A transcrição vem com marcação de tempo e de falante, no formato "[hh:mm:ss] Falante: texto".',
    `"${TRACK_LABELS.mic}" é quem gravou a reunião (captado pelo microfone) e "${TRACK_LABELS.system}" são as outras pessoas (captadas pelo áudio do sistema).`,
    'A transcrição é automática: pode conter erros de grafia, nomes trocados e frases cortadas. Interprete o sentido geral e não repita trechos obviamente truncados.',
    '',
    ...(meeting.objective?.trim()
      ? [
          `Objetivo definido pelo usuário para esta ata (via agente): ${meeting.objective.trim()}`,
          'Priorize esse objetivo ao decidir o que destacar.',
          ''
        ]
      : []),
    'Responda SEMPRE em português do Brasil, em Markdown, seguindo exatamente esta estrutura:',
    '',
    `# ${meeting.title}`,
    '## Resumo executivo',
    '(3 a 6 linhas com o essencial da reunião)',
    '## Participantes identificados',
    '(nomes que aparecerem na transcrição; se não der para identificar, escreva "Não identificados na gravação")',
    '## Pauta discutida',
    '(bullets na ordem em que os tópicos foram tratados, com o horário de referência entre parênteses)',
    '## Decisões',
    '(bullets com o que ficou decidido; se nada foi decidido, escreva "Nenhuma decisão registrada")',
    '## Ações e responsáveis',
    '(tabela Markdown com as colunas: Ação | Responsável | Prazo. Use "A definir" quando a transcrição não deixar claro)',
    '## Pontos em aberto e riscos',
    '(bullets)',
    '## Pauta sugerida para a próxima reunião',
    '(bullets)',
    '',
    'Regras:',
    '- Baseie-se exclusivamente na transcrição — nunca invente decisões, nomes, números ou prazos.',
    '- Quando algo for dito de forma vaga, registre como está e marque com "(a confirmar)".',
    '- Não escreva nada fora do Markdown pedido (sem preâmbulo, sem "aqui está a ata").'
  ].join('\n')
}

async function generateMinutes(meeting: PersistedMeeting, extraInstructions?: string): Promise<string> {
  const transcript = meeting.transcriptText ?? buildTranscriptText(meeting.segments)

  const userContent = [
    `Duração da reunião: ${formatTimestamp(meeting.durationSeconds)}`,
    `Data: ${new Date(meeting.createdAt).toLocaleString('pt-BR')}`,
    ...(extraInstructions?.trim() ? ['', `Instrução adicional para esta versão: ${extraInstructions.trim()}`] : []),
    '',
    'Transcrição:',
    transcript
  ].join('\n')

  return runAI(
    meeting,
    [
      { role: 'system', content: buildMinutesSystemPrompt(meeting) },
      { role: 'user', content: userContent }
    ],
    8000
  )
}

// --- Pipeline ---------------------------------------------------------------

async function transcribeTrack(
  meeting: PersistedMeeting,
  track: MeetingTrack,
  callbacks: MeetingRunnerCallbacks
): Promise<MeetingSegment[]> {
  const rawPath = meeting.rawFiles[track]
  if (!hasRecordedAudio(rawPath)) return []

  callbacks.onProgress?.({ step: `Convertendo áudio (${TRACK_LABELS[track]})`, status: 'running' })
  const mp3Path = await toTranscriptionAudio(rawPath, path.join(meeting.folderPath, `${track}.mp3`), (line) =>
    callbacks.onLog?.({ level: 'progress', text: line })
  )
  meeting.audioFiles[track] = mp3Path
  saveMeeting(meeting)
  callbacks.onProgress?.({ step: `Convertendo áudio (${TRACK_LABELS[track]})`, status: 'completed' })

  callbacks.onProgress?.({ step: `Transcrevendo (${TRACK_LABELS[track]})`, status: 'running' })
  const result = await transcribeAudioFile(mp3Path)
  if (!result) {
    throw new Error(
      `Não foi possível transcrever a faixa "${TRACK_LABELS[track]}". Verifique as API keys do Groq/OpenAI em Settings.`
    )
  }
  callbacks.onProgress?.({ step: `Transcrevendo (${TRACK_LABELS[track]})`, status: 'completed' })

  return (result.segments ?? []).map((segment) => ({
    track,
    start: segment.start,
    end: segment.end,
    text: segment.text
  }))
}

/**
 * Turns a finished recording into a transcript plus minutes. Each track is
 * converted and transcribed on its own — that separation is what produces the
 * speaker labels — then merged chronologically before the AI writes the minutes.
 */
export async function processMeeting(
  meetingId: string,
  callbacks: MeetingRunnerCallbacks = {}
): Promise<MeetingDetail> {
  await closeStreams(meetingId)

  let meeting = loadMeeting(meetingId)
  meeting.status = 'processing'
  meeting.error = undefined
  saveMeeting(meeting)

  const stopCapture = callbacks.onLog ? captureConsole(callbacks.onLog) : undefined

  try {
    if (!hasRecordedAudio(meeting.rawFiles.mic) && !hasRecordedAudio(meeting.rawFiles.system)) {
      throw new Error('Nenhum áudio foi gravado nesta reunião.')
    }

    const micSegments = await transcribeTrack(meeting, 'mic', callbacks)
    const systemSegments = await transcribeTrack(meeting, 'system', callbacks)

    meeting = loadMeeting(meetingId)
    meeting.segments = mergeTrackSegments(micSegments, systemSegments)
    meeting.transcriptText = buildTranscriptText(meeting.segments)

    if (!meeting.transcriptText.trim()) {
      throw new Error('A transcrição saiu vazia — a gravação pode não ter capturado áudio audível.')
    }

    const transcriptFilePath = path.join(meeting.folderPath, 'transcricao.md')
    fs.writeFileSync(transcriptFilePath, `# Transcrição — ${meeting.title}\n\n${meeting.transcriptText}\n`, 'utf-8')
    meeting.transcriptFilePath = transcriptFilePath
    saveMeeting(meeting)

    callbacks.onProgress?.({ step: 'Gerando a ata com IA', status: 'running' })
    meeting.minutes = await generateMinutes(meeting)
    const minutesFilePath = path.join(meeting.folderPath, 'ata.md')
    fs.writeFileSync(minutesFilePath, `${meeting.minutes}\n`, 'utf-8')
    meeting.minutesFilePath = minutesFilePath
    callbacks.onProgress?.({ step: 'Gerando a ata com IA', status: 'completed' })

    meeting.status = 'ready'
    saveMeeting(meeting)

    return buildDetail(meeting)
  } catch (error) {
    const failed = loadMeeting(meetingId)
    failed.status = 'failed'
    failed.error = (error as Error)?.message || 'Falha ao processar a reunião'
    saveMeeting(failed)
    callbacks.onProgress?.({ step: 'Processamento', status: 'failed', detail: failed.error })
    throw error
  } finally {
    stopCapture?.()
  }
}

/** Rewrites the minutes from the transcript already on disk — no re-transcription, so iterating is cheap. */
export async function regenerateMinutes(meetingId: string, instructions?: string): Promise<MeetingDetail> {
  const meeting = loadMeeting(meetingId)

  if (!meeting.segments.length) {
    throw new Error('Esta reunião ainda não tem transcrição — processe a gravação primeiro.')
  }

  meeting.minutes = await generateMinutes(meeting, instructions)
  const minutesFilePath = meeting.minutesFilePath ?? path.join(meeting.folderPath, 'ata.md')
  fs.writeFileSync(minutesFilePath, `${meeting.minutes}\n`, 'utf-8')
  meeting.minutesFilePath = minutesFilePath
  meeting.status = 'ready'
  saveMeeting(meeting)

  return buildDetail(meeting)
}

/** Free-form Q&A over the meeting ("o que ficou combinado sobre o orçamento?"), grounded in the transcript. */
export async function askAboutMeeting(meetingId: string, message: string): Promise<{ reply: string }> {
  const meeting = loadMeeting(meetingId)

  if (!meeting.segments.length) {
    throw new Error('Esta reunião ainda não tem transcrição — processe a gravação primeiro.')
  }

  const systemPrompt = [
    'Você é um assistente que responde perguntas sobre uma reunião já transcrita, em português do Brasil.',
    'Responda apenas com base na transcrição e na ata fornecidas. Se a informação não estiver lá, diga claramente que o assunto não foi tratado na reunião.',
    'Sempre que possível, cite o horário ([hh:mm:ss]) do trecho em que a informação aparece.',
    '',
    'Transcrição:',
    meeting.transcriptText ?? buildTranscriptText(meeting.segments),
    ...(meeting.minutes ? ['', 'Ata gerada:', meeting.minutes] : [])
  ].join('\n')

  const reply = await runAI(
    meeting,
    [
      { role: 'system', content: systemPrompt },
      ...meeting.history.map((entry) => ({ role: entry.role, content: entry.content })),
      { role: 'user', content: message }
    ],
    2000
  )

  meeting.history.push({ role: 'user', content: message }, { role: 'assistant', content: reply })
  saveMeeting(meeting)

  return { reply }
}

export function buildDetail(meeting: PersistedMeeting): MeetingDetail {
  return {
    ...toSummary(meeting),
    provider: meeting.provider,
    model: meeting.model,
    agentId: meeting.agentId,
    objective: meeting.objective,
    segments: meeting.segments,
    minutes: meeting.minutes,
    minutesFilePath: meeting.minutesFilePath,
    transcriptFilePath: meeting.transcriptFilePath,
    history: meeting.history,
    audio: {
      mic: meeting.audioFiles.mic ? buildMediaUrl(meeting.audioFiles.mic) : undefined,
      system: meeting.audioFiles.system ? buildMediaUrl(meeting.audioFiles.system) : undefined
    },
    folderPath: meeting.folderPath
  }
}
