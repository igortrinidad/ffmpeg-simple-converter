/**
 * Example 08: Using Custom FFmpeg Parameters
 * 
 * This example demonstrates how to use custom ffmpeg parameters
 * to fine-tune video conversion settings.
 */

import { convertVideo } from '../dist/esm/lib.js'
import path from 'path'

async function main() {
  const inputFile = process.argv[2]

  if (!inputFile) {
    console.log('Usage: node 08-custom-parameters.js <input-video>')
    console.log('\nExamples:')
    console.log('  node 08-custom-parameters.js video.webm')
    console.log('  node 08-custom-parameters.js recording.mp4')
    process.exit(1)
  }

  const outputDir = path.dirname(inputFile)

  console.log('🎬 Mediacript - Custom FFmpeg Parameters Example\n')
  console.log('='.repeat(60))

  // Example 1: Complete custom encoding with H.264
  console.log('\n1️⃣  Converting with complete custom H.264 parameters...')
  const output1 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k'
    ]
  })
  console.log(`✓ Output: ${output1}`)

  // Example 2: High-quality film encoding
  console.log('\n2️⃣  Converting with high-quality film settings...')
  const output2 = await convertVideo(inputFile, outputDir, {
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
  console.log(`✓ Output: ${output2}`)

  // Example 3: Fast encoding for streaming/web
  console.log('\n3️⃣  Converting for web streaming (ultra-fast)...')
  const output3 = await convertVideo(inputFile, outputDir, {
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
  console.log(`✓ Output: ${output3}`)

  // Example 4: VP9 encoding (alternative codec)
  console.log('\n4️⃣  Converting with VP9 codec (WebM output)...')
  const output4 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-c:v', 'libvpx-vp9',
      '-crf', '30',
      '-b:v', '0',
      '-cpu-used', '2',
      '-c:a', 'libopus',
      '-b:a', '128k'
    ]
  })
  console.log(`✓ Output: ${output4}`)

  // Example 5: Two-pass encoding for best quality/size ratio
  console.log('\n5️⃣  Converting with two-pass encoding...')
  // Note: Two-pass requires running ffmpeg twice
  const output5 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-b:v', '1M',
      '-maxrate', '1.5M',
      '-bufsize', '2M',
      '-profile:v', 'high',
      '-level', '4.0',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart'
    ]
  })
  console.log(`✓ Output: ${output5}`)

  // Example 6: Using hardware acceleration with custom params
  console.log('\n6️⃣  Converting with hardware acceleration (if available)...')
  const output6 = await convertVideo(inputFile, outputDir, {
    hwaccel: 'auto',  // Will use GPU if available
    customParams: [
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k'
    ]
  })
  console.log(`✓ Output: ${output6}`)

  // Example 7: Fix PTS timestamps + force frame rate (e.g. for broken WebM files)
  // Equivalent to: ffmpeg -fflags +genpts -i vid.webm -r 24 vid-4.mp4
  console.log('\n7️⃣  Converting with PTS generation + forced frame rate...')
  const output7 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-fflags', '+genpts', // Generate missing PTS timestamps (fixes broken/variable-PTS files)
      '-r', '24',           // Force 24fps output
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k'
    ]
  })
  console.log(`✓ Output: ${output7}`)

  // Example 8: Stream copy with experimental strict mode (no re-encoding)
  // Equivalent to: ffmpeg -i vid.webm -c:v copy -strict experimental out.mp4
  console.log('\n8️⃣  Converting with stream copy + experimental strict mode...')
  const output8 = await convertVideo(inputFile, outputDir, {
    customParams: [
      '-c:v', 'copy',          // Copy video stream without re-encoding (fastest!)
      '-c:a', 'aac',
      '-b:a', '128k',
      '-strict', 'experimental' // Allow experimental codecs/features
    ]
  })
  console.log(`✓ Output: ${output8}`)

  console.log('\n' + '='.repeat(60))
  console.log('✨ All examples completed successfully!')
  console.log('\nCustom parameters give you COMPLETE control:')
  console.log('  • Override ALL default encoding settings')
  console.log('  • Use any codec (H.264, VP9, HEVC, etc.)')
  console.log('  • Fine-tune every ffmpeg parameter')
  console.log('  • Create custom encoding profiles')
  console.log('\nIMPORTANT: When using customParams, you must specify ALL parameters')
  console.log('  including codec (-c:v), audio codec (-c:a), quality settings, etc.')
  console.log('  Only input/output and hwaccel are managed automatically.')
  console.log('\nSee tests/README.md for more examples and use cases.')
  console.log('='.repeat(60))
}

main().catch(error => {
  console.error('\n❌ Error:', error.message)
  process.exit(1)
})
