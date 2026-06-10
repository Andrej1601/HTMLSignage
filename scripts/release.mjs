#!/usr/bin/env node
/**
 * Release-Helfer für das HTMLSignage-Monorepo.
 *
 * Setzt die App-Version in root + backend + frontend package.json synchron,
 * committet den Bump und legt einen passenden Git-Tag `v<version>` an.
 *
 * WARUM: Das in-App-Systemupdate liest die Version aus der Root-package.json
 * (`readLocalVersion`). Nur wenn diese Version mit dem Release-Tag übereinstimmt,
 * zeigt die Admin-Konsole die richtige Version an UND erkennt neue Releases.
 *
 * Nutzung:
 *   npm run release -- 1.2.0
 *   node scripts/release.mjs 1.2.0
 *
 * Danach (in deinem Terminal):
 *   git push origin HEAD          # Bump-Commit pushen
 *   git push origin v1.2.0        # Tag pushen
 *   → auf GitHub: "Draft a new release" aus dem Tag v1.2.0 erstellen.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const version = (process.argv[2] || '').replace(/^v/, '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('✗ Bitte eine Version im Format x.y.z angeben, z.B.:  npm run release -- 1.2.0');
  process.exit(1);
}
const tag = `v${version}`;

// Vorbedingung: sauberer Arbeitsbaum (sonst landet Fremdes im Release-Commit).
const dirty = execSync('git status --porcelain', { cwd: repoRoot }).toString().trim();
if (dirty) {
  console.error('✗ Arbeitsbaum ist nicht sauber. Bitte erst committen/stashen:\n' + dirty);
  process.exit(1);
}

// Vorbedingung: Tag darf noch nicht existieren.
try {
  execSync(`git rev-parse ${tag}`, { cwd: repoRoot, stdio: 'ignore' });
  console.error(`✗ Tag ${tag} existiert bereits. Andere Version wählen oder Tag zuerst löschen.`);
  process.exit(1);
} catch { /* Tag ist frei – gut */ }

// Version in den drei App-Paketen setzen (nur die erste "version"-Zeile = die
// Paketversion; minimaler Diff statt komplettem Re-Format).
const files = ['package.json', 'packages/backend/package.json', 'packages/frontend/package.json'];
for (const rel of files) {
  const abs = path.join(repoRoot, rel);
  const content = readFileSync(abs, 'utf8');
  const next = content.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`);
  if (next === content) {
    console.error(`✗ Konnte version in ${rel} nicht ersetzen.`);
    process.exit(1);
  }
  writeFileSync(abs, next);
  console.log(`✓ ${rel} → ${version}`);
}

const run = (cmd) => execSync(cmd, { cwd: repoRoot, stdio: 'inherit' });
run(`git add ${files.join(' ')}`);
run(`git commit -m "chore(release): ${tag}"`);
run(`git tag ${tag}`);

console.log(`\n✓ Bump-Commit und Tag ${tag} erstellt.`);
console.log('Nächste Schritte:');
console.log('  git push origin HEAD');
console.log(`  git push origin ${tag}`);
console.log(`  → GitHub: "Draft a new release" aus Tag ${tag} erstellen.`);
