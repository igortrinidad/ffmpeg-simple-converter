<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useSettings } from '../../../composables/useSettings'

const emit = defineEmits<{
  back: []
}>()

const { state: settings, load, save } = useSettings()

const defaultOutputDir = ref('')
const saving = ref(false)

onMounted(async () => {
  await load()
  defaultOutputDir.value = settings.config.defaultOutputDir ?? ''
})

async function pickOutputDir(): Promise<void> {
  const dir = await window.api.files.pickDirectory()
  if (dir) defaultOutputDir.value = dir
}

async function onSave(): Promise<void> {
  saving.value = true
  try {
    await save({ defaultOutputDir: defaultOutputDir.value.trim() })
    emit('back')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="general-view">
    <header class="view-header">
      <button class="btn btn-ghost" @click="emit('back')">← Voltar</button>
      <h2>Geral</h2>
    </header>

    <div class="field-group">
      <label for="outputDir">Pasta de saída padrão (opcional)</label>
      <div class="output-dir-row">
        <input id="outputDir" v-model="defaultOutputDir" type="text" placeholder="Mesma pasta do arquivo original" />
        <button class="btn" type="button" @click="pickOutputDir">Escolher…</button>
      </div>
    </div>

    <button class="btn btn-primary" :disabled="saving" @click="onSave">Salvar</button>
  </div>
</template>

<style scoped>
.general-view {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-header h2 {
  font-size: 16px;
  margin: 0;
}

.output-dir-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
</style>
