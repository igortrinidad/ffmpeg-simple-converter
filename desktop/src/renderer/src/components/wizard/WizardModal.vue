<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { getOperation, operationsForType } from '@shared/operations'
import type {
  AIProviderName,
  ConversionPreset,
  FileKind,
  JobEvent,
  JobLogLine,
  OperationId,
  RetryRequest
} from '@shared/types'
import { useSettings } from '../../composables/useSettings'
import { useClipboard } from '../../composables/useClipboard'
import HighlightChatPanel from './HighlightChatPanel.vue'

const props = defineProps<{
  filePaths: string[]
  fileKind: FileKind
  initialRequest?: RetryRequest | null
}>()

const emit = defineEmits<{
  close: [finished: boolean]
}>()

const CUSTOM_MODEL = '__custom__'

const { state: settings } = useSettings()
const { copiedKey, copy } = useClipboard()

// A conversation is scoped to a single video, so operations that hand off
// into the chat panel don't make sense for a batch run.
const availableOperations = computed(() =>
  operationsForType(props.fileKind).filter((op) => !op.startsHighlightChat || props.filePaths.length === 1)
)
const chatOperationsHiddenForBatch = computed(
  () => props.filePaths.length > 1 && operationsForType(props.fileKind).some((op) => op.startsHighlightChat)
)

const operationId = ref<OperationId | null>(null)
const operation = computed(() => (operationId.value ? getOperation(operationId.value) : null))

const conversionForm = reactive({
  preset: 'medium' as ConversionPreset,
  hwaccel: true
})

const highlightForm = reactive({
  provider: 'anthropic' as AIProviderName,
  modelChoice: '',
  customModel: '',
  prompt: '',
  marginSeconds: 2
})

const selectedProvider = computed(() =>
  settings.aiProviders.find((p) => p.provider === highlightForm.provider)
)

const stepOrder = computed<string[]>(() => {
  const steps = ['operation']
  if (!operation.value) return steps
  if (operation.value.needsConversionOptions || operation.value.needsHighlightOptions || operation.value.startsHighlightChat) {
    steps.push('options')
  }
  steps.push('review', 'progress')
  if (operation.value.startsHighlightChat) steps.push('chat')
  steps.push('done')
  return steps
})

const stepIndex = ref(0)
const currentStep = computed(() => stepOrder.value[stepIndex.value])

const optionsValid = computed(() => {
  if (!operation.value) return false
  if (operation.value.needsConversionOptions) return true
  if (operation.value.needsHighlightOptions) {
    const model = highlightForm.modelChoice === CUSTOM_MODEL ? highlightForm.customModel : highlightForm.modelChoice
    return !!model.trim() && !!highlightForm.prompt.trim() && highlightForm.marginSeconds >= 0
  }
  if (operation.value.startsHighlightChat) {
    const model = highlightForm.modelChoice === CUSTOM_MODEL ? highlightForm.customModel : highlightForm.modelChoice
    return !!model.trim()
  }
  return true
})

const chatModelValue = computed(() =>
  highlightForm.modelChoice === CUSTOM_MODEL ? highlightForm.customModel : highlightForm.modelChoice
)
const chatAiOptions = computed(() => ({ provider: highlightForm.provider, model: chatModelValue.value.trim() }))
const chatJobId = computed(() => progressByFile.get(props.filePaths[0])?.jobId ?? null)
const chatOutputFiles = ref<string[] | null>(null)

function selectOperation(id: OperationId): void {
  operationId.value = id
  const op = getOperation(id)
  if ((op.needsHighlightOptions || op.startsHighlightChat) && settings.aiProviders.length) {
    const firstConfigured = settings.aiProviders.find((p) => p.hasApiKey) ?? settings.aiProviders[0]
    highlightForm.provider = firstConfigured.provider
    highlightForm.modelChoice = firstConfigured.models[0] ?? CUSTOM_MODEL
  }
}

/**
 * Pre-fills the wizard from a history entry being retried, so the file's
 * previous options/prompt aren't lost, and jumps past the "operation" step
 * straight to where the user can review (and still tweak) before running.
 */
function applyInitialRequest(request: RetryRequest): void {
  operationId.value = request.operation

  if (request.conversionOptions) {
    conversionForm.preset = request.conversionOptions.preset
    conversionForm.hwaccel = request.conversionOptions.hwaccel
  }

  if (request.highlightOptions) {
    highlightForm.provider = request.highlightOptions.provider
    highlightForm.prompt = request.highlightOptions.prompt
    highlightForm.marginSeconds = request.highlightOptions.marginSeconds

    const model = request.highlightOptions.model
    const knownModels = settings.aiProviders.find((p) => p.provider === highlightForm.provider)?.models ?? []
    if (knownModels.includes(model)) {
      highlightForm.modelChoice = model
    } else {
      highlightForm.modelChoice = CUSTOM_MODEL
      highlightForm.customModel = model
    }
  }

  const target = operation.value?.needsConversionOptions || operation.value?.needsHighlightOptions
    ? 'options'
    : 'review'
  stepIndex.value = stepOrder.value.indexOf(target)
}

onMounted(() => {
  if (props.initialRequest) applyInitialRequest(props.initialRequest)
})

function goNext(): void {
  if (currentStep.value === 'operation' && !operationId.value) return
  if (currentStep.value === 'options' && !optionsValid.value) return
  if (currentStep.value === 'review') {
    startRun()
  }
  if (stepIndex.value < stepOrder.value.length - 1) {
    stepIndex.value++
  }
}

function goBack(): void {
  if (currentStep.value === 'progress' || currentStep.value === 'done') return
  if (stepIndex.value > 0) stepIndex.value--
}

// --- Run & progress -------------------------------------------------------

const progressByFile = reactive(new Map<string, JobEvent>())
const logsByFile = reactive(new Map<string, JobLogLine[]>())
const running = ref(false)
const overallFailed = ref(false)
let unsubscribe: (() => void) | null = null
let unsubscribeLogs: (() => void) | null = null

// Caps how many lines are kept per file so a long-running conversion doesn't
// grow the log panel (and the reactive array driving it) without bound.
const MAX_LOG_LINES_PER_FILE = 300

const progressList = computed(() =>
  props.filePaths.map((filePath) => progressByFile.get(filePath))
)

const allOutputFiles = computed(() =>
  props.filePaths.flatMap((filePath) => progressByFile.get(filePath)?.outputFiles ?? [])
)

const finalOutputFiles = computed(() => chatOutputFiles.value ?? allOutputFiles.value)

const logContainers: (HTMLElement | null)[] = []
function setLogContainer(index: number, el: Element | null): void {
  logContainers[index] = el as HTMLElement | null
}

const totalLogLines = computed(() =>
  props.filePaths.reduce((sum, filePath) => sum + (logsByFile.get(filePath)?.length ?? 0), 0)
)

// Keeps each file's log panel scrolled to the newest line as it streams in,
// same as watching a terminal.
watch(totalLogLines, async () => {
  await nextTick()
  for (const el of logContainers) {
    if (el) el.scrollTop = el.scrollHeight
  }
})

onMounted(() => {
  unsubscribe = window.api.jobs.onEvent((event) => {
    progressByFile.set(event.filePath, event)
    if (event.status === 'failed') overallFailed.value = true
  })
  unsubscribeLogs = window.api.jobs.onLog((line) => {
    const lines = logsByFile.get(line.filePath) ?? []
    lines.push(line)
    if (lines.length > MAX_LOG_LINES_PER_FILE) lines.splice(0, lines.length - MAX_LOG_LINES_PER_FILE)
    logsByFile.set(line.filePath, lines)
  })
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribeLogs?.()
})

async function startRun(): Promise<void> {
  if (!operationId.value) return
  running.value = true
  overallFailed.value = false
  logsByFile.clear()

  const modelValue =
    highlightForm.modelChoice === CUSTOM_MODEL ? highlightForm.customModel : highlightForm.modelChoice

  try {
    await window.api.jobs.run({
      operation: operationId.value,
      filePaths: props.filePaths,
      conversionOptions: operation.value?.needsConversionOptions
        ? { preset: conversionForm.preset, hwaccel: conversionForm.hwaccel }
        : undefined,
      highlightOptions: operation.value?.needsHighlightOptions
        ? {
            provider: highlightForm.provider,
            model: modelValue.trim(),
            prompt: highlightForm.prompt.trim(),
            marginSeconds: highlightForm.marginSeconds
          }
        : undefined
    })
  } catch (error: any) {
    overallFailed.value = true
  } finally {
    running.value = false
    const nextStep = operation.value?.startsHighlightChat && !overallFailed.value ? 'chat' : 'done'
    stepIndex.value = stepOrder.value.indexOf(nextStep)
  }
}

function onChatFinish(outputFiles: string[]): void {
  chatOutputFiles.value = outputFiles
  stepIndex.value = stepOrder.value.indexOf('done')
}

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

function close(finished: boolean): void {
  emit('close', finished)
}

async function openFile(path: string): Promise<void> {
  await window.api.files.openFile(path)
}

async function revealFile(path: string): Promise<void> {
  await window.api.files.revealInFolder(path)
}
</script>

<template>
  <div class="overlay">
    <div class="modal card">
      <header class="modal-header">
        <h2>Nova operação</h2>
        <button class="btn btn-ghost" @click="close(false)">✕</button>
      </header>

      <!-- Step: operation -->
      <section v-if="currentStep === 'operation'" class="modal-body">
        <p class="step-intro">O que você quer fazer com {{ filePaths.length }} arquivo(s)?</p>
        <p v-if="chatOperationsHiddenForBatch" class="hint">
          A opção "conversar com IA" está disponível apenas ao processar 1 arquivo por vez.
        </p>
        <div class="operation-list">
          <button
            v-for="op in availableOperations"
            :key="op.id"
            class="operation-card"
            :class="{ active: operationId === op.id }"
            @click="selectOperation(op.id)"
          >
            <div class="operation-label">{{ op.label }}</div>
            <div class="operation-description">{{ op.description }}</div>
          </button>
        </div>
      </section>

      <!-- Step: options -->
      <section v-else-if="currentStep === 'options'" class="modal-body">
        <div v-if="operation?.needsConversionOptions" class="field-group">
          <h3>Configurações de conversão</h3>
          <label for="preset">Velocidade (mais rápido = qualidade um pouco menor)</label>
          <select id="preset" v-model="conversionForm.preset">
            <option value="ultrafast">Ultra rápido</option>
            <option value="superfast">Muito rápido</option>
            <option value="veryfast">Rápido</option>
            <option value="faster">Mais rápido que o padrão</option>
            <option value="fast">Rápido (equilibrado)</option>
            <option value="medium">Padrão (equilibrado)</option>
            <option value="slow">Lento (melhor qualidade)</option>
          </select>
          <label class="checkbox-label">
            <input v-model="conversionForm.hwaccel" type="checkbox" />
            Usar aceleração de hardware (GPU), se disponível
          </label>
        </div>

        <div v-if="operation?.needsHighlightOptions" class="field-group">
          <h3>Cortes com IA</h3>

          <label for="provider">Provedor de IA</label>
          <select id="provider" v-model="highlightForm.provider">
            <option v-for="p in settings.aiProviders" :key="p.provider" :value="p.provider">
              {{ p.label }}{{ p.hasApiKey ? '' : ' (sem API key configurada)' }}
            </option>
          </select>

          <label for="model">Modelo</label>
          <select id="model" v-model="highlightForm.modelChoice">
            <option v-for="m in selectedProvider?.models ?? []" :key="m" :value="m">{{ m }}</option>
            <option :value="CUSTOM_MODEL">✏️ Outro (digitar manualmente)</option>
          </select>
          <input
            v-if="highlightForm.modelChoice === CUSTOM_MODEL"
            v-model="highlightForm.customModel"
            type="text"
            placeholder="id do modelo"
          />

          <label for="prompt">O que a IA deve procurar?</label>
          <textarea
            id="prompt"
            v-model="highlightForm.prompt"
            rows="3"
            placeholder='Ex: "os 3 melhores momentos de humor"'
          />

          <label for="margin">Margem antes/depois de cada corte (segundos)</label>
          <input id="margin" v-model.number="highlightForm.marginSeconds" type="number" min="0" step="1" />

          <p v-if="!selectedProvider?.hasApiKey" class="hint hint-warning">
            Esse provedor ainda não tem API key configurada. Configure em ⚙️ Configurações antes de continuar.
          </p>
        </div>

        <div v-if="operation?.startsHighlightChat" class="field-group">
          <h3>Conversar com IA</h3>

          <label for="chat-provider">Provedor de IA</label>
          <select id="chat-provider" v-model="highlightForm.provider">
            <option v-for="p in settings.aiProviders" :key="p.provider" :value="p.provider">
              {{ p.label }}{{ p.hasApiKey ? '' : ' (sem API key configurada)' }}
            </option>
          </select>

          <label for="chat-model">Modelo</label>
          <select id="chat-model" v-model="highlightForm.modelChoice">
            <option v-for="m in selectedProvider?.models ?? []" :key="m" :value="m">{{ m }}</option>
            <option :value="CUSTOM_MODEL">✏️ Outro (digitar manualmente)</option>
          </select>
          <input
            v-if="highlightForm.modelChoice === CUSTOM_MODEL"
            v-model="highlightForm.customModel"
            type="text"
            placeholder="id do modelo"
          />

          <p v-if="!selectedProvider?.hasApiKey" class="hint hint-warning">
            Esse provedor ainda não tem API key configurada. Configure em ⚙️ Configurações antes de continuar.
          </p>
        </div>
      </section>

      <!-- Step: review -->
      <section v-else-if="currentStep === 'review'" class="modal-body">
        <h3>Revisar</h3>
        <dl class="review-list">
          <dt>Operação</dt>
          <dd>{{ operation?.label }}</dd>
          <dt>Arquivos</dt>
          <dd>{{ filePaths.length }} arquivo(s)</dd>
          <template v-if="operation?.needsConversionOptions">
            <dt>Velocidade</dt>
            <dd>{{ conversionForm.preset }} · GPU: {{ conversionForm.hwaccel ? 'sim' : 'não' }}</dd>
          </template>
          <template v-if="operation?.needsHighlightOptions">
            <dt>IA</dt>
            <dd>{{ highlightForm.provider }} · {{ highlightForm.modelChoice === CUSTOM_MODEL ? highlightForm.customModel : highlightForm.modelChoice }}</dd>
            <dt>Margem</dt>
            <dd>{{ highlightForm.marginSeconds }}s antes/depois</dd>
          </template>
          <template v-if="operation?.startsHighlightChat">
            <dt>IA</dt>
            <dd>{{ highlightForm.provider }} · {{ highlightForm.modelChoice === CUSTOM_MODEL ? highlightForm.customModel : highlightForm.modelChoice }}</dd>
          </template>
        </dl>
      </section>

      <!-- Step: progress -->
      <section v-else-if="currentStep === 'progress'" class="modal-body">
        <h3>Processando…</h3>
        <div v-for="(event, index) in progressList" :key="filePaths[index]" class="file-progress">
          <div class="file-progress-name">{{ fileName(filePaths[index]) }}</div>
          <ul class="step-checklist">
            <li v-for="step in event?.steps ?? []" :key="step.name">
              <span>{{ stepIcon(step.status) }}</span> {{ step.name }}
              <template v-if="step.error">
                <span class="step-error">— {{ step.error }}</span>
                <button
                  class="btn btn-ghost btn-copy"
                  type="button"
                  title="Copiar erro"
                  @click="copy(`${filePaths[index]}:${step.name}`, step.error)"
                >
                  {{ copiedKey === `${filePaths[index]}:${step.name}` ? '✓ Copiado' : '📋 Copiar' }}
                </button>
              </template>
            </li>
          </ul>

          <div
            v-if="logsByFile.get(filePaths[index])?.length"
            class="file-log"
            :ref="(el) => setLogContainer(index, el as Element | null)"
          >
            <div
              v-for="(line, li) in logsByFile.get(filePaths[index])"
              :key="li"
              class="log-line"
              :class="`log-${line.level}`"
            >
              {{ line.text }}
            </div>
          </div>
        </div>
      </section>

      <!-- Step: chat -->
      <section v-else-if="currentStep === 'chat'" class="modal-body">
        <h3>Conversar com a IA</h3>
        <HighlightChatPanel
          v-if="chatJobId"
          :job-id="chatJobId"
          :file-path="filePaths[0]"
          :ai-options="chatAiOptions"
          @finish="onChatFinish"
        />
      </section>

      <!-- Step: done -->
      <section v-else-if="currentStep === 'done'" class="modal-body">
        <h3 :class="overallFailed ? 'title-danger' : 'title-success'">
          {{ overallFailed ? '⚠️ Concluído com erros' : '✅ Concluído!' }}
        </h3>

        <ul v-if="finalOutputFiles.length" class="output-list">
          <li v-for="file in finalOutputFiles" :key="file" class="output-item">
            <span class="file-name" :title="file">{{ fileName(file) }}</span>
            <button class="btn btn-ghost" @click="openFile(file)">Abrir</button>
            <button class="btn btn-ghost" @click="revealFile(file)">Mostrar na pasta</button>
          </li>
        </ul>
        <p v-else class="hint">Nenhum arquivo foi gerado.</p>
      </section>

      <footer class="modal-footer">
        <button
          v-if="currentStep !== 'progress' && currentStep !== 'chat' && currentStep !== 'done' && stepIndex > 0"
          class="btn"
          @click="goBack"
        >
          ← Voltar
        </button>
        <div class="spacer" />
        <button v-if="currentStep === 'done'" class="btn btn-primary" @click="close(true)">
          Concluir
        </button>
        <button
          v-else-if="currentStep !== 'progress' && currentStep !== 'chat'"
          class="btn btn-primary"
          :disabled="
            (currentStep === 'operation' && !operationId) ||
            (currentStep === 'options' && !optionsValid)
          "
          @click="goNext"
        >
          {{ currentStep === 'review' ? 'Iniciar' : 'Avançar →' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.modal {
  width: 560px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 16px;
  margin: 0;
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.step-intro {
  color: var(--text-muted);
  font-size: 13px;
  margin-top: 0;
}

.operation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.operation-card {
  text-align: left;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  border-radius: 10px;
  padding: 12px 14px;
}

.operation-card.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg));
}

.operation-label {
  font-weight: 600;
  font-size: 13px;
}

.operation-description {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 2px;
}

.field-group {
  margin-bottom: 20px;
}

.field-group h3 {
  font-size: 13px;
  margin: 0 0 10px;
}

.field-group > * + * {
  margin-top: 10px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.checkbox-label input {
  width: auto;
}

.review-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  font-size: 13px;
  margin: 0;
}

.review-list dt {
  color: var(--text-muted);
  font-weight: 600;
}

.review-list dd {
  margin: 0;
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
  /* Errors need to stay selectable/copyable for debugging, unlike the rest of the app's UI chrome. */
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
  /* This is effectively a mirrored terminal — needs to stay selectable/copyable for debugging. */
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

.modal-footer {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.spacer {
  flex: 1;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
}

.hint-warning {
  color: var(--warning);
}
</style>
