// Test CommonJS require
const { processVideo, transcribeAudioFile } = require('mediacript')

console.log('✓ CommonJS require works!')
console.log('Available:', { processVideo, transcribeAudioFile })
