<script setup lang="ts">
import { computed, onMounted, type DeepReadonly } from 'vue'
import type { HistoryEntry, ChatSessionSummary, RetryRequest } from '@shared/types'
import { useHistory } from '../../composables/useHistory'
import { useChatSessions } from '../../composables/useChatSessions'
import { useRetry } from '../../composables/useRetry'
import { useNavigation } from '../../composables/useNavigation'
import { useClipboard } from '../../composables/useClipboard'

const jobs = useHistory()
const sessions = useChatSessions()
const retry = useRetry()
const nav = useNavigation()
const { copiedKey, copy } = useClipboard()

onMounted(() => {
  jobs.load()
  sessions.load()
})

type FeedItem =
  | { type: 'job'; date: number; entry: DeepReadonly<HistoryEntry> }
  | { type: 'session'; date: number; entry: DeepReadonly<ChatSessionSummary> }

const feed = computed<FeedItem[]>(() => {
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
  return [...jobItems, ...sessionItems].sort((a, b) => b.date - a.date)
})

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

function retryJob(entry: DeepReadonly<HistoryEntry>): void {
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
  nav.go(entry.operation === 'video-apply-subtitles' ? 'subtitle' : 'convert')
}

function continueSession(session: DeepReadonly<ChatSessionSummary>): void {
  nav.resumeChatSession(session.id)
}

async function removeSession(id: string): Promise<void> {
  await sessions.remove(id)
}
</script>

<template>
  <div class="history">
    <div class="history-header">
      <h2>Histórico</h2>
      <button v-if="jobs.state.entries.length" class="btn btn-ghost" @click="jobs.clear">Limpar conversões</button>
    </div>

    <p v-if="!feed.length" class="empty">
      Nenhuma conversão, conversa ou processamento ainda. Use o Chat ou o Convert para começar.
    </p>

    <ul v-else class="entry-list">
      <li v-for="item in feed" :key="item.type === 'job' ? item.entry.id : item.entry.id" class="entry card">
        <template v-if="item.type === 'job'">
          <div class="entry-top">
            <span class="entry-status" :class="item.entry.status">
              {{ item.entry.status === 'completed' ? '✅' : '❌' }}
            </span>
            <div class="entry-info">
              <div class="entry-title">{{ item.entry.operationLabel }}</div>
              <div class="entry-file" :title="item.entry.inputFile">{{ fileName(item.entry.inputFile) }}</div>
            </div>
            <div class="entry-date">{{ formatDate(item.date) }}</div>
            <button class="btn btn-ghost" title="Repetir com a mesma configuração" @click="retryJob(item.entry)">
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

        <template v-else>
          <div class="entry-top">
            <span class="entry-status">💬</span>
            <div class="entry-info">
              <div class="entry-title">
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
