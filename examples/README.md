# Exemplos de Uso do MediaScript

Este diretório contém exemplos práticos de como usar o MediaScript como biblioteca em suas aplicações Node.js.

## Exemplos Disponíveis

### 1. [Transcrição Básica](./01-basic-transcription.js)
Exemplo simples mostrando como transcrever um arquivo de áudio.

```bash
node examples/01-basic-transcription.js
```

### 2. [Workflow Completo](./02-complete-workflow.js)
Mostra como processar um vídeo completo: conversão + extração de áudio + transcrição.

```bash
node examples/02-complete-workflow.js
```

### 3. [Processamento em Lote](./03-batch-processing.js)
Processa múltiplos arquivos de uma vez de forma automática.

```bash
node examples/03-batch-processing.js
```

### 4. [API REST com Express](./04-express-api.js)
Implementação completa de uma API REST para transcrição de vídeos.

```bash
# Instalar dependências adicionais
npm install express multer

# Executar
node examples/04-express-api.js
```

Endpoints disponíveis:
- `POST /api/transcribe` - Upload e transcrição de vídeo
- `GET /api/transcriptions` - Listar todas as transcrições
- `GET /api/transcriptions/:filename` - Obter transcrição específica

### 5. [Uso com TypeScript](./05-typescript-usage.ts)
Exemplo completo usando TypeScript com type safety.

```bash
# Executar com ts-node
npx ts-node examples/05-typescript-usage.ts

# Ou compilar e executar
tsc examples/05-typescript-usage.ts
node examples/05-typescript-usage.js
```

### 6. [Caminhos Absolutos](./06-absolute-paths.js)
Demonstra como usar a biblioteca com caminhos completos (absolute paths) e paths de diferentes sistemas operacionais.

```bash
node examples/06-absolute-paths.js
```

## Requisitos

- Node.js >= 16
- FFmpeg instalado
- API keys configuradas (.env ou passadas por código)

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
GROQ_API_KEY=sua-chave-groq
OPENAI_API_KEY=sua-chave-openai
```

## Executando os Exemplos

1. Instale as dependências:
```bash
npm install
```

2. Configure suas API keys no `.env`

3. Execute qualquer exemplo:
```bash
node examples/01-basic-transcription.js
```

## Adaptando para Seu Projeto

Cada exemplo pode ser facilmente adaptado para suas necessidades:

1. Copie o código do exemplo
2. Ajuste os caminhos dos arquivos
3. Modifique as opções conforme necessário
4. Integre no seu fluxo de trabalho

## Dicas

### Performance
- Use Groq API para transcrições mais rápidas
- Arquivos grandes (>10MB) são automaticamente divididos em chunks
- Processe vídeos em paralelo quando possível

### Tratamento de Erros
Sempre use try/catch para capturar erros:

```javascript
try {
  const result = await transcribeAudioFile('audio.mp3')
} catch (error) {
  console.error('Erro:', error.message)
}
```

### Otimização
- Converta vídeos para H.264/AAC antes de distribuir
- Use MP3 192kbps para áudio de qualidade/tamanho balanceado
- Mantenha arquivos de áudio abaixo de 10MB sempre que possível

## Mais Informações

- [Documentação Completa da API](../LIBRARY_USAGE.md)
- [Guia de Início Rápido](../QUICK_START.md)
- [README Principal](../README.md)
