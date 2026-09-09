// Swaps packages/desktop/node_modules/mediacript from a live symlink (great for
// `npm run dev`, since it always reflects the latest build of packages/cli) to a
// real, minimal copy containing only what `npm pack` would publish (dist/ + package.json).
//
// electron-builder walks node_modules to decide what to bundle; a `file:../cli`
// dependency is a symlink to the whole CLI package folder, and electron-builder
// ends up bundling everything reachable through it (tests/, examples/, its own
// node_modules with all devDependencies, ...) regardless of the `files` allowlist
// in packages/cli/package.json — ballooning the installer from ~150MB to several
// GB. Packing first guarantees electron-builder only ever sees the same clean
// folder a real npm install of the published package would produce.
//
// Extraction uses the `tar` npm package (not the system `tar` binary):
// invoking a shell `tar -xzf` with a Windows path like "C:\Users\..." makes
// GNU tar treat the leading "C:" as a remote host spec ("user@host:path"),
// failing with "Cannot connect to C: resolve failed" — the JS API sidesteps
// that entirely and behaves the same on every OS.
//
// Run `npm install` afterwards to restore the symlink for local development.

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as tar from 'tar'

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cliDir = path.resolve(desktopDir, '..', 'cli')
const mediacriptModulePath = path.join(desktopDir, 'node_modules', 'mediacript')

console.log('📦 Building packages/cli and packing a clean copy for the installer...')

execSync('npm run build', { cwd: cliDir, stdio: 'inherit' })

// Must live on the same drive as `mediacriptModulePath` (not os.tmpdir()) so the
// renameSync below is a same-device move — on Windows CI runners the OS temp dir
// (C:\Users\...\Temp) and the checkout (D:\a\...) are on different drives, and
// cross-device renames fail with EXDEV.
const tmpDir = fs.mkdtempSync(path.join(desktopDir, 'node_modules', '.mediacript-pack-'))
const packOutput = execSync('npm pack --pack-destination "' + tmpDir + '"', { cwd: cliDir }).toString().trim()
const tarballName = packOutput.split('\n').pop().trim()
const tarballPath = path.join(tmpDir, tarballName)

await tar.x({ file: tarballPath, cwd: tmpDir })

const extractedPath = path.join(tmpDir, 'package')

// The tarball has no node_modules, and mediacript's runtime dependencies
// (axios, inquirer, openai, ...) are NOT installed in packages/desktop/node_modules
// — they live in packages/cli/node_modules, which is nowhere along the resolution
// path of packages/desktop. Both Node at runtime and electron-builder's dependency
// collector resolve a package's imports starting from its own folder, so the copy
// has to carry them itself, otherwise the installed app crashes on launch with
// ERR_MODULE_NOT_FOUND (dist/esm/lib.js pulls in inquirer through config/index.js).
//
// Installed here, before the move, so npm never runs with a cwd inside node_modules.
console.log('📥 Installing mediacript production dependencies into the packed copy...')
execSync('npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund --no-package-lock', {
  cwd: extractedPath,
  stdio: 'inherit'
})

fs.rmSync(mediacriptModulePath, { recursive: true, force: true })
fs.renameSync(extractedPath, mediacriptModulePath)
fs.rmSync(tmpDir, { recursive: true, force: true })

console.log('✓ node_modules/mediacript replaced with a clean dist-only copy (run "npm install" to restore the dev symlink)')
