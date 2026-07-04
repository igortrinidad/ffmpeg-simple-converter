<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { detectFileKind } from '@shared/fileKind'
import type { FileKind, RetryRequest } from '@shared/types'
import { useSettings } from '../composables/useSettings'
import { useRetry } from '../composables/useRetry'
import WizardModal from '../components/wizard/WizardModal.vue'

interface SelectedFile {
  path: string
  name: string
  kind: FileKind | null
}

const { state: settings, load: loadSettings } = useSettings()
const retry = useRetry()

const files = ref<SelectedFile[]>([])
const isDragging = ref(false)
const showWizard = ref(false)
const retryRequest = ref<RetryRequest | null>(null)

onMounted(async () => {
  await loadSettings()

  const pending = retry.consumeRetry()
  if (pending) {
    addPaths([pending.filePath])
    retryRequest.value = pending
    showWizard.value = true
  }
})

const kindsPresent = computed(() => new Set(files.value.map((f) => f.kind).filter(Boolean)))
const hasMixedKinds = computed(() => kindsPresent.value.size > 1)
const hasUnsupported = computed(() => files.value.some((f) => f.kind === null))
const canContinue = computed(
  () => files.value.length > 0 && !hasMixedKinds.value && !hasUnsupported.value
)
const detectedKind = computed<FileKind | null>(() => {
  const [kind] = kindsPresent.value
  return kind ?? null
})

function addPaths(paths: string[]): void {
  const existing = new Set(files.value.map((f) => f.path))
  for (const filePath of paths) {
    if (existing.has(filePath)) continue
    files.value.push({
      path: filePath,
      name: filePath.split(/[/\\]/).pop() || filePath,
      kind: detectFileKind(filePath)
    })
  }
}

function removeFile(path: string): void {
  files.value = files.value.filter((f) => f.path !== path)
}

function clearFiles(): void {
  files.value = []
}

function onDrop(event: DragEvent): void {
  isDragging.value = false
  const dropped = Array.from(event.dataTransfer?.files ?? [])
  const paths = dropped.map((file) => window.api.files.getPathForFile(file))
  addPaths(paths)
}

async function openFilePicker(): Promise<void> {
  const paths = await window.api.files.pickFiles()
  addPaths(paths)
}

function onWizardClosed(finished: boolean): void {
  showWizard.value = false
  retryRequest.value = null
  if (finished) {
    clearFiles()
  }
}
</script>

<template>
  <div class="home">
    <div v-if="!settings.ffmpeg.installed" class="banner banner-warning">
      ⚠️ FFmpeg não foi encontrado no sistema. Instale o FFmpeg e reabra o aplicativo para poder
      converter ou transcrever arquivos.
    </div>

    <div
      class="dropzone"
      :class="{ dragging: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="onDrop"
      @click="openFilePicker"
    >
      <div class="dropzone-icon">📂</div>
      <p class="dropzone-title">Arraste vídeos ou áudios aqui</p>
      <p class="dropzone-subtitle">ou clique para selecionar arquivos do computador</p>
      <p class="dropzone-formats">MP4, MOV, MKV, WEBM, AVI, MP3, WAV, M4A, AAC, FLAC, OGG</p>
    </div>

    <section v-if="files.length" class="selected card">
      <div class="selected-header">
        <h3>Arquivos selecionados ({{ files.length }})</h3>
        <button class="btn btn-ghost" @click="clearFiles">Limpar tudo</button>
      </div>

      <p v-if="hasMixedKinds" class="hint hint-warning">
        Você misturou vídeos e áudios. Selecione arquivos de apenas um tipo por vez.
      </p>
      <p v-if="hasUnsupported" class="hint hint-warning">
        Alguns arquivos não são suportados e serão ignorados.
      </p>

      <ul class="file-list">
        <li v-for="file in files" :key="file.path" class="file-item">
          <span class="file-icon">{{ file.kind === 'video' ? '🎬' : file.kind === 'audio' ? '🎵' : '❓' }}</span>
          <span class="file-name" :title="file.path">{{ file.name }}</span>
          <button class="btn btn-ghost remove-btn" title="Remover" @click="removeFile(file.path)">
            ✕
          </button>
        </li>
      </ul>

      <button class="btn btn-primary continue-btn" :disabled="!canContinue" @click="showWizard = true">
        Continuar →
      </button>
    </section>

    <WizardModal
      v-if="showWizard && detectedKind"
      :file-paths="files.map((f) => f.path)"
      :file-kind="detectedKind"
      :initial-request="retryRequest"
      @close="onWizardClosed"
    />
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 720px;
  margin: 0 auto;
}

.banner {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 13px;
}

.banner-warning {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--warning);
  border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
}

.dropzone {
  border: 2px dashed var(--border);
  border-radius: 16px;
  padding: 56px 24px;
  text-align: center;
  background: var(--bg-elevated);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dropzone:hover,
.dropzone.dragging {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-elevated));
}

.dropzone-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.dropzone-title {
  font-size: 16px;
  font-weight: 700;
  margin: 4px 0;
}

.dropzone-subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin: 2px 0;
}

.dropzone-formats {
  color: var(--text-muted);
  font-size: 11px;
  margin-top: 10px;
}

.selected {
  padding: 18px 20px;
}

.selected-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selected-header h3 {
  font-size: 14px;
  margin: 0;
}

.hint {
  font-size: 12px;
  margin: 8px 0;
}

.hint-warning {
  color: var(--warning);
}

.file-list {
  list-style: none;
  margin: 12px 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
}

.file-item:hover {
  background: var(--bg);
}

.file-name {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-btn {
  padding: 2px 8px;
  font-size: 12px;
}

.continue-btn {
  width: 100%;
  padding: 11px;
  font-size: 14px;
}
</style>
