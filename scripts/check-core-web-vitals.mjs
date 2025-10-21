#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.resolve(projectRoot, 'webroot/admin/dist');
const assetsDir = path.join(distDir, 'assets');

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function collectFiles() {
  let entries;
  try {
    entries = await fs.readdir(assetsDir);
  } catch (error) {
    console.error('Admin dist assets directory not found. Run "npm run build:admin" first.');
    throw error;
  }

  const entryFile = entries.find((file) => file === 'admin.js');
  if (!entryFile) {
    throw new Error('admin.js entry bundle missing from dist output.');
  }

  const chunkFiles = entries.filter((file) => file.endsWith('.js') && file !== entryFile);
  if (chunkFiles.length === 0) {
    throw new Error('No code-split chunks detected. Dynamic import configuration may be missing.');
  }

  const cssFiles = entries.filter((file) => file.endsWith('.css'));
  return { entryFile, chunkFiles, cssFiles };
}

async function readFileInfo(fileName) {
  const fullPath = path.join(assetsDir, fileName);
  const buffer = await fs.readFile(fullPath);
  const gzipSize = gzipSync(buffer).length;
  return {
    fileName,
    size: buffer.length,
    gzipSize
  };
}

async function main() {
  const { entryFile, chunkFiles, cssFiles } = await collectFiles();
  const initialFiles = [entryFile, ...cssFiles];
  const initialInfos = await Promise.all(initialFiles.map(readFileInfo));
  const chunkInfos = await Promise.all(chunkFiles.map(readFileInfo));

  const totalInitialBytes = initialInfos.reduce((sum, info) => sum + info.size, 0);
  const totalInitialGzip = initialInfos.reduce((sum, info) => sum + info.gzipSize, 0);
  const entryInfo = initialInfos.find((info) => info.fileName === entryFile);

  const BYTES_PER_MS = 1250; // ~10 Mbps connection
  const BASE_LATENCY_MS = 120;
  const fcpMs = BASE_LATENCY_MS + totalInitialGzip / BYTES_PER_MS;
  const lcpMs = fcpMs + entryInfo.gzipSize / (BYTES_PER_MS * 0.6);

  const THRESHOLDS = {
    fcpMs: 1800,
    lcpMs: 2500,
    initialBytes: 450_000,
    entryGzip: 180_000
  };

  const results = [
    { name: 'Approx. First Contentful Paint', value: fcpMs, threshold: THRESHOLDS.fcpMs, better: '<=' },
    { name: 'Approx. Largest Contentful Paint', value: lcpMs, threshold: THRESHOLDS.lcpMs, better: '<=' },
    { name: 'Initial payload (raw bytes)', value: totalInitialBytes, threshold: THRESHOLDS.initialBytes, better: '<=' },
    { name: 'Entry bundle (gzipped)', value: entryInfo.gzipSize, threshold: THRESHOLDS.entryGzip, better: '<=' }
  ];

  console.log('Core Web Vitals budget check (approximated):');
  let ok = true;
  for (const metric of results) {
    const meets = metric.value <= metric.threshold;
    ok = ok && meets;
    const status = meets ? '✅' : '❌';
    const displayValue = metric.name.includes('Paint')
      ? `${metric.value.toFixed(0)} ms`
      : formatBytes(metric.value);
    const displayThreshold = metric.name.includes('Paint')
      ? `${metric.threshold.toFixed(0)} ms`
      : formatBytes(metric.threshold);
    console.log(`  ${status} ${metric.name}: ${displayValue} (budget ${metric.better} ${displayThreshold})`);
  }

  console.log(`Detected ${chunkFiles.length} lazy chunks: ${chunkInfos.map((info) => info.fileName).join(', ')}`);

  if (!ok) {
    throw new Error('Core Web Vitals budget exceeded.');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
