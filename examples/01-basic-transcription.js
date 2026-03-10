/**
 * Exemplo 1: Uso Básico - Transcrever um arquivo de áudio
 * 
 * Este exemplo mostra como transcrever um arquivo de áudio simples
 */

import { initialize, transcribeAudioFile, saveTranscriptionToFile } from 'mediacript'

async function exemplo1() {
  try {
    // Verificar se FFmpeg está instalado
    await initialize()
    console.log('✓ FFmpeg verificado\n')
    
    // Transcrever áudio
    console.log('Transcrevendo áudio...')
    const result = await transcribeAudioFile('./audio.mp3')
    
    if (result) {
      console.log('\n✓ Transcrição completa!')
      console.log(`Duração: ${result.duration} segundos`)
      console.log(`\nTexto:\n${result.text}`)
      
      // Salvar em arquivo
      const filePath = await saveTranscriptionToFile(result.text, result.filePath)
      console.log(`\n✓ Salvo em: ${filePath}`)
    } else {
      console.error('❌ Falha na transcrição')
    }
  } catch (error) {
    console.error('Erro:', error.message)
  }
}

exemplo1()
