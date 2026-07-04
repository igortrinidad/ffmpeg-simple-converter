#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const APP_NAME_PATTERN = /^Mediacript.*\.dmg$/i;
const APPLICATIONS_DIR = '/Applications';

function fail(message) {
  console.error(`\n❌ ${message}`);
  process.exit(1);
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' });
}

function findLatestDmg() {
  const downloads = join(homedir(), 'Downloads');
  if (!existsSync(downloads)) {
    fail(`Pasta de Downloads não encontrada em ${downloads}`);
  }

  const candidates = readdirSync(downloads)
    .filter((name) => APP_NAME_PATTERN.test(name))
    .map((name) => {
      const fullPath = join(downloads, name);
      return { name, fullPath, mtime: statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    fail(
      `Nenhum arquivo "Mediacript*.dmg" encontrado em ${downloads}.\n` +
        'Baixe o instalador mais recente antes de rodar este comando.'
    );
  }

  return candidates[0];
}

function mountDmg(dmgPath) {
  const output = run('hdiutil', ['attach', dmgPath, '-nobrowse', '-noautoopen']);
  const line = output.split('\n').find((l) => l.includes('/Volumes/'));
  if (!line) {
    fail('Não foi possível identificar o ponto de montagem do DMG.');
  }
  return line.slice(line.indexOf('/Volumes/')).trim();
}

function detachDmg(mountPoint) {
  try {
    run('hdiutil', ['detach', mountPoint, '-quiet']);
  } catch {
    try {
      run('hdiutil', ['detach', mountPoint, '-force', '-quiet']);
    } catch {
      console.warn(`⚠️  Não foi possível ejetar ${mountPoint} automaticamente. Ejete manualmente pelo Finder.`);
    }
  }
}

function findAppInVolume(mountPoint) {
  const app = readdirSync(mountPoint).find((name) => name.endsWith('.app'));
  if (!app) {
    fail(`Nenhum arquivo .app encontrado dentro de ${mountPoint}.`);
  }
  return { name: app, fullPath: join(mountPoint, app) };
}

function installApp(sourcePath, destPath) {
  if (existsSync(destPath)) {
    rmSync(destPath, { recursive: true, force: true });
  }
  run('ditto', [sourcePath, destPath]);
}

function removeQuarantine(appPath) {
  run('xattr', ['-cr', appPath]);
}

function main() {
  if (process.platform !== 'darwin') {
    fail('Este comando só funciona no macOS.');
  }

  console.log('🔍 Procurando o Mediacript*.dmg mais recente em ~/Downloads...');
  const dmg = findLatestDmg();
  console.log(`📦 Encontrado: ${dmg.name}`);

  console.log('💿 Montando o DMG...');
  const mountPoint = mountDmg(dmg.fullPath);

  try {
    const app = findAppInVolume(mountPoint);
    const destPath = join(APPLICATIONS_DIR, app.name);

    console.log(`📲 Instalando em ${destPath}...`);
    installApp(app.fullPath, destPath);

    console.log('⏏️  Ejetando o DMG...');
    detachDmg(mountPoint);

    console.log('🔓 Removendo a quarentena do Gatekeeper...');
    removeQuarantine(destPath);

    console.log('🚀 Abrindo o Mediacript...');
    run('open', [destPath]);

    console.log('\n✅ Pronto! O Mediacript foi instalado e liberado.');
  } catch (error) {
    detachDmg(mountPoint);
    throw error;
  }
}

try {
  main();
} catch (error) {
  fail(error.message ?? String(error));
}
