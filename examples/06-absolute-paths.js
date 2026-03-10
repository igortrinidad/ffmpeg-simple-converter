/**
 * Exemplo: Uso com Caminhos Absolutos
 * 
 * Este exemplo demonstra como usar a biblioteca com caminhos completos (absolute paths)
 */

import { 
  processVideo, 
  transcribeAudioFile,
  extractAudioFromVideo 
} from 'mediacript'
import path from 'path'
import os from 'os'

async function exemploPathsCompletos() {
  try {
    // Definir caminhos absolutos
    const homeDir = os.homedir()
    const inputVideoPath = path.join(homeDir, 'Videos', 'meu-video.mp4')
    const outputDir = path.join(homeDir, 'Documents', 'transcricoes')
    
    console.log('📁 Configuração:')
    console.log(`  Input: ${inputVideoPath}`)
    console.log(`  Output: ${outputDir}\n`)
    
    // Processar com caminhos completos
    console.log('🚀 Processando vídeo...')
    const result = await processVideo(inputVideoPath, outputDir, {
      groqApiKey: process.env.GROQ_API_KEY
    })
    
    console.log('\n✅ Resultado:')
    console.log(`  Vídeo convertido: ${result.convertedVideo.outputPath}`)
    console.log(`  Áudio extraído: ${result.extractedAudio.outputPath}`)
    
    if (result.transcription) {
      console.log(`  Transcrição: ${result.transcription.text.length} caracteres`)
      console.log(`\n📝 Preview:`)
      console.log(result.transcription.text.substring(0, 200) + '...')
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

// Exemplo 2: Transcrever áudio de diferentes locais
async function transcreverDeDiferentesLocais() {
  const arquivos = [
    // Linux
    '/home/user/audio/podcast.mp3',
    
    // macOS
    '/Users/user/Documents/audio.mp3',
    
    // Windows (use paths com barras normais, Node.js converte automaticamente)
    'C:/Users/user/Music/audio.mp3',
    
    // Ou use path.join para garantir compatibilidade cross-platform
    path.join(os.homedir(), 'Music', 'audio.mp3')
  ]
  
  console.log('📋 Transcrevendo múltiplos arquivos de diferentes locais...\n')
  
  for (const arquivo of arquivos) {
    try {
      console.log(`🎵 ${arquivo}`)
      
      // Verificar se arquivo existe (exemplo)
      // const fs = require('fs')
      // if (!fs.existsSync(arquivo)) continue
      
      const result = await transcribeAudioFile(arquivo)
      
      if (result) {
        console.log(`  ✓ Transcrito: ${result.text.length} caracteres\n`)
      }
    } catch (error) {
      console.log(`  ✗ Erro: ${error.message}\n`)
    }
  }
}

// Exemplo 3: Extrair áudio e especificar output path completo
async function extrairComOutputEspecifico() {
  const videoPath = '/home/user/Videos/apresentacao.mp4'
  const outputPath = '/home/user/Projects/transcricoes/audio'
  
  console.log('📹 Extraindo áudio com path de output personalizado...')
  console.log(`  Input: ${videoPath}`)
  console.log(`  Output: ${outputPath}\n`)
  
  try {
    const result = await extractAudioFromVideo(videoPath, outputPath)
    
    console.log('✅ Áudio extraído:')
    console.log(`  ${result.outputPath}`)
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

// Executar exemplos
console.log('═'.repeat(60))
console.log('Exemplo 1: Processamento com Paths Completos')
console.log('═'.repeat(60))
await exemploPathsCompletos()

console.log('\n' + '═'.repeat(60))
console.log('Exemplo 2: Transcrever de Diferentes Locais')
console.log('═'.repeat(60))
// await transcreverDeDiferentesLocais()

console.log('\n' + '═'.repeat(60))
console.log('Exemplo 3: Output Path Personalizado')
console.log('═'.repeat(60))
// await extrairComOutputEspecifico()
