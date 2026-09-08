<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MeetingDetail } from '@shared/types'
import { renderMarkdown } from '../../../shared/markdown'
import { useClipboard } from '../../../composables/useClipboard'

const props = defineProps<{
  detail: MeetingDetail
}>()

const emit = defineEmits<{
  updated: [detail: MeetingDetail]
  back: []
}>()

type Tab = 'minutes' | 'transcript' | 'ask'

const tab = ref<Tab>('minutes')
const { copiedKey, copy } = useClipboard()

const regenerating = ref(false)
const regenerateInstructions = ref('')
const showRegenerateBox = ref(false)

const question = ref('')
const asking = ref(false)
const error = ref('')

const minutesHtml = computed(() => (props.detail.minutes ? renderMarkdown(props.detail.minutes) : ''))

const speakerLabels: Record<string, string> = { mic: 'Você', system: 'Participantes' }

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

const formattedDuration = computed(() => formatTimestamp(props.detail.durationSeconds))

async function regenerate(): Promise<void> {
  regenerating.value = true
  error.value = ''
  try {
    emit('updated', await window.api.meetings.regenerateMinutes({
      meetingId: props.detail.id,
      instructions: regenerateInstructions.value.trim() || undefined
    }))
    showRegenerateBox.value = false
    regenerateInstructions.value = ''
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível gerar a ata novamente'
  } finally {
    regenerating.value = false
  }
}

async function ask(): Promise<void> {
  const message = question.value.trim()
  if (!message || asking.value) return

  asking.value = true
  error.value = ''
  try {
    await window.api.meetings.ask({ meetingId: props.detail.id, message })
    question.value = ''
    emit('updated', await window.api.meetings.get(props.detail.id))
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível responder agora'
  } finally {
    asking.value = false
  }
}

function openMinutes(): void {
  if (props.detail.minutesFilePath) void window.api.files.openFile(props.detail.minutesFilePath)
}

function openTranscript(): void {
  if (props.detail.transcriptFilePath) void window.api.files.openFile(props.detail.transcriptFilePath)
}

function copyMinutes(): void {
  void copy('minutes', props.detail.minutes ?? '')
}

function revealFolder(): void {
  void window.api.files.revealInFolder(props.detail.minutesFilePath ?? props.detail.folderPath)
}
</script>

<template>
  <div class="meeting-detail">
    <header class="detail-header">
      <button class="btn btn-ghost back-btn" type="button" @click="emit('back')">← Reuniões</button>
      <div class="detail-title">
        <h3>{{ detail.title }}</h3>
        <span class="detail-meta">
          {{ new Date(detail.createdAt).toLocaleString('pt-BR') }} · {{ formattedDuration }} ·
          {{ detail.segments.length }} trechos
        </span>
      </div>
    </header>

    <nav class="tabs">
      <button class="tab" :class="{ active: tab === 'minutes' }" @click="tab = 'minutes'">Ata</button>
      <button class="tab" :class="{ active: tab === 'transcript' }" @click="tab = 'transcript'">Transcrição</button>
      <button class="tab" :class="{ active: tab === 'ask' }" @click="tab = 'ask'">Perguntar</button>
    </nav>

    <p v-if="error" class="error-text">{{ error }}</p>

    <section v-if="tab === 'minutes'" class="panel">
      <div class="panel-actions">
        <button class="btn btn-ghost" type="button" @click="copyMinutes">
          {{ copiedKey === 'minutes' ? '✓ Copiado' : 'Copiar' }}
        </button>
        <button v-if="detail.minutesFilePath" class="btn btn-ghost" type="button" @click="openMinutes">
          Abrir .md
        </button>
        <button class="btn btn-ghost" type="button" @click="revealFolder">Mostrar na pasta</button>
        <button class="btn btn-ghost" type="button" @click="showRegenerateBox = !showRegenerateBox">
          Gerar de novo
        </button>
      </div>

      <div v-if="showRegenerateBox" class="regenerate-box">
        <input
          v-model="regenerateInstructions"
          class="text-input"
          type="text"
          placeholder="Instrução opcional: ex. 'foque nas decisões comerciais e liste prazos'"
          @keyup.enter="regenerate"
        />
        <button class="btn btn-primary" type="button" :disabled="regenerating" @click="regenerate">
          {{ regenerating ? 'Gerando…' : 'Gerar' }}
        </button>
      </div>

      <!-- eslint-disable-next-line vue/no-v-html -- renderMarkdown escapes the model output before adding its own tags -->
      <article v-if="minutesHtml" class="markdown" v-html="minutesHtml" />
      <p v-else class="hint">Nenhuma ata gerada ainda.</p>
    </section>

    <section v-else-if="tab === 'transcript'" class="panel">
      <div class="panel-actions">
        <button v-if="detail.transcriptFilePath" class="btn btn-ghost" type="button" @click="openTranscript">
          Abrir .md
        </button>
      </div>

      <div class="audio-row">
        <label v-if="detail.audio.mic" class="audio-item">
          <span>🎤 Você</span>
          <audio :src="detail.audio.mic" controls preload="none" />
        </label>
        <label v-if="detail.audio.system" class="audio-item">
          <span>🔊 Participantes</span>
          <audio :src="detail.audio.system" controls preload="none" />
        </label>
      </div>

      <ul class="segments">
        <li v-for="(segment, index) in detail.segments" :key="index" :class="segment.track">
          <span class="segment-time">{{ formatTimestamp(segment.start) }}</span>
          <span class="segment-speaker">{{ speakerLabels[segment.track] }}</span>
          <span class="segment-text">{{ segment.text }}</span>
        </li>
      </ul>
    </section>

    <section v-else class="panel">
      <p class="hint">Pergunte qualquer coisa sobre esta reunião — a resposta sai da transcrição, com o horário do trecho.</p>

      <div class="chat">
        <div
          v-for="(message, index) in detail.history"
          :key="index"
          class="message"
          :class="message.role"
        >
          {{ message.content }}
        </div>
      </div>

      <div class="ask-row">
        <input
          v-model="question"
          class="text-input"
          type="text"
          placeholder="Ex.: o que ficou combinado sobre o prazo?"
          :disabled="asking"
          @keyup.enter="ask"
        />
        <button class="btn btn-primary" type="button" :disabled="asking || !question.trim()" @click="ask">
          {{ asking ? '…' : 'Perguntar' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.meeting-detail {
  max-width: 760px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.back-btn {
  font-size: 12px;
  padding: 5px 9px;
  flex-shrink: 0;
}

.detail-title h3 {
  margin: 0;
  font-size: 16px;
}

.detail-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.tabs {
  display: flex;
  gap: 6px;
  border-bottom: 1px solid var(--border);
}

.tab {
  border: none;
  background: none;
  color: var(--text-muted);
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.panel-actions .btn {
  font-size: 12px;
  padding: 5px 10px;
}

.regenerate-box {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
}

.markdown {
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 18px 20px;
  font-size: 13px;
  line-height: 1.6;
}

.markdown :deep(h2) {
  font-size: 15px;
  margin: 18px 0 6px;
}

.markdown :deep(h3) {
  font-size: 14px;
  margin: 14px 0 6px;
}

.markdown :deep(h2:first-child) {
  margin-top: 0;
}

.markdown :deep(ul) {
  margin: 6px 0;
  padding-left: 20px;
}

.markdown :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12px;
}

.markdown :deep(th),
.markdown :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 8px;
  text-align: left;
}

.markdown :deep(th) {
  background: var(--bg);
}

.audio-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.audio-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.segments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 460px;
  overflow-y: auto;
  font-size: 13px;
}

.segments li {
  display: grid;
  grid-template-columns: 64px 96px 1fr;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.segments li.mic {
  border-left: 3px solid var(--accent);
}

.segments li.system {
  border-left: 3px solid var(--success);
}

.segment-time {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}

.segment-speaker {
  font-weight: 600;
  font-size: 12px;
}

.chat {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 380px;
  overflow-y: auto;
}

.message {
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  white-space: pre-wrap;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  background: color-mix(in srgb, var(--accent) 15%, var(--bg));
}

.message.assistant {
  align-self: flex-start;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}

.ask-row {
  display: flex;
  gap: 8px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.error-text {
  color: var(--danger);
  font-size: 12px;
  margin: 0;
}
</style>
