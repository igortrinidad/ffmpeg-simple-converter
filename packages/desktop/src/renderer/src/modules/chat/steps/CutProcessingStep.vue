<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { ExportOptionsInput, HighlightChatLogLine } from '@shared/types'
import { toPlain } from '../../../shared/toPlain'

const props = defineProps<{
  sessionId: string
  marginSeconds: number
  exportOptions: ExportOptionsInput
}>()

const cutting = ref(true)
const cutError = ref<string | null>(null)
const outputFiles = ref<string[]>([])
const cutLogs = reactive<HighlightChatLogLine[]>([])
const cutLogsEl = ref<HTMLElement | null>(null)

const MAX_CUT_LOG_LINES = 300
let unsubscribeCutLogs: (() => void) | null = null

watch(
  () => cutLogs.length,
  async () => {
    await nextTick()
    if (cutLogsEl.value) cutLogsEl.value.scrollTop = cutLogsEl.value.scrollHeight
  }
)

onMounted(async () => {
  unsubscribeCutLogs = window.api.highlightChat.onLog((line) => {
    if (line.sessionId !== props.sessionId) return
    cutLogs.push(line)
    if (cutLogs.length > MAX_CUT_LOG_LINES) cutLogs.splice(0, cutLogs.length - MAX_CUT_LOG_LINES)
  })

  try {
    const result = await window.api.highlightChat.processCuts(
      toPlain({
        sessionId: props.sessionId,
        marginSeconds: props.marginSeconds,
        exportOptions: props.exportOptions
      })
    )
    outputFiles.value = result.outputFiles
  } catch (error: any) {
    cutError.value = error?.message || String(error)
  } finally {
    cutting.value = false
  }
})

onUnmounted(() => {
  unsubscribeCutLogs?.()
})

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

async function openFile(path: string): Promise<void> {
  await window.api.files.openFile(path)
}

async function revealFile(path: string): Promise<void> {
  await window.api.files.revealInFolder(path)
}
</script>

<template>
  <div class="cut-processing-step">
    <h3 v-if="cutting">🎬 Cortando e exportando clipes…</h3>
    <h3 v-else-if="cutError" class="title-danger">⚠️ Falha ao processar</h3>
    <h3 v-else class="title-success">✅ Concluído!</h3>

    <p v-if="cutError" class="hint hint-warning">{{ cutError }}</p>

    <div v-if="cutLogs.length" ref="cutLogsEl" class="file-log">
      <div v-for="(line, index) in cutLogs" :key="index" class="log-line" :class="`log-${line.level}`">
        {{ line.text }}
      </div>
    </div>

    <ul v-if="!cutting && outputFiles.length" class="output-list">
      <li v-for="file in outputFiles" :key="file" class="output-item">
        <span class="file-name" :title="file">{{ fileName(file) }}</span>
        <button class="btn btn-ghost" @click="openFile(file)">Abrir</button>
        <button class="btn btn-ghost" @click="revealFile(file)">Mostrar na pasta</button>
      </li>
    </ul>
    <p v-else-if="!cutting && !cutError" class="hint">Nenhum arquivo foi gerado.</p>
  </div>
</template>

<style scoped>
.cut-processing-step {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 640px;
  margin: 0 auto;
}

.title-success {
  color: var(--success);
}

.title-danger {
  color: var(--warning);
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.hint-warning {
  color: var(--warning);
}

.file-log {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 4%, var(--bg));
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  user-select: text;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-muted);
}

.log-line.log-warn {
  color: var(--warning);
}

.log-line.log-error {
  color: var(--danger);
}

.log-line.log-progress {
  opacity: 0.75;
  font-style: italic;
}

.output-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.output-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--bg);
}

.output-item .file-name {
  flex: 1;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
