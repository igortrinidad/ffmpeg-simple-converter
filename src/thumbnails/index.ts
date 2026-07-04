import fs from 'fs'
import path from 'path'
import { extractVideoFrame } from '../utils/ffmpegOperations.js'
import type { HighlightSegment } from '../types/index.js'

export const DEFAULT_THUMBNAIL_FRAME_COUNT = 5

/**
 * Extracts `count` preview frames from within [highlight.start, highlight.end],
 * spaced evenly across the interior of the range so the picks avoid the exact
 * cut boundaries (where transitions/black frames are more likely).
 */
export async function generateThumbnailFrames(
  sourceVideoPath: string,
  highlight: Pick<HighlightSegment, 'start' | 'end'>,
  outputDir: string,
  count: number = DEFAULT_THUMBNAIL_FRAME_COUNT
): Promise<string[]> {
  fs.mkdirSync(outputDir, { recursive: true })

  const duration = highlight.end - highlight.start
  const framePaths: string[] = []

  for (let i = 1; i <= count; i++) {
    const timestamp = highlight.start + (duration * i) / (count + 1)
    const outputPath = path.join(outputDir, `frame-${String(i).padStart(2, '0')}.jpg`)
    await extractVideoFrame(sourceVideoPath, timestamp, outputPath)
    framePaths.push(outputPath)
  }

  return framePaths
}

/**
 * Writes the AI-suggested thumbnail prompt ideas for a clip to a text file, so
 * the user can copy them into an image generation tool.
 */
export function saveThumbnailPrompts(prompts: string[], outputDir: string): string | null {
  if (!prompts.length) return null

  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'thumbnail-prompts.txt')
  fs.writeFileSync(outputPath, prompts.map((prompt, i) => `${i + 1}. ${prompt}`).join('\n\n'), 'utf-8')
  return outputPath
}
