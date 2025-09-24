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
const OFFLINE_AFTER_MIN = 2;
const SNAPSHOT_CACHE_MS = 1500;

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
  return {
    id,
    name,
    lastSeenAt,
    offline,
    useOverrides: !!entry.useOverrides,
    overrides,
    badgeSource
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

export { OFFLINE_AFTER_MIN };
