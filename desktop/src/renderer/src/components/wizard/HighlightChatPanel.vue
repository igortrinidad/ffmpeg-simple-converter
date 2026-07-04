<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { AIProviderName, HighlightChatLogLine, HighlightSegment, TranscriptSegment } from '@shared/types'

const props = defineProps<{
  jobId: string
  filePath: string
  aiOptions: { provider: AIProviderName; model: string }
}>()

const emit = defineEmits<{
  finish: [outputFiles: string[]]
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
const cutting = ref(false)
const cutError = ref<string | null>(null)
const marginSeconds = ref(2)
const removingIndex = ref<number | null>(null)
const removeError = ref<string | null>(null)
const segments = ref<TranscriptSegment[]>([])
const rangeError = ref<string | null>(null)
const rangeErrorIndex = ref<number | null>(null)
const audioUrl = ref('')
const audioError = ref<string | null>(null)
const playingIndex = ref<number | null>(null)
const cutLogs = reactive<HighlightChatLogLine[]>([])

const totalDuration = computed(() => (segments.value.length ? segments.value[segments.value.length - 1].end : 0))

const messagesEl = ref<HTMLElement | null>(null)
const audioEl = ref<HTMLAudioElement | null>(null)
const cutLogsEl = ref<HTMLElement | null>(null)

// Caps how many lines are kept so a long cut run doesn't grow the log panel
// (and the reactive array driving it) without bound — mirrors the wizard's job log.
const MAX_CUT_LOG_LINES = 300
let unsubscribeCutLogs: (() => void) | null = null

watch(
  () => cutLogs.length,
  async () => {
    await nextTick()
    if (cutLogsEl.value) cutLogsEl.value.scrollTop = cutLogsEl.value.scrollHeight
  }
)

watch(
  () => messages.length,
  async () => {
    await nextTick()
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
)

onMounted(async () => {
  unsubscribeCutLogs = window.api.highlightChat.onLog((line) => {
    if (line.sessionId !== sessionId.value) return
    cutLogs.push(line)
    if (cutLogs.length > MAX_CUT_LOG_LINES) cutLogs.splice(0, cutLogs.length - MAX_CUT_LOG_LINES)
  })

  try {
    const result = await window.api.highlightChat.start({ jobId: props.jobId, options: props.aiOptions })
    sessionId.value = result.sessionId
    segments.value = result.segments
    audioUrl.value = result.audioUrl
    messages.push({
      role: 'assistant',
      content: 'Pronto! Já tenho a transcrição do vídeo. Me diga que tipo de trecho você quer destacar (ex: "os melhores momentos de humor").'
    })
  } catch (error: any) {
    startError.value = error?.message || String(error)
  } finally {
    starting.value = false
  }
})

onUnmounted(() => {
  unsubscribeCutLogs?.()
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

/** What's being said at time `t`, so the user can see what a slider position actually selects. */
function textAtTime(t: number): string {
  if (!segments.value.length) return ''

  const containing = segments.value.find((s) => t >= s.start && t < s.end)
  const nearest =
    containing ??
    segments.value.reduce((closest, s) => (Math.abs(s.start - t) < Math.abs(closest.start - t) ? s : closest))

  const text = nearest.text.trim()
  return text.length > 90 ? `${text.slice(0, 90)}…` : text
}

/** Plays just [start, end] of the shared audio for this highlight; clicking the same one again stops it. */
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

/** Auto-stops at the highlight's current `end` — read live, so dragging the end slider mid-playback takes effect immediately. */
function onTimeUpdate(): void {
  if (playingIndex.value === null) return
  const highlight = highlights.value[playingIndex.value]
  if (audioEl.value && highlight && audioEl.value.currentTime >= highlight.end) {
    stopPlayback()
  }
}

/**
 * Jumps playback to the new start immediately while the user drags that
 * highlight's start slider, so it's audible right away. Reads the value
 * straight off the event target rather than `highlights.value[index].start`
 * — that ref's `v-model` listener isn't guaranteed to run before this one
 * for the same native `input` event, so relying on it would sometimes seek
 * to the previous (stale) value instead of the one just dragged to.
 */
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

async function processCuts(): Promise<void> {
  if (!sessionId.value || !highlights.value.length || cutting.value) return

  cutting.value = true
  cutError.value = null
  cutLogs.splice(0, cutLogs.length)

  try {
    const result = await window.api.highlightChat.processCuts({
      sessionId: sessionId.value,
      marginSeconds: marginSeconds.value
    })
    emit('finish', result.outputFiles)
  } catch (error: any) {
    cutError.value = error?.message || String(error)
  } finally {
    cutting.value = false
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const fileName = props.filePath.split(/[/\\]/).pop() || props.filePath
</script>

<template>
  <div class="chat-panel">
    <p class="file-label" :title="filePath">{{ fileName }}</p>
    <p v-if="starting" class="hint">Carregando a transcrição…</p>
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

      <div class="cut-bar">
        <label for="chat-margin">Margem antes/depois (segundos)</label>
        <input id="chat-margin" v-model.number="marginSeconds" type="number" min="0" step="1" />
        <button
          class="btn btn-primary"
          type="button"
          :disabled="!highlights.length || cutting"
          @click="processCuts"
        >
          {{ cutting ? 'Cortando clipes…' : '🎬 Processar cortes' }}
        </button>
      </div>
      <p v-if="cutError" class="hint hint-warning">{{ cutError }}</p>

      <div v-if="cutLogs.length" ref="cutLogsEl" class="file-log">
        <div v-for="(line, index) in cutLogs" :key="index" class="log-line" :class="`log-${line.level}`">
          {{ line.text }}
        </div>
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

.cut-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  font-size: 13px;
}

.cut-bar label {
  color: var(--text-muted);
}

.cut-bar input[type='number'] {
  width: 64px;
}

.file-label {
  font-weight: 600;
  font-size: 13px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.hint-warning {
  color: var(--warning);
}

.file-log {
  margin-top: 4px;
  max-height: 140px;
  overflow-y: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 4%, var(--bg));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  /* This is effectively a mirrored terminal — needs to stay selectable/copyable for debugging. */
  user-select: text;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-muted);
}

.log-line.log-warn {
  color: var(--warning);
}

.log-line.log-error {
  color: var(--danger);
}

.log-line.log-progress {
  opacity: 0.75;
  font-style: italic;
}
</style>
