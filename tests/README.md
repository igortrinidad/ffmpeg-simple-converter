# Mediacript Tests

This directory contains the test suite for the Mediacript library.

## Test Structure

```
tests/
├── utils/              # Unit tests for utility functions
│   └── ffmpegOperations.test.ts
└── performance/        # Performance benchmarking tests
    └── compression.test.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Performance Tests Only
```bash
npm run test:performance
```

### With Coverage Report
```bash
npm run test:coverage
```

## Performance Tests

The performance tests (`tests/performance/compression.test.ts`) benchmark different compression settings for WebM files:

### What It Tests

1. **Preset Performance Comparison**
   - Tests different encoding presets: `ultrafast`, `veryfast`, `fast`, `medium`, `slow`
   - Measures encoding time, output size, and compression ratio for each
   - Provides recommendations based on use case

2. **CRF (Quality) Comparison**
   - Tests different quality levels (CRF 18, 23, 28)
   - Shows trade-offs between file size and quality
   - Helps choose the right CRF for your needs

3. **Custom Parameters**
   - Tests custom ffmpeg parameter functionality
   - Examples: pixel format, tune parameters, profile settings

### Understanding Results

The performance tests output detailed summaries:

```
WEBM COMPRESSION PERFORMANCE SUMMARY
================================================================================
Preset       | Duration  | Output Size | Compression | Quality/Speed
--------------------------------------------------------------------------------
ultrafast    | 2.45s     | 3.21 MB     | 2.15x       | Real-time
fast         | 5.12s     | 2.87 MB     | 2.41x       | Fast encoding
medium       | 8.34s     | 2.65 MB     | 2.61x       | Balanced ⭐
slow         | 15.67s    | 2.43 MB     | 2.84x       | High quality

RECOMMENDATIONS:
• Fastest encoding: ultrafast (2.45s)
• Smallest file: slow (2.43 MB)
• Best compression: slow (2.84x)

FOR PRODUCTION:
• Real-time/streaming: Use "ultrafast" or "veryfast"
• Balanced (recommended): Use "fast" or "medium"
• Archive/quality: Use "slow" or "slower"
```

### Performance Test Tips

- Tests require `ffmpeg` to be installed on your system
- Tests create temporary files in your system's temp directory
- Tests automatically clean up after completion
- Allow 2-3 minutes per preset test (adjustable via `testTimeout` in jest.config.js)
- For faster testing during development, comment out slower presets

## Custom FFmpeg Parameters

The `convertVideo` function supports custom ffmpeg parameters that **completely replace** all default encoding parameters. When `customParams` is provided, you have full control over the encoding process.

**Important:** Custom parameters override ALL default settings (codec, preset, crf, audio, etc.). Only input/output files and hardware acceleration (if specified) are managed automatically.

```typescript
import { convertVideo } from 'mediacript'

// Example 1: Complete custom H.264 encoding
await convertVideo('input.webm', './output', {
  customParams: [
    '-c:v', 'libx264',      // Video codec
    '-preset', 'fast',       // Encoding speed
    '-crf', '23',            // Quality
    '-pix_fmt', 'yuv420p',   // Pixel format
    '-c:a', 'aac',           // Audio codec
    '-b:a', '128k'           // Audio bitrate
  ]
})

// Example 2: VP9 encoding (WebM)
await convertVideo('input.webm', './output', {
  customParams: [
    '-c:v', 'libvpx-vp9',
    '-crf', '30',
    '-b:v', '0',
    '-cpu-used', '2',
    '-c:a', 'libopus',
    '-b:a', '128k'
  ]
})

// Example 3: High-quality film encoding
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

// Example 4: With hardware acceleration
await convertVideo('input.webm', './output', {
  hwaccel: 'auto',  // GPU acceleration if available
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

**What gets replaced:**
- ✅ Video codec (`-c:v`)
- ✅ Preset (`-preset`)
- ✅ Quality settings (`-crf`, `-qp`, etc.)
- ✅ Audio codec and settings (`-c:a`, `-b:a`)
- ✅ All optimization flags (`-movflags`, `-tune`, etc.)
- ✅ Threads, pixel format, and any other parameters

**What stays automatic:**
- ❌ Input file (`-i input`)
- ❌ Output file with `-y` flag
- ❌ Hardware acceleration (`-hwaccel`) if specified via `hwaccel` option
```

## Requirements

- Node.js >= 16
- ffmpeg installed and available in PATH
- ffprobe (usually comes with ffmpeg)

## Testing Your Installation

To verify ffmpeg is correctly installed:

```bash
ffmpeg -version
ffprobe -version
```

Both commands should return version information.

## Troubleshooting

### Tests Timeout

If tests timeout, increase the timeout in `jest.config.js`:

```javascript
testTimeout: 300000  // 5 minutes
```

### FFmpeg Not Found

Ensure ffmpeg is in your PATH:

- **Linux**: `sudo apt install ffmpeg` or `sudo dnf install ffmpeg`
- **macOS**: `brew install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org)

### Memory Issues

For very large test videos, you might need to increase Node's memory:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm test
```
