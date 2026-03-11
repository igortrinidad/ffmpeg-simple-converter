/**
 * Exemplo: Conversão Rápida de Vídeos Grandes
 * 
 * Este exemplo mostra como acelerar a conversão de vídeos grandes (como WebM)
 * usando diferentes presets de velocidade e hardware acceleration
 * 
 * IMPORTANTE: A biblioteca agora tem FALLBACK AUTOMÁTICO!
 * Se tentar usar GPU e falhar (ex: CUDA não disponível), automaticamente
 * tenta novamente usando CPU. Você não precisa se preocupar com erros de GPU.
 */

import { 
  convertVideoFile,
  processVideo
} from 'mediacript'

/**
 * Exemplo 1: Conversão Ultra Rápida
 * Ideal para arquivos muito grandes quando velocidade é prioridade
 */
async function conversaoUltraRapida() {
  console.log('⚡ Conversão Ultra Rápida\n')
  
  const options = {
    preset: 'ultrafast',  // Mais rápido possível
    crf: 28,              // Qualidade reduzida (mais rápido)
    hwaccel: 'auto'       // Tenta GPU, fallback automático para CPU
  }
  
  try {
    const result = await convertVideoFile(
      './video-grande.webm',
      './output',
      options
    )
    
    console.log('✅ Convertido:', result.outputPath)
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

/**
 * Exemplo 2: Conversão Muito Rápida com Boa Qualidade
 * Bom equilíbrio entre velocidade e qualidade
 */
async function conversaoRapidaComQualidade() {
  console.log('🚀 Conversão Rápida com Qualidade\n')
  
  const options = {
    preset: 'veryfast',   // Muito rápido (recomendado para WebM grandes)
    crf: 23,              // Qualidade padrão
    hwaccel: 'auto'       // GPU acceleration com fallback automático
  }
  
  try {
    const result = await convertVideoFile(
      './video.webm',
      './output',
      options
    )
    
    console.log('✅ Convertido:', result.outputPath)
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

/**
 * Exemplo 3: Workflow Completo com Conversão Rápida
 * Converte + Extrai áudio + Transcreve usando configurações rápidas
 */
async function workflowCompletoRapido() {
  console.log('🎬 Workflow Completo com Conversão Rápida\n')
  
  try {
    const result = await processVideo(
      './video-grande.webm',
      './output',
      {
        // Opções de conversão
        conversionOptions: {
          preset: 'veryfast',
          crf: 25,
          hwaccel: 'auto'   // Tenta GPU, mas não falha se não tiver
        },
        // API keys para transcrição
        groqApiKey: process.env.GROQ_API_KEY
      }
    )
    
    console.log('\n📊 Resultados:')
    console.log('  Vídeo:', result.convertedVideo.outputPath)
    console.log('  Áudio:', result.extractedAudio.outputPath)
    
    if (result.transcription) {
      console.log('  Transcrição:', result.transcription.text.length, 'caracteres')
    }
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

// ============================================================
// GUIA DE OTIMIZAÇÃO
// ============================================================
console.log('═'.repeat(70))
console.log('📊 GUIA DE OTIMIZAÇÃO - Conversão de Vídeos')
console.log('═'.repeat(70))
console.log('\n🎯 Para Vídeos WebM Grandes (>500MB):\n')
console.log('  Opção 1 - Velocidade Máxima:')
console.log('    { preset: "ultrafast", crf: 28, hwaccel: "auto" }')
console.log('    └─ Conversão 4-5x mais rápida, qualidade aceitável')
console.log('')
console.log('  Opção 2 - Balanceado (RECOMENDADO):')
console.log('    { preset: "veryfast", crf: 23, hwaccel: "auto" }')
console.log('    └─ Conversão 2-3x mais rápida, boa qualidade')
console.log('')
console.log('  Opção 3 - Qualidade:')
console.log('    { preset: "fast", crf: 20, hwaccel: "auto" }')
console.log('    └─ Um pouco mais lento, mas qualidade excelente')
console.log('\n─'.repeat(70))
console.log('\n⚡ Hardware Acceleration:\n')
console.log('  • hwaccel: "auto" - Detecta e usa GPU automaticamente')
console.log('  • Se CUDA/GPU falhar, usa CPU automaticamente')
console.log('  • NVIDIA GPU: pode ser 10x mais rápido')
console.log('  • Intel QuickSync/AMD: pode ser 5-8x mais rápido')
console.log('\n─'.repeat(70))
console.log('\n💡 Dicas:\n')
console.log('  1. Sempre use hwaccel: "auto" (não tem desvantagem)')
console.log('  2. Para arquivos >1GB, use preset "veryfast" ou mais rápido')
console.log('  3. CRF maior = mais rápido (mas menos qualidade)')
console.log('     • CRF 18: Alta qualidade')
console.log('     • CRF 23: Padrão (bom balanço)')
console.log('     • CRF 28: Rápido (qualidade ok)')
console.log('  4. A biblioteca tem fallback automático CPU se GPU falhar')
console.log('═'.repeat(70))
console.log('\n')

/**
 * Exemplo 4: Comparação de Velocidades
 * Testa diferentes presets para comparação
 */
async function compararVelocidades() {
  const inputFile = './video-teste.webm'
  
  const presets = [
    { name: 'Ultra Fast', preset: 'ultrafast', crf: 28 },
    { name: 'Very Fast', preset: 'veryfast', crf: 25 },
    { name: 'Fast', preset: 'fast', crf: 23 },
    { name: 'Medium', preset: 'medium', crf: 23 }
  ]
  
  console.log('📊 Comparando diferentes velocidades de conversão...\n')
  
  for (const config of presets) {
    console.log(`\n🔄 Testando: ${config.name}`)
    console.log(`   Preset: ${config.preset} | CRF: ${config.crf}`)
    
    const startTime = Date.now()
    
    try {
      await convertVideoFile(inputFile, './output', {
        preset: config.preset,
        crf: config.crf,
        hwaccel: 'auto'
      })
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(`   ✅ Tempo: ${duration}s`)
    } catch (error) {
      console.log(`   ❌ Erro: ${error.message}`)
    }
  }
}

/**
 * Exemplo 5: Hardware Acceleration Específico
 * Forçar uso de hardware específico
 */
async function usarHardwareEspecifico() {
  console.log('🎮 Usando Hardware Acceleration Específico\n')
  
  // Para NVIDIA GPU
  const nvidiaOptions = {
    preset: 'fast',
    hwaccel: 'nvenc'  // Força NVIDIA NVENC
  }
  
  // Para Intel Quick Sync
  const intelOptions = {
    preset: 'fast',
    hwaccel: 'qsv'  // Força Intel Quick Sync
  }
  
  // Para Intel/AMD no Linux
  const vaapiOptions = {
    preset: 'fast',
    hwaccel: 'vaapi'  // Força VAAPI
  }
  
  // Auto-detectar (recomendado)
  const autoOptions = {
    preset: 'veryfast',
    hwaccel: 'auto'  // Detecta automaticamente
  }
  
  try {
    console.log('🔍 Tentando auto-detecção de hardware...')
    const result = await convertVideoFile(
      './video.webm',
      './output',
      autoOptions
    )
    
    console.log('✅ Convertido com sucesso!')
    console.log('   Output:', result.outputPath)
  } catch (error) {
    console.error('❌ Erro:', error.message)
  }
}

// Guia de Referência
console.log('═'.repeat(70))
console.log('GUIA DE PRESETS - Conversão de Vídeos')
console.log('═'.repeat(70))
console.log('')
console.log('Para arquivos GRANDES (>500MB), use:')
console.log('  • ultrafast ou superfast - Máxima velocidade')
console.log('  • veryfast ou faster - Bom equilíbrio')
console.log('')
console.log('Para arquivos MÉDIOS (100-500MB), use:')
console.log('  • veryfast, faster ou fast')
console.log('')
console.log('Para arquivos PEQUENOS (<100MB), use:')
console.log('  • fast ou medium')
console.log('')
console.log('Hardware Acceleration:')
console.log('  • auto - Detecta automaticamente (RECOMENDADO)')
console.log('  • nvenc - NVIDIA GPU (muito rápido)')
console.log('  • qsv - Intel Quick Sync')
console.log('  • vaapi - Intel/AMD no Linux')
console.log('  • none - Sem aceleração (CPU apenas)')
console.log('')
console.log('CRF (Qualidade):')
console.log('  • 18-20: Qualidade muito alta (mais lento, maior)')
console.log('  • 21-23: Qualidade alta (padrão)')
console.log('  • 24-26: Qualidade boa (mais rápido, menor)')
console.log('  • 27-30: Qualidade aceitável (muito rápido, pequeno)')
console.log('')
console.log('═'.repeat(70))
console.log('')

// Executar exemplos (descomente o que quiser testar)
await conversaoRapidaComQualidade()
// await conversaoUltraRapida()
// await workflowCompletoRapido()
// await compararVelocidades()
// await usarHardwareEspecifico()
