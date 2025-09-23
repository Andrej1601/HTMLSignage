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
import { $, $$, preloadImg, genId, deepClone } from './core/utils.js';
import { DEFAULTS } from './core/defaults.js';
import { initGridUI, renderGrid as renderGridUI } from './ui/grid.js';
import { initSlidesMasterUI, renderSlidesMaster, getActiveDayKey, collectSlideOrderStream } from './ui/slides_master.js';
import { initGridDayLoader } from './ui/grid_day_loader.js';
import { uploadGeneric } from './core/upload.js';
import { createSafeLocalStorage } from './core/safe_storage.js';
import { createUnsavedTracker } from './core/unsaved_state.js';
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

const SLIDESHOW_ORIGIN = window.SLIDESHOW_ORIGIN || location.origin;
const THUMB_FALLBACK = '/assets/img/thumb_fallback.svg';
const safeStorage = createSafeLocalStorage({
  onFallback: () => {
    if (typeof alert === 'function') {
      alert('Speicher voll – Daten werden nur temporär gespeichert.');
    }
  },
  logger: (method, error) => console.warn(`[admin] localStorage.${method} failed`, error)
});

const lsGet = (key) => safeStorage.getItem(key);
const lsSet = (key, value) => safeStorage.setItem(key, value);
const lsRemove = (key) => safeStorage.removeItem(key);

// === Global State ============================================================
let schedule = null;
let settings = null;
let baseSchedule = null;            // globaler Schedule (Quelle)
let baseSettings = null;            // globale Settings (Quelle)
let deviceBaseSchedule = null;      // Basis für Geräte-Kontext
let deviceBaseSettings = null;
let currentDeviceCtx = null;        // z.B. "dev_abc..."
let currentDeviceName = null;
let currentDeviceBadgeMeta = null;
let storedView = lsGet('adminView');
if (storedView === 'devices') storedView = 'grid';
if (storedView !== 'grid' && storedView !== 'preview') storedView = 'grid';
let currentView = storedView; // 'grid' | 'preview'
let dockPane = null;     // Vorschau-Pane (wird nur bei "Vorschau" erzeugt)
let devicesPane = null;  // Geräte-Pane (wenn angeheftet)
let devicesPinned = (lsGet('devicesPinned') === '1');
document.body?.classList.toggle('devices-pinned', devicesPinned);

function clearDraftsIfPresent() {
  lsRemove('scheduleDraft');
  lsRemove('settingsDraft');
}

function rerenderAfterBaselineRestore() {
  try { renderGridUI(); } catch (err) { console.warn('[admin] Grid re-render failed after reset', err); }
  try { renderSlidesBox(); } catch (err) { console.warn('[admin] Slides box re-render failed after reset', err); }
  try { renderHighlightBox(); } catch (err) { console.warn('[admin] Highlight box re-render failed after reset', err); }
  try { renderColors(); } catch (err) { console.warn('[admin] Colors re-render failed after reset', err); }
  try { renderFootnotes(); } catch (err) { console.warn('[admin] Footnotes re-render failed after reset', err); }
  try { renderSlidesMaster(); } catch (err) { console.warn('[admin] Slides master re-render failed after reset', err); }
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

  let minPx = getNumberVar('--sidebar-min', 280);
  let maxPx = getNumberVar('--sidebar-max', 920);
  const clampWidth = (value) => Math.min(maxPx, Math.max(minPx, value));
  const media = window.matchMedia('(orientation: portrait),(max-width: 900px)');

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
      resetWidth();
      return;
    }
    resizer.setAttribute('aria-hidden', 'false');
    resizer.setAttribute('tabindex', '0');
    const stored = readStoredWidth();
    if (stored != null) {
      applyWidth(stored, { store: false });
    } else {
      resetWidth();
    }
  };

  media.addEventListener('change', syncState);
  window.addEventListener('resize', () => { if (!isCollapsed()) updateAria(); });

  const dragState = { active: false, pointerId: null, startX: 0, startWidth: 0 };

  resizer.addEventListener('pointerdown', (ev) => {
    if (!ev.isPrimary || isCollapsed()) return;
    dragState.active = true;
    dragState.pointerId = ev.pointerId;
    dragState.startX = ev.clientX;
    dragState.startWidth = rightbar.getBoundingClientRect().width;
    try { resizer.setPointerCapture(ev.pointerId); } catch {}
    resizer.classList.add('is-active');
    ev.preventDefault();
  });

  resizer.addEventListener('pointermove', (ev) => {
    if (!dragState.active || ev.pointerId !== dragState.pointerId) return;
    const delta = ev.clientX - dragState.startX;
    applyWidth(dragState.startWidth + delta, { store: false });
  });

  const finishDrag = (store = true) => {
    if (!dragState.active) return;
    dragState.active = false;
    const width = rightbar.getBoundingClientRect().width;
    if (store) applyWidth(width);
    try {
      if (dragState.pointerId !== null) resizer.releasePointerCapture(dragState.pointerId);
    } catch {}
    dragState.pointerId = null;
    resizer.classList.remove('is-active');
  };

  resizer.addEventListener('pointerup', (ev) => {
    if (ev.pointerId === dragState.pointerId) finishDrag(true);
  });
  resizer.addEventListener('pointercancel', () => finishDrag(false));
  resizer.addEventListener('lostpointercapture', () => finishDrag(false));

  resizer.addEventListener('keydown', (ev) => {
    if (isCollapsed()) return;
    const baseWidth = rightbar.getBoundingClientRect().width;
    const step = ev.shiftKey ? 48 : 24;
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      applyWidth(baseWidth - step);
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      applyWidth(baseWidth + step);
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

function normalizeContextBadge(source){
  if (!source) return null;
  if (typeof source === 'string'){
    const trimmed = source.trim();
    if (!trimmed) return null;
    const isUrl = /^(?:https?:)?\//i.test(trimmed) || /^data:/i.test(trimmed);
    if (isUrl) return { icon:'', imageUrl: trimmed, label:'' };
    return { icon: trimmed, imageUrl:'', label:'' };
  }
  if (typeof source !== 'object') return null;
  const icon = typeof source.icon === 'string'
    ? source.icon.trim()
    : (typeof source.emoji === 'string' ? source.emoji.trim() : '');
  const imageUrlRaw = typeof source.imageUrl === 'string' ? source.imageUrl
    : (typeof source.iconUrl === 'string' ? source.iconUrl : '');
  const imageUrl = String(imageUrlRaw || '').trim();
  const label = typeof source.label === 'string' ? source.label.trim() : '';
  if (!icon && !imageUrl) return null;
  return { icon, imageUrl, label };
}

// --- Kontext-Badge (Header) im Modul-Scope ---
function renderContextBadge(){
  const header = document.querySelector('header');
  const actions = header?.querySelector('.header-actions');
  if (!header) return;
  let wrap = header.querySelector('.ctx-wrap');
  let el = document.getElementById('ctxBadge');
  if (!currentDeviceCtx){
    if (wrap) wrap.remove();
    return;
  }
  if (!wrap){
    wrap = document.createElement('div');
    wrap.className = 'ctx-wrap';
  }
  if (actions){
    header.insertBefore(wrap, actions);
  } else if (!wrap.isConnected){
    header.appendChild(wrap);
  }
  if (!el){
    el = document.createElement('span');
    el.id = 'ctxBadge';
    el.className = 'ctx-badge';
    el.title = 'Geräte-Kontext aktiv';

    const label = document.createElement('span');
    label.className = 'ctx-badge-label';

    const media = document.createElement('span');
    media.className = 'ctx-badge-media';
    media.hidden = true;

    const mediaImage = document.createElement('img');
    mediaImage.className = 'ctx-badge-media-image';
    mediaImage.alt = '';
    mediaImage.hidden = true;

    const mediaIcon = document.createElement('span');
    mediaIcon.className = 'ctx-badge-media-icon';
    mediaIcon.hidden = true;

    media.appendChild(mediaImage);
    media.appendChild(mediaIcon);

    const text = document.createElement('span');
    text.className = 'ctx-badge-text';

    label.appendChild(media);
    label.appendChild(text);
    el.appendChild(label);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'ctxReset';
    resetBtn.className = 'ctx-badge-close';
    resetBtn.title = 'Geräte-Kontext verlassen';
    resetBtn.textContent = 'Kontext schließen';
    resetBtn.addEventListener('click', () => exitDeviceContext());
    el.appendChild(resetBtn);

    wrap.appendChild(el);
  }

  const textEl = el.querySelector('.ctx-badge-text');
  if (textEl){
    textEl.textContent = `Kontext: ${currentDeviceName || currentDeviceCtx}`;
  }

  const mediaWrap = el.querySelector('.ctx-badge-media');
  const mediaImage = el.querySelector('.ctx-badge-media-image');
  const mediaIcon = el.querySelector('.ctx-badge-media-icon');
  const badge = currentDeviceBadgeMeta;
  if (mediaWrap && mediaImage && mediaIcon){
    const iconText = (badge?.icon || '').trim();
    const imageUrl = (badge?.imageUrl || '').trim();
    if (badge && (iconText || imageUrl)){
      if (imageUrl){
        mediaImage.src = imageUrl;
        mediaImage.hidden = false;
        mediaIcon.hidden = true;
        mediaIcon.textContent = '';
      } else {
        mediaIcon.textContent = iconText;
        mediaIcon.hidden = !iconText;
        mediaImage.hidden = true;
        mediaImage.removeAttribute('src');
      }
      mediaWrap.hidden = false;
      mediaWrap.title = badge?.label || '';
      el.classList.add('has-media');
    } else {
      mediaWrap.hidden = true;
      mediaIcon.hidden = true;
      mediaIcon.textContent = '';
      mediaImage.hidden = true;
      mediaImage.removeAttribute('src');
      mediaWrap.removeAttribute('title');
      el.classList.remove('has-media');
    }
  }
}

// --- e) Kontext-Wechsel-Funktionen (Modul-Scope) ---
async function enterDeviceContext(id, name){
  // aktuelle Geräte-Daten holen, Overrides herausziehen
  const r = await fetch('/admin/api/devices_list.php');
  const j = await r.json();
  const dev = (j.devices||[]).find(d=>d.id===id);
  const ov  = dev?.overrides?.settings || {};

  currentDeviceCtx = id;
  currentDeviceName = name || id;
  document.body.classList.add('device-mode');
  currentDeviceBadgeMeta = normalizeContextBadge(
    dev?.contextBadge ?? dev?.badge ?? dev?.badgeInfo ?? null
  );

  // globale Settings als Basis
  settings = deepClone(baseSettings);

  // Overrides mergen (flach genug für unsere Struktur)
  (function merge(t, s){
    for (const k of Object.keys(s)){
      if (s[k] && typeof s[k]==='object' && !Array.isArray(s[k])){
        t[k] = t[k] && typeof t[k]==='object' ? deepClone(t[k]) : {};
        merge(t[k], s[k]);
      } else {
        t[k] = s[k];
      }
    }
  })(settings, ov);

  settings = normalizeSettings(settings, { assignMissingIds: false });
  deviceBaseSchedule = deepClone(schedule);
  deviceBaseSettings = deepClone(settings);
  updateBaseline(deviceBaseSchedule, deviceBaseSettings);
  setUnsavedState(false);

  // UI neu zeichnen
  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();
  initSlidesMasterUI({
    getSchedule:()=>schedule,
    getSettings:()=>settings,
    setSchedule:(s)=>{schedule=s;},
    setSettings:(cs)=>{settings=cs;},
    refreshSlidesBox: renderSlidesBox,
    refreshColors: renderColors
  });
  renderContextBadge();
  window.__refreshDevicesPane?.();

  // in den Grid-Modus springen (falls du showView hast)
if (typeof showView==='function') showView('grid');
}

function exitDeviceContext(){
  currentDeviceCtx = null;
  currentDeviceName = null;
  document.body.classList.remove('device-mode');
  currentDeviceBadgeMeta = null;

  settings = deepClone(baseSettings);
  deviceBaseSchedule = null;
  deviceBaseSettings = null;
  updateBaseline(baseSchedule, baseSettings);
  evaluateUnsavedState({ immediate: true });

  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();
  initSlidesMasterUI({
    getSchedule:()=>schedule,
    getSettings:()=>settings,
    setSchedule:(s)=>{schedule=s;},
    setSettings:(cs)=>{settings=cs;},
    refreshSlidesBox: renderSlidesBox,
    refreshColors: renderColors
  });
  renderContextBadge();
  window.__refreshDevicesPane?.();
}


// ============================================================================
// 1) Bootstrap: Laden + Initialisieren
// ============================================================================
async function loadAll(){
  let unsavedFromDraft = false;
  const [s, cfg] = await Promise.all([
    fetch('/admin/api/load.php').then(r=>r.json()),
    fetch('/admin/api/load_settings.php').then(r=>r.json())
  ]);

  schedule = deepClone(s || {});
  settings = normalizeSettings(cfg || {}, { assignMissingIds: true });
  baseSchedule = deepClone(schedule);
  baseSettings = deepClone(settings);
  deviceBaseSchedule = null;
  deviceBaseSettings = null;
  updateBaseline(baseSchedule, baseSettings);

  try {
    const draft = lsGet('scheduleDraft');
    if (draft) {
      schedule = JSON.parse(draft);
      unsavedFromDraft = true;
    }
  } catch {}

  try {
    const draft = lsGet('settingsDraft');
    if (draft) {
      const parsed = JSON.parse(draft);
      (function merge(t, s) {
        for (const k of Object.keys(s)) {
          if (s[k] && typeof s[k] === 'object' && !Array.isArray(s[k])) {
            t[k] = t[k] && typeof t[k] === 'object' ? t[k] : {};
            merge(t[k], s[k]);
          } else {
            t[k] = s[k];
          }
        }
      })(settings, parsed);
      unsavedFromDraft = true;
    }
  } catch {}
  settings = normalizeSettings(settings, { assignMissingIds: false });

  setUnsavedState(unsavedFromDraft, { skipDraftClear: true });

  // --- UI-Module initialisieren ---------------------------------------------
  initGridUI({
    getSchedule : () => schedule,
    getSettings : () => settings,
    setSchedule : (s) => { schedule = s; }   // wichtig für Grid-Operationen
  });

  initSlidesMasterUI({
    getSchedule : () => schedule,
    getSettings : () => settings,
    setSchedule : (s)  => { schedule = s; },
    setSettings : (cs) => { settings = cs; },
    refreshSlidesBox: renderSlidesBox,
    refreshColors: renderColors
  });

  initGridDayLoader({
    getSchedule : () => schedule,
    getSettings : () => settings,
    setSchedule : (s) => { schedule = s; }
  });

  // --- Seitenboxen rendern ---------------------------------------------------
  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();

  // --- globale UI-Schalter (Theme/Backup/Cleanup) ---------------------------
  initThemeToggle();
  initBackupButtons();
  initCleanupInSystem();
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
  const renderPagePlaylist = (hostId, playlistList = [], { pageKey = 'left', source } = {}) => {
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
      label: 'Hero-Timeline',
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
          default:
            break;
        }
      }
      const prevStr = JSON.stringify(Array.isArray(pageState.playlist) ? pageState.playlist : []);
      const nextStr = JSON.stringify(next);
      pageState.playlist = next;
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
  };

  // Schrift
  setV('#fontFamily', f.family ?? DEFAULTS.fonts.family);
  setV('#fontScale',  f.scale  ?? 1);
  setV('#h1Scale',    f.h1Scale ?? 1);
  setV('#h2Scale',    f.h2Scale ?? 1);
  setV('#tileTimeScale', f.tileMetaScale ?? 1);
  setC('#saunaFlames', (settings.slides?.showSaunaFlames !== false));
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
  setV('#pageLeftSource', PAGE_SOURCE_KEYS.includes(leftCfg.source) ? leftCfg.source : 'master');
  setV('#pageRightSource', PAGE_SOURCE_KEYS.includes(rightCfg.source) ? rightCfg.source : 'media');
  setV('#pageLeftTimer', leftCfg.timerSec ?? '');
  setV('#pageRightTimer', rightCfg.timerSec ?? '');
  renderPagePlaylist('pageLeftPlaylist', leftCfg.playlist, { pageKey: 'left', source: leftCfg.source });
  renderPagePlaylist('pageRightPlaylist', rightCfg.playlist, { pageKey: 'right', source: rightCfg.source });
  const layoutModeSelect = document.getElementById('layoutMode');
  const applyLayoutVisibility = (mode) => {
    const rightWrap = document.getElementById('layoutRight');
    if (rightWrap) rightWrap.hidden = (mode !== 'split');
  };
  applyLayoutVisibility(layoutMode);
  if (layoutModeSelect) {
    layoutModeSelect.onchange = () => applyLayoutVisibility(layoutModeSelect.value === 'split' ? 'split' : 'single');
  }

  const bindPlaylistSource = (selectId, pageKey, hostId) => {
    const el = document.getElementById(selectId);
    if (!el || el.dataset.playlistBound === '1') return;
    el.addEventListener('change', () => {
      const pageCfg = ((settings.display || {}).pages || {})[pageKey] || {};
      renderPagePlaylist(hostId, pageCfg.playlist, { pageKey, source: el.value });
    });
    el.dataset.playlistBound = '1';
  };
  bindPlaylistSource('pageLeftSource', 'left', 'pageLeftPlaylist');
  bindPlaylistSource('pageRightSource', 'right', 'pageRightPlaylist');

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
    setV('#tileHeightScale', DEFAULTS.slides.tileHeightScale);
    setV('#tilePaddingScale', DEFAULTS.slides.tilePaddingScale);
    setV('#badgeScale',    DEFAULTS.slides.badgeScale);
    setV('#badgeDescriptionScale', DEFAULTS.slides.badgeDescriptionScale);
    setC('#saunaFlames', DEFAULTS.slides.showSaunaFlames !== false);
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
    setV('#pageLeftSource', PAGE_SOURCE_KEYS.includes(defLeft.source) ? defLeft.source : 'master');
    setV('#pageRightSource', PAGE_SOURCE_KEYS.includes(defRight.source) ? defRight.source : 'media');
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
    renderPagePlaylist('pageLeftPlaylist', defLeftPlaylist, { pageKey: 'left', source: defLeft.source });
    renderPagePlaylist('pageRightPlaylist', defRightPlaylist, { pageKey: 'right', source: defRight.source });
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
  host.innerHTML='';
  const layoutSel = document.getElementById('footnoteLayout');
  if (layoutSel){ layoutSel.value = settings.footnoteLayout || 'one-line'; layoutSel.onchange = ()=>{ settings.footnoteLayout = layoutSel.value; }; }
  const list = settings.footnotes || [];
  list.forEach((fn,i)=> host.appendChild(fnRow(fn,i)));
  $('#fnAdd').onclick=()=>{ (settings.footnotes ||= []).push({id:genId(), label:'*', text:''}); renderFootnotes(); };
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
  const getSourceValue = (id, fallback) => {
    const el = document.getElementById(id);
    const val = el?.value || fallback;
    return PAGE_SOURCE_KEYS.includes(val) ? val : fallback;
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
        customBadgeEmojis:(() => {
          const list = Array.isArray(settings.slides?.customBadgeEmojis)
            ? settings.slides.customBadgeEmojis
            : [];
          const out = [];
          list.forEach(entry => {
            if (typeof entry !== 'string') return;
            const value = entry.trim();
            if (!value || out.includes(value)) return;
            out.push(value);
          });
          return out;
        })(),
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
        })()
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
        pages:{
          left:{
            ...(((settings.display||{}).pages||{}).left||{}),
            source:getSourceValue('pageLeftSource', 'master'),
            timerSec:sanitizeTimer(document.getElementById('pageLeftTimer')?.value),
            contentTypes:getContentTypes(((settings.display||{}).pages||{}).left, DEFAULTS.display?.pages?.left),
            playlist:collectPlaylist(((settings.display||{}).pages||{}).left)
          },
          right:{
            ...(((settings.display||{}).pages||{}).right||{}),
            source:getSourceValue('pageRightSource', 'media'),
            timerSec:sanitizeTimer(document.getElementById('pageRightTimer')?.value),
            contentTypes:getContentTypes(((settings.display||{}).pages||{}).right, DEFAULTS.display?.pages?.right),
            playlist:collectPlaylist(((settings.display||{}).pages||{}).right)
          }
        }
      },
      footnotes: settings.footnotes,
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

  if (!currentDeviceCtx){
    // Global speichern
    body.schedule.version = (Date.now()/1000|0);
    body.settings.version = (Date.now()/1000|0);
    const r=await fetch('/admin/api/save.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const j=await r.json().catch(()=>({ok:false}));
      if (j.ok){
        baseSchedule = deepClone(schedule);
        baseSettings = deepClone(settings);
        deviceBaseSchedule = null;
        deviceBaseSettings = null;
        updateBaseline(baseSchedule, baseSettings);
        clearDraftsIfPresent();
        setUnsavedState(false);
      }
      alert(j.ok ? 'Gespeichert (Global).' : ('Fehler: '+(j.error||'unbekannt')));
    } else {
      // Geräte-Override speichern
      const payload = { device: currentDeviceCtx, settings: body.settings, schedule: body.schedule };
      const r=await fetch('/admin/api/devices_save_override.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const j=await r.json().catch(()=>({ok:false}));
      if (j.ok) {
        deviceBaseSchedule = deepClone(schedule);
        deviceBaseSettings = deepClone(settings);
        updateBaseline(deviceBaseSchedule, deviceBaseSettings);
        clearDraftsIfPresent();
        setUnsavedState(false);
      }
      alert(j.ok ? ('Gespeichert für Gerät: '+currentDeviceName) : ('Fehler: '+(j.error||'unbekannt')));
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
  const r = await fetch('/admin/api/devices_claim.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code, name })
  });
  const j = await r.json().catch(()=>({ok:false}));
  if (!j.ok) { alert('Fehler: ' + (j.error || 'unbekannt')); return; }

  // kleine Quality-of-life Info:
  if (j.deviceId) {
    const url = SLIDESHOW_ORIGIN + '/?device=' + j.deviceId;
    console.log('Gepaart:', j.deviceId, url);
  }
  // Pane neu laden (siehe createDevicesPane -> render)
  if (typeof window.__refreshDevicesPane === 'function') await window.__refreshDevicesPane();
  alert('Gerät gekoppelt' + (j.already ? ' (war bereits gekoppelt)' : '') + '.');
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

  // --- API-Adapter: devices_list.php (wenn vorhanden) oder Fallback auf devices.json
  const normalizeSeconds = (value)=>{
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return 0;
    if (num > 1e12) return Math.floor(num / 1000);
    if (num > 1e10) return Math.floor(num / 1000);
    return Math.floor(num);
  };

  const resolveNow = (value)=>{
    if (value === undefined || value === null) return normalizeSeconds(Date.now());
    return normalizeSeconds(value);
  };

  const OFFLINE_AFTER_MIN = 2;

  async function fetchDevicesStatus(){
    try {
      const r = await fetch('/admin/api/devices_list.php', {cache:'no-store'});
      if (r.ok) {
        const j = await r.json();
        const now = resolveNow(j.now);
        const pairings = j.pairings || [];
        const devices = (j.devices || []).map(d => {
          const lastSeenAt = normalizeSeconds(d.lastSeenAt ?? d.lastSeen ?? 0);
          const offline = !lastSeenAt || (now - lastSeenAt) > OFFLINE_AFTER_MIN * 60;
          return {
            id: d.id,
            name: d.name || '',
            lastSeenAt,
            offline,
            useOverrides: !!d.useOverrides
          };
        });
        return { ok:true, now, pairings, devices };
      }
    } catch(e){}
    try {
      const r2 = await fetch('/data/devices.json?t='+Date.now(), {cache:'no-store'});
      if (r2.ok){
        const j2 = await r2.json();
        const pairings = Object.values(j2.pairings || {})
          .filter(p => !p.deviceId)
          .map(p => ({ code: p.code, createdAt: normalizeSeconds(p.created) }));
        const now = resolveNow(j2.now);
        const devices = Object.values(j2.devices || {}).map(d => {
          const lastSeenAt = normalizeSeconds(d.lastSeen || d.lastSeenAt || 0);
          const offline = !lastSeenAt || (now - lastSeenAt) > OFFLINE_AFTER_MIN * 60;
          return {
            id: d.id,
            name: d.name || '',
            lastSeenAt,
            offline,
            useOverrides: !!d.useOverrides
          };
        });
        return { ok:true, now, pairings, devices };
      }
    } catch(e){}
    console.warn('[admin] konnte Geräte-Status weder über API noch Datei laden');
    return { ok:false, pairings:[], devices:[] };
  }

  async function render(){
    const j = await fetchDevicesStatus();
    const now = resolveNow(j.now);

    // Pending
    const P = document.getElementById('devPendingList');
    P.innerHTML = '';
    const pend = (j.pairings || []).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if (!pend.length) {
      P.innerHTML = '<div class="mut">Keine offenen Pairings.</div>';
    } else {
      pend.forEach(d=>{
        const row = document.createElement('div'); row.className='pend-item';
        const ts = d.createdAt ? new Date(d.createdAt*1000).toLocaleString('de-DE') : '—';
        row.innerHTML = `
          <div class="pill">Code: <b>${d.code}</b></div>
          <div class="mut">seit ${ts}</div>
          <button class="btn sm" data-code>Pairen…</button>
        `;
        row.querySelector('[data-code]').onclick = async ()=>{
          const name = prompt('Name des Geräts (z. B. „Foyer TV“):','') || '';
          await claim(d.code, name);
        };
        P.appendChild(row);
      });
    }

    // Paired
    const L = document.getElementById('devPairedList');
    L.innerHTML = '';
    const paired = (j.devices || []);
    if (!paired.length) {
      L.innerHTML = '<div class="mut">Noch keine Geräte gekoppelt.</div>';
    } else {
      const table = document.createElement('table');
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      L.appendChild(table);
      const selectRow = (tr)=>{
        tr.parentElement.querySelectorAll('tr').forEach(r=>r.classList.remove('selected'));
        tr.classList.add('selected');
      };
      paired.forEach(d=>{
        const lastSeenAt = Number(d.lastSeenAt) || 0;
        const seen = lastSeenAt ? new Date(lastSeenAt*1000).toLocaleString('de-DE') : '—';
        const offline = typeof d.offline === 'boolean'
          ? d.offline
          : (!lastSeenAt || (now - lastSeenAt) > OFFLINE_AFTER_MIN * 60);
        const useInd = d.useOverrides;
        const modeLbl = useInd ? 'Individuell' : 'Global';
        const tr = document.createElement('tr');
        if (currentDeviceCtx===d.id) tr.classList.add('current');
        if (useInd) tr.classList.add('ind');
        if (offline) tr.classList.add('offline');
        const lastSeenHtml = lastSeenAt ? `<br><small class="mut">${seen}</small>` : '';
        const statusCell = offline
          ? `<td class="status offline">offline${lastSeenHtml}</td>`
          : `<td class="status online">online${lastSeenHtml}</td>`;
        tr.innerHTML = `
          <td><span class="dev-name" title="${d.id}">${d.name || d.id}</span></td>
          <td><button class="btn sm" data-view>Ansehen</button></td>
          <td><label class="toggle${useInd?' ind-active':''}" data-mode-wrap>
            <input type="checkbox" ${useInd?'checked':''} data-mode>
            <span data-mode-label>${modeLbl}</span>
          </label></td>
          <td><button class="btn sm" data-edit>Im Editor bearbeiten</button></td>
          <td><button class="btn sm" data-rename>Umbenennen</button></td>
          <td><button class="btn sm ghost" data-url>URL kopieren</button></td>
          <td><button class="btn sm danger" data-unpair>Trennen…</button></td>
          ${statusCell}
        `;

        const modeInput = tr.querySelector('[data-mode]');
        const modeLabel = tr.querySelector('[data-mode-label]');
        const modeWrap = tr.querySelector('[data-mode-wrap]');
        modeInput.onchange = async ()=>{
          const mode = modeInput.checked ? 'device' : 'global';
          modeLabel.textContent = modeInput.checked ? 'Individuell' : 'Global';
          tr.classList.toggle('ind', modeInput.checked);
          modeWrap.classList.toggle('ind-active', modeInput.checked);
          const r = await fetch('/admin/api/devices_set_mode.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device: d.id, mode })
          });
          const jj = await r.json().catch(()=>({ok:false}));
          if (!jj.ok) alert('Fehler: '+(jj.error||'unbekannt'));
        };

        tr.querySelector('[data-unpair]').onclick = async ()=>{
          if (!/^dev_/.test(String(d.id))) {
            alert('Dieses Gerät hat eine alte/ungültige ID. Bitte ein neues Gerät koppeln und das alte ignorieren.');
            return;
          }
          const check = prompt('Wirklich trennen? Tippe „Ja“ zum Bestätigen:');
          if ((check||'').trim().toLowerCase() !== 'ja') return;

          const r = await fetch('/admin/api/devices_unpair.php', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ device: d.id, purge: 1 })
          });
          const jj = await r.json().catch(()=>({ok:false}));
          if (!jj.ok) { alert('Fehler: '+(jj.error||'unbekannt')); return; }
          alert('Gerät getrennt.');
          render();
        };

        tr.querySelector('[data-view]').onclick = ()=>{
          selectRow(tr);
          openDevicePreview(d.id, d.name || d.id);
        };
        tr.querySelector('[data-url]').onclick = async ()=>{
          const url = SLIDESHOW_ORIGIN + '/?device=' + d.id;
          try { await navigator.clipboard.writeText(url); alert('URL kopiert:\n'+url); }
          catch { prompt('URL kopieren:', url); }
        };
        tr.querySelector('[data-edit]').onclick = ()=>{
          selectRow(tr);
          enterDeviceContext(d.id, d.name || d.id);
        };
        tr.querySelector('[data-rename]').onclick = async ()=>{
          const newName = prompt('Neuer Gerätename:', d.name || '');
          if (newName === null) return;
          const r = await fetch('/admin/api/devices_rename.php', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ device: d.id, name: newName })
          });
          const jj = await r.json().catch(()=>({ok:false}));
          if (!jj.ok) { alert('Fehler: '+(jj.error||'unbekannt')); return; }
          alert('Name gespeichert.');
          render();
        };
        tbody.appendChild(tr);
      });
    }
    const ts = card.querySelector('#devLastUpdate');
    if (ts) {
      const fallbackNow = normalizeSeconds(Date.now());
      const tsSeconds = now || fallbackNow;
      const tsDate = new Date(tsSeconds * 1000);
      ts.textContent = tsDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      ts.title = 'Stand: ' + tsDate.toLocaleString('de-DE');
    }
  }

  // oben rechts: „Code eingeben…“
  card.querySelector('#devPairManual').onclick = async ()=>{
    const code = prompt('Pairing-Code (6 Zeichen):','');
    if (!code) return;
    const name = prompt('Gerätename (optional):','') || '';
    await claim(code, name);
  };

  // Refresh & einmalig laden
  card.querySelector('#devRefresh').onclick = render;
  await render();
  card.__refreshInterval = setInterval(render, 60_000);

card.querySelector('#devGc').onclick = async ()=>{
  const conf = prompt('Geräte/Pairings aufräumen? Tippe „Ja“ zum Bestätigen:');
  if ((conf||'').trim().toLowerCase() !== 'ja') return;
  const r = await fetch('/admin/api/devices_gc.php', { method:'POST' });
  const j = await r.json().catch(()=>({ok:false}));
  if (!j.ok){ alert('Fehler: '+(j.error||'unbekannt')); return; }
  alert(`Bereinigt: ${j.deletedDevices} Geräte, ${j.deletedPairings} Pairing-Codes.`);
  card.querySelector('#devRefresh').click();
};


  // globaler Hook, damit claim() nach erfolgreichem Pairen neu laden kann
  window.__refreshDevicesPane = render;

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

  return wrap;
}

function destroyDockPane(){
  const pane = document.getElementById('dockPane');
  if (pane){
    const frame = pane.querySelector('#dockFrame');
    if (frame) frame.src = 'about:blank';
    pane.remove();
  }
}

function destroyDevicesPane(){
  if (devicesPane){
    clearInterval(devicesPane.__refreshInterval);
    window.__refreshDevicesPane = undefined;
    devicesPane.remove();
    devicesPane = null;
  }
}

async function applyDevicesPaneState(){
  lsSet('devicesPinned', devicesPinned ? '1' : '0');
  document.body.classList.toggle('devices-pinned', devicesPinned);
  if (devicesPinned){
    if (!devicesPane){
      devicesPane = await createDevicesPane();
    } else {
      devicesPane.style.display = '';
      if (typeof window.__refreshDevicesPane === 'function'){
        await window.__refreshDevicesPane();
      }
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

  currentView = v;
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
    if (devicesPane) devicesPane.style.display = '';
    return;
  }

  gridCard.style.display = 'none';
  if (devicesPane) devicesPane.style.display = '';
  if (!document.getElementById('dockPane')) createDockPane();
  attachDockLivePush();
}

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
    btnDevices.classList.toggle('active', devicesPinned);
    btnDevices.setAttribute('aria-pressed', devicesPinned ? 'true' : 'false');
  };
  const toggleDevicesPane = async ()=>{
    devicesPinned = !devicesPinned;
    await applyDevicesPaneState();
    updateDevicesButton();
    await showView(currentView);
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

  document.getElementById('viewMenuLabel').textContent = viewLabel(currentView);
  // Initial zeichnen
  Promise.resolve().then(()=> showView(currentView));
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
    const res = await fetch('/admin/api/import.php',{ method:'POST', body: fd });
    let j=null; try{ j=await res.json(); }catch{}
    alert(j?.ok ? 'Import erfolgreich.' : ('Fehler: '+(j?.error||'unbekannt')));
    if(j?.ok) location.reload();
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
// 8) System: Cleanup-Buttons (Assets aufräumen mit Auswahl)
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
    const r = await fetch('/admin/api/cleanup_assets.php?'+qs.toString());
    const j = await r.json().catch(()=>({ok:false}));
    alert(j.ok ? (`Bereinigt: ${j.removed||'?'} Dateien entfernt.`) : ('Fehler: '+(j.error||'')));
  };
}

// ============================================================================
// 9) Start
// ============================================================================
loadAll();