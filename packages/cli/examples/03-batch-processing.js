/**
 * Exemplo 3: Processamento em Lote
 * 
 * Este exemplo mostra como processar múltiplos arquivos de uma vez
 */

import { 
  listMediaFilesInDirectory, 
  detectMediaFileType,
  extractAndTranscribe,
  convertAndTranscribe,
  saveTranscriptionToFile
} from 'mediacript'
import path from 'path'

async function exemplo3() {
  const inputDir = './videos'
  const outputDir = './transcriptions'
  
  try {
    console.log('🔍 Procurando arquivos de mídia...\n')
    
    // Listar todos os arquivos de mídia
    const files = await listMediaFilesInDirectory(inputDir)
    console.log(`Encontrados ${files.length} arquivos\n`)
    
    // Processar cada arquivo
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileName = path.basename(file)
      const fileType = detectMediaFileType(file)
      
      console.log(`\n[${ i + 1}/${files.length}] Processando: ${fileName}`)
      console.log(`Tipo: ${fileType}`)
      
      try {
        let result
        
        if (fileType === 'video') {
          // Extrair áudio e transcrever
          result = await extractAndTranscribe(file, outputDir)
          console.log(`✓ Áudio extraído: ${path.basename(result.extractedAudio.outputPath)}`)
        } else {
          // Converter áudio e transcrever
          result = await convertAndTranscribe(file, outputDir)
          console.log(`✓ Áudio convertido: ${path.basename(result.convertedAudio.outputPath)}`)
        }
        
        if (result.transcription) {
          // Salvar transcrição
          const audioPath = fileType === 'video' 
            ? result.extractedAudio.outputPath 
            : result.convertedAudio.outputPath
            
          const transcriptionFile = await saveTranscriptionToFile(
            result.transcription.text,
            audioPath
          )
          
          console.log(`✓ Transcrição salva: ${path.basename(transcriptionFile)}`)
          console.log(`  Caracteres: ${result.transcription.text.length}`)
          console.log(`  Duração: ${result.transcription.duration}s`)
        } else {
          console.error(`❌ Falha na transcrição de ${fileName}`)
        }
      } catch (error) {
        console.error(`❌ Erro ao processar ${fileName}:`, error.message)
      }
    }
    
    console.log('\n✅ Processamento em lote concluído!')
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

exemplo3()
