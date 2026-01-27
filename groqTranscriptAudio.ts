#!/usr/bin/env ts-node

import dotenv from 'dotenv'
import FormData from 'form-data'
import fs from 'fs'
import axios from 'axios'
import path from 'path'
import { fileURLToPath } from 'url'

// Carrega variáveis de ambiente da pasta atual
dotenv.config({ path: path.join(process.cwd(), '.env') })

/**
 * https://console.groq.com/docs/speech-to-text
 * @param audioLocalFilePath - Local file path to the audio file
 * @returns 
 */
export const groqTranscriptAudio = async (audioLocalFilePath: string) => {
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
        timeout: 60000,
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    )

    return data?.text?.trim() || null

  } catch (error: any) {
    console.error('Error in groqTranscriptAudio:', error.response?.data || error.message)
    return null
  }
}

// Execução por linha de comando
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url)

if (isMainModule) {
  const audioFilePath = process.argv[2]
  
  if (!audioFilePath) {
    console.error('Uso: ts-node groqTranscriptAudio.ts <caminho-do-arquivo-audio>')
    process.exit(1)
  }

  if (!fs.existsSync(audioFilePath)) {
    console.error(`Arquivo não encontrado: ${audioFilePath}`)
    process.exit(1)
  }

  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY não encontrada no arquivo .env')
    process.exit(1)
  }

  console.log('Transcrevendo áudio...')

  groqTranscriptAudio(audioFilePath)
    .then((result) => {
      if (result) {
        // Gera o nome do arquivo de saída (mesmo nome do áudio, mas com .txt)
        const outputFileName = path.basename(audioFilePath, path.extname(audioFilePath)) + '.txt'
        const outputPath = path.join(process.cwd(), outputFileName)
        
        // Salva a transcrição no arquivo
        fs.writeFileSync(outputPath, result, 'utf-8')
        
        console.log('\n✓ Transcrição concluída!')
        console.log(`Arquivo salvo: ${outputPath}`)
      } else {
        console.error('Falha ao transcrever o áudio')
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('Erro:', error)
      process.exit(1)
    })
}