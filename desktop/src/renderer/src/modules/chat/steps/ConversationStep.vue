<script setup lang="ts">
import { computed, nextTick, onMounted, ref, reactive, watch } from 'vue'
import type { AIProviderName, ExportOptionsInput, HighlightSegment, TranscriptSegment } from '@shared/types'

interface StartParams {
  jobId: string
  provider: AIProviderName
  model: string
  agentId?: string
  objective?: string
}

const props = defineProps<{
  mode: 'start' | 'resume'
  startParams?: StartParams
  resumeSessionId?: string
}>()

const emit = defineEmits<{
  continue: [sessionId: string, marginSeconds: number]
  /** Fired once after a `resume` finishes loading, so the parent can seed the output-selection step from what this session already had configured. */
  resumed: [info: { agentId?: string; exportOptions?: ExportOptionsInput }]
}>()

interface ChatBubble {
  role: 'user' | 'assistant' | 'error'
  content: string
}

const sessionId = ref<string | null>(null)
const starting = ref(true)
const startError = ref<string | null>(null)
const messages = reactive<ChatBubble[]>([])
const highlights = ref<HighlightSegment[]>([])
const input = ref('')
const sending = ref(false)
const marginSeconds = ref(2)
const removingIndex = ref<number | null>(null)
const removeError = ref<string | null>(null)
const segments = ref<TranscriptSegment[]>([])
const rangeError = ref<string | null>(null)
const rangeErrorIndex = ref<number | null>(null)
const audioUrl = ref('')
const audioError = ref<string | null>(null)
const playingIndex = ref<number | null>(null)

const totalDuration = computed(() => (segments.value.length ? segments.value[segments.value.length - 1].end : 0))

const messagesEl = ref<HTMLElement | null>(null)
const audioEl = ref<HTMLAudioElement | null>(null)

watch(
  () => messages.length,
  async () => {
    await nextTick()
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
)

onMounted(async () => {
  try {
    if (props.mode === 'start' && props.startParams) {
      const result = await window.api.highlightChat.start({
        jobId: props.startParams.jobId,
        options: { provider: props.startParams.provider, model: props.startParams.model },
        agentId: props.startParams.agentId,
        objective: props.startParams.objective
      })
      sessionId.value = result.sessionId
      segments.value = result.segments
      audioUrl.value = result.audioUrl

      if (result.initialTurn) {
        messages.push({ role: 'assistant', content: result.initialTurn.reply })
        highlights.value = result.initialTurn.highlights
      } else {
        messages.push({
          role: 'assistant',
          content:
            'Pronto! Já tenho a transcrição do vídeo. Me diga que tipo de trecho você quer destacar (ex: "os melhores momentos de humor").'
        })
      }
    } else if (props.mode === 'resume' && props.resumeSessionId) {
      const result = await window.api.highlightChat.resume(props.resumeSessionId)
      sessionId.value = result.sessionId
      segments.value = result.segments
      audioUrl.value = result.audioUrl
      highlights.value = result.highlights
      for (const entry of result.history) {
        messages.push({ role: entry.role, content: entry.content })
      }
      if (!messages.length) {
        messages.push({ role: 'assistant', content: 'Sessão retomada — a conversa continua daqui.' })
      }
      emit('resumed', { agentId: result.agentId, exportOptions: result.exportOptions })
    }
  } catch (error: any) {
    startError.value = error?.message || String(error)
  } finally {
    starting.value = false
  }
})

function stopPlayback(): void {
  audioEl.value?.pause()
  playingIndex.value = null
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || !sessionId.value || sending.value) return

  stopPlayback()
  messages.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true

  try {
    const result = await window.api.highlightChat.sendMessage({ sessionId: sessionId.value, message: text })
    messages.push({ role: 'assistant', content: result.reply })
    highlights.value = result.highlights
  } catch (error: any) {
    messages.push({ role: 'error', content: error?.message || String(error) })
  } finally {
    sending.value = false
  }
}

async function removeHighlightAt(index: number): Promise<void> {
  if (!sessionId.value || removingIndex.value !== null) return

  stopPlayback()
  removingIndex.value = index
  removeError.value = null

  try {
    const result = await window.api.highlightChat.removeHighlight({ sessionId: sessionId.value, index })
    highlights.value = result.highlights
  } catch (error: any) {
    removeError.value = error?.message || String(error)
  } finally {
    removingIndex.value = null
  }
}

function textAtTime(t: number): string {
  if (!segments.value.length) return ''

  const containing = segments.value.find((s) => t >= s.start && t < s.end)
  const nearest =
    containing ??
    segments.value.reduce((closest, s) => (Math.abs(s.start - t) < Math.abs(closest.start - t) ? s : closest))

  const text = nearest.text.trim()
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

function playHighlight(index: number): void {
  const el = audioEl.value
  if (!el) return

  if (playingIndex.value === index) {
    stopPlayback()
    return
  }

  const highlight = highlights.value[index]
  el.currentTime = highlight.start
  playingIndex.value = index
  el.play().catch((error: any) => {
    audioError.value = error?.message || String(error)
    playingIndex.value = null
  })
}

function onTimeUpdate(): void {
  if (playingIndex.value === null) return
  const highlight = highlights.value[playingIndex.value]
  if (audioEl.value && highlight && audioEl.value.currentTime >= highlight.end) {
    stopPlayback()
  }
}

function onStartSliderInput(index: number, event: Event): void {
  if (playingIndex.value !== index || !audioEl.value) return
  audioEl.value.currentTime = Number((event.target as HTMLInputElement).value)
}

function onAudioError(): void {
  audioError.value = 'Não foi possível carregar o áudio para reprodução.'
}

async function commitHighlightRange(index: number): Promise<void> {
  if (!sessionId.value) return
  const target = highlights.value[index]

  try {
    const result = await window.api.highlightChat.updateHighlight({
      sessionId: sessionId.value,
      index,
      start: target.start,
      end: target.end
    })
    highlights.value = result.highlights
    rangeError.value = null
    rangeErrorIndex.value = null
  } catch (error: any) {
    rangeError.value = error?.message || String(error)
    rangeErrorIndex.value = index
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function onContinue(): void {
  if (!sessionId.value || !highlights.value.length) return
  emit('continue', sessionId.value, marginSeconds.value)
}
</script>

<template>
  <div class="chat-panel">
    <p v-if="starting" class="hint">Carregando a conversa…</p>
    <p v-else-if="startError" class="hint hint-warning">
      Não foi possível iniciar o chat: {{ startError }}
    </p>

    <template v-else>
      <audio
        ref="audioEl"
        :src="audioUrl"
        preload="metadata"
        style="display: none"
        @timeupdate="onTimeUpdate"
        @ended="playingIndex = null"
        @error="onAudioError"
      />

      <div ref="messagesEl" class="messages">
        <div v-for="(message, index) in messages" :key="index" class="bubble-row" :class="`role-${message.role}`">
          <div class="bubble">{{ message.content }}</div>
        </div>
        <div v-if="sending" class="bubble-row role-assistant">
          <div class="bubble bubble-pending">Pensando…</div>
        </div>
      </div>

      <form class="composer" @submit.prevent="send">
        <input
          v-model="input"
          type="text"
          placeholder='Ex: "quero os 3 melhores momentos de humor"'
          :disabled="sending"
        />
        <button class="btn btn-primary" type="submit" :disabled="sending || !input.trim()">Enviar</button>
      </form>

      <div v-if="highlights.length" class="highlights-panel">
        <h3>Destaques selecionados para processamento ({{ highlights.length }})</h3>
        <p v-if="audioError" class="hint hint-warning">{{ audioError }}</p>
        <ul class="highlights-list">
          <li v-for="(highlight, index) in highlights" :key="index" class="highlight-card">
            <div class="highlight-card-header">
              <button
                class="btn btn-ghost highlight-play"
                type="button"
                :title="playingIndex === index ? 'Parar' : 'Ouvir trecho'"
                :disabled="!audioUrl"
                @click="playHighlight(index)"
              >
                {{ playingIndex === index ? '⏸️' : '▶️' }}
              </button>
              <span class="highlight-title">{{ highlight.title }}</span>
              <button
                class="btn btn-ghost highlight-remove"
                type="button"
                title="Remover este destaque"
                :disabled="removingIndex !== null"
                @click="removeHighlightAt(index)"
              >
                {{ removingIndex === index ? '…' : '✕' }}
              </button>
            </div>
            <p v-if="highlight.reason" class="highlight-reason">{{ highlight.reason }}</p>

            <div class="range-row">
              <label>Início — {{ formatTime(highlight.start) }}</label>
              <input
                v-model.number="highlight.start"
                type="range"
                min="0"
                :max="Math.max(0, highlight.end - 0.5)"
                step="0.5"
                @input="onStartSliderInput(index, $event)"
                @change="commitHighlightRange(index)"
              />
              <p class="range-preview">"{{ textAtTime(highlight.start) }}"</p>
            </div>

            <div class="range-row">
              <label>Fim — {{ formatTime(highlight.end) }}</label>
              <input
                v-model.number="highlight.end"
                type="range"
                :min="highlight.start + 0.5"
                :max="totalDuration"
                step="0.5"
                @change="commitHighlightRange(index)"
              />
              <p class="range-preview">"{{ textAtTime(highlight.end) }}"</p>
            </div>

            <p v-if="rangeError && rangeErrorIndex === index" class="hint hint-warning">{{ rangeError }}</p>
          </li>
        </ul>
        <p v-if="removeError" class="hint hint-warning">{{ removeError }}</p>
      </div>
      <p v-else-if="messages.length > 1" class="hint">
        Nenhum destaque selecionado ainda — continue conversando para a IA escolher os melhores trechos.
      </p>

      <div class="continue-bar">
        <label for="chat-margin">Margem antes/depois (segundos)</label>
        <input id="chat-margin" v-model.number="marginSeconds" type="number" min="0" step="1" />
        <button class="btn btn-primary" type="button" :disabled="!highlights.length" @click="onContinue">
          Continuar →
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 360px;
  max-width: 640px;
  margin: 0 auto;
}

.messages {
  flex: 1;
  min-height: 200px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 2px;
}

.bubble-row {
  display: flex;
}

.bubble-row.role-user {
  justify-content: flex-end;
}

.bubble-row.role-assistant,
.bubble-row.role-error {
  justify-content: flex-start;
}

.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.role-user .bubble {
  background: var(--accent);
  color: var(--accent-contrast);
  border-bottom-right-radius: 2px;
}

.role-assistant .bubble {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text);
  border-bottom-left-radius: 2px;
}

.bubble-pending {
  color: var(--text-muted);
  font-style: italic;
}

.role-error .bubble {
  background: color-mix(in srgb, var(--danger) 12%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
  color: var(--danger);
}

.composer {
  display: flex;
  gap: 8px;
}

.composer input {
  flex: 1;
}

.highlights-panel {
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.highlights-panel h3 {
  font-size: 13px;
  margin: 0 0 8px;
}

.highlights-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.highlight-card {
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg);
  font-size: 12px;
}

.highlight-card-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.highlight-title {
  font-weight: 600;
  flex: 1;
}

.highlight-reason {
  color: var(--text-muted);
  margin: 2px 0 6px;
}

.highlight-remove {
  padding: 1px 8px;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.highlight-play {
  padding: 1px 6px;
  font-size: 12px;
  flex-shrink: 0;
}

.highlight-play:disabled {
  opacity: 0.4;
}

.range-row {
  margin-top: 4px;
}

.range-row label {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.range-row input[type='range'] {
  width: 100%;
}

.range-preview {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.highlight-remove:hover {
  color: var(--danger);
}

.continue-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  font-size: 13px;
}

.continue-bar label {
  color: var(--text-muted);
}

.continue-bar input[type='number'] {
  width: 64px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.hint-warning {
  color: var(--warning);
}
</style>
