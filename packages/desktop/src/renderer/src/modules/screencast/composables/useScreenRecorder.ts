import { reactive, readonly } from 'vue'
import type { CameraBubbleOptions, ScreenSource } from '@shared/types'
import { DEFAULT_CAMERA_BUBBLE, drawCameraBubble } from './cameraBubble'

export interface RecordingDeviceOption {
  deviceId: string
  label: string
}

export interface StartRecordingOptions {
  sourceId: string
  cameraDeviceId?: string
  micDeviceId?: string
  cameraBubble?: CameraBubbleOptions
}

type RecorderPhase = 'idle' | 'recording' | 'paused' | 'converting'

const state = reactive({
  phase: 'idle' as RecorderPhase,
  elapsedSeconds: 0,
  // Set when a recording finishes saving — the flow watches this so it can
  // advance to processing even when stop is triggered from the floating
  // control window (which bypasses ScreencastFlow.stopRecording).
  rawFilePath: null as string | null
})

let screenStream: MediaStream | null = null
let cameraStream: MediaStream | null = null
let micStream: MediaStream | null = null
let canvasStream: MediaStream | null = null
let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let rafHandle: number | null = null
let timerHandle: ReturnType<typeof setInterval> | null = null
let unsubscribeControlAction: (() => void) | null = null
let resolveStop: ((rawFilePath: string) => void) | null = null

async function listScreenSources(): Promise<ScreenSource[]> {
  return window.api.screencast.listSources()
}

async function listMediaDevices(): Promise<{ cameras: RecordingDeviceOption[]; mics: RecordingDeviceOption[] }> {
  // Labels are blank until permission has been granted at least once —
  // request a throwaway stream first so the picker shows real device names.
  try {
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    probe.getTracks().forEach((track) => track.stop())
  } catch {
    // User may deny one or both — device lists still work, just unlabeled.
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  const cameras = devices
    .filter((d) => d.kind === 'videoinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Câmera' }))
  const mics = devices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microfone' }))

  return { cameras, mics }
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  screenVideo: HTMLVideoElement,
  cameraVideo: HTMLVideoElement | null,
  bubble: CameraBubbleOptions
): void {
  ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height)

  if (cameraVideo) {
    drawCameraBubble(
      ctx,
      canvas.width,
      canvas.height,
      cameraVideo,
      cameraVideo.videoWidth,
      cameraVideo.videoHeight,
      bubble
    )
  }
}

async function startRecording(options: StartRecordingOptions): Promise<void> {
  screenStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      // @ts-expect-error Electron-specific desktopCapturer constraints, not in the standard lib.dom types.
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: options.sourceId
      }
    }
  })

  cameraStream = options.cameraDeviceId
    ? await navigator.mediaDevices.getUserMedia({ video: { deviceId: options.cameraDeviceId } })
    : null

  micStream = options.micDeviceId
    ? await navigator.mediaDevices.getUserMedia({ audio: { deviceId: options.micDeviceId } })
    : null

  const screenVideo = document.createElement('video')
  screenVideo.srcObject = screenStream
  screenVideo.muted = true
  await screenVideo.play()

  let cameraVideo: HTMLVideoElement | null = null
  if (cameraStream) {
    cameraVideo = document.createElement('video')
    cameraVideo.srcObject = cameraStream
    cameraVideo.muted = true
    await cameraVideo.play()
  }

  const canvas = document.createElement('canvas')
  canvas.width = screenVideo.videoWidth
  canvas.height = screenVideo.videoHeight
  const ctx = canvas.getContext('2d')!
  const bubble = options.cameraBubble ?? DEFAULT_CAMERA_BUBBLE

  const loop = (): void => {
    drawFrame(ctx, canvas, screenVideo, cameraVideo, bubble)
    rafHandle = requestAnimationFrame(loop)
  }
  loop()

  canvasStream = canvas.captureStream(30)
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]
  if (micStream) tracks.push(...micStream.getAudioTracks())

  const combinedStream = new MediaStream(tracks)
  mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9,opus' })
  chunks = []
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  mediaRecorder.start()
  state.phase = 'recording'
  state.elapsedSeconds = 0
  timerHandle = setInterval(() => {
    if (state.phase === 'recording') state.elapsedSeconds++
  }, 1000)

  unsubscribeControlAction = window.api.screencast.onControlAction((action) => {
    if (action === 'pause') pause()
    else if (action === 'resume') resume()
    else if (action === 'stop') void stop()
    else if (action === 'cancel') void cancel()
  })

  await window.api.screencast.openControlWindow({
    micEnabled: !!micStream,
    cameraEnabled: !!cameraStream
  })
}

function pause(): void {
  if (mediaRecorder?.state !== 'recording') return
  mediaRecorder.pause()
  state.phase = 'paused'
}

function resume(): void {
  if (mediaRecorder?.state !== 'paused') return
  mediaRecorder.resume()
  state.phase = 'recording'
}

async function stop(): Promise<string> {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    throw new Error('Nenhuma gravação em andamento')
  }

  const rawFilePath = await new Promise<string>((resolve) => {
    resolveStop = resolve
    mediaRecorder!.onstop = async () => {
      cleanupStreams()

      const blob = new Blob(chunks, { type: 'video/webm' })
      const arrayBuffer = await blob.arrayBuffer()
      const filePath = await window.api.screencast.saveRawRecording(arrayBuffer)
      resolveStop?.(filePath)
      resolveStop = null
    }
    mediaRecorder!.stop()
  })

  state.rawFilePath = rawFilePath
  state.phase = 'converting'
  await window.api.screencast.closeControlWindow()
  return rawFilePath
}

/** Stops recording and discards everything captured so far — no save, no processing. */
async function cancel(): Promise<void> {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    await new Promise<void>((resolve) => {
      mediaRecorder!.onstop = () => resolve()
      mediaRecorder!.stop()
    })
  }
  chunks = []
  cleanupStreams()
  reset()
  await window.api.screencast.closeControlWindow()
}

function cleanupStreams(): void {
  if (rafHandle !== null) {
    cancelAnimationFrame(rafHandle)
    rafHandle = null
  }
  if (timerHandle !== null) {
    clearInterval(timerHandle)
    timerHandle = null
  }
  unsubscribeControlAction?.()
  unsubscribeControlAction = null

  for (const stream of [screenStream, cameraStream, micStream, canvasStream]) {
    stream?.getTracks().forEach((track) => track.stop())
  }
  screenStream = null
  cameraStream = null
  micStream = null
  canvasStream = null
  mediaRecorder = null
}

function reset(): void {
  state.phase = 'idle'
  state.elapsedSeconds = 0
  state.rawFilePath = null
}

export function useScreenRecorder() {
  return {
    state: readonly(state),
    listScreenSources,
    listMediaDevices,
    startRecording,
    pause,
    resume,
    stop,
    cancel,
    reset
  }
}
