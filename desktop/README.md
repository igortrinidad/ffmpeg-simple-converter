# Mediacript Desktop

Interface gráfica (Electron + Vue 3 + TypeScript) para as funcionalidades da CLI/biblioteca
[`mediacript`](../README.md): converter vídeos/áudios, transcrever, gerar legendas com timeline (.srt)
e cortar destaques com IA — pensada para quem não usa terminal.

## Telas

- **Início**: arraste arquivos (ou clique para selecionar), escolha a operação em um wizard de
  poucos passos (Convert/Extract/Transcribe/Subtitles/Highlights) e acompanhe o progresso em tempo real.
  A engrenagem (⚙️) no topo abre as configurações (API keys de Groq/OpenAI/Anthropic/Gemini/OpenRouter
  e pasta de saída padrão).
- **Histórico**: lista de todas as operações já executadas, com acesso rápido aos arquivos gerados
  (abrir ou mostrar na pasta).

As configurações (API keys) são **compartilhadas com a CLI** — ambas leem/escrevem o mesmo
`config.json` em `~/.config/ffmpeg-simple-converter` (ou `%APPDATA%/ffmpeg-simple-converter` no
Windows), então configurar por um dos dois já vale para o outro.

## Requisitos

- Node.js >= 18
- FFmpeg instalado no sistema (o app avisa na tela inicial se não encontrar)
- O projeto raiz (`mediacript`) precisa estar compilado (`dist/`) — os scripts abaixo já cuidam disso.

## Desenvolvimento

```bash
cd desktop
npm install
npm run dev
```

`npm run dev` primeiro roda `npm run build` no projeto raiz (garantindo que `dist/` está atualizado)
e depois inicia o Electron em modo desenvolvimento com hot-reload do renderer.

Se você alterar código em `src/` (raiz do projeto, fora de `desktop/`), rode `npm run dev` de novo
(ou `npm run prepare:lib` sozinho) para que o app desktop enxergue a mudança — ele consome
`mediacript` como uma dependência local (`file:..`) apontando para o `dist/` já compilado.

## Verificação de tipos

```bash
npm run typecheck        # main + renderer
npm run typecheck:node   # só o processo principal/preload
npm run typecheck:web    # só o renderer (Vue)
```

## Build / empacotamento

```bash
npm run build            # compila main/preload/renderer para desktop/out (não gera instalador)
npm run package:linux     # gera um AppImage em desktop/release
npm run package:mac       # gera um .dmg (precisa rodar em macOS)
npm run package:win       # gera um instalador NSIS (precisa rodar em Windows, ou com Wine no Linux)
```

Cada `package:*` primeiro roda `prepare:package`, que reconstrói o projeto raiz e troca
`node_modules/mediacript` — normalmente um symlink pra raiz inteira do repo (ótimo para dev, já que
reflete mudanças na hora) — por uma cópia limpa contendo só o que `npm pack` publicaria (`dist/`,
`cli.mjs`, `convert.js`, `package.json`). Sem isso, o electron-builder segue o symlink e empacota o
repositório inteiro (node_modules da raiz, testes, `.history/`, vídeos de teste...): o instalador ia
de ~110MB para **vários GB**. Depois de empacotar, rode `npm install` de novo em `desktop/` para
restaurar o symlink de desenvolvimento.

> Nota: os ícones de `build/` ainda não foram customizados (o electron-builder usa o ícone padrão).
> Antes de distribuir de verdade, adicione `build/icon.png` (Linux), `build/icon.icns` (macOS) e
> `build/icon.ico` (Windows).

## Arquitetura

```
desktop/
├── src/
│   ├── main/        # processo principal do Electron (janela, IPC, orquestração dos jobs)
│   │   ├── ipc/      # handlers: config, files, jobs, history, ffmpeg
│   │   └── lib/       # jobRunner (chama as funções do mediacript) e historyStore (JSON)
│   ├── preload/      # contextBridge — expõe `window.api` de forma segura ao renderer
│   ├── renderer/     # app Vue (as duas telas + wizard + modal de configurações)
│   └── shared/       # tipos e catálogo de operações compartilhados entre main/preload/renderer
```

O processo principal reimplementa a orquestração passo-a-passo do CLI (`executeWorkflow`) chamando
as mesmas funções primitivas exportadas por `mediacript` (`convertVideoFile`, `extractAudioFromVideo`,
`transcribeAudioFile`, `saveSrtFile`, `extractVideoHighlights`, `cutHighlightClips`, ...), emitindo um
evento de progresso por etapa para a interface — em vez de usar as funções de conveniência
(`processVideo`, `extractHighlightClips`, etc.), que rodam tudo de uma vez sem pontos de progresso
intermediários.
