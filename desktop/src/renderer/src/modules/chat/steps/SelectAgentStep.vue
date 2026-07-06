<script setup lang="ts">
import { onMounted, ref, type DeepReadonly } from 'vue'
import { useAgents } from '../../../composables/useAgents'
import { useSettings } from '../../../composables/useSettings'
import HighlightOptionsForm, { type HighlightOptionsFormModel } from '../../../shared/components/HighlightOptionsForm.vue'
import { CUSTOM_MODEL } from '../../../shared/constants'
import type { Agent, ExportOptionsInput } from '@shared/types'

const emit = defineEmits<{
  continue: [
    payload: {
      agentId?: string
      objective?: string
      exportOptions?: ExportOptionsInput
      provider: string
      model: string
    }
  ]
}>()

const { state: agentsState, load: loadAgents } = useAgents()
const { state: settings, load: loadSettings } = useSettings()

const selectedAgentId = ref<string | null>(null)

const form = ref<HighlightOptionsFormModel>({
  provider: 'anthropic',
  modelChoice: '',
  customModel: '',
  prompt: '',
  marginSeconds: 2
})

onMounted(async () => {
  await Promise.all([loadAgents(), loadSettings()])
  const firstConfigured = settings.aiProviders.find((p) => p.hasApiKey) ?? settings.aiProviders[0]
  if (firstConfigured) {
    form.value.provider = firstConfigured.provider
    form.value.modelChoice = firstConfigured.models[0] ?? CUSTOM_MODEL
  }
})

function selectAgent(agent: DeepReadonly<Agent> | null): void {
  selectedAgentId.value = agent?.id ?? null
}

function onContinue(): void {
  const agent = agentsState.agents.find((a) => a.id === selectedAgentId.value) ?? null
  const model = form.value.modelChoice === CUSTOM_MODEL ? form.value.customModel : form.value.modelChoice

  emit('continue', {
    agentId: agent?.id,
    objective: agent?.prompt,
    exportOptions: agent
      ? { formats: [...agent.exportOptions.formats], quality: agent.exportOptions.quality, framing: agent.exportOptions.framing }
      : undefined,
    provider: form.value.provider,
    model: model.trim()
  })
}
</script>

<template>
  <div class="select-agent-step">
    <p class="step-intro">Escolha um agente (opcional) para reaproveitar o objetivo e as configurações de export dele.</p>

    <div class="agent-grid">
      <button class="agent-card" :class="{ active: selectedAgentId === null }" @click="selectAgent(null)">
        <div class="agent-name">Sem agente</div>
        <div class="agent-desc">Conversa livre, você define tudo na hora.</div>
      </button>
      <button
        v-for="agent in agentsState.agents"
        :key="agent.id"
        class="agent-card"
        :class="{ active: selectedAgentId === agent.id }"
        @click="selectAgent(agent)"
      >
        <div class="agent-name">{{ agent.name }}</div>
        <div class="agent-desc">{{ agent.prompt }}</div>
      </button>
    </div>

    <p v-if="!agentsState.agents.length" class="hint">
      Nenhum agente criado ainda — crie um na aba Agents para reaproveitar prompts e formatos de export.
    </p>

    <HighlightOptionsForm v-model="form" mode="chat" />

    <button class="btn btn-primary continue-btn" @click="onContinue">Continuar →</button>
  </div>
</template>

<style scoped>
.select-agent-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
  margin: 0 auto;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0;
  text-align: center;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.agent-card {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text);
  border-radius: 10px;
  padding: 12px 14px;
}

.agent-card.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
}

.agent-name {
  font-weight: 600;
  font-size: 13px;
}

.agent-desc {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.continue-btn {
  padding: 11px;
  font-size: 14px;
}
</style>
