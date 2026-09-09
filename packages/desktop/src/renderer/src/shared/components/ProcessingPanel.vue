<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { JobEvent, JobLogLine, JobRequest } from '@shared/types'
import { useClipboard } from '../../composables/useClipboard'
import { toPlain } from '../toPlain'

const props = defineProps<{
  request: JobRequest
}>()

const emit = defineEmits<{
  finished: [outputFiles: string[], success: boolean]
  /** Emitted once a JobEvent for the (single) requested file arrives — lets single-file callers (e.g. Chat's transcribe step) pick up the job id without re-deriving it. */
  jobId: [jobId: string]
}>()

const { copiedKey, copy } = useClipboard()

const progressByFile = reactive(new Map<string, JobEvent>())
const logsByFile = reactive(new Map<string, JobLogLine[]>())
const running = ref(true)
const overallFailed = ref(false)
const finished = ref(false)

// Caps how many lines are kept per file so a long-running conversion doesn't
// grow the log panel (and the reactive array driving it) without bound.
const MAX_LOG_LINES_PER_FILE = 300

const progressList = computed(() => props.request.filePaths.map((filePath) => progressByFile.get(filePath)))
const allOutputFiles = computed(() =>
  props.request.filePaths.flatMap((filePath) => progressByFile.get(filePath)?.outputFiles ?? [])
)

const logContainers: (HTMLElement | null)[] = []
function setLogContainer(index: number, el: Element | null): void {
  logContainers[index] = el as HTMLElement | null
}

const totalLogLines = computed(() =>
  props.request.filePaths.reduce((sum, filePath) => sum + (logsByFile.get(filePath)?.length ?? 0), 0)
)

watch(totalLogLines, async () => {
  await nextTick()
  for (const el of logContainers) {
    if (el) el.scrollTop = el.scrollHeight
  }
})

let unsubscribe: (() => void) | null = null
let unsubscribeLogs: (() => void) | null = null
let emittedJobId = false

onMounted(async () => {
  unsubscribe = window.api.jobs.onEvent((event) => {
    if (!props.request.filePaths.includes(event.filePath)) return
    progressByFile.set(event.filePath, event)
    if (event.status === 'failed') overallFailed.value = true
    if (!emittedJobId && props.request.filePaths.length === 1) {
      emittedJobId = true
      emit('jobId', event.jobId)
    }
  })
  unsubscribeLogs = window.api.jobs.onLog((line) => {
    if (!props.request.filePaths.includes(line.filePath)) return
    const lines = logsByFile.get(line.filePath) ?? []
    lines.push(line)
    if (lines.length > MAX_LOG_LINES_PER_FILE) lines.splice(0, lines.length - MAX_LOG_LINES_PER_FILE)
    logsByFile.set(line.filePath, lines)
  })

  try {
    await window.api.jobs.run(toPlain(props.request))
  } catch {
    overallFailed.value = true
  } finally {
    running.value = false
    finished.value = true
    emit('finished', allOutputFiles.value, !overallFailed.value)
  }
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeLogs?.()
})

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path
}

function stepIcon(status: string): string {
  if (status === 'completed') return '✅'
  if (status === 'failed') return '❌'
  if (status === 'running') return '⏳'
  if (status === 'skipped') return '⏭️'
  return '⚪'
}

async function openFile(path: string): Promise<void> {
  await window.api.files.openFile(path)
}

async function revealFile(path: string): Promise<void> {
  await window.api.files.revealInFolder(path)
}
</script>

<template>
  <div class="processing-panel">
    <template v-if="running">
      <h3>Processando…</h3>
      <div v-for="(event, index) in progressList" :key="request.filePaths[index]" class="file-progress">
        <div class="file-progress-name">{{ fileName(request.filePaths[index]) }}</div>
        <ul class="step-checklist">
          <li v-for="step in event?.steps ?? []" :key="step.name">
            <span>{{ stepIcon(step.status) }}</span> {{ step.name }}
            <template v-if="step.error">
              <span class="step-error">— {{ step.error }}</span>
              <button
                class="btn btn-ghost btn-copy"
                type="button"
                title="Copiar erro"
                @click="copy(`${request.filePaths[index]}:${step.name}`, step.error)"
              >
                {{ copiedKey === `${request.filePaths[index]}:${step.name}` ? '✓ Copiado' : '📋 Copiar' }}
              </button>
            </template>
          </li>
        </ul>

        <div
          v-if="logsByFile.get(request.filePaths[index])?.length"
          class="file-log"
          :ref="(el) => setLogContainer(index, el as Element | null)"
        >
          <div
            v-for="(line, li) in logsByFile.get(request.filePaths[index])"
            :key="li"
            class="log-line"
            :class="`log-${line.level}`"
          >
            {{ line.text }}
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="finished">
      <h3 :class="overallFailed ? 'title-danger' : 'title-success'">
        {{ overallFailed ? '⚠️ Concluído com erros' : '✅ Concluído!' }}
      </h3>

      <ul v-if="allOutputFiles.length" class="output-list">
        <li v-for="file in allOutputFiles" :key="file" class="output-item">
          <span class="file-name" :title="file">{{ fileName(file) }}</span>
          <button class="btn btn-ghost" @click="openFile(file)">Abrir</button>
          <button class="btn btn-ghost" @click="revealFile(file)">Mostrar na pasta</button>
        </li>
      </ul>
      <p v-else class="hint">Nenhum arquivo foi gerado.</p>
    </template>
  </div>
</template>

<style scoped>
.processing-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.file-progress {
  margin-bottom: 16px;
}

.file-progress-name {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
}

.step-checklist {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-error {
  color: var(--danger);
  user-select: text;
}

.btn-copy {
  font-size: 11px;
  padding: 1px 6px;
  margin-left: 4px;
}

.file-log {
  margin-top: 8px;
  max-height: 140px;
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

.title-success {
  color: var(--success);
}

.title-danger {
  color: var(--warning);
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

.hint {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
