import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const schemaPath = path.resolve(projectRoot, 'webroot/admin/schema/device_fields.json');
const phpPath = path.resolve(projectRoot, 'webroot/admin/api/devices_store.php');
const jsPath = path.resolve(projectRoot, 'webroot/admin/js/core/device_service.js');

const PHP_START_MARKER = '// >>> GENERATED: DEVICE_FIELD_CONFIG >>>';
const PHP_END_MARKER = '// <<< GENERATED: DEVICE_FIELD_CONFIG <<<';
const JS_START_MARKER = '// >>> GENERATED: DEVICE_FIELD_CONFIG >>>';
const JS_END_MARKER = '// <<< GENERATED: DEVICE_FIELD_CONFIG <<<';

function readSchema() {
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw);
}

function buildFieldConfig(fields) {
  const result = {};
  fields.forEach((field) => {
    const seen = new Set();
    const aliases = [];
    [field.name, ...(field.aliases ?? [])].forEach((alias) => {
      if (!alias || seen.has(alias)) {
        return;
      }
      seen.add(alias);
      aliases.push(alias);
    });
    const config = {
      type: field.type,
      aliases
    };
    if (field.type === 'string' && typeof field.maxLength === 'number') {
      config.maxLength = field.maxLength;
    }
    if (field.type === 'number') {
      if (typeof field.min === 'number') {
        config.min = field.min;
      }
      if (typeof field.max === 'number') {
        config.max = field.max;
      }
      if (field.integer) {
        config.integer = true;
      }
      if (field.round) {
        config.round = field.round;
      }
    }
    result[field.name] = config;
  });
  return result;
}

function formatPhpValue(value, indent = 0) {
  const indentStr = '    '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map((item) => `${'    '.repeat(indent + 1)}${formatPhpValue(item, indent + 1)},`);
    return `[
${items.join('\n')}\n${indentStr}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '[]';
    }
    const lines = entries.map(([key, val]) => {
      const formatted = formatPhpValue(val, indent + 1);
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `${'    '.repeat(indent + 1)}'${escapedKey}' => ${formatted},`;
    });
    return `[
${lines.join('\n')}\n${indentStr}]`;
  }
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function formatJsValue(value, indent = 0) {
  const indentStr = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    const items = value.map((item) => `${'  '.repeat(indent + 1)}${formatJsValue(item, indent + 1)},`);
    return `[
${items.join('\n')}\n${indentStr}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return '{}';
    }
    const lines = entries.map(([key, val]) => {
      const formatted = formatJsValue(val, indent + 1);
      const isIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
      const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const renderedKey = isIdentifier ? key : `'${escapedKey}'`;
      return `${'  '.repeat(indent + 1)}${renderedKey}: ${formatted},`;
    });
    return `{
${lines.join('\n')}\n${indentStr}}`;
  }
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

function updateSection(filePath, startMarker, endMarker, generated) {
  const content = fs.readFileSync(filePath, 'utf8');
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Missing start marker ${startMarker} in ${filePath}`);
  }
  const endIndex = content.indexOf(endMarker, startIndex);
  if (endIndex === -1) {
    throw new Error(`Missing end marker ${endMarker} in ${filePath}`);
  }
  const before = content.slice(0, startIndex + startMarker.length);
  const after = content.slice(endIndex);
  const between = `\n${generated}\n`;
  const updated = `${before}${between}${after}`;
  fs.writeFileSync(filePath, updated);
}

function generate() {
  const schema = readSchema();
  const statusConfig = buildFieldConfig(schema.status.fields);
  const networkConfig = buildFieldConfig(schema.network.fields);
  const metricsConfig = buildFieldConfig(schema.metrics.fields);

  const phpGenerated = [
    `const DEVICES_STATUS_FIELD_CONFIG = ${formatPhpValue(statusConfig)};`,
    `const DEVICES_NETWORK_FIELD_CONFIG = ${formatPhpValue(networkConfig)};`,
    `const DEVICES_METRIC_FIELD_CONFIG = ${formatPhpValue(metricsConfig)};`
  ].join('\n\n');

  const jsGenerated = [
    `const DEVICE_STATUS_FIELD_CONFIG = ${formatJsValue(Object.entries(statusConfig).map(([name, config]) => ({ name, ...config }))) };`,
    `const DEVICE_NETWORK_FIELD_CONFIG = ${formatJsValue(Object.entries(networkConfig).map(([name, config]) => ({ name, ...config }))) };`,
    `const DEVICE_METRIC_FIELD_CONFIG = ${formatJsValue(Object.entries(metricsConfig).map(([name, config]) => ({ name, ...config }))) };`,
    [
      'export const DEVICE_FIELD_CONFIG = {',
      '  status: DEVICE_STATUS_FIELD_CONFIG,',
      '  network: DEVICE_NETWORK_FIELD_CONFIG,',
      '  metrics: DEVICE_METRIC_FIELD_CONFIG',
      '};'
    ].join('\n')
  ].join('\n\n');

  updateSection(phpPath, PHP_START_MARKER, PHP_END_MARKER, phpGenerated);
  updateSection(jsPath, JS_START_MARKER, JS_END_MARKER, jsGenerated);
}

generate();
