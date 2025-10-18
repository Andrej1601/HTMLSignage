'use strict';

import { fetchJson } from './utils.js';

const API_BASE = '/admin/api';
const API_ENDPOINTS = {
  list: `${API_BASE}/devices_list.php`,
  claim: `${API_BASE}/devices_claim.php`,
  setMode: `${API_BASE}/devices_set_mode.php`,
  unpair: `${API_BASE}/devices_unpair.php`,
  rename: `${API_BASE}/devices_rename.php`,
  cleanup: `${API_BASE}/devices_gc.php`
};

const FALLBACK_PATH = '/data/devices.json';
export const OFFLINE_AFTER_MIN = 2;
const SNAPSHOT_CACHE_MS = 1500;

// >>> GENERATED: DEVICE_FIELD_CONFIG >>>
const DEVICE_STATUS_FIELD_CONFIG = [
  {
    name: 'firmware',
    type: 'string',
    aliases: [
      'firmware',
      'version',
    ],
    maxLength: 100,
  },
  {
    name: 'appVersion',
    type: 'string',
    aliases: [
      'appVersion',
      'player',
    ],
    maxLength: 100,
  },
  {
    name: 'ip',
    type: 'string',
    aliases: [
      'ip',
      'address',
    ],
    maxLength: 64,
  },
  {
    name: 'notes',
    type: 'string',
    aliases: [
      'notes',
    ],
    maxLength: 180,
  },
];

const DEVICE_NETWORK_FIELD_CONFIG = [
  {
    name: 'type',
    type: 'string',
    aliases: [
      'type',
      'interface',
    ],
    maxLength: 40,
  },
  {
    name: 'ssid',
    type: 'string',
    aliases: [
      'ssid',
      'networkName',
    ],
    maxLength: 64,
  },
  {
    name: 'quality',
    type: 'number',
    aliases: [
      'quality',
      'signalQuality',
      'linkQuality',
      'strength',
    ],
    min: 0,
    max: 100,
    integer: true,
    round: 'nearest',
  },
  {
    name: 'signal',
    type: 'number',
    aliases: [
      'signal',
      'dbm',
      'wifiSignal',
      'strength',
      'rssi',
    ],
  },
  {
    name: 'rssi',
    type: 'number',
    aliases: [
      'rssi',
    ],
    integer: true,
    round: 'nearest',
  },
  {
    name: 'latency',
    type: 'number',
    aliases: [
      'latency',
    ],
    min: 0,
  },
];

const DEVICE_METRIC_FIELD_CONFIG = [
  {
    name: 'cpuLoad',
    type: 'number',
    aliases: [
      'cpuLoad',
      'cpu',
      'cpu_usage',
      'cpuPercent',
      'cpuLoadPercent',
    ],
  },
  {
    name: 'memoryUsage',
    type: 'number',
    aliases: [
      'memoryUsage',
      'memory',
      'ram',
      'memoryPercent',
      'memUsage',
      'ramUsage',
    ],
  },
  {
    name: 'storageFree',
    type: 'number',
    aliases: [
      'storageFree',
      'storage_free',
      'storageFreeMb',
      'diskFree',
      'diskFreeMb',
      'freeStorage',
    ],
  },
  {
    name: 'storageUsed',
    type: 'number',
    aliases: [
      'storageUsed',
      'storage_used',
      'storageUsedMb',
      'diskUsed',
      'diskUsedMb',
      'usedStorage',
    ],
  },
  {
    name: 'temperature',
    type: 'number',
    aliases: [
      'temperature',
      'temp',
      'temperatureC',
      'tempC',
    ],
  },
  {
    name: 'uptime',
    type: 'number',
    aliases: [
      'uptime',
      'upTimeSeconds',
      'uptimeSeconds',
      'uptimeSec',
    ],
  },
  {
    name: 'batteryLevel',
    type: 'number',
    aliases: [
      'batteryLevel',
      'battery',
      'batteryPercent',
      'battery_level',
    ],
  },
  {
    name: 'latency',
    type: 'number',
    aliases: [
      'latency',
      'ping',
    ],
  },
];

export const DEVICE_FIELD_CONFIG = {
  status: DEVICE_STATUS_FIELD_CONFIG,
  network: DEVICE_NETWORK_FIELD_CONFIG,
  metrics: DEVICE_METRIC_FIELD_CONFIG
};
// <<< GENERATED: DEVICE_FIELD_CONFIG <<<

const okPredicate = (data) => data?.ok !== false;

export function normalizeSeconds(value) {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num > 1e12) return Math.floor(num / 1000);
  if (num > 1e10) return Math.floor(num / 1000);
  return Math.floor(num);
}

export function resolveNowSeconds(value) {
  if (value === undefined || value === null) return normalizeSeconds(Date.now());
  return normalizeSeconds(value);
}

function optionalString(value, maxLength = 120) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' || typeof value === 'function') return null;
  const string = String(value).trim();
  if (!string) return null;
  if (string.length > maxLength) {
    return string.slice(0, maxLength);
  }
  return string;
}

function optionalNumber(value, config = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  let result = num;
  if (typeof config.min === 'number') {
    result = Math.max(config.min, result);
  }
  if (typeof config.max === 'number') {
    result = Math.min(config.max, result);
  }
  if (config.round === 'nearest') {
    result = Math.round(result);
  } else if (config.round === 'floor') {
    result = Math.floor(result);
  } else if (config.round === 'ceil') {
    result = Math.ceil(result);
  }
  if (config.integer) {
    return Math.trunc(result);
  }
  return result;
}

function sanitizeFields(input, configList) {
  const result = {};
  configList.forEach((field) => {
    if (!Array.isArray(field.aliases)) return;
    for (const alias of field.aliases) {
      if (!Object.prototype.hasOwnProperty.call(input, alias)) continue;
      const raw = input[alias];
      let sanitized = null;
      if (field.type === 'string') {
        sanitized = optionalString(raw, field.maxLength ?? 120);
      } else if (field.type === 'number') {
        sanitized = optionalNumber(raw, field);
      }
      if (sanitized === null) continue;
      result[field.name] = sanitized;
      break;
    }
  });
  return result;
}

function sanitizePairings(input) {
  const list = Array.isArray(input)
    ? input
    : (input && typeof input === 'object') ? Object.values(input) : [];
  const normalized = [];
  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const code = typeof entry.code === 'string' ? entry.code.trim() : '';
    if (!code) return;
    const createdAt = normalizeSeconds(entry.createdAt ?? entry.created ?? entry.created_at);
    normalized.push({ code, createdAt });
  });
  return normalized;
}

function computeOffline(lastSeenAt, nowSeconds) {
  if (!lastSeenAt) return true;
  return (nowSeconds - lastSeenAt) > OFFLINE_AFTER_MIN * 60;
}

function sanitizeErrors(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') {
        if (typeof item === 'string') return { message: item.trim() };
        return null;
      }
      const code = typeof item.code === 'string' ? item.code.trim() : '';
      const message = typeof item.message === 'string' ? item.message.trim() : '';
      const ts = normalizeSeconds(item.ts ?? item.timestamp ?? null);
      if (!code && !message) return null;
      const result = {};
      if (code) result.code = code;
      if (message) result.message = message;
      if (ts) result.ts = ts;
      return result;
    })
    .filter(Boolean);
}

function sanitizeNetwork(input) {
  if (!input || typeof input !== 'object') return {};
  const network = sanitizeFields(input, DEVICE_FIELD_CONFIG.network);
  if (typeof network.signal === 'number') {
    network.signal = Number(network.signal);
  }
  if (typeof network.latency === 'number') {
    network.latency = Math.max(0, network.latency);
  }
  if (typeof network.quality === 'number') {
    network.quality = Math.trunc(network.quality);
  }
  return network;
}

function sanitizeStatus(input) {
  if (!input || typeof input !== 'object') return {};
  const status = sanitizeFields(input, DEVICE_FIELD_CONFIG.status);

  let networkSource = {};
  if (input.network && typeof input.network === 'object') {
    networkSource = { ...input.network };
  }
  if (input.networkType !== undefined && networkSource.type === undefined) {
    networkSource = { ...networkSource, type: input.networkType };
  }
  if (input.signal !== undefined && networkSource.signal === undefined) {
    networkSource = { ...networkSource, signal: input.signal };
  }
  if (input.quality !== undefined && networkSource.quality === undefined) {
    networkSource = { ...networkSource, quality: input.quality };
  }
  if (input.ssid !== undefined && networkSource.ssid === undefined) {
    networkSource = { ...networkSource, ssid: input.ssid };
  }

  const network = sanitizeNetwork(networkSource);
  if (Object.keys(network).length) {
    status.network = network;
  }

  const errors = sanitizeErrors(input.errors);
  if (errors.length) {
    status.errors = errors;
  }

  return status;
}

function sanitizeMetrics(input) {
  if (!input || typeof input !== 'object') return {};
  return sanitizeFields(input, DEVICE_FIELD_CONFIG.metrics);
}

function sanitizeHistory(input, nowSeconds) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const ts = normalizeSeconds(item.ts ?? item.timestamp ?? null);
      if (!ts) return null;
      const offline = typeof item.offline === 'boolean' ? item.offline : false;
      const status = sanitizeStatus(item.status);
      const metrics = sanitizeMetrics(item.metrics);
      return { ts, offline, status, metrics, ago: nowSeconds ? Math.max(0, nowSeconds - ts) : null };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);
}

function sanitizeDevice(entry, nowSeconds) {
  if (!entry || typeof entry !== 'object') return null;
  const id = entry.id;
  if (id == null) return null;
  const name = typeof entry.name === 'string' ? entry.name : '';
  const lastSeenRaw = entry.lastSeenAt ?? entry.lastSeen ?? 0;
  const lastSeenAt = normalizeSeconds(lastSeenRaw);
  const offline = typeof entry.offline === 'boolean'
    ? entry.offline
    : computeOffline(lastSeenAt, nowSeconds);
  const overrides = (entry.overrides && typeof entry.overrides === 'object')
    ? entry.overrides
    : null;
  const badgeSource = entry.contextBadge ?? entry.badge ?? entry.badgeInfo ?? null;
  const status = sanitizeStatus(entry.status);
  const metrics = sanitizeMetrics(entry.metrics);
  const history = sanitizeHistory(entry.heartbeatHistory, nowSeconds);
  return {
    id,
    name,
    lastSeenAt,
    offline,
    useOverrides: !!entry.useOverrides,
    overrides,
    badgeSource,
    status,
    metrics,
    heartbeatHistory: history
  };
}

async function fetchSnapshotFromApi() {
  try {
    const apiData = await fetchJson(API_ENDPOINTS.list, {
      cache: 'no-store',
      okPredicate
    });
    const now = resolveNowSeconds(apiData?.now);
    const devices = Array.isArray(apiData?.devices)
      ? apiData.devices.map((entry) => sanitizeDevice(entry, now)).filter(Boolean)
      : [];
    return {
      ok: true,
      now,
      pairings: sanitizePairings(apiData?.pairings),
      devices
    };
  } catch (error) {
    console.warn('[admin] Geräte-API nicht erreichbar', error);
    return null;
  }
}

async function fetchSnapshotFromFallback() {
  try {
    const fallbackData = await fetchJson(`${FALLBACK_PATH}?t=${Date.now()}`, { cache: 'no-store' });
    const now = resolveNowSeconds(fallbackData?.now);
    const devices = Object.values(fallbackData?.devices || {})
      .map((entry) => sanitizeDevice(entry, now))
      .filter(Boolean);
    return {
      ok: true,
      now,
      pairings: sanitizePairings(fallbackData?.pairings),
      devices
    };
  } catch (error) {
    console.warn('[admin] Geräte-Fallback-Datei nicht verfügbar', error);
    return null;
  }
}

async function fetchSnapshot() {
  const apiSnapshot = await fetchSnapshotFromApi();
  if (apiSnapshot) return apiSnapshot;
  const fallbackSnapshot = await fetchSnapshotFromFallback();
  if (fallbackSnapshot) return fallbackSnapshot;
  return {
    ok: false,
    now: resolveNowSeconds(Date.now()),
    pairings: [],
    devices: []
  };
}

let lastSnapshot = null;
let lastSnapshotTs = 0;
let snapshotPromise = null;

export async function loadDeviceSnapshots({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && lastSnapshot && (now - lastSnapshotTs) < SNAPSHOT_CACHE_MS) {
    return lastSnapshot;
  }
  if (!bypassCache && snapshotPromise) {
    return snapshotPromise;
  }
  const promise = fetchSnapshot()
    .then((result) => {
      lastSnapshot = result;
      lastSnapshotTs = Date.now();
      return result;
    })
    .finally(() => {
      if (snapshotPromise === promise) snapshotPromise = null;
    });
  snapshotPromise = promise;
  return promise;
}

export async function loadDeviceById(id) {
  const deviceId = typeof id === 'string' ? id : String(id ?? '');
  if (!deviceId) throw new Error('Geräte-ID fehlt.');
  const data = await fetchJson(API_ENDPOINTS.list, {
    cache: 'no-store',
    okPredicate
  });
  const now = resolveNowSeconds(data?.now);
  const device = Array.isArray(data?.devices)
    ? data.devices.find((entry) => entry && entry.id === deviceId)
    : null;
  if (!device) {
    throw new Error('Gerät wurde nicht gefunden.');
  }
  const sanitized = sanitizeDevice(device, now);
  return sanitized || {
    id: deviceId,
    name: typeof device.name === 'string' ? device.name : '',
    lastSeenAt: normalizeSeconds(device.lastSeenAt ?? device.lastSeen ?? 0),
    offline: computeOffline(normalizeSeconds(device.lastSeenAt ?? device.lastSeen ?? 0), now),
    useOverrides: !!device.useOverrides,
    overrides: (device.overrides && typeof device.overrides === 'object') ? device.overrides : null,
    badgeSource: device.contextBadge ?? device.badge ?? device.badgeInfo ?? null
  };
}

async function postDeviceAction(endpoint, payload = {}, { expectOk = true } = {}) {
  return fetchJson(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    expectOk
  });
}

export async function claimDevice(code, name) {
  return postDeviceAction(API_ENDPOINTS.claim, { code, name });
}

export async function setDeviceMode(deviceId, mode) {
  return postDeviceAction(API_ENDPOINTS.setMode, { device: deviceId, mode });
}

export async function unpairDevice(deviceId, { purge = false } = {}) {
  return postDeviceAction(API_ENDPOINTS.unpair, { device: deviceId, purge: purge ? 1 : 0 });
}

export async function renameDevice(deviceId, name) {
  return postDeviceAction(API_ENDPOINTS.rename, { device: deviceId, name });
}

export async function cleanupDevices() {
  return postDeviceAction(API_ENDPOINTS.cleanup, {}, { expectOk: true });
}

export const __TEST__ = {
  sanitizeStatus,
  sanitizeMetrics,
  sanitizeHistory,
  sanitizeErrors
};

