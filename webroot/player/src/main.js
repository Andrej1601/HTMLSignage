import {
  clampNumber,
  resolveHeadingWidthPercent,
  OVERVIEW_TIME_BASE_CH,
  OVERVIEW_TIME_SCALE_MIN,
  OVERVIEW_TIME_SCALE_MAX,
  STYLE_THEME_KEYS,
  STYLE_FONT_KEYS,
  STYLE_SLIDE_KEYS,
  LAYOUT_PROFILES,
  LIVE_RETRY_BASE_DELAY,
  LIVE_RETRY_MAX_DELAY,
  LIVE_RETRY_MAX_ATTEMPTS
} from './constants.js';
import { createSafeLocalStorage } from './storage.js';
import {
  SAUNA_STATUS,
  SAUNA_STATUS_TEXT,
  normalizeSaunaStatus,
  computeSaunaStatusState
} from './saunaStatus.js';
import { toFiniteNumber } from './numbers.js';
import { createImagePreloader } from './preload.js';

const IS_VITEST = typeof process !== 'undefined' && !!process.env?.VITEST_WORKER_ID;

const FITBOX = document.getElementById('fitbox');
const CANVAS = document.getElementById('canvas');
const STAGE  = document.getElementById('stage');
const STAGE_LEFT  = document.getElementById('stage-left');
const STAGE_RIGHT = document.getElementById('stage-right');
const INFO_BANNER = document.getElementById('info-banner-area');
const INFO_BANNER_MODES = new Set(['full', 'left', 'right']);
const INFO_BANNER_DEFAULT_HEIGHT = 10;
const INFO_BANNER_MIN_HEIGHT = 1;
const INFO_BANNER_MAX_HEIGHT = 40;
const Q = new URLSearchParams(location.search);
const IS_PREVIEW = Q.get('preview') === '1'; // NEU: Admin-Dock
const ls = createSafeLocalStorage({
  onFallback: () => {
    if (typeof alert === 'function') {
      alert('Speicher voll – Daten werden nur temporär gespeichert.');
    }
  },
  logger: (method, error) => console.warn(`[slideshow] localStorage.${method} failed`, error)
});
const rawDevice = (Q.get('device') || ls.get('deviceId') || '').trim();
const DEVICE_ID = /^dev_[a-f0-9]{12}$/i.test(rawDevice) ? rawDevice : null;
if (DEVICE_ID) {
  // persist valid device IDs for subsequent loads
  ls.set('deviceId', DEVICE_ID);
} else {
  ls.remove('deviceId'); // Karteileichen loswerden
}
let previewMode = IS_PREVIEW; // NEU: in Preview sofort aktiv (kein Pairing)

let schedule = null;
let settings = null;
let heroTimeline = [];
let cachedDisp = null;
const stageControllers = [];
const resizeRegistry = createResizeRegistry();
let heartbeatTimer = null;
let pollController = null;
let liveSource = null;
let liveConfig = null;
let liveRetryTimer = null;
let liveRetryAttempts = 0;
const liveStateTokens = { config: null, device: null };
const eventStreamProbeCache = new Map();
const jsonRequestCache = new Map();
let badgeLookupCache = null;
const EVENT_PLAN_KEYS = ['Evt1', 'Evt2'];
let styleAutomationTimer = null;
const styleAutomationState = {
  baseTheme: null,
  baseFonts: null,
  baseSlides: null,
  activeStyle: null,
  baseAudioTrack: null,
  activeTrack: null,
  baseSchedule: null,
  scheduleOverride: null
};
let infoBannerMode = 'full';
let infoBannerSpacingFrame = 0;
const displayListeners = {
  resizeHandler: null,
  resizeObserver: null,
  resizeRaf: null,
  cancelFrame: null
};

let saunaStatusState = { map: new Map(), hidden: new Set() };

let backgroundAudioEl = null;
const backgroundAudioState = {
  config: { enabled: false, src: '', volume: 1, loop: true },
  loadedSrc: null,
  suspenders: new Set(),
  desiredPlaying: false
};

function ensureSaunaStatusState(force = false){
  if (!settings || !schedule) return saunaStatusState;
  if (force || !saunaStatusState.map || !saunaStatusState.map.size){
    saunaStatusState = computeSaunaStatusState(settings, schedule);
  }
  return saunaStatusState;
}

function getSaunaStatus(name){
  const state = ensureSaunaStatusState();
  return state.map.get(name) || SAUNA_STATUS.ACTIVE;
}

function cleanupDisplayListeners(){
  if (displayListeners.resizeHandler) {
    window.removeEventListener('resize', displayListeners.resizeHandler);
    window.removeEventListener('orientationchange', displayListeners.resizeHandler);
    displayListeners.resizeHandler = null;
  }
  if (displayListeners.resizeObserver) {
    try {
      displayListeners.resizeObserver.disconnect();
    } catch (error) {
      console.warn('[slideshow] resize observer cleanup failed', error);
    }
    displayListeners.resizeObserver = null;
  }
  if (displayListeners.resizeRaf !== null && typeof displayListeners.cancelFrame === 'function') {
    displayListeners.cancelFrame(displayListeners.resizeRaf);
  }
  displayListeners.resizeRaf = null;
  displayListeners.cancelFrame = null;
}

function ensureBackgroundAudioElement() {
  if (backgroundAudioEl && backgroundAudioEl instanceof HTMLAudioElement) {
    return backgroundAudioEl;
  }
  if (typeof document === 'undefined') return null;
  const audio = document.createElement('audio');
  audio.setAttribute('aria-hidden', 'true');
  audio.setAttribute('preload', 'auto');
  audio.setAttribute('playsinline', '');
  audio.loop = true;
  audio.controls = false;
  audio.style.display = 'none';
  if (document.body) {
    document.body.appendChild(audio);
  }
  backgroundAudioEl = audio;
  return audio;
}

function normalizeBooleanFlag(value, fallback = true) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  }
  return fallback;
}

function normalizeBackgroundAudioConfig(config = {}) {
  const cfg = config && typeof config === 'object' ? config : {};

  const sanitizeTrack = (track = {}) => {
    const src = typeof track.src === 'string' ? track.src.trim() : '';
    const rawVolume = Number(track.volume);
    const volume = Number.isFinite(rawVolume) ? clampNumber(0, rawVolume, 1) : 1;
    const loop = track.loop === false ? false : true;
    const normalized = { src, volume, loop };
    if (typeof track.label === 'string' && track.label.trim()) {
      normalized.label = track.label.trim();
    }
    const fadeRaw = Number(track.fadeMs);
    if (Number.isFinite(fadeRaw) && fadeRaw > 0) {
      normalized.fadeMs = Math.min(60000, Math.max(0, Math.round(fadeRaw)));
    }
    return normalized;
  };

  const trackMap = new Map();
  if (cfg.tracks && typeof cfg.tracks === 'object') {
    Object.entries(cfg.tracks).forEach(([id, track]) => {
      const key = typeof id === 'string' ? id.trim() : '';
      if (!key) return;
      trackMap.set(key, sanitizeTrack(track));
    });
  }

  const legacySrc = typeof cfg.src === 'string' ? cfg.src.trim() : '';
  if (!trackMap.size && legacySrc) {
    trackMap.set('default', sanitizeTrack({
      src: legacySrc,
      volume: cfg.volume,
      loop: cfg.loop,
      fadeMs: cfg.fadeMs,
      label: cfg.trackLabel
    }));
  }

  let activeTrack = typeof cfg.activeTrack === 'string' ? cfg.activeTrack.trim() : '';
  if (!activeTrack || !trackMap.has(activeTrack)) {
    activeTrack = trackMap.size ? trackMap.keys().next().value : '';
  }

  const desiredEnabled = normalizeBooleanFlag(cfg.enabled, true);
  const activeEntry = activeTrack && trackMap.get(activeTrack) ? trackMap.get(activeTrack) : null;
  const enabled = !!(desiredEnabled && activeEntry && activeEntry.src);

  const tracks = {};
  trackMap.forEach((value, key) => {
    tracks[key] = { ...value };
  });

  const normalized = {
    enabled,
    src: activeEntry ? activeEntry.src : '',
    volume: activeEntry ? activeEntry.volume : 1,
    loop: activeEntry ? (activeEntry.loop !== false) : true,
    activeTrack,
    tracks
  };
  if (activeEntry && activeEntry.fadeMs != null) {
    normalized.fadeMs = activeEntry.fadeMs;
  }
  if (activeEntry && activeEntry.label) {
    normalized.trackLabel = activeEntry.label;
  }
  return normalized;
}

function stopBackgroundAudio({ dropSrc = false } = {}) {
  if (!backgroundAudioEl) return;
  try { backgroundAudioEl.pause(); } catch {}
  if (dropSrc) {
    backgroundAudioEl.removeAttribute('src');
    try { backgroundAudioEl.load(); } catch {}
    backgroundAudioState.loadedSrc = null;
  }
}

function maybeUpdateBackgroundAudioPlayback() {
  if (!backgroundAudioState.config.enabled) {
    stopBackgroundAudio({ dropSrc: false });
    backgroundAudioState.desiredPlaying = false;
    return;
  }
  const audioEl = ensureBackgroundAudioElement();
  if (!audioEl) return;
  const shouldPlay = backgroundAudioState.desiredPlaying
    && backgroundAudioState.suspenders.size === 0
    && backgroundAudioState.config.src;
  if (!shouldPlay) {
    stopBackgroundAudio({ dropSrc: false });
    return;
  }
  if (backgroundAudioState.loadedSrc !== backgroundAudioState.config.src) {
    audioEl.src = backgroundAudioState.config.src;
    backgroundAudioState.loadedSrc = backgroundAudioState.config.src;
  }
  audioEl.loop = backgroundAudioState.config.loop !== false;
  audioEl.volume = clampNumber(0, backgroundAudioState.config.volume ?? 1, 1);
  const playResult = audioEl.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch((error) => {
      if (!error || typeof error !== 'object') {
        console.warn('[audio] background playback failed', error);
        return;
      }
      const name = typeof error.name === 'string' ? error.name : '';
      const message = typeof error.message === 'string' ? error.message : '';
      const isAbort = name === 'AbortError'
        || /interrupted by a new load request/i.test(message);
      if (!isAbort) {
        console.warn('[audio] background playback failed', error);
      }
    });
  }
}

function applyBackgroundAudio(config = {}) {
  backgroundAudioState.config = normalizeBackgroundAudioConfig(config);
  backgroundAudioState.desiredPlaying = backgroundAudioState.config.enabled;
  if (!backgroundAudioState.config.enabled) {
    stopBackgroundAudio({ dropSrc: true });
    return;
  }
  maybeUpdateBackgroundAudioPlayback();
}

function suspendBackgroundAudio(key) {
  if (!key) return;
  backgroundAudioState.suspenders.add(key);
  maybeUpdateBackgroundAudioPlayback();
}

function resumeBackgroundAudio(key) {
  if (!key) return;
  if (backgroundAudioState.suspenders.delete(key)) {
    maybeUpdateBackgroundAudioPlayback();
  }
}

function parseEventPayload(event){
  if (!event || typeof event.data !== 'string') return null;
  try {
    return JSON.parse(event.data);
  } catch (error) {
    console.warn('[live] parse failed', error);
    return null;
  }
}

function resetLiveRetry(){
  if (liveRetryTimer) {
    clearTimeout(liveRetryTimer);
    liveRetryTimer = null;
  }
}

function clearLiveSource(options = {}){
  const { clearConfig = false, resetAttempts = true } = options;
  if (liveSource) {
    try { liveSource.close(); } catch (error) { /* ignore */ }
    liveSource = null;
  }
  resetLiveRetry();
  if (resetAttempts) liveRetryAttempts = 0;
  if (clearConfig) {
    liveConfig = null;
    liveStateTokens.config = null;
    liveStateTokens.device = null;
  }
}

function scheduleLiveRestart(reason = 'error'){
  if (!liveConfig) return;
  resetLiveRetry();
  liveRetryAttempts += 1;
  const maxAttempts = liveConfig.type === 'pair' ? 1 : LIVE_RETRY_MAX_ATTEMPTS;
  if (liveRetryAttempts >= maxAttempts) {
    if (typeof liveConfig.fallback === 'function') {
      const context = liveConfig.type === 'pair' ? 'pair' : 'config';
      const attemptMsg = `[live] falling back to polling after ${liveRetryAttempts} failed ${context} attempt(s)`;
      console.warn(attemptMsg + (reason ? ` (${reason})` : ''));
      liveConfig.fallback();
    }
    return;
  }
  const delay = Math.min(
    LIVE_RETRY_BASE_DELAY * Math.pow(2, Math.max(0, liveRetryAttempts - 1)),
    LIVE_RETRY_MAX_DELAY
  );
  liveRetryTimer = setTimeout(() => {
    if (!liveConfig) return;
    if (liveConfig.type === 'config') {
      startConfigEventSource(liveConfig, { resetAttempts: false });
    } else if (liveConfig.type === 'pair') {
      startPairEventSource(liveConfig, { resetAttempts: false });
    }
  }, delay);
}

async function ensureEventStreamAvailable(url, cacheKey){
  const key = cacheKey || url;
  if (eventStreamProbeCache.has(key)) {
    return eventStreamProbeCache.get(key);
  }
  if (typeof fetch !== 'function') {
    const result = { ok: true, reason: null };
    eventStreamProbeCache.set(key, result);
    return result;
  }
  const supportsAbort = typeof AbortController === 'function';
  const controller = supportsAbort ? new AbortController() : null;
  const probeOptions = {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    cache: 'no-store'
  };
  if (controller) {
    probeOptions.signal = controller.signal;
  }
  let timeoutId = null;
  try {
    if (controller) {
      timeoutId = setTimeout(() => {
        try { controller.abort(); } catch (error) { /* ignore */ }
      }, 2000);
    }
    const response = await fetch(url, probeOptions);
    const type = String(response.headers?.get('content-type') || '').toLowerCase();
    const ok = response.ok && type.includes('text/event-stream');
    const reason = ok
      ? null
      : (!response.ok
        ? `http-${response.status}`
        : (type ? `bad-mime:${type}` : 'bad-mime'));
    const result = { ok, reason };
    eventStreamProbeCache.set(key, result);
    return result;
  } catch (error) {
    const reason = error && error.name === 'AbortError' ? 'timeout' : 'fetch-error';
    const result = { ok: false, reason };
    eventStreamProbeCache.set(key, result);
    return result;
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
    if (controller) {
      try { controller.abort(); } catch (error) { /* ignore */ }
    }
  }
}

function logEventStreamProbeFailure(context, reason){
  const message = `[live] event stream probe failed for ${context}` + (reason ? ` (${reason})` : '');
  console.warn(message);
}

async function startConfigEventSource(config, options = {}){
  if (!config) return;
  const { resetAttempts = true } = options;
  if (resetAttempts) liveRetryAttempts = 0;
  clearLiveSource({ resetAttempts: false });
  if (typeof EventSource !== 'function') {
    if (typeof config.fallback === 'function') config.fallback();
    return;
  }
  const params = new URLSearchParams();
  if (config.deviceMode && DEVICE_ID) {
    params.set('device', DEVICE_ID);
  }
  const url = `/api/live.php${params.toString() ? `?${params.toString()}` : ''}`;
  const probeKey = config.deviceMode && DEVICE_ID ? 'config:device' : 'config:global';
  const probeResult = await ensureEventStreamAvailable(url, probeKey);
  if (!probeResult || !probeResult.ok) {
    logEventStreamProbeFailure(probeKey, probeResult?.reason || 'unavailable');
    if (typeof config.fallback === 'function') config.fallback();
    return;
  }
  try {
    const source = new EventSource(url);
    liveSource = source;

    source.addEventListener('state', (event) => {
      const data = parseEventPayload(event);
      if (!data || data.ok === false || !data.schedule || !data.settings) return;
      const meta = data.meta || {};
      const token = `${meta.scheduleVersion ?? ''}:${meta.settingsVersion ?? ''}:${meta.baseScheduleVersion ?? ''}`;
      if (token && token === liveStateTokens.config) return;
      liveStateTokens.config = token || null;
      applyResolvedState(data.schedule, data.settings, { resetIndex: true })
        .catch((error) => console.error('[live] config apply failed', error));
    });

    source.addEventListener('device', (event) => {
      const data = parseEventPayload(event);
      if (!data) return;
      if (data.ok === false) {
        if (data.status === 404) {
          liveStateTokens.device = null;
          clearLiveSource({ clearConfig: true });
          stopAllStages();
          showPairing();
        }
        return;
      }
      if (!data.schedule || !data.settings) return;
      const meta = data.meta || {};
      const token = `${meta.scheduleVersion ?? ''}:${meta.settingsVersion ?? ''}:${meta.overridesActive ? 1 : 0}`;
      if (token && token === liveStateTokens.device) return;
      liveStateTokens.device = token || null;
      applyResolvedState(data.schedule, data.settings, { resetIndex: true })
        .catch((error) => console.error('[live] device apply failed', error));
    });

    source.onerror = () => {
      clearLiveSource({ resetAttempts: false });
      scheduleLiveRestart('config-eventsource-error');
    };
  } catch (error) {
    console.error('[live] event source failed', error);
    if (typeof config.fallback === 'function') config.fallback();
  }
}

async function startPairEventSource(config, options = {}){
  if (!config) return;
  const { resetAttempts = true } = options;
  if (resetAttempts) liveRetryAttempts = 0;
  clearLiveSource({ resetAttempts: false });
  if (typeof EventSource !== 'function') {
    if (typeof config.fallback === 'function') config.fallback();
    return;
  }
  const params = new URLSearchParams();
  params.set('pair', config.code);
  const url = `/api/live.php?${params.toString()}`;
  const probeResult = await ensureEventStreamAvailable(url, 'pair');
  if (!probeResult || !probeResult.ok) {
    logEventStreamProbeFailure('pair', probeResult?.reason || 'unavailable');
    if (typeof config.fallback === 'function') config.fallback();
    return;
  }
  try {
    const source = new EventSource(url);
    liveSource = source;

    source.addEventListener('pair', (event) => {
      const data = parseEventPayload(event);
      if (!data || data.ok === false) return;
      if (!data.exists) return;
      if (data.paired && data.deviceId) {
        clearLiveSource({ clearConfig: true });
        stopPollingLoop();
        ls.remove('pairState');
        ls.set('deviceId', data.deviceId);
        fetch('/api/heartbeat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: data.deviceId })
        }).catch((error) => console.error('[heartbeat] post-pair failed', error));
        location.replace('/?device=' + encodeURIComponent(data.deviceId));
      }
    });

    source.onerror = () => {
      clearLiveSource({ resetAttempts: false });
      scheduleLiveRestart('pair-eventsource-error');
    };
  } catch (error) {
    console.error('[live] pair event source failed', error);
    if (typeof config.fallback === 'function') config.fallback();
  }
}

function stopPollingLoop(){
  if (pollController) {
    pollController.stop();
    pollController = null;
  }
}

function createPollingLoop(task, {
  interval = 10000,
  maxInterval = 60000,
  backoffFactor = 2,
  jitter = 0.2
} = {}) {
  let stopped = false;
  let delay = interval;
  let timer = null;

  const scheduleNext = (customDelay) => {
    if (stopped) return;
    const baseDelay = typeof customDelay === 'number' ? customDelay : delay;
    const hasJitter = jitter > 0 && baseDelay > 0;
    const randomFactor = hasJitter ? (Math.random() * 2 - 1) * jitter : 0;
    const finalDelay = Math.max(250, Math.round(baseDelay + baseDelay * randomFactor));
    timer = setTimeout(run, Math.max(0, finalDelay));
  };

  const run = async () => {
    if (stopped) {
      return;
    }
    let success = true;
    try {
      const result = await task();
      success = result !== false;
    } catch (error) {
      success = false;
    }

    if (success) {
      delay = interval;
    } else {
      delay = Math.min(maxInterval, Math.max(interval, delay * backoffFactor));
    }

    if (!stopped) {
      scheduleNext();
    }
  };

  scheduleNext(0);

  return {
    stop() {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
}

function startConfigPolling(deviceMode){
  clearLiveSource({ clearConfig: true });
  liveRetryAttempts = 0;
  liveStateTokens.config = null;
  if (!deviceMode) liveStateTokens.device = null;
  stopPollingLoop();
  let lastSchedVer = schedule?.version || 0;
  let lastSetVer = settings?.version || 0;
  const intervalMs = deviceMode ? 10000 : 10000;
  pollController = createPollingLoop(async () => {
    try {
      if (deviceMode) {
        const response = await fetch(`/pair/resolve?device=${encodeURIComponent(DEVICE_ID)}`, { cache: 'no-store' });
        if (response.status === 404) {
          stopPollingLoop();
          stopAllStages();
          showPairing();
          return;
        }
        if (!response.ok) {
          console.warn('[poll] http', response.status);
          return false;
        }
        const payload = await response.json();
        if (!payload || payload.ok === false || !payload.schedule || !payload.settings) {
          console.warn('[poll] payload invalid');
          return false;
        }
        const newSchedVer = payload.schedule?.version || 0;
        const newSetVer = payload.settings?.version || 0;
        if (newSchedVer !== lastSchedVer || newSetVer !== lastSetVer) {
          await applyResolvedState(payload.schedule, payload.settings, { resetIndex: true });
          lastSchedVer = newSchedVer;
          lastSetVer = newSetVer;
        }
      } else {
        const [nextSchedule, nextSettings] = await Promise.all([
          loadJSON('/api/schedule.php'),
          loadJSON('/api/settings.php')
        ]);
        const newSchedVer = nextSchedule?.version || 0;
        const newSetVer = nextSettings?.version || 0;
        if (newSchedVer !== lastSchedVer || newSetVer !== lastSetVer) {
          await applyResolvedState(nextSchedule, nextSettings, { resetIndex: true });
          lastSchedVer = newSchedVer;
          lastSetVer = newSetVer;
        }
      }
    } catch (error) {
      console.warn('[poll] failed:', error);
      return false;
    }
    return true;
  }, { interval: intervalMs, maxInterval: 60000, backoffFactor: 2, jitter: 0.2 });
}

function startPairPolling(code){
  clearLiveSource({ clearConfig: true });
  liveRetryAttempts = 0;
  stopPollingLoop();
  pollController = createPollingLoop(async () => {
    try {
      const response = await fetch('/pair/poll?code=' + encodeURIComponent(code), { cache: 'no-store' });
      if (!response.ok) return;
      const payload = await response.json();
      if (payload && payload.paired && payload.deviceId) {
        stopPollingLoop();
        ls.remove('pairState');
        ls.set('deviceId', payload.deviceId);
        fetch('/api/heartbeat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: payload.deviceId })
        }).catch((error) => console.error('[heartbeat] post-pair failed', error));
        location.replace('/?device=' + encodeURIComponent(payload.deviceId));
      }
    } catch (error) {
      console.warn('[pair] poll failed', error);
      return false;
    }
    return true;
  }, { interval: 5000, maxInterval: 30000, backoffFactor: 2, jitter: 0.2 });
}

function startConfigLiveUpdates(deviceMode){
  stopPollingLoop();
  liveConfig = {
    type: 'config',
    deviceMode,
    fallback: () => startConfigPolling(deviceMode)
  };
  if (deviceMode) {
    liveStateTokens.device = null;
  } else {
    liveStateTokens.config = null;
  }
  startConfigEventSource(liveConfig);
}

function startPairLiveUpdates(code){
  if (!code) return;
  stopPollingLoop();
  liveConfig = {
    type: 'pair',
    code,
    fallback: () => startPairPolling(code)
  };
  startPairEventSource(liveConfig);
}


window.addEventListener('beforeunload', () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  stopPollingLoop();
  clearLiveSource({ clearConfig: true });
  stopStyleAutomationTimer();
  cleanupDisplayListeners();
});

const imagePreloader = createImagePreloader({ maxParallel: 3 });
const PRELOAD_AHEAD = 4;

function preloadImage(url){
  return imagePreloader.preload(url);
}
async function preloadRightImages(){
  const urls = Object.values(settings?.assets?.rightImages || {}).filter(Boolean);
  if (!urls.length) return;
  await imagePreloader.preloadMany(urls);
}
async function preloadNextImages(){
  const tasks = stageControllers.map(ctrl => preloadUpcomingForStage(ctrl, { offset: 0 }));
  await Promise.all(tasks);
}

async function preloadSlideImages(){
  await Promise.all([
    preloadRightImages(),
    preloadNextImages()
  ]);
}

function setResizeHandler(region, handler){
  resizeRegistry.set(region, handler);
}

function runResizeHandlers(){
  resizeRegistry.run();
}

window.addEventListener('resize', runResizeHandlers, { passive:true });

function deepClone(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(item => deepClone(item));
  const cloned = {};
  for (const [key, val] of Object.entries(value)) {
    cloned[key] = deepClone(val);
  }
  return cloned;
}

function cloneSubset(src = {}, keys = []) {
  const out = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = deepClone(src[key]);
    }
  });
  return out;
}

function assignSubset(target = {}, subset = {}) {
  Object.entries(subset || {}).forEach(([key, value]) => {
    target[key] = deepClone(value);
  });
  return target;
}

function sanitizeBadgeLibrary(list){
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const normalized = [];
  const asTrimmedString = value => (typeof value === 'string' ? value.trim() : '');

  list.forEach(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    let label = asTrimmedString(entry.label);
    if (!label) label = asTrimmedString(entry.title);
    if (!label) label = asTrimmedString(entry.text);
    if (!label) label = asTrimmedString(entry.name);

    let icon = asTrimmedString(entry.icon);
    if (!icon) icon = asTrimmedString(entry.emoji);
    if (!icon) icon = asTrimmedString(entry.symbol);
    const candidates = [
      entry.id,
      entry.key,
      entry.code,
      entry.slug,
      entry.uid,
      entry.value,
      entry.name,
      entry.title,
      entry.text,
      entry.label,
      entry.icon
    ];
    let id = '';
    for (const candidate of candidates){
      if (candidate == null) continue;
      const value = String(candidate).trim();
      if (value){
        id = value;
        break;
      }
    }
    if (!id || seen.has(id)) return;
    normalized.push({ id, icon, label });
    seen.add(id);
  });
  return normalized;
}

function sanitizeSettingsPayload(payload){
  const cfg = (payload && typeof payload === 'object') ? payload : {};
  const slides = (cfg.slides && typeof cfg.slides === 'object') ? cfg.slides : (cfg.slides = {});
  slides.badgeLibrary = sanitizeBadgeLibrary(slides.badgeLibrary);
  const audioCfg = (cfg.audio && typeof cfg.audio === 'object') ? cfg.audio : (cfg.audio = {});
  audioCfg.background = normalizeBackgroundAudioConfig(audioCfg.background);
  return cfg;
}

async function applyResolvedState(nextSchedule, nextSettings, options = {}){
  const {
    resetIndex = true,
    autoplay = true,
    waitForPreload = false
  } = options || {};

  if (!nextSchedule || typeof nextSchedule !== 'object') {
    throw new Error('Plan-Daten fehlen oder sind ungültig.');
  }
  if (!nextSettings || typeof nextSettings !== 'object') {
    throw new Error('Einstellungen fehlen oder sind ungültig.');
  }

  schedule = nextSchedule;
  settings = sanitizeSettingsPayload(nextSettings);
  applyBackgroundAudio(settings?.audio?.background);
  saunaStatusState = computeSaunaStatusState(settings, schedule);
  badgeLookupCache = null;

  snapshotStyleAutomationBase();
  stopStyleAutomationTimer();
  applyStyleAutomation();

  applyTheme();
  applyDisplay();
  maybeApplyPreset();
  refreshStageQueues({ resetIndex, autoplay });
  startStyleAutomationTimer();

  const preloadPromise = preloadSlideImages();
  if (waitForPreload) {
    await preloadPromise;
  } else {
    preloadPromise.catch((error) => console.warn('[slideshow] preload failed', error));
  }
}

function createResizeRegistry() {
  const handlers = new Map();
  return {
    set(region, handler) {
      if (!region) return;
      if (typeof handler === 'function') handlers.set(region, handler);
      else handlers.delete(region);
    },
    run() {
      handlers.forEach((fn, key) => {
        if (typeof fn !== 'function') {
          handlers.delete(key);
          return;
        }
        try {
          fn();
        } catch (error) {
          console.warn('[slideshow] resize handler failed', error);
        }
      });
    }
  };
}

// ---------- Time helpers ----------
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const parseHM = (hm) => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
const getRowSortOffset = (row) => {
  const raw = Number(row && (row.dayOffset ?? row.sortOffset));
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(7, Math.max(0, Math.round(raw)));
};
const makeRowSortKey = (time, offset) => {
  const normalizedTime = typeof time === 'string' ? time : '';
  const off = Number.isFinite(offset) && offset > 0 ? Math.round(offset) : 0;
  return off > 0 ? `${normalizedTime}__${off}` : normalizedTime;
};
const compareTimesWithOffset = (aTime, aOffset, bTime, bOffset) => {
  const offsetDiff = (aOffset || 0) - (bOffset || 0);
  if (offsetDiff !== 0) return offsetDiff;
  const timeA = typeof aTime === 'string' ? aTime : '';
  const timeB = typeof bTime === 'string' ? bTime : '';
  const cmp = timeA.localeCompare(timeB);
  if (cmp !== 0) return cmp;
  return 0;
};
const computeSortMinutes = (minutes, offset) => {
  if (!Number.isFinite(minutes)) return null;
  const normalizedOffset = Number.isFinite(offset) && offset > 0 ? Math.round(offset) : 0;
  return minutes + normalizedOffset * 1440;
};
const parseDateTimeLocal = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!Number.isFinite(year) || year < 1970 || year > 9999) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (!Number.isFinite(date.getTime())) return null;
  return { ms: date.getTime() };
};

// ---------- Presets ----------
function dayKey(){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]; }
function maybeApplyPreset(){
  if (styleAutomationState.scheduleOverride) return;
  const auto = !!(settings && settings.presetAuto);
  const presets = (settings && settings.presets) || {};
  if (!auto) return;
  const key = dayKey();
  const preset = presets[key] || presets['Default'] || null;
  if (preset && preset.saunas && Array.isArray(preset.rows)) {
    schedule = preset; // gleiche Struktur wie schedule.json erwartet
    saunaStatusState = computeSaunaStatusState(settings, schedule);
  }
}

function snapshotStyleAutomationBase() {
  styleAutomationState.baseTheme = cloneSubset(settings?.theme || {}, STYLE_THEME_KEYS);
  styleAutomationState.baseFonts = cloneSubset(settings?.fonts || {}, STYLE_FONT_KEYS);
  styleAutomationState.baseSlides = cloneSubset(settings?.slides || {}, STYLE_SLIDE_KEYS);
  styleAutomationState.activeStyle = settings?.slides?.activeStyleSet || null;
  styleAutomationState.baseAudioTrack = settings?.audio?.background?.activeTrack || null;
  styleAutomationState.baseSchedule = null;
  styleAutomationState.scheduleOverride = null;
}

function getStyleSets() {
  const raw = settings?.slides?.styleSets;
  return (raw && typeof raw === 'object') ? raw : {};
}

function getAutomationConfig() {
  const cfg = settings?.slides?.styleAutomation;
  return (cfg && typeof cfg === 'object') ? cfg : null;
}

function getBackgroundTracks() {
  const tracks = settings?.audio?.background?.tracks;
  return (tracks && typeof tracks === 'object') ? tracks : {};
}

function resolveTimeSlotSelection(styleSets, automation, tracks, validPlans) {
  if (!automation || automation.enabled === false) return null;
  const slots = Array.isArray(automation.timeSlots) ? automation.timeSlots : [];
  if (!slots.length) return null;
  const valid = [];
  slots.forEach((slot) => {
    if (!slot || typeof slot !== 'object') return;
    if (slot.mode === 'range') return;
    const styleKey = slot.style && styleSets[slot.style] ? slot.style : null;
    const minutes = parseHM(slot.start || slot.startTime || '');
    if (minutes === null) return;
    const trackKey = slot.track && tracks[slot.track] ? slot.track : null;
    const planCandidate = typeof slot.plan === 'string' ? slot.plan.trim() : '';
    const planKey = (validPlans && validPlans.has(planCandidate)) ? planCandidate : null;
    valid.push({ minutes, style: styleKey, track: trackKey, plan: planKey });
  });
  if (!valid.length) return null;
  valid.sort((a, b) => a.minutes - b.minutes);
  const current = nowMinutes();
  let selected = null;
  for (const entry of valid) {
    if (entry.minutes <= current) selected = entry;
  }
  if (!selected) {
    selected = valid[valid.length - 1];
  }
  return selected ? { style: selected.style, track: selected.track, plan: selected.plan || null } : null;
}

function resolveRangeSlotSelection(styleSets, automation, tracks, validPlans) {
  if (!automation || automation.enabled === false) return null;
  const slots = Array.isArray(automation.timeSlots) ? automation.timeSlots : [];
  if (!slots.length) return null;
  const now = Date.now();
  let selected = null;
  slots.forEach((slot) => {
    if (!slot || typeof slot !== 'object') return;
    if (slot.mode !== 'range' && !(slot.startDateTime && slot.endDateTime)) return;
    const styleKey = slot.style && styleSets[slot.style] ? slot.style : null;
    const trackKey = slot.track && tracks[slot.track] ? slot.track : null;
    const planCandidate = typeof slot.plan === 'string' ? slot.plan.trim() : '';
    const planKey = (validPlans && validPlans.has(planCandidate)) ? planCandidate : null;
    const startInfo = parseDateTimeLocal(slot.startDateTime || slot.start);
    const endInfo = parseDateTimeLocal(slot.endDateTime || slot.end);
    if (!startInfo || !endInfo) return;
    if (endInfo.ms < startInfo.ms) return;
    if (now < startInfo.ms || now > endInfo.ms) return;
    if (!selected || startInfo.ms >= selected.startMs) {
      selected = { style: styleKey, track: trackKey, plan: planKey, startMs: startInfo.ms };
    }
  });
  return selected ? { style: selected.style, track: selected.track, plan: selected.plan || null } : null;
}

function resolveAutomationSelection() {
  const styleSets = getStyleSets();
  const availableIds = Object.keys(styleSets);
  if (!availableIds.length) return { style: null, track: null, reason: 'none' };
  const backgroundTracks = getBackgroundTracks();
  const trackIds = Object.keys(backgroundTracks);
  const slidesCfg = settings?.slides || {};
  const automation = getAutomationConfig();
  const validPlanSet = new Set(EVENT_PLAN_KEYS);
  const savedActive = slidesCfg.activeStyleSet && styleSets[slidesCfg.activeStyleSet]
    ? slidesCfg.activeStyleSet
    : null;
  const fallbackStyle = (automation?.fallbackStyle && styleSets[automation.fallbackStyle])
    ? automation.fallbackStyle
    : (savedActive || availableIds[0]);
  const trackCandidates = [
    automation?.fallbackTrack,
    settings?.audio?.background?.activeTrack,
    styleAutomationState.baseAudioTrack
  ];
  let fallbackTrack = null;
  for (const candidate of trackCandidates) {
    if (candidate && backgroundTracks[candidate]) {
      fallbackTrack = candidate;
      break;
    }
  }
  if (!fallbackTrack && trackIds.length) {
    fallbackTrack = trackIds[0];
  }
  if (!automation || automation.enabled === false) {
    return { style: fallbackStyle, track: fallbackTrack, plan: null, reason: 'disabled' };
  }
  const rangeSelection = resolveRangeSlotSelection(styleSets, automation, backgroundTracks, validPlanSet);
  if (rangeSelection && (rangeSelection.style || rangeSelection.track)) {
    return {
      style: rangeSelection.style || fallbackStyle,
      track: rangeSelection.track || fallbackTrack,
      plan: rangeSelection.plan || null,
      reason: 'range'
    };
  }
  const timeSelection = resolveTimeSlotSelection(styleSets, automation, backgroundTracks, validPlanSet);
  if (timeSelection && (timeSelection.style || timeSelection.track)) {
    return {
      style: timeSelection.style || fallbackStyle,
      track: timeSelection.track || fallbackTrack,
      plan: timeSelection.plan || null,
      reason: 'time'
    };
  }
  return { style: fallbackStyle, track: fallbackTrack, plan: null, reason: 'fallback' };
}

function applyScheduleOverride(planKey) {
  const normalized = typeof planKey === 'string' ? planKey.trim() : '';
  const target = EVENT_PLAN_KEYS.includes(normalized) ? normalized : '';
  if (!target) {
    if (!styleAutomationState.scheduleOverride) {
      return false;
    }
    const base = styleAutomationState.baseSchedule;
    if (base) {
      schedule = deepClone(base);
    }
    styleAutomationState.scheduleOverride = null;
    styleAutomationState.baseSchedule = null;
    saunaStatusState = computeSaunaStatusState(settings, schedule);
    return true;
  }
  const presets = settings?.presets;
  const preset = (presets && typeof presets === 'object') ? presets[target] : null;
  if (!preset || !Array.isArray(preset.saunas) || !Array.isArray(preset.rows)) {
    return applyScheduleOverride('');
  }
  if (styleAutomationState.scheduleOverride === target) {
    return false;
  }
  if (!styleAutomationState.scheduleOverride) {
    styleAutomationState.baseSchedule = deepClone(schedule);
  }
  styleAutomationState.scheduleOverride = target;
  schedule = deepClone(preset);
  saunaStatusState = computeSaunaStatusState(settings, schedule);
  return true;
}

function applyStyleAutomation() {
  const styleSets = getStyleSets();
  const availableIds = Object.keys(styleSets);
  if (!availableIds.length) {
    styleAutomationState.activeStyle = null;
    return { changed: false, style: null };
  }

  if (!styleAutomationState.baseTheme || !styleAutomationState.baseFonts || !styleAutomationState.baseSlides) {
    snapshotStyleAutomationBase();
  }

  const selection = resolveAutomationSelection();
  const styleId = selection.style && styleSets[selection.style] ? selection.style : availableIds[0];
  if (!styleId) {
    styleAutomationState.activeStyle = null;
    return { changed: false, style: null };
  }

  const backgroundTracks = getBackgroundTracks();
  const trackIds = Object.keys(backgroundTracks);
  let trackId = selection.track && backgroundTracks[selection.track] ? selection.track : null;
  if (!trackId && trackIds.length) {
    const candidates = [styleAutomationState.activeTrack, settings?.audio?.background?.activeTrack];
    trackId = candidates.find((candidate) => candidate && backgroundTracks[candidate]) || trackIds[0];
  }

  let trackChanged = false;
  if (trackId) {
    settings.audio = (settings.audio && typeof settings.audio === 'object') ? settings.audio : {};
    settings.audio.background = (settings.audio.background && typeof settings.audio.background === 'object')
      ? settings.audio.background
      : {};
    if (settings.audio.background.activeTrack !== trackId) {
      settings.audio.background.activeTrack = trackId;
      trackChanged = true;
    }
  }

  let styleChanged = false;
  if (styleAutomationState.activeStyle !== styleId) {
    const entry = styleSets[styleId] || {};
    const themeBase = styleAutomationState.baseTheme || {};
    const fontsBase = styleAutomationState.baseFonts || {};
    const slidesBase = styleAutomationState.baseSlides || {};

    const nextTheme = assignSubset({ ...themeBase }, entry.theme || {});
    const nextFonts = assignSubset({ ...fontsBase }, entry.fonts || {});
    const nextSlideStyles = assignSubset({ ...deepClone(slidesBase) }, entry.slides || {});

    const mergedTheme = assignSubset({ ...(settings?.theme || {}) }, nextTheme);
    const mergedFonts = assignSubset({ ...(settings?.fonts || {}) }, nextFonts);
    const slidesAll = { ...(settings?.slides || {}) };
    assignSubset(slidesAll, nextSlideStyles);
    slidesAll.activeStyleSet = styleId;
    settings.theme = mergedTheme;
    settings.fonts = mergedFonts;
    settings.slides = slidesAll;
    styleAutomationState.activeStyle = styleId;
    styleChanged = true;
  }

  styleAutomationState.activeTrack = trackId || null;
  if (trackChanged && settings?.audio?.background) {
    applyBackgroundAudio(settings.audio.background);
  }

  const scheduleChanged = applyScheduleOverride(selection.plan);

  return { changed: styleChanged, style: styleId, scheduleChanged };
}

function stopStyleAutomationTimer() {
  if (styleAutomationTimer) {
    clearInterval(styleAutomationTimer);
    styleAutomationTimer = null;
  }
}

function startStyleAutomationTimer() {
  stopStyleAutomationTimer();
  const tick = () => {
    const result = applyStyleAutomation();
    if (result.scheduleChanged) {
      refreshStageQueues({ resetIndex: true, autoplay: true });
    }
    if (result.changed) {
      applyTheme();
      runResizeHandlers();
    }
  };
  styleAutomationTimer = setInterval(tick, 60 * 1000);
}

// -----------DeviceLoader -------
async function loadDeviceResolved(id){
const response = await fetch(`/pair/resolve?device=${encodeURIComponent(id)}&t=${Date.now()}`, { cache: 'no-store' });
if (!response.ok) throw new Error('device_resolve http ' + response.status);
const payload = await response.json();
if (!payload || payload.ok === false || !payload.settings || !payload.schedule) {
  throw new Error('device_resolve payload invalid');
}
await applyResolvedState(payload.schedule, payload.settings, {
  resetIndex: true,
  autoplay: false,
  waitForPreload: true
});
}


// ---------- IO ----------
async function loadJSON(url) {
  const cached = jsonRequestCache.get(url);
  const headers = {};
  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }
  if (cached?.lastModified) {
    headers['If-Modified-Since'] = cached.lastModified;
  }

  let response;
  try {
    response = await fetch(url, Object.keys(headers).length ? { headers } : undefined);
  } catch (error) {
    jsonRequestCache.delete(url);
    throw error;
  }

  if (response.status === 304) {
    if (cached && cached.data !== undefined) {
      return cached.data;
    }
    response = await fetch(url, { cache: 'reload' });
  }

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + url);
  }

  const data = await response.json();
  const etag = response.headers.get('ETag');
  const lastModified = response.headers.get('Last-Modified');
  if (etag || lastModified) {
    jsonRequestCache.set(url, { etag, lastModified, data });
  } else {
    jsonRequestCache.delete(url);
  }
  return data;
}

// ---------- Theme & Display ----------
function ensureFontFamily() {
  const fam = settings?.fonts?.family || '';
  if (/montserrat/i.test(fam)) {
    if (!document.getElementById('gfont_mont')) {
      const l = document.createElement('link'); l.id = 'gfont_mont'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(l);
    }
  }
}
function setVars(map){ for (const [k,v] of Object.entries(map)) if (v!==undefined && v!==null) document.documentElement.style.setProperty(k, String(v)); }

function resolveInfoBannerMode(display = {}) {
  const raw = typeof display.infoBannerMode === 'string' ? display.infoBannerMode.toLowerCase() : '';
  if (raw === 'left' || raw === 'right') {
    if (raw === 'right') {
      const layoutMode = display.layoutMode === 'split' ? 'split' : 'single';
      if (layoutMode !== 'split') return 'full';
    }
    return raw;
  }
  if (INFO_BANNER_MODES.has(raw)) return raw;
  return 'full';
}

function clearInfoBannerStageSpacing() {
  [STAGE_LEFT, STAGE_RIGHT].forEach((node) => {
    if (!node) return;
    node.style.removeProperty('--infoBannerReservedPx');
    node.classList.remove('has-info-banner');
  });
}

function applyInfoBannerStageSpacing(region = 'full', heightPx = 0) {
  const assign = (node, active) => {
    if (!node) return;
    if (active && heightPx > 0) {
      node.style.setProperty('--infoBannerReservedPx', `${Math.round(heightPx)}px`);
      node.classList.add('has-info-banner');
    } else {
      node.style.removeProperty('--infoBannerReservedPx');
      node.classList.remove('has-info-banner');
    }
  };

  if (region === 'full') {
    assign(STAGE_LEFT, true);
    assign(STAGE_RIGHT, true);
    return;
  }

  const isRight = region === 'right';
  assign(STAGE_LEFT, !isRight);
  assign(STAGE_RIGHT, isRight);
}

function scheduleInfoBannerStageSpacing() {
  if (!INFO_BANNER) return;

  const requestFrame = (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
    ? window.requestAnimationFrame.bind(window)
    : (fn) => setTimeout(fn, 16);
  const cancelFrame = (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function')
    ? window.cancelAnimationFrame.bind(window)
    : (id) => clearTimeout(id);

  if (infoBannerSpacingFrame) {
    cancelFrame(infoBannerSpacingFrame);
    infoBannerSpacingFrame = 0;
  }

  infoBannerSpacingFrame = requestFrame(() => {
    infoBannerSpacingFrame = 0;
    if (!INFO_BANNER || INFO_BANNER.dataset.empty === 'true') {
      clearInfoBannerStageSpacing();
      return;
    }
    const rect = INFO_BANNER.getBoundingClientRect();
    const height = rect && Number.isFinite(rect.height) ? rect.height : 0;
    if (height > 0) {
      applyInfoBannerStageSpacing(infoBannerMode || 'full', height);
    } else {
      clearInfoBannerStageSpacing();
    }
  });
}

function updateInfoBannerColumnWidth() {
  if (!INFO_BANNER) return;
  if (infoBannerMode === 'full') {
    INFO_BANNER.style.setProperty('--infoBannerColumnWidth', 'none');
    return;
  }
  const target = infoBannerMode === 'left' ? STAGE_LEFT : STAGE_RIGHT;
  const rect = target ? target.getBoundingClientRect() : null;
  const width = rect ? Math.max(0, rect.width || 0) : 0;
  if (width > 0) {
    INFO_BANNER.style.setProperty('--infoBannerColumnWidth', `${Math.round(width)}px`);
  } else {
    INFO_BANNER.style.setProperty('--infoBannerColumnWidth', 'none');
  }
}

function updateInfoBannerMetrics() {
  if (!INFO_BANNER) return;
  if (infoBannerMode === 'full') {
    INFO_BANNER.style.setProperty('--infoBannerColumnWidth', 'none');
  } else {
    updateInfoBannerColumnWidth();
  }
  scheduleInfoBannerStageSpacing();
}

function applyInfoBannerLayout(display = {}, docStyle = document.documentElement?.style) {
  if (!INFO_BANNER || !docStyle) return;

  const heightPercent = toFiniteNumber(display.infoBannerHeightPercent);
  if (heightPercent !== null) {
    const clamped = Math.max(INFO_BANNER_MIN_HEIGHT, Math.min(INFO_BANNER_MAX_HEIGHT, heightPercent));
    docStyle.setProperty('--infoBannerHeightVh', String(clamped));
    const padScale = Math.max(0.4, Math.min(2, clamped / INFO_BANNER_DEFAULT_HEIGHT));
    docStyle.setProperty('--infoBannerPadScale', padScale.toFixed(3));
  } else {
    docStyle.removeProperty('--infoBannerHeightVh');
    docStyle.removeProperty('--infoBannerPadScale');
  }

  infoBannerMode = resolveInfoBannerMode(display);
  INFO_BANNER.dataset.mode = infoBannerMode;
  updateInfoBannerMetrics();
  resizeRegistry.set('info-banner', updateInfoBannerMetrics);
}

function applyTheme() {
  const t = settings?.theme || {};
  const fonts = settings?.fonts || {};
  const slidesCfg = settings?.slides || {};
  const clamp = (min, val, max) => Math.min(Math.max(val, min), max);
  const msVar = (value, fallback) => {
    const num = Number.isFinite(+value) ? Math.max(0, +value) : fallback;
    return (Number.isFinite(num) ? num : fallback) + 'ms';
  };
  const overviewTimeWidthScale = (() => {
    const rawScale = Number(fonts.overviewTimeWidthScale);
    if (Number.isFinite(rawScale) && rawScale > 0) {
      return clamp(OVERVIEW_TIME_SCALE_MIN, rawScale, OVERVIEW_TIME_SCALE_MAX);
    }
    const legacyWidth = Number(fonts.overviewTimeWidthCh);
    if (Number.isFinite(legacyWidth) && legacyWidth > 0) {
      return clamp(
        OVERVIEW_TIME_SCALE_MIN,
        legacyWidth / OVERVIEW_TIME_BASE_CH,
        OVERVIEW_TIME_SCALE_MAX
      );
    }
    return 1;
  })();
  const overviewTimeScale = Number.isFinite(+fonts.overviewTimeScale)
    ? clamp(0.5, +fonts.overviewTimeScale, 3)
    : (Number.isFinite(+fonts.overviewCellScale) ? +fonts.overviewCellScale : 0.8);
  const overlayEnabled = slidesCfg.tileOverlayEnabled !== false;
  const overlayStrength = overlayEnabled
    ? clamp(0, Number(slidesCfg.tileOverlayStrength ?? 1), 3)
    : 0;
  const overlayOpacity = overlayEnabled ? clamp(0, 0.9 * overlayStrength, 1) : 0;
  const overlayLight = overlayEnabled ? clamp(0, 0.12 * overlayStrength, 1) : 0;
  const overlayShadow = overlayEnabled ? clamp(0, 0.42 * overlayStrength, 1) : 0;
  const headingWidthPct = resolveHeadingWidthPercent(slidesCfg.saunaTitleMaxWidthPercent);

  setVars({
    '--bg': t.bg, '--fg': t.fg, '--accent': t.accent,
    '--grid': t.gridBorder, '--cell': t.cellBg, '--boxfg': t.boxFg,
    '--gridTable':  t.gridTable  || t.gridBorder,
    '--gridTableW': (t.gridTableW ?? 2) + 'px',
    '--tileBorder':  t.tileBorder || t.gridBorder,
    '--tileBorderW': (t.tileBorderW ?? 3) + 'px',
    '--chipBorder':  t.chipBorder || t.gridBorder,
    '--chipBorderW': (t.chipBorderW ?? 2) + 'px',
    '--timecol': t.timeColBg, '--flame': t.flame,
    '--zebra1': t.zebra1, '--zebra2': t.zebra2,
    '--timeZebra1': t.timeZebra1 || '#EAD9A0', '--timeZebra2': t.timeZebra2 || '#E2CE91',
    '--headBg': t.headRowBg || t.timeColBg || '#E8DEBD', '--headFg': t.headRowFg || t.fg || '#5C3101',
    '--cornerBg': t.cornerBg || t.headRowBg || '#E8DEBD', '--cornerFg': t.cornerFg || t.headRowFg || '#5C3101',
    '--hlColor': (settings?.highlightNext?.color || '#FFDD66'),
    '--baseScale': fonts.scale || 1,
    '--scale': 'calc(var(--baseScale)*var(--vwScale))',
    '--h1Scale': fonts.h1Scale || 1,
    '--h2Scale': fonts.h2Scale || 1,
    '--ovTitleScale': fonts.overviewTitleScale || 1,
    '--ovHeadScale': fonts.overviewHeadScale || 0.9,
    '--ovCellScale': fonts.overviewCellScale || 0.8,
    '--ovTimeScale': overviewTimeScale,
    '--ovTimeWidthScale': overviewTimeWidthScale,
    '--ovTimeWidth': `calc(${OVERVIEW_TIME_BASE_CH}ch * ${overviewTimeWidthScale})`,
    '--tileTextScale': fonts.tileTextScale || 0.8,
    '--tileWeight': fonts.tileWeight || 600,
    '--tileTimeWeight': fonts.tileTimeWeight || fonts.tileWeight || 600,
    '--chipHScale': fonts.chipHeight || 1,
    '--badgeBg': slidesCfg.infobadgeColor || t.accent || '#5C3101',
    '--badgeFg': t.boxFg || '#FFFFFF',
    '--tileOverlayOpacity': overlayOpacity.toFixed(3),
    '--tileOverlayLight': overlayLight.toFixed(3),
    '--tileOverlayShadow': overlayShadow.toFixed(3),
    '--tileEnterDuration': msVar(slidesCfg.tileEnterMs, 600),
    '--tileEnterDelay': msVar(slidesCfg.tileStaggerMs, 80),
    '--heroTimelineItemMs': msVar(slidesCfg.heroTimelineItemMs, 500),
    '--heroTimelineItemDelay': msVar(slidesCfg.heroTimelineItemDelayMs, 140),
    '--heroTimelineFillMs': msVar(slidesCfg.heroTimelineFillMs, 8000),
    '--heroTimelineDelayMs': msVar(slidesCfg.heroTimelineDelayMs, 400),
    '--saunaHeadingMaxWidth': headingWidthPct + '%'
  });
  if (fonts.family) document.documentElement.style.setProperty('--font', fonts.family);

  const showOverviewFlames = fonts.overviewShowFlames !== false;
  document.body.classList.toggle('overview-hide-flames', !showOverviewFlames);
  const showSaunaFlames = slidesCfg.showSaunaFlames !== false;
  document.body.classList.toggle('sauna-hide-flames', !showSaunaFlames);

  setVars({
    '--chipFlamePct': Math.max(0.3, Math.min(1, (fonts.flamePct || 55) / 100)),
    '--chipFlameGapScale': Math.max(0, (fonts.flameGapScale ?? 0.14))
  });
  document.body.dataset.chipOverflow = fonts.chipOverflowMode || 'scale';

  ensureFontFamily();
}

function applyDisplay() {
  cachedDisp = null;
  cleanupDisplayListeners();

  const docEl = document.documentElement;
  const docStyle = docEl.style;
  const d = settings?.display || {};
  const layoutMode = (d.layoutMode === 'split') ? 'split' : 'single';
  updateLayoutModeAttr(layoutMode);
  const rawProfile = typeof d.layoutProfile === 'string' ? d.layoutProfile : 'landscape';
  const layoutProfile = LAYOUT_PROFILES.has(rawProfile) ? rawProfile : 'landscape';
  updateLayoutProfileAttr(layoutProfile);

  switch (layoutProfile) {
    case 'portrait-split':
      docStyle.setProperty('--stage-gap', 'calc(18px * var(--vwScale))');
      break;
    case 'triple':
    case 'asymmetric':
      docStyle.setProperty('--stage-gap', 'calc(24px * var(--vwScale))');
      break;
    default:
      docStyle.removeProperty('--stage-gap');
      break;
  }

  const setPercentProperty = (name, raw) => {
    const value = toFiniteNumber(raw);
    if (value !== null) docStyle.setProperty(name, `${value}%`);
    else docStyle.removeProperty(name);
  };

  setPercentProperty('--rightW', d.rightWidthPercent);
  setPercentProperty('--infoPanelW', d.infoPanelWidthPercent ?? d.rightWidthPercent);
  const portraitTop = toFiniteNumber(d.portraitSplitTopPercent);
  if (portraitTop !== null) {
    const clamped = Math.max(5, Math.min(95, portraitTop));
    docStyle.setProperty('--portraitSplitTop', `${clamped}%`);
    const bottom = Math.max(0, Math.min(100, 100 - clamped));
    docStyle.setProperty('--portraitSplitBottom', `${bottom}%`);
  } else {
    docStyle.removeProperty('--portraitSplitTop');
    docStyle.removeProperty('--portraitSplitBottom');
  }
  applyInfoBannerLayout(d, docStyle);

  const topPercent = toFiniteNumber(d.cutTopPercent);
  if (topPercent !== null) {
    docStyle.setProperty('--cutTop', `${topPercent}%`);
    const topRatio = Math.max(0, Math.min(1, topPercent / 100));
    docStyle.setProperty('--cutTopRatio', String(topRatio));
  } else {
    docStyle.removeProperty('--cutTop');
    docStyle.removeProperty('--cutTopRatio');
  }

  const bottomPercent = toFiniteNumber(d.cutBottomPercent);
  if (bottomPercent !== null) {
    docStyle.setProperty('--cutBottom', `${bottomPercent}%`);
    const bottomRatio = Math.max(0, Math.min(1, bottomPercent / 100));
    docStyle.setProperty('--cutBottomRatio', String(bottomRatio));
  } else {
    docStyle.removeProperty('--cutBottom');
    docStyle.removeProperty('--cutBottomRatio');
  }

  const parsedBaseW = toFiniteNumber(d.baseW);
  const baseW = parsedBaseW !== null && parsedBaseW > 0 ? parsedBaseW : 1920;
  docStyle.setProperty('--baseW', `${baseW}px`);
  const updateVwScale = () => {
    const vw = Math.max(docEl.clientWidth, window.innerWidth || 0);
    const scale = Math.max(0.25, vw / baseW);
    docStyle.setProperty('--vwScale', String(scale));
  };
  updateVwScale();

  const requestFrame = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : (cb) => setTimeout(cb, 16);
  const cancelFrame = typeof window.cancelAnimationFrame === 'function'
    ? window.cancelAnimationFrame.bind(window)
    : (id) => clearTimeout(id);
  displayListeners.cancelFrame = cancelFrame;

  const onResize = () => {
    if (displayListeners.resizeRaf !== null && typeof displayListeners.cancelFrame === 'function') {
      displayListeners.cancelFrame(displayListeners.resizeRaf);
    }
    displayListeners.resizeRaf = requestFrame(() => {
      displayListeners.resizeRaf = null;
      updateVwScale();
    });
  };

  window.addEventListener('resize', onResize, { passive:true });
  window.addEventListener('orientationchange', onResize);
  displayListeners.resizeHandler = onResize;

  if ('ResizeObserver' in window) {
    try {
      displayListeners.resizeObserver = new ResizeObserver(onResize);
      displayListeners.resizeObserver.observe(docEl);
    } catch (error) {
      console.warn('[slideshow] resize observer init failed', error);
      displayListeners.resizeObserver = null;
    }
  }
}

function getDisplayRatio() {
  if (cachedDisp !== null) return cachedDisp;
  const d = settings?.display || {};
  const parsedBaseW = toFiniteNumber(d.baseW);
  const parsedBaseH = toFiniteNumber(d.baseH);
  const baseW = parsedBaseW !== null && parsedBaseW > 0 ? parsedBaseW : 1920;
  const baseH = parsedBaseH !== null && parsedBaseH > 0 ? parsedBaseH : 1080;
  cachedDisp = baseW / baseH;
  return cachedDisp;
}

function chooseFit(mediaW, mediaH, opts = {}) {
  return 'cover';
}

function textFromValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map(part => textFromValue(part))
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof value === 'object') {
    const candidates = ['text', 'label', 'name', 'value', 'title'];
    for (const key of candidates) {
      const v = value[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  const str = String(value).trim();
  return str;
}

function firstTextValue(...values) {
  for (const value of values) {
    const txt = textFromValue(value);
    if (txt) return txt;
  }
  return '';
}

function firstImageUrl(...values) {
  for (const value of values) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const found = firstImageUrl(...value);
      if (found) return found;
      continue;
    }
    if (typeof value === 'object') {
      const nested = firstImageUrl(
        value.url,
        value.src,
        value.href,
        value.image,
        value.imageUrl,
        value.path,
        value.value
      );
      if (nested) return nested;
      continue;
    }
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function normalizeEventCountdowns(list) {
  const source = Array.isArray(list) ? list : [];
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const id = entry.id != null ? String(entry.id).trim() : '';
    if (id && seen.has(id)) return;
    if (id) seen.add(id);
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const subtitle = typeof entry.subtitle === 'string' ? entry.subtitle.trim() : '';
    const rawTarget = typeof entry.target === 'string' ? entry.target.trim() : '';
    if (!title && !subtitle && !rawTarget) return;
    const parsedTarget = rawTarget ? new Date(rawTarget) : null;
    const fallbackTargetMs = Number.isFinite(entry.targetMs) ? Math.round(+entry.targetMs) : null;
    const targetMs = parsedTarget && !Number.isNaN(parsedTarget.getTime())
      ? parsedTarget.getTime()
      : fallbackTargetMs;
    const styleKey = typeof entry.style === 'string' ? entry.style.trim() : '';
    const image = typeof entry.image === 'string' ? entry.image.trim() : '';
    const imageThumb = typeof entry.imageThumb === 'string' ? entry.imageThumb.trim() : '';
    normalized.push({
      type: 'event-countdown',
      id: id || null,
      title,
      subtitle,
      target: rawTarget,
      targetMs: targetMs ?? null,
      styleKey,
      image,
      imageThumb,
      imageUrl: image || imageThumb || ''
    });
  });
  normalized.sort((a, b) => {
    const aTime = a.targetMs ?? Number.POSITIVE_INFINITY;
    const bTime = b.targetMs ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return (a.title || '').localeCompare(b.title || '');
  });
  return normalized;
}

function collectHeroTimelineData() {
  heroTimeline = collectEventCountdowns();
  return heroTimeline;
}

// ---------- Slide queue ----------
const WELLNESS_GLOBAL_ID = '__wellness_bundle__';

function collectWellnessTips() {
  const list = Array.isArray(settings?.extras?.wellnessTips) ? settings.extras.wellnessTips : [];
  const normalized = [];
  const dwellValues = [];
  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    if (entry.enabled === false) return;
    const id = entry.id != null ? String(entry.id).trim() : '';
    const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!title && !text) return;
    const dwellSec = Number.isFinite(+entry.dwellSec) ? Math.max(1, Math.round(+entry.dwellSec)) : null;
    if (Number.isFinite(dwellSec)) dwellValues.push(dwellSec);
    normalized.push({
      type: 'wellness-tip',
      id: id || null,
      icon,
      title,
      text,
      dwellSec
    });
  });
  if (!normalized.length) return [];

  const items = normalized
    .map((entry) => ({
      id: entry.id != null ? entry.id : null,
      icon: entry.icon,
      title: entry.title,
      text: entry.text
    }))
    .filter(item => (item.title && item.title.length) || (item.text && item.text.length));

  if (!items.length) return [];

  const dwellSec = dwellValues.length ? Math.max(...dwellValues) : null;
  return [{
    type: 'wellness-tip',
    id: WELLNESS_GLOBAL_ID,
    dwellSec,
    items
  }];
}

function collectEventCountdowns() {
  return normalizeEventCountdowns(settings?.extras?.eventCountdowns);
}

function collectInfoModules() {
  const list = Array.isArray(settings?.extras?.infoModules) ? settings.extras.infoModules : [];
  const items = [];
  list.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    if (entry.enabled === false) return;
    const textValue = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!textValue) return;
    const iconValue = typeof entry.icon === 'string' ? entry.icon.trim() : '';
    const id = entry.id != null ? String(entry.id).trim() : '';
    items.push({ id: id || null, text: textValue, icon: iconValue });
  });
  if (!items.length) return [];
  return [{ type: 'info-module', id: 'info-banner', items }];
}


function buildMasterQueue() {
  maybeApplyPreset();

  const heroEnabled = settings?.slides?.heroEnabled !== false;
  const timeline = heroEnabled ? collectHeroTimelineData() : (heroTimeline = []);
  const hasHero = heroEnabled && timeline.length > 0;
  const withHero = (queue) => hasHero ? [{ type: 'hero-timeline' }, ...queue] : queue.slice();

const showOverview = (settings?.slides?.showOverview !== false);
const statusState = ensureSaunaStatusState(true);
const hidden = new Set(statusState.hidden || []);
const allSaunas = (schedule?.saunas || []);
const sortOrder = Array.isArray(settings?.slides?.sortOrder) ? settings.slides.sortOrder : null;

const storySlidesAll = Array.isArray(settings?.slides?.storySlides)
  ? settings.slides.storySlides
  : [];
const storyKey = (story, idx) => {
  if (!story) return null;
  if (story.id != null) return String(story.id);
  return 'story_idx_' + idx;
};
const storyEntriesAll = storySlidesAll
  .map((story, idx) => {
    const key = storyKey(story, idx);
    if (!story || !key) return null;
    return { key, story, idx };
  })
  .filter(Boolean);
const storyEntriesEnabled = storyEntriesAll.filter(entry => entry.story.enabled !== false);
const storyMapAll = new Map(storyEntriesAll.map(entry => [entry.key, entry.story]));
const storyMapEnabled = new Map(storyEntriesEnabled.map(entry => [entry.key, entry.story]));

const wellnessTips = collectWellnessTips();
const wellnessMap = new Map(wellnessTips.filter(it => it.id).map(it => [String(it.id), it]));
const eventCountdowns = collectEventCountdowns();
const infoModules = collectInfoModules();
applyInfoBannerModules(infoModules);

if (sortOrder && sortOrder.length) {
  const queue = [];
  if (showOverview) queue.push({ type: 'overview' });
  const mediaAll = Array.isArray(settings?.interstitials) ? settings.interstitials : [];
  const mediaMap = new Map(mediaAll.map(it => [String(it.id), it]));
  const usedSaunas = new Set();
  const usedMedia = new Set();
  const usedStories = new Set();
  const usedWellness = new Set();
  for (const entry of sortOrder) {
    if (entry.type === 'sauna') {
      const name = entry.name;
      if (allSaunas.includes(name) && !hidden.has(name)) {
        queue.push({ type: 'sauna', sauna: name });
        usedSaunas.add(name);
      }
      continue;
    }
    if (entry.type === 'media') {
      const it = mediaMap.get(String(entry.id));
      if (it && it.enabled) {
        const dwell = Number.isFinite(+it.dwellSec)
          ? +it.dwellSec
          : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);
        const node = { type: it.type, dwell, __id: it.id || null };
        if (it.url) {
          if (it.type === 'url') node.url = it.url; else node.src = it.url;
        }
        if (it.type === 'video') {
          node.muted = !(it.audio === true);
          if (shouldWaitForVideoEnd(it)) node.waitForEnd = true;
        }
        queue.push(node);
        usedMedia.add(String(it.id));
      }
      continue;
    }
    if (entry.type === 'story') {
      const key = String(entry.id ?? '');
      const story = storyMapEnabled.get(key);
      if (story) {
        queue.push({ type: 'story', story, storyId: key });
        usedStories.add(key);
      }
      continue;
    }
    if (entry.type === 'wellness-tip') {
      const key = String(entry.id ?? '');
      const tip = wellnessMap.get(key);
      if (tip) {
        queue.push({ ...tip, tipId: key });
        usedWellness.add(key);
      }
      continue;
    }
  }
  for (const s of allSaunas) {
    if (!usedSaunas.has(s) && !hidden.has(s)) queue.push({ type: 'sauna', sauna: s });
  }
  for (const it of mediaAll) {
    const idStr = String(it.id);
    if (!usedMedia.has(idStr) && it && it.enabled) {
      const dwell = Number.isFinite(+it.dwellSec)
        ? +it.dwellSec
        : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);
      const node = { type: it.type, dwell, __id: it.id || null };
      if (it.url) {
        if (it.type === 'url') node.url = it.url; else node.src = it.url;
      }
      if (it.type === 'video') {
        node.muted = !(it.audio === true);
        if (shouldWaitForVideoEnd(it)) node.waitForEnd = true;
      }
      queue.push(node);
    }
  }
  for (const entry of storyEntriesEnabled) {
    if (!usedStories.has(entry.key)) {
      queue.push({ type: 'story', story: entry.story, storyId: entry.key });
    }
  }
  for (const tip of wellnessTips) {
    const key = tip.id != null ? String(tip.id) : null;
    if (!key || !usedWellness.has(key)) {
      queue.push({ ...tip, tipId: key });
    }
  }
  const clean = [];
  for (const q of queue) {
    if (q.type === 'sauna') clean.push({ type: 'sauna', name: q.sauna });
    else if (q.__id != null) clean.push({ type: 'media', id: q.__id });
    else if (q.type === 'story') {
      const id = q.storyId ?? (q.story?.id ?? null);
      if (id != null && storyMapAll.has(String(id))) clean.push({ type: 'story', id: String(id) });
    } else if (q.type === 'wellness-tip') {
      const id = q.tipId ?? q.id;
      if (id != null && wellnessMap.has(String(id))) clean.push({ type: 'wellness-tip', id: String(id) });
    }
  }
  settings.slides.sortOrder = clean;
  if (!queue.length && showOverview) queue.push({ type: 'overview' });
  return withHero(queue);
}

// Referenz-Reihenfolge für Saunen (Order aus Settings, dann Rest)
const cfgOrder = Array.isArray(settings?.slides?.order) ? settings.slides.order.slice() : null;
let saunaOrderRef = [];
if (cfgOrder && cfgOrder.length) {
  const seen = new Set();
  for (const e of cfgOrder) if (allSaunas.includes(e) && !seen.has(e)) { saunaOrderRef.push(e); seen.add(e); }
  for (const s of allSaunas) if (!seen.has(s)) saunaOrderRef.push(s);
} else {
  saunaOrderRef = allSaunas.slice();
}

// Sichtbare Saunen in der gleichen (reflektierten) Reihenfolge
const visibleSaunas = saunaOrderRef.filter(n => !hidden.has(n));

// Basis-Queue (ohne Bilder)
const queue = [];
if (showOverview) queue.push({ type: 'overview' });
for (const s of visibleSaunas) queue.push({ type: 'sauna', sauna: s });

// Bilder/Medien vorbereiten
const mediaAll = Array.isArray(settings?.interstitials) ? settings.interstitials : [];
const media = [];
for (const it of mediaAll) {
  if (!it || !it.enabled) continue;
  const audioEnabled = it.audio === true;
  const base = { ...it, audio: audioEnabled };
  switch (it.type) {
    case 'video':
    case 'image':
      if (it.url) media.push({ ...base, type: it.type, src: it.url });
      break;
    case 'url':
      if (it.url) media.push({ ...base, type: 'url', url: it.url });
      break;
    default:
      if (it.url) media.push({ ...base, type: 'image', src: it.url });
  }
}

// Medien nach Übersicht einfügen
const idxOverview = () => queue.findIndex(x => x.type === 'overview');
let insPos = idxOverview();
insPos = (insPos >= 0) ? insPos + 1 : 0;
for (const it of media) {
  const dwell = Number.isFinite(+it.dwellSec)
    ? +it.dwellSec
    : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);
  const node = { type: it.type, dwell, __id: it.id || null };
  if (it.src) node.src = it.src;
  if (it.url && it.type === 'url') node.url = it.url;
  if (it.type === 'video') {
    node.muted = !(it.audio === true);
    if (shouldWaitForVideoEnd(it)) node.waitForEnd = true;
  }
  queue.splice(insPos++, 0, node);
}

// Story-Slides anhängen
for (const entry of storyEntriesEnabled) {
  queue.push({ type: 'story', story: entry.story, storyId: entry.key });
}

wellnessTips.forEach((tip) => {
  queue.push({ ...tip, tipId: tip.id != null ? String(tip.id) : null });
});

// Falls nichts bleibt, notfalls Übersicht zeigen
if (!queue.length && showOverview) queue.push({ type: 'overview' });

return withHero(queue);
}

function renderWellnessTip(item = {}, region = 'left') {
  const container = h('div', { class: 'container extra extra-wellness fade show' });
  container.dataset.region = region;
  if (item.id) container.dataset.extraId = String(item.id);

  const eyebrow = h('div', { class: 'extra-eyebrow' }, 'Wellness-Tipp');
  const content = h('div', { class: 'extra-content' });

  const items = Array.isArray(item.items)
    ? item.items
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const title = typeof entry.title === 'string' ? entry.title.trim() : '';
        const text = typeof entry.text === 'string' ? entry.text.trim() : '';
        const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
        if (!title && !text) return null;
        return { title, text, icon };
      })
      .filter(Boolean)
    : [];

  const hasList = items.length > 0;

  if (!hasList && item.icon) {
    content.appendChild(h('div', { class: 'extra-icon', 'aria-hidden': 'true' }, item.icon));
  }

  const body = h('div', { class: 'extra-body-wrap' });
  if (hasList) {
    const listEl = h('ul', { class: 'extra-list' });
    items.forEach((entry) => {
      const li = h('li');
      const header = h('div', { class: 'extra-item-header' });
      if (entry.icon) {
        header.appendChild(h('div', { class: 'extra-icon', 'aria-hidden': 'true' }, entry.icon));
      }
      if (entry.title) {
        header.appendChild(h('h3', { class: 'extra-title' }, entry.title));
      }
      if (header.childNodes.length) {
        li.appendChild(header);
      }
      if (entry.text) li.appendChild(h('p', { class: 'extra-text' }, entry.text));
      listEl.appendChild(li);
    });
    body.appendChild(listEl);
  } else {
    const titleText = typeof item.title === 'string' ? item.title.trim() : '';
    if (titleText) body.appendChild(h('h2', { class: 'extra-title' }, titleText));
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (text) body.appendChild(h('p', { class: 'extra-text' }, text));
  }
  content.appendChild(body);

  container.appendChild(eyebrow);
  container.appendChild(content);
  return container;
}

function renderEventCountdown(item = {}, region = 'left', ctx = {}) {
  const container = h('div', { class: 'container extra extra-event hero-timeline fade show' });
  container.dataset.region = region;

  const eventsInput = Array.isArray(item.events) && item.events.length
    ? normalizeEventCountdowns(item.events)
    : collectHeroTimelineData();
  const events = eventsInput.slice();
  const slidesCfg = settings?.slides || {};
  const baseFillMs = (() => {
    const raw = Number(slidesCfg.heroTimelineFillMs);
    if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
    return 8000;
  })();
  const heroScrollSpeed = (() => {
    const raw = Number(slidesCfg.heroTimelineScrollSpeed);
    if (Number.isFinite(raw) && raw > 0) return Math.max(40, Math.round(raw));
    return 40;
  })();
  const heroScrollPauseMs = (() => {
    const raw = Number(slidesCfg.heroTimelineScrollPauseMs);
    if (Number.isFinite(raw) && raw >= 0) {
      const normalized = raw < 1000 ? raw * 1000 : raw;
      return Math.max(0, Math.round(normalized));
    }
    return 4000;
  })();

  const slideItem = ctx?.item || item;
  const isHeroSlide = slideItem?.type === 'hero-timeline';
  const waitForScroll = isHeroSlide && !!(settings?.slides?.heroTimelineWaitForScroll);
  const computedDwell = (() => {
    try {
      return dwellMsForItem(slideItem || item, ctx?.pageConfig);
    } catch (err) {
      return null;
    }
  })();
  const fallbackDwell = Number.isFinite(computedDwell) ? computedDwell : null;
  let scrollDurationMs = null;
  const applyProgressDuration = (ms) => {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const ratio = Math.max(0.05, ms / (baseFillMs || 8000));
    container.style.setProperty('--hero-duration-ratio', String(ratio));
  };
  if (!waitForScroll && Number.isFinite(fallbackDwell) && fallbackDwell > 0) {
    applyProgressDuration(fallbackDwell);
  }
  let advanceHelper = null;
  let cycleReached = !waitForScroll;
  const scheduleIfReady = () => {
    if (!advanceHelper) return;
    if (waitForScroll && !cycleReached) return;
    const ms = Number.isFinite(advanceHelper.defaultMs) && advanceHelper.defaultMs > 0
      ? advanceHelper.defaultMs
      : (Number.isFinite(fallbackDwell) && fallbackDwell > 0 ? fallbackDwell : 8000);
    if (!waitForScroll || !scrollDurationMs) {
      applyProgressDuration(ms);
    }
    advanceHelper.schedule(Math.max(1000, Math.round(ms)));
    advanceHelper = null;
  };
  if (typeof ctx?.deferAdvance === 'function') {
    ctx.deferAdvance((helper) => {
      advanceHelper = {
        schedule: helper.schedule,
        defaultMs: helper.defaultMs
      };
      if (!waitForScroll) {
        scheduleIfReady();
      } else {
        cycleReached && scheduleIfReady();
      }
      return true;
    });
  }
  if (!events.length) {
    cycleReached = true;
    scheduleIfReady();
  }
  const markCycle = () => {
    if (cycleReached) return;
    cycleReached = true;
    scheduleIfReady();
  };

  const eyebrow = h('div', { class: 'extra-eyebrow' }, 'Event Countdown');
  const headingWrap = h('div', { class: 'headings hero-headings' }, [
    eyebrow,
    h('h1', { class: 'h1' }, 'Bevorstehende Events'),
    h('h2', { class: 'h2' }, events.length ? 'Verpasse keine Highlights' : 'Derzeit sind keine Events geplant.')
  ]);

  const list = h('div', { class: 'hero-timeline-list' });
  const updates = [];

  const formatDisplay = (targetMs, rawTarget, nowTs) => {
    if (!targetMs) {
      const fallback = rawTarget && rawTarget.trim() ? rawTarget.trim() : 'Termin folgt';
      return {
        timeLabel: fallback,
        countdownValue: 'Bald',
        countdownLabel: 'Termin folgt',
        isLive: false,
        isSoon: false
      };
    }
    const now = new Date(nowTs);
    const eventDate = new Date(targetMs);
    if (Number.isNaN(eventDate.getTime())) {
      return {
        timeLabel: rawTarget || 'Termin folgt',
        countdownValue: 'Bald',
        countdownLabel: 'Termin folgt',
        isLive: false,
        isSoon: false
      };
    }
    const diff = targetMs - nowTs;
    const sameDay = eventDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow = eventDate.toDateString() === tomorrow.toDateString();
    const dateOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
    let dateLabel = eventDate.toLocaleDateString('de-DE', dateOptions);
    if (!sameDay && eventDate.getFullYear() !== now.getFullYear()) {
      dateLabel += ` ${eventDate.getFullYear()}`;
    }
    const timePart = eventDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) dateLabel = `Heute · ${timePart}`;
    else if (isTomorrow) dateLabel = `Morgen · ${timePart}`;
    else dateLabel = `${dateLabel} · ${timePart}`;

    if (diff <= 0) {
      return {
        timeLabel: dateLabel,
        countdownValue: 'Jetzt',
        countdownLabel: 'Event läuft',
        isLive: true,
        isSoon: true
      };
    }

    const dayMs = 24 * 60 * 60 * 1000;
    if (sameDay) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      const minutes = Math.floor((diff % (60 * 60 * 1000)) / 60000);
      const parts = [];
      if (hours > 0) parts.push(`${hours} Std`);
      if (minutes > 0 || hours === 0) parts.push(`${Math.max(1, minutes)} Min`);
      const value = parts.join(' ');
      return {
        timeLabel: dateLabel,
        countdownValue: `Noch ${value}`,
        countdownLabel: 'heute',
        isLive: false,
        isSoon: true
      };
    }

    const days = Math.ceil(diff / dayMs);
    const value = days === 1 ? '1 Tag' : `${days} Tage`;
    return {
      timeLabel: dateLabel,
      countdownValue: `Noch ${value}`,
      countdownLabel: 'bis zum Start',
      isLive: false,
      isSoon: diff <= dayMs
    };
  };

  if (!events.length) {
    list.appendChild(h('div', { class: 'caption' }, 'Aktuell sind keine Events geplant.'));
    container.classList.add('is-empty');
  } else {
    events.forEach((event, idx) => {
      const item = h('div', { class: 'timeline-item' });
      item.style.setProperty('--hero-index', String(idx));
      const timeEl = h('div', { class: 'timeline-time' }, '');
      item.appendChild(timeEl);

      const details = h('div', { class: 'timeline-details' });
      const entryClasses = ['timeline-entry'];
      if (event.imageUrl) entryClasses.push('has-thumb'); else entryClasses.push('no-thumb');
      const entryNode = h('div', { class: entryClasses.join(' ') });

      const thumb = h('div', { class: 'timeline-entry-thumb' });
      if (event.imageUrl) {
        const style = 'background-image:url(' + JSON.stringify(event.imageUrl) + ')';
        thumb.appendChild(h('div', { class: 'timeline-entry-thumb-image', style }));
      } else {
        thumb.classList.add('is-empty');
        const fallbackSrc = firstText(event.title, event.subtitle).trim();
        const fallbackChar = fallbackSrc ? fallbackSrc.charAt(0).toUpperCase() : 'E';
        if (fallbackChar) {
          thumb.appendChild(h('span', { class: 'timeline-entry-thumb-fallback' }, fallbackChar));
        }
      }
      entryNode.appendChild(thumb);

      const content = h('div', { class: 'timeline-entry-content' });
      const header = h('div', { class: 'timeline-entry-header' });
      header.appendChild(h('span', { class: 'timeline-title' }, event.title || 'Event'));
      content.appendChild(header);
      if (event.subtitle) {
        content.appendChild(h('div', { class: 'timeline-detail' }, event.subtitle));
      }

      const countdownValue = h('div', { class: 'timeline-countdown-value' }, '–');
      const countdownLabel = h('div', { class: 'timeline-countdown-label' }, '');
      const countdownWrap = h('div', { class: 'timeline-countdown' }, [countdownValue, countdownLabel]);
      content.appendChild(countdownWrap);

      entryNode.appendChild(content);
      details.appendChild(entryNode);
      item.appendChild(details);

      const bar = h('div', { class: 'timeline-bar' }, [
        h('div', { class: 'timeline-progress' })
      ]);
      item.appendChild(bar);

      list.appendChild(item);

      updates.push({
        targetMs: Number.isFinite(event.targetMs) ? event.targetMs : null,
        rawTarget: event.target,
        itemEl: item,
        timeEl,
        valueEl: countdownValue,
        labelEl: countdownLabel
      });
    });
  }

  const updateCountdowns = () => {
    const now = Date.now();
    updates.forEach((entry) => {
      const display = formatDisplay(entry.targetMs, entry.rawTarget, now);
      entry.timeEl.textContent = display.timeLabel;
      entry.valueEl.textContent = display.countdownValue;
      entry.labelEl.textContent = display.countdownLabel;
      entry.itemEl.classList.toggle('is-live', display.isLive);
      entry.itemEl.classList.toggle('is-soon', display.isSoon && !display.isLive);
      entry.itemEl.classList.toggle('is-active', display.isLive || display.isSoon);
    });
  };

  updateCountdowns();
  let timer = null;
  if (updates.some(entry => entry.targetMs)) {
    timer = setInterval(updateCountdowns, 30000);
  }

  const body = h('div', { class: 'hero-body' }, [list]);
  container.appendChild(headingWrap);
  container.appendChild(body);
  const recomputeScrollDuration = () => {
    if (!waitForScroll) return null;
    const maxScroll = Math.max(0, list.scrollHeight - list.clientHeight);
    if (maxScroll <= 0) {
      scrollDurationMs = null;
      return null;
    }
    const travelMs = Math.round((maxScroll / Math.max(1, heroScrollSpeed)) * 1000);
    const initialDelay = Math.round(Math.min(800, heroScrollPauseMs));
    const total = Math.max(0, travelMs + initialDelay);
    scrollDurationMs = total;
    applyProgressDuration(total);
    return total;
  };
  const stopAutoScroll = enableAutoScroll(list, {
    axis: 'y',
    speed: heroScrollSpeed,
    pauseMs: heroScrollPauseMs,
    mode: isHeroSlide ? 'loop' : 'bounce',
    onCycle: () => {
      if (waitForScroll) markCycle();
    },
    onScrollableChange: (scrollable) => {
      if (!waitForScroll) return;
      if (scrollable) {
        recomputeScrollDuration();
      } else {
        scrollDurationMs = null;
        markCycle();
      }
    }
  });
  const handleManualScroll = () => {
    if (!waitForScroll) return;
    const maxScroll = list.scrollHeight - list.clientHeight;
    if (maxScroll <= 0) return;
    const threshold = Math.max(1, maxScroll * 0.02);
    if (list.scrollTop >= maxScroll - threshold) {
      markCycle();
    }
  };
  list.addEventListener('scroll', handleManualScroll, { passive: true });
  if (waitForScroll) {
    const updateLater = () => {
      try { recomputeScrollDuration(); } catch {}
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(updateLater);
    else updateLater();
  }
  const cleanups = [];
  if (timer) cleanups.push(() => clearInterval(timer));
  if (typeof stopAutoScroll === 'function') cleanups.push(stopAutoScroll);
  cleanups.push(() => list.removeEventListener('scroll', handleManualScroll));
  if (waitForScroll) {
    let resizeObserver = null;
    if (typeof ResizeObserver === 'function') {
      try {
        resizeObserver = new ResizeObserver(() => { recomputeScrollDuration(); });
        resizeObserver.observe(list);
      } catch {}
    }
    if (resizeObserver) {
      cleanups.push(() => {
        try { resizeObserver.disconnect(); } catch {}
      });
    }
  }
  container.__cleanup = () => {
    cleanups.splice(0).forEach((fn) => {
      try { fn(); } catch {}
    });
    container.style.removeProperty('--hero-duration-ratio');
  };
  return container;
}

function enableAutoScroll(container, { axis = 'y', speed = 24, pauseMs = 3500, mode = 'bounce', onCycle, onScrollableChange } = {}) {
  if (!container || typeof container !== 'object') return null;
  const isVertical = axis !== 'x';
  const scrollProp = isVertical ? 'scrollTop' : 'scrollLeft';
  const sizeProp = isVertical ? 'clientHeight' : 'clientWidth';
  const scrollSizeProp = isVertical ? 'scrollHeight' : 'scrollWidth';
  const raf = typeof requestAnimationFrame === 'function'
    ? (fn) => requestAnimationFrame(fn)
    : (fn) => setTimeout(() => fn(Date.now()), 16);
  const caf = typeof cancelAnimationFrame === 'function'
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id);
  let frame = 0;
  let idleTimer = 0;
  let destroyed = false;
  let direction = 1;
  let lastTs = 0;
  const loopMode = mode === 'loop';
  const cycleCb = typeof onCycle === 'function' ? onCycle : null;
  const scrollableCb = typeof onScrollableChange === 'function' ? onScrollableChange : null;
  let cycleCount = 0;
  const pauseInterval = Number.isFinite(+pauseMs) ? Math.max(0, +pauseMs) : 3500;
  let resizeFrame = 0;

  const getMaxScroll = () => Math.max(0, container[scrollSizeProp] - container[sizeProp]);

  const stopTimers = () => {
    if (frame) { caf(frame); frame = 0; }
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
  };

  const ensureScrollable = () => {
    const maxScroll = getMaxScroll();
    const scrollable = maxScroll > 0;
    container.classList.toggle('is-scrollable', scrollable);
    if (scrollableCb) {
      try { scrollableCb(scrollable, maxScroll); } catch (err) { console.warn('[slideshow] auto scroll callback failed', err); }
    }
    if (!scrollable) {
      container[scrollProp] = 0;
      stopTimers();
    }
    return scrollable;
  };

  const schedule = (delay = pauseInterval) => {
    if (destroyed) return;
    stopTimers();
    idleTimer = setTimeout(() => {
      idleTimer = 0;
      lastTs = 0;
      frame = raf(step);
    }, Math.max(0, delay));
  };

  const step = (ts) => {
    if (destroyed) return;
    const maxScroll = getMaxScroll();
    if (maxScroll <= 0) {
      container.classList.remove('is-scrollable');
      container[scrollProp] = 0;
      stopTimers();
      return;
    }
    if (!lastTs) lastTs = ts;
    const delta = ts - lastTs;
    lastTs = ts;
    const distance = (speed * delta) / 1000;
    const next = container[scrollProp] + (direction * distance);
    if (loopMode) {
      if (next >= maxScroll) {
        container[scrollProp] = maxScroll;
        if (cycleCb) {
          try { cycleCb({ cycle: ++cycleCount }); } catch (err) { console.warn('[slideshow] auto scroll cycle callback failed', err); }
        } else {
          cycleCount += 1;
        }
        stopTimers();
        idleTimer = setTimeout(() => {
          if (destroyed) return;
          container[scrollProp] = 0;
          lastTs = 0;
          frame = raf(step);
        }, pauseInterval);
        return;
      }
      container[scrollProp] = Math.min(next, maxScroll);
      frame = raf(step);
      return;
    }
    if (next <= 0) {
      container[scrollProp] = 0;
      direction = 1;
      schedule();
      return;
    }
    if (next >= maxScroll) {
      container[scrollProp] = maxScroll;
      direction = -1;
      schedule();
      return;
    }
    container[scrollProp] = next;
    frame = raf(step);
  };

  let retryTimer = 0;
  const scheduleRetry = () => {
    if (destroyed) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      begin(true);
    }, 420);
  };

  const begin = (fromRetry = false) => {
    if (destroyed) return;
    if (!ensureScrollable()) {
      scheduleRetry();
      return;
    }
    const initialDelay = loopMode ? Math.min(800, pauseInterval) : pauseInterval;
    schedule(initialDelay);
  };

  let resizeObserver = null;
  const flushResize = () => {
    resizeFrame = 0;
    if (destroyed) return;
    if (ensureScrollable() && !frame && !idleTimer) {
      schedule();
    }
  };
  const globalWin = typeof window === 'object' ? window : null;

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(() => {
      if (destroyed) return;
      if (resizeFrame) {
        caf(resizeFrame);
        resizeFrame = 0;
      }
      resizeFrame = raf(flushResize);
    });
    resizeObserver.observe(container);
  } else if (globalWin && typeof globalWin.addEventListener === 'function') {
    globalWin.addEventListener('resize', flushResize);
  }

  setTimeout(begin, 400);

  if (!loopMode) {
    // ensure at least one retry in case contents resize after load
    scheduleRetry();
  }

  return () => {
    destroyed = true;
    stopTimers();
    if (resizeFrame) {
      caf(resizeFrame);
      resizeFrame = 0;
    }
    if (resizeObserver) resizeObserver.disconnect();
    if (retryTimer) clearTimeout(retryTimer);
    if (globalWin && typeof globalWin.removeEventListener === 'function') {
      globalWin.removeEventListener('resize', flushResize);
    }
    container.classList.remove('is-scrollable');
  };
}

function renderInfoModule(item = {}, region = 'left') {
  const entries = Array.isArray(item.items) ? item.items : [];
  const container = h('div', { class: 'container extra extra-info-banner fade show' });
  container.dataset.region = region;
  if (item.id != null) container.dataset.extraId = String(item.id);
  if (!entries.length) {
    container.appendChild(h('div', { class: 'info-banner info-banner--empty' }, 'Keine Hinweise hinterlegt.'));
    return container;
  }
  const ticker = h('div', { class: 'info-banner' });
  const track = h('div', { class: 'info-banner-track' });
  const appendEntries = (useClones = false) => {
    entries.forEach((entry, idx) => {
      if (!entry || typeof entry !== 'object') return;
      const textValue = typeof entry.text === 'string' ? entry.text.trim() : '';
      const iconValue = typeof entry.icon === 'string' ? entry.icon.trim() : '';
      if (!textValue && !iconValue) return;
      const itemNode = h('div', { class: 'info-banner-item' });
      if (iconValue) itemNode.appendChild(h('span', { class: 'info-banner-icon' }, iconValue));
      if (textValue) itemNode.appendChild(h('span', { class: 'info-banner-text' }, textValue));
      track.appendChild(useClones ? itemNode.cloneNode(true) : itemNode);
      if (entries.length > 1 && idx < entries.length - 1) {
        track.appendChild(h('span', { class: 'info-banner-sep', 'aria-hidden': 'true' }, '•'));
      }
    });
  };
  appendEntries(false);
  if (entries.length > 1) appendEntries(true);
  ticker.appendChild(track);
  container.appendChild(ticker);
  return container;
}

function applyInfoBannerModules(modules = []) {
  if (!INFO_BANNER) return;
  const active = modules.find((entry) => Array.isArray(entry.items) && entry.items.length);
  INFO_BANNER.dataset.empty = 'true';
  cleanupChildNodes(INFO_BANNER);
  INFO_BANNER.innerHTML = '';
  clearInfoBannerStageSpacing();
  if (!active) {
    scheduleInfoBannerStageSpacing();
    return;
  }
  const region = infoBannerMode || 'full';
  const node = renderInfoModule(active, region);
  INFO_BANNER.appendChild(node);
  INFO_BANNER.dataset.empty = 'false';
  updateInfoBannerMetrics();
}

// ---------- DOM helpers ----------
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  const isNode = (val) => typeof Node !== 'undefined' && val instanceof Node;
  const toArray = (val) => {
    if (val === undefined || val === null) return [];
    return Array.isArray(val) ? val : [val];
  };

  let attrObj = attrs;
  let childList = children;

  if (!attrObj || typeof attrObj !== 'object' || Array.isArray(attrObj) || isNode(attrObj)) {
    childList = toArray(attrObj).concat(toArray(children));
    attrObj = {};
  } else {
    childList = toArray(children);
  }

  for (const [k, v] of Object.entries(attrObj)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.setAttribute('style', v);
    else el.setAttribute(k, v);
  }

  for (const c of [].concat(childList)) {
    if (typeof c === 'string' || typeof c === 'number') {
      el.appendChild(document.createTextNode(String(c)));
    } else if (c) {
      el.appendChild(c);
    }
  }
  return el;
}

// ---------- Flames ----------
function inlineFlameSVG() { return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [ h('path', { d: 'M12 2c2 4-1 5-1 7 0 1 1 2 2 2 2 0 3-2 3-4 2 2 4 4 4 7 0 4-3 8-8 8s-8-4-8-8c0-5 5-7 8-12z' }) ]); }
function formatWeekday(d=new Date()){
  return new Intl.DateTimeFormat('de-DE', { weekday:'long' }).format(d);
}
function formatDate(d=new Date()){
  return new Intl.DateTimeFormat('de-DE').format(d);
}
function computeH2Text(){
  const cfg = settings?.h2 || { mode:'text', text:'Aufgusszeiten', showOnOverview:true };
  const base = (cfg.text || '').trim();
  const wd = formatWeekday();
  const dt = formatDate();
  switch((cfg.mode||'text')){
    case 'none': return '';
    case 'text': return base;
    case 'weekday': return wd;
    case 'date': return dt;
    case 'text+weekday': return [base, wd].filter(Boolean).join(' ');
    case 'text+date': return [base, dt].filter(Boolean).join(' ');
    default: return base;
  }
}
function flameNode() {
  const url = settings?.assets?.flameImage || '/assets/img/flame_test.svg';
  const box = h('div', { class: 'flame' });
  if (url) {
    const img = h('img', { src: url, alt: '' });
    img.addEventListener('error', () => {
      box.innerHTML = '';
      box.appendChild(inlineFlameSVG());
    });
    box.appendChild(img);
    return box;
  }
  box.appendChild(inlineFlameSVG());
  return box;
}

function normalizeFlameSpec(spec) {
  if (spec == null) return '';
  let str = '';
  if (typeof spec === 'number' && Number.isFinite(spec)) {
    str = String(Math.round(spec));
  } else if (typeof spec === 'string') {
    str = spec;
  } else {
    str = String(spec);
  }
  str = str.trim();
  if (!str) return '';
  return str
    .replace(/to/gi, '-')
    .replace(/[–—−]/g, '-')
    .replace(/\//g, '-')
    .replace(/[,_;]+/g, '-')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function parseFlameSpec(spec) {
  const norm = normalizeFlameSpec(spec);
  if (norm === '1' || norm === '2' || norm === '3' || norm === '4') {
    const count = Math.max(0, Math.min(4, parseInt(norm, 10) || 0));
    return { count, approx: false };
  }
  const approxMap = {
    '1-2': 2,
    '2-3': 3,
    '1-3': 3,
    '3-4': 4,
    '2-4': 4,
    '1-4': 4,
    '12': 2,
    '23': 3,
    '13': 3,
    '34': 4,
    '24': 4,
    '14': 4
  };
  if (Object.prototype.hasOwnProperty.call(approxMap, norm)) {
    return { count: approxMap[norm], approx: true };
  }
  return { count: 0, approx: false };
}

function flamesWrap(spec) {
  const { count, approx } = parseFlameSpec(spec);
  const wrap = h('div', { class: 'flames' + (approx ? ' approx' : '') });
  for (let i = 0; i < count; i += 1) {
    wrap.appendChild(flameNode());
  }
  return wrap;
}

// ---------- Footnotes ----------
function footnoteMap() {
  const list = Array.isArray(settings?.footnotes) ? settings.footnotes : [];
  const map = new Map();
  for (const fn of list) if (fn && fn.id) map.set(fn.id, { label: fn.label || '*', text: fn.text || '' });
  return map;
}
function noteSup(cell, notes) {
  const id = cell?.noteId; if (!id) return null;
  const fn = notes.get(id); if (!fn) return null;
  return h('sup', { class: 'note' }, String(fn.label || '*'));
}

const SLIDE_COMPONENT_DEFAULTS = { title:true, description:true, aromas:true, facts:true, infoBox:true, badges:true };

function getSlideComponentFlags(){
  const src = settings?.slides?.enabledComponents;
  const merged = { ...SLIDE_COMPONENT_DEFAULTS };
  if (src && typeof src === 'object'){
    Object.keys(merged).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(src, key)) merged[key] = !!src[key];
    });
  }
  return merged;
}

function renderComponentNodes(flags, defs, fallbackFactory, onNode){
  const enabled = flags || {};
  const anyEnabled = Object.values(enabled).some(Boolean);
  const nodes = [];
  let appendedCount = 0;
  defs.forEach(def => {
    if (!def) return;
    const { key } = def;
    if (!key) return;
    if (enabled[key] === false) return;
    const node = def.node ?? (typeof def.render === 'function' ? def.render() : null);
    if (!node) return;
    if (typeof onNode === 'function') {
      const res = onNode(node, def);
      if (res === undefined) {
        appendedCount++;
      } else if (res && res !== false) {
        nodes.push(res);
        appendedCount++;
      }
    } else {
      nodes.push(node);
      appendedCount++;
    }
  });
  if (appendedCount === 0 && typeof fallbackFactory === 'function'){
    const fallbackNode = fallbackFactory(anyEnabled);
    if (fallbackNode) {
      if (typeof onNode === 'function') {
        const res = onNode(fallbackNode, null);
        if (res === undefined) {
          appendedCount++;
        } else if (res && res !== false) {
          nodes.push(res);
          appendedCount++;
        }
      } else {
        nodes.push(fallbackNode);
        appendedCount++;
      }
    }
  }
  return nodes;
}

function gatherList(...values){
  const seen = new Set();
  const out = [];
  const add = (txt) => {
    const str = String(txt ?? '').trim();
    if (!str) return;
    const key = str.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(str);
  };
  const walk = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (typeof value === 'object') {
      if (typeof value.text === 'string') { walk(value.text); return; }
      if (typeof value.label === 'string') { walk(value.label); return; }
      if (typeof value.value === 'string') { walk(value.value); return; }
      if (typeof value.name === 'string') { walk(value.name); return; }
      return;
    }
    if (typeof value === 'string') {
      value.split(/[|•·;\n\r]+/).forEach(part => add(part));
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      add(value);
    }
  };
  values.forEach(walk);
  return out;
}

function firstText(...values){
  for (const value of values) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const parts = value.map(v => firstText(v)).filter(Boolean);
      if (parts.length) return parts.join(' · ');
      continue;
    }
    if (typeof value === 'object') {
      if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
      if (typeof value.label === 'string' && value.label.trim()) return value.label.trim();
      if (typeof value.value === 'string' && value.value.trim()) return value.value.trim();
      if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
      continue;
    }
    const str = String(value).trim();
    if (str) return str;
  }
  return '';
}

function extractImageUrl(source){
  if (!source) return '';
  if (typeof source === 'string') return source.trim();
  if (typeof source === 'object') {
    if (typeof source.url === 'string') return source.url.trim();
    if (typeof source.src === 'string') return source.src.trim();
  }
  return '';
}

function normalizeBadgeDescriptor(descriptor, fallbackId){
  if (descriptor == null) return null;
  const entry = (descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)) ? descriptor : null;
  const visible = entry ? (entry.enabled !== false && entry.visible !== false && entry.hidden !== true) : true;
  if (!visible) return null;
  const label = entry ? firstText(entry.label, entry.text, entry.title, entry.name, entry.value) : firstText(descriptor);
  const icon = entry ? firstText(entry.icon, entry.symbol, entry.glyph, entry.emoji) : '';
  let imageUrl = '';
  if (entry) {
    imageUrl = extractImageUrl(entry.imageUrl)
      || extractImageUrl(entry.iconUrl)
      || extractImageUrl(entry.image)
      || extractImageUrl(entry.media)
      || extractImageUrl(entry.url);
  }
  const fallbackStr = (typeof fallbackId === 'string' || typeof fallbackId === 'number' || typeof fallbackId === 'boolean')
    ? String(fallbackId).trim()
    : '';
  let id = '';
  if (entry) {
    const rawId = entry.id ?? entry.key ?? entry.code ?? entry.slug ?? entry.uid ?? fallbackStr;
    if (typeof rawId === 'string' || typeof rawId === 'number' || typeof rawId === 'boolean') {
      id = String(rawId).trim();
    }
  } else {
    id = fallbackStr;
  }
  const labelStr = String(label || '').trim();
  const iconStr = String(icon || '').trim();
  const preferLabelId = (!entry || (fallbackStr && id === fallbackStr && /^(?:row:|idx:|cell:|legacy$)/i.test(fallbackStr)));
  const finalId = preferLabelId ? (labelStr || iconStr || id) : (id || labelStr || iconStr);
  if (!finalId || (!labelStr && !iconStr && !imageUrl)) return null;
  const result = { id: finalId, label: labelStr, icon: iconStr };
  if (imageUrl) result.imageUrl = imageUrl;
  return result;
}

function getBadgeLookup(){
  const lib = settings?.slides?.badgeLibrary;
  const source = lib || null;
  if (badgeLookupCache && badgeLookupCache.source === source) return badgeLookupCache.value;
  const byId = new Map();
  const byLower = new Map();
  const addEntry = (descriptor, fallbackId) => {
    const badge = normalizeBadgeDescriptor(descriptor, fallbackId);
    if (!badge) return;
    const key = badge.id;
    if (!key) return;
    byId.set(key, badge);
    byLower.set(key.toLowerCase(), badge);
  };
  if (Array.isArray(lib)) {
    lib.forEach((entry, idx) => {
      if (entry == null) return;
      let fallback = `idx:${idx}`;
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const rawId = entry.id ?? entry.key ?? entry.code ?? entry.slug ?? entry.uid;
        if (typeof rawId === 'string' || typeof rawId === 'number' || typeof rawId === 'boolean') {
          fallback = rawId;
        }
      }
      addEntry(entry, fallback);
    });
  } else if (lib && typeof lib === 'object') {
    Object.entries(lib).forEach(([key, value]) => {
      addEntry(value, key);
    });
  }
  const value = { byId, byLower };
  badgeLookupCache = { source, value };
  return value;
}

function collectCellBadges(cell){
  if (!cell) return [];
  const { byId, byLower } = getBadgeLookup();
  const out = [];
  const seen = new Set();
  const addBadge = (badge) => {
    if (!badge) return;
    const idKey = (typeof badge.id === 'string') ? badge.id.trim().toLowerCase() : '';
    const composite = [badge.label, badge.icon, badge.imageUrl]
      .map(v => String(v || '').trim().toLowerCase())
      .join('|');
    const dedupeKey = idKey || composite;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push({ ...badge });
  };
  const lookupBadge = (raw, idx) => {
    if (raw == null) return;
    if (typeof raw === 'object' && !Array.isArray(raw)) {
      const badge = normalizeBadgeDescriptor(raw, raw.id ?? raw.key ?? raw.code ?? `cell:${idx}`);
      if (badge) addBadge(badge);
      return;
    }
    let id = '';
    if (typeof raw === 'string') id = raw.trim();
    else if (typeof raw === 'number' || typeof raw === 'boolean') id = String(raw);
    if (!id) return;
    const badge = byId.get(id) || byLower.get(id.toLowerCase());
    if (badge) addBadge(badge);
  };
  const ids = cell.badgeIds;
  if (Array.isArray(ids)) ids.forEach((value, idx) => lookupBadge(value, idx));
  else if (ids != null) lookupBadge(ids, 0);
  if (cell.badgeId != null) lookupBadge(cell.badgeId, 'single');
  if (!out.length) {
    const legacy = normalizeBadgeDescriptor({
      label: firstText(cell?.badgeLabel, cell?.badgeText, cell?.type),
      icon: firstText(cell?.badgeIcon)
    }, 'legacy');
    if (legacy) addBadge(legacy);
  }
  return out;
}

function collectCellDetails(cell){
  if (!cell) return { description:'', aromas:[], facts:[], badges:[] };
  const description = firstText(cell.description, cell.detail, cell.subtitle, cell.text, cell.extra);
  const aromas = gatherList(cell.aromaList, cell.aromas, cell.aroma, cell.scent, cell.scents);
  const facts = gatherList(cell.facts, cell.details, cell.detailsList, cell.tags, cell.chips, cell.meta, cell.badges);
  const badges = collectCellBadges(cell);
  return { description, aromas, facts, badges };
}

function createSaunaInfoBox(text){
  const str = typeof text === 'string' ? text : '';
  const normalized = str
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  if (!normalized.length) return null;
  const lines = normalized.map(line => {
    const parts = line.split(':');
    if (parts.length > 1){
      const label = parts.shift()?.trim() || '';
      const value = parts.join(':').trim();
      if (label && value){
        return h('div', { class: 'sauna-info-box__line' }, [
          h('span', { class: 'sauna-info-box__label', 'data-has-value': 'true' }, label),
          h('span', { class: 'sauna-info-box__value' }, value)
        ]);
      }
    }
    return h('div', { class: 'sauna-info-box__line' }, [
      h('span', { class: 'sauna-info-box__value' }, line)
    ]);
  });
  return h('div', { class: 'sauna-info-box' }, lines);
}

function createDescriptionNode(text, className){
  const str = String(text || '').trim();
  if (!str) return null;
  return h('p', { class: className || 'description' }, str);
}

function createAromaListNode(items, className){
  const values = [];
  let italic = false;
  const pushValue = (value) => {
    if (value == null) return;
    if (Array.isArray(value)) { value.forEach(pushValue); return; }
    const text = firstText(value);
    if (text) values.push(text);
  };
  if (Array.isArray(items)) {
    items.forEach(pushValue);
  } else if (items && typeof items === 'object') {
    if (Array.isArray(items.items)) items.items.forEach(pushValue);
    else if (Array.isArray(items.list)) items.list.forEach(pushValue);
    else if (Array.isArray(items.values)) items.values.forEach(pushValue);
    else if (Array.isArray(items.aromas)) items.aromas.forEach(pushValue);
    else pushValue(items);
    italic = items.italic === true || items.isItalic === true || items.style === 'italic';
  } else if (items != null) {
    pushValue(items);
  }
  if (!values.length) return null;
  const clsParts = (typeof className === 'string' && className.trim())
    ? className.split(/\s+/).filter(Boolean)
    : [];
  const hadLegacyItalic = clsParts.includes('is-italic');
  const filteredCls = clsParts.filter(cls => cls !== 'is-italic');
  if (!filteredCls.length) filteredCls.push('aroma-list');
  const shouldItalic = italic || hadLegacyItalic;
  const attrs = { class: filteredCls.join(' ') };
  if (shouldItalic) attrs.style = 'font-style:italic;';
  const nodes = values.map(item => h('li', item));
  return h('ul', attrs, nodes);
}

function createFactsList(items, className = 'facts', chipClass = 'card-chip'){
  const list = Array.isArray(items) ? items.filter(v => String(v || '').trim()) : [];
  if (!list.length) return null;
  const nodes = list.map(fact => h('li', { class: chipClass }, fact));
  return h('ul', { class: className }, nodes);
}

function collectUniqueBadges(badges){
  const list = [];
  const collect = (value, idx) => {
    if (value == null) return;
    const fallbackId = (value && typeof value === 'object' && !Array.isArray(value))
      ? (value.id ?? value.key ?? value.code ?? value.slug ?? value.uid ?? `row:${idx}`)
      : `row:${idx}`;
    const badge = normalizeBadgeDescriptor(value, fallbackId);
    if (badge) list.push(badge);
  };
  if (Array.isArray(badges)) badges.forEach((value, idx) => collect(value, idx));
  else if (badges != null) collect(badges, 0);
  if (!list.length) return [];
  const seen = new Set();
  const uniqueBadges = [];
  list.forEach(badge => {
    const idKey = (typeof badge.id === 'string') ? badge.id.trim().toLowerCase() : '';
    const composite = [badge.label, badge.icon, badge.imageUrl]
      .map(v => String(v || '').trim().toLowerCase())
      .join('|');
    const dedupeKey = idKey || composite;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    uniqueBadges.push({ ...badge });
  });
  return uniqueBadges;
}

function createBadgeRow(badges, className){
  const uniqueBadges = collectUniqueBadges(badges);
  if (!uniqueBadges.length) return null;
  const defaultIcon = String(settings?.slides?.infobadgeIcon || '').trim();
  const nodes = [];
  uniqueBadges.forEach(badge => {
    const iconChar = String(badge.icon || '').trim();
    const label = String(badge.label || '').trim();
    const imageUrl = String(badge.imageUrl || '').trim();
    const bits = [];
    const glyph = iconChar || defaultIcon;
    if (imageUrl) {
      bits.push(h('span', { class: 'badge-icon badge-icon--image' },
        h('img', { src: imageUrl, alt: '' })
      ));
    } else if (glyph) {
      bits.push(h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, glyph));
    }
    if (label) bits.push(h('span', { class: 'badge-label' }, label));
    if (!bits.length) return;
    const attrs = { class: 'badge' };
    if (badge.id) attrs['data-badge-id'] = badge.id;
    nodes.push(h('span', attrs, bits));
  });
  if (!nodes.length) return null;
  const clsParts = (typeof className === 'string' && className.trim())
    ? className.split(/\s+/).filter(Boolean)
    : [];
  if (!clsParts.includes('badge-row')) clsParts.unshift('badge-row');
  const node = h('div', { class: clsParts.join(' ') }, nodes);
  Object.defineProperty(node, '__badgeList', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: uniqueBadges
  });
  return node;
}

// ---------- Highlight logic ----------
function getHighlightMap() {
  const HL = settings?.highlightNext || {};
  if (!HL.enabled) return { bySauna: {}, byCell: {} };

  const before = Number.isFinite(+HL.minutesBeforeNext) ? +HL.minutesBeforeNext : (Number.isFinite(+HL.minutesWindow) ? +HL.minutesWindow : 15);
  const after  = Number.isFinite(+HL.minutesAfterStart) ? +HL.minutesAfterStart : (Number.isFinite(+HL.minutesAfter) ? +HL.minutesAfter : 15);
  const now = nowMinutes();

  const bySauna = {}; const byCell = {};
  (schedule?.saunas ?? []).forEach((saunaName, colIdx) => {
    const times = [];
    (schedule?.rows ?? []).forEach((row, ri) => {
      const cell = (row?.entries ?? [])[colIdx];
      if (!cell || !cell.title) return;
      const minutes = parseHM(row?.time);
      if (minutes == null) return;
      const offset = getRowSortOffset(row);
      const key = makeRowSortKey(row?.time, offset);
      times.push({ m: minutes, ri, time: row?.time || '', offset, key });
    });
    times.sort((a, b) => {
      if (a.m === b.m) return compareTimesWithOffset(a.time, a.offset, b.time, b.offset);
      return a.m - b.m;
    });
    let chosen = null;
    for (const t of times) { if (now >= t.m && now <= t.m + after) { chosen = t; break; } }
    if (!chosen) for (const t of times) { if (t.m >= now && (t.m - now) <= before) { chosen = t; break; } }
    if (chosen) {
      bySauna[saunaName] = new Set([chosen.key]);
      byCell['r' + chosen.ri + 'c' + colIdx] = true;
    }
  });
  return { bySauna, byCell };
}

// ---------- Overview table ----------

// --- Chip-Text fitting (Übersicht) ---
function fitChipText(el, mode){
const chip = el.closest('.chip'); if (!chip) return;

// Reset
el.style.fontSize = '';
el.classList.toggle('ellipsis', mode === 'ellipsis');
if (mode === 'ellipsis') return; // CSS erledigt Kürzung

const base = parseFloat(getComputedStyle(el).fontSize) || 16;
el.style.fontSize = base + 'px';

const cs = getComputedStyle(chip);
const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
const flamesBox = chip.querySelector('.chip-flames');
const flamesW = flamesBox ? flamesBox.getBoundingClientRect().width : 0;
const free = chip.clientWidth - padX - flamesW - 1;

if (el.scrollWidth <= free) return;

let size = base;
const min = Math.max(10, base * 0.6);
while (size > min && el.scrollWidth > free){
  size -= 0.5;
  el.style.fontSize = size + 'px';
}
if (el.scrollWidth > free){
  el.classList.add('ellipsis'); // letzte Sicherung
}
}
//ERRORS
window.onerror = function (msg, src, line, col) {
const d = document.createElement('div');
d.style = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,.5);color:#fff;padding:8px 10px;border-radius:8px;font:12px/1.2 monospace';
d.textContent = '[JS] ' + msg + ' @ ' + (src||'') + ':' + line + ':' + col;
document.body.appendChild(d);
};


function fitChipsIn(container){
const mode = document.body.dataset.chipOverflow || 'scale';
container.querySelectorAll('.chip .chip-text').forEach(n => fitChipText(n, mode));
}

function tableGrid(hlMap) {
if (!schedule) {
  return h('div', { class: 'caption grid-placeholder' }, 'Keine Daten verfügbar.');
}

const notes = footnoteMap();
const showOverviewFootnotes = (settings?.footnotesShowOnOverview !== false);
const showFlames = (settings?.fonts?.overviewShowFlames !== false);
const statusStateLocal = ensureSaunaStatusState();
const saunas = Array.isArray(schedule?.saunas) ? schedule.saunas : [];
const saunaInfo = saunas.map((name, idx) => ({
  name,
  idx,
  status: statusStateLocal.map.get(name) || SAUNA_STATUS.ACTIVE
}));
const visibleSaunas = saunaInfo.filter(info => info.status !== SAUNA_STATUS.HIDDEN);

const t = h('table', { class: 'grid' });
const colg = h('colgroup');
colg.appendChild(h('col', { class: 'c_time' }));
visibleSaunas.forEach(info => {
  const attrs = { class: 'c_auto' };
  if (info.status === SAUNA_STATUS.OUT_OF_ORDER) attrs['data-status'] = 'out-of-order';
  colg.appendChild(h('col', attrs));
});
t.appendChild(colg);

const thead = h('thead');
const tr = h('tr');
tr.appendChild(h('th', { class: 'timecol corner' }, 'Zeit'));
visibleSaunas.forEach(info => {
  const attrs = {};
  if (info.status === SAUNA_STATUS.OUT_OF_ORDER) attrs['data-status'] = 'out-of-order';
  const headerChildren = [info.name];
  if (info.status === SAUNA_STATUS.OUT_OF_ORDER) {
    headerChildren.push(h('span', { class: 'sauna-status-note' }, SAUNA_STATUS_TEXT[SAUNA_STATUS.OUT_OF_ORDER]));
  }
  tr.appendChild(h('th', attrs, headerChildren));
});
thead.appendChild(tr);
t.appendChild(thead);

const usedSet = new Set();
const tb = h('tbody');
(schedule?.rows ?? []).forEach((row, ri) => {
  const trr = h('tr');
  const timeText = formatTimeLabel(row?.time || '');
  trr.appendChild(h('td', { class: 'timecol' }, timeText));
  const entries = Array.isArray(row?.entries) ? row.entries : [];
  visibleSaunas.forEach(info => {
    const cell = entries[info.idx];
    const tdAttrs = {};
    const isOutOfOrder = info.status === SAUNA_STATUS.OUT_OF_ORDER;
    if (isOutOfOrder) tdAttrs['data-status'] = 'out-of-order';
    const td = h('td', tdAttrs, []);
    const key = 'r' + ri + 'c' + info.idx;

    if (!isOutOfOrder && cell && cell.title) {
      const title = String(cell.title).replace(/\*+$/, '');
      const hasStarInText = /\*$/.test(cell.title || '');
      const txt = h('div', { class: 'chip-text' }, title);
      if (showOverviewFootnotes && hasStarInText) {
        txt.appendChild(h('span', { class: 'notewrap' }, [h('sup', { class: 'note legacy' }, '*')]));
      }
      const supNote = showOverviewFootnotes ? noteSup(cell, notes) : null;
      if (supNote) {
        txt.appendChild(h('span', { class: 'notewrap' }, [supNote]));
        usedSet.add(cell.noteId);
      }

      const chipChildren = [txt];
      if (showFlames) {
        chipChildren.push(h('div', { class: 'chip-flames' }, [flamesWrap(cell.flames || '')]));
      }
      const chipClass = 'chip' + (hlMap?.byCell?.[key] ? ' highlight' : '');
      const chip = h('div', { class: chipClass }, chipChildren);
      const wrap = h('div', { class: 'cellwrap' }, [chip]);
      td.appendChild(wrap);
    } else if (!isOutOfOrder) {
      td.appendChild(h('div', { class: 'caption' }, '—'));
    }
    trr.appendChild(td);
  });
  tb.appendChild(trr);
});
t.appendChild(tb);

const footNodes = [];
const order = (settings?.footnotes||[]).map(fn=>fn.id);
for (const id of order){ if (usedSet.has(id)){ const v = notes.get(id); if (v) footNodes.push(h('div',{class:'fnitem'}, [h('sup',{class:'note'}, String(v.label||'*')), ' ', v.text])); } }
if (showOverviewFootnotes && footNodes.length){
  const layout = (settings?.footnoteLayout ?? 'one-line');
  const fnClass = 'footer-note ' + (layout==='multi' ? 'fn-multi' : layout==='stacked' ? 'fn-stack' : layout==='ticker' ? 'fn-ticker' : layout==='split' ? 'fn-split' : 'fn-one');
  if (layout === 'ticker') {
    const track = h('div', { class: 'fn-track' });
    const appendSequence = (useClones = false) => {
      footNodes.forEach((node, idx) => {
        const entry = useClones ? node.cloneNode(true) : node;
        track.appendChild(entry);
        if (idx < footNodes.length - 1) {
          track.appendChild(h('span', { class: 'fnsep', 'aria-hidden': 'true' }, '•'));
        }
      });
    };
    appendSequence(false);
    if (footNodes.length > 1) appendSequence(true);
    return h('div', {}, [ t, h('div', { class: fnClass }, [track]) ]);
  }
  const includeSeparator = layout !== 'stacked' && layout !== 'split';
  const nodes = [];
  footNodes.forEach((n,i)=>{ if (i>0 && includeSeparator) nodes.push(h('span',{class:'fnsep','aria-hidden':'true'}, '•')); nodes.push(n); });
  return h('div', {}, [ t, h('div', { class: fnClass }, nodes) ]);
}
return h('div', {}, [ t ]);
}

function updateOverviewTimeWidth(container) {
  if (!container) return;
  const table = container.querySelector('.grid');
  if (!table) {
    container.style.removeProperty('--ovTimeWidthPx');
    return;
  }
  const cells = table.querySelectorAll('.timecol');
  if (!cells.length) {
    container.style.removeProperty('--ovTimeWidthPx');
    return;
  }
  let max = 0;
  cells.forEach(cell => {
    const width = cell.scrollWidth;
    if (width > max) max = width;
  });
  if (max > 0) {
    container.style.setProperty('--ovTimeWidthPx', `${Math.ceil(max + 4)}px`);
  } else {
    container.style.removeProperty('--ovTimeWidthPx');
  }
}

function autoScaleOverview(container) {
  const wrap = container.querySelector('.ovwrap'); if (!wrap) return;

  // Reset (keine Breiten-Skalierung)
  wrap.style.transform = 'none';
  container.style.setProperty('--ovAuto', '1');

  const measure = () => {
    const headH = Array.from(container.querySelectorAll('.h1,.h2'))
      .reduce((a, el) => a + el.getBoundingClientRect().height, 0);
    const footEl = container.querySelector('.footer-note');
    const wrapRect = wrap.getBoundingClientRect();
    const footH = footEl ? footEl.getBoundingClientRect().height : 0;
    return { headH, footH, wrapH: wrapRect.height, totalH: headH + wrapRect.height + footH + 8 };
  };

  const availH = container.clientHeight;

  // Erster grober Faktor
  let m = measure();
  let s = Math.max(0.25, Math.min(1, availH / m.totalH));
  container.style.setProperty('--ovAuto', String(s));

  // Nach Layout-Update neu messen und ggf. nachjustieren
  requestAnimationFrame(() => {
    let m2 = measure();
    if (m2.totalH <= availH) return;
    let lo = 0.25, hi = s;
    for (let i = 0; i < 4; i++) {
      const mid = (lo + hi) / 2;
      container.style.setProperty('--ovAuto', String(mid));
      m2 = measure();
      if (m2.totalH > availH) {
        hi = mid;
      } else {
        lo = mid;
      }
      if (Math.abs(m2.totalH - availH) < 1) break;
    }
  });
}

function renderOverview(region = 'left') {
  const hlMap = getHighlightMap();
  const table = tableGrid(hlMap);
  const rightH2 = (((settings?.h2?.showOnOverview) ?? true) && (settings?.h2?.mode||'text')!=='none')
    ? h('h2',{class:'h2'}, computeH2Text() || '')
    : null;
  const bar = h('div',{class:'ovbar headings'}, [ h('h1',{class:'h1'}, 'Aufgussplan'), rightH2 ]);
  const c = h('div', {class:'container overview fade show'}, [ bar, h('div', {class:'ovwrap'}, [table]) ]);
  const recalc = () => {
    updateOverviewTimeWidth(c);
    autoScaleOverview(c);
    fitChipsIn(c); // nach dem Autoscale die Chip-Texte einpassen
  };
  setTimeout(recalc, 0);
  if (document.fonts?.ready) { document.fonts.ready.then(recalc).catch(()=>{}); }
  setResizeHandler(region, recalc);
  return c;
}

function formatTimeLabel(rawTime) {
  const input = typeof rawTime === 'string' ? rawTime.trim() : String(rawTime || '').trim();
  if (!input) return '';
  const cleaned = input.replace(/\s*uhr$/i, '').trim();
  if (!cleaned) return '';
  return settings?.slides?.appendTimeSuffix ? cleaned + ' Uhr' : cleaned;
}

function shouldUseFullHeadingWidth() {
  const raw = settings?.slides?.saunaTitleMaxWidthPercent;
  const actual = resolveHeadingWidthPercent(raw);
  return actual >= 100;
}

function renderHeroTimeline(region = 'left', ctx = {}) {
  const data = (heroTimeline.length ? heroTimeline : collectHeroTimelineData()).slice();
  return renderEventCountdown({ events: data }, region, ctx);
}

// ---------- Interstitial image slide ----------
function renderImage(url, region = 'left', ctx = {}) {
const fill = h('div', { class: 'imgFill', style: 'background-image:url("'+url+'")' });
const c = h('div', { class: 'container imgslide fade show' }, [ fill ]);
const img = new Image();
img.onload = () => {
  fill.style.backgroundSize = chooseFit(img.naturalWidth, img.naturalHeight);
};
img.src = url;
return c;
}

function shouldWaitForVideoEnd(entry){
  if (!entry || entry.type !== 'video') return false;
  if (Object.prototype.hasOwnProperty.call(entry, 'waitForEnd')) {
    return entry.waitForEnd === true;
  }
  return settings?.slides?.waitForVideo === true;
}

// ---------- Interstitial video slide ----------
function renderVideo(src, opts = {}, region = 'left', ctx = {}) {
const disp = getDisplayRatio();
const v = document.createElement('video');
v.preload = 'auto';
v.autoplay = true;
if (opts.muted !== undefined) v.muted = !!opts.muted;
else v.muted = true;
v.playsInline = true;
const hasAudio = opts.muted === false;
const backgroundAudioKey = hasAudio ? Symbol('video-audio') : null;
let backgroundAudioActive = false;
if (backgroundAudioKey) {
  suspendBackgroundAudio(backgroundAudioKey);
  backgroundAudioActive = true;
}
const releaseBackgroundAudio = () => {
  if (!backgroundAudioKey || !backgroundAudioActive) return;
  backgroundAudioActive = false;
  resumeBackgroundAudio(backgroundAudioKey);
};
const advance = typeof ctx.advance === 'function' ? ctx.advance : null;
const scheduleAdvance = typeof ctx.scheduleAdvance === 'function' ? ctx.scheduleAdvance : null;
const clearScheduledAdvance = typeof ctx.clearScheduledAdvance === 'function' ? ctx.clearScheduledAdvance : null;
const fit = () => {
  const baseW = settings?.display?.baseW || 1920;
  const baseH = settings?.display?.baseH || 1080;
  v.style.objectFit = chooseFit(
    v.videoWidth || baseW,
    v.videoHeight || baseH,
    { type: 'video' }
  );
};
if (v.readyState >= 1) fit(); else v.addEventListener('loadedmetadata', fit);
v.addEventListener('canplay', () => v.play());
v.addEventListener('error', (e) => {
  console.error('[video] error', e);
  releaseBackgroundAudio();
  const srcUrl = v.src;
  v.remove();
  if (srcUrl.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
  const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
  c.appendChild(fallback);
  if (advance) advance();
});
if (backgroundAudioKey) {
  v.addEventListener('ended', releaseBackgroundAudio, { once: true });
  v.addEventListener('pause', () => { if (!v.ended) releaseBackgroundAudio(); });
  v.addEventListener('abort', releaseBackgroundAudio, { once: true });
}
if (shouldWaitForVideoEnd(opts)) {
  const done = () => {
    if (done.called) return;
    done.called = true;
    if (clearScheduledAdvance) clearScheduledAdvance();
    if (advance) advance();
  };
  v.addEventListener('loadedmetadata', () => {
    const dur = Number.isFinite(v.duration) && v.duration > 0
      ? v.duration
      : (dwellMsForItem(opts, ctx.pageConfig) / 1000);
    const ms = Math.max(1000, dur * 1000) + 500;
    if (scheduleAdvance) scheduleAdvance(ms);
  }, { once: true });
  v.addEventListener('ended', () => { if (clearScheduledAdvance) clearScheduledAdvance(); done(); }, { once: true });
}
const c = h('div', { class: 'container videoslide fade show', style: 'aspect-ratio:' + disp });
c.appendChild(v);

if (backgroundAudioKey) {
  c.__cleanup = () => {
    releaseBackgroundAudio();
    if (typeof v.pause === 'function') {
      try { v.pause(); } catch {}
    }
  };
}

fetch(src, { method: 'HEAD' }).then(res => {
  if (!res.ok) {
    v.remove();
    const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
    c.appendChild(fallback);
    releaseBackgroundAudio();
    if (advance) advance();
    return;
  }
  v.src = src;
}).catch(() => {
  v.remove();
  const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
  c.appendChild(fallback);
  releaseBackgroundAudio();
  if (advance) advance();
});

return c;
}

// ---------- Interstitial external URL slide ----------
function renderUrl(src, region = 'left', ctx = {}) {
const f = h('iframe', {
  src,
  class: 'urlFill',
  style: 'border:0'
});
f.addEventListener('load', () => {
  try {
    const doc = f.contentWindow.document;
    const selectors = ['[id*="cookie"]', '.cookie-banner', '.cc-window', '.cookie-consent'];
    if (Array.isArray(settings?.popupSelectors)) {
      selectors.push(...settings.popupSelectors);
    }
    doc.querySelectorAll(selectors.join(',')).forEach(el => {
      if (typeof el.remove === 'function') el.remove();
      else el.style.display = 'none';
    });
  } catch (e) {
    /* ignore cross-origin */
  }
});
const c = h('div', { class: 'container urlslide fade show' }, [f]);
return c;
}


function normalizeStoryLayout(value) {
if (typeof value !== 'string') return '';
const norm = value.trim().toLowerCase();
if (!norm) return '';
if (['single', 'single-column', '1col', 'one', 'one-column', 'column1'].includes(norm)) return 'single';
if (['double', 'two', '2col', 'dual', 'split', 'two-column', 'columns'].includes(norm)) return 'double';
return '';
}

function normalizeMediaPosition(value) {
if (typeof value !== 'string') return '';
const norm = value.trim().toLowerCase();
if (!norm) return '';
if (['media-left', 'left', 'start'].includes(norm)) return 'left';
if (['media-right', 'right', 'end'].includes(norm)) return 'right';
if (['top', 'above', 'header'].includes(norm)) return 'top';
if (['bottom', 'below', 'footer'].includes(norm)) return 'bottom';
if (['full', 'fullwidth', 'full-width', 'wide', 'banner'].includes(norm)) return 'full';
return '';
}

function gatherStorySaunaTargets(value) {
const list = [];
const push = (entry) => {
  if (entry == null) return;
  if (Array.isArray(entry)) {
    entry.forEach(push);
    return;
  }
  if (typeof entry === 'object') {
    if (Array.isArray(entry.items)) { entry.items.forEach(push); return; }
    if (Array.isArray(entry.list)) { entry.list.forEach(push); return; }
    if (Array.isArray(entry.values)) { entry.values.forEach(push); return; }
  }
  const text = String(entry || '').trim();
  if (!text) return;
  if (!list.includes(text)) list.push(text);
};
push(value);
return list;
}

function normalizeStoryImageEntry(entry) {
if (!entry) return { url: '', alt: '', caption: '' };
if (typeof entry === 'string') {
  const url = entry.trim();
  return { url, alt: '', caption: '' };
}
if (Array.isArray(entry)) {
  for (const item of entry) {
    const normalized = normalizeStoryImageEntry(item);
    if (normalized.url) return normalized;
  }
  return { url: '', alt: '', caption: '' };
}
if (typeof entry !== 'object') return { url: '', alt: '', caption: '' };
const url = String(entry.url || entry.src || entry.imageUrl || '').trim();
const alt = String(entry.alt || entry.imageAlt || entry.title || '').trim();
const captionRaw = String(entry.caption || entry.imageCaption || '').trim();
const credit = String(entry.credit || '').trim();
const caption = credit ? [captionRaw, credit].filter(Boolean).join(' · ') : captionRaw;
const result = { url, alt, caption };
if (entry.aspect || entry.ratio) {
  const aspect = String(entry.aspect || entry.ratio || '').trim();
  if (aspect) result.aspect = aspect;
}
if (entry.placeholder) result.placeholder = entry.placeholder;
return result;
}

function normalizeStoryGallery(items) {
const list = Array.isArray(items) ? items : [];
return list.map(item => {
  if (!item) return null;
  if (typeof item === 'string') {
    const url = item.trim();
    return url ? { url, alt: '', caption: '' } : null;
  }
  if (typeof item !== 'object') return null;
  const url = String(item.url || item.imageUrl || item.src || '').trim();
  if (!url) return null;
  const alt = String(item.alt || item.imageAlt || '').trim();
  const caption = String(item.caption || item.text || '').trim();
  return { url, alt, caption };
}).filter(Boolean);
}

function normalizeStoryFaq(items) {
const list = Array.isArray(items) ? items : [];
return list.map(entry => {
  if (!entry || typeof entry !== 'object') return null;
  const question = String(entry.question || entry.q || '').trim();
  const answer = String(entry.answer || entry.a || '').trim();
  if (!question && !answer) return null;
  return { question: question || 'Frage', answer };
}).filter(Boolean);
}

function normalizeParagraphString(value) {
if (Array.isArray(value)) {
  return value.map(v => String(v || '').trim()).filter(Boolean).join('\n\n');
}
return String(value ?? '').trim();
}

function normalizeTipsList(value) {
const out = [];
const push = (entry) => {
  if (entry == null) return;
  if (Array.isArray(entry)) { entry.forEach(push); return; }
  const str = String(entry || '').trim();
  if (!str) return;
  str.split(/\r?\n/).forEach(line => {
    const cleaned = line.replace(/^[-•]\s*/, '').trim();
    if (cleaned) out.push(cleaned);
  });
};
push(value);
return out;
}

function normalizeStorySectionType(value) {
const norm = String(value || '').trim().toLowerCase();
if (!norm) return '';
if (['image', 'media', 'photo', 'picture'].includes(norm)) return 'image';
if (['gallery', 'grid'].includes(norm)) return 'gallery';
if (['faq', 'questions'].includes(norm)) return 'faq';
if (['availability', 'schedule'].includes(norm)) return 'availability';
if (['custom'].includes(norm)) return 'custom';
return 'card';
}

function normalizeStorySection(section) {
if (section == null) return null;
if (typeof section === 'function') return { type: 'custom', render: section };
if (typeof section === 'string') {
  const trimmed = section.trim();
  return trimmed ? { type: 'card', text: trimmed } : null;
}
if (Array.isArray(section)) {
  const merged = section.map(normalizeStorySection).filter(Boolean);
  if (!merged.length) return null;
  if (merged.length === 1) return merged[0];
  return { type: 'card', bodyNodes: merged.map(entry => entry.bodyNodes).flat().filter(Boolean) };
}
if (typeof section !== 'object') return null;
if (typeof section.render === 'function') return { type: 'custom', render: section.render };
const type = normalizeStorySectionType(section.type || section.kind || section.variant);
if (type === 'image') {
  const image = normalizeStoryImageEntry(section.image || section.media || section);
  if (!image.url && !section.showPlaceholder) {
    const heading = String(section.heading || section.title || '').trim();
    const text = normalizeParagraphString(section.text || section.description);
    if (!heading && !text) return null;
  }
  const heading = String(section.heading || section.title || '').trim();
  const subheading = String(section.subheading || section.caption || '').trim();
  const description = String(section.text || section.description || '').trim();
  const out = {
    type: 'image',
    heading,
    subheading,
    description,
    image,
    className: String(section.className || '').trim(),
    variant: String(section.variant || '').trim()
  };
  if (section.showPlaceholder) out.showPlaceholder = true;
  return out;
}
if (type === 'availability') {
  return {
    type: 'availability',
    title: String(section.heading || section.title || section.label || '').trim(),
    description: String(section.description || section.text || '').trim(),
    emptyMessage: String(section.emptyMessage || section.emptyText || '').trim(),
    saunas: gatherStorySaunaTargets(section.saunas || section.saunaRefs || section.sauna)
  };
}
const gallery = normalizeStoryGallery(section.gallery || section.items || []);
if (type === 'gallery' && gallery.length) {
  return {
    type: 'card',
    className: 'story-card--gallery',
    heading: String(section.heading || section.title || '').trim(),
    gallery,
    text: normalizeParagraphString(section.text)
  };
}
const faq = normalizeStoryFaq(section.faq || section.items || []);
if (type === 'faq' && faq.length) {
  return {
    type: 'card',
    className: 'story-card--faq',
    heading: String(section.heading || section.title || 'FAQ').trim(),
    faq
  };
}
const card = {
  type: 'card',
  id: section.id,
  className: String(section.className || '').trim(),
  kicker: String(section.kicker || section.overline || section.label || '').trim(),
  heading: String(section.heading || section.title || '').trim(),
  subheading: String(section.subheading || '').trim(),
  text: normalizeParagraphString(section.text ?? section.body ?? section.description),
  paragraphs: Array.isArray(section.paragraphs) ? section.paragraphs : null,
  list: Array.isArray(section.list) ? section.list : (Array.isArray(section.items) ? section.items : null),
  listStyle: String(section.listStyle || section.listType || '').trim(),
  image: (section.image || section.media || section.imageUrl || section.mediaUrl)
    ? normalizeStoryImageEntry(section.image || section.media || { url: section.imageUrl || section.mediaUrl, alt: section.imageAlt, caption: section.imageCaption })
    : null,
  mediaPosition: normalizeMediaPosition(section.mediaPosition || section.imagePosition || section.layout),
  bodyNodes: Array.isArray(section.bodyNodes) ? section.bodyNodes : null,
  gallery: gallery.length ? gallery : null,
  faq: faq.length ? faq : null,
  badges: Array.isArray(section.badges) ? section.badges : null
};
const tips = normalizeTipsList(section.tips);
if (tips.length) {
  card.list = Array.isArray(card.list) && card.list.length ? card.list : tips;
}
return card;
}

function normalizeStoryColumn(column) {
const src = column && typeof column === 'object' ? column : {};
const rawSections = Array.isArray(src.sections) ? src.sections : (Array.isArray(src.content) ? src.content : []);
const sections = [];
rawSections.forEach(entry => {
  const normalized = normalizeStorySection(entry);
  if (normalized) sections.push(normalized);
});
if (!sections.length && (src.image || src.imageUrl || src.url)) {
  const img = normalizeStoryImageEntry(src.image || { url: src.imageUrl || src.url, alt: src.alt, caption: src.caption });
  if (img.url) sections.push({ type: 'image', image: img });
}
return { sections, role: src.role || '', width: src.width || '' };
}

function normalizeLegacyRichSection(entry) {
if (!entry || typeof entry !== 'object') return null;
const heading = String(entry.title || '').trim();
const text = normalizeParagraphString(entry.text || entry.description);
const tips = normalizeTipsList(entry.tips ?? entry.list);
const imageSrc = entry.image || entry.media || (entry.imageUrl || entry.mediaUrl ? { url: entry.imageUrl || entry.mediaUrl, alt: entry.imageAlt, caption: entry.imageCaption } : null);
const image = imageSrc ? normalizeStoryImageEntry(imageSrc) : null;
const hasContent = heading || text || (tips.length) || (image && image.url);
if (!hasContent) return null;
return {
  type: 'card',
  className: 'story-card--rich',
  heading,
  text,
  list: tips.length ? tips : null,
  image,
  mediaPosition: normalizeMediaPosition(entry.mediaPosition || entry.layout)
};
}

function normalizeStoryColumnRole(value, fallback = 'left') {
const norm = String(value || '').trim().toLowerCase();
if (norm === 'right') return 'right';
if (norm === 'left') return 'left';
return fallback === 'right' ? 'right' : 'left';
}

function convertModernBuilderSection(entry) {
if (!entry || typeof entry !== 'object') return null;
const builderKeys = [
  'body', 'image', 'imageUrl', 'mediaUrl', 'mediaPosition', 'column', 'side',
  'imageAlt', 'paragraphs', 'badges', 'list', 'items', 'kicker', 'overline',
  'subheading'
];
const hasBuilderFields = builderKeys.some(key => entry[key] != null);
if (!hasBuilderFields) return null;
const normalized = normalizeStorySection(entry);
if (!normalized) return null;
const column = normalizeStoryColumnRole(entry.column || entry.side || '');
return { column, section: normalized };
}

function convertLegacyStory(story, base = {}) {
const heading = base.heading || String(story.title || '').trim();
const subheading = base.subheading || String(story.subtitle || '').trim();
const heroRaw = story.hero || { url: story.heroUrl, alt: story.heroAlt, caption: story.heroCaption };
const hero = normalizeStoryImageEntry(heroRaw);
const sections = [];
const pushSection = (section) => { if (section) sections.push(section); };
const builderColumns = { left: [], right: [] };
let hasBuilderSections = false;

const createSimpleCard = ({ heading: cardHeading, subheading: cardSubheading, text, image, mediaPosition }) => {
  const headingText = String(cardHeading || '').trim();
  const subheadingText = String(cardSubheading || '').trim();
  const paragraph = normalizeParagraphString(text);
  const imageEntry = image ? normalizeStoryImageEntry(image) : null;
  const hasImage = imageEntry && imageEntry.url;
  const normalizedMediaPosition = normalizeMediaPosition(mediaPosition);
  if (!headingText && !subheadingText && !paragraph && !hasImage) return null;
  const card = { type: 'card' };
  if (headingText) card.heading = headingText;
  if (subheadingText) card.subheading = subheadingText;
  if (paragraph) card.text = paragraph;
  if (hasImage) card.image = imageEntry;
  if (normalizedMediaPosition) card.mediaPosition = normalizedMediaPosition;
  return card;
};

const convertLegacyRichSection = (entry) => {
  const richCard = normalizeLegacyRichSection(entry);
  if (!richCard) return null;
  const parts = [];
  if (richCard.text) parts.push(richCard.text);
  if (Array.isArray(richCard.list) && richCard.list.length) {
    parts.push(richCard.list.map(item => String(item || '').trim()).filter(Boolean).join(' · '));
  }
  return createSimpleCard({
    heading: richCard.heading,
    subheading: richCard.subheading,
    text: parts.join('\n\n'),
    image: richCard.image,
    mediaPosition: richCard.mediaPosition
  });
};

const legacyEntries = [];
if (Array.isArray(story.sections)) legacyEntries.push(...story.sections);
else if (Array.isArray(story.content)) legacyEntries.push(...story.content);

legacyEntries.forEach(entry => {
  if (entry == null) return;
  const builder = convertModernBuilderSection(entry);
  if (builder) {
    hasBuilderSections = true;
    if (builder.column === 'right') builderColumns.right.push(builder.section);
    else builderColumns.left.push(builder.section);
    return;
  }
  const section = convertLegacyRichSection(entry);
  if (section) pushSection(section);
});

const extras = [];
const addExtra = (section) => { if (section) extras.push(section); };

const intro = normalizeParagraphString(story.intro);
if (intro) addExtra(createSimpleCard({ heading: 'Einführung', text: intro }));

const ritual = normalizeParagraphString(story.ritual);
if (ritual) addExtra(createSimpleCard({ heading: 'Ritual', text: ritual }));

const tips = normalizeTipsList(story.tips);
if (tips.length) addExtra(createSimpleCard({ heading: 'Tipps', text: tips.join(' · ') }));

const galleryItems = normalizeStoryGallery(story.gallery);
if (galleryItems.length) {
  const galleryTitle = String(story.galleryTitle || '').trim() || 'Galerie';
  galleryItems.forEach((item, index) => {
    const caption = String(item.caption || '').trim();
    const headingText = index === 0 ? galleryTitle : (caption || galleryTitle);
    const subheadingText = index === 0 && caption && caption !== headingText ? caption : '';
    addExtra(createSimpleCard({ heading: headingText, subheading: subheadingText, image: item }));
  });
}

const faqItems = normalizeStoryFaq(story.faq);
if (faqItems.length) {
  const faqText = faqItems
    .map(item => {
      const question = String(item.question || '').trim();
      const answer = String(item.answer || '').trim();
      return [question ? `Q: ${question}` : '', answer ? `A: ${answer}` : ''].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .join('\n\n');
  addExtra(createSimpleCard({ heading: 'FAQ', text: faqText }));
}

const saunaTargets = gatherStorySaunaTargets(story.saunas || story.saunaRefs || story.sauna);
if (saunaTargets.length) {
  addExtra(createSimpleCard({ heading: 'Heute verfügbar', text: saunaTargets.join(', ') }));
}

if (hasBuilderSections && sections.length) {
  builderColumns.left.push(...sections);
  sections.length = 0;
}

if (hasBuilderSections) {
  extras.forEach(section => {
    if (!section) return;
    const target = builderColumns.left.length <= builderColumns.right.length
      ? builderColumns.left
      : builderColumns.right;
    target.push(section);
  });
} else {
  extras.forEach(pushSection);
}

const totalSectionCount = hasBuilderSections
  ? builderColumns.left.length + builderColumns.right.length
  : sections.length;

if (!totalSectionCount) {
  const fallbackText = normalizeParagraphString(story.text || story.body || story.description);
  const fallbackSection = createSimpleCard({ text: fallbackText });
  if (fallbackSection) {
    if (hasBuilderSections) builderColumns.left.push(fallbackSection);
    else pushSection(fallbackSection);
  }
}

const columns = [];
if (hasBuilderSections) {
  const leftSections = builderColumns.left.filter(Boolean);
  const rightSections = builderColumns.right.filter(Boolean);
  if (leftSections.length) columns.push({ role: 'left', sections: leftSections });
  if (rightSections.length) columns.push({ role: 'right', sections: rightSections });
} else if (sections.length) {
  columns.push({ sections });
}
if (hero.url) {
  columns.push({ role: 'hero', sections: [{ type: 'image', image: hero, variant: 'hero', className: 'story-image-block--hero' }] });
}
const layout = columns.length > 1 ? 'double' : 'single';
return {
  heading,
  subheading,
  layout,
  columns,
  origin: 'legacy',
  legacy: story,
  raw: story,
  __isNormalizedStory: true
};
}

function normalizeStoryForRender(story = {}) {
const headingRaw = String(story.heading || story.title || '').trim();
const subheadingRaw = String(story.subheading || story.subtitle || '').trim();
if (Array.isArray(story.columns)) {
  const rawColumns = story.columns.map(normalizeStoryColumn);
  const layoutNormalized = normalizeStoryLayout(story.layout);
  let columns;
  if (layoutNormalized === 'double') {
    const findByRole = (role) => rawColumns.find(col => (col.role || '').toLowerCase() === role);
    const left = findByRole('left') || { role: 'left', sections: [] };
    const right = findByRole('right') || { role: 'right', sections: [] };
    const extras = rawColumns.filter(col => {
      const role = (col.role || '').toLowerCase();
      return role !== 'left' && role !== 'right' && col.sections.length;
    });
    columns = [left, right, ...extras];
  } else {
    columns = rawColumns.filter(col => col.sections.length);
  }
  const layout = layoutNormalized || (columns.length > 1 ? 'double' : 'single');
  return {
    heading: headingRaw,
    subheading: subheadingRaw,
    layout,
    columns,
    origin: 'structured',
    legacy: null,
    raw: story,
    __isNormalizedStory: true
  };
}
return convertLegacyStory(story, { heading: headingRaw, subheading: subheadingRaw });
}

function findPrimaryStoryImage(story) {
const normalized = story && story.__isNormalizedStory ? story : normalizeStoryForRender(story || {});
for (const column of normalized.columns || []) {
  for (const section of column.sections || []) {
    if (section.type === 'image' && section.image && section.image.url) return section.image.url;
    if (section.image && section.image.url) return section.image.url;
  }
}
const fallback = normalized.raw && (normalized.raw.heroUrl || (normalized.raw.hero && normalized.raw.hero.url));
return fallback ? String(fallback).trim() : '';
}
function collectStoryImageUrls(story, limit = 3) {
const normalized = story && story.__isNormalizedStory ? story : normalizeStoryForRender(story || {});
const urls = [];
const seen = new Set();
const push = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  urls.push(trimmed);
};
(normalized.columns || []).forEach(column => {
  (column.sections || []).forEach(section => {
    if (section && section.image && section.image.url) push(section.image.url);
    if (section && Array.isArray(section.gallery)) {
      section.gallery.forEach(item => push(item && item.url));
    }
  });
});
const fallback = normalized.raw && (normalized.raw.heroUrl || (normalized.raw.hero && normalized.raw.hero.url));
push(fallback);
if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
  return urls.slice(0, Math.max(1, Math.floor(limit)));
}
return urls;
}



function autoScaleStorySlide(container) {
if (!container) return;
const base = Number(container.dataset.storyBaseScale);
if (!Number.isFinite(base) || base <= 0) return;
const parent = container.parentElement;
const available = parent ? parent.clientHeight : container.clientHeight;
if (!available) return;

const applyScale = (factor) => {
  const clamped = Math.max(0.35, Math.min(1, Number(factor) || 0));
  container.style.setProperty('--story-section-scale', (base * clamped).toFixed(3));
  container.dataset.storyAutoScale = clamped.toFixed(3);
  container.classList.toggle('story-slide--scaled', clamped < 0.999);
};

applyScale(1);

const measure = () => container.getBoundingClientRect().height;
let total = measure();
if (total <= available) return;

let lo = 0.35;
let hi = 1;
let best = lo;

for (let i = 0; i < 6; i++) {
  const mid = (lo + hi) / 2;
  applyScale(mid);
  total = measure();
  if (total > available) {
    hi = mid;
  } else {
    best = mid;
    lo = mid;
  }
}

applyScale(best);
}

function renderStorySlide(story = {}, region = 'left') {
const normalized = normalizeStoryForRender(story || {});
const layoutClass = normalized.layout === 'double' ? 'story-layout-double' : 'story-layout-single';
const container = h('div', { class: `container story-slide fade show ${layoutClass}`.trim() });
const headingText = String(normalized.heading || '').trim();
container.appendChild(h('h1', { class: 'story-heading' }, headingText));

const sectionsWrap = h('div', { class: 'story-sections' });
let sectionCount = 0;
const columnSectionCounts = [];
const appendSectionNode = (section, context, parent) => {
  const node = buildStorySectionNode(section, context);
  if (!node) return false;
  sectionCount += 1;
  if (context && context.columnIndex != null) {
    node.dataset.columnIndex = String(context.columnIndex);
  }
  if (context && context.sectionIndex != null) {
    node.dataset.sectionIndex = String(context.sectionIndex);
  }
  (parent || sectionsWrap).appendChild(node);
  return true;
};

const columnsList = Array.isArray(normalized.columns) ? normalized.columns : [];
if (normalized.layout === 'double') {
  sectionsWrap.classList.add('story-sections--double');
  columnsList.forEach((column, columnIndex) => {
    const columnEl = h('div', { class: 'story-column' });
    columnEl.dataset.columnIndex = String(columnIndex);
    if (column.role) columnEl.dataset.columnRole = String(column.role);
    let columnCount = 0;
    (column.sections || []).forEach((section, sectionIndex) => {
      if (appendSectionNode(section, {
        columnIndex,
        sectionIndex,
        normalizedStory: normalized,
        rawStory: normalized.raw,
        legacyStory: normalized.legacy
      }, columnEl)) {
        columnCount += 1;
      }
    });
    columnSectionCounts.push(columnCount);
    if (!columnCount) columnEl.classList.add('story-column--empty');
    sectionsWrap.appendChild(columnEl);
  });
} else {
  columnsList.forEach((column, columnIndex) => {
    let columnCount = 0;
    (column.sections || []).forEach((section, sectionIndex) => {
      if (appendSectionNode(section, {
        columnIndex,
        sectionIndex,
        normalizedStory: normalized,
        rawStory: normalized.raw,
        legacyStory: normalized.legacy
      })) {
        columnCount += 1;
      }
    });
    if (columnCount) columnSectionCounts.push(columnCount);
  });
}

if (!sectionCount) {
  sectionsWrap.innerHTML = '';
  sectionsWrap.appendChild(
    h('section', { class: 'story-section story-section--empty' }, [
      h('p', { class: 'story-section-empty' }, 'Keine Inhalte verfügbar.')
    ])
  );
}

container.appendChild(sectionsWrap);
container.dataset.storySectionCount = String(sectionCount);
container.style.setProperty('--story-section-count', String(Math.max(sectionCount, 1)));
const rawColumnCount = columnsList.length;
const columnCount = normalized.layout === 'double' ? Math.max(rawColumnCount || 0, 2) : Math.max(rawColumnCount || 0, 1);
container.dataset.storyColumnCount = String(columnCount);
container.style.setProperty('--story-column-count', String(columnCount));
const maxPerColumnRaw = columnSectionCounts.reduce((max, value) => Math.max(max, value || 0), 0);
const singleDensity = Math.max(sectionCount, 1);
const maxPerColumnCount = normalized.layout === 'double'
  ? Math.max(maxPerColumnRaw, 1)
  : singleDensity;
container.dataset.storyMaxPerColumn = String(maxPerColumnCount);
container.style.setProperty('--story-section-max-per-column', String(maxPerColumnCount));
const density = normalized.layout === 'double' ? maxPerColumnCount : singleDensity;
const baseWidth = columnCount > 1 ? 40 : 48;
const mediaWidth = Math.max(18, baseWidth - Math.max(density - 1, 0) * 4);
container.style.setProperty('--story-section-media-basis', mediaWidth.toFixed(2) + '%');
const baseScale = columnCount > 1 ? 0.92 : 1;
const scale = Math.max(0.6, baseScale - Math.max(density - 1, 0) * 0.08);
container.style.setProperty('--story-section-scale', scale.toFixed(3));
container.dataset.storyBaseScale = scale.toFixed(3);
container.dataset.storyAutoScale = '1';

const recalc = () => autoScaleStorySlide(container);
setTimeout(recalc, 0);
requestAnimationFrame(recalc);
if (document.fonts?.ready) {
  document.fonts.ready.then(recalc).catch(() => {});
}
container.querySelectorAll('img').forEach(img => {
  img.addEventListener('load', recalc);
  img.addEventListener('error', recalc);
});
setResizeHandler(region, recalc);

return container;

function buildStorySectionNode(section, ctx) {
  if (!section) return null;
  if (section.type === 'custom' && typeof section.render === 'function') {
    try {
      return section.render({ ...ctx, section });
    } catch (err) {
      console.warn('[slideshow] story custom section failed', err);
      return null;
    }
  }
  if (typeof section.render === 'function' && section.type !== 'card' && section.type !== 'image') {
    try {
      return section.render({ ...ctx, section });
    } catch (err) {
      console.warn('[slideshow] story section render failed', err);
      return null;
    }
  }
  if (section.type === 'image') return buildStoryImageBlock(section, ctx);
  if (section.type === 'availability') return buildStoryAvailabilityCard(section, ctx);
  return buildStoryCard(section, ctx);
}

function createStoryMediaFigure(image, options = {}) {
  const {
    className = 'story-section-figure',
    fallbackText = 'Bild nicht verfügbar',
    showPlaceholder = false
  } = options;
  const data = image || {};
  const url = String(data.url || '').trim();
  const alt = String(data.alt || '').trim();
  const caption = String(data.caption || '').trim();
  if (!url && !showPlaceholder) return null;
  const classList = String(className || '').trim() || 'story-section-figure';
  const baseClass = classList.split(/\s+/)[0] || 'story-section-figure';
  const fallbackClass = `${baseClass}-fallback`;
  const figure = h('figure', { class: classList });
  if (data.aspect) figure.dataset.aspect = data.aspect;
  if (url) {
    const img = h('img', { src: url, alt });
    img.addEventListener('error', () => {
      figure.classList.add('is-error');
      figure.replaceChildren(h('div', { class: fallbackClass }, fallbackText));
    });
    figure.appendChild(img);
    if (caption) figure.appendChild(h('figcaption', caption));
  } else {
    figure.classList.add('is-placeholder');
    figure.appendChild(h('div', { class: fallbackClass }, fallbackText));
  }
  return figure;
}

function collectParagraphStrings(value) {
  const blocks = [];
  const push = (input) => {
    if (input == null) return;
    if (Array.isArray(input)) { input.forEach(push); return; }
    const text = String(input || '').replace(/\r\n/g, '\n');
    const parts = text.split(/\n\s*\n+/);
    parts.forEach(part => {
      const cleaned = part.replace(/\s+/g, ' ').trim();
      if (cleaned) blocks.push(cleaned);
    });
  };
  push(value);
  return blocks;
}

function collectListItems(value) {
  const items = [];
  let hasStripeInSauna = false;
  const push = (entry) => {
    if (entry == null) return;
    if (Array.isArray(entry)) { entry.forEach(push); return; }
    if (typeof entry === 'object') {
      const text = String(entry.text || entry.title || entry.label || entry.caption || '').trim();
      if (text) { push(text); }
      return;
    }
    const raw = String(entry || '').trim();
    if (!raw) return;
    const lines = raw.split(/\r?\n/).map(line => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
    if (lines.length) lines.forEach(line => items.push(line));
    else items.push(raw);
  };
  push(value);
  return items;
}

function buildStoryGalleryGrid(items) {
  const list = Array.isArray(items) ? items : [];
  const grid = h('div', { class: 'story-gallery-grid' });
  list.forEach(item => {
    const figure = createStoryMediaFigure(item, { className: 'story-gallery-item', fallbackText: 'Bild nicht verfügbar', showPlaceholder: false });
    if (figure) grid.appendChild(figure);
  });
  return grid.childNodes.length ? grid : null;
}

function buildStoryFaqList(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return null;
  const dl = h('dl', { class: 'story-faq-list' });
  list.forEach(item => {
    const question = String(item.question || '').trim() || 'Frage';
    const answer = String(item.answer || '').trim();
    dl.appendChild(h('dt', question));
    dl.appendChild(h('dd', answer));
  });
  return dl;
}

function buildStoryCard(section, ctx) {
  const classes = ['story-section', 'story-section--content'];
  if (section.className) {
    section.className.split(/\s+/).filter(Boolean).forEach(cls => {
      if (cls.startsWith('story-card--')) classes.push(`story-section--${cls.slice('story-card--'.length)}`);
      else classes.push(cls);
    });
  }

  const sectionEl = h('section', { class: classes.join(' ') });
  const mediaFigure = section.image
    ? createStoryMediaFigure(section.image, {
        className: 'story-section-figure',
        fallbackText: 'Bild nicht verfügbar',
        showPlaceholder: section.showPlaceholder === true
      })
    : null;

  const headerNodes = [];
  if (section.kicker) headerNodes.push(h('p', { class: 'story-section-kicker' }, section.kicker));
  if (section.heading) headerNodes.push(h('h2', { class: 'story-section-heading' }, section.heading));
  if (section.subheading) headerNodes.push(h('p', { class: 'story-section-subheading' }, section.subheading));

  const bodyChildren = [];
  const appendParagraphs = (value) => {
    collectParagraphStrings(value).forEach(text => bodyChildren.push(h('p', { class: 'story-section-paragraph' }, text)));
  };

  if (Array.isArray(section.bodyNodes)) {
    section.bodyNodes.forEach(node => {
      if (!node) return;
      if (typeof node === 'string') appendParagraphs(node);
      else if (node.nodeType) bodyChildren.push(node);
    });
  }

  appendParagraphs(section.text);
  if (section.paragraphs) appendParagraphs(section.paragraphs);
  if (section.description && !section.text) appendParagraphs(section.description);

  const listItems = collectListItems(section.list || section.tips);
  if (listItems.length) {
    const listTag = ['ol', 'ordered', 'numbered', 'numbers', 'numeric'].includes((section.listStyle || '').toLowerCase()) ? 'ol' : 'ul';
    bodyChildren.push(h(listTag, { class: 'story-section-list' }, listItems.map(item => h('li', item))));
  }

  if (section.gallery) {
    const galleryNode = buildStoryGalleryGrid(section.gallery);
    if (galleryNode) bodyChildren.push(galleryNode);
  }

  if (section.faq) {
    const faqNode = buildStoryFaqList(section.faq);
    if (faqNode) bodyChildren.push(faqNode);
  }

  if (section.badges) {
    const badgeRow = createBadgeRow(section.badges, 'badge-row story-section-badges');
    if (badgeRow) bodyChildren.push(badgeRow);
  }

  if (Array.isArray(section.extraBodyNodes)) {
    section.extraBodyNodes.forEach(node => {
      if (!node) return;
      if (typeof node === 'string') appendParagraphs(node);
      else if (node.nodeType) bodyChildren.push(node);
    });
  }

  const contentChildren = [];
  if (headerNodes.length) contentChildren.push(...headerNodes);
  if (bodyChildren.length) contentChildren.push(...bodyChildren);
  const content = contentChildren.length ? h('div', { class: 'story-section-content' }, contentChildren) : null;

  const mediaPosition = String(section.mediaPosition || '').trim().toLowerCase();
  const mediaWrapper = mediaFigure ? h('div', { class: 'story-section-media' }, [mediaFigure]) : null;

  if (mediaWrapper) {
    sectionEl.classList.add('story-section--has-media');
    if (mediaPosition === 'right') sectionEl.classList.add('story-section--media-right');
    else if (mediaPosition === 'bottom') sectionEl.classList.add('story-section--media-bottom');
    else if (mediaPosition === 'full') sectionEl.classList.add('story-section--media-full');
    else sectionEl.classList.add('story-section--media-left');
  }

  const childNodes = [];
  if (mediaWrapper && (mediaPosition === 'right' || mediaPosition === 'bottom')) {
    if (content) childNodes.push(content);
    childNodes.push(mediaWrapper);
  } else {
    if (mediaWrapper) childNodes.push(mediaWrapper);
    if (content) childNodes.push(content);
  }

  childNodes.forEach(node => sectionEl.appendChild(node));
  if (!sectionEl.childNodes.length) return null;
  return sectionEl;
}

function resolveAvailabilityTargets(section, ctx) {
  const sources = [
    section && (section.saunas || section.saunaRefs || section.sauna),
    ctx.rawStory && (ctx.rawStory.saunas || ctx.rawStory.saunaRefs || ctx.rawStory.sauna),
    ctx.legacyStory && ctx.legacyStory !== ctx.rawStory && (ctx.legacyStory.saunas || ctx.legacyStory.saunaRefs || ctx.legacyStory.sauna)
  ];
  const names = [];
  sources.forEach(src => {
    gatherStorySaunaTargets(src).forEach(name => {
      if (!names.includes(name)) names.push(name);
    });
  });
  return names;
}

function computeStoryAvailabilityItems(targets) {
  const names = Array.isArray(targets) ? targets : [];
  if (!names.length) return [];
  if (!schedule || !Array.isArray(schedule.rows) || !Array.isArray(schedule.saunas)) return [];
  const indices = [];
  const seen = new Set();
  names.forEach(name => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) return;
    const idx = schedule.saunas.indexOf(trimmed);
    if (idx >= 0) {
      seen.add(lower);
      indices.push({ name: trimmed, idx });
    }
  });
  if (!indices.length) return [];
  const now = nowMinutes();
  const items = [];
  (schedule.rows || []).forEach(row => {
    const time = row && row.time ? row.time : '';
    const minutes = parseHM(time);
    const displayTime = formatTimeLabel(time);
    const sortOffset = getRowSortOffset(row);
    const sortMinutes = computeSortMinutes(minutes, sortOffset);
    indices.forEach(({ name, idx }) => {
      const cell = row && Array.isArray(row.entries) ? row.entries[idx] : null;
      if (cell && cell.title) {
        const details = collectCellDetails(cell);
        items.push({
          sauna: name,
          title: cell.title,
          time: displayTime,
          minutes,
          sortMinutes,
          sortOffset,
          isUpcoming: minutes != null ? minutes >= now : false,
          description: details.description,
          aromas: details.aromas,
          facts: details.facts,
          badges: details.badges
        });
      }
    });
  });
  items.sort((a, b) => {
    const am = a.sortMinutes != null ? a.sortMinutes : Infinity;
    const bm = b.sortMinutes != null ? b.sortMinutes : Infinity;
    if (am === bm) {
      const offsetDiff = (a.sortOffset || 0) - (b.sortOffset || 0);
      if (offsetDiff !== 0) return offsetDiff;
      return a.sauna.localeCompare(b.sauna, 'de');
    }
    return am - bm;
  });
  const nextIdx = items.findIndex(item => item.minutes != null && item.minutes >= now);
  if (nextIdx >= 0) items[nextIdx].isNext = true;
  return items;
}

function buildStoryAvailabilityCard(section, ctx) {
  const targets = resolveAvailabilityTargets(section, ctx);
  const entries = computeStoryAvailabilityItems(targets);
  const nodes = [];
  if (section.description) {
    nodes.push(h('p', { class: 'story-availability-description' }, section.description));
  }
  if (!entries.length) {
    const message = section.emptyMessage || (targets.length ? 'Heute keine passenden Aufgüsse eingetragen.' : 'Keine Zuordnung zum Tagesplan hinterlegt.');
    nodes.push(h('p', { class: 'story-availability-empty' }, message));
  } else {
    const list = h('ul', { class: 'story-availability-list' });
    entries.forEach(entry => {
      const cls = ['story-availability-item'];
      if (entry.isUpcoming) cls.push('is-upcoming');
      if (entry.isNext) cls.push('is-next');
      const li = h('li', { class: cls.join(' ') });
      const head = h('div', { class: 'story-availability-head' }, [
        h('span', { class: 'story-availability-time' }, entry.time || '–'),
        h('div', { class: 'story-availability-headline' }, [
          h('span', { class: 'story-availability-sauna' }, entry.sauna),
          entry.title ? h('span', { class: 'story-availability-title' }, entry.title) : null
        ].filter(Boolean))
      ]);
      li.appendChild(head);
      const detailNodes = [
        createDescriptionNode(entry.description, 'story-availability-description'),
        createAromaListNode(entry.aromas, 'aroma-list story-availability-aromas'),
        createFactsList(entry.facts, 'story-availability-facts', 'card-chip story-section-chip'),
        createBadgeRow(entry.badges, 'badge-row story-availability-badges')
      ].filter(Boolean);
      if (detailNodes.length) {
        li.appendChild(h('div', { class: 'story-availability-details' }, detailNodes));
      }
      list.appendChild(li);
    });
    nodes.push(list);
  }
  return buildStoryCard({
    type: 'card',
    className: 'story-card--availability',
    heading: section.title || 'Heute verfügbar',
    bodyNodes: nodes
  }, ctx);
}

function buildStoryImageBlock(section, ctx) {
  const figure = createStoryMediaFigure(section.image, {
    className: 'story-section-figure',
    fallbackText: 'Bild nicht verfügbar',
    showPlaceholder: section.showPlaceholder !== false
  });
  if (!figure) return null;
  const classes = ['story-section', 'story-section--image'];
  if (section.className) {
    section.className.split(/\s+/).filter(Boolean).forEach(cls => {
      if (cls.startsWith('story-image-block--')) classes.push(`story-section--${cls.slice('story-image-block--'.length)}`);
      else classes.push(cls);
    });
  }
  if (section.variant) classes.push(`story-section--${section.variant}`);
  const block = h('section', { class: classes.join(' ') });
  block.classList.add('story-section--has-media', 'story-section--media-full');

  const mediaWrapper = h('div', { class: 'story-section-media' }, [figure]);
  block.appendChild(mediaWrapper);

  const contentNodes = [];
  const heading = String(section.heading || '').trim();
  const subheading = String(section.subheading || '').trim();
  const description = String(section.description || '').trim();
  if (heading) contentNodes.push(h('h2', { class: 'story-section-heading' }, heading));
  if (subheading) contentNodes.push(h('p', { class: 'story-section-subheading' }, subheading));
  if (description) contentNodes.push(h('p', { class: 'story-section-paragraph' }, description));
  if (contentNodes.length) {
    block.appendChild(h('div', { class: 'story-section-content' }, contentNodes));
  }
  return block;
}
}


// ---------- Sauna tile sizing by unobscured width ----------
function computeAvailContentWidth(container) {
  const cw = container.clientWidth;
  const rightPct = (settings?.display?.rightWidthPercent ?? 38) / 100;
  const cutTop = (settings?.display?.cutTopPercent ?? 28) / 100;
  const cutBottom = (settings?.display?.cutBottomPercent ?? 12) / 100;
  const panelW = cw * rightPct;
  const minCut = Math.min(cutTop, cutBottom);
  const intrude = panelW * (1 - minCut);
  const padding = 32;
  return Math.max(0, cw - intrude - padding);
}
function applyTileSizing(container, opts = {}) {
  const useIcons = opts.useIcons !== false;
  const avail = computeAvailContentWidth(container);
  const defaultPct = useIcons ? 45 : 42;
  const pct = ((settings?.slides?.tileWidthPercent ?? defaultPct) / 100);
  const target = Math.max(0, avail * pct);
  const minScale = Math.max(0, settings?.slides?.tileMinScale ?? 0.25);
  const maxScale = Math.max(minScale, settings?.slides?.tileMaxScale ?? 0.57);
  container.style.setProperty('--tileTargetPx', target + 'px');
  container.style.setProperty('--tileMinScale', String(minScale));
  container.style.setProperty('--tileMaxScale', String(maxScale));

  const baseW = settings?.display?.baseW || 1920;
  const fallbackTarget = baseW * ((minScale + maxScale) / 2);
  const t = target > 0 ? target : fallbackTarget;
  const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

  const iconSize = clamp(48, t * 0.15, 200);
  const basePadY = useIcons ? clamp(10, t * 0.034, 36) : clamp(8, t * 0.026, 24);
  const basePadX = useIcons
    ? Math.max(clamp(16, t * 0.055, 58), basePadY + 6)
    : Math.max(clamp(14, t * 0.048, 40), basePadY + 4);
  const padScale = Number.isFinite(+settings?.slides?.tilePaddingScale)
    ? clamp(0.25, +settings.slides.tilePaddingScale, 1.5)
    : 0.75;
  const padY = clamp(4, basePadY * padScale, basePadY * 1.6);
  const padX = Math.max(
    clamp(8, basePadX * padScale, basePadX * 1.6),
    padY + (useIcons ? 6 : 4)
  );
  const gap = useIcons ? clamp(14, t * 0.045, 34) : clamp(10, t * 0.035, 26);
  const contentGap = useIcons ? clamp(6, t * 0.026, 22) : clamp(5, t * 0.02, 16);
  const chipGap = useIcons ? clamp(5, t * 0.02, 18) : clamp(4, t * 0.016, 14);
  const badgeOffset = useIcons ? clamp(9, t * 0.018, 24) : clamp(7, t * 0.016, 20);
  const radius = useIcons ? clamp(18, t * 0.06, 48) : clamp(16, t * 0.05, 44);
  const metaScale = useIcons ? clamp(0.72, t / 720, 1.12) : clamp(0.78, t / 820, 1.08);
  const userMetaScale = Number.isFinite(+settings?.fonts?.tileMetaScale)
    ? clamp(0.5, +settings.fonts.tileMetaScale, 2)
    : 1;
  const userTimeScale = Number.isFinite(+settings?.fonts?.tileTimeScale)
    ? clamp(0.5, +settings.fonts.tileTimeScale, 4)
    : userMetaScale;
  const userTimeWeight = Number.isFinite(+settings?.fonts?.tileTimeWeight)
    ? clamp(100, +settings.fonts.tileTimeWeight, 900)
    : (Number.isFinite(+settings?.fonts?.tileWeight)
      ? clamp(100, +settings.fonts.tileWeight, 900)
      : 600);
  const userBadgeScale = Number.isFinite(+settings?.slides?.badgeScale)
    ? clamp(0.3, +settings.slides.badgeScale, 3)
    : 1;
  const userBadgeDescriptionScale = Number.isFinite(+settings?.slides?.badgeDescriptionScale)
    ? clamp(0.3, +settings.slides.badgeDescriptionScale, 3)
    : 1;
  const heightScale = Number.isFinite(+settings?.slides?.tileHeightScale)
    ? clamp(0.5, +settings.slides.tileHeightScale, 2)
    : 1;
  const userFlameSizeScale = Number.isFinite(+settings?.slides?.tileFlameSizeScale)
    ? clamp(0.4, +settings.slides.tileFlameSizeScale, 3)
    : 1;
  const userFlameGapScale = Number.isFinite(+settings?.slides?.tileFlameGapScale)
    ? clamp(0, +settings.slides.tileFlameGapScale, 3)
    : 1;
  const baseFlameSize = useIcons ? clamp(22, t * 0.03, 42) : clamp(18, t * 0.026, 32);
  const baseFlameGap = useIcons ? clamp(6, t * 0.016, 22) : clamp(5, t * 0.014, 20);
  const flameSize = baseFlameSize * userFlameSizeScale;
  const flameGap = Math.max(0, baseFlameGap * userFlameGapScale);
  const iconColumn = useIcons ? clamp(40, iconSize * 0.75, iconSize * 1.45) : 0;
  const tileMinHeight = useIcons
    ? clamp(64, iconSize * 0.82, iconSize * 1.08)
    : clamp(54, padY * 2.6, 108);
  const iconHeightScale = useIcons
    ? clamp(0.68, tileMinHeight / Math.max(iconSize, 1), 1.02)
    : 0;

  container.style.setProperty('--tileIconSizePx', useIcons ? (iconSize.toFixed(2) + 'px') : '0px');
  container.style.setProperty('--tilePadYPx', padY.toFixed(2) + 'px');
  container.style.setProperty('--tilePadXPx', padX.toFixed(2) + 'px');
  container.style.setProperty('--tileGapPx', gap.toFixed(2) + 'px');
  container.style.setProperty('--tileContentGapPx', contentGap.toFixed(2) + 'px');
  container.style.setProperty('--tileChipGapPx', chipGap.toFixed(2) + 'px');
  container.style.setProperty('--tileBadgeOffsetPx', badgeOffset.toFixed(2) + 'px');
  container.style.setProperty('--tileRadiusPx', radius.toFixed(2) + 'px');
  const combinedMeta = metaScale * userMetaScale;
  const combinedTime = metaScale * userTimeScale;
  container.style.setProperty('--tileMetaScale', combinedMeta.toFixed(3));
  container.style.setProperty('--tileTimeScale', combinedTime.toFixed(3));
  container.style.setProperty('--tileTimeWeight', Math.round(userTimeWeight).toString());
  container.style.setProperty('--tileBadgeScale', (combinedMeta * userBadgeScale).toFixed(3));
  container.style.setProperty('--tileDescriptionScale', (combinedMeta * userBadgeDescriptionScale).toFixed(3));
  container.style.setProperty('--flameSizePx', flameSize.toFixed(2));
  container.style.setProperty('--tileFlameGapPx', flameGap.toFixed(2) + 'px');
  container.style.setProperty('--tileIconColumnPx', useIcons ? (iconColumn.toFixed(2) + 'px') : '0px');
  container.style.setProperty('--tileHeightScale', heightScale.toFixed(3));
  container.style.setProperty('--tileMinHeightPx', (tileMinHeight * heightScale).toFixed(2) + 'px');
  container.style.setProperty('--tileIconHeightScale', iconHeightScale.toFixed(3));
}

function createTilePager(list) {
  let timer = 0;
  let frame = 0;
  let pages = [];
  let index = 0;
  let opts = null;

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = 0;
    }
  };

  const showAll = () => {
    const tiles = Array.from(list.querySelectorAll('.tile'));
    tiles.forEach(tile => {
      tile.hidden = false;
      tile.classList.remove('tile-pager-exit', 'tile-pager-enter');
      tile.style.removeProperty('animation');
    });
    list.classList.remove('is-paged');
    delete list.dataset.tilePages;
    delete list.dataset.tilePage;
  };

  const showPage = (nextIndex) => {
    const prevTiles = pages[index] || [];
    const nextTiles = pages[nextIndex] || [];
    if (nextIndex === index && nextTiles.every(tile => !tile.hidden)) return;
    prevTiles.forEach(tile => {
      tile.classList.remove('tile-pager-enter');
      tile.classList.add('tile-pager-exit');
      setTimeout(() => {
        tile.hidden = true;
        tile.classList.remove('tile-pager-exit');
      }, 220);
    });
    nextTiles.forEach(tile => {
      tile.hidden = false;
      tile.classList.remove('tile-pager-exit');
      tile.classList.add('tile-pager-enter');
      tile.style.animation = 'none';
      void tile.offsetWidth;
      tile.style.removeProperty('animation');
      tile.addEventListener('animationend', () => tile.classList.remove('tile-pager-enter'), { once: true });
    });
    index = nextIndex;
    list.dataset.tilePage = String(nextIndex + 1);
    list.dataset.tilePages = String(pages.length);
  };

  const recompute = () => {
    const current = opts;
    if (!current || !current.body || !current.container) {
      clearTimer();
      pages = [];
      index = 0;
      showAll();
      return;
    }
    const body = current.body;
    const tiles = Array.from(list.querySelectorAll('.tile'));
    if (!tiles.length) {
      clearTimer();
      pages = [];
      index = 0;
      showAll();
      return;
    }
    const available = body.clientHeight;
    if (available <= 0) {
      clearTimer();
      pages = [];
      index = 0;
      showAll();
      return;
    }

    tiles.forEach(tile => {
      tile.hidden = false;
      tile.classList.remove('tile-pager-exit', 'tile-pager-enter');
      tile.style.removeProperty('animation');
    });

    const style = getComputedStyle(list);
    const gap = parseFloat(style.rowGap || style.gap || '0') || 0;

    const pagesNew = [];
    let currentPage = [];
    let currentHeight = 0;
    tiles.forEach(tile => {
      const rect = tile.getBoundingClientRect();
      const height = rect.height;
      const extra = currentPage.length ? gap : 0;
      if (currentPage.length && (currentHeight + extra + height) > available + 1) {
        pagesNew.push(currentPage);
        currentPage = [tile];
        currentHeight = height;
      } else {
        currentPage.push(tile);
        currentHeight += extra + height;
      }
    });
    if (currentPage.length) pagesNew.push(currentPage);

    if (pagesNew.length <= 1) {
      clearTimer();
      pages = pagesNew;
      index = 0;
      showAll();
      return;
    }

    pages = pagesNew;
    list.classList.add('is-paged');
    if (index >= pages.length) index = 0;

    const pageConfig = typeof getPageConfig === 'function' ? getPageConfig(current.region || 'left') : null;
    const dwellMs = Math.max(4000, dwellMsForItem({ type: 'sauna', sauna: current.saunaName || '' }, pageConfig));
    const duration = Math.min(Math.max(Math.floor(dwellMs / pages.length), 2200), 12000);

    showPage(index);

    clearTimer();
    timer = setInterval(() => {
      showPage((index + 1) % pages.length);
    }, duration);
  };

  const scheduleUpdate = (nextOpts = {}) => {
    opts = { ...opts, ...nextOpts };
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      recompute();
    });
  };

  const destroy = () => {
    clearTimer();
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    pages = [];
    index = 0;
    opts = null;
    showAll();
    delete list.__tilePager;
  };

  return { scheduleUpdate, destroy };
}

function ensureTilePager(list) {
  if (!list) return null;
  if (list.__tilePager) return list.__tilePager;
  const pager = createTilePager(list);
  list.__tilePager = pager;
  return pager;
}

// ---------- Sauna slide ----------
function renderSauna(name, region = 'left', ctx = {}) {
  const hlMap = getHighlightMap();
  const rightUrl = settings?.assets?.rightImages?.[name] || '';
  const iconsEnabled = settings?.slides?.showIcons !== false;
  let hasStripeInSauna = false;
  const cardIconMap = (iconsEnabled && settings?.slides?.cardIcons && typeof settings.slides.cardIcons === 'object')
    ? settings.slides.cardIcons
    : null;
  const migrationDone = settings?.slides?.cardIconsMigrated === true;
  const defaultIconForSauna = (cardIconMap && typeof cardIconMap[name] === 'string') ? cardIconMap[name] : '';
  const legacyIconFallback = (!migrationDone && iconsEnabled && rightUrl) ? rightUrl : '';
  const headingWrap = h('div', { class: 'headings' }, [
    h('h1', { class: 'h1', style: 'color:var(--saunaColor);' }, name),
    h('h2', { class: 'h2' }, computeH2Text() || '')
  ]);
  const c = h('div', { class: 'container has-right fade show' }, [
    h('div', { class: 'rightPanel', style: rightUrl ? ('background-image:url(' + JSON.stringify(rightUrl) + ')') : 'display:none;' }),
    headingWrap
  ]);
  if (shouldUseFullHeadingWidth()) c.classList.add('full-heading');
  if (iconsEnabled) c.classList.add('has-card-icons'); else c.classList.add('no-card-icons');

  const body = h('div', { class: 'body' });
  const list = h('div', { class: 'list' });

  const cleanups = [];
  const slidesCfg = settings?.slides || {};
  const saunaScrollSpeed = (() => {
    const raw = Number(slidesCfg.saunaScrollSpeed ?? slidesCfg.heroTimelineScrollSpeed);
    if (Number.isFinite(raw) && raw > 0) return Math.max(40, Math.round(raw));
    return 40;
  })();
  const saunaScrollPauseMs = (() => {
    const raw = Number(slidesCfg.saunaScrollPauseMs ?? slidesCfg.heroTimelineScrollPauseMs);
    if (Number.isFinite(raw) && raw >= 0) {
      const normalized = raw < 1000 ? raw * 1000 : raw;
      return Math.max(0, Math.round(normalized));
    }
    return 4000;
  })();
  const computedDwell = (() => {
    try {
      return dwellMsForItem({ type: 'sauna', sauna: name }, ctx?.pageConfig);
    } catch (err) {
      return null;
    }
  })();
  const fallbackDwell = Number.isFinite(computedDwell) && computedDwell > 0 ? Math.round(computedDwell) : null;
  let scrollDurationMs = null;
  let scrollReady = false;
  let advanceHelper = null;
  let lastScheduledMs = null;

  const scheduleAdvanceWhenReady = () => {
    if (!advanceHelper || !scrollReady) return;
    const baseMs = Number.isFinite(advanceHelper.defaultMs) && advanceHelper.defaultMs > 0
      ? Math.round(advanceHelper.defaultMs)
      : (fallbackDwell && fallbackDwell > 0 ? fallbackDwell : 6000);
    const target = Number.isFinite(scrollDurationMs) && scrollDurationMs > baseMs ? scrollDurationMs : baseMs;
    const normalized = Math.max(1000, Math.round(target));
    if (lastScheduledMs === normalized) return;
    advanceHelper.schedule(normalized);
    lastScheduledMs = normalized;
  };

  if (typeof ctx?.deferAdvance === 'function') {
    ctx.deferAdvance((helper) => {
      advanceHelper = helper;
      scheduleAdvanceWhenReady();
      return true;
    });
  }
  cleanups.push(() => { advanceHelper = null; });

  const updateScrollDuration = (maxScrollValue = null) => {
    const maxScroll = Number.isFinite(maxScrollValue)
      ? Math.max(0, maxScrollValue)
      : Math.max(0, list.scrollHeight - list.clientHeight);
    if (maxScroll <= 0) {
      scrollDurationMs = null;
    } else {
      const travelMs = Math.round((maxScroll / Math.max(1, saunaScrollSpeed)) * 1000);
      scrollDurationMs = Math.max(0, travelMs + Math.max(0, saunaScrollPauseMs));
    }
  };

  const finalizeScrollState = (maxScrollValue = null) => {
    updateScrollDuration(maxScrollValue);
    scrollReady = true;
    scheduleAdvanceWhenReady();
  };

  const stopAutoScroll = enableAutoScroll(list, {
    axis: 'y',
    speed: saunaScrollSpeed,
    pauseMs: saunaScrollPauseMs,
    mode: 'loop',
    onScrollableChange: (scrollable, maxScroll) => {
      finalizeScrollState(scrollable ? maxScroll : 0);
    }
  });
  if (typeof stopAutoScroll === 'function') cleanups.push(stopAutoScroll);

  const fallbackTimer = setTimeout(() => {
    if (!scrollReady) finalizeScrollState();
  }, 1200);
  cleanups.push(() => clearTimeout(fallbackTimer));

  const colIdx = (schedule.saunas || []).indexOf(name);
  const saunaStatus = getSaunaStatus(name);
  const hideForStatus = saunaStatus !== SAUNA_STATUS.ACTIVE;
  const componentFlags = getSlideComponentFlags();
  const saunaInfoMap = (settings?.slides?.saunaInfo && typeof settings.slides.saunaInfo === 'object')
    ? settings.slides.saunaInfo
    : null;
  const saunaInfoText = typeof saunaInfoMap?.[name] === 'string' ? saunaInfoMap[name] : '';
  const saunaInfoNode = componentFlags.infoBox !== false ? createSaunaInfoBox(saunaInfoText) : null;
  if (saunaInfoNode) {
    headingWrap.appendChild(saunaInfoNode);
    c.classList.add('has-sauna-info');
  }
  const notes = footnoteMap();
  const showSaunaFlames = settings?.slides?.showSaunaFlames !== false;
  const inlineBadgeColumn = settings?.slides?.badgeInlineColumn === true;
  const iconVariantMap = (settings?.slides?.iconVariants && typeof settings.slides.iconVariants === 'object')
    ? settings.slides.iconVariants
    : null;
  const iconVariantDefault = (() => {
    const norm = normalizeIconVariant(settings?.slides?.iconVariant);
    return norm || 'default';
  })();

  function normalizeIconVariant(value) {
    if (typeof value !== 'string') return '';
    const norm = value.trim().toLowerCase();
    if (!norm) return '';
    if (norm === 'round' || norm === 'circle') return 'badge';
    if (norm === 'corner') return 'overlay';
    if (norm === 'stripe' || norm === 'banner') return 'strip';
    if (['default', 'badge', 'strip', 'overlay'].includes(norm)) return norm;
    return '';
  }

  function resolveIconVariant(preferred) {
    if (!iconsEnabled) return 'hidden';
    const fromItem = normalizeIconVariant(preferred);
    if (fromItem) return fromItem;
    if (iconVariantMap) {
      const bySauna = normalizeIconVariant(iconVariantMap[name]);
      if (bySauna) return bySauna;
      const wildcard = normalizeIconVariant(iconVariantMap['*'] || iconVariantMap.default);
      if (wildcard) return wildcard;
    }
    return iconVariantDefault;
  }

  const items = [];
  for (const row of (schedule.rows || [])) {
    const cell = (row.entries || [])[colIdx];
    if (cell && cell.title) {
      const details = collectCellDetails(cell);
      const isHidden = cell.hidden === true || cell.visible === false || cell.enabled === false;
      const sortOffset = getRowSortOffset(row);
      const sortKey = makeRowSortKey(row.time, sortOffset);
      items.push({
        time: row.time,
        sortOffset,
        sortKey,
        title: cell.title,
        flames: cell.flames || '',
        noteId: cell.noteId,
        description: details.description,
        aromas: details.aromas,
        facts: details.facts,
        badges: details.badges,
        hidden: isHidden,
        icon: cell.icon || null,
        iconVariant: cell.iconVariant || cell.iconLayout || null
      });
    }
  }
  items.sort((a, b) => {
    const cmp = compareTimesWithOffset(a.time, a.sortOffset, b.time, b.sortOffset);
    if (cmp !== 0) return cmp;
    return String(a.title || '').localeCompare(String(b.title || ''), 'de');
  });

  const usedSet = new Set();
  for (const it of items) {
    const baseTitle = String(it.title).replace(/\*+$/, '');
    const hasStar = /\*$/.test(it.title || '');
    const tileClasses = ['tile'];
    const saunaHighlights = hlMap.bySauna[name];
    if (saunaHighlights && saunaHighlights.has(it.sortKey)) tileClasses.push('highlight');
    if (it.hidden || hideForStatus) tileClasses.push('is-hidden');
    let iconVariant = 'default';
    if (iconsEnabled) {
      iconVariant = resolveIconVariant(it.iconVariant);
      if (iconVariant === 'badge') tileClasses.push('tile--icon-badge');
      if (iconVariant === 'strip') tileClasses.push('tile--icon-strip');
      if (iconVariant === 'overlay') tileClasses.push('tile--icon-overlay');
    }

    if (it.time) tileClasses.push('tile--has-time');

    const titleNode = h('div', { class: 'title' });
    const labelNode = h('span', { class: 'label' }, baseTitle);
    const supNote = noteSup(it, notes);
    if (supNote) {
      labelNode.appendChild(h('span', { class: 'notewrap' }, [supNote]));
      usedSet.add(it.noteId);
    } else if (hasStar) {
      labelNode.appendChild(h('span', { class: 'notewrap' }, [h('sup', { class: 'note legacy' }, '*')]));
    }
    titleNode.appendChild(labelNode);

    const timeLabel = formatTimeLabel(it.time);
    const timeNode = timeLabel ? h('span', { class: 'time' }, timeLabel) : null;

    const badgeRowNode = createBadgeRow(it.badges, 'badge-row');
    if (badgeRowNode && inlineBadgeColumn) badgeRowNode.classList.add('badge-row--stacked');
    const stripeSource = Array.isArray(badgeRowNode?.__badgeList)
      ? badgeRowNode.__badgeList
      : collectUniqueBadges(it.badges);
    const badgeStripeSource = Array.isArray(stripeSource)
      ? stripeSource.map(entry => ({ ...entry }))
      : [];
    const hasAnyBadgeImage = badgeStripeSource.some(entry => entry.imageUrl);
    const badgeColumn = inlineBadgeColumn ? h('div', { class: 'card-badges card-badges--inline' }) : null;

    const mainColumn = h('div', { class: 'card-main' });
    const mainContent = h('div', { class: 'card-main__content' });
    if (timeNode) mainColumn.appendChild(timeNode);
    mainColumn.appendChild(mainContent);
    const contentBlock = h('div', { class: 'card-content' }, [mainColumn]);

    const componentDefs = [
      { key: 'title', node: titleNode, target: 'main' },
      { key: 'description', render: () => createDescriptionNode(it.description, 'description'), target: 'main' },
      { key: 'aromas', render: () => createAromaListNode(it.aromas, 'aroma-list'), target: 'main' },
      { key: 'facts', render: () => createFactsList(it.facts, 'facts', 'card-chip'), target: 'main' },
      { key: 'badges', render: () => badgeRowNode, target: inlineBadgeColumn ? 'badge' : 'main' }
    ];
    renderComponentNodes(
      componentFlags,
      componentDefs,
      (anyEnabled) => h('div', { class: 'card-empty' }, anyEnabled ? 'Keine Details hinterlegt.' : 'Alle Komponenten deaktiviert.'),
      (node, def) => {
        const targetKey = def?.target;
        if (targetKey === 'badge' && badgeColumn) {
          badgeColumn.appendChild(node);
          return;
        }
        if (def?.key === 'title') {
          mainColumn.insertBefore(node, mainContent);
          return;
        }
        mainContent.appendChild(node);
      }
    );

    if (!mainContent.childNodes.length) {
      mainContent.remove();
    }

    const hasBadgeColumn = !!(badgeColumn && badgeColumn.childNodes.length);

    const tileChildren = [];
    let stripeNode = null;
    if (hasAnyBadgeImage && badgeStripeSource.length) {
      const allowStripeFallback = iconsEnabled;
      const iconUrl = allowStripeFallback ? (it.icon || defaultIconForSauna || legacyIconFallback || '') : '';
      const fallbackLabel = (() => {
        if (!allowStripeFallback) return '';
        if (typeof name === 'string') {
          const trimmed = name.trim();
          if (trimmed.length >= 2) return trimmed.slice(0, 2);
          if (trimmed.length === 1) return trimmed;
        }
        return allowStripeFallback ? '?' : '';
      })();
      stripeNode = (() => {
        const stripe = h('div', { class: 'tile-badge-stripe' });
        const inner = h('div', { class: 'tile-badge-stripe__inner' });
        badgeStripeSource.forEach((badge, idx) => {
          const segment = h('div', { class: 'tile-badge-stripe__segment' });
          segment.style.setProperty('--segment-index', String(idx));
          segment.style.setProperty('--segment-count', String(badgeStripeSource.length));
          if (badge.imageUrl) {
            const img = h('img', { class: 'tile-badge-stripe__img', src: badge.imageUrl, alt: '' });
            img.addEventListener('load', () => segment.classList.remove('is-fallback'));
            img.addEventListener('error', () => segment.classList.add('is-fallback'));
            segment.appendChild(img);
          } else {
            segment.classList.add('is-fallback');
          }
          const fallback = (() => {
            if (!allowStripeFallback) return null;
            const box = h('div', { class: 'tile-badge-stripe__fallback' });
            let hasContent = false;
            if (iconUrl) {
              const fbImg = h('img', { class: 'tile-badge-stripe__fallback-img', src: iconUrl, alt: '' });
              fbImg.addEventListener('error', () => {
                fbImg.remove();
                if (!hasContent && fallbackLabel) {
                  box.appendChild(h('span', { class: 'tile-badge-stripe__fallback-text' }, fallbackLabel));
                }
              });
              box.appendChild(fbImg);
              hasContent = true;
            }
            if (!hasContent && fallbackLabel) {
              box.appendChild(h('span', { class: 'tile-badge-stripe__fallback-text' }, fallbackLabel));
              hasContent = true;
            }
            return hasContent ? box : null;
          })();
          if (fallback) segment.appendChild(fallback);
          inner.appendChild(segment);
        });
        stripe.appendChild(inner);
        return stripe;
      })();
      if (stripeNode) hasStripeInSauna = true;
    }
    if (!stripeNode) {
      if (!tileClasses.includes('tile--compact')) tileClasses.push('tile--compact');
    } else {
      tileChildren.push(stripeNode);
    }
    tileChildren.push(contentBlock);
    if (hasBadgeColumn && badgeColumn) {
      tileChildren.push(badgeColumn);
      if (!tileClasses.includes('tile--badge-column')) tileClasses.push('tile--badge-column');
    }
    if (showSaunaFlames) {
      tileChildren.push(flamesWrap(it.flames));
    } else {
      tileClasses.push('tile--no-flames');
    }

    const tile = h('div', { class: tileClasses.join(' '), 'data-time': it.time }, tileChildren);
    tile.style.setProperty('--tile-index', String(list.children.length));

    if (it.hidden || hideForStatus) {
      tile.appendChild(h('div', { class: 'card-chip card-chip--status', 'data-role': 'hidden' }, 'Ausgeblendet'));
    }

    list.appendChild(tile);
  }
  if (items.length === 0) list.appendChild(h('div', { class: 'caption' }, 'Keine Einträge.'));

  body.appendChild(list);
  c.appendChild(body);

  c.classList.toggle('has-badge-stripe', hasStripeInSauna);

  const footNodes = [];
  const order = (settings?.footnotes || []).map(fn => fn.id);
  for (const id of order) {
    if (usedSet.has(id)) {
      const v = notes.get(id);
      if (v) footNodes.push(h('div', { class: 'fnitem' }, [h('sup', { class: 'note' }, String(v.label || '*')), ' ', v.text]));
    }
  }
  const layout = (settings?.footnoteLayout ?? 'one-line');
  const fnClass = 'footer-note ' + (layout === 'multi' ? 'fn-multi' : layout === 'stacked' ? 'fn-stack' : layout === 'ticker' ? 'fn-ticker' : layout === 'split' ? 'fn-split' : 'fn-one');
  if (footNodes.length) {
    if (layout === 'ticker') {
      const track = h('div', { class: 'fn-track' });
      const appendSequence = (useClones = false) => {
        footNodes.forEach((node, idx) => {
          const entry = useClones ? node.cloneNode(true) : node;
          track.appendChild(entry);
          if (idx < footNodes.length - 1) {
            track.appendChild(h('span', { class: 'fnsep', 'aria-hidden': 'true' }, '•'));
          }
        });
      };
      appendSequence(false);
      if (footNodes.length > 1) appendSequence(true);
      c.appendChild(h('div', { class: fnClass }, [track]));
    } else {
      const includeSeparator = layout !== 'stacked' && layout !== 'split';
      const nodes = [];
      footNodes.forEach((n, i) => {
        if (i > 0 && includeSeparator) nodes.push(h('span', { class: 'fnsep', 'aria-hidden': 'true' }, '•'));
        nodes.push(n);
      });
      c.appendChild(h('div', { class: fnClass }, nodes));
    }
  }

  c.__cleanup = () => {
    cleanups.forEach((fn) => {
      try { fn(); } catch (err) { /* noop */ }
    });
  };

  const recalc = () => {
    applyTileSizing(c, { useIcons: iconsEnabled || hasStripeInSauna });
    updateScrollDuration();
    scheduleAdvanceWhenReady();
  };
  setTimeout(recalc, 0);
  setResizeHandler(region, recalc);

  return c;
}

// ---------- Stage management ----------
const EMPTY_STAGE_MESSAGES = {
  left: 'Keine Inhalte verfügbar.',
  right: 'Keine Inhalte für rechte Seite definiert.'
};

const VALID_CONTENT_TYPES = ['overview','sauna','hero-timeline','image','video','url','story','wellness-tip'];
const MEDIA_TYPES = ['image','video','url','wellness-tip'];
const PAGE_DEFAULTS = {
  left: { source:'master', timerSec:null, contentTypes:['overview','sauna','hero-timeline','story','wellness-tip','image','video','url'], playlist:[] },
  right:{ source:'media',  timerSec:null, contentTypes:['wellness-tip','image','video','url'], playlist:[] }
};
const SOURCE_FILTERS = {
  master: null,
  schedule: ['overview','sauna','hero-timeline'],
  media: MEDIA_TYPES,
  story: ['story']
};

function updateLayoutModeAttr(mode){
  const normalized = (mode === 'split') ? 'split' : 'single';
  if (document.body) document.body.setAttribute('data-layout', normalized);
  if (STAGE) STAGE.dataset.layout = normalized;
}

function updateLayoutProfileAttr(profile){
  const normalized = LAYOUT_PROFILES.has(profile) ? profile : 'landscape';
  if (document.body) document.body.setAttribute('data-layout-profile', normalized);
  if (STAGE) STAGE.dataset.layoutProfile = normalized;
  if (document.documentElement) document.documentElement.setAttribute('data-layout-profile', normalized);
}

function slideKey(item){
  if (!item) return '';
  return item.type + '|' + (item.sauna || item.src || item.url || item.storyId || item.story?.id || item.tipId || item.id || item.title || item.text || '');
}

function dwellMsForItem(item, pageConfig) {
  const override = Number(pageConfig?.timerSec);
  if (Number.isFinite(override) && override > 0) {
    return Math.max(1, Math.round(override)) * 1000;
  }

  const slides = settings?.slides || {};
  const mode = slides.durationMode || 'uniform';
  const sec = (x) => Math.max(1, Math.floor(+x || 0));

  if (item.type === 'overview') {
    return sec(slides.overviewDurationSec ?? 10) * 1000;
  }

  if (item.type === 'sauna') {
    if (mode !== 'per') {
      const g = slides.globalDwellSec ?? slides.saunaDurationSec ?? 6;
      return sec(g) * 1000;
    } else {
      const perMap = slides.saunaDurations || {};
      const v = perMap[item.sauna];
      const fb = slides.globalDwellSec ?? slides.saunaDurationSec ?? 6;
      return sec(Number.isFinite(+v) ? v : fb) * 1000;
    }
  }

  if (['image', 'video', 'url'].includes(item.type)) {
    if (mode !== 'per') {
      const g = slides.globalDwellSec ?? slides.imageDurationSec ?? slides.saunaDurationSec ?? 6;
      return sec(g) * 1000;
    } else {
      const v = Number.isFinite(+item.dwell) ? +item.dwell : (slides.imageDurationSec ?? slides.globalDwellSec ?? 6);
      return sec(v) * 1000;
    }
  }

  if (item.type === 'story') {
    const story = item.story || {};
    if (mode !== 'per') {
      const g = slides.storyDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 8;
      return sec(g) * 1000;
    }
    const v = Number.isFinite(+story.dwellSec)
      ? +story.dwellSec
      : (slides.storyDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 8);
    return sec(v) * 1000;
  }

  if (item.type === 'hero-timeline') {
    const raw = Number(slides.heroTimelineFillMs);
    if (Number.isFinite(raw) && raw > 0) {
      const ms = raw < 1000 ? raw * 1000 : raw;
      return Math.max(1000, Math.round(ms));
    }
    const fallback = slides.heroDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 10;
    return sec(fallback) * 1000;
  }

  if (item.type === 'wellness-tip') {
    const base = slides.storyDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 8;
    const v = Number.isFinite(+item.dwellSec) ? +item.dwellSec : base;
    return sec(v) * 1000;
  }

  return 6000;
}

function renderStageFallback(id){
  return h('div', { class: 'container fade show empty' }, [
    h('div', { class: 'empty-message' }, EMPTY_STAGE_MESSAGES[id] || 'Keine Inhalte verfügbar.')
  ]);
}

function cleanupNode(node) {
  if (!node) return;
  if (typeof node.__cleanup === 'function') {
    try {
      node.__cleanup();
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  }
  const children = node.childNodes ? Array.from(node.childNodes) : [];
  for (const child of children) cleanupNode(child);
}

function cleanupChildNodes(target) {
  if (!target || !target.childNodes) return;
  Array.from(target.childNodes).forEach(cleanupNode);
}

function createStageController(id, element){
  let queue = [];
  let index = 0;
  let last = null;
  let slideTimer = 0;
  let transTimer = 0;
  let config = { enabled: id === 'left', timerSec: null, source:'master', contentTypes: [] };
  let hasCustomContent = false;

  const controller = {
    id,
    element,
    apply,
    play,
    stop: clear,
    advance,
    showCustom,
    isEnabled: () => !!config.enabled,
    getQueue: () => queue,
    getIndex: () => index,
    getConfig: () => ({ ...config }),
    scheduleAdvance
  };

  stageControllers.push(controller);
  updateActiveState();
  return controller;

  function updateActiveState(){
    if (!element) return;
    const active = config.enabled || hasCustomContent;
    element.classList.toggle('stage-area--inactive', !active);
    element.classList.toggle('stage-area--empty', active && !hasCustomContent && queue.length === 0);
    element.classList.toggle('stage-area--custom', hasCustomContent);
  }

  function clearTimers(){
    if (slideTimer) { clearTimeout(slideTimer); slideTimer = 0; }
    if (transTimer) { clearTimeout(transTimer); transTimer = 0; }
  }

  function show(node){
    if (!element) return;
    cleanupChildNodes(element);
    element.innerHTML = '';
    if (!node) return;
    element.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
  }

  function hide(cb){
    if (!element) { if (typeof cb === 'function') cb(); return; }
    const cur = element.firstChild;
    if (cur) cur.classList.remove('show');
    setResizeHandler(id, null);
    const raw = settings?.slides?.transitionMs;
    const ms = Number.isFinite(+raw) ? Math.max(0, +raw) : 500;
    if (ms > 0) {
      transTimer = setTimeout(() => {
        transTimer = 0;
        if (typeof cb === 'function') cb();
      }, ms);
    } else if (typeof cb === 'function') {
      cb();
    }
  }

  function scheduleAdvance(ms){
    clearTimeout(slideTimer);
    const wait = Math.max(250, Math.floor(ms || 0));
    slideTimer = setTimeout(() => {
      slideTimer = 0;
      advance();
    }, wait);
  }

  function apply(newQueue, newConfig = {}, { resetIndex = true } = {}){
    hasCustomContent = false;
    if (element) element.classList.remove('stage-area--custom');
    queue = Array.isArray(newQueue) ? newQueue.slice() : [];
    config = { ...config, ...newConfig };
    if (resetIndex || index >= queue.length) {
      index = 0;
      last = null;
    }
    updateActiveState();
  }

  function showFallback(){
    show(renderStageFallback(id));
    updateActiveState();
  }

  function guardPlayback(onEmpty = showFallback){
    clearTimers();
    if (!config.enabled) {
      clear();
      return false;
    }
    if (!queue.length) {
      if (typeof onEmpty === 'function') onEmpty();
      return false;
    }
    return true;
  }

  function normalizeIndex(){
    if (!queue.length) return;
    if (index < 0 || index >= queue.length) {
      index = ((index % queue.length) + queue.length) % queue.length;
    }
  }

  function displayCurrent(){
    normalizeIndex();
    if (!queue.length) {
      showFallback();
      return;
    }
    const styleResult = applyStyleAutomation();
    if (styleResult.scheduleChanged) {
      refreshStageQueues({ resetIndex: true, autoplay: true });
      return;
    }
    if (styleResult.changed) {
      applyTheme();
      runResizeHandlers();
    }
    let item = queue[index];
    let key = slideKey(item);
    if (key === last && queue.length > 1) {
      index = (index + 1) % queue.length;
      item = queue[index];
      key = slideKey(item);
    }
    let deferAdvanceHandler = null;
    const ctx = {
      region: id,
      item,
      advance,
      scheduleAdvance,
      clearScheduledAdvance: () => { if (slideTimer) { clearTimeout(slideTimer); slideTimer = 0; } },
      pageConfig: config,
      deferAdvance(handler) {
        if (typeof handler === 'function') deferAdvanceHandler = handler;
      }
    };
    const node = renderSlideNode(item, ctx);
    show(node);
    last = key;
    updateActiveState();
    const dwell = dwellMsForItem(item, config);
    if (!shouldWaitForVideoEnd(item)) {
      let handled = false;
      if (typeof deferAdvanceHandler === 'function') {
        try {
          const helpers = {
            schedule(ms) {
              const target = Number.isFinite(ms) && ms > 0 ? Math.round(ms) : dwell;
              scheduleAdvance(target);
            },
            scheduleDefault() {
              scheduleAdvance(dwell);
            },
            clear() {
              if (slideTimer) { clearTimeout(slideTimer); slideTimer = 0; }
            },
            defaultMs: dwell,
            item,
            pageConfig: config
          };
          handled = deferAdvanceHandler(helpers) === true;
        } catch (err) {
          console.warn('[slideshow] custom advance handler failed', err);
        }
      }
      if (!handled) {
        scheduleAdvance(dwell);
      }
    }
    preloadUpcomingForStage(controller, { offset: 1 });
  }

  function advance(){
    if (!guardPlayback()) return;
    hide(() => {
      index = (index + 1) % queue.length;
      displayCurrent();
    });
  }

  function play(){
    if (!guardPlayback()) return;
    displayCurrent();
  }

  function clear(){
    clearTimers();
    hasCustomContent = false;
    if (element) {
      element.classList.remove('stage-area--custom');
      cleanupChildNodes(element);
      element.innerHTML = '';
    }
    setResizeHandler(id, null);
    updateActiveState();
  }

  function showCustom(node){
    clearTimers();
    hasCustomContent = !!node;
    config.enabled = false;
    queue = [];
    index = 0;
    last = null;
    setResizeHandler(id, null);
    if (element) {
      element.classList.toggle('stage-area--custom', hasCustomContent);
      cleanupChildNodes(element);
      element.innerHTML = '';
      if (node) {
        element.appendChild(node);
        requestAnimationFrame(() => node.classList.add('show'));
      }
    }
    updateActiveState();
  }
}

function renderSlideNode(item, ctx){
  const region = ctx?.region || 'left';
  if (!item) return renderStageFallback(region);
  switch (item.type) {
    case 'overview':
      return renderOverview(region);
    case 'sauna':
      return renderSauna(item.sauna, region, ctx);
    case 'image':
      return renderImage(item.src, region, ctx);
    case 'video':
      return renderVideo(item.src, item, region, ctx);
    case 'url':
      return renderUrl(item.url, region, ctx);
    case 'story':
      return renderStorySlide(item.story, region);
    case 'hero-timeline':
      return renderHeroTimeline(region, ctx);
    case 'wellness-tip':
      return renderWellnessTip(item, region);
    default:
      return renderImage(item.src || item.url || '', region, ctx);
  }
}

function baseQueueForSource(masterQueue, source){
  const filter = SOURCE_FILTERS[source] || null;
  if (!filter) return masterQueue.slice();
  const allowed = new Set(filter);
  return masterQueue.filter(item => allowed.has(item.type));
}

function playlistEntryKeyFromConfig(entry){
  if (!entry || typeof entry !== 'object') return null;
  let type = String(entry.type || '').trim();
  if (!type) return null;
  if (type === 'image' || type === 'video' || type === 'url') type = 'media';
  switch (type) {
    case 'overview':
    case 'hero-timeline':
      return type;
    case 'sauna': {
      const name = typeof entry.name === 'string' ? entry.name : (typeof entry.sauna === 'string' ? entry.sauna : '');
      return name ? 'sauna:' + name : null;
    }
    case 'story': {
      const rawId = entry.id ?? entry.storyId;
      return rawId != null ? 'story:' + String(rawId) : null;
    }
    case 'media': {
      const rawId = entry.id ?? entry.mediaId ?? entry.__id ?? entry.slug;
      return rawId != null ? 'media:' + String(rawId) : null;
    }
    case 'wellness-tip': {
      const rawId = entry.id ?? entry.tipId;
      return rawId != null ? 'wellness:' + String(rawId) : null;
    }
    default:
      return null;
  }
}

function sanitizePlaylistConfig(list){
  if (!Array.isArray(list)) return [];
  const normalized = [];
  const seen = new Set();
  for (const entry of list){
    const key = playlistEntryKeyFromConfig(entry);
    if (!key || seen.has(key)) continue;
    const [prefix, rest] = key.split(':');
    switch (prefix) {
      case 'overview':
      case 'hero-timeline':
        normalized.push({ type: prefix });
        seen.add(key);
        break;
      case 'sauna':
        if (rest) {
          normalized.push({ type: 'sauna', name: rest });
          seen.add(key);
        }
        break;
      case 'story':
        if (rest) {
          normalized.push({ type: 'story', id: rest });
          seen.add(key);
        }
        break;
      case 'media':
        if (rest) {
          normalized.push({ type: 'media', id: rest });
          seen.add(key);
        }
        break;
      case 'wellness':
        if (rest) {
          normalized.push({ type: 'wellness-tip', id: rest });
          seen.add(key);
        }
        break;
      default:
        break;
    }
  }
  return normalized;
}

function collectPlaylistTypes(list){
  const types = new Set();
  if (!Array.isArray(list)) return types;
  list.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const type = String(entry.type || '').trim();
    if (!type) return;
    if (type === 'media') {
      MEDIA_TYPES.forEach(t => types.add(t));
    } else if (VALID_CONTENT_TYPES.includes(type)) {
      types.add(type);
    }
  });
  return types;
}

function playlistKeyForQueueItem(item){
  if (!item) return null;
  if (item.type === 'overview') return 'overview';
  if (item.type === 'hero-timeline') return 'hero-timeline';
  if (item.type === 'sauna') {
    const name = item.sauna || item.name;
    return name ? 'sauna:' + name : null;
  }
  if (item.type === 'story') {
    const id = item.storyId ?? item.story?.id;
    return id != null ? 'story:' + String(id) : null;
  }
  if (item.type === 'image' || item.type === 'video' || item.type === 'url') {
    const id = item.__id ?? item.id ?? null;
    return id != null ? 'media:' + String(id) : null;
  }
  if (item.type === 'wellness-tip') {
    const id = item.tipId ?? item.id ?? null;
    return id != null ? 'wellness:' + String(id) : null;
  }
  return null;
}

function filterQueueForPage(masterQueue, pageConfig){
  const sourceKey = pageConfig?.source || 'master';
  const playlist = Array.isArray(pageConfig?.playlist) ? sanitizePlaylistConfig(pageConfig.playlist) : [];
  const playlistTypes = collectPlaylistTypes(playlist);
  const baseFilter = SOURCE_FILTERS[sourceKey] || null;
  let allowedTypes = null;
  if (baseFilter) allowedTypes = new Set(baseFilter);
  if (playlistTypes.size){
    if (!allowedTypes) allowedTypes = new Set();
    playlistTypes.forEach(type => allowedTypes.add(type));
  }
  const stageId = pageConfig?.id === 'right' ? 'right' : 'left';
  const layoutMode = settings?.display?.layoutMode === 'split' ? 'split' : 'single';
  const matchesRegion = (item) => {
    if (!item || typeof item.region !== 'string') return true;
    const region = item.region;
    if (!region || region === 'full') return true;
    if (region === stageId) return true;
    if (stageId === 'left' && layoutMode !== 'split' && region === 'right') return true;
    return false;
  };
  const base = (allowedTypes ? masterQueue.filter(item => allowedTypes.has(item.type)) : masterQueue.slice())
    .filter(matchesRegion);
  if (playlist.length){
    const buckets = new Map();
    base.forEach(item => {
      const key = playlistKeyForQueueItem(item);
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(item);
    });
    const ordered = [];
    playlist.forEach(entry => {
      const key = playlistEntryKeyFromConfig(entry);
      if (!key) return;
      const bucket = buckets.get(key);
      if (bucket && bucket.length) {
        ordered.push(bucket.shift());
      }
    });
    if (ordered.length) return ordered;
  }
  const types = Array.isArray(pageConfig?.contentTypes) && pageConfig.contentTypes.length
    ? new Set(pageConfig.contentTypes)
    : null;
  if (types){
    if (types.has('media')){
      types.delete('media');
      MEDIA_TYPES.forEach(t => types.add(t));
    }
    if (playlistTypes.size){
      playlistTypes.forEach(type => types.add(type));
    }
  }
  if (!types) return base;
  return base.filter(item => types.has(item.type));
}

function getPageConfig(id){
  const display = settings?.display || {};
  const pages = display.pages || {};
  const raw = (typeof pages[id] === 'object' && pages[id]) ? pages[id] : {};
  const defaults = PAGE_DEFAULTS[id] || PAGE_DEFAULTS.left;
  const layoutMode = (display.layoutMode === 'split') ? 'split' : 'single';
  const enabled = id === 'left' ? true : (layoutMode === 'split');
  const source = SOURCE_FILTERS[raw.source] ? raw.source : (SOURCE_FILTERS[defaults.source] ? defaults.source : 'master');
  const timerNum = Number(raw.timerSec);
  const timerSec = Number.isFinite(timerNum) && timerNum > 0 ? Math.max(1, Math.round(timerNum)) : null;
  const rawTypes = Array.isArray(raw.contentTypes) ? raw.contentTypes : defaults.contentTypes;
  const filtered = rawTypes.filter(type => VALID_CONTENT_TYPES.includes(type) || type === 'media');
  const baseContentTypes = filtered.length ? Array.from(new Set(filtered)) : defaults.contentTypes;
  const rawPlaylist = Array.isArray(raw.playlist) ? raw.playlist : defaults.playlist;
  const playlist = sanitizePlaylistConfig(rawPlaylist);
  const playlistTypes = collectPlaylistTypes(playlist);
  const normalizedContentTypes = (() => {
    const baseList = (source === 'master')
      ? VALID_CONTENT_TYPES.slice()
      : Array.from(new Set(baseContentTypes));
    const merged = new Set();
    baseList.forEach(type => {
      if (type === 'media') MEDIA_TYPES.forEach(t => merged.add(t));
      else if (VALID_CONTENT_TYPES.includes(type)) merged.add(type);
    });
    if (playlistTypes.size){
      playlistTypes.forEach(type => merged.add(type));
    }
    return Array.from(merged);
  })();
  return { id, enabled, source, timerSec, contentTypes: normalizedContentTypes, playlist };
}

async function preloadUpcomingForStage(controller, { offset = 0 } = {}){
  if (!controller || !controller.isEnabled()) return;
  const queue = controller.getQueue();
  if (!Array.isArray(queue) || !queue.length) return;
  let start = controller.getIndex() + offset;
  const len = queue.length;
  if (len <= 0) return;
  if (start < 0) start = ((start % len) + len) % len;
  const urls = [];
  for (let i = 0; i < PRELOAD_AHEAD && i < len; i++) {
    const item = queue[(start + i) % len];
    if (!item) continue;
    let url = null;
    if (item.type === 'image') {
      url = item.src;
    } else if (item.type === 'sauna') {
      const saunaName = item.sauna || item.name;
      if (saunaName) {
        const saunaUrl = settings?.assets?.rightImages?.[saunaName];
        if (saunaUrl) urls.push(saunaUrl);
      }
    } else if (item.type === 'story') {
      const storyUrls = collectStoryImageUrls(item.story, 4);
      storyUrls.forEach(u => { if (u) urls.push(u); });
    }
    if (url) urls.push(url);
  }
  if (!urls.length) return;
  await Promise.all(urls.map(preloadImage));
}

const stageLeftController = createStageController('left', STAGE_LEFT || STAGE);
const stageRightController = createStageController('right', STAGE_RIGHT);

function stopAllStages(){
  stageControllers.forEach(ctrl => ctrl.stop());
}

function applyStagePlaylists(masterQueue, { resetIndex = true } = {}){
  const leftCfg = getPageConfig('left');
  const rightCfg = getPageConfig('right');
  stageLeftController.apply(
    filterQueueForPage(masterQueue, leftCfg),
    { enabled: leftCfg.enabled, timerSec: leftCfg.timerSec, source: leftCfg.source, contentTypes: leftCfg.contentTypes, playlist: leftCfg.playlist },
    { resetIndex }
  );
  stageRightController.apply(
    filterQueueForPage(masterQueue, rightCfg),
    { enabled: rightCfg.enabled, timerSec: rightCfg.timerSec, source: rightCfg.source, contentTypes: rightCfg.contentTypes, playlist: rightCfg.playlist },
    { resetIndex }
  );
  updateLayoutModeAttr(rightCfg.enabled ? 'split' : 'single');
}

function refreshStageQueues({ resetIndex = true, autoplay = true } = {}){
  const masterQueue = buildMasterQueue();
  applyStagePlaylists(masterQueue, { resetIndex });
  if (autoplay) stageControllers.forEach(ctrl => ctrl.play());
  maybeUpdateBackgroundAudioPlayback();
  return masterQueue;
}

//Showpairing
function showPairing(){
  clearLiveSource({ clearConfig: true });
  stopPollingLoop();
  stopAllStages();
  backgroundAudioState.desiredPlaying = false;
  stopBackgroundAudio({ dropSrc: false });
  updateLayoutModeAttr('single');
  const box = document.createElement('div');
  box.className = 'container fade show';
  box.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  box.innerHTML = `
    <div style="background:rgba(0,0,0,.55);color:#fff;padding:28px 32px;border-radius:16px;max-width:90vw;text-align:center">
      <div style="font-weight:800;font-size:28px;margin-bottom:10px">Gerät koppeln</div>
      <div id="code" style="font-size:42px;font-weight:900;letter-spacing:4px;background:rgba(255,255,255,.1);padding:8px 14px;border-radius:12px;display:inline-block;min-width:12ch">…</div>
      <div style="margin-top:10px;opacity:.9">Öffne im Admin „Geräte“ und gib den Code ein.</div>
    </div>`;

  if (stageLeftController) stageLeftController.showCustom(box);
  else if (STAGE_LEFT || STAGE) {
    const target = STAGE_LEFT || STAGE;
    if (target) {
      target.innerHTML = '';
      target.appendChild(box);
      requestAnimationFrame(() => box.classList.add('show'));
    }
  }
  if (stageRightController) stageRightController.showCustom(null);

  (async ()=>{
    try {
      // Bestehenden Code (localStorage) wiederverwenden – Tabs teilen den Code
      let st = null; try { st = JSON.parse(ls.get('pairState')||'null'); } catch {}
      let code = (st && st.code && (Date.now() - (st.createdAt||0) < 15*60*1000)) ? st.code : null;

      if (!code) {
        const r = await fetch('/pair/begin', { method:'POST', headers:{'X-Pair-Request':'1'} });
        if (!r.ok){
          const err = new Error('begin http '+r.status);
          err.status = r.status;
          throw err;
        }
        const j0 = await r.json();
        if (!j0 || !j0.code) throw new Error('begin payload');
        code = j0.code;
        ls.set('pairState', JSON.stringify({ code, createdAt: Date.now() }));
      }

      const el = document.getElementById('code');
      if (el) el.textContent = code;

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      startPairLiveUpdates(code);
    } catch (e) {
      const el = document.getElementById('code');
      if (el) el.textContent = (e && e.status) ? String(e.status) : 'NETZ-FEHLER';
      console.error('[pair] begin failed', e);
    }
  })();
}


// ---------- Bootstrap & live update ----------
async function bootstrap(){
  function handlePreviewMessage(message) {
    if (!message || message.type !== 'preview') {
      return;
    }
    previewMode = true;
    const payload = message.payload || {};
    const nextSchedule = payload.schedule || schedule;
    const nextSettings = payload.settings || settings;
    if (!nextSchedule || !nextSettings) {
      return;
    }
    applyResolvedState(nextSchedule, nextSettings, { resetIndex: true })
      .catch((error) => console.error('[preview] state apply failed', error));
  }

  const previewBridge = typeof window !== 'undefined' ? window.__playerPreviewBridge : null;
  if (previewBridge && typeof previewBridge.subscribe === 'function') {
    try {
      previewBridge.subscribe(handlePreviewMessage);
    } catch (error) {
      console.error('[preview] failed to subscribe to bridge', error);
      window.addEventListener('message', (event) => handlePreviewMessage(event?.data));
    }
  } else {
    window.addEventListener('message', (event) => handlePreviewMessage(event?.data));
  }
  const deviceMode = !!DEVICE_ID;

if (!previewMode) {
  if (deviceMode) {
    try {
      await loadDeviceResolved(DEVICE_ID);
    } catch (error) {
      console.error('[bootstrap] resolve failed:', error);
      showPairing();
      return; // HIER abbrechen, sonst bleibt die Stage leer
    }

    const heartbeatPayload = JSON.stringify({ device: DEVICE_ID });
    const heartbeatHeaders = { 'Content-Type': 'application/json' };
    let heartbeatBlob = null;

    const sendHeartbeat = () => {
      let sent = false;
      if (navigator.sendBeacon) {
        try {
          if (!heartbeatBlob) {
            heartbeatBlob = new Blob([heartbeatPayload], { type: 'application/json' });
          }
          sent = navigator.sendBeacon('/api/heartbeat.php', heartbeatBlob);
        } catch (error) {
          console.error('[heartbeat] beacon failed', error);
        }
      }
      if (!sent) {
        fetch('/api/heartbeat.php', {
          method: 'POST',
          headers: heartbeatHeaders,
          body: heartbeatPayload
        }).then((response) => {
          if (!response.ok) throw new Error('heartbeat http ' + response.status);
        }).catch((error) => console.error('[heartbeat] failed', error));
      }
    };

    sendHeartbeat();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeat, 30 * 1000);
  } else {
    if (IS_PREVIEW) {
      const info = document.createElement('div');
      info.className = 'container fade show empty';
      const inner = document.createElement('div');
      inner.className = 'empty-message';
      inner.textContent = 'Vorschau lädt…';
      info.appendChild(inner);
      stopAllStages();
      updateLayoutModeAttr('single');
      if (stageLeftController) stageLeftController.showCustom(info);
      if (stageRightController) stageRightController.showCustom(null);
      return; // kein Pairing im Admin-Dock
    }
    showPairing();
    return;
  }
}

if (schedule && settings) {
  stageControllers.forEach((ctrl) => ctrl.play());
} else {
  refreshStageQueues({ resetIndex:true });
  preloadSlideImages();
}

// Live-Reload: priorisiere EventStream, fallback auf Polling
if (!previewMode) {
  startConfigLiveUpdates(deviceMode);
}
}

if (!IS_VITEST && !(import.meta && import.meta.vitest)) {
  bootstrap();
}

export {
  collectInfoModules,
  renderInfoModule,
  __setTestSettings
};

function __setTestSettings(value) {
  settings = value;
}
