<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

// Rendered in its own frameless always-on-top window, so it can't read the
// recorder's state directly — the flags come in through the URL and the timer
// runs locally, mirroring what the main window is doing.
const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
const micEnabled = params.get('mic') === '1'
const systemEnabled = params.get('sys') === '1'

const paused = ref(false)
const elapsedSeconds = ref(0)
const confirmingCancel = ref(false)
let timerHandle: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timerHandle = setInterval(() => {
    if (!paused.value) elapsedSeconds.value++
  }, 1000)
})

const formattedTime = computed(() => {
  const total = elapsedSeconds.value
  const pad = (value: number): string => value.toString().padStart(2, '0')
  return total >= 3600
    ? `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
    : `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
})

function togglePause(): void {
  paused.value = !paused.value
  window.api.meetings.sendControlAction(paused.value ? 'pause' : 'resume')
}

function stop(): void {
  if (timerHandle) clearInterval(timerHandle)
  window.api.meetings.sendControlAction('stop')
}

function confirmCancel(): void {
  if (timerHandle) clearInterval(timerHandle)
  window.api.meetings.sendControlAction('cancel')
}
</script>

<template>
  <div class="control-bar">
    <template v-if="!confirmingCancel">
      <span class="rec-dot" :class="{ paused }" />
      <span class="timer">{{ formattedTime }}</span>
      <span
        class="device-icon"
        :class="micEnabled ? 'device-on' : 'device-off'"
        :title="micEnabled ? 'Microfone ativado' : 'Microfone desativado'"
      >
        🎤
      </span>
      <span
        class="device-icon"
        :class="systemEnabled ? 'device-on' : 'device-off'"
        :title="systemEnabled ? 'Som do sistema ativado' : 'Som do sistema desativado'"
      >
        🔊
      </span>
      <button class="ctrl-btn" type="button" :title="paused ? 'Retomar' : 'Pausar'" @click="togglePause">
        {{ paused ? '▶' : '⏸' }}
      </button>
      <button class="ctrl-btn stop-btn" type="button" title="Encerrar e gerar ata" @click="stop">■</button>
      <button class="ctrl-btn cancel-btn" type="button" title="Descartar gravação" @click="confirmingCancel = true">
        ✕
      </button>
    </template>
    <template v-else>
      <span class="confirm-text">Descartar gravação?</span>
      <button class="ctrl-btn confirm-yes-btn" type="button" title="Sim, descartar" @click="confirmCancel">✓</button>
      <button class="ctrl-btn" type="button" title="Voltar" @click="confirmingCancel = false">✕</button>
    </template>
  </div>
</template>

<style scoped>
.control-bar {
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 100%;
  padding: 0 14px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  border: 1px solid var(--border);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
}

.rec-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--danger);
  animation: pulse 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

.rec-dot.paused {
  animation: none;
  opacity: 0.5;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.timer {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 13px;
  flex: 1;
}

.device-icon {
  -webkit-app-region: no-drag;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
}

.device-icon.device-on {
  background: color-mix(in srgb, var(--success) 22%, transparent);
  box-shadow: 0 0 0 1px var(--success) inset;
}

.device-icon.device-off {
  background: color-mix(in srgb, var(--danger) 22%, transparent);
  box-shadow: 0 0 0 1px var(--danger) inset;
  opacity: 0.55;
  filter: grayscale(1);
}

.ctrl-btn {
  -webkit-app-region: no-drag;
  border: none;
  background: var(--bg);
  color: var(--text);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stop-btn {
  color: var(--danger);
}

.cancel-btn {
  color: var(--text-muted);
  font-size: 11px;
}

.cancel-btn:hover {
  color: var(--danger);
}

.confirm-text {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--danger);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.confirm-yes-btn {
  background: var(--danger);
  color: white;
}
</style>
