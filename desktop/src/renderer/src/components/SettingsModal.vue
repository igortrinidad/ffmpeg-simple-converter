<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useSettings } from '../composables/useSettings'

const emit = defineEmits<{
  close: []
}>()

const { state: settings, load, save } = useSettings()

type ApiKeyField = 'groqApiKey' | 'openaiApiKey' | 'anthropicApiKey' | 'geminiApiKey' | 'openrouterApiKey'

interface KeyFieldMeta {
  key: ApiKeyField
  label: string
  placeholder: string
}

const transcriptionFields: KeyFieldMeta[] = [
  { key: 'groqApiKey', label: 'Groq API Key', placeholder: 'gsk_...' },
  { key: 'openaiApiKey', label: 'OpenAI API Key', placeholder: 'sk-...' }
]

const highlightFields: KeyFieldMeta[] = [
  { key: 'anthropicApiKey', label: 'Anthropic API Key', placeholder: 'sk-ant-...' },
  { key: 'geminiApiKey', label: 'Google Gemini API Key', placeholder: 'AIza...' },
  { key: 'openrouterApiKey', label: 'OpenRouter API Key', placeholder: 'sk-or-...' }
]

// Never holds the real stored secret — only whether one is already set,
// and whatever new value the user is currently typing (if replacing it).
const fields = reactive<Record<ApiKeyField, { value: string; configured: boolean; cleared: boolean }>>({
  groqApiKey: { value: '', configured: false, cleared: false },
  openaiApiKey: { value: '', configured: false, cleared: false },
  anthropicApiKey: { value: '', configured: false, cleared: false },
  geminiApiKey: { value: '', configured: false, cleared: false },
  openrouterApiKey: { value: '', configured: false, cleared: false }
})

const defaultOutputDir = ref('')
const saving = ref(false)

onMounted(async () => {
  await load()
  for (const key of Object.keys(fields) as ApiKeyField[]) {
    fields[key].configured = !!settings.config[key]
  }
  defaultOutputDir.value = settings.config.defaultOutputDir ?? ''
})

function toggleClear(key: ApiKeyField): void {
  fields[key].cleared = !fields[key].cleared
  if (fields[key].cleared) fields[key].value = ''
}

async function pickOutputDir(): Promise<void> {
  const dir = await window.api.files.pickDirectory()
  if (dir) defaultOutputDir.value = dir
}

async function onSave(): Promise<void> {
  saving.value = true
  try {
    const payload: Record<string, string> = {}

    for (const [key, field] of Object.entries(fields) as [ApiKeyField, (typeof fields)[ApiKeyField]][]) {
      if (field.cleared) {
        payload[key] = ''
      } else if (field.value.trim()) {
        payload[key] = field.value.trim()
      }
      // Otherwise: leave untouched, keeping whatever is already stored.
    }

    payload.defaultOutputDir = defaultOutputDir.value.trim()

    await save(payload)
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="overlay">
    <div class="modal card">
      <header class="modal-header">
        <h2>Configurações</h2>
        <button class="btn btn-ghost" @click="emit('close')">✕</button>
      </header>

      <section class="modal-body">
        <div class="field-group">
          <h3>Transcrição</h3>
          <div v-for="field in transcriptionFields" :key="field.key" class="key-field">
            <div class="key-field-header">
              <label :for="field.key">{{ field.label }}</label>
              <span v-if="fields[field.key].cleared" class="badge badge-cleared">será removida</span>
              <span v-else-if="fields[field.key].configured" class="badge badge-ok">✓ configurada</span>
            </div>
            <div class="key-field-row">
              <input
                :id="field.key"
                v-model="fields[field.key].value"
                type="password"
                :disabled="fields[field.key].cleared"
                :placeholder="fields[field.key].configured ? 'deixe em branco para manter a atual' : field.placeholder"
              />
              <button v-if="fields[field.key].configured" class="btn btn-ghost" type="button" @click="toggleClear(field.key)">
                {{ fields[field.key].cleared ? 'Desfazer' : 'Remover' }}
              </button>
            </div>
          </div>
        </div>

        <div class="field-group">
          <h3>IA de destaques (highlights)</h3>
          <div v-for="field in highlightFields" :key="field.key" class="key-field">
            <div class="key-field-header">
              <label :for="field.key">{{ field.label }}</label>
              <span v-if="fields[field.key].cleared" class="badge badge-cleared">será removida</span>
              <span v-else-if="fields[field.key].configured" class="badge badge-ok">✓ configurada</span>
            </div>
            <div class="key-field-row">
              <input
                :id="field.key"
                v-model="fields[field.key].value"
                type="password"
                :disabled="fields[field.key].cleared"
                :placeholder="fields[field.key].configured ? 'deixe em branco para manter a atual' : field.placeholder"
              />
              <button v-if="fields[field.key].configured" class="btn btn-ghost" type="button" @click="toggleClear(field.key)">
                {{ fields[field.key].cleared ? 'Desfazer' : 'Remover' }}
              </button>
            </div>
          </div>
          <p class="hint">Groq e OpenAI acima também podem ser usados para escolher os destaques.</p>
        </div>

        <div class="field-group">
          <h3>Geral</h3>
          <label for="outputDir">Pasta de saída padrão (opcional)</label>
          <div class="output-dir-row">
            <input id="outputDir" v-model="defaultOutputDir" type="text" placeholder="Mesma pasta do arquivo original" />
            <button class="btn" type="button" @click="pickOutputDir">Escolher…</button>
          </div>
        </div>
      </section>

      <footer class="modal-footer">
        <div class="spacer" />
        <button class="btn" @click="emit('close')">Cancelar</button>
        <button class="btn btn-primary" :disabled="saving" @click="onSave">Salvar</button>
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
  width: 520px;
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

.field-group {
  margin-bottom: 20px;
}

.field-group h3 {
  font-size: 13px;
  margin: 0 0 10px;
}

.key-field + .key-field {
  margin-top: 14px;
}

.key-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.key-field-header label {
  margin-bottom: 0;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.badge-ok {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 15%, transparent);
}

.badge-cleared {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 15%, transparent);
}

.key-field-row {
  display: flex;
  gap: 8px;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 10px;
}

.output-dir-row {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}

.spacer {
  flex: 1;
}
</style>
