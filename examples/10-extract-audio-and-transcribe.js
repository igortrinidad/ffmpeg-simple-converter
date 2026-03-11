/**
 * Example 10: Extract audio from video and transcribe (no video conversion)
 *
 * Uses processVideo with skipVideoConversion: true to skip the MP4 conversion step.
 * ffmpeg extracts the audio track directly from the original file (.webm, .mkv, .mov, etc.)
 * and then transcribes it — no intermediate MP4 is created.
 */

import { initialize, processVideo, saveTranscriptionToFile } from 'mediacript'

async function main() {
  const videoPath = './meu-video.webm' // any video format supported by ffmpeg
  const outputDir = './output'

  try {
    await initialize()

    console.log('🚀 Extraindo áudio e transcrevendo (sem converter o vídeo)...\n')

    const result = await processVideo(videoPath, outputDir, {
      skipVideoConversion: true, // skip MP4 conversion — extract audio directly
      groqApiKey: process.env.GROQ_API_KEY,
      // or: openaiApiKey: process.env.OPENAI_API_KEY,
    })

    console.log('📊 Resultados:')
    console.log('─'.repeat(50))
    // convertedVideo is null when skipVideoConversion is true
    console.log(`✓ Conversão de vídeo: ignorada`)
    console.log(`✓ Áudio extraído: ${result.extractedAudio.outputPath}`)

    if (result.transcription) {
      console.log(`✓ Duração: ${result.transcription.duration?.toFixed(1)}s`)
      console.log(`✓ Transcrição: ${result.transcription.text.length} caracteres`)

      const transcriptionFile = await saveTranscriptionToFile(
        result.transcription.text,
        result.extractedAudio.outputPath
      )
      console.log(`✓ Transcrição salva: ${transcriptionFile}`)

      console.log('\n📝 Preview:')
      console.log('─'.repeat(50))
      console.log(result.transcription.text.substring(0, 300) + (result.transcription.text.length > 300 ? '...' : ''))
    } else {
      console.error('❌ Falha na transcrição')
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

main()
