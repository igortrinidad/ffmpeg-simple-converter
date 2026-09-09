<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { OutputRootInfo } from '@shared/types'
import { useSettings } from '../../../composables/useSettings'

const emit = defineEmits<{
  back: []
}>()

const { state: settings, load, save } = useSettings()

const defaultOutputDir = ref('')
const outputRoot = ref<OutputRootInfo | null>(null)
const saving = ref(false)

// Empty field = built-in default (Documentos/Mediacript), so show that path
// instead of leaving the user guessing where their files went.
const effectiveRoot = computed(() =>
  defaultOutputDir.value.trim() || outputRoot.value?.defaultRoot || ''
)

/** Same example path, written with the separator of whichever OS is running. */
const pathExample = computed(() => {
  const separator = effectiveRoot.value.includes('\\') ? '\\' : '/'
  return `${separator}Convert${separator}2026-01-31_14-05-22_video.mp4`
})

onMounted(async () => {
  await load()
  defaultOutputDir.value = settings.config.defaultOutputDir ?? ''
  outputRoot.value = await window.api.config.getOutputRoot()
})

async function pickOutputDir(): Promise<void> {
  const dir = await window.api.files.pickDirectory()
  if (dir) defaultOutputDir.value = dir
}

function useDefaultDir(): void {
  defaultOutputDir.value = ''
}

async function openOutputRoot(): Promise<void> {
  if (outputRoot.value) await window.api.files.openFile(outputRoot.value.root)
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
      <label for="outputDir">Pasta de saída padrão</label>
      <p class="hint">
        Tudo que o app gera é salvo aqui, em uma subpasta por funcionalidade (Convert, Subtitle,
        Highlights, Meetings, Screencast, Compress), com a data e a hora no nome do arquivo.
      </p>
      <div class="output-dir-row">
        <input id="outputDir" v-model="defaultOutputDir" type="text" :placeholder="outputRoot?.defaultRoot ?? ''" />
        <button class="btn" type="button" @click="pickOutputDir">Escolher…</button>
      </div>
      <p v-if="effectiveRoot" class="path-preview">
        {{ effectiveRoot }}<span class="path-example">{{ pathExample }}</span>
      </p>
      <div class="actions">
        <button v-if="defaultOutputDir.trim()" class="btn btn-ghost" type="button" @click="useDefaultDir">
          Usar a pasta padrão
        </button>
        <button v-if="outputRoot" class="btn btn-ghost" type="button" @click="openOutputRoot">
          Abrir pasta atual
        </button>
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

.hint {
  color: var(--text-muted);
  font-size: 12px;
  margin: 4px 0 0;
}

.output-dir-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.path-preview {
  font-size: 12px;
  margin: 8px 0 0;
  word-break: break-all;
}

.path-example {
  color: var(--text-muted);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
