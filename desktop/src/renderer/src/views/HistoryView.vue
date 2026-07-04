<script setup lang="ts">
import { onMounted } from 'vue'
import { useHistory } from '../composables/useHistory'

const { state, load, remove, clear } = useHistory()

onMounted(() => {
  load()
})

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

async function openFile(path: string): Promise<void> {
  await window.api.files.openFile(path)
}

async function revealFile(path: string): Promise<void> {
  await window.api.files.revealInFolder(path)
}
</script>

<template>
  <div class="history">
    <div class="history-header">
      <h2>Histórico</h2>
      <button v-if="state.entries.length" class="btn btn-ghost" @click="clear">Limpar histórico</button>
    </div>

    <p v-if="!state.entries.length" class="empty">
      Nenhuma operação executada ainda. Volte para o Início para converter ou processar arquivos.
    </p>

    <ul v-else class="entry-list">
      <li v-for="entry in state.entries" :key="entry.id" class="entry card">
        <div class="entry-top">
          <span class="entry-status" :class="entry.status">
            {{ entry.status === 'completed' ? '✅' : '❌' }}
          </span>
          <div class="entry-info">
            <div class="entry-title">{{ entry.operationLabel }}</div>
            <div class="entry-file" :title="entry.inputFile">{{ fileName(entry.inputFile) }}</div>
          </div>
          <div class="entry-date">{{ formatDate(entry.finishedAt) }}</div>
          <button class="btn btn-ghost" title="Remover do histórico" @click="remove(entry.id)">✕</button>
        </div>

        <p v-if="entry.error" class="entry-error">{{ entry.error }}</p>

        <ul v-if="entry.outputFiles.length" class="output-list">
          <li v-for="file in entry.outputFiles" :key="file" class="output-item">
            <span class="file-name" :title="file">{{ fileName(file) }}</span>
            <button class="btn btn-ghost" @click="openFile(file)">Abrir</button>
            <button class="btn btn-ghost" @click="revealFile(file)">Mostrar na pasta</button>
          </li>
        </ul>
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

.entry-error {
  color: var(--danger);
  font-size: 12px;
  margin: 8px 0 0;
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
