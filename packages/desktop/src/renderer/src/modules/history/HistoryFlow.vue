<script setup lang="ts">
import { computed, onMounted, type DeepReadonly } from 'vue'
import type {
  HistoryEntry,
  ChatSessionSummary,
  HistoryOperation,
  MeetingSummary,
  RetryRequest
} from '@shared/types'
import { isJobOperation, isSubtitleOperation } from '@shared/operations'
import { useHistory } from '../../composables/useHistory'
import { useChatSessions } from '../../composables/useChatSessions'
import { useMeetings } from '../meetings/composables/useMeetings'
import { useRetry } from '../../composables/useRetry'
import { useNavigation } from '../../composables/useNavigation'
import { useClipboard } from '../../composables/useClipboard'

const jobs = useHistory()
const sessions = useChatSessions()
const meetings = useMeetings()
const retry = useRetry()
const nav = useNavigation()
const { copiedKey, copy } = useClipboard()

// Every module keeps its own store — History is the one place that reads them
// all and merges them into a single reverse-chronological feed.
onMounted(() => {
  jobs.load()
  sessions.load()
  meetings.load()
})

type FeedItem =
  | { type: 'job'; date: number; entry: DeepReadonly<HistoryEntry> }
  | { type: 'session'; date: number; entry: DeepReadonly<ChatSessionSummary> }
  | { type: 'meeting'; date: number; entry: DeepReadonly<MeetingSummary> }

const feed = computed<FeedItem[]>(() => {
  // Conversões, legendas, compressões e gravações de tela.
  const jobItems: FeedItem[] = jobs.state.entries.map((entry) => ({
    type: 'job',
    date: new Date(entry.finishedAt).getTime(),
    entry
  }))
  const sessionItems: FeedItem[] = sessions.state.sessions.map((entry) => ({
    type: 'session',
    date: new Date(entry.updatedAt).getTime(),
    entry
  }))
  const meetingItems: FeedItem[] = meetings.state.meetings.map((entry) => ({
    type: 'meeting',
    date: new Date(entry.updatedAt).getTime(),
    entry
  }))
  return [...jobItems, ...sessionItems, ...meetingItems].sort((a, b) => b.date - a.date)
})

/**
 * Which module a run came from, shown as a tag on every row so the merged
 * feed stays readable. Unknown ids are tolerated: the history file is
 * persisted data that outlives the operation list it was written against.
 */
function moduleLabel(operation: HistoryOperation): string {
  if (operation === 'compress') return 'Comprimir'
  if (operation === 'screencast') return 'Screencast'
  if (!isJobOperation(operation)) return 'App'
  return isSubtitleOperation(operation) ? 'Legendas' : 'Convert'
}

/** `12:04` / `1:02:33` — a meeting's recorded length. */
function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const pad = (value: number): string => String(value).padStart(2, '0')
  const hours = Math.floor(seconds / 3600)
  const rest = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
  return hours ? `${hours}:${rest}` : rest
}

const MEETING_STATUS: Record<MeetingSummary['status'], { icon: string; label: string }> = {
  recording: { icon: '🔴', label: 'Gravando' },
  processing: { icon: '⏳', label: 'Processando' },
  ready: { icon: '🎙️', label: 'Ata pronta' },
  failed: { icon: '❌', label: 'Falhou' }
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR')
}

async function openFile(path: string): Promise<void> {
  await window.api.files.openFile(path)
}

async function revealFile(path: string): Promise<void> {
  await window.api.files.revealInFolder(path)
}

// Only the wizard operations can be replayed — Comprimir and Screencast runs
// are recorded for the feed, but they don't come from the job runner.
function canRetry(entry: DeepReadonly<HistoryEntry>): boolean {
  return isJobOperation(entry.operation)
}

function retryJob(entry: DeepReadonly<HistoryEntry>): void {
  if (!isJobOperation(entry.operation)) return

  const request: RetryRequest = {
    filePath: entry.inputFile,
    operation: entry.operation,
    conversionOptions: entry.conversionOptions ? { ...entry.conversionOptions } : undefined,
    highlightOptions: entry.highlightOptions ? { ...entry.highlightOptions } : undefined,
    exportOptions: entry.exportOptions
      ? { formats: [...entry.exportOptions.formats], quality: entry.exportOptions.quality, framing: entry.exportOptions.framing }
      : undefined,
    subtitleOptions: entry.subtitleOptions ? { ...entry.subtitleOptions } : undefined
  }
  retry.setRetry(request)
  nav.go(isSubtitleOperation(entry.operation) ? 'subtitle' : 'convert')
}

function continueSession(session: DeepReadonly<ChatSessionSummary>): void {
  nav.resumeChatSession(session.id)
}

async function removeSession(id: string): Promise<void> {
  await sessions.remove(id)
}

/** Drops the meeting from the feed but keeps its folder — the audio and the ata stay on disk. */
async function removeMeeting(id: string): Promise<void> {
  await meetings.remove(id, false)
}
</script>

<template>
  <div class="history">
    <div class="history-header">
      <h2>Histórico</h2>
      <button
        v-if="jobs.state.entries.length"
        class="btn btn-ghost"
        title="Remove as conversões, legendas, compressões e gravações da lista. Conversas e reuniões continuam nos seus módulos."
        @click="jobs.clear"
      >
        Limpar processamentos
      </button>
    </div>

    <p v-if="!feed.length" class="empty">
      Nada por aqui ainda. Tudo o que o app fizer — conversões, legendas, compressões, gravações de
      tela, conversas e reuniões — aparece nesta lista.
    </p>

    <ul v-else class="entry-list">
      <li v-for="item in feed" :key="`${item.type}:${item.entry.id}`" class="entry card">
        <template v-if="item.type === 'job'">
          <div class="entry-top">
            <span class="entry-status" :class="item.entry.status">
              {{ item.entry.status === 'completed' ? '✅' : '❌' }}
            </span>
            <div class="entry-info">
              <div class="entry-title">
                <span class="entry-tag">{{ moduleLabel(item.entry.operation) }}</span>
                {{ item.entry.operationLabel }}
              </div>
              <div class="entry-file" :title="item.entry.inputFile">{{ fileName(item.entry.inputFile) }}</div>
            </div>
            <div class="entry-date">{{ formatDate(item.date) }}</div>
            <button
              v-if="canRetry(item.entry)"
              class="btn btn-ghost"
              title="Repetir com a mesma configuração"
              @click="retryJob(item.entry)"
            >
              🔁 Repetir
            </button>
            <button class="btn btn-ghost" title="Remover do histórico" @click="jobs.remove(item.entry.id)">✕</button>
          </div>

          <div v-if="item.entry.error" class="entry-error-row">
            <p class="entry-error">{{ item.entry.error }}</p>
            <button class="btn btn-ghost btn-copy" type="button" title="Copiar erro" @click="copy(item.entry.id, item.entry.error)">
              {{ copiedKey === item.entry.id ? '✓ Copiado' : '📋 Copiar' }}
            </button>
          </div>

          <ul v-if="item.entry.outputFiles.length" class="output-list">
            <li v-for="file in item.entry.outputFiles" :key="file" class="output-item">
              <span class="file-name" :title="file">{{ fileName(file) }}</span>
              <button class="btn btn-ghost" @click="openFile(file)">Abrir</button>
              <button class="btn btn-ghost" @click="revealFile(file)">Mostrar na pasta</button>
            </li>
          </ul>
        </template>

        <template v-else-if="item.type === 'session'">
          <div class="entry-top">
            <span class="entry-status">💬</span>
            <div class="entry-info">
              <div class="entry-title">
                <span class="entry-tag">Chat</span>
                Conversa {{ item.entry.status === 'active' ? 'em andamento' : 'concluída' }}
                ({{ item.entry.messageCount }} mensagens, {{ item.entry.highlightCount }} destaques)
              </div>
              <div class="entry-file" :title="item.entry.filePath">{{ fileName(item.entry.filePath) }}</div>
            </div>
            <div class="entry-date">{{ formatDate(item.date) }}</div>
            <button class="btn btn-ghost" @click="continueSession(item.entry)">
              {{ item.entry.status === 'active' ? '💬 Continuar conversa' : '👁️ Ver conversa' }}
            </button>
            <button class="btn btn-ghost" title="Remover do histórico" @click="removeSession(item.entry.id)">✕</button>
          </div>

          <ul v-if="item.entry.outputFiles?.length" class="output-list">
            <li v-for="file in item.entry.outputFiles" :key="file" class="output-item">
              <span class="file-name" :title="file">{{ fileName(file) }}</span>
              <button class="btn btn-ghost" @click="openFile(file)">Abrir</button>
              <button class="btn btn-ghost" @click="revealFile(file)">Mostrar na pasta</button>
            </li>
          </ul>
        </template>

        <template v-else>
          <div class="entry-top">
            <span class="entry-status">{{ MEETING_STATUS[item.entry.status].icon }}</span>
            <div class="entry-info">
              <div class="entry-title">
                <span class="entry-tag">Reuniões</span>
                {{ item.entry.title }}
              </div>
              <div class="entry-file">
                {{ MEETING_STATUS[item.entry.status].label }} ·
                {{ formatDuration(item.entry.durationSeconds) }}
                <template v-if="item.entry.hasMinutes"> · ata gerada</template>
              </div>
            </div>
            <div class="entry-date">{{ formatDate(item.date) }}</div>
            <button class="btn btn-ghost" @click="nav.openMeeting(item.entry.id)">🎙️ Abrir reunião</button>
            <button
              class="btn btn-ghost"
              title="Remover do histórico (o áudio e a ata continuam na pasta)"
              @click="removeMeeting(item.entry.id)"
            >
              ✕
            </button>
          </div>

          <div v-if="item.entry.error" class="entry-error-row">
            <p class="entry-error">{{ item.entry.error }}</p>
            <button
              class="btn btn-ghost btn-copy"
              type="button"
              title="Copiar erro"
              @click="copy(item.entry.id, item.entry.error)"
            >
              {{ copiedKey === item.entry.id ? '✓ Copiado' : '📋 Copiar' }}
            </button>
          </div>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.history {
  max-width: 820px;
  margin: 0 auto;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.history-header h2 {
  font-size: 18px;
  margin: 0;
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
}

.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry {
  padding: 14px 16px;
}

.entry-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.entry-status {
  font-size: 16px;
}

.entry-info {
  flex: 1;
  min-width: 0;
}

.entry-title {
  font-weight: 600;
  font-size: 13px;
}

/* Names the module a row came from, so the merged feed stays scannable. */
.entry-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 1px 5px;
  margin-right: 6px;
  vertical-align: 1px;
}

.entry-file {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-date {
  color: var(--text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.entry-error-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0 0;
}

.entry-error {
  color: var(--danger);
  font-size: 12px;
  margin: 0;
  flex: 1;
  user-select: text;
}

.btn-copy {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  white-space: nowrap;
}

.output-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.output-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.output-item .file-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
