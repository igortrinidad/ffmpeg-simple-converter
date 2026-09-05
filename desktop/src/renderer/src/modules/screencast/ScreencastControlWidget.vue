<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const hashQuery = window.location.hash.split('?')[1] || ''
const params = new URLSearchParams(hashQuery)
const micEnabled = params.get('mic') === '1'
const cameraEnabled = params.get('cam') === '1'

const paused = ref(false)
const elapsedSeconds = ref(0)
let timerHandle: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timerHandle = setInterval(() => {
    if (!paused.value) elapsedSeconds.value++
  }, 1000)
})

const formattedTime = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (elapsedSeconds.value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
})

function togglePause(): void {
  paused.value = !paused.value
  window.api.screencast.sendControlAction(paused.value ? 'pause' : 'resume')
}

function stop(): void {
  if (timerHandle) clearInterval(timerHandle)
  window.api.screencast.sendControlAction('stop')
}
</script>

<template>
  <div class="control-bar">
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
      :class="cameraEnabled ? 'device-on' : 'device-off'"
      :title="cameraEnabled ? 'Câmera ativada' : 'Câmera desativada'"
    >
      📷
    </span>
    <button class="ctrl-btn" type="button" :title="paused ? 'Retomar' : 'Pausar'" @click="togglePause">
      {{ paused ? '▶' : '⏸' }}
    </button>
    <button class="ctrl-btn stop-btn" type="button" title="Parar" @click="stop">■</button>
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
</style>
