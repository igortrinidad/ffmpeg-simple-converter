import fs from 'fs'
import OpenAI from 'openai'
import type { TranscriptSegment } from '../types/index.js'

export interface OpenAITranscriptionResult {
  text: string
  segments: TranscriptSegment[]
}

/**
 * Transcribes an audio file using OpenAI Whisper
 * @param audioLocalFilePath - Local audio file path
 * @param apiKey - OpenAI API Key
 * @returns Transcribed text with segment-level timestamps, or null in case of error
 */
export const openaiTranscriptAudio = async (
  audioLocalFilePath: string,
  apiKey: string
): Promise<OpenAITranscriptionResult | null> => {

  if (!apiKey) {
    console.error('❌ OpenAI API Key not provided')
    return null
  }

  try {
    const openai = new OpenAI({ apiKey })

    const transcription: any = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioLocalFilePath),
      model: 'whisper-1',
      response_format: 'verbose_json'
    })

    const text = transcription?.text?.trim()
    if (!text) return null

    const segments: TranscriptSegment[] = (transcription?.segments || []).map((segment: any) => ({
      start: segment.start,
      end: segment.end,
      text: (segment.text || '').trim()
    }))

    return { text, segments }

  } catch (error: any) {
    console.error('Error transcribing audio with OpenAI:', error.response?.data || error.message)
    return null
  }
}
