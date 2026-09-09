/**
 * Example: Default vs Custom Parameters
 * 
 * This example demonstrates the difference between using default parameters
 * and custom parameters in video conversion.
 */

import { convertVideo } from '../dist/esm/lib.js'
import path from 'path'

async function main() {
  const inputFile = process.argv[2]

  if (!inputFile) {
    console.log('Usage: node 09-default-vs-custom.js <input-video>')
    console.log('\nThis example converts the same video twice:')
    console.log('  1. Using default parameters (preset + crf)')
    console.log('  2. Using custom parameters (full control)')
    process.exit(1)
  }

  const outputDir = path.dirname(inputFile)

  console.log('🎬 Mediacript - Default vs Custom Parameters\n')
  console.log('='.repeat(70))

  // METHOD 1: Using default parameters
  console.log('\n📦 METHOD 1: Default Parameters (Easy & Recommended)')
  console.log('-'.repeat(70))
  console.log('Just specify preset and crf, library handles the rest:\n')
  
  const startDefault = Date.now()
  const output1 = await convertVideo(inputFile, outputDir, {
    preset: 'fast',
    crf: 23,
    hwaccel: 'auto'
  })
  const durationDefault = Date.now() - startDefault
  
  console.log(`✓ Output: ${output1}`)
  console.log(`✓ Time: ${(durationDefault / 1000).toFixed(2)}s`)
  console.log('\nDefault parameters used:')
  console.log('  • Video codec: libx264 (or hardware accelerated)')
  console.log('  • Preset: fast')
  console.log('  • CRF: 23')
  console.log('  • Audio: AAC 128k')
  console.log('  • Optimizations: faststart')

  // METHOD 2: Using custom parameters
  console.log('\n\n🎛️  METHOD 2: Custom Parameters (Full Control)')
  console.log('-'.repeat(70))
  console.log('Specify every ffmpeg parameter yourself:\n')
  
  const startCustom = Date.now()
  const output2 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-c:v', 'libx264',      // Video codec
      '-preset', 'fast',       // Encoding speed
      '-crf', '23',            // Quality (0-51, lower = better)
      '-pix_fmt', 'yuv420p',   // Pixel format (broad compatibility)
      '-c:a', 'aac',           // Audio codec
      '-b:a', '128k',          // Audio bitrate
      '-movflags', '+faststart' // MP4 optimization
    ]
  })
  const durationCustom = Date.now() - startCustom
  
  console.log(`✓ Output: ${output2}`)
  console.log(`✓ Time: ${(durationCustom / 1000).toFixed(2)}s`)
  console.log('\nYou controlled every parameter!')

  // METHOD 3: Advanced custom encoding (VP9)
  console.log('\n\n🚀 METHOD 3: Advanced Custom (VP9 WebM)')
  console.log('-'.repeat(70))
  console.log('Use custom params to access any codec:\n')
  
  const startVp9 = Date.now()
  const output3 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-c:v', 'libvpx-vp9',    // VP9 codec
      '-crf', '30',             // Quality for VP9
      '-b:v', '0',              // Constant quality mode
      '-cpu-used', '2',         // Speed (0-5, higher = faster)
      '-row-mt', '1',           // Row-based multithreading
      '-c:a', 'libopus',        // Opus audio codec
      '-b:a', '128k'            // Audio bitrate
    ]
  })
  const durationVp9 = Date.now() - startVp9
  
  console.log(`✓ Output: ${output3}`)
  console.log(`✓ Time: ${(durationVp9 / 1000).toFixed(2)}s`)
  console.log('\nUsed VP9 codec - not possible with default params!')

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('📊 SUMMARY')
  console.log('='.repeat(70))
  console.log('\nWhen to use DEFAULT parameters:')
  console.log('  ✅ You want quick, high-quality H.264 encoding')
  console.log('  ✅ You want hardware acceleration support')
  console.log('  ✅ You don\'t need to customize every detail')
  console.log('  ✅ Recommended for most use cases')
  
  console.log('\nWhen to use CUSTOM parameters:')
  console.log('  ✅ You need a specific codec (VP9, HEVC, AV1)')
  console.log('  ✅ You need precise control over encoding')
  console.log('  ✅ You have specific ffmpeg requirements')
  console.log('  ✅ You\'re implementing advanced encoding profiles')

  console.log('\n' + '='.repeat(70))
  console.log('✨ All conversions completed successfully!')
  console.log('='.repeat(70))
}

main().catch(error => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
