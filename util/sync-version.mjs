#!/usr/bin/env node

// Keeps every package in packages/* on the same version as the repo root.
//
// The root package.json is the single source of truth for "the Mediacript
// version": it is what the release workflow bumps and what the git tag /
// GitHub Release are named after. Both packages must follow it — the desktop
// app shows its own version in the UI, and the CLI is published to npm with it.
//
//   node util/sync-version.mjs           # apply the root version to packages/*
//   node util/sync-version.mjs 1.3.0     # set the root to 1.3.0, then apply it
//   node util/sync-version.mjs patch     # bump the root patch, then apply it
//
// `npm version` is used (rather than editing JSON by hand) so each package's
// package-lock.json gets its version field updated too — otherwise `npm ci`
// fails in CI with a lockfile-out-of-sync error.

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packagesDir = path.join(rootDir, 'packages')

const VALID_VERSION_ARG =
  /^(major|minor|patch|premajor|preminor|prepatch|prerelease|\d+\.\d+\.\d+[\w.+-]*)$/

// Runs through a shell (execSync, not execFileSync) because on Windows npm is a
// .cmd shim, which Node refuses to execFile directly since the CVE-2024-27980
// fix. Everything interpolated here is either read from package.json or matched
// against VALID_VERSION_ARG first, so nothing shell-special reaches the command.
const runNpmVersion = (cwd, versionArg) =>
  execSync(`npm version ${versionArg} --no-git-tag-version --allow-same-version`, {
    cwd,
    encoding: 'utf8'
  }).trim()

const requested = process.argv[2]

if (requested) {
  if (!VALID_VERSION_ARG.test(requested)) {
    console.error(`Versão inválida: "${requested}". Use um semver (1.3.0) ou um bump (patch/minor/major).`)
    process.exit(1)
  }
  runNpmVersion(rootDir, requested)
}

const { version } = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

const packages = fs
  .readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .filter((entry) => fs.existsSync(path.join(packagesDir, entry.name, 'package.json')))

for (const entry of packages) {
  runNpmVersion(path.join(packagesDir, entry.name), version)
  console.log(`✓ packages/${entry.name} → ${version}`)
}

console.log(`\nMediacript is now at v${version} (root + ${packages.length} package(s))`)
