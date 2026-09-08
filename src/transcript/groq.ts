import FormData from 'form-data'
import fs from 'fs'
import axios from 'axios'
import type { TranscriptSegment } from '../types/index.js'

export interface GroqTranscriptionResult {
  text: string
  segments: TranscriptSegment[]
}

/**
 * Upload + transcription budget for a single request. Generous by default: a
 * ~10MB chunk (the largest `transcribeAudioWithSegments` produces) on a slow
 * uplink can take minutes, and timing out early makes the caller fall back to
 * another provider — or fail a long recording outright — for no good reason.
 */
const DEFAULT_TIMEOUT_MS = 300000

/**
 * Transcribes an audio file using Groq Whisper
 * https://console.groq.com/docs/speech-to-text
 * @param audioLocalFilePath - Local audio file path
 * @param apiKey - Groq API Key
 * @param timeoutMs - Request timeout in milliseconds (default: 5 minutes)
 * @returns Transcribed text with segment-level timestamps, or null in case of error
 */
export const groqTranscriptAudio = async (
  audioLocalFilePath: string,
  apiKey: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<GroqTranscriptionResult | null> => {

  if (!apiKey) {
    console.error('❌ Groq API Key not provided')
    return null
  }

  try {
    const formData = new FormData()

    // Add the file from local path
    formData.append('file', fs.createReadStream(audioLocalFilePath))
    formData.append('model', 'whisper-large-v3')
    formData.append('response_format', 'verbose_json')
    formData.append('temperature', '0')
    // formData.append('language', 'pt')

    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        timeout: timeoutMs,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...formData.getHeaders()
        }
      }
    )

    const text = data?.text?.trim()
    if (!text) return null

    const segments: TranscriptSegment[] = (data?.segments || []).map((segment: any) => ({
      start: segment.start,
      end: segment.end,
      text: (segment.text || '').trim()
    }))

    return { text, segments }

  } catch (error: any) {
    console.error('Error transcribing audio with Groq:', error.response?.data || error.message)
    return null
  }
}
