/**
 * Test file to verify library exports
 * Run with: node --loader ts-node/esm test-lib.ts
 */

import {
  initialize,
  convertVideoFile,
  extractAudioFromVideo,
  convertAudioFile,
  transcribeAudioFile,
  processVideo,
  extractAndTranscribe,
  convertAndTranscribe,
  detectMediaFileType,
  listMediaFilesInDirectory,
  type TranscriptionResult,
  type ConversionResult,
  type MediaScriptOptions
} from './src/lib.js'

console.log('✓ All exports loaded successfully!')
console.log('')
console.log('Available functions:')
console.log('  - initialize()')
console.log('  - convertVideoFile()')
console.log('  - extractAudioFromVideo()')
console.log('  - convertAudioFile()')
console.log('  - transcribeAudioFile()')
console.log('  - processVideo()')
console.log('  - extractAndTranscribe()')
console.log('  - convertAndTranscribe()')
console.log('  - detectMediaFileType()')
console.log('  - listMediaFilesInDirectory()')
console.log('')
console.log('✅ Library is ready to use!')
