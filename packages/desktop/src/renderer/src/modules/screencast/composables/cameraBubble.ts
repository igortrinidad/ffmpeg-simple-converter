import type { CameraBubbleOptions, CameraBubbleShape } from '@shared/types'

export const DEFAULT_CAMERA_BUBBLE: CameraBubbleOptions = {
  corner: 'bottom-left',
  shape: 'circle',
  sizeRatio: 0.15,
  borderWidth: 3,
  borderColor: '#ffffff'
}

/**
 * Border width and margin are authored in pixels at this frame height, then
 * scaled to whatever the real canvas is — so a 4K capture doesn't end up with
 * a hairline border, and the setup preview (a few hundred pixels tall) shows
 * the same proportions the recording will have.
 */
const REFERENCE_FRAME_HEIGHT = 1080
const MARGIN_AT_REFERENCE = 24

/** Tailwind palette swatches offered as one-click border colors. */
export const BORDER_COLOR_PRESETS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'Branco' },
  { value: '#0f172a', label: 'Slate 900' },
  { value: '#94a3b8', label: 'Slate 400' },
  { value: '#ef4444', label: 'Red 500' },
  { value: '#f97316', label: 'Orange 500' },
  { value: '#fbbf24', label: 'Amber 400' },
  { value: '#84cc16', label: 'Lime 500' },
  { value: '#10b981', label: 'Emerald 500' },
  { value: '#0ea5e9', label: 'Sky 500' },
  { value: '#2563eb', label: 'Blue 600' },
  { value: '#8b5cf6', label: 'Violet 500' },
  { value: '#ec4899', label: 'Pink 500' }
]

function traceBubblePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: CameraBubbleShape
): void {
  ctx.beginPath()
  if (shape === 'circle') {
    const r = size / 2
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2)
  } else if (shape === 'rounded') {
    const r = size * 0.18
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + size - r, y)
    ctx.arcTo(x + size, y, x + size, y + r, r)
    ctx.lineTo(x + size, y + size - r)
    ctx.arcTo(x + size, y + size, x + size - r, y + size, r)
    ctx.lineTo(x + r, y + size)
    ctx.arcTo(x, y + size, x, y + size - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  } else {
    ctx.rect(x, y, size, size)
  }
}

function bubbleOrigin(
  frameWidth: number,
  frameHeight: number,
  size: number,
  margin: number,
  corner: CameraBubbleOptions['corner']
): { x: number; y: number } {
  const left = margin
  const top = margin
  const right = frameWidth - margin - size
  const bottom = frameHeight - margin - size

  switch (corner) {
    case 'top-left':
      return { x: left, y: top }
    case 'top-right':
      return { x: right, y: top }
    case 'bottom-right':
      return { x: right, y: bottom }
    case 'bottom-left':
    default:
      return { x: left, y: bottom }
  }
}

/**
 * Draws the camera bubble (center-cropped to a square, clipped to the chosen
 * shape, optionally stroked) over an already-painted frame. Shared by the
 * recorder's compositing loop and the setup step's live preview so what the
 * user configures is exactly what gets recorded.
 */
export function drawCameraBubble(
  ctx: CanvasRenderingContext2D,
  frameWidth: number,
  frameHeight: number,
  camera: CanvasImageSource,
  cameraWidth: number,
  cameraHeight: number,
  bubble: CameraBubbleOptions
): void {
  const scale = frameHeight / REFERENCE_FRAME_HEIGHT
  const size = Math.min(frameWidth, frameHeight) * bubble.sizeRatio
  const { x, y } = bubbleOrigin(frameWidth, frameHeight, size, MARGIN_AT_REFERENCE * scale, bubble.corner)

  const videoW = cameraWidth || 1
  const videoH = cameraHeight || 1
  const cropSize = Math.min(videoW, videoH)
  const sx = (videoW - cropSize) / 2
  const sy = (videoH - cropSize) / 2

  ctx.save()
  traceBubblePath(ctx, x, y, size, bubble.shape)
  ctx.clip()
  ctx.drawImage(camera, sx, sy, cropSize, cropSize, x, y, size, size)
  ctx.restore()

  if (bubble.borderWidth > 0) {
    traceBubblePath(ctx, x, y, size, bubble.shape)
    ctx.lineWidth = Math.max(1, bubble.borderWidth * scale)
    ctx.strokeStyle = bubble.borderColor
    ctx.stroke()
  }
}
