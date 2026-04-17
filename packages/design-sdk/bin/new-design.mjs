#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Scaffolder for a new HTMLSignage design pack.
 *
 * Usage:
 *   pnpm new-design <kebab-id> [--name "Human Name"]
 *
 * Copies the template at `packages/design-sdk/templates/design-pack/`
 * into `packages/designs/<kebab-id>/`, substituting placeholders for
 * the design id + human name + camelCase export name.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = path.resolve(SCRIPT_DIR, '..');
const REPO_ROOT = path.resolve(SDK_ROOT, '..', '..');
const TEMPLATE_DIR = path.join(SDK_ROOT, 'templates', 'design-pack');
const TARGET_PARENT = path.join(REPO_ROOT, 'packages', 'designs');

const KEBAB_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function parseArgs(argv) {
  const args = { id: null, name: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--name') {
      args.name = argv[i + 1];
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (!args.id && !arg.startsWith('-')) {
      args.id = arg;
    }
  }
  return args;
}

function usage() {
  console.log(`
Usage: pnpm new-design <kebab-id> [--name "Human Name"]

  <kebab-id>     Lowercase kebab-case id (e.g. "modern-oasis").
  --name         Optional human-readable name. Defaults to Title Case
                 of the id.

Example:
  pnpm new-design modern-oasis --name "Modern Oasis"
`);
}

function toCamelCase(id) {
  return id
    .split('-')
    .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function toTitleCase(id) {
  return id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function substitute(content, vars) {
  return content
    .replaceAll('{{designId}}', vars.designId)
    .replaceAll('{{designIdCamel}}', vars.designIdCamel)
    .replaceAll('{{designName}}', vars.designName);
}

const UNDERSCORED = new Set(['_package.json', '_vitest.config.ts']);

function mapTargetName(name) {
  if (UNDERSCORED.has(name)) return name.slice(1);
  return name;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(srcDir, destDir, vars) {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, mapTargetName(entry.name));
    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath, vars);
    } else if (entry.isFile()) {
      const raw = await fs.readFile(srcPath, 'utf-8');
      const out = substitute(raw, vars);
      await fs.writeFile(destPath, out, 'utf-8');
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.id) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const designId = args.id;
  if (!KEBAB_RE.test(designId)) {
    console.error(
      `error: "${designId}" is not a valid kebab-case id (e.g. "modern-oasis").`,
    );
    process.exit(1);
  }

  if (designId === 'wellness-classic') {
    console.error('error: "wellness-classic" already exists.');
    process.exit(1);
  }

  const designIdCamel = toCamelCase(designId);
  const designName = args.name || toTitleCase(designId);

  const targetDir = path.join(TARGET_PARENT, designId);
  if (await exists(targetDir)) {
    console.error(`error: ${path.relative(REPO_ROOT, targetDir)} already exists. Aborting.`);
    process.exit(1);
  }

  console.log(`Scaffolding "${designName}" (${designId})…`);
  await copyTree(TEMPLATE_DIR, targetDir, { designId, designIdCamel, designName });

  const relTarget = path.relative(REPO_ROOT, targetDir);
  console.log(`
✓ Design pack created at ${relTarget}/

Next steps:
  1. pnpm install                                    # link the new workspace
  2. Add to packages/frontend/package.json:
       "@htmlsignage/design-${designId}": "workspace:*",
  3. Add to packages/frontend/src/designs/registry.ts:
       type DesignId = 'wellness-classic' | '${designId}';
       '${designId}': () => import('@htmlsignage/design-${designId}')
                             .then((m) => m.${designIdCamel}Design),
  4. pnpm -F @htmlsignage/design-${designId} test    # verify the contract

See ${relTarget}/README.md for the full integration snippet.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
