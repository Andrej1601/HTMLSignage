#!/usr/bin/env node
// @ts-check
/* eslint-disable no-console */

/**
 * Scaffold a new design pack from the starter template.
 *
 * Usage:
 *   pnpm new-design <id> [--name "Display Name"] [--description "…"]
 *
 * Example:
 *   pnpm new-design mineral-noir --name "Mineral Noir" \
 *     --description "Architektonischer Dark-Luxus."
 *
 * What it does:
 *  1. Validates the id (kebab-case, no scope, not already used).
 *  2. Copies `packages/design-sdk/templates/starter/` into
 *     `packages/designs/<id>/`, substituting {{DESIGN_*}} placeholders.
 *  3. Adds `@htmlsignage/design-<id>` to `packages/frontend`'s deps.
 *  4. Prints the next manual step: register the pack in
 *     `packages/frontend/src/designs/registry.ts`.
 *
 * The generated pack compiles and renders out of the box — every
 * renderer is a minimal but functional stub styled via tokens.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

// ── Argument parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = { name: null, description: null };
const positionals = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--name' || a === '-n') {
    flags.name = args[++i] ?? null;
  } else if (a === '--description' || a === '-d') {
    flags.description = args[++i] ?? null;
  } else if (a === '--help' || a === '-h') {
    printUsage();
    process.exit(0);
  } else if (a.startsWith('--')) {
    fail(`Unknown flag: ${a}`);
  } else {
    positionals.push(a);
  }
}

const id = positionals[0];
if (!id) {
  printUsage();
  process.exit(1);
}

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
if (!ID_RE.test(id)) {
  fail(
    `Invalid design id "${id}". Must be lowercase kebab-case (letters, digits, hyphens), start with a letter. Examples: mineral-noir, editorial-resort.`,
  );
}

const displayName = flags.name ?? toTitleCase(id);
const description = flags.description ?? `${displayName} design pack.`;
const camelName = toCamel(id);

// ── Paths ───────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkRoot = path.resolve(here, '..');              // packages/design-sdk
const repoRoot = path.resolve(sdkRoot, '..', '..');    // repo root
const templateRoot = path.join(sdkRoot, 'templates', 'starter');
const packDir = path.join(repoRoot, 'packages', 'designs', id);
const frontendPackageJson = path.join(repoRoot, 'packages', 'frontend', 'package.json');
const registryPath = path.join(
  repoRoot,
  'packages',
  'frontend',
  'src',
  'designs',
  'registry.ts',
);

// ── Preflight ───────────────────────────────────────────────────────────────

await assertExists(templateRoot, 'Template directory missing — re-run `pnpm install` or fix the SDK install.');
await assertExists(frontendPackageJson, 'Host frontend not found at expected path.');

if (await pathExists(packDir)) {
  fail(`Pack directory already exists: ${relativeToRepo(packDir)}. Remove it first or pick a different id.`);
}

// ── Substitution map ────────────────────────────────────────────────────────

const substitutions = {
  '{{DESIGN_ID}}': id,
  '{{DESIGN_NAME}}': displayName,
  '{{DESIGN_DESCRIPTION}}': description,
  '{{DESIGN_CAMEL}}': camelName,
};

function applySubstitutions(contents) {
  let out = contents;
  for (const [from, to] of Object.entries(substitutions)) {
    out = out.split(from).join(to);
  }
  return out;
}

// ── Copy template → pack dir ────────────────────────────────────────────────

await fs.mkdir(packDir, { recursive: true });
await copyTemplateTree(templateRoot, packDir);

console.log(`✔ Created ${relativeToRepo(packDir)}`);

// ── Wire into frontend package.json ────────────────────────────────────────

const pkgText = await fs.readFile(frontendPackageJson, 'utf8');
const pkg = JSON.parse(pkgText);
const depName = `@htmlsignage/design-${id}`;
pkg.dependencies = pkg.dependencies || {};
if (!pkg.dependencies[depName]) {
  pkg.dependencies[depName] = 'workspace:*';
  // Keep deps alphabetically-ish sorted for stable diffs.
  pkg.dependencies = Object.fromEntries(
    Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)),
  );
  await fs.writeFile(frontendPackageJson, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`✔ Added "${depName}" to ${relativeToRepo(frontendPackageJson)}`);
} else {
  console.log(`• "${depName}" already in frontend dependencies — skipped.`);
}

// ── Final instructions ──────────────────────────────────────────────────────

printNextSteps({ id, displayName, camelName, depName });

// ── Helpers ─────────────────────────────────────────────────────────────────

function toTitleCase(kebab) {
  return kebab
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function toCamel(kebab) {
  const [first, ...rest] = kebab.split('-');
  return first + rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function assertExists(p, msg) {
  if (!(await pathExists(p))) fail(`${msg}\n  Expected: ${p}`);
}

async function copyTemplateTree(srcDir, destDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    // Strip the `.tmpl` suffix on copy so the generated pack has clean
    // real-world filenames (e.g. `package.json`, not `package.json.tmpl`).
    const destName = entry.name.endsWith('.tmpl')
      ? entry.name.slice(0, -'.tmpl'.length)
      : entry.name;
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyTemplateTree(srcPath, destPath);
      continue;
    }

    const raw = await fs.readFile(srcPath, 'utf8');
    const substituted = applySubstitutions(raw);
    await fs.writeFile(destPath, substituted);
  }
}

function relativeToRepo(p) {
  return path.relative(repoRoot, p) || '.';
}

function printUsage() {
  console.log(`
Usage: pnpm new-design <id> [--name "Display Name"] [--description "..."]

Arguments:
  <id>               Kebab-case identifier (e.g. mineral-noir). Becomes
                     the package name @htmlsignage/design-<id> and the
                     folder name under packages/designs/.

Options:
  --name, -n         Human-readable display name. Defaults to a title-
                     cased version of <id>.
  --description, -d  One-line description for the manifest + package.json.
  --help, -h         Show this help.

Example:
  pnpm new-design mineral-noir \\
    --name "Mineral Noir" \\
    --description "Architektonischer Dark-Luxus."
`);
}

function printNextSteps({ id, displayName, camelName, depName }) {
  const registryRelPath = relativeToRepo(registryPath);
  console.log(`
✨ Pack "${displayName}" scaffolded.

Next steps:

  1. Install the new workspace dep:

       pnpm install

  2. Register the pack in ${registryRelPath} — add the DesignId
     union member and a lazy loader entry:

       export type DesignId = 'wellness-classic' | '${id}';

       export const DESIGN_REGISTRY: Record<DesignId, () => Promise<Design>> = {
         'wellness-classic': () =>
           import('@htmlsignage/design-wellness-classic').then((m) => m.wellnessClassicDesign),
         '${id}': () =>
           import('${depName}').then((m) => m.${camelName}Design),
       };

  3. Iterate on the pack:
       - Edit tokens:     packages/designs/${id}/src/tokens.ts
       - Edit manifest:   packages/designs/${id}/src/manifest.ts
       - Edit renderers:  packages/designs/${id}/src/slides/*.tsx

  4. Select the pack on a device by setting
        settings.display.designPackId = '${id}'
     and flipping on settings.display.useDesignPacks.

Happy designing! 🎨
`);
}

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}
