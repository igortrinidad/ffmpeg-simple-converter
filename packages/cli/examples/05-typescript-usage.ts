/**
 * Exemplo 5: Uso com TypeScript
 * 
 * Este exemplo mostra como usar o MediaScript com TypeScript
 * para ter type safety completo
 */

import {
  initialize,
  processVideo,
  saveTranscriptionToFile,
  type TranscriptionResult,
  type ConversionResult,
  type MediaScriptOptions
} from 'mediacript'
import path from 'path'

interface ProcessingResult {
  success: boolean
  videoPath?: string
  audioPath?: string
  transcriptionPath?: string
  transcription?: TranscriptionResult
  error?: string
}

/**
 * Processa um vídeo e retorna resultado tipado
 */
async function processarVideoComTipos(
  videoPath: string,
  options?: MediaScriptOptions
): Promise<ProcessingResult> {
  try {
    // Verificar FFmpeg
    await initialize()
    
    // Processar vídeo
    const resultado = await processVideo(videoPath, './output', options)
    
    // Preparar resultado
    const result: ProcessingResult = {
      success: true,
      videoPath: resultado.convertedVideo.outputPath,
      audioPath: resultado.extractedAudio.outputPath
    }
    
    // Se houver transcrição, salvar e adicionar ao resultado
    if (resultado.transcription) {
      const transcriptionFile = await saveTranscriptionToFile(
        resultado.transcription.text,
        resultado.extractedAudio.outputPath
      )
      
      result.transcriptionPath = transcriptionFile
      result.transcription = resultado.transcription
    }
    
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }
  }
}

/**
 * Classe para gerenciar processamento de vídeos
 */
class VideoProcessor {
  private options: MediaScriptOptions
  
  constructor(options: MediaScriptOptions = {}) {
    this.options = options
  }
  
  /**
   * Processa um único vídeo
   */
  async processOne(videoPath: string): Promise<ProcessingResult> {
    console.log(`📹 Processando: ${path.basename(videoPath)}`)
    
    const result = await processarVideoComTipos(videoPath, this.options)
    
    if (result.success) {
      console.log('✓ Sucesso!')
      if (result.transcription) {
        console.log(`  Transcrição: ${result.transcription.text.length} caracteres`)
        console.log(`  Duração: ${result.transcription.duration}s`)
      }
    } else {
      console.error(`✗ Erro: ${result.error}`)
    }
    
    return result
  }
  
  /**
   * Processa múltiplos vídeos
   */
  async processMany(
    videoPaths: string[]
  ): Promise<ProcessingResult[]> {
    console.log(`🎬 Processando ${videoPaths.length} vídeos...\n`)
    
    const results: ProcessingResult[] = []
    
    for (let i = 0; i < videoPaths.length; i++) {
      const videoPath = videoPaths[i]
      console.log(`\n[${i + 1}/${videoPaths.length}]`)
      
      const result = await this.processOne(videoPath)
      results.push(result)
    }
    
    // Estatísticas
    const successful = results.filter(r => r.success).length
    const failed = results.length - successful
    
    console.log('\n📊 Estatísticas:')
    console.log(`  Sucesso: ${successful}`)
    console.log(`  Falhas: ${failed}`)
    
    return results
  }
  
  /**
   * Gera relatório de processamento
   */
  generateReport(results: ProcessingResult[]): string {
    let report = '# Relatório de Processamento\n\n'
    
    results.forEach((result, index) => {
      report += `## Vídeo ${index + 1}\n\n`
      
      if (result.success) {
        report += `- ✓ Status: Sucesso\n`
        report += `- Vídeo: ${result.videoPath}\n`
        report += `- Áudio: ${result.audioPath}\n`
        
        if (result.transcription) {
          report += `- Transcrição: ${result.transcriptionPath}\n`
          report += `- Caracteres: ${result.transcription.text.length}\n`
          report += `- Duração: ${result.transcription.duration}s\n`
        }
      } else {
        report += `- ✗ Status: Falha\n`
        report += `- Erro: ${result.error}\n`
      }
      
      report += '\n'
    })
    
    return report
  }
}

// Exemplo de uso
async function exemplo5() {
  // Criar processador
  const processor = new VideoProcessor({
    groqApiKey: process.env.GROQ_API_KEY
  })
  
  // Processar um vídeo
  const result = await processor.processOne('./video.mp4')
  
  if (result.success && result.transcription) {
    console.log('\n📝 Transcrição:')
    console.log(result.transcription.text)
  }
  
  // Ou processar vários vídeos
  // const results = await processor.processMany([
  //   './video1.mp4',
  //   './video2.mp4',
  //   './video3.mp4'
  // ])
  // 
  // const report = processor.generateReport(results)
  // console.log(report)
}

exemplo5()
