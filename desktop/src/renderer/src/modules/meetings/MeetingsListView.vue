<script setup lang="ts">
import { ref, type DeepReadonly } from 'vue'
import type { MeetingSummary } from '@shared/types'

defineProps<{
  meetings: DeepReadonly<MeetingSummary[]>
  loaded: boolean
}>()

const emit = defineEmits<{
  new: []
  select: [id: string]
  remove: [id: string]
}>()

const confirmingId = ref<string | null>(null)

const STATUS_LABELS: Record<MeetingSummary['status'], string> = {
  recording: '🔴 Gravação interrompida',
  processing: '⏳ Processando',
  ready: '✅ Ata pronta',
  failed: '⚠️ Falhou'
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, '0')}`
}

function confirmRemove(id: string): void {
  emit('remove', id)
  confirmingId.value = null
}
</script>

<template>
  <div class="meetings-list">
    <button class="btn btn-primary new-btn" type="button" @click="emit('new')">● Gravar nova reunião</button>

    <p v-if="loaded && !meetings.length" class="hint">
      Nenhuma reunião gravada ainda. Grave uma e a IA escreve a ata com resumo, decisões e ações.
    </p>

    <ul v-else class="list">
      <li v-for="meeting in meetings" :key="meeting.id" class="item">
        <button class="item-main" type="button" @click="emit('select', meeting.id)">
          <span class="item-title">{{ meeting.title }}</span>
          <span class="item-meta">
            {{ new Date(meeting.createdAt).toLocaleString('pt-BR') }} · {{ formatDuration(meeting.durationSeconds) }} ·
            {{ STATUS_LABELS[meeting.status] }}
          </span>
          <span v-if="meeting.error" class="item-error">{{ meeting.error }}</span>
        </button>

        <template v-if="confirmingId === meeting.id">
          <button class="btn btn-danger small" type="button" @click="confirmRemove(meeting.id)">Excluir tudo</button>
          <button class="btn btn-ghost small" type="button" @click="confirmingId = null">Voltar</button>
        </template>
        <button v-else class="btn btn-ghost small" type="button" @click="confirmingId = meeting.id">✕</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.meetings-list {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.new-btn {
  align-self: center;
  padding: 11px 22px;
  font-size: 14px;
}

.hint {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 4px 8px 4px 4px;
}

.item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  border: none;
  background: none;
  color: var(--text);
  padding: 8px 10px;
}

.item-title {
  font-weight: 600;
  font-size: 13px;
}

.item-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.item-error {
  font-size: 11px;
  color: var(--danger);
}

.small {
  font-size: 11px;
  padding: 5px 8px;
}

.btn-danger {
  border: 1px solid var(--danger);
  background: var(--danger);
  color: white;
}
</style>
