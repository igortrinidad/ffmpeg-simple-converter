<script setup lang="ts">
import { ref, type DeepReadonly } from 'vue'
import AgentsListView from './AgentsListView.vue'
import AgentFormView from './AgentFormView.vue'
import type { Agent } from '@shared/types'

const mode = ref<'list' | 'form'>('list')
const editingAgent = ref<DeepReadonly<Agent> | null>(null)

function onCreate(): void {
  editingAgent.value = null
  mode.value = 'form'
}

function onEdit(agent: DeepReadonly<Agent>): void {
  editingAgent.value = agent
  mode.value = 'form'
}

function backToList(): void {
  editingAgent.value = null
  mode.value = 'list'
}
</script>

<template>
  <AgentsListView v-if="mode === 'list'" @create="onCreate" @edit="onEdit" />
  <AgentFormView v-else :agent="editingAgent" @saved="backToList" @cancel="backToList" />
</template>
