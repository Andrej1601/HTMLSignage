// /admin/js/app.js
// ============================================================================
// Admin-App Bootstrap & Seitenweite Einstellungen
// - Lädt Schedule + Settings
// - Initialisiert Grid-UI, Slides-Master-UI und Grid-Day-Loader
// - Stellt Seitenboxen bereit (Schrift/Slides, Farben, Fußnoten, Highlight/Flame)
// - Speichern, Preview, Export/Import, Theme-Toggle, Cleanup
// ============================================================================

'use strict';

// === Modular imports =========================================================
import { $, $$, preloadImg, genId, deepClone, mergeDeep, fetchJson, escapeHtml } from './core/utils.js';
import { DEFAULTS } from './core/defaults.js';
import { initGridUI, renderGrid as renderGridUI } from './ui/grid.js';
import { initSlidesMasterUI, renderSlidesMaster, getActiveDayKey, collectSlideOrderStream } from './ui/slides_master.js';
import { initGridDayLoader } from './ui/grid_day_loader.js';
import { uploadGeneric } from './core/upload.js';
import { createUnsavedTracker } from './core/unsaved_state.js';
import storage from './core/storage.js';
import { createAppState } from './core/app_state.js';
import { createDeviceContextManager } from './core/device_context.js';
import {
  PAGE_CONTENT_TYPES,
  PAGE_CONTENT_TYPE_KEYS,
  PAGE_SOURCE_KEYS,
  playlistKeyFromSanitizedEntry,
  sanitizePagePlaylist,
  sanitizeBadgeLibrary,
  normalizeSettings,
  sanitizeScheduleForCompare,
  sanitizeSettingsForCompare
} from './core/config.js';
import {
  loadDeviceSnapshots,
  loadDeviceById,
  claimDevice,
  setDeviceMode,
  unpairDevice,
  renameDevice,
  cleanupDevices,
  resolveNowSeconds,
  OFFLINE_AFTER_MIN
} from './core/device_service.js';
import {
  fetchUsers as fetchUserAccounts,
  saveUser as saveUserAccount,
  deleteUser as deleteUserAccount,
  AVAILABLE_ROLES as AUTH_ROLES
} from './core/auth_service.js';

const SLIDESHOW_ORIGIN = window.SLIDESHOW_ORIGIN || location.origin;
const THUMB_FALLBACK = '/assets/img/thumb_fallback.svg';

const lsGet = (key) => storage.get(key);
const lsSet = (key, value) => storage.set(key, value);
const lsRemove = (key) => storage.remove(key);

const ROLE_META = {
  viewer: {
    title: 'Viewer',
    description: 'Lesender Zugriff auf Geräteübersicht und Inhalte.'
  },
  editor: {
    title: 'Editor',
    description: 'Darf Inhalte bearbeiten und Geräteaktionen ausführen.'
  },
  admin: {
    title: 'Admin',
    description: 'Voller Zugriff inklusive Benutzer- und Rollenkonfiguration.'
  }
};

// === Global State ============================================================
let schedule = null;
let settings = null;
let baseSchedule = null;            // globaler Schedule (Quelle)
let baseSettings = null;            // globale Settings (Quelle)
let deviceBaseSchedule = null;      // Basis für Geräte-Kontext
let deviceBaseSettings = null;
let storedView = lsGet('adminView');
if (storedView === 'devices') storedView = 'grid';
if (storedView !== 'grid' && storedView !== 'preview') storedView = 'grid';
const appState = createAppState({
  initialView: storedView,
  devicesPinned: lsGet('devicesPinned') === '1'
});
document.body?.classList.toggle('devices-pinned', appState.isDevicesPinned());

const stateAccess = {
  getSchedule: () => schedule,
  getSettings: () => settings,
  setSchedule: (next) => {
    schedule = next;
    appState.setSchedule(next);
  },
  setSettings: (next) => {
    settings = next;
    appState.setSettings(next);
  }
};

let renderContextBadge = () => {};
let enterDeviceContext = async () => {};
let exitDeviceContext = () => {};
let getDeviceContext = () => appState.getDeviceContext();
const getDevicesPane = () => deviceContextState.getDevicesPane();
const setDevicesPane = (pane) => deviceContextState.setDevicesPane(pane);
const getDockPane = () => deviceContextState.getDockPane();
const setDockPane = (pane) => deviceContextState.setDockPane(pane);
const getCurrentView = () => deviceContextState.getCurrentView();
const setCurrentView = (view) => deviceContextState.setCurrentView(view);
const isDevicesPinned = () => deviceContextState.isDevicesPinned();
const setDevicesPinned = (flag) => {
  deviceContextState.setDevicesPinned(flag);
};

const deviceContextState = {
  getSchedule: () => schedule,
  setSchedule: (next) => stateAccess.setSchedule(next),
  getSettings: () => settings,
  setSettings: (next) => stateAccess.setSettings(next),
  setBaseState: (scheduleValue, settingsValue) => {
    baseSchedule = scheduleValue;
    baseSettings = settingsValue;
    appState.setBaseState(scheduleValue, settingsValue);
  },
  getBaseState: () => ({ schedule: baseSchedule, settings: baseSettings }),
  setDeviceBaseState: (scheduleValue, settingsValue) => {
    deviceBaseSchedule = scheduleValue;
    deviceBaseSettings = settingsValue;
    appState.setDeviceBaseState(scheduleValue, settingsValue);
  },
  getDeviceBaseState: () => ({ schedule: deviceBaseSchedule, settings: deviceBaseSettings }),
  clearDeviceBaseState: () => {
    deviceBaseSchedule = null;
    deviceBaseSettings = null;
    appState.clearDeviceBaseState();
  },
  setDeviceContext: (ctx) => appState.setDeviceContext(ctx),
  getDeviceContext: () => appState.getDeviceContext(),
  clearDeviceContext: () => appState.clearDeviceContext(),
  setCurrentView: (view) => appState.setCurrentView(view),
  getCurrentView: () => appState.getCurrentView(),
  setDevicesPinned: (flag) => appState.setDevicesPinned(flag),
  isDevicesPinned: () => appState.isDevicesPinned(),
  setDockPane: (el) => appState.setDockPane(el),
  getDockPane: () => appState.getDockPane(),
  setDevicesPane: (el) => appState.setDevicesPane(el),
  getDevicesPane: () => appState.getDevicesPane()
};

function createGridContext() {
  return {
    getSchedule: stateAccess.getSchedule,
    getSettings: stateAccess.getSettings,
    setSchedule: stateAccess.setSchedule
  };
}

function createSlidesMasterContext() {
  return {
    getSchedule: stateAccess.getSchedule,
    getSettings: stateAccess.getSettings,
    setSchedule: stateAccess.setSchedule,
    setSettings: stateAccess.setSettings,
    refreshSlidesBox: renderSlidesBox,
    refreshColors: renderColors
  };
}

function initSlidesMaster() {
  initSlidesMasterUI(createSlidesMasterContext());
}

function refreshSidebarPanels() {
  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();
}

function refreshDevicesPane(options = {}) {
  const handler = window.__refreshDevicesPane;
  if (typeof handler !== 'function') return undefined;
  const { bypassCache = false, ...rest } = options || {};
  return handler({ bypassCache, ...rest });
}

function refreshAllUi({ reinitSlidesMaster = true } = {}) {
  refreshSidebarPanels();
  if (reinitSlidesMaster) {
    initSlidesMaster();
  } else {
    renderSlidesMaster();
  }
  renderContextBadge();
  refreshDevicesPane();
}

function safeInvoke(label, fn) {
  try {
    fn();
  } catch (error) {
    console.warn(label, error);
  }
}

function clearDraftsIfPresent() {
  lsRemove('scheduleDraft');
  lsRemove('settingsDraft');
}

function stripBadgeDraftArtifacts(source) {
  if (!source || typeof source !== 'object') return;
  const removeBadgeData = (target) => {
    if (!target || typeof target !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(target, 'badgeLibrary')) {
      delete target.badgeLibrary;
    }
    if (Object.prototype.hasOwnProperty.call(target, 'customBadgeEmojis')) {
      delete target.customBadgeEmojis;
    }
  };

  if (source.slides && typeof source.slides === 'object') {
    removeBadgeData(source.slides);
    const sets = source.slides.styleSets;
    if (sets && typeof sets === 'object') {
      Object.values(sets).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        removeBadgeData(entry.slides);
      });
    }
  }
}

function rerenderAfterBaselineRestore() {
  safeInvoke('[admin] Grid re-render failed after reset', renderGridUI);
  safeInvoke('[admin] Slides box re-render failed after reset', renderSlidesBox);
  safeInvoke('[admin] Highlight box re-render failed after reset', renderHighlightBox);
  safeInvoke('[admin] Colors re-render failed after reset', renderColors);
  safeInvoke('[admin] Footnotes re-render failed after reset', renderFootnotes);
  safeInvoke('[admin] Slides master re-render failed after reset', renderSlidesMaster);
}

const unsavedBadge = document.getElementById('unsavedBadge');
const globalScope = (typeof globalThis === 'object') ? globalThis : (typeof window === 'object' ? window : undefined);

const unsavedTracker = createUnsavedTracker({
  document,
  window: globalScope,
  unsavedBadge,
  getSchedule: () => schedule,
  getSettings: () => settings,
  setSchedule: (next) => { schedule = next; },
  setSettings: (next) => { settings = next; },
  sanitizeSchedule: sanitizeScheduleForCompare,
  sanitizeSettings: sanitizeSettingsForCompare,
  normalizeSettings: (value) => normalizeSettings(value, { assignMissingIds: false }),
  clearDrafts: clearDraftsIfPresent,
  onDirty: () => {
    try { dockPushDebounced(); } catch {}
  },
  onRestore: rerenderAfterBaselineRestore
});

const updateBaseline = unsavedTracker.setBaseline;
const evaluateUnsavedState = unsavedTracker.evaluate;
const setUnsavedState = (state, options) => unsavedTracker.setUnsavedState(state, options);
const restoreFromBaseline = unsavedTracker.restoreBaseline;
const ensureUnsavedChangeListener = unsavedTracker.ensureListeners;

const deviceContextManager = createDeviceContextManager({
  document,
  state: deviceContextState,
  updateBaseline,
  evaluateUnsavedState,
  setUnsavedState,
  refreshAllUi,
  showView,
  loadDeviceById
});

renderContextBadge = deviceContextManager.renderContextBadge;
enterDeviceContext = deviceContextManager.enterDeviceContext;
exitDeviceContext = deviceContextManager.exitDeviceContext;
getDeviceContext = () => deviceContextManager.getDeviceContext();

const unsavedBadgeResetBtn = document.getElementById('unsavedBadgeReset');
if (unsavedBadgeResetBtn){
  unsavedBadgeResetBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    restoreFromBaseline();
  });
}

function initSidebarResize(){
  const resizer = document.getElementById('layoutResizer');
  const rightbar = document.querySelector('.rightbar');
  if (!resizer || !rightbar) return;

  const root = document.documentElement;
  const getNumberVar = (name, fallback) => {
    const raw = getComputedStyle(root).getPropertyValue(name);
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : fallback;
  };

  let minPx = 0;
  let maxPx = 0;
  let hitPx = 0;
  const clampWidth = (value) => Math.min(maxPx, Math.max(minPx, value));
  const media = window.matchMedia('(orientation: portrait),(max-width: 900px)');

  const refreshBounds = () => {
    minPx = getNumberVar('--sidebar-min', 280);
    maxPx = getNumberVar('--sidebar-max', 920);
    hitPx = Math.max(4, getNumberVar('--sidebar-resizer-hit', 18));
  };
  refreshBounds();

  const readStoredWidth = () => {
    const stored = Number.parseFloat(lsGet('sidebarWidthPx'));
    return Number.isFinite(stored) ? clampWidth(stored) : null;
  };

  const updateAria = (width) => {
    const current = Number.isFinite(width) ? width : rightbar.getBoundingClientRect().width;
    resizer.setAttribute('aria-valuemin', String(Math.round(minPx)));
    resizer.setAttribute('aria-valuemax', String(Math.round(maxPx)));
    resizer.setAttribute('aria-valuenow', String(Math.round(current)));
  };

  const applyWidth = (width, { store = true } = {}) => {
    const clamped = clampWidth(width);
    root.style.setProperty('--sidebar-size', `${clamped}px`);
    updateAria(clamped);
    if (store) lsSet('sidebarWidthPx', String(Math.round(clamped)));
  };

  const resetWidth = () => {
    root.style.removeProperty('--sidebar-size');
    updateAria();
  };

  const isCollapsed = () => media.matches;

  const syncState = () => {
    if (isCollapsed()) {
      resizer.setAttribute('aria-hidden', 'true');
      resizer.setAttribute('tabindex', '-1');
      resizer.classList.remove('is-active');
      rightbar.classList.remove('resize-hover');
      resetWidth();
      return;
    }
    resizer.setAttribute('aria-hidden', 'false');
    resizer.setAttribute('tabindex', '0');
    refreshBounds();
    const stored = readStoredWidth();
    if (stored != null) {
      applyWidth(stored, { store: false });
    } else {
      resetWidth();
    }
  };

  media.addEventListener('change', syncState);
  window.addEventListener('resize', () => {
    refreshBounds();
    if (!isCollapsed()) updateAria();
  });

  const dragState = { active: false, pointerId: null, startX: 0, startWidth: 0, captureTarget: null };

  const handlePointerMove = (ev) => {
    if (!dragState.active || ev.pointerId !== dragState.pointerId) return;
    const delta = ev.clientX - dragState.startX;
    applyWidth(dragState.startWidth - delta, { store: false });
  };

  const finishDrag = (store = true) => {
    if (!dragState.active) return;
    dragState.active = false;
    const width = rightbar.getBoundingClientRect().width;
    if (store) applyWidth(width);
    const target = dragState.captureTarget;
    dragState.captureTarget = null;
    try {
      if (target && dragState.pointerId !== null) target.releasePointerCapture(dragState.pointerId);
    } catch {}
    dragState.pointerId = null;
    resizer.classList.remove('is-active');
    rightbar.classList.remove('resize-hover');
  };

  const tryStartDrag = (target, ev) => {
    if (!ev.isPrimary || isCollapsed()) return false;
    dragState.active = true;
    dragState.pointerId = ev.pointerId;
    dragState.startX = ev.clientX;
    dragState.startWidth = rightbar.getBoundingClientRect().width;
    dragState.captureTarget = target;
    try { target.setPointerCapture(ev.pointerId); } catch {}
    resizer.classList.add('is-active');
    ev.preventDefault();
    ev.stopPropagation();
    return true;
  };

  resizer.addEventListener('pointerdown', (ev) => {
    tryStartDrag(resizer, ev);
  });

  rightbar.addEventListener('pointerdown', (ev) => {
    if (dragState.active || !ev.isPrimary || isCollapsed()) return;
    const rect = rightbar.getBoundingClientRect();
    if ((ev.clientX - rect.left) > hitPx) return;
    tryStartDrag(rightbar, ev);
  });

  rightbar.addEventListener('pointermove', (ev) => {
    if (dragState.active || isCollapsed()) return;
    const rect = rightbar.getBoundingClientRect();
    const nearEdge = (ev.clientX - rect.left) <= hitPx;
    rightbar.classList.toggle('resize-hover', nearEdge);
  });
  rightbar.addEventListener('pointerleave', () => {
    if (!dragState.active) rightbar.classList.remove('resize-hover');
  });

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', (ev) => {
    if (ev.pointerId === dragState.pointerId) finishDrag(true);
  });
  window.addEventListener('pointercancel', (ev) => {
    if (ev.pointerId === dragState.pointerId) finishDrag(false);
  });
  resizer.addEventListener('lostpointercapture', () => finishDrag(false));
  rightbar.addEventListener('lostpointercapture', () => finishDrag(false));

  resizer.addEventListener('keydown', (ev) => {
    if (isCollapsed()) return;
    const baseWidth = rightbar.getBoundingClientRect().width;
    const step = ev.shiftKey ? 48 : 24;
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      applyWidth(baseWidth + step);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      applyWidth(baseWidth - step);
    } else if (ev.key === 'Home') {
      ev.preventDefault();
      applyWidth(minPx);
    } else if (ev.key === 'End') {
      ev.preventDefault();
      applyWidth(maxPx);
    }
  });

  syncState();
}

// ============================================================================
// 1) Bootstrap: Laden + Initialisieren
// ============================================================================
async function loadAll(){
  let unsavedFromDraft = false;
  let s;
  let cfg;
  try {
    [s, cfg] = await Promise.all([
      fetchJson('/admin/api/load.php', { cache: 'no-store' }),
      fetchJson('/admin/api/load_settings.php', { cache: 'no-store' })
    ]);
  } catch (error) {
    console.error('[admin] Laden der Basisdaten fehlgeschlagen', error);
    alert('Fehler beim Laden der Daten: ' + error.message);
    return;
  }

  stateAccess.setSchedule(deepClone(s || {}));
  stateAccess.setSettings(normalizeSettings(cfg || {}, { assignMissingIds: true }));
  baseSchedule = deepClone(schedule);
  baseSettings = deepClone(settings);
  deviceContextState.setBaseState(baseSchedule, baseSettings);
  deviceContextState.clearDeviceBaseState();
  updateBaseline(baseSchedule, baseSettings);

  try {
    const draft = lsGet('scheduleDraft');
    if (draft) {
      stateAccess.setSchedule(JSON.parse(draft));
      unsavedFromDraft = true;
    }
  } catch {}

  try {
    const draft = lsGet('settingsDraft');
    if (draft) {
      const parsed = JSON.parse(draft);
      stripBadgeDraftArtifacts(parsed);
      stateAccess.setSettings(mergeDeep(settings, parsed));
      unsavedFromDraft = true;
    }
  } catch {}
  stateAccess.setSettings(normalizeSettings(settings, { assignMissingIds: false }));

  setUnsavedState(unsavedFromDraft, { skipDraftClear: true });

  // --- UI-Module initialisieren ---------------------------------------------
  const gridContext = createGridContext();
  initGridUI(gridContext);
  initSlidesMaster();
  initGridDayLoader(gridContext);

  // --- Seitenboxen rendern ---------------------------------------------------
  refreshSidebarPanels();
  renderContextBadge();

  // --- globale UI-Schalter (Theme/Backup/Cleanup) ---------------------------
  initThemeToggle();
  initBackupButtons();
  initCleanupInSystem();
  initUserAdmin();
  initViewMenu();
  initSidebarResize();
}

// ============================================================================
// 2) Slides & Text (linke Seitenbox „Slideshow & Text“)
// ============================================================================
function renderSlidesBox(){
  const f = settings.fonts || {};
  const setV = (sel, val) => { const el = document.querySelector(sel); if (el) el.value = val; };
  const setC = (sel, val) => { const el = document.querySelector(sel); if (el) el.checked = !!val; };
  const notifySettingsChanged = () => {
    window.__queueUnsaved?.();
    window.__markUnsaved?.();
    if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
  };

  const normalizeTime = (value) => {
    if (typeof value !== 'string') return null;
    const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(value);
    if (!match) return null;
    let hour = Number(match[1]);
    let minute = Number(match[2] ?? '0');
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    hour = Math.max(0, Math.min(23, hour));
    minute = Math.max(0, Math.min(59, minute));
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const normalizeAutomationDateTime = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/\s+/, 'T');
    const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(normalized);
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
    const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour
      .toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const ms = new Date(year, month - 1, day, hour, minute).getTime();
    if (!Number.isFinite(ms)) return null;
    return { iso, ms };
  };

  const formatAutomationDate = (date) => {
    if (!(date instanceof Date)) return '';
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${y.toString().padStart(4, '0')}-${m}-${d}T${h}:${min}`;
  };

  const compareAutomationSlots = (a, b) => {
    const groupA = a.mode === 'range' ? 0 : 1;
    const groupB = b.mode === 'range' ? 0 : 1;
    if (groupA !== groupB) return groupA - groupB;
    if (groupA === 0) {
      return (a.startDateTime || '').localeCompare(b.startDateTime || '');
    }
    return (a.start || '').localeCompare(b.start || '');
  };

  const ensureStyleAutomationState = () => {
    settings.slides ||= {};
    const styleSets = (settings.slides.styleSets && typeof settings.slides.styleSets === 'object') ? settings.slides.styleSets : {};
    const available = Object.keys(styleSets);
    const defaults = DEFAULTS.slides?.styleAutomation || {};
    const current = (settings.slides.styleAutomation && typeof settings.slides.styleAutomation === 'object')
      ? deepClone(settings.slides.styleAutomation)
      : {};

    const normalized = {
      enabled: current.enabled !== false,
      fallbackStyle: '',
      timeSlots: []
    };

    const fallbackCandidate = current.fallbackStyle || defaults.fallbackStyle || settings.slides.activeStyleSet || available[0] || '';
    normalized.fallbackStyle = available.includes(fallbackCandidate) ? fallbackCandidate : (available[0] || '');

    const slotSource = Array.isArray(current.timeSlots) && current.timeSlots.length
      ? current.timeSlots
      : (Array.isArray(defaults.timeSlots) ? deepClone(defaults.timeSlots) : []);

    const seen = new Set();
    const pushSlot = (slot) => {
      if (!slot || typeof slot !== 'object') return;
      let id = slot.id ? String(slot.id).trim() : '';
      if (!id) id = genId('sty_');
      if (seen.has(id)) return;
      const label = typeof slot.label === 'string' ? slot.label.trim() : '';
      const style = available.includes(slot.style) ? slot.style : normalized.fallbackStyle;
      const mode = slot.mode === 'range' || (slot.startDateTime && slot.endDateTime)
        ? 'range'
        : 'daily';
      if (mode === 'range') {
        const startInfo = normalizeAutomationDateTime(slot.startDateTime || slot.startDate || slot.start);
        const endInfo = normalizeAutomationDateTime(slot.endDateTime || slot.endDate || slot.end);
        if (!startInfo || !endInfo || endInfo.ms < startInfo.ms) return;
        normalized.timeSlots.push({
          id,
          label,
          style,
          mode: 'range',
          startDateTime: startInfo.iso,
          endDateTime: endInfo.iso
        });
      } else {
        const start = normalizeTime(slot.start || slot.startTime || '');
        if (!start) return;
        normalized.timeSlots.push({ id, label, start, style, mode: 'daily' });
      }
      seen.add(id);
    };

    slotSource.forEach(pushSlot);

    if (!normalized.timeSlots.length && Array.isArray(defaults.timeSlots)) {
      defaults.timeSlots.forEach(pushSlot);
    }

    normalized.timeSlots.sort(compareAutomationSlots);
    settings.slides.styleAutomation = normalized;
    return normalized;
  };

  const ensureExtrasState = () => {
    const defaults = DEFAULTS.extras || {};
    const extras = settings.extras = (settings.extras && typeof settings.extras === 'object') ? settings.extras : {};

    const toDwellSeconds = (value) => {
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0) return null;
      return Math.max(1, Math.round(num));
    };

    const sanitizeList = (list, fallback, mapper) => {
      const source = Array.isArray(list) && list.length ? list : (Array.isArray(fallback) ? deepClone(fallback) : []);
      const normalized = [];
      const seen = new Set();
      source.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const mapped = mapper(entry);
        if (!mapped) return;
        let id = mapped.id ? String(mapped.id).trim() : '';
        if (!id) id = genId('ext_');
        if (seen.has(id)) return;
        mapped.id = id;
        normalized.push(mapped);
        seen.add(id);
      });
      return normalized;
    };

    extras.wellnessTips = sanitizeList(extras.wellnessTips, defaults.wellnessTips, (entry) => {
      const dwell = toDwellSeconds(entry.dwellSec);
      const enabled = entry.enabled !== false;
      const result = {
        id: entry.id,
        icon: typeof entry.icon === 'string' ? entry.icon.trim() : '',
        title: typeof entry.title === 'string' ? entry.title.trim() : '',
        text: typeof entry.text === 'string' ? entry.text.trim() : '',
        enabled
      };
      if (dwell != null) result.dwellSec = dwell;
      return result;
    });

    extras.eventCountdowns = sanitizeList(extras.eventCountdowns, defaults.eventCountdowns, (entry) => {
      const target = typeof entry.target === 'string' ? entry.target.trim() : '';
      const dwell = toDwellSeconds(entry.dwellSec);
      const result = {
        id: entry.id,
        title: typeof entry.title === 'string' ? entry.title.trim() : '',
        subtitle: typeof entry.subtitle === 'string' ? entry.subtitle.trim() : '',
        target,
        style: typeof entry.style === 'string' ? entry.style.trim() : '',
        image: typeof entry.image === 'string' ? entry.image.trim() : '',
        imageThumb: typeof entry.imageThumb === 'string' ? entry.imageThumb.trim() : ''
      };
      if (dwell != null) result.dwellSec = dwell;
      return result;
    });

    extras.gastronomyHighlights = sanitizeList(extras.gastronomyHighlights, defaults.gastronomyHighlights, (entry) => {
      const items = Array.isArray(entry.items)
        ? entry.items.map(it => (typeof it === 'string' ? it.trim() : '')).filter(Boolean)
        : [];
      const textLines = Array.isArray(entry.textLines)
        ? entry.textLines.map(it => (typeof it === 'string' ? it.trim() : '')).filter(Boolean)
        : [];
      const dwell = toDwellSeconds(entry.dwellSec);
      const result = {
        id: entry.id,
        title: typeof entry.title === 'string' ? entry.title.trim() : '',
        description: typeof entry.description === 'string' ? entry.description.trim() : '',
        icon: typeof entry.icon === 'string' ? entry.icon.trim() : '',
        items,
        textLines
      };
      if (dwell != null) result.dwellSec = dwell;
      return result;
    });

    return extras;
  };

  const renderStyleAutomationControls = () => {
    const automation = ensureStyleAutomationState();
    const styleSets = (settings.slides?.styleSets && typeof settings.slides.styleSets === 'object') ? settings.slides.styleSets : {};
    const styleOptions = Object.entries(styleSets).map(([id, value]) => ({ id, label: value?.label || id }));

    const enabledInput = document.getElementById('styleAutoEnabled');
    if (enabledInput) {
      enabledInput.checked = automation.enabled !== false;
      enabledInput.onchange = () => {
        automation.enabled = !!enabledInput.checked;
        notifySettingsChanged();
      };
    }

    const fallbackSelect = document.getElementById('styleAutoFallback');
    if (fallbackSelect) {
      fallbackSelect.innerHTML = '';
      styleOptions.forEach(({ id, label }) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = label;
        fallbackSelect.appendChild(opt);
      });
      if (!automation.fallbackStyle && styleOptions.length) {
        automation.fallbackStyle = styleOptions[0].id;
      }
      if (automation.fallbackStyle && !styleOptions.some(opt => opt.id === automation.fallbackStyle) && styleOptions.length) {
        automation.fallbackStyle = styleOptions[0].id;
      }
      if (automation.fallbackStyle) fallbackSelect.value = automation.fallbackStyle;
      fallbackSelect.onchange = () => {
        automation.fallbackStyle = fallbackSelect.value || '';
        automation.timeSlots.forEach(slot => {
          if (!styleOptions.some(opt => opt.id === slot.style)) {
            slot.style = automation.fallbackStyle;
          }
        });
        renderStyleAutomationControls();
        notifySettingsChanged();
      };
    }

    const listHost = document.getElementById('styleAutoList');
    if (listHost) {
      listHost.innerHTML = '';
      automation.timeSlots.sort(compareAutomationSlots);
      automation.timeSlots.forEach((slot, index) => {
        const row = document.createElement('div');
        row.className = 'style-auto-slot';

        const modeWrap = document.createElement('div');
        modeWrap.className = 'style-auto-field style-auto-mode';
        const modeLabel = document.createElement('label');
        modeLabel.textContent = 'Typ';
        const modeSelect = document.createElement('select');
        modeSelect.className = 'input';
        [
          { value: 'daily', label: 'Täglich' },
          { value: 'range', label: 'Zeitraum' }
        ].forEach(option => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.label;
          modeSelect.appendChild(opt);
        });
        modeSelect.value = slot.mode === 'range' ? 'range' : 'daily';
        modeSelect.onchange = () => {
          const nextMode = modeSelect.value === 'range' ? 'range' : 'daily';
          if (nextMode === slot.mode) return;
          if (nextMode === 'range') {
            const now = new Date();
            const startDefault = formatAutomationDate(now);
            const endDefault = formatAutomationDate(new Date(now.getTime() + 60 * 60 * 1000));
            slot.mode = 'range';
            slot.startDateTime = normalizeAutomationDateTime(slot.startDateTime)?.iso
              || normalizeAutomationDateTime(slot.start)?.iso
              || startDefault;
            slot.endDateTime = normalizeAutomationDateTime(slot.endDateTime)?.iso || endDefault;
            delete slot.start;
          } else {
            const start = normalizeTime(slot.start) || normalizeTime('06:00') || '06:00';
            slot.mode = 'daily';
            slot.start = start || '06:00';
            delete slot.startDateTime;
            delete slot.endDateTime;
          }
          automation.timeSlots.sort(compareAutomationSlots);
          renderStyleAutomationControls();
          notifySettingsChanged();
        };
        modeWrap.append(modeLabel, modeSelect);
        row.appendChild(modeWrap);

        if (slot.mode === 'range') {
          const startWrap = document.createElement('div');
          startWrap.className = 'style-auto-field';
          const startLabel = document.createElement('label');
          startLabel.textContent = 'Start (Datum & Uhrzeit)';
          const startInput = document.createElement('input');
          startInput.type = 'datetime-local';
          startInput.value = slot.startDateTime || '';
          startInput.onchange = () => {
            const next = normalizeAutomationDateTime(startInput.value);
            if (!next) {
              startInput.value = slot.startDateTime || '';
              return;
            }
            slot.startDateTime = next.iso;
            const endInfo = normalizeAutomationDateTime(slot.endDateTime);
            if (endInfo && endInfo.ms < next.ms) {
              const adjusted = new Date(next.ms + 60 * 60 * 1000);
              slot.endDateTime = formatAutomationDate(adjusted);
            }
            automation.timeSlots.sort(compareAutomationSlots);
            renderStyleAutomationControls();
            notifySettingsChanged();
          };
          startWrap.append(startLabel, startInput);

          const endWrap = document.createElement('div');
          endWrap.className = 'style-auto-field';
          const endLabel = document.createElement('label');
          endLabel.textContent = 'Ende (Datum & Uhrzeit)';
          const endInput = document.createElement('input');
          endInput.type = 'datetime-local';
          endInput.value = slot.endDateTime || '';
          endInput.onchange = () => {
            const next = normalizeAutomationDateTime(endInput.value);
            const startInfo = normalizeAutomationDateTime(slot.startDateTime);
            if (!next || (startInfo && next.ms < startInfo.ms)) {
              endInput.value = slot.endDateTime || '';
              return;
            }
            slot.endDateTime = next.iso;
            automation.timeSlots.sort(compareAutomationSlots);
            renderStyleAutomationControls();
            notifySettingsChanged();
          };
          endWrap.append(endLabel, endInput);

          row.append(startWrap, endWrap);
        } else {
          const timeWrap = document.createElement('div');
          timeWrap.className = 'style-auto-field';
          const timeLabel = document.createElement('label');
          timeLabel.textContent = 'Startzeit';
          const timeInput = document.createElement('input');
          timeInput.type = 'time';
          timeInput.value = slot.start || '06:00';
          timeInput.onchange = () => {
            const next = normalizeTime(timeInput.value);
            if (!next) {
              timeInput.value = slot.start || '06:00';
              return;
            }
            slot.start = next;
            automation.timeSlots.sort(compareAutomationSlots);
            renderStyleAutomationControls();
            notifySettingsChanged();
          };
          timeWrap.append(timeLabel, timeInput);
          row.appendChild(timeWrap);
        }

        const styleWrap = document.createElement('div');
        styleWrap.className = 'style-auto-field';
        const styleLabel = document.createElement('label');
        styleLabel.textContent = 'Stil';
        const styleSelect = document.createElement('select');
        styleSelect.className = 'input';
        styleOptions.forEach(({ id, label }) => {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = label;
          styleSelect.appendChild(opt);
        });
        if (slot.style && styleOptions.some(opt => opt.id === slot.style)) {
          styleSelect.value = slot.style;
        } else if (automation.fallbackStyle) {
          slot.style = automation.fallbackStyle;
          styleSelect.value = automation.fallbackStyle;
        }
        styleSelect.onchange = () => {
          slot.style = styleSelect.value || automation.fallbackStyle;
          notifySettingsChanged();
        };
        styleWrap.append(styleLabel, styleSelect);
        row.appendChild(styleWrap);

        const labelWrap = document.createElement('div');
        labelWrap.className = 'style-auto-field';
        const labelLabel = document.createElement('label');
        labelLabel.textContent = 'Label';
        const labelInput = document.createElement('input');
        labelInput.className = 'input';
        labelInput.placeholder = 'z. B. Abend';
        labelInput.value = slot.label || '';
        labelInput.oninput = () => {
          slot.label = labelInput.value.trim();
          notifySettingsChanged();
        };
        labelWrap.append(labelLabel, labelInput);
        row.appendChild(labelWrap);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn sm ghost';
        removeBtn.type = 'button';
        removeBtn.textContent = 'Entfernen';
        removeBtn.onclick = () => {
          automation.timeSlots.splice(index, 1);
          renderStyleAutomationControls();
          notifySettingsChanged();
        };
        row.appendChild(removeBtn);

        listHost.appendChild(row);
      });
    }

    const addBtn = document.getElementById('styleAutoAdd');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', () => {
        const state = ensureStyleAutomationState();
        const last = state.timeSlots[state.timeSlots.length - 1];
        const start = last && last.mode === 'daily' ? last.start : '06:00';
        state.timeSlots.push({ id: genId('sty_'), mode: 'daily', start: start || '06:00', label: '', style: state.fallbackStyle });
        state.timeSlots.sort(compareAutomationSlots);
        renderStyleAutomationControls();
        notifySettingsChanged();
      });
    }
  };

  const toDatetimeLocal = (value) => {
    if (!value) return '';
    const trimmed = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    const date = new Date(trimmed);
    if (!Number.isFinite(date.getTime())) return '';
    return formatAutomationDate(date);
  };

  const fromDatetimeLocal = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
  };

  const renderExtrasEditor = () => {
    const extras = ensureExtrasState();
    const styleSets = (settings.slides?.styleSets && typeof settings.slides.styleSets === 'object') ? settings.slides.styleSets : {};
    const styleOptions = Object.entries(styleSets).map(([id, value]) => ({ id, label: value?.label || id }));

    const wellnessHost = document.getElementById('extrasWellnessList');
    if (wellnessHost) {
      wellnessHost.innerHTML = '';
      extras.wellnessTips.forEach((tip, index) => {
        const row = document.createElement('div');
        row.className = 'extras-item';

        const header = document.createElement('div');
        header.className = 'extras-item-header extras-inline';

        const iconInput = document.createElement('input');
        iconInput.className = 'input';
        iconInput.placeholder = 'Emoji/Icon';
        iconInput.maxLength = 6;
        iconInput.value = tip.icon || '';
        iconInput.oninput = () => {
          tip.icon = iconInput.value.trim();
          notifySettingsChanged();
        };

        const titleInput = document.createElement('input');
        titleInput.className = 'input';
        titleInput.placeholder = 'Titel';
        titleInput.value = tip.title || '';
        titleInput.oninput = () => {
          tip.title = titleInput.value.trim();
          notifySettingsChanged();
        };

        const enabledToggle = document.createElement('label');
        enabledToggle.className = 'toggle extras-toggle';
        const enabledInput = document.createElement('input');
        enabledInput.type = 'checkbox';
        const enabledText = document.createElement('span');
        enabledText.className = 'extras-toggle-label';
        enabledToggle.append(enabledInput, enabledText);

        const applyEnabledState = (shouldNotify = false) => {
          const active = !!enabledInput.checked;
          tip.enabled = active;
          enabledText.textContent = active ? 'Aktiv' : 'Ausgeblendet';
          row.classList.toggle('is-disabled', !active);
          if (shouldNotify) notifySettingsChanged();
        };

        enabledInput.addEventListener('change', () => applyEnabledState(true));
        enabledInput.checked = tip.enabled !== false;
        applyEnabledState(false);

        header.append(iconInput, titleInput, enabledToggle);

        const body = document.createElement('div');
        body.className = 'extras-item-body';
        const textArea = document.createElement('textarea');
        textArea.className = 'input';
        textArea.placeholder = 'Beschreibung oder Tipptext';
        textArea.value = tip.text || '';
        textArea.oninput = () => {
          tip.text = textArea.value.trim();
          notifySettingsChanged();
        };
        body.appendChild(textArea);

        const dwellRow = document.createElement('div');
        dwellRow.className = 'extras-inline';
        const dwellLabel = document.createElement('label');
        dwellLabel.textContent = 'Anzeige (Sek.)';
        const dwellInput = document.createElement('input');
        dwellInput.className = 'input num3';
        dwellInput.type = 'number';
        dwellInput.min = '1';
        dwellInput.max = '600';
        dwellInput.placeholder = 'Standard';
        dwellInput.value = tip.dwellSec != null ? String(tip.dwellSec) : '';
        dwellInput.onchange = () => {
          const num = Number(dwellInput.value);
          if (Number.isFinite(num) && num > 0) {
            tip.dwellSec = Math.max(1, Math.round(num));
          } else {
            delete tip.dwellSec;
            dwellInput.value = '';
          }
          notifySettingsChanged();
        };
        dwellRow.append(dwellLabel, dwellInput);
        body.appendChild(dwellRow);

        const actions = document.createElement('div');
        actions.className = 'extras-item-actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn sm ghost';
        removeBtn.type = 'button';
        removeBtn.textContent = 'Entfernen';
        removeBtn.onclick = () => {
          extras.wellnessTips.splice(index, 1);
          renderExtrasEditor();
          notifySettingsChanged();
        };
        actions.appendChild(removeBtn);

        row.append(header, body, actions);
        wellnessHost.appendChild(row);
      });
    }

    const addWellness = document.getElementById('extrasWellnessAdd');
    if (addWellness && !addWellness.dataset.bound) {
      addWellness.dataset.bound = '1';
      addWellness.addEventListener('click', () => {
        extras.wellnessTips.push({ id: genId('well_'), icon: '', title: '', text: '', dwellSec: null, enabled: true });
        renderExtrasEditor();
        notifySettingsChanged();
      });
    }

    const eventHost = document.getElementById('extrasEventList');
    if (eventHost) {
      eventHost.innerHTML = '';
      extras.eventCountdowns.forEach((event, index) => {
        const row = document.createElement('div');
        row.className = 'extras-item';

        const header = document.createElement('div');
        header.className = 'extras-item-header extras-inline';

        const titleInput = document.createElement('input');
        titleInput.className = 'input';
        titleInput.placeholder = 'Eventtitel';
        titleInput.value = event.title || '';
        titleInput.oninput = () => {
          event.title = titleInput.value.trim();
          notifySettingsChanged();
        };

        const subtitleInput = document.createElement('input');
        subtitleInput.className = 'input';
        subtitleInput.placeholder = 'Infos zum Event (optional)';
        subtitleInput.value = event.subtitle || '';
        subtitleInput.oninput = () => {
          event.subtitle = subtitleInput.value.trim();
          notifySettingsChanged();
        };

        header.append(titleInput, subtitleInput);

        const body = document.createElement('div');
        body.className = 'extras-item-body';

        const timeRow = document.createElement('div');
        timeRow.className = 'extras-inline';
        const timeInput = document.createElement('input');
        timeInput.type = 'datetime-local';
        timeInput.className = 'input';
        timeInput.value = toDatetimeLocal(event.target);
        timeInput.onchange = () => {
          event.target = fromDatetimeLocal(timeInput.value);
          notifySettingsChanged();
        };

        const styleSelect = document.createElement('select');
        styleSelect.className = 'input';
        const baseOpt = document.createElement('option');
        baseOpt.value = '';
        baseOpt.textContent = 'Style-Automation folgen';
        styleSelect.appendChild(baseOpt);
        styleOptions.forEach(({ id, label }) => {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = label;
          styleSelect.appendChild(opt);
        });
        if (event.style && styleOptions.some(opt => opt.id === event.style)) {
          styleSelect.value = event.style;
        }
        styleSelect.onchange = () => {
          event.style = styleSelect.value || '';
          notifySettingsChanged();
        };

        timeRow.append(timeInput, styleSelect);
        body.append(timeRow);

        const mediaRow = document.createElement('div');
        mediaRow.className = 'extras-inline extras-media-row';
        const thumbImg = document.createElement('img');
        thumbImg.className = 'extras-thumb';
        thumbImg.alt = 'Event-Vorschau';
        const updateThumb = () => {
          const src = event.imageThumb || event.image || THUMB_FALLBACK;
          thumbImg.src = src || THUMB_FALLBACK;
          thumbImg.classList.toggle('is-empty', !event.image && !event.imageThumb);
        };
        updateThumb();

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        const uploadLabel = document.createElement('label');
        uploadLabel.className = 'btn sm';
        uploadLabel.textContent = 'Bild wählen';
        uploadLabel.appendChild(fileInput);
        fileInput.onchange = () => {
          uploadGeneric(fileInput, (path, thumb) => {
            event.image = path || '';
            event.imageThumb = thumb || path || '';
            updateThumb();
            updateClearState();
            notifySettingsChanged();
          });
        };

        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn sm ghost';
        clearBtn.type = 'button';
        clearBtn.textContent = 'Bild entfernen';
        const updateClearState = () => {
          clearBtn.disabled = !(event.image || event.imageThumb);
        };
        updateClearState();
        clearBtn.onclick = () => {
          event.image = '';
          event.imageThumb = '';
          updateThumb();
          updateClearState();
          notifySettingsChanged();
        };

        mediaRow.append(thumbImg, uploadLabel, clearBtn);
        body.append(mediaRow);

        const dwellRow = document.createElement('div');
        dwellRow.className = 'extras-inline';
        const dwellLabel = document.createElement('label');
        dwellLabel.textContent = 'Anzeige (Sek.)';
        const dwellInput = document.createElement('input');
        dwellInput.className = 'input num3';
        dwellInput.type = 'number';
        dwellInput.min = '1';
        dwellInput.max = '600';
        dwellInput.placeholder = 'Standard';
        dwellInput.value = event.dwellSec != null ? String(event.dwellSec) : '';
        dwellInput.onchange = () => {
          const num = Number(dwellInput.value);
          if (Number.isFinite(num) && num > 0) {
            event.dwellSec = Math.max(1, Math.round(num));
          } else {
            delete event.dwellSec;
            dwellInput.value = '';
          }
          notifySettingsChanged();
        };
        dwellRow.append(dwellLabel, dwellInput);
        body.appendChild(dwellRow);

        const actions = document.createElement('div');
        actions.className = 'extras-item-actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn sm ghost';
        removeBtn.type = 'button';
        removeBtn.textContent = 'Entfernen';
        removeBtn.onclick = () => {
          extras.eventCountdowns.splice(index, 1);
          renderExtrasEditor();
          notifySettingsChanged();
        };
        actions.appendChild(removeBtn);

        row.append(header, body, actions);
        eventHost.appendChild(row);
      });
    }

    const addEventBtn = document.getElementById('extrasEventAdd');
    if (addEventBtn && !addEventBtn.dataset.bound) {
      addEventBtn.dataset.bound = '1';
      addEventBtn.addEventListener('click', () => {
        extras.eventCountdowns.push({ id: genId('evt_'), title: '', subtitle: '', target: '', style: '', image: '', imageThumb: '', dwellSec: null });
        renderExtrasEditor();
        notifySettingsChanged();
      });
    }

    const gastroHost = document.getElementById('extrasGastroList');
    if (gastroHost) {
      gastroHost.innerHTML = '';
      extras.gastronomyHighlights.forEach((entry, index) => {
        const row = document.createElement('div');
        row.className = 'extras-item';

        const header = document.createElement('div');
        header.className = 'extras-item-header extras-inline';

        const iconInput = document.createElement('input');
        iconInput.className = 'input';
        iconInput.placeholder = 'Icon (optional)';
        iconInput.value = entry.icon || '';
        iconInput.oninput = () => {
          entry.icon = iconInput.value.trim();
          notifySettingsChanged();
        };

        const titleInput = document.createElement('input');
        titleInput.className = 'input';
        titleInput.placeholder = 'Titel';
        titleInput.value = entry.title || '';
        titleInput.oninput = () => {
          entry.title = titleInput.value.trim();
          notifySettingsChanged();
        };

        header.append(iconInput, titleInput);

        const body = document.createElement('div');
        body.className = 'extras-item-body';

        const descArea = document.createElement('textarea');
        descArea.className = 'input';
        descArea.placeholder = 'Beschreibung';
        descArea.value = entry.description || '';
        descArea.oninput = () => {
          entry.description = descArea.value.trim();
          notifySettingsChanged();
        };

        const itemsArea = document.createElement('textarea');
        itemsArea.className = 'input';
        itemsArea.placeholder = 'Bullet-Points (jede Zeile ein Punkt)';
        itemsArea.value = (entry.items || []).join('\n');
        itemsArea.oninput = () => {
          entry.items = itemsArea.value.split('\n').map(line => line.trim()).filter(Boolean);
          notifySettingsChanged();
        };

        body.append(descArea, itemsArea);

        const dwellRow = document.createElement('div');
        dwellRow.className = 'extras-inline';
        const dwellLabel = document.createElement('label');
        dwellLabel.textContent = 'Anzeige (Sek.)';
        const dwellInput = document.createElement('input');
        dwellInput.className = 'input num3';
        dwellInput.type = 'number';
        dwellInput.min = '1';
        dwellInput.max = '600';
        dwellInput.placeholder = 'Standard';
        dwellInput.value = entry.dwellSec != null ? String(entry.dwellSec) : '';
        dwellInput.onchange = () => {
          const num = Number(dwellInput.value);
          if (Number.isFinite(num) && num > 0) {
            entry.dwellSec = Math.max(1, Math.round(num));
          } else {
            delete entry.dwellSec;
            dwellInput.value = '';
          }
          notifySettingsChanged();
        };
        dwellRow.append(dwellLabel, dwellInput);
        body.appendChild(dwellRow);

        const actions = document.createElement('div');
        actions.className = 'extras-item-actions';
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn sm ghost';
        removeBtn.type = 'button';
        removeBtn.textContent = 'Entfernen';
        removeBtn.onclick = () => {
          extras.gastronomyHighlights.splice(index, 1);
          renderExtrasEditor();
          notifySettingsChanged();
        };
        actions.appendChild(removeBtn);

        row.append(header, body, actions);
        gastroHost.appendChild(row);
      });
    }

    const addGastroBtn = document.getElementById('extrasGastroAdd');
    if (addGastroBtn && !addGastroBtn.dataset.bound) {
      addGastroBtn.dataset.bound = '1';
      addGastroBtn.addEventListener('click', () => {
        extras.gastronomyHighlights.push({ id: genId('gas_'), title: '', description: '', icon: '', items: [], textLines: [], dwellSec: null });
        renderExtrasEditor();
        notifySettingsChanged();
      });
    }
  };

  const renderHeroTimelineControls = () => {
    const ensureSlides = () => {
      settings.slides ||= {};
      return settings.slides;
    };

    const rerenderPlaylists = () => {
      const displayCfg = settings.display = settings.display || {};
      const pagesCfg = displayCfg.pages = displayCfg.pages || {};
      const leftState = pagesCfg.left = pagesCfg.left || {};
      const rightState = pagesCfg.right = pagesCfg.right || {};
      renderPagePlaylist('pageLeftPlaylist', leftState.playlist, { pageKey: 'left' });
      renderPagePlaylist('pageRightPlaylist', rightState.playlist, { pageKey: 'right' });
    };

    const enabledInput = document.getElementById('heroTimelineEnabled');
    const settingsPanel = document.getElementById('heroTimelineSettings');
    if (enabledInput) {
      const slidesCfg = ensureSlides();
      const enabled = !!slidesCfg.heroEnabled;
      enabledInput.checked = enabled;
      if (settingsPanel) settingsPanel.hidden = !enabled;
      if (!enabledInput.dataset.bound) {
        enabledInput.dataset.bound = '1';
        enabledInput.addEventListener('change', () => {
          const slides = ensureSlides();
          slides.heroEnabled = !!enabledInput.checked;
          if (settingsPanel) settingsPanel.hidden = !enabledInput.checked;
          rerenderPlaylists();
          notifySettingsChanged();
        });
      }
    }

    const durationInput = document.getElementById('heroTimelineDuration');
    if (durationInput) {
      const slidesCfg = ensureSlides();
      const defaultMs = Number(DEFAULTS.slides?.heroTimelineFillMs) || 8000;
      const raw = Number(slidesCfg.heroTimelineFillMs);
      const ms = Number.isFinite(raw) && raw > 0 ? Math.max(1000, Math.round(raw)) : defaultMs;
      durationInput.value = Math.round(ms / 1000);
      if (!durationInput.dataset.bound) {
        durationInput.dataset.bound = '1';
        durationInput.addEventListener('change', () => {
          const slides = ensureSlides();
          const value = Number(durationInput.value);
          if (Number.isFinite(value) && value > 0) {
            const sanitized = Math.max(1, Math.round(value));
            slides.heroTimelineFillMs = sanitized * 1000;
            durationInput.value = String(sanitized);
          } else {
            delete slides.heroTimelineFillMs;
            durationInput.value = String(Math.round((Number(DEFAULTS.slides?.heroTimelineFillMs) || 8000) / 1000));
          }
          notifySettingsChanged();
        });
      }
    }

    const baseInput = document.getElementById('heroTimelineBase');
    if (baseInput) {
      const slidesCfg = ensureSlides();
      const defaultBase = Number(DEFAULTS.slides?.heroTimelineBaseMinutes) || 15;
      const raw = Number(slidesCfg.heroTimelineBaseMinutes);
      const minutes = Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.round(raw)) : defaultBase;
      baseInput.value = String(minutes);
      if (!baseInput.dataset.bound) {
        baseInput.dataset.bound = '1';
        baseInput.addEventListener('change', () => {
          const slides = ensureSlides();
          const value = Number(baseInput.value);
          if (Number.isFinite(value) && value > 0) {
            const sanitized = Math.max(1, Math.round(value));
            slides.heroTimelineBaseMinutes = sanitized;
            baseInput.value = String(sanitized);
          } else {
            delete slides.heroTimelineBaseMinutes;
            baseInput.value = String(Number(DEFAULTS.slides?.heroTimelineBaseMinutes) || 15);
          }
          notifySettingsChanged();
        });
      }
    }

    const maxInput = document.getElementById('heroTimelineMax');
    if (maxInput) {
      const slidesCfg = ensureSlides();
      const raw = slidesCfg.heroTimelineMaxEntries;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        const sanitized = Math.max(1, Math.round(parsed));
        slidesCfg.heroTimelineMaxEntries = sanitized;
        maxInput.value = String(sanitized);
      } else {
        delete slidesCfg.heroTimelineMaxEntries;
        maxInput.value = '';
      }
      if (!maxInput.dataset.bound) {
        maxInput.dataset.bound = '1';
        maxInput.addEventListener('change', () => {
          const slides = ensureSlides();
          const value = Number(maxInput.value);
          if (Number.isFinite(value) && value > 0) {
            const sanitized = Math.max(1, Math.round(value));
            slides.heroTimelineMaxEntries = sanitized;
            maxInput.value = String(sanitized);
          } else {
            delete slides.heroTimelineMaxEntries;
            maxInput.value = '';
          }
          notifySettingsChanged();
        });
      }
    }

    const waitInput = document.getElementById('heroTimelineWaitForScroll');
    if (waitInput) {
      const slidesCfg = ensureSlides();
      waitInput.checked = !!slidesCfg.heroTimelineWaitForScroll;
      if (!waitInput.dataset.bound) {
        waitInput.dataset.bound = '1';
        waitInput.addEventListener('change', () => {
          const slides = ensureSlides();
          if (waitInput.checked) {
            slides.heroTimelineWaitForScroll = true;
          } else {
            delete slides.heroTimelineWaitForScroll;
          }
          notifySettingsChanged();
        });
      }
    }
  };
  const renderPagePlaylist = (hostId, playlistList = [], { pageKey = 'left' } = {}) => {
    const host = document.getElementById(hostId);
    if (!host) return;
    const normalizedKey = pageKey === 'right' ? 'right' : 'left';
    const displayCfg = settings.display = settings.display || {};
    const pagesCfg = displayCfg.pages = displayCfg.pages || {};
    const pageState = pagesCfg[normalizedKey] = pagesCfg[normalizedKey] || {};
    const sanitized = sanitizePagePlaylist(Array.isArray(playlistList) ? playlistList : pageState.playlist);
    const existing = Array.isArray(pageState.playlist) ? pageState.playlist : [];
    if (JSON.stringify(existing) !== JSON.stringify(sanitized)) {
      pageState.playlist = sanitized;
    }

    const { entries: baseEntries, hiddenSaunas } = collectSlideOrderStream({ normalizeSortOrder: false });
    const showOverview = settings?.slides?.showOverview !== false;
    const heroEnabled = !!(settings?.slides?.heroEnabled);

    const entryList = [];
    const entryMap = new Map();
    const pushEntry = (entry) => {
      entryList.push(entry);
      entryMap.set(entry.key, entry);
    };

    pushEntry({
      key: 'overview',
      kind: 'overview',
      label: 'Übersicht',
      thumb: THUMB_FALLBACK,
      disabled: !showOverview,
      statusText: showOverview ? null : 'Deaktiviert'
    });

    pushEntry({
      key: 'hero-timeline',
      kind: 'hero-timeline',
      label: 'Event Countdown',
      thumb: THUMB_FALLBACK,
      disabled: !heroEnabled,
      statusText: heroEnabled ? null : 'Deaktiviert'
    });

    baseEntries.forEach(entry => {
      if (!entry) return;
      if (entry.kind === 'sauna') {
        const name = entry.name || '';
        if (!name) return;
        pushEntry({
          key: 'sauna:' + name,
          kind: 'sauna',
          name,
          label: name,
          thumb: settings.assets?.rightImages?.[name] || '',
          disabled: hiddenSaunas.has(name),
          statusText: hiddenSaunas.has(name) ? 'Ausgeblendet' : null
        });
      } else if (entry.kind === 'media') {
        const id = entry.item?.id != null ? String(entry.item.id) : '';
        if (!id) return;
        pushEntry({
          key: 'media:' + id,
          kind: 'media',
          id,
          label: entry.item?.name || '(unbenannt)',
          thumb: entry.item?.thumb || entry.item?.url || '',
          disabled: entry.item?.enabled === false,
          statusText: entry.item?.enabled === false ? 'Deaktiviert' : null
        });
      } else if (entry.kind === 'story') {
        const storyId = entry.item?.id != null ? String(entry.item.id) : (entry.key || '');
        if (!storyId) return;
        pushEntry({
          key: 'story:' + storyId,
          kind: 'story',
          id: storyId,
          label: entry.item?.title || 'Story-Slide',
          thumb: entry.item?.heroUrl || THUMB_FALLBACK,
          disabled: entry.item?.enabled === false,
          statusText: entry.item?.enabled === false ? 'Deaktiviert' : null
        });
      } else if (entry.kind === 'wellness-tip') {
        const tipId = entry.item?.id != null ? String(entry.item.id) : (entry.key || '');
        if (!tipId) return;
        const icon = entry.item?.icon ? `${entry.item.icon} ` : '';
        pushEntry({
          key: 'wellness:' + tipId,
          kind: 'wellness-tip',
          id: tipId,
          label: icon + (entry.item?.title || 'Wellness-Tipp'),
          thumb: '',
          disabled: false,
          statusText: null
        });
      } else if (entry.kind === 'event-countdown') {
        const eventId = entry.item?.id != null ? String(entry.item.id) : (entry.key || '');
        if (!eventId) return;
        pushEntry({
          key: 'event:' + eventId,
          kind: 'event-countdown',
          id: eventId,
          label: entry.item?.title || 'Event',
          thumb: '',
          disabled: false,
          statusText: null
        });
      } else if (entry.kind === 'gastronomy-highlight') {
        const gastroId = entry.item?.id != null ? String(entry.item.id) : (entry.key || '');
        if (!gastroId) return;
        const icon = entry.item?.icon ? `${entry.item.icon} ` : '';
        pushEntry({
          key: 'gastro:' + gastroId,
          kind: 'gastronomy-highlight',
          id: gastroId,
          label: icon + (entry.item?.title || 'Gastronomie'),
          thumb: '',
          disabled: false,
          statusText: null
        });
      }
    });

    const selectedKeys = sanitized.map(playlistKeyFromSanitizedEntry).filter(Boolean);
    const orderList = [];
    const seenKeys = new Set();
    selectedKeys.forEach(key => {
      const entry = entryMap.get(key);
      if (entry && !seenKeys.has(key)) {
        orderList.push(entry);
        seenKeys.add(key);
      }
    });
    entryList.forEach(entry => {
      if (!seenKeys.has(entry.key)) {
        orderList.push(entry);
        seenKeys.add(entry.key);
      }
    });

    const selected = new Set();
    selectedKeys.forEach(key => {
      if (seenKeys.has(key)) selected.add(key);
    });

    const hasDynamicSelection = (() => {
      if (!selected.size) return false;
      for (const key of selected) {
        if (!key) continue;
        if (key === 'overview' || key === 'hero-timeline') continue;
        return true;
      }
      return false;
    })();

    if (!selected.size || !hasDynamicSelection) {
      orderList.forEach(entry => {
        if (!entry || entry.disabled) return;
        selected.add(entry.key);
      });
    }

    host.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'slide-order-grid';
    host.appendChild(grid);

    const DROP_BEFORE = 'drop-before';
    const DROP_AFTER = 'drop-after';
    let draggedEntry = null;

    const clearDropIndicators = () => {
      grid.querySelectorAll('.slide-order-tile').forEach(tile => tile.classList.remove(DROP_BEFORE, DROP_AFTER));
    };

    const isBeforeTarget = (event, target) => {
      const rect = target.getBoundingClientRect();
      const horizontal = rect.width > rect.height;
      return horizontal
        ? (event.clientX < rect.left + rect.width / 2)
        : (event.clientY < rect.top + rect.height / 2);
    };

    const commitPlaylist = () => {
      const next = [];
      for (const entry of orderList) {
        if (!selected.has(entry.key)) continue;
        switch (entry.kind) {
          case 'overview':
            next.push({ type: 'overview' });
            break;
          case 'hero-timeline':
            next.push({ type: 'hero-timeline' });
            break;
          case 'sauna':
            next.push({ type: 'sauna', name: entry.name });
            break;
          case 'media':
            next.push({ type: 'media', id: entry.id });
            break;
          case 'story':
            next.push({ type: 'story', id: entry.id });
            break;
          case 'wellness-tip':
            next.push({ type: 'wellness-tip', id: entry.id });
            break;
          case 'event-countdown':
            next.push({ type: 'event-countdown', id: entry.id });
            break;
          case 'gastronomy-highlight':
            next.push({ type: 'gastronomy-highlight', id: entry.id });
            break;
          default:
            break;
        }
      }
      const prevStr = JSON.stringify(Array.isArray(pageState.playlist) ? pageState.playlist : []);
      const nextStr = JSON.stringify(next);
      pageState.playlist = next;
      if (normalizedKey === 'left') {
        const layoutSelect = document.getElementById('layoutMode');
        const layoutModeValue = layoutSelect?.value === 'split' ? 'split' : 'single';
        if (layoutModeValue !== 'split') {
          const sortOrder = [];
          next.forEach(entry => {
            if (!entry || typeof entry !== 'object') return;
            if (entry.type === 'sauna' && entry.name) {
              sortOrder.push({ type: 'sauna', name: entry.name });
            } else if (entry.type === 'media' && entry.id != null) {
              sortOrder.push({ type: 'media', id: entry.id });
            } else if (entry.type === 'story' && entry.id != null) {
              sortOrder.push({ type: 'story', id: entry.id });
            }
          });
          const prevSortStr = JSON.stringify(Array.isArray(settings.slides?.sortOrder) ? settings.slides.sortOrder : []);
          settings.slides ||= {};
          if (sortOrder.length) settings.slides.sortOrder = sortOrder;
          else delete settings.slides.sortOrder;
          const nextSortStr = JSON.stringify(sortOrder);
          if (prevSortStr !== nextSortStr && prevStr === nextStr) {
            setUnsavedState(true);
            if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
          }
        }
      }
      if (prevStr !== nextStr) {
        setUnsavedState(true);
        if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      }
    };

    const moveEntry = (entry, dir) => {
      const idx = orderList.indexOf(entry);
      if (idx === -1) return;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= orderList.length) return;
      orderList.splice(idx, 1);
      orderList.splice(newIdx, 0, entry);
      commitPlaylist();
      renderTiles();
    };

    const reorderEntries = (source, target, before) => {
      const fromIdx = orderList.indexOf(source);
      const toIdx = orderList.indexOf(target);
      if (fromIdx === -1 || toIdx === -1 || source === target) return;
      orderList.splice(fromIdx, 1);
      let insertIdx = before ? toIdx : toIdx + 1;
      if (insertIdx > fromIdx) insertIdx--;
      orderList.splice(insertIdx, 0, source);
      commitPlaylist();
      renderTiles();
    };

    const toggleEntry = (entry) => {
      const isSelected = selected.has(entry.key);
      if (entry.disabled && !isSelected) return;
      if (isSelected) selected.delete(entry.key);
      else selected.add(entry.key);
      commitPlaylist();
      renderTiles();
    };

    const renderTiles = () => {
      grid.innerHTML = '';
      orderList.forEach((entry, idx) => {
        const tile = document.createElement('div');
        tile.className = 'slide-order-tile';
        tile.dataset.key = entry.key;
        tile.dataset.idx = String(idx);
        const isSelected = selected.has(entry.key);
        if (!isSelected) tile.classList.add('is-unselected');
        if (entry.disabled) tile.classList.add('is-disabled');
        if (entry.kind === 'sauna' && hiddenSaunas.has(entry.name)) tile.classList.add('is-hidden');

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = entry.label || '';
        tile.appendChild(title);

        if (entry.statusText) {
          const statusEl = document.createElement('div');
          statusEl.className = 'slide-status';
          statusEl.textContent = entry.statusText;
          tile.appendChild(statusEl);
        }

        if (entry.thumb) {
          const img = document.createElement('img');
          img.src = entry.thumb;
          img.alt = entry.label || '';
          tile.appendChild(img);
        }

        const stateBadge = document.createElement('div');
        stateBadge.className = 'playlist-state';
        stateBadge.textContent = isSelected ? 'Aktiv' : 'Inaktiv';
        tile.appendChild(stateBadge);

        if (isSelected) {
          const controls = document.createElement('div');
          controls.className = 'reorder-controls';

          const makeCtrlButton = (dir, label) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `reorder-btn ${dir > 0 ? 'reorder-down' : 'reorder-up'}`;
            btn.title = label;
            btn.setAttribute('aria-label', label);
            btn.innerHTML = dir < 0
              ? '<svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="M8 3.5 12.5 8l-.7.7L8 4.9 4.2 8.7l-.7-.7Z"/></svg>'
              : '<svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="m8 12.5-4.5-4.5.7-.7L8 11.1l3.8-3.8.7.7Z"/></svg>';
            btn.addEventListener('click', ev => {
              ev.stopPropagation();
              moveEntry(entry, dir);
            });
            btn.addEventListener('pointerdown', ev => ev.stopPropagation());
            btn.addEventListener('mousedown', ev => ev.stopPropagation());
            btn.addEventListener('touchstart', ev => ev.stopPropagation());
            btn.draggable = false;
            return btn;
          };

          controls.appendChild(makeCtrlButton(-1, 'Nach oben verschieben'));
          controls.appendChild(makeCtrlButton(1, 'Nach unten verschieben'));

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'reorder-btn playlist-remove';
          removeBtn.innerHTML = '✕';
          removeBtn.title = 'Aus Playlist entfernen';
          removeBtn.setAttribute('aria-label', 'Aus Playlist entfernen');
          removeBtn.addEventListener('click', ev => {
            ev.stopPropagation();
            selected.delete(entry.key);
            commitPlaylist();
            renderTiles();
          });
          controls.appendChild(removeBtn);
          tile.appendChild(controls);
        }

        tile.addEventListener('click', ev => {
          if (ev.target.closest('.reorder-controls')) return;
          toggleEntry(entry);
        });

        if (selected.has(entry.key)) {
          tile.draggable = true;
          tile.addEventListener('dragstart', ev => {
            draggedEntry = entry;
            tile.classList.add('dragging');
            ev.dataTransfer?.setData('text/plain', entry.key);
            ev.dataTransfer.effectAllowed = 'move';
          });
          tile.addEventListener('dragend', () => {
            draggedEntry = null;
            tile.classList.remove('dragging');
            clearDropIndicators();
          });
        } else {
          tile.draggable = false;
        }

        tile.addEventListener('dragenter', ev => {
          if (!draggedEntry || draggedEntry === entry) return;
          ev.preventDefault();
          const before = isBeforeTarget(ev, tile);
          clearDropIndicators();
          tile.classList.add(before ? DROP_BEFORE : DROP_AFTER);
        });

        tile.addEventListener('dragover', ev => {
          if (!draggedEntry || draggedEntry === entry) return;
          ev.preventDefault();
          const before = isBeforeTarget(ev, tile);
          clearDropIndicators();
          tile.classList.add(before ? DROP_BEFORE : DROP_AFTER);
        });

        tile.addEventListener('dragleave', ev => {
          if (tile.contains(ev.relatedTarget)) return;
          tile.classList.remove(DROP_BEFORE, DROP_AFTER);
        });

        tile.addEventListener('drop', ev => {
          if (!draggedEntry || draggedEntry === entry) return;
          ev.preventDefault();
          const before = isBeforeTarget(ev, tile);
          clearDropIndicators();
          reorderEntries(draggedEntry, entry, before);
        });

        grid.appendChild(tile);
      });
    };

    if (!grid.dataset.dndBound) {
      grid.addEventListener('dragover', ev => {
        if (draggedEntry) ev.preventDefault();
      });
      grid.addEventListener('drop', ev => {
        if (draggedEntry) ev.preventDefault();
        draggedEntry = null;
        clearDropIndicators();
      });
      grid.dataset.dndBound = '1';
    }

    renderTiles();
    if (normalizedKey === 'left') {
      const layoutSelect = document.getElementById('layoutMode');
      if ((layoutSelect?.value === 'split' ? 'split' : 'single') !== 'split') {
        commitPlaylist();
      }
    }
  };

  // Schrift
  setV('#fontFamily', f.family ?? DEFAULTS.fonts.family);
  setV('#fontScale',  f.scale  ?? 1);
  setV('#h1Scale',    f.h1Scale ?? 1);
  setV('#h2Scale',    f.h2Scale ?? 1);
  setV('#tileTimeScale', f.tileMetaScale ?? 1);
  setC('#timeSuffixToggle', settings.slides?.appendTimeSuffix === true);
  setV('#tileFlameSizeScale', settings.slides?.tileFlameSizeScale ?? DEFAULTS.slides.tileFlameSizeScale ?? 1);
  setV('#tileFlameGapScale', settings.slides?.tileFlameGapScale ?? DEFAULTS.slides.tileFlameGapScale ?? 1);
  const saunaFlameControls = ['#tileFlameSizeScale', '#tileFlameGapScale'].map(sel => document.querySelector(sel));
  const saunaFlamesToggle = document.getElementById('saunaFlames');
  const saunaFlamesEnabled = (settings.slides?.showSaunaFlames !== false);
  setC('#saunaFlames', saunaFlamesEnabled);
  const applySaunaFlameState = (enabled) => { saunaFlameControls.forEach(el => { if (el) el.disabled = !enabled; }); };
  applySaunaFlameState(saunaFlamesEnabled);
  if (saunaFlamesToggle && !saunaFlamesToggle.dataset.bound) {
    saunaFlamesToggle.addEventListener('change', () => applySaunaFlameState(saunaFlamesToggle.checked));
    saunaFlamesToggle.dataset.bound = '1';
  }
  setC('#badgeInlineColumn', settings.slides?.badgeInlineColumn === true);
  setV('#chipOverflowMode', f.chipOverflowMode ?? 'scale');
  setV('#flamePct',         f.flamePct         ?? 55);
  setV('#flameGap',         f.flameGapScale    ?? 0.14);

  // H2
  setV('#h2Mode', settings.h2?.mode ?? DEFAULTS.h2.mode);
  setV('#h2Text', settings.h2?.text ?? DEFAULTS.h2.text);
  setC('#h2ShowOverview', (settings.h2?.showOnOverview ?? DEFAULTS.h2.showOnOverview));

  // Übersicht (Tabelle)
  setV('#ovTitleScale', f.overviewTitleScale ?? 1);
  setV('#ovHeadScale',  f.overviewHeadScale  ?? 0.9);
  setV('#ovCellScale',  f.overviewCellScale  ?? 0.8);
  setV('#ovTimeWidth',  f.overviewTimeWidthCh ?? DEFAULTS.fonts.overviewTimeWidthCh ?? 10);
  setV('#chipH',        Math.round((f.chipHeight ?? 1)*100));
  const overviewFlamesToggle = document.getElementById('overviewFlames');
  const overviewFlameControls = ['#flamePct', '#flameGap'].map(sel => document.querySelector(sel));
  const applyOverviewFlameState = (enabled) => {
    overviewFlameControls.forEach(el => { if (el) el.disabled = !enabled; });
  };
  const overviewFlamesEnabled = (f.overviewShowFlames !== false);
  setC('#overviewFlames', overviewFlamesEnabled);
  applyOverviewFlameState(overviewFlamesEnabled);
  if (overviewFlamesToggle && !overviewFlamesToggle.dataset.bound){
    overviewFlamesToggle.addEventListener('change', () => applyOverviewFlameState(overviewFlamesToggle.checked));
    overviewFlamesToggle.dataset.bound = '1';
  }

  // Saunafolien (Kacheln)
  setV('#tileTextScale', f.tileTextScale ?? 0.8);
  setV('#tileWeight',    f.tileWeight    ?? 600);
  setV('#tilePct',       settings.slides?.tileWidthPercent ?? 45);
  setV('#tileMin',       settings.slides?.tileMinScale ?? 0.25);
  setV('#tileMax',       settings.slides?.tileMaxScale ?? 0.57);
  setV('#saunaHeadingWidth', settings.slides?.saunaTitleMaxWidthPercent ?? DEFAULTS.slides.saunaTitleMaxWidthPercent ?? 100);
  setV('#tileHeightScale', settings.slides?.tileHeightScale ?? DEFAULTS.slides.tileHeightScale ?? 1);
  setV('#tilePaddingScale', settings.slides?.tilePaddingScale ?? DEFAULTS.slides.tilePaddingScale ?? 0.75);
  setV('#badgeScale', settings.slides?.badgeScale ?? DEFAULTS.slides.badgeScale ?? 1);
  setV('#badgeDescriptionScale', settings.slides?.badgeDescriptionScale ?? DEFAULTS.slides.badgeDescriptionScale ?? 1);
  const overlayCheckbox = document.getElementById('tileOverlayEnabled');
  const overlayInput = document.getElementById('tileOverlayStrength');
  const overlayEnabled = (settings.slides?.tileOverlayEnabled !== false);
  setC('#tileOverlayEnabled', overlayEnabled);
  const overlayPct = (() => {
    const raw = settings.slides?.tileOverlayStrength;
    if (!Number.isFinite(+raw)) return 100;
    return Math.round(Math.max(0, +raw) * 100);
  })();
  setV('#tileOverlayStrength', overlayPct);
  const applyOverlayState = (enabled) => { if (overlayInput) overlayInput.disabled = !enabled; };
  applyOverlayState(overlayEnabled);
  if (overlayCheckbox && !overlayCheckbox.dataset.bound) {
    overlayCheckbox.addEventListener('change', () => applyOverlayState(overlayCheckbox.checked));
    overlayCheckbox.dataset.bound = '1';
  }
  const badgeColor = settings.slides?.infobadgeColor || settings.theme?.accent || DEFAULTS.slides.infobadgeColor;
  setV('#badgeColor', badgeColor);

  // Bildspalte / Schrägschnitt
  setV('#rightW',   settings.display?.rightWidthPercent ?? 38);
  setV('#cutTop',   settings.display?.cutTopPercent ?? 28);
  setV('#cutBottom',settings.display?.cutBottomPercent ?? 12);

  const display = settings.display || {};
  const pages = display.pages || {};
  const leftCfg = pages.left || {};
  const rightCfg = pages.right || {};
  const layoutMode = (display.layoutMode === 'split') ? 'split' : 'single';
  setV('#layoutMode', layoutMode);
  setV('#pageLeftTimer', leftCfg.timerSec ?? '');
  setV('#pageRightTimer', rightCfg.timerSec ?? '');
  renderPagePlaylist('pageLeftPlaylist', leftCfg.playlist, { pageKey: 'left' });
  renderPagePlaylist('pageRightPlaylist', rightCfg.playlist, { pageKey: 'right' });
  const layoutModeSelect = document.getElementById('layoutMode');
  const applyLayoutVisibility = (mode) => {
    const rightWrap = document.getElementById('layoutRight');
    if (rightWrap) rightWrap.hidden = (mode !== 'split');
  };
  applyLayoutVisibility(layoutMode);
  if (layoutModeSelect) {
    layoutModeSelect.onchange = () => applyLayoutVisibility(layoutModeSelect.value === 'split' ? 'split' : 'single');
  }

  const layoutProfileSelect = document.getElementById('layoutProfile');
  if (layoutProfileSelect) {
    const profile = settings.display?.layoutProfile || DEFAULTS.display?.layoutProfile || 'landscape';
    layoutProfileSelect.value = profile;
    layoutProfileSelect.onchange = () => {
      settings.display = settings.display || {};
      settings.display.layoutProfile = layoutProfileSelect.value;
      notifySettingsChanged();
    };
  }

  renderStyleAutomationControls();
  renderExtrasEditor();
  renderHeroTimelineControls();

  // Reset-Button (nur Felder dieser Box)
  const reset = document.querySelector('#resetSlides');
  if (!reset) return;
  reset.onclick = ()=>{
    setV('#fontFamily', DEFAULTS.fonts.family);
    setV('#fontScale', 1);
    setV('#h1Scale', 1);
    setV('#h2Scale', 1);
    setV('#tileTimeScale', DEFAULTS.fonts.tileMetaScale);

    setV('#h2Mode', DEFAULTS.h2.mode);
    setV('#h2Text', DEFAULTS.h2.text);
    setC('#h2ShowOverview', DEFAULTS.h2.showOnOverview);

    setV('#ovTitleScale', DEFAULTS.fonts.overviewTitleScale);
    setV('#ovHeadScale',  DEFAULTS.fonts.overviewHeadScale);
    setV('#ovCellScale',  DEFAULTS.fonts.overviewCellScale);
    setV('#ovTimeWidth',  DEFAULTS.fonts.overviewTimeWidthCh);
    setV('#chipH',        Math.round(DEFAULTS.fonts.chipHeight*100));
    setV('#chipOverflowMode', DEFAULTS.fonts.chipOverflowMode);
    setV('#flamePct',         DEFAULTS.fonts.flamePct);
    setV('#flameGap',         DEFAULTS.fonts.flameGapScale);
    setC('#overviewFlames',   DEFAULTS.fonts.overviewShowFlames);
    applyOverviewFlameState(DEFAULTS.fonts.overviewShowFlames);

    setV('#tileTextScale', DEFAULTS.fonts.tileTextScale);
    setV('#tileWeight',    DEFAULTS.fonts.tileWeight);
    setV('#tilePct',       DEFAULTS.slides.tileWidthPercent);
    setV('#tileMin',       DEFAULTS.slides.tileMinScale);
    setV('#tileMax',       DEFAULTS.slides.tileMaxScale);
    setV('#tileFlameSizeScale', DEFAULTS.slides.tileFlameSizeScale);
    setV('#tileFlameGapScale', DEFAULTS.slides.tileFlameGapScale);
    setV('#saunaHeadingWidth', DEFAULTS.slides.saunaTitleMaxWidthPercent);
    setV('#tileHeightScale', DEFAULTS.slides.tileHeightScale);
    setV('#tilePaddingScale', DEFAULTS.slides.tilePaddingScale);
    setV('#badgeScale',    DEFAULTS.slides.badgeScale);
    setV('#badgeDescriptionScale', DEFAULTS.slides.badgeDescriptionScale);
    setC('#saunaFlames', DEFAULTS.slides.showSaunaFlames !== false);
    applySaunaFlameState(DEFAULTS.slides.showSaunaFlames !== false);
    setC('#badgeInlineColumn', DEFAULTS.slides.badgeInlineColumn === true);
    setV('#badgeColor',    DEFAULTS.slides.infobadgeColor);
    setC('#tileOverlayEnabled', DEFAULTS.slides.tileOverlayEnabled);
    setV('#tileOverlayStrength', Math.round((DEFAULTS.slides.tileOverlayStrength ?? 1) * 100));
    applyOverlayState(DEFAULTS.slides.tileOverlayEnabled !== false);

    setV('#rightW',   DEFAULTS.display.rightWidthPercent);
    setV('#cutTop',   DEFAULTS.display.cutTopPercent);
    setV('#cutBottom',DEFAULTS.display.cutBottomPercent);
    setV('#layoutMode', DEFAULTS.display.layoutMode || 'single');
    const defLeft = DEFAULTS.display.pages?.left || {};
    const defRight = DEFAULTS.display.pages?.right || {};
    setV('#pageLeftTimer', defLeft.timerSec ?? '');
    setV('#pageRightTimer', defRight.timerSec ?? '');
    const defLeftPlaylist = sanitizePagePlaylist(defLeft.playlist);
    const defRightPlaylist = sanitizePagePlaylist(defRight.playlist);
    const displayCfg = settings.display = settings.display || {};
    const pagesCfg = displayCfg.pages = displayCfg.pages || {};
    const leftState = pagesCfg.left = pagesCfg.left || {};
    const rightState = pagesCfg.right = pagesCfg.right || {};
    leftState.contentTypes = Array.isArray(defLeft.contentTypes) ? defLeft.contentTypes.slice() : [];
    rightState.contentTypes = Array.isArray(defRight.contentTypes) ? defRight.contentTypes.slice() : [];
    leftState.playlist = defLeftPlaylist;
    rightState.playlist = defRightPlaylist;
    renderPagePlaylist('pageLeftPlaylist', defLeftPlaylist, { pageKey: 'left' });
    renderPagePlaylist('pageRightPlaylist', defRightPlaylist, { pageKey: 'right' });
    applyLayoutVisibility(DEFAULTS.display.layoutMode || 'single');
  };
}

// ============================================================================
// 3) Highlights & Flames (rechte Box „Slideshow & Text“ – unterer Teil)
// ============================================================================
function renderHighlightBox(){
  const hl = settings.highlightNext || DEFAULTS.highlightNext;

  $('#hlEnabled').checked = !!hl.enabled;
  $('#hlColor').value     = hl.color || DEFAULTS.highlightNext.color;
  $('#hlBefore').value    = Number.isFinite(+hl.minutesBeforeNext) ? hl.minutesBeforeNext : DEFAULTS.highlightNext.minutesBeforeNext;
  $('#hlAfter').value     = Number.isFinite(+hl.minutesAfterStart) ? hl.minutesAfterStart  : DEFAULTS.highlightNext.minutesAfterStart;

  const setSw = ()=> $('#hlSw').style.background = $('#hlColor').value;
  setSw();
  $('#hlColor').addEventListener('input',()=>{
    if(/^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)) setSw();
  });

  // Flammenbild
  $('#flameImg').value = settings.assets?.flameImage || DEFAULTS.assets.flameImage;
  const flameTf = settings.assets?.flameThumbFallback;
  updateFlamePreview(flameTf ? THUMB_FALLBACK : $('#flameImg').value);

  $('#flameFile').onchange = ()=> uploadGeneric($('#flameFile'), (p, tp)=>{
    settings.assets = settings.assets || {};
    settings.assets.flameImage = p;
    settings.assets.flameThumbFallback = (tp === THUMB_FALLBACK);
    $('#flameImg').value = p;
    updateFlamePreview(tp);
  });

  $('#resetFlame').onclick = ()=>{
    const def = DEFAULTS.assets.flameImage;
    settings.assets = settings.assets || {};
    settings.assets.flameImage = def;
    settings.assets.flameThumbFallback = false;
    $('#flameImg').value = def;
    updateFlamePreview(def);
  };
}

function updateFlamePreview(u){
  const img = $('#flamePrev');
  preloadImg(u).then(r=>{
    if(r.ok){ img.src = u; img.title = r.w+'×'+r.h; }
    else { img.removeAttribute('src'); img.title = ''; }
  });
}

// ============================================================================
// 4) Farben-Panel
// ============================================================================
function colorField(key,label,init){
  const valUp = String(init||'').toUpperCase();
  const valLow = valUp.toLowerCase();
  const row=document.createElement('div');
  row.className='kv';
  row.innerHTML = `
    <label>${label}</label>
    <div class="color-item">
      <div class="swatch" id="sw_${key}"></div>
      <input class="input" id="cl_${key}" type="text" value="${valUp}" placeholder="#RRGGBB">
      <input type="color" id="cp_${key}" value="${valLow}">
      <button class="btn sm ghost icon undo" type="button" title="Letzten Wert zurücksetzen" aria-label="Letzten Wert zurücksetzen">⟳</button>
    </div>`;
  return row;
}

function renderColors(){
ensureColorTools();
const host = $('#colorList');
  if (!host) return;
  host.innerHTML = '';
  const theme = settings.theme || {};

  // Grundfarben
  const A=document.createElement('div'); A.className='fieldset'; A.innerHTML='<div class="legend">Grundfarben</div>';
  A.appendChild(colorField('bg','Hintergrund', theme.bg||DEFAULTS.theme.bg));
  A.appendChild(colorField('fg','Vordergrund/Schrift', theme.fg||DEFAULTS.theme.fg));
  A.appendChild(colorField('accent','Akzent', theme.accent||DEFAULTS.theme.accent));

  // Übersichtstabelle
  const B=document.createElement('div'); B.className='fieldset'; B.innerHTML='<div class="legend">Übersichtstabelle</div>';
  B.appendChild(colorField('gridTable','Tabellenrahmen (nur Übersicht)', theme.gridTable||theme.gridBorder||DEFAULTS.theme.gridTable||DEFAULTS.theme.gridBorder));
  const bw=document.createElement('div'); bw.className='kv';
  bw.innerHTML='<label>Tabellenrahmen Breite (px)</label><input id="bw_gridTableW" class="input" type="number" min="0" max="10" step="1" value="'+(Number.isFinite(+theme.gridTableW)?theme.gridTableW:DEFAULTS.theme.gridTableW)+'">';
  B.appendChild(bw);
  B.appendChild(colorField('headRowBg','Kopfzeile Hintergrund', theme.headRowBg||DEFAULTS.theme.headRowBg));
  B.appendChild(colorField('headRowFg','Kopfzeile Schrift', theme.headRowFg||DEFAULTS.theme.headRowFg));
  B.appendChild(colorField('zebra1','Zebra (Inhalt) 1', theme.zebra1||DEFAULTS.theme.zebra1));
  B.appendChild(colorField('zebra2','Zebra (Inhalt) 2', theme.zebra2||DEFAULTS.theme.zebra2));
  B.appendChild(colorField('timeZebra1','Zeitspalte Zebra 1', theme.timeZebra1||DEFAULTS.theme.timeZebra1));
  B.appendChild(colorField('timeZebra2','Zeitspalte Zebra 2', theme.timeZebra2||DEFAULTS.theme.timeZebra2));
  B.appendChild(colorField('cornerBg','Ecke (oben-links) BG', theme.cornerBg||DEFAULTS.theme.cornerBg));
  B.appendChild(colorField('cornerFg','Ecke (oben-links) FG', theme.cornerFg||DEFAULTS.theme.cornerFg));

  // Saunafolien & Flammen
  const C=document.createElement('div'); C.className='fieldset'; C.innerHTML='<div class="legend">Sauna-Folien & Flammen</div>';
  C.appendChild(colorField('cellBg','Kachel-Hintergrund', theme.cellBg||DEFAULTS.theme.cellBg));
  C.appendChild(colorField('boxFg','Kachel-Schrift', theme.boxFg||DEFAULTS.theme.boxFg));
  C.appendChild(colorField('saunaColor','Sauna-Überschrift', theme.saunaColor||DEFAULTS.theme.saunaColor));
  C.appendChild(colorField('tileBorder','Kachel-Rahmen (nur Kacheln)', theme.tileBorder||theme.gridBorder||DEFAULTS.theme.tileBorder||DEFAULTS.theme.gridBorder));
  C.appendChild(colorField('flame','Flammen', theme.flame||DEFAULTS.theme.flame));

  host.appendChild(A); host.appendChild(B); host.appendChild(C);

  // Swatch-Vorschau & Synchronisation
  $$('#colorList .color-item').forEach(item=>{
    const txt = item.querySelector('input[type="text"]');
    const pick = item.querySelector('input[type="color"]');
    const sw = item.querySelector('.swatch');
    const undo = item.querySelector('.undo');
    const setVal = v=>{
      const hex = v.startsWith('#') ? v : '#'+v;
      if(!/^#([0-9A-Fa-f]{6})$/.test(hex)) return;
      sw.style.background = hex;
      pick.value = hex.toLowerCase();
      txt.value = hex.toUpperCase();
    };
    setVal(txt.value);
    item.dataset.prev = txt.value;
    txt.addEventListener('input',()=>{
      txt.value = txt.value.toUpperCase();
      if(/^#([0-9A-F]{6})$/.test(txt.value)) setVal(txt.value);
    });
    pick.addEventListener('input',()=> setVal(pick.value));
    if(undo){
      undo.addEventListener('click',()=>{
        const prev = item.dataset.prev;
        if(!prev) return;
        setVal(prev);
        item.dataset.prev = prev;
      });
      [txt,pick].forEach(el=>{
        el.addEventListener('keydown',e=>{
          if((e.ctrlKey||e.metaKey) && e.key==='z'){
            e.preventDefault();
            undo.click();
          }
        });
      });
    }
  });

  $('#resetColors').onclick = ()=>{
    $$('#colorList .color-item').forEach(item=>{
      const txt = item.querySelector('input[type="text"]');
      const pick = item.querySelector('input[type="color"]');
      const k = txt.id.replace(/^cl_/,'');
      const def = DEFAULTS.theme[k]||'#FFFFFF';
      txt.value = def;
      pick.value = def;
      const sw = item.querySelector('.swatch'); if(sw) sw.style.background=def;
    });
    const bws=document.getElementById('bw_gridTableW');
    if(bws) bws.value = DEFAULTS.theme.gridTableW ?? 2;
  };
}

function ensureColorTools(){
  const host = document.getElementById('colorList');
  if (!host) return;
  if (document.getElementById('colorToolsLink')) return; // schon da

  const link = document.createElement('a');
  link.id = 'colorToolsLink';
  link.href = 'https://colorhunt.co';
  link.target = '_blank';
  link.textContent = 'Colorhunt öffnen';

  // hinter die Farbliste setzen
  host.after(link);
}

// ============================================================================
// 5) Fußnoten
// ============================================================================
function renderFootnotes(){
  const host=$('#fnList'); if (!host) return;
  const section = $('#footnoteSection');
  const toggle = $('#footnoteToggle');
  const body = $('#footnoteBody');

  const getExpanded = () => !!(toggle && toggle.getAttribute('aria-expanded') === 'true');
  const setExpanded = (expanded) => {
    const isExpanded = !!expanded;
    if (toggle){ toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false'); }
    if (body){ body.setAttribute('aria-hidden', isExpanded ? 'false' : 'true'); }
    if (section){ section.classList.toggle('is-open', isExpanded); }
  };

  if (toggle && !toggle.dataset.bound){
    toggle.dataset.bound = '1';
    toggle.addEventListener('click', () => {
      setExpanded(!getExpanded());
    });
  }

  const forceOpen = (body && body.dataset.forceOpen === '1');
  if (body) delete body.dataset.forceOpen;
  setExpanded(forceOpen ? true : getExpanded());

  host.innerHTML='';
  const layoutSel = document.getElementById('footnoteLayout');
  if (layoutSel){ layoutSel.value = settings.footnoteLayout || 'one-line'; layoutSel.onchange = ()=>{ settings.footnoteLayout = layoutSel.value; }; }
  const list = settings.footnotes || [];
  if (section) section.classList.toggle('has-items', list.length > 0);
  list.forEach((fn,i)=> host.appendChild(fnRow(fn,i)));
  $('#fnAdd').onclick=()=>{
    (settings.footnotes ||= []).push({id:genId(), label:'*', text:''});
    if (body) body.dataset.forceOpen = '1';
    renderFootnotes();
  };
}

function fnRow(fn,i){
  const wrap=document.createElement('div'); wrap.className='kv';
  wrap.innerHTML = `
    <label>Label/Text</label>
    <div class="row" style="gap:8px;flex-wrap:nowrap">
      <input class="input" id="fn_l_${i}" value="${fn.label||'*'}" style="width:6ch"/>
      <input class="input" id="fn_t_${i}" value="${fn.text||''}" style="min-width:0"/>
      <button class="btn sm" id="fn_x_${i}">✕</button>
    </div>`;
  wrap.querySelector(`#fn_l_${i}`).onchange=(e)=>{ fn.label = (e.target.value||'*').slice(0,2); };
  wrap.querySelector(`#fn_t_${i}`).onchange=(e)=>{ fn.text = e.target.value||''; };
  wrap.querySelector(`#fn_x_${i}`).onclick=()=>{ settings.footnotes.splice(i,1); renderFootnotes(); };
  return wrap;
}

// ============================================================================
// 6) Speichern / Preview / Export / Import
// ============================================================================
function collectColors(){ 
  const theme={...(settings.theme||{})};
  $$('#colorList input[type="text"]').forEach(inp=>{
    const v=String(inp.value).toUpperCase();
    if(/^#([0-9A-F]{6})$/.test(v)) theme[inp.id.replace(/^cl_/,'')]=v;
  });
  const bw=document.getElementById('bw_gridTableW');
  if(bw) theme.gridTableW = Math.max(0, Math.min(10, +bw.value||0));
  return theme;
}

function collectSettings(){
  const sanitizeTimer = (val) => {
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? Math.max(1, Math.round(num)) : null;
  };
  const clamp = (min, val, max) => Math.min(Math.max(val, min), max);
  const getExistingSource = (pageState, fallback) => {
    const raw = pageState?.source;
    if (raw && PAGE_SOURCE_KEYS.includes(raw)) return raw;
    return PAGE_SOURCE_KEYS.includes(fallback) ? fallback : 'master';
  };
  const collectPlaylist = (pageState) => {
    const sanitized = sanitizePagePlaylist(pageState?.playlist);
    return sanitized.map(entry => ({ ...entry }));
  };
  const getContentTypes = (pageState, defaults) => {
    const list = Array.isArray(pageState?.contentTypes) ? pageState.contentTypes.filter(type => PAGE_CONTENT_TYPE_KEYS.has(type)) : [];
    if (list.length) return Array.from(new Set(list));
    const fallback = Array.isArray(defaults?.contentTypes) ? defaults.contentTypes : [];
    return fallback.slice();
  };
  settings.presets ||= {};
  settings.presets[getActiveDayKey()] = deepClone(schedule);
  return {
    schedule: { ...schedule },
    settings: {
      ...settings,
      footnoteLayout: document.getElementById('footnoteLayout')?.value || settings.footnoteLayout || 'one-line',
      fonts:{
        family: $('#fontFamily').value,
        scale: +($('#fontScale')?.value||1),
        h1Scale:+($('#h1Scale').value||1),
        h2Scale:+($('#h2Scale').value||1),
        overviewTitleScale:+($('#ovTitleScale').value||1),
        overviewHeadScale:+($('#ovHeadScale').value||0.9),
        overviewCellScale:+($('#ovCellScale').value||0.8),
        overviewTimeWidthCh:(() => {
          const raw = Number($('#ovTimeWidth')?.value);
          if (!Number.isFinite(raw)) return settings.fonts?.overviewTimeWidthCh ?? DEFAULTS.fonts.overviewTimeWidthCh ?? 10;
          return clamp(6, raw, 24);
        })(),
        chipHeight:(+($('#chipH').value||100)/100),
        chipOverflowMode: ($('#chipOverflowMode')?.value || 'scale'),
        flamePct:   +($('#flamePct')?.value || 55),
        flameGapScale:+($('#flameGap')?.value || 0.14),
        overviewShowFlames: !!$('#overviewFlames')?.checked,
        tileTextScale:+($('#tileTextScale').value||0.8),
        tileWeight:+($('#tileWeight').value||600),
        tileMetaScale:(() => {
          const raw = Number($('#tileTimeScale')?.value);
          if (!Number.isFinite(raw)) return settings.fonts?.tileMetaScale ?? DEFAULTS.fonts.tileMetaScale ?? 1;
          return clamp(0.5, raw, 2);
        })()
      },
      h2:{
        mode: $('#h2Mode').value || 'text',
        text: ($('#h2Text').value ?? '').trim(),
        showOnOverview: !!$('#h2ShowOverview').checked
      },
      slides:{
        ...(settings.slides||{}),
        tileWidthPercent:+($('#tilePct')?.value || 45),
        tileMinScale:+($('#tileMin')?.value || 0.25),
        tileMaxScale:+($('#tileMax')?.value || 0.57),
        tileFlameSizeScale:(() => {
          const raw = Number($('#tileFlameSizeScale')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.tileFlameSizeScale ?? DEFAULTS.slides.tileFlameSizeScale ?? 1;
          return clamp(0.4, raw, 3);
        })(),
        tileFlameGapScale:(() => {
          const raw = Number($('#tileFlameGapScale')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.tileFlameGapScale ?? DEFAULTS.slides.tileFlameGapScale ?? 1;
          return clamp(0, raw, 3);
        })(),
        tileHeightScale:(() => {
          const raw = Number($('#tileHeightScale')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.tileHeightScale ?? DEFAULTS.slides.tileHeightScale ?? 1;
          return clamp(0.5, raw, 2);
        })(),
        tilePaddingScale:(() => {
          const raw = Number($('#tilePaddingScale')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.tilePaddingScale ?? DEFAULTS.slides.tilePaddingScale ?? 0.75;
          return clamp(0.25, raw, 1.5);
        })(),
        appendTimeSuffix: !!document.getElementById('timeSuffixToggle')?.checked,
        saunaTitleMaxWidthPercent:(() => {
          const raw = Number($('#saunaHeadingWidth')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.saunaTitleMaxWidthPercent ?? DEFAULTS.slides.saunaTitleMaxWidthPercent ?? 100;
          return clamp(10, raw, 100);
        })(),
        badgeScale:(() => {
          const raw = Number($('#badgeScale')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.badgeScale ?? DEFAULTS.slides.badgeScale ?? 1;
          return clamp(0.3, raw, 3);
        })(),
        badgeDescriptionScale:(() => {
          const raw = Number($('#badgeDescriptionScale')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.badgeDescriptionScale ?? DEFAULTS.slides.badgeDescriptionScale ?? 1;
          return clamp(0.3, raw, 3);
        })(),
        badgeInlineColumn: !!document.getElementById('badgeInlineColumn')?.checked,
        infobadgeColor:(() => {
          const el = document.getElementById('badgeColor');
          const fallback = settings.slides?.infobadgeColor || settings.theme?.accent || DEFAULTS.slides.infobadgeColor || '#5C3101';
          const current = (typeof fallback === 'string' ? fallback.toUpperCase() : '#5C3101');
          const raw = el?.value || '';
          return /^#([0-9A-F]{6})$/i.test(raw) ? raw.toUpperCase() : current;
        })(),
        tileOverlayEnabled: !!$('#tileOverlayEnabled')?.checked,
        tileOverlayStrength:(() => {
          const raw = Number($('#tileOverlayStrength')?.value);
          if (!Number.isFinite(raw)) return settings.slides?.tileOverlayStrength ?? DEFAULTS.slides.tileOverlayStrength ?? 1;
          return clamp(0, raw, 200) / 100;
        })(),
        showSaunaFlames: !!$('#saunaFlames')?.checked,
        badgeLibrary: (() => {
          const sanitized = sanitizeBadgeLibrary(settings.slides?.badgeLibrary, { assignMissingIds: true });
          (settings.slides ||= {}).badgeLibrary = sanitized;
          return sanitized;
        })(),
        styleAutomation: deepClone(settings.slides?.styleAutomation || {}),
        showOverview: !!document.getElementById('ovShow')?.checked,
        overviewDurationSec: (() => {
        const el = document.getElementById('ovSec') || document.getElementById('ovSecGlobal');
        const fallback = settings?.slides?.overviewDurationSec ?? (DEFAULTS?.slides?.overviewDurationSec ?? 10);
        const v = el?.value;
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(1, Math.min(120, n)) : fallback;
        })(),
        transitionMs: +(document.getElementById('transMs2')?.value || 500),
        durationMode: (document.querySelector('input[name=durMode]:checked')?.value || 'uniform'),
        globalDwellSec: +(document.getElementById('dwellAll')?.value || 6),
        heroEnabled: !!document.getElementById('heroTimelineEnabled')?.checked,
        heroTimelineFillMs: (() => {
          const el = document.getElementById('heroTimelineDuration');
          const fallback = settings?.slides?.heroTimelineFillMs ?? (DEFAULTS?.slides?.heroTimelineFillMs ?? 8000);
          const raw = Number(el?.value);
          if (!Number.isFinite(raw) || raw <= 0) return Math.max(1000, Math.round(fallback));
          return Math.max(1, Math.round(raw)) * 1000;
        })(),
        heroTimelineBaseMinutes: (() => {
          const el = document.getElementById('heroTimelineBase');
          const fallback = settings?.slides?.heroTimelineBaseMinutes ?? (DEFAULTS?.slides?.heroTimelineBaseMinutes ?? 15);
          const raw = Number(el?.value);
          if (!Number.isFinite(raw) || raw <= 0) return Math.max(1, Math.round(fallback));
          return Math.max(1, Math.round(raw));
        })(),
        heroTimelineMaxEntries: (() => {
          const el = document.getElementById('heroTimelineMax');
          if (!el) return settings.slides?.heroTimelineMaxEntries ?? null;
          const raw = el.value;
          if (raw == null || String(raw).trim() === '') return null;
          const num = Number(raw);
          if (!Number.isFinite(num) || num <= 0) return null;
          return Math.max(1, Math.floor(num));
        })(),
        heroTimelineWaitForScroll: !!document.getElementById('heroTimelineWaitForScroll')?.checked
      },
      theme: collectColors(),
      highlightNext:{
        enabled: $('#hlEnabled').checked,
        color: /^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)? $('#hlColor').value.toUpperCase() : (settings.highlightNext?.color || DEFAULTS.highlightNext.color),
        minutesBeforeNext: +( $('#hlBefore').value || DEFAULTS.highlightNext.minutesBeforeNext ),
        minutesAfterStart: +( $('#hlAfter').value || DEFAULTS.highlightNext.minutesAfterStart )
      },
      assets:{ ...(settings.assets||{}), flameImage: $('#flameImg').value || DEFAULTS.assets.flameImage },
      display:{
        ...(settings.display||{}),
        fit: 'auto',
        baseW:1920,
        baseH:1080,
        rightWidthPercent:+($('#rightW').value||38),
        cutTopPercent:+($('#cutTop').value||28),
        cutBottomPercent:+($('#cutBottom').value||12),
        layoutMode:(document.getElementById('layoutMode')?.value === 'split') ? 'split' : 'single',
        layoutProfile: document.getElementById('layoutProfile')?.value || settings.display?.layoutProfile || DEFAULTS.display?.layoutProfile || 'landscape',
        pages:{
          left:{
            ...(((settings.display||{}).pages||{}).left||{}),
            source:getExistingSource(((settings.display||{}).pages||{}).left, DEFAULTS.display?.pages?.left?.source || 'master'),
            timerSec:sanitizeTimer(document.getElementById('pageLeftTimer')?.value),
            contentTypes:getContentTypes(((settings.display||{}).pages||{}).left, DEFAULTS.display?.pages?.left),
            playlist:collectPlaylist(((settings.display||{}).pages||{}).left)
          },
          right:{
            ...(((settings.display||{}).pages||{}).right||{}),
            source:getExistingSource(((settings.display||{}).pages||{}).right, DEFAULTS.display?.pages?.right?.source || 'media'),
            timerSec:sanitizeTimer(document.getElementById('pageRightTimer')?.value),
            contentTypes:getContentTypes(((settings.display||{}).pages||{}).right, DEFAULTS.display?.pages?.right),
            playlist:collectPlaylist(((settings.display||{}).pages||{}).right)
          }
        }
      },
      footnotes: settings.footnotes,
      extras: deepClone(settings.extras || {}),
      interstitials: (settings.interstitials || []).map(({after, afterRef, ...rest}) => rest),
      presets: settings.presets || {},
      presetAuto: !!document.getElementById('presetAuto')?.checked
    }
  };
}

// Buttons: Open / Preview / Save
$('#btnOpen')?.addEventListener('click', ()=> window.open(SLIDESHOW_ORIGIN + '/', '_blank'));

$('#btnSave')?.addEventListener('click', async ()=>{
  const body = collectSettings();

  const ctx = getDeviceContext();
  if (!ctx.id){
    // Global speichern
    body.schedule.version = (Date.now()/1000|0);
    body.settings.version = (Date.now()/1000|0);
    try {
      await fetchJson('/admin/api/save.php', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
        expectOk: true
      });
      baseSchedule = deepClone(schedule);
      baseSettings = deepClone(settings);
      deviceContextState.setBaseState(baseSchedule, baseSettings);
      deviceContextState.clearDeviceBaseState();
      updateBaseline(baseSchedule, baseSettings);
      clearDraftsIfPresent();
      setUnsavedState(false);
      alert('Gespeichert (Global).');
    } catch (error) {
      console.error('[admin] Speichern (global) fehlgeschlagen', error);
      alert('Fehler: ' + error.message);
    }
  } else {
    // Geräte-Override speichern
    const payload = { device: ctx.id, settings: body.settings, schedule: body.schedule };
    try {
      await fetchJson('/admin/api/devices_save_override.php', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        expectOk: true
      });
      deviceBaseSchedule = deepClone(schedule);
      deviceBaseSettings = deepClone(settings);
      deviceContextState.setDeviceBaseState(deviceBaseSchedule, deviceBaseSettings);
      updateBaseline(deviceBaseSchedule, deviceBaseSettings);
      clearDraftsIfPresent();
      setUnsavedState(false);
      alert('Gespeichert für Gerät: ' + (ctx.name || ctx.id));
    } catch (error) {
      console.error('[admin] Speichern (Gerät) fehlgeschlagen', error);
      alert('Fehler: ' + error.message);
    }
  }
  });

// --- Dock ----------------------------------------------------------
let _dockTimer = 0;
let dockLiveActive = false;

function dockPushDebounced(){
  if (!dockLiveActive) return;
  clearTimeout(_dockTimer);
  _dockTimer = setTimeout(()=>{
    if (!dockLiveActive) return;
    dockSend(false);
  }, 250);
}
window.dockPushDebounced = dockPushDebounced;
function dockSend(reload){
  const frame = document.getElementById('dockPane')?.querySelector('#dockFrame');
  if (!frame || !frame.contentWindow) return;
  const payload = collectSettings();
  if (reload){
    try { frame.contentWindow.location.reload(); } catch {}
    setTimeout(()=> { try { frame.contentWindow.postMessage({type:'preview', payload}, SLIDESHOW_ORIGIN); } catch {} }, 350);
    return;
  }
  try { frame.contentWindow.postMessage({type:'preview', payload}, SLIDESHOW_ORIGIN); } catch {}
}
function attachDockLivePush(){
  dockLiveActive = true;
}
function detachDockLivePush(){
  dockLiveActive = false;
  clearTimeout(_dockTimer);
}

ensureUnsavedChangeListener();


// --- Devices: Claim ----------------------------------------------------------
async function claim(codeFromUI, nameFromUI) {
  const code = (codeFromUI || '').trim().toUpperCase();
  const name = (nameFromUI || '').trim() || ('Display ' + code.slice(-3));
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    alert('Bitte einen 6-stelligen Code eingeben.'); return;
  }
  let response;
  try {
    response = await claimDevice(code, name);
  } catch (error) {
    console.error('[admin] Pairing fehlgeschlagen', error);
    alert('Fehler: ' + error.message);
    return;
  }

  // kleine Quality-of-life Info:
  if (response.deviceId) {
    const url = SLIDESHOW_ORIGIN + '/?device=' + response.deviceId;
    console.log('Gepaart:', response.deviceId, url);
  }
  // Pane neu laden (siehe createDevicesPane -> render)
  await refreshDevicesPane({ bypassCache: true });
  alert('Gerät gekoppelt' + (response.already ? ' (war bereits gekoppelt)' : '') + '.');
}

async function createDevicesPane(){
  const host = document.querySelector('.leftcol');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'devicesPane';
  card.innerHTML = `
    <div class="content">
      <div class="card-head">
        <div class="card-title">Geräte</div>
        <div class="device-toolbar">
          <button class="btn sm icon-label" id="devPairManual"><span class="icon">⌨️</span><span class="label">Code eingeben…</span></button>
          <button class="btn sm icon-label has-meta" id="devRefresh"><span class="icon">⟳</span><span class="label-wrap"><span class="label">Aktualisieren</span><span class="meta" id="devLastUpdate" aria-live="polite"></span></span></button>
          <button class="btn sm danger icon-label" id="devGc"><span class="icon">🧹</span><span class="label">Aufräumen</span></button>
        </div>
      </div>

      <div id="devPendingWrap">
        <div class="subh">Ungepairt</div>
        <div id="devPendingList" class="kv"></div>
      </div>

      <div id="devPairedWrap" class="devices-section">
        <div class="subh">Gepaart</div>
        <div id="devPairedList" class="kv"></div>
      </div>

      <small class="mut">Tipp: Rufe auf dem TV die Standard-URL auf – es erscheint ein Pairing-Code. Codes werden nach 15 Minuten Inaktivität neu erzeugt.</small>
    </div>`;

  host?.insertBefore(card, host.firstChild);

  const formatRelativeSeconds = (seconds) => {
    if (!Number.isFinite(seconds)) return 'unbekannt';
    if (seconds < 45) return 'vor Sekunden';
    if (seconds < 3600) return `vor ${Math.round(seconds / 60)} min`;
    if (seconds < 86400) return `vor ${Math.round(seconds / 3600)} h`;
    return `vor ${Math.round(seconds / 86400)} Tagen`;
  };

  async function render(options = {}) {
    const { bypassCache = false } = options || {};
    const snapshot = await loadDeviceSnapshots({ bypassCache });
    const nowSeconds = resolveNowSeconds(snapshot?.now);

    const pendingHost = document.getElementById('devPendingList');
    if (pendingHost) {
      pendingHost.innerHTML = '';
      const pendings = Array.isArray(snapshot?.pairings)
        ? snapshot.pairings.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : [];
      if (!pendings.length) {
        pendingHost.innerHTML = '<div class="mut">Keine offenen Pairings.</div>';
      } else {
        pendings.forEach((entry) => {
          const row = document.createElement('div');
          row.className = 'pend-item';
          const createdAt = Number(entry.createdAt) || 0;
          const createdText = createdAt
            ? new Date(createdAt * 1000).toLocaleString('de-DE')
            : '—';
          row.innerHTML = `
            <div class="pill">Code: <b>${entry.code}</b></div>
            <div class="mut">seit ${createdText}</div>
            <button class="btn sm" data-code>Pairen…</button>
          `;
          row.querySelector('[data-code]')?.addEventListener('click', async () => {
            const name = prompt('Name des Geräts (z. B. „Foyer TV“):', '') || '';
            await claim(entry.code, name);
          });
          pendingHost.appendChild(row);
        });
      }
    }

    const pairedHost = document.getElementById('devPairedList');
    if (pairedHost) {
      pairedHost.innerHTML = '';
      const devices = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
      if (!devices.length) {
        pairedHost.innerHTML = '<div class="mut">Noch keine Geräte gekoppelt.</div>';
      } else {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        pairedHost.appendChild(table);
        const selectRow = (tr) => {
          tr.parentElement.querySelectorAll('tr').forEach((row) => row.classList.remove('selected'));
          tr.classList.add('selected');
        };

        const activeDeviceId = getDeviceContext().id;
        devices.forEach((device) => {
          const lastSeenAt = Number(device.lastSeenAt) || 0;
          const seenText = lastSeenAt
            ? new Date(lastSeenAt * 1000).toLocaleString('de-DE')
            : '—';
          const offline = !!device.offline;
          const useOverrides = !!device.useOverrides;
          const modeLabelText = useOverrides ? 'Individuell' : 'Global';
          const secondsAgo = (nowSeconds && lastSeenAt) ? Math.max(0, nowSeconds - lastSeenAt) : null;
          const heartbeatState = (() => {
            if (!Number.isFinite(secondsAgo)) return 'unknown';
            if (secondsAgo <= OFFLINE_AFTER_MIN * 60) return 'ok';
            if (secondsAgo <= OFFLINE_AFTER_MIN * 180) return 'warn';
            return 'crit';
          })();
          const relativeText = Number.isFinite(secondsAgo) ? formatRelativeSeconds(secondsAgo) : '';
          const heartbeatTime = lastSeenAt ? new Date(lastSeenAt * 1000) : null;
          const heartbeatLabel = lastSeenAt ? seenText : '';
          const heartbeatHtml = `<div class="dev-heartbeat" data-state="${heartbeatState}"><span class="dev-heartbeat-dot"></span><span>${offline ? 'offline' : 'online'}</span>${heartbeatTime ? ` <time datetime="${heartbeatTime.toISOString()}"${relativeText ? ` title="${relativeText}"` : ''}>${heartbeatLabel}</time>` : ''}</div>`;

          const row = document.createElement('tr');
          if (activeDeviceId === device.id) row.classList.add('current');
          if (useOverrides) row.classList.add('ind');
          if (offline) row.classList.add('offline');
          const lastSeenHtml = relativeText ? `<br><small class="mut">${relativeText}</small>` : '';
          const statusCell = `<td class="status ${offline ? 'offline' : 'online'}">${heartbeatHtml}${lastSeenHtml}</td>`;

          row.innerHTML = `
            <td><span class="dev-name" title="${device.id}">${device.name || device.id}</span></td>
            <td><button class="btn sm" data-view>Ansehen</button></td>
            <td><label class="toggle${useOverrides ? ' ind-active' : ''}" data-mode-wrap>
              <input type="checkbox" ${useOverrides ? 'checked' : ''} data-mode>
              <span data-mode-label>${modeLabelText}</span>
            </label></td>
            <td><button class="btn sm" data-edit>Im Editor bearbeiten</button></td>
            <td><button class="btn sm" data-rename>Umbenennen</button></td>
            <td><button class="btn sm ghost" data-url>URL kopieren</button></td>
            <td><button class="btn sm danger" data-unpair>Trennen…</button></td>
            ${statusCell}
          `;

          const modeInput = row.querySelector('[data-mode]');
          const modeLabel = row.querySelector('[data-mode-label]');
          const modeWrap = row.querySelector('[data-mode-wrap]');
          modeInput?.addEventListener('change', async () => {
            const desiredMode = !!modeInput.checked;
            const mode = desiredMode ? 'device' : 'global';
            modeLabel.textContent = desiredMode ? 'Individuell' : 'Global';
            row.classList.toggle('ind', desiredMode);
            modeWrap.classList.toggle('ind-active', desiredMode);
            try {
              await setDeviceMode(device.id, mode);
            } catch (error) {
              console.error('[admin] Geräte-Modus wechseln fehlgeschlagen', error);
              alert('Fehler: ' + error.message);
              modeInput.checked = !desiredMode;
              const rollback = !!modeInput.checked;
              modeLabel.textContent = rollback ? 'Individuell' : 'Global';
              row.classList.toggle('ind', rollback);
              modeWrap.classList.toggle('ind-active', rollback);
            }
          });

          row.querySelector('[data-unpair]')?.addEventListener('click', async () => {
            if (!/^dev_/.test(String(device.id))) {
              alert('Dieses Gerät hat eine alte/ungültige ID. Bitte ein neues Gerät koppeln und das alte ignorieren.');
              return;
            }
            const check = prompt('Wirklich trennen? Tippe „Ja“ zum Bestätigen:');
            if ((check || '').trim().toLowerCase() !== 'ja') return;
            try {
              await unpairDevice(device.id, { purge: true });
              alert('Gerät getrennt.');
              await render({ bypassCache: true });
            } catch (error) {
              console.error('[admin] Gerät trennen fehlgeschlagen', error);
              alert('Fehler: ' + error.message);
            }
          });

          row.querySelector('[data-view]')?.addEventListener('click', () => {
            selectRow(row);
            openDevicePreview(device.id, device.name || device.id);
          });
          row.querySelector('[data-url]')?.addEventListener('click', async () => {
            const url = SLIDESHOW_ORIGIN + '/?device=' + device.id;
            try {
              await navigator.clipboard.writeText(url);
              alert('URL kopiert:\n' + url);
            } catch {
              prompt('URL kopieren:', url);
            }
          });
          row.querySelector('[data-edit]')?.addEventListener('click', () => {
            selectRow(row);
            enterDeviceContext(device);
          });
          row.querySelector('[data-rename]')?.addEventListener('click', async () => {
            const newName = prompt('Neuer Gerätename:', device.name || '');
            if (newName === null) return;
            try {
              await renameDevice(device.id, newName);
              alert('Name gespeichert.');
              await render({ bypassCache: true });
            } catch (error) {
              console.error('[admin] Gerät umbenennen fehlgeschlagen', error);
              alert('Fehler: ' + error.message);
            }
          });
          tbody.appendChild(row);
        });
      }
    }

    const ts = card.querySelector('#devLastUpdate');
    if (ts) {
      const tsSeconds = nowSeconds || resolveNowSeconds(Date.now());
      const tsDate = new Date(tsSeconds * 1000);
      ts.textContent = tsDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      ts.title = 'Stand: ' + tsDate.toLocaleString('de-DE');
    }
  }

  card.querySelector('#devPairManual')?.addEventListener('click', async () => {
    const code = prompt('Pairing-Code (6 Zeichen):', '');
    if (!code) return;
    const name = prompt('Gerätename (optional):', '') || '';
    await claim(code, name);
  });

  const triggerRender = (options) => render(options);
  card.querySelector('#devRefresh')?.addEventListener('click', () => triggerRender({ bypassCache: true }));
  await triggerRender({ bypassCache: true });
  card.__refreshInterval = setInterval(() => {
    triggerRender({ bypassCache: true });
  }, 60_000);

  card.querySelector('#devGc')?.addEventListener('click', async () => {
    const conf = prompt('Geräte/Pairings aufräumen? Tippe „Ja“ zum Bestätigen:');
    if ((conf || '').trim().toLowerCase() !== 'ja') return;
    try {
      const result = await cleanupDevices();
      const deletedDevices = result?.deletedDevices ?? '?';
      const deletedPairings = result?.deletedPairings ?? '?';
      alert(`Bereinigt: ${deletedDevices} Geräte, ${deletedPairings} Pairing-Codes.`);
      await triggerRender({ bypassCache: true });
    } catch (error) {
      console.error('[admin] Gerätebereinigung fehlgeschlagen', error);
      alert('Fehler: ' + error.message);
    }
  });

  window.__refreshDevicesPane = (options = {}) => {
    const payload = options && typeof options === 'object' ? options : {};
    const { bypassCache = true, ...rest } = payload;
    return render({ bypassCache, ...rest });
  };

  return card;
}

// Geräte‑Vorschau (neues Modal)
function openDevicePreview(id, name){
  const m = document.getElementById('devPrevModal');
  const f = document.getElementById('devPrevFrame');
  if (!m || !f) {
    console.error('[devPrev] Modal oder Frame nicht gefunden. Existieren #devPrevModal und #devPrevFrame als SIBLINGS von #prevModal?');
    alert('Geräte-Vorschau nicht verfügbar (siehe Konsole).');
    return;
  }
  const t = m.querySelector('[data-devprev-title]');
  if (t) t.textContent = name ? ('Geräte-Ansicht: ' + name) : 'Geräte-Ansicht';
  f.src = SLIDESHOW_ORIGIN + '/?device=' + encodeURIComponent(id) + '&t=' + Date.now();
  m.style.display = 'grid';
}
document.getElementById('devPrevReload')?.addEventListener('click', ()=>{
  const f = document.getElementById('devPrevFrame');
  try { f?.contentWindow?.location?.reload(); } catch {}
});
document.getElementById('devPrevClose')?.addEventListener('click', ()=>{
  const m = document.getElementById('devPrevModal');
  const f = document.getElementById('devPrevFrame');
  if (m) m.style.display = 'none';
  if (f) f.src = 'about:blank';
});

function createDockPane(){
  const gridCard = document.getElementById('gridPane');
  if (!gridCard) return null;

  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.id = 'dockPane';
  wrap.innerHTML = `
    <div class="content" style="padding-top:10px">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:700">Vorschau</div>
        <div class="row" style="gap:8px">
          <button class="btn sm" id="dockReload">Neu laden</button>
          <span class="mut">zeigt nicht gespeicherte Änderungen</span>
        </div>
      </div>
      <div class="dockWrap">
        <iframe id="dockFrame" src="about:blank" title="Slideshow Vorschau"></iframe>
      </div>
    </div>
  `;
  gridCard.style.display = 'none';
  gridCard.after(wrap);

  const frame = wrap.querySelector('#dockFrame');
  frame.src = SLIDESHOW_ORIGIN + '/?preview=1';
  frame.addEventListener('load', ()=> dockSend(false), { once:true });
  wrap.querySelector('#dockReload')?.addEventListener('click', ()=> dockSend(true));

  setDockPane(wrap);
  return wrap;
}

function destroyDockPane(){
  const pane = document.getElementById('dockPane');
  if (pane){
    const frame = pane.querySelector('#dockFrame');
    if (frame) frame.src = 'about:blank';
    pane.remove();
  }
  setDockPane(null);
}

function destroyDevicesPane(){
  const pane = getDevicesPane();
  if (pane){
    clearInterval(pane.__refreshInterval);
    window.__refreshDevicesPane = undefined;
    pane.remove();
    setDevicesPane(null);
  }
}

async function applyDevicesPaneState(){
  const pinned = isDevicesPinned();
  lsSet('devicesPinned', pinned ? '1' : '0');
  document.body.classList.toggle('devices-pinned', pinned);
  let pane = getDevicesPane();
  if (pinned){
    if (!pane){
      pane = await createDevicesPane();
      setDevicesPane(pane);
    } else {
      pane.style.display = '';
      await refreshDevicesPane({ bypassCache: true });
    }
  } else {
    destroyDevicesPane();
  }
}

function viewLabel(v){
  return v === 'preview' ? 'Vorschau' : 'Grid';
}

async function showView(v){
  if (v === 'devices') v = 'grid';
  if (v !== 'grid' && v !== 'preview') v = 'grid';

  setCurrentView(v);
  lsSet('adminView', v);

  const labelEl = document.getElementById('viewMenuLabel');
  if (labelEl) labelEl.textContent = viewLabel(v);

  document.querySelectorAll('#viewMenu .dd-item').forEach(it=>{
    it.setAttribute('aria-checked', it.dataset.view === v ? 'true' : 'false');
  });

  const gridCard = document.getElementById('gridPane');
  if (!gridCard) return;

  detachDockLivePush();
  await applyDevicesPaneState();

  if (v === 'grid'){
    gridCard.style.display = '';
    destroyDockPane();
    const currentPane = getDevicesPane();
    if (currentPane) currentPane.style.display = '';
    return;
  }

  gridCard.style.display = 'none';
  const pane = getDevicesPane();
  if (pane) pane.style.display = '';
  if (!document.getElementById('dockPane')) setDockPane(createDockPane());
  attachDockLivePush();
}

window.__adminShowView = showView;

function initViewMenu(){
  const btn  = document.getElementById('viewMenuBtn');
  const menu = document.getElementById('viewMenu');
  if (!btn || !menu) return;

  const openMenu  = ()=>{ menu.hidden=false; btn.setAttribute('aria-expanded','true'); };
  const closeMenu = ()=>{ menu.hidden=true;  btn.setAttribute('aria-expanded','false'); };

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    (btn.getAttribute('aria-expanded')==='true') ? closeMenu() : openMenu();
  });

  menu.querySelectorAll('.dd-item').forEach(it=>{
    it.addEventListener('click', async ()=>{
      await showView(it.dataset.view);
      closeMenu();
    });
  });

  document.addEventListener('click', (e)=>{
    if (!menu.hidden && !document.getElementById('viewMenuWrap').contains(e.target)) closeMenu();
  });
  const btnDevices = document.getElementById('btnDevices');
  const updateDevicesButton = ()=>{
    if (!btnDevices) return;
    const pinned = isDevicesPinned();
    btnDevices.classList.toggle('active', pinned);
    btnDevices.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  };
  const toggleDevicesPane = async ()=>{
    setDevicesPinned(!isDevicesPinned());
    await applyDevicesPaneState();
    updateDevicesButton();
    await showView(getCurrentView());
  };
  document.addEventListener('keydown', async (e)=>{
    if (e.key === 'Escape' && !menu.hidden) closeMenu();
    const typing = /input|textarea|select/i.test(e.target?.tagName||'');
    if (typing) return;
    if (e.key === '1') { await showView('grid');    closeMenu(); }
    if (e.key === '2') { await showView('preview'); closeMenu(); }
    if (e.key === '3') { await toggleDevicesPane(); closeMenu(); }
  });

  if (btnDevices) btnDevices.onclick = toggleDevicesPane;
  updateDevicesButton();

  document.getElementById('viewMenuLabel').textContent = viewLabel(getCurrentView());
  // Initial zeichnen
  Promise.resolve().then(()=> showView(getCurrentView()));
}


// Export/Import + Optionen
function initBackupButtons(){
  const expBtn   = document.getElementById('btnExport');
  const impFile  = document.getElementById('importFile');
  const impWrite = document.getElementById('impWriteImg');

  if (expBtn) expBtn.onclick = async ()=>{
    const incImg = document.getElementById('expWithImg')?.checked ? 1 : 0;
    const incSet = document.getElementById('expWithSettings')?.checked ? 1 : 0;
    const incSch = document.getElementById('expWithSchedule')?.checked ? 1 : 0;
    const stamp  = new Date().toISOString().slice(0,10);
    const url = `/admin/api/export.php?include=${incImg}&settings=${incSet}&schedule=${incSch}&name=${encodeURIComponent('signage_export_'+stamp)}`;
    window.location.assign(url);
  };

  if (impFile) impFile.onchange = async ()=>{
    if(!impFile.files || !impFile.files[0]) return;
    const fd = new FormData();
    fd.append('file', impFile.files[0]);
    fd.append('writeAssets', (impWrite?.checked ? '1' : '0'));
    fd.append('writeSettings', document.getElementById('impWriteSettings')?.checked ? '1' : '0');
    fd.append('writeSchedule', document.getElementById('impWriteSchedule')?.checked ? '1' : '0');
    try {
      await fetchJson('/admin/api/import.php', {
        method:'POST',
        body: fd,
        expectOk: true,
        errorMessage: 'Import fehlgeschlagen.'
      });
      alert('Import erfolgreich.');
      location.reload();
    } catch (error) {
      console.error('[admin] Import fehlgeschlagen', error);
      alert('Fehler: ' + error.message);
    } finally {
      try { impFile.value = ''; } catch {}
    }
  };
}

// ============================================================================
// 7) Theme-Toggle
// ============================================================================
function initThemeToggle(){
  const cb = document.getElementById('themeMode');

  const apply = (mode) => {
    document.body.classList.toggle('theme-light', mode === 'light');
    document.body.classList.toggle('theme-dark',  mode === 'dark');
    lsSet('adminTheme', mode);
  };

  // ⬇️ Standard jetzt "light"
  const saved = lsGet('adminTheme') || 'light';
  cb.checked = (saved === 'light');
  apply(saved);

  cb.onchange = () => apply(cb.checked ? 'light' : 'dark');
}

// ============================================================================
// 8) Benutzer & Rollen
// ============================================================================
function initUserAdmin(){
  const openBtn = document.getElementById('btnUsers');
  const modal = document.getElementById('userModal');
  if (!openBtn || !modal) return;

  modal.dataset.open = modal.dataset.open || '0';

  const form = modal.querySelector('#userForm');
  const title = modal.querySelector('[data-user-form-title]');
  const status = modal.querySelector('[data-user-status]');
  const passwordHint = modal.querySelector('[data-user-password-hint]');
  const tableBody = modal.querySelector('[data-user-table]');
  const emptyHint = modal.querySelector('[data-user-empty]');
  const roleContainer = modal.querySelector('[data-role-options]');
  const usernameInput = modal.querySelector('#userUsername');
  const displayInput = modal.querySelector('#userDisplay');
  const passwordInput = modal.querySelector('#userPassword');
  const submitBtn = form?.querySelector('[type=submit]');
  const createBtn = modal.querySelector('#userCreateBtn');
  const cancelBtn = modal.querySelector('[data-user-cancel]');
  const closeButtons = modal.querySelectorAll('[data-user-close]');

  let users = [];
  let roles = Array.isArray(AUTH_ROLES) && AUTH_ROLES.length ? AUTH_ROLES.slice() : ['viewer', 'editor', 'admin'];
  let editing = null;
  let isBusy = false;

  const roleMetaFor = (role) => ROLE_META[role] || { title: role, description: '' };

  const setStatus = (message, type = 'info') => {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.type = message ? type : '';
  };

  const setBusy = (value) => {
    isBusy = !!value;
    modal.classList.toggle('is-busy', isBusy);
    if (submitBtn) submitBtn.disabled = isBusy;
    if (createBtn) createBtn.disabled = isBusy;
  };

  const closeModal = () => {
    modal.dataset.open = '0';
    modal.style.display = 'none';
  };

  const focusInitial = () => {
    const target = editing ? displayInput : usernameInput;
    if (target) {
      try {
        target.focus();
        if (typeof target.select === 'function') target.select();
      } catch {}
    }
  };

  const buildRoleOptions = (selectedRoles = []) => {
    if (!roleContainer) return;
    const selection = Array.isArray(selectedRoles)
      ? selectedRoles.map((role) => String(role).toLowerCase())
      : [];
    roleContainer.innerHTML = '';
    roles.forEach((role) => {
      const roleName = String(role);
      const meta = roleMetaFor(roleName);
      const label = document.createElement('label');
      label.className = 'user-role-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'roles';
      checkbox.value = roleName;
      checkbox.checked = selection.includes(roleName);
      const copy = document.createElement('div');
      copy.className = 'user-role-copy';
      const titleEl = document.createElement('span');
      titleEl.className = 'role-title';
      titleEl.textContent = meta.title;
      copy.appendChild(titleEl);
      if (meta.description) {
        const desc = document.createElement('span');
        desc.className = 'role-desc';
        desc.textContent = meta.description;
        copy.appendChild(desc);
      }
      label.append(checkbox, copy);
      roleContainer.appendChild(label);
    });
  };

  function startCreate({ preserveStatus = false } = {}) {
    editing = null;
    if (title) title.textContent = 'Benutzer anlegen';
    if (!preserveStatus) setStatus('');
    if (usernameInput) {
      usernameInput.disabled = false;
      usernameInput.value = '';
    }
    if (displayInput) displayInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (passwordHint) passwordHint.textContent = 'Passwort wird beim Speichern gesetzt.';
    if (submitBtn) submitBtn.textContent = 'Speichern';
    buildRoleOptions(['viewer']);
    renderUserTable();
    focusInitial();
  }

  function startEdit(user, { preserveStatus = false } = {}) {
    if (!user) return;
    const username = String(user.username ?? '').toLowerCase();
    editing = {
      username,
      displayName: user.displayName ?? '',
      roles: Array.isArray(user.roles) ? user.roles.slice() : []
    };
    if (title) title.textContent = `Benutzer „${user.username}“ bearbeiten`;
    if (!preserveStatus) setStatus('');
    if (usernameInput) {
      usernameInput.disabled = true;
      usernameInput.value = username;
    }
    if (displayInput) displayInput.value = user.displayName ?? '';
    if (passwordInput) passwordInput.value = '';
    if (passwordHint) passwordHint.textContent = 'Leer lassen, um das Passwort unverändert zu lassen.';
    if (submitBtn) submitBtn.textContent = 'Änderungen speichern';
    buildRoleOptions(editing.roles.length ? editing.roles : ['viewer']);
    renderUserTable();
    focusInitial();
  }

  async function handleDelete(user) {
    const username = String(user?.username ?? '');
    if (!username) return;
    const confirmText = `Benutzer „${username}“ wirklich löschen?`;
    if (!window.confirm(confirmText)) {
      return;
    }
    try {
      setBusy(true);
      await deleteUserAccount(username);
      setStatus('Benutzer gelöscht.', 'success');
      if (editing && editing.username === username) {
        editing = null;
      }
      await reloadUsers({ silent: true });
      startCreate({ preserveStatus: true });
    } catch (error) {
      console.error('[admin] Benutzer löschen fehlgeschlagen', error);
      setStatus(error.message || 'Benutzer konnte nicht gelöscht werden.', 'error');
    } finally {
      setBusy(false);
    }
  }

  function renderUserTable() {
    if (!tableBody || !emptyHint) return;
    tableBody.innerHTML = '';
    const sorted = users.slice().sort((a, b) => {
      const nameA = String(a?.username ?? '').toLowerCase();
      const nameB = String(b?.username ?? '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    if (!sorted.length) {
      emptyHint.hidden = false;
      return;
    }
    emptyHint.hidden = true;
    sorted.forEach((user) => {
      const username = String(user?.username ?? '');
      const display = user?.displayName ? String(user.displayName) : '';
      const rolesList = Array.isArray(user?.roles) ? user.roles : [];
      const roleTitles = rolesList.map((role) => roleMetaFor(role).title).join(', ');
      const roleHtml = roleTitles ? escapeHtml(roleTitles) : '—';
      const displayHtml = display ? `<div class="mut">${escapeHtml(display)}</div>` : '';
      const row = document.createElement('tr');
      if (editing && editing.username === username) {
        row.classList.add('is-editing');
      }
      row.innerHTML = `
        <td>
          <strong>${escapeHtml(username)}</strong>
          ${displayHtml}
        </td>
        <td>${roleHtml}</td>
        <td class="user-actions">
          <button type="button" class="btn sm" data-user-edit>Bearbeiten</button>
          <button type="button" class="btn sm danger" data-user-delete>Löschen</button>
        </td>
      `;
      row.querySelector('[data-user-edit]')?.addEventListener('click', () => startEdit(user));
      row.querySelector('[data-user-delete]')?.addEventListener('click', () => handleDelete(user));
      tableBody.appendChild(row);
    });
  }

  const collectSelectedRoles = () => Array.from(roleContainer?.querySelectorAll('input[type=checkbox]:checked') || []).map((input) => input.value);

  async function reloadUsers({ preserveSelection = false, silent = false } = {}) {
    if (!silent) setBusy(true);
    try {
      const data = await fetchUserAccounts();
      users = Array.isArray(data?.users) ? data.users : [];
      roles = Array.isArray(data?.roles) && data.roles.length ? data.roles : roles;
      if (preserveSelection && editing) {
        const match = users.find((entry) => entry?.username === editing.username);
        renderUserTable();
        if (match) {
          startEdit(match, { preserveStatus: true });
          return;
        }
      }
      renderUserTable();
      startCreate({ preserveStatus: true });
    } catch (error) {
      console.error('[admin] Benutzerliste laden fehlgeschlagen', error);
      setStatus(error.message || 'Benutzerliste konnte nicht geladen werden.', 'error');
    } finally {
      if (!silent) setBusy(false);
    }
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const username = (usernameInput?.value || '').trim().toLowerCase();
      if (!username) {
        setStatus('Benutzername angeben.', 'error');
        focusInitial();
        return;
      }
      const rolesSelection = collectSelectedRoles();
      if (!rolesSelection.length) {
        setStatus('Mindestens eine Rolle auswählen.', 'error');
        return;
      }
      const payload = {
        username,
        displayName: (displayInput?.value || '').trim(),
        roles: rolesSelection
      };
      const password = (passwordInput?.value || '').trim();
      if (password) {
        payload.password = password;
      }
      try {
        setBusy(true);
        await saveUserAccount(payload);
        setStatus(editing ? 'Benutzer aktualisiert.' : 'Benutzer angelegt.', 'success');
        if (passwordInput) passwordInput.value = '';
        await reloadUsers({ preserveSelection: !!editing, silent: true });
        if (!editing) {
          startCreate({ preserveStatus: true });
        }
      } catch (error) {
        console.error('[admin] Benutzer speichern fehlgeschlagen', error);
        setStatus(error.message || 'Speichern fehlgeschlagen.', 'error');
      } finally {
        setBusy(false);
      }
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', () => startCreate());
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => startCreate({ preserveStatus: true }));
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!isBusy) closeModal();
    });
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal && !isBusy) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.dataset.open === '1') {
      closeModal();
    }
  });

  openBtn.addEventListener('click', async () => {
    if (isBusy) return;
    modal.dataset.open = '1';
    modal.style.display = 'grid';
    setStatus('');
    await reloadUsers();
    focusInitial();
  });
}

// ============================================================================
// 9) System: Cleanup-Buttons (Assets aufräumen mit Auswahl)
// ============================================================================
function initCleanupInSystem(){
  const btn = document.getElementById('btnCleanupSys');
  if(!btn) return;
  btn.onclick = async ()=>{
    const delSauna = confirm('Sauna-Bilder löschen? OK = Ja, Abbrechen = Nein');
    const delInter = confirm('Medien-Slides löschen? OK = Ja, Abbrechen = Nein');
    const delFlame = confirm('Flammen-Bild löschen? OK = Ja, Abbrechen = Nein');

    const qs = new URLSearchParams({
      sauna: delSauna ? '1' : '0',
      inter: delInter ? '1' : '0',
      flame: delFlame ? '1' : '0'
    });
    try {
      const result = await fetchJson('/admin/api/cleanup_assets.php?' + qs.toString(), {
        okPredicate: (data) => data?.ok !== false,
        errorMessage: 'Bereinigung fehlgeschlagen.'
      });
      const removed = result?.removed ?? '?';
      alert(`Bereinigt: ${removed} Dateien entfernt.`);
    } catch (error) {
      console.error('[admin] Asset-Bereinigung fehlgeschlagen', error);
      alert('Fehler: ' + error.message);
    }
  };
}

// ============================================================================
// 10) Start
// ============================================================================
loadAll();
