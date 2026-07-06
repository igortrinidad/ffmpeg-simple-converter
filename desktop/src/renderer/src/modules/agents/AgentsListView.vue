<script setup lang="ts">
import { onMounted, type DeepReadonly } from 'vue'
import { useAgents } from '../../composables/useAgents'
import { EXPORT_FORMATS } from '@shared/exportFormats'
import type { Agent } from '@shared/types'

const emit = defineEmits<{
  create: []
  edit: [agent: DeepReadonly<Agent>]
}>()

const { state, load, remove } = useAgents()

onMounted(load)

function formatLabel(id: string): string {
  return EXPORT_FORMATS.find((f) => f.id === id)?.label ?? id
}

async function onDelete(id: string): Promise<void> {
  await remove(id)
}
</script>

<template>
  <div class="agents-list">
    <div class="agents-header">
      <h2>Agents</h2>
      <button class="btn btn-primary" @click="emit('create')">+ Criar agente</button>
    </div>

    <p v-if="!state.agents.length" class="empty">
      Nenhum agente criado ainda. Agentes guardam um prompt-objetivo e as configurações de export para
      reaproveitar toda vez que você for conversar com a IA no Chat.
    </p>

    <ul v-else class="agent-cards">
      <li v-for="agent in state.agents" :key="agent.id" class="agent-card card">
        <div class="agent-card-top">
          <div class="agent-name">{{ agent.name }}</div>
          <div class="agent-actions">
            <button class="btn btn-ghost" @click="emit('edit', agent)">✏️ Editar</button>
            <button class="btn btn-ghost" @click="onDelete(agent.id)">✕</button>
          </div>
        </div>
        <p class="agent-prompt">{{ agent.prompt }}</p>
        <div class="agent-meta">
          <span>{{ agent.exportOptions.formats.map(formatLabel).join(', ') || 'Sem formatos definidos' }}</span>
          <span>· qualidade: {{ agent.exportOptions.quality }}</span>
          <span>· enquadramento: {{ agent.exportOptions.framing === 'crop' ? 'crop central' : 'blur nas bordas' }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.agents-list {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agents-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agents-header h2 {
  font-size: 18px;
  margin: 0;
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
}

.agent-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-card {
  padding: 14px 16px;
}

.agent-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agent-name {
  font-weight: 600;
  font-size: 14px;
}

.agent-actions {
  display: flex;
  gap: 4px;
}

.agent-prompt {
  color: var(--text-muted);
  font-size: 13px;
  margin: 8px 0;
  white-space: pre-wrap;
}

.agent-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
