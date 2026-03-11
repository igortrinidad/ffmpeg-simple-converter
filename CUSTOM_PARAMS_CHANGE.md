# Custom Parameters - Breaking Change

## Mudança Implementada

Os `customParams` agora **substituem completamente** todos os parâmetros de conversão padrão, mantendo apenas:
- Input file (-i)
- Output file (-y)
- Hardware acceleration (se especificado via `hwaccel`)

## Antes vs Depois

### ❌ ANTES (comportamento antigo)
```typescript
await convertVideo('input.webm', './output', {
  preset: 'fast',    // Aplicado
  crf: 23,           // Aplicado
  customParams: ['-pix_fmt', 'yuv420p']  // ADICIONADO aos defaults
})

// Comando resultante:
// ffmpeg -i input.webm -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart -pix_fmt yuv420p -y output.mp4
```

### ✅ DEPOIS (comportamento novo)
```typescript
await convertVideo('input.webm', './output', {
  preset: 'fast',    // IGNORADO quando customParams presente
  crf: 23,           // IGNORADO quando customParams presente
  customParams: [
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k'
  ]
})

// Comando resultante:
// ffmpeg -i input.webm -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -y output.mp4
```

## Por Que Esta Mudança?

1. **Controle Total**: Permite sobrescrever TODOS os parâmetros de conversão
2. **Flexibilidade**: Possibilita usar qualquer codec (VP9, HEVC, AV1, etc.)
3. **Previsibilidade**: Comportamento claro - customParams = controle total
4. **Sem Conflitos**: Evita conflitos entre parâmetros padrão e customizados

## Exemplos de Uso

### 1. Encoding H.264 Padrão
```typescript
await convertVideo('input.webm', './output', {
  customParams: [
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k'
  ]
})
```

### 2. VP9 (WebM)
```typescript
await convertVideo('input.mp4', './output', {
  customParams: [
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '0',
    '-cpu-used', '2',
    '-c:a', 'libopus',
    '-b:a', '128k'
  ]
})
```

### 3. Alta Qualidade com Tune
```typescript
await convertVideo('input.webm', './output', {
  customParams: [
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-tune', 'film',
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart'
  ]
})
```

### 4. Com Hardware Acceleration
```typescript
await convertVideo('input.webm', './output', {
  hwaccel: 'auto',  // GPU será usada se disponível
  customParams: [
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k'
  ]
})
```

### 5. Streaming/Web Otimizado
```typescript
await convertVideo('input.webm', './output', {
  customParams: [
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '25',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-maxrate', '2M',
    '-bufsize', '4M',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart'
  ]
})
```

## Uso Sem Custom Params

Quando `customParams` não é fornecido, o comportamento padrão permanece:

```typescript
await convertVideo('input.webm', './output', {
  preset: 'fast',
  crf: 23,
  hwaccel: 'auto'
})
// Funciona exatamente como antes!
```

## Arquivos Atualizados

1. **src/utils/ffmpegOperations.ts**
   - Modificada interface `ConversionOptions` com nova documentação
   - Refatorada função `convertVideoInternal` para suportar override completo

2. **tests/utils/ffmpegOperations.test.ts**
   - Atualizado teste de customParams com parâmetros completos

3. **tests/performance/compression.test.ts**
   - Atualizados testes de performance com encodings completos
   - Adicionado teste com VP9

4. **examples/08-custom-parameters.js**
   - Reescrito com 6 exemplos completos mostrando diferentes codecs e configurações

5. **tests/README.md**
   - Documentação atualizada com explicação clara do comportamento
   - Múltiplos exemplos práticos

## Migration Guide

Se você estava usando `customParams` anteriormente:

### Antes:
```typescript
await convertVideo('input.webm', './output', {
  preset: 'fast',
  crf: 23,
  customParams: ['-tune', 'film']
})
```

### Migrar para:
```typescript
await convertVideo('input.webm', './output', {
  customParams: [
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-tune', 'film',
    '-c:a', 'aac',
    '-b:a', '128k'
  ]
})
```

Ou simplesmente usar as opções padrão se customParams não for necessário:
```typescript
await convertVideo('input.webm', './output', {
  preset: 'fast',
  crf: 23
})
```
