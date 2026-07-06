<script setup lang="ts">
import { ref, type DeepReadonly } from 'vue'
import { useAgents } from '../../composables/useAgents'
import OutputFormatPicker from '../../shared/components/OutputFormatPicker.vue'
import type { Agent, ExportOptionsInput } from '@shared/types'

const props = defineProps<{
  agent?: DeepReadonly<Agent> | null
}>()

const emit = defineEmits<{
  saved: []
  cancel: []
}>()

const { save } = useAgents()

const name = ref(props.agent?.name ?? '')
const prompt = ref(props.agent?.prompt ?? '')
const exportOptions = ref<ExportOptionsInput>(
  props.agent?.exportOptions
    ? {
        formats: [...props.agent.exportOptions.formats],
        quality: props.agent.exportOptions.quality,
        framing: props.agent.exportOptions.framing
      }
    : { formats: [], quality: 'standard', framing: 'crop' }
)
const saving = ref(false)

async function onSave(): Promise<void> {
  if (!name.value.trim() || !prompt.value.trim()) return
  saving.value = true
  try {
    await save({ id: props.agent?.id, name: name.value.trim(), prompt: prompt.value.trim(), exportOptions: { ...exportOptions.value } })
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="agent-form">
    <h2>{{ agent ? 'Editar agente' : 'Criar agente' }}</h2>

    <div class="field-group">
      <label for="agent-name">Nome</label>
      <input id="agent-name" v-model="name" type="text" placeholder="Ex: Cortes de podcast" />
    </div>

    <div class="field-group">
      <label for="agent-prompt">Objetivo principal (prompt reaproveitado toda vez)</label>
      <textarea
        id="agent-prompt"
        v-model="prompt"
        rows="4"
        placeholder='Ex: "Encontre os 3 melhores momentos de humor e reações genuínas"'
      />
    </div>

    <OutputFormatPicker v-model="exportOptions" />

    <div class="form-actions">
      <button class="btn" @click="emit('cancel')">Cancelar</button>
      <button class="btn btn-primary" :disabled="saving || !name.trim() || !prompt.trim()" @click="onSave">
        Salvar
      </button>
    </div>
  </div>
</template>

<style scoped>
.agent-form {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-form h2 {
  font-size: 18px;
  margin: 0;
}

.field-group > * + * {
  margin-top: 6px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
