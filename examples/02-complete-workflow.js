/**
 * Exemple 2: Workflow Completo - Processar um vídeo
 * 
 * Este exemplo mostra como processar um vídeo completo:
 * - Converter para formato performático
 * - Extrair áudio
 * - Transcrever
 */

import { processVideo, saveTranscriptionToFile } from 'mediacript'
import path from 'path'

async function exemplo2() {
  const videoPath = './video.mov'
  const outputDir = './output'
  
  try {
    console.log('🚀 Iniciando processamento completo do vídeo...\n')
    
    // Executar workflow completo
    const result = await processVideo(videoPath, outputDir, {
      groqApiKey: process.env.GROQ_API_KEY
    })
    
    console.log('\n📊 Resultados:')
    console.log('─'.repeat(50))
    console.log(`✓ Vídeo original: ${result.convertedVideo.originalPath}`)
    console.log(`✓ Vídeo convertido: ${result.convertedVideo.outputPath}`)
    console.log(`✓ Áudio extraído: ${result.extractedAudio.outputPath}`)
    
    if (result.transcription) {
      console.log(`✓ Transcrição: ${result.transcription.text.length} caracteres`)
      console.log(`✓ Duração: ${result.transcription.duration} segundos`)
      
      // Salvar transcrição
      const transcriptionFile = await saveTranscriptionToFile(
        result.transcription.text,
        result.extractedAudio.outputPath
      )
      console.log(`✓ Transcrição salva: ${transcriptionFile}`)
      
      // Exibir preview da transcrição
      const preview = result.transcription.text.substring(0, 200)
      console.log(`\n📝 Preview da transcrição:`)
      console.log('─'.repeat(50))
      console.log(preview + '...')
    } else {
      console.error('❌ Falha na transcrição')
    }
  } catch (error) {
    console.error('❌ Erro ao processar vídeo:', error.message)
  }
}

exemplo2()
