<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { CameraBubbleOptions } from '@shared/types'
import { drawCameraBubble } from '../composables/cameraBubble'

const props = defineProps<{
  /** Thumbnail of the screen/window being recorded, painted as the preview backdrop. */
  sourceThumbnail?: string | null
  cameraDeviceId: string
  bubble: CameraBubbleOptions
  /** Holds the camera stream open only while the preview is actually on screen. */
  active: boolean
}>()

// Preview resolution. Everything the bubble draws (size, margin, border) scales
// off the frame height, so a small canvas shows the same proportions the real
// recording will have.
const PREVIEW_HEIGHT = 360
const DEFAULT_ASPECT = 16 / 9

const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref('')
const cameraReady = ref(false)

let stream: MediaStream | null = null
let video: HTMLVideoElement | null = null
let backdrop: HTMLImageElement | null = null
let rafHandle: number | null = null

function paint(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  const aspect = backdrop?.naturalWidth ? backdrop.naturalWidth / backdrop.naturalHeight : DEFAULT_ASPECT
  const width = Math.round(PREVIEW_HEIGHT * aspect)
  if (canvas.width !== width || canvas.height !== PREVIEW_HEIGHT) {
    canvas.width = width
    canvas.height = PREVIEW_HEIGHT
  }

  ctx.fillStyle = '#0b0f19'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (backdrop?.naturalWidth) {
    ctx.drawImage(backdrop, 0, 0, canvas.width, canvas.height)
  }

  if (video && video.videoWidth > 0) {
    drawCameraBubble(ctx, canvas.width, canvas.height, video, video.videoWidth, video.videoHeight, props.bubble)
  }
}

function loop(): void {
  paint()
  rafHandle = requestAnimationFrame(loop)
}

async function startCamera(): Promise<void> {
  stopCamera()
  error.value = ''
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: props.cameraDeviceId ? { deviceId: props.cameraDeviceId } : true
    })
    video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()
    cameraReady.value = true
  } catch (err: any) {
    error.value = err?.message || 'Não foi possível abrir a câmera para a pré-visualização'
  }
}

function stopCamera(): void {
  stream?.getTracks().forEach((track) => track.stop())
  stream = null
  video = null
  cameraReady.value = false
}

function stopLoop(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
}

watch(
  () => [props.active, props.cameraDeviceId] as const,
  ([active]) => {
    if (active) {
      void startCamera()
      if (rafHandle === null) loop()
    } else {
      stopLoop()
      stopCamera()
    }
  },
  { immediate: true }
)

watch(
  () => props.sourceThumbnail,
  (thumbnail) => {
    if (!thumbnail) {
      backdrop = null
      return
    }
    const image = new Image()
    image.onload = () => {
      backdrop = image
    }
    image.src = thumbnail
  },
  { immediate: true }
)

// The bubble options are the whole point of this preview, but the rAF loop
// already repaints every frame — no watcher needed for them.

onBeforeUnmount(() => {
  stopLoop()
  stopCamera()
})
</script>

<template>
  <div class="bubble-preview">
    <canvas ref="canvasRef" class="preview-canvas" />
    <p v-if="error" class="preview-error">{{ error }}</p>
    <p v-else-if="!cameraReady" class="preview-hint">Abrindo a câmera…</p>
    <p v-else class="preview-hint">Pré-visualização ao vivo — é assim que a gravação vai ficar.</p>
  </div>
</template>

<style scoped>
.bubble-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-canvas {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  display: block;
}

.preview-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

.preview-error {
  margin: 0;
  font-size: 11px;
  color: var(--danger);
  text-align: center;
}
</style>
