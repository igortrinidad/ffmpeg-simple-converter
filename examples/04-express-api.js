/**
 * Exemplo 4: API REST com Express
 * 
 * Este exemplo mostra como criar uma API REST para transcrição de vídeos
 * 
 * Instalação:
 * npm install express multer
 */

import express from 'express'
import multer from 'multer'
import { 
  initialize, 
  extractAndTranscribe, 
  saveTranscriptionToFile,
  detectMediaFileType
} from 'mediacript'
import path from 'path'
import fs from 'fs'

const app = express()
const PORT = 3000

// Configurar upload de arquivos
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB máximo
  }
})

// Middleware para JSON
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'MediaScript API' })
})

// Endpoint para transcrever vídeo
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }
    
    const filePath = req.file.path
    const fileType = detectMediaFileType(filePath)
    
    console.log(`📥 Arquivo recebido: ${req.file.originalname}`)
    console.log(`📁 Tipo: ${fileType}`)
    
    // Verificar se é um arquivo de mídia válido
    if (fileType !== 'video' && fileType !== 'audio') {
      fs.unlinkSync(filePath) // Limpar arquivo
      return res.status(400).json({ 
        error: 'Formato de arquivo não suportado' 
      })
    }
    
    // Processar arquivo
    const result = await extractAndTranscribe(filePath, 'outputs')
    
    if (!result.transcription) {
      return res.status(500).json({ 
        error: 'Falha na transcrição' 
      })
    }
    
    // Salvar transcrição
    const transcriptionFile = await saveTranscriptionToFile(
      result.transcription.text,
      result.extractedAudio.outputPath
    )
    
    // Limpar arquivo original do upload
    fs.unlinkSync(filePath)
    
    // Responder com resultado
    res.json({
      success: true,
      originalFile: req.file.originalname,
      audioPath: result.extractedAudio.outputPath,
      transcriptionPath: transcriptionFile,
      transcription: {
        text: result.transcription.text,
        duration: result.transcription.duration,
        characters: result.transcription.text.length
      }
    })
    
    console.log(`✓ Processamento concluído: ${req.file.originalname}`)
  } catch (error) {
    console.error('❌ Erro:', error)
    
    // Limpar arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    
    res.status(500).json({ 
      error: error.message 
    })
  }
})

// Endpoint para listar transcrições
app.get('/api/transcriptions', (req, res) => {
  try {
    const dir = './outputs'
    
    if (!fs.existsSync(dir)) {
      return res.json({ transcriptions: [] })
    }
    
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.txt'))
      .map(f => {
        const filePath = path.join(dir, f)
        const stats = fs.statSync(filePath)
        return {
          name: f,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        }
      })
    
    res.json({ 
      count: files.length,
      transcriptions: files 
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Endpoint para obter uma transcrição específica
app.get('/api/transcriptions/:filename', (req, res) => {
  try {
    const filePath = path.join('./outputs', req.params.filename)
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Transcrição não encontrada' })
    }
    
    const content = fs.readFileSync(filePath, 'utf-8')
    const stats = fs.statSync(filePath)
    
    res.json({
      filename: req.params.filename,
      content,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Inicializar servidor
async function startServer() {
  try {
    // Verificar FFmpeg
    await initialize()
    console.log('✓ FFmpeg verificado')
    
    // Criar diretórios necessários
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads')
    }
    if (!fs.existsSync('outputs')) {
      fs.mkdirSync('outputs')
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`)
      console.log('\nEndpoints disponíveis:')
      console.log('  POST   /api/transcribe')
      console.log('  GET    /api/transcriptions')
      console.log('  GET    /api/transcriptions/:filename')
      console.log('  GET    /health')
    })
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error.message)
    process.exit(1)
  }
}

startServer()
