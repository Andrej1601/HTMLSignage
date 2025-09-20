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
import { initSlidesMasterUI, renderSlidesMaster, getActiveDayKey } from './ui/slides_master.js';
import { initGridDayLoader } from './ui/grid_day_loader.js';
import { uploadGeneric } from './core/upload.js';

const SLIDESHOW_ORIGIN = window.SLIDESHOW_ORIGIN || location.origin;
const THUMB_FALLBACK = '/assets/img/thumb_fallback.svg';
const PAGE_CONTENT_TYPES = [
  ['overview','Übersicht'],
  ['sauna','Saunen'],
  ['hero-timeline','Hero-Timeline'],
  ['story','Erklärungen'],
  ['image','Bilder'],
  ['video','Videos'],
  ['url','Webseiten']
];
const PAGE_CONTENT_TYPE_KEYS = new Set(PAGE_CONTENT_TYPES.map(([key]) => key));
const PAGE_SOURCE_KEYS = ['master','schedule','media','story'];

function sanitizeBadgeLibrary(list, { assignMissingIds = false, fallback } = {}) {
  const seen = new Set();
  const normalized = [];
  const pushEntry = (entry, assignId = false) => {
    if (!entry || typeof entry !== 'object') return;
    let id = String(entry.id ?? '').trim();
    if (!id && assignId) id = genId('bdg_');
    if (!id || seen.has(id)) return;
    const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const imageUrlRaw = typeof entry.imageUrl === 'string' ? entry.imageUrl
      : (typeof entry.iconUrl === 'string' ? entry.iconUrl : '');
    const imageUrl = String(imageUrlRaw || '').trim();
    const record = {
      id,
      icon,
      label,
      imageUrl
    };
    normalized.push(record);
    seen.add(id);
  };

  if (Array.isArray(list)){
    list.forEach(entry => pushEntry(entry, assignMissingIds));
  }

  if (!normalized.length && Array.isArray(fallback)){
    fallback.forEach(entry => pushEntry(entry, true));
  }

  return normalized;
}

// Lokaler Speicher mit Fallback bei DOMException (z.B. QuotaExceeded)
const LS_MEM = {};
let lsWarned = false;
function lsNotice(){
  if (lsWarned) return;
  lsWarned = true;
  alert('Speicher voll – Daten werden nur temporär gespeichert.');
}
function lsGet(key) {
  try { return localStorage.getItem(key); }
  catch (e) {
    if (e instanceof DOMException) {
      console.warn('[admin] localStorage.getItem failed', e);
      lsNotice();
      return LS_MEM[key] ?? null;
    }
    return null;
  }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); }
  catch (e) {
    if (e instanceof DOMException) {
      console.warn('[admin] localStorage.setItem failed', e);
      lsNotice();
      LS_MEM[key] = String(val);
    }
  }
}
function lsRemove(key) {
  try { localStorage.removeItem(key); }
  catch (e) {
    if (e instanceof DOMException) {
      console.warn('[admin] localStorage.removeItem failed', e);
      lsNotice();
    }
  }
  delete LS_MEM[key];
}

// === Global State ============================================================
let schedule = null;
let settings = null;
let baseSchedule = null;            // globaler Schedule (Quelle)
let baseSettings = null;            // globale Settings (Quelle)
let deviceBaseSchedule = null;      // Basis für Geräte-Kontext
let deviceBaseSettings = null;
let baselineSchedule = null;        // Vergleichsbasis für Unsaved-Indikator
let baselineSettings = null;
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

const unsavedBadge = document.getElementById('unsavedBadge');
let hasUnsavedChanges = false;
let _unsavedIndicatorTimer = 0;
let _unsavedInputListener = null;
let _unsavedBlurListener = null;
let _unsavedEvalTimer = 0;

function normalizeSettings(source, { assignMissingIds = false } = {}) {
  const src = source ? deepClone(source) : {};
  src.slides        = { ...DEFAULTS.slides,   ...(src.slides || {}) };
  src.display       = { ...DEFAULTS.display,  ...(src.display || {}) };
  src.theme         = { ...DEFAULTS.theme,    ...(src.theme || {}) };
  src.fonts         = { ...DEFAULTS.fonts,    ...(src.fonts || {}) };
  src.assets        = { ...DEFAULTS.assets,   ...(src.assets || {}) };
  src.h2            = { ...DEFAULTS.h2,       ...(src.h2 || {}) };
  src.highlightNext = { ...DEFAULTS.highlightNext, ...(src.highlightNext || {}) };
  src.footnotes     = Array.isArray(src.footnotes) ? src.footnotes : (DEFAULTS.footnotes || []);
  src.interstitials = Array.isArray(src.interstitials)
    ? src.interstitials.map(it => {
        const next = {
          id: it?.id || null,
          name: it?.name || '',
          enabled: (it?.enabled !== false),
          type: it?.type || 'image',
          url: it?.url || '',
          thumb: it?.thumb || it?.url || '',
          dwellSec: Number.isFinite(it?.dwellSec) ? it.dwellSec : 6
        };
        if (!next.id && assignMissingIds) next.id = genId('im_');
        return next;
      })
    : [];
  src.presets       = src.presets || {};

  const defaultDisplayPages = DEFAULTS.display?.pages || {};
  const sanitizePageConfig = (page, defaults = {}) => {
    const cfg = page && typeof page === 'object' ? { ...page } : {};
    const def = defaults && typeof defaults === 'object' ? defaults : {};
    cfg.source = PAGE_SOURCE_KEYS.includes(cfg.source) ? cfg.source : (PAGE_SOURCE_KEYS.includes(def.source) ? def.source : 'master');
    const timerNum = Number(cfg.timerSec);
    cfg.timerSec = Number.isFinite(timerNum) && timerNum > 0 ? Math.max(1, Math.round(timerNum)) : null;
    const rawList = Array.isArray(cfg.contentTypes) ? cfg.contentTypes : def.contentTypes;
    const filtered = Array.isArray(rawList) ? rawList.filter(type => PAGE_CONTENT_TYPE_KEYS.has(type)) : [];
    const defaultTypes = Array.isArray(def.contentTypes) ? def.contentTypes.slice() : PAGE_CONTENT_TYPES.map(([key]) => key);
    cfg.contentTypes = filtered.length ? Array.from(new Set(filtered)) : defaultTypes;
    return cfg;
  };
  const pagesRaw = src.display?.pages || {};
  src.display.layoutMode = (src.display.layoutMode === 'split') ? 'split' : 'single';
  src.display.pages = {
    left: sanitizePageConfig(pagesRaw.left, defaultDisplayPages.left),
    right: sanitizePageConfig(pagesRaw.right, defaultDisplayPages.right)
  };
  const hasBadgeArray = Array.isArray(src.slides?.badgeLibrary);
  src.slides.badgeLibrary = sanitizeBadgeLibrary(src.slides.badgeLibrary, {
    assignMissingIds,
    fallback: hasBadgeArray ? undefined : DEFAULTS.slides?.badgeLibrary
  });
  return src;
}

function sanitizeScheduleForCompare(src) {
  return deepClone(src || {});
}

function sanitizeSettingsForCompare(src) {
  return normalizeSettings(src || {}, { assignMissingIds: false });
}

function updateBaseline(scheduleSrc, settingsSrc) {
  baselineSchedule = sanitizeScheduleForCompare(scheduleSrc);
  baselineSettings = sanitizeSettingsForCompare(settingsSrc);
}

function getActiveBaselineSources(){
  if (currentDeviceCtx && deviceBaseSchedule && deviceBaseSettings){
    return { schedule: deviceBaseSchedule, settings: deviceBaseSettings };
  }
  return { schedule: baseSchedule, settings: baseSettings };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object') {
    if (Array.isArray(b)) return false;
    const keysA = Object.keys(a).filter(k => typeof a[k] !== 'undefined').sort();
    const keysB = Object.keys(b).filter(k => typeof b[k] !== 'undefined').sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      if (keysA[i] !== keysB[i]) return false;
    }
    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  return false;
}

function matchesBaseline() {
  if (!baselineSchedule || !baselineSettings) return false;
  const currentSchedule = sanitizeScheduleForCompare(schedule);
  const currentSettings = sanitizeSettingsForCompare(settings);
  return deepEqual(currentSchedule, baselineSchedule) && deepEqual(currentSettings, baselineSettings);
}

function clearDraftsIfPresent() {
  lsRemove('scheduleDraft');
  lsRemove('settingsDraft');
}

function evaluateUnsavedState({ immediate = false } = {}) {
  if (!baselineSchedule || !baselineSettings) return;
  clearTimeout(_unsavedIndicatorTimer);
  if (matchesBaseline()) {
    clearTimeout(_unsavedEvalTimer);
    clearDraftsIfPresent();
    setUnsavedState(false);
    return;
  }
  if (immediate) {
    setUnsavedState(true);
  } else {
    _unsavedIndicatorTimer = setTimeout(() => setUnsavedState(true), 180);
  }
}

function queueUnsavedEvaluation(options) {
  clearTimeout(_unsavedEvalTimer);
  _unsavedEvalTimer = setTimeout(() => {
    _unsavedEvalTimer = 0;
    evaluateUnsavedState(options || {});
  }, 60);
}

function setUnsavedState(state){
  const next = !!state;
  hasUnsavedChanges = next;
  if (unsavedBadge){
    unsavedBadge.hidden = !next;
    unsavedBadge.setAttribute('aria-hidden', next ? 'false' : 'true');
  }
  document.body?.classList.toggle('has-unsaved-changes', next);
  if (!next){
    clearTimeout(_unsavedIndicatorTimer);
    clearTimeout(_unsavedEvalTimer);
  }
}

function restoreFromBaseline(){
  const { schedule: baseSched, settings: baseSet } = getActiveBaselineSources();
  if (!baseSched || !baseSet) return;

  schedule = deepClone(baseSched);
  settings = normalizeSettings(deepClone(baseSet), { assignMissingIds: false });

  try { renderGridUI(); } catch (err) { console.warn('[admin] Grid re-render failed after reset', err); }
  try { renderSlidesBox(); } catch (err) { console.warn('[admin] Slides box re-render failed after reset', err); }
  try { renderHighlightBox(); } catch (err) { console.warn('[admin] Highlight box re-render failed after reset', err); }
  try { renderColors(); } catch (err) { console.warn('[admin] Colors re-render failed after reset', err); }
  try { renderFootnotes(); } catch (err) { console.warn('[admin] Footnotes re-render failed after reset', err); }
  try { renderSlidesMaster(); } catch (err) { console.warn('[admin] Slides master re-render failed after reset', err); }

  clearDraftsIfPresent();
  updateBaseline(baseSched, baseSet);
  setUnsavedState(false);
}

const unsavedBadgeResetBtn = document.getElementById('unsavedBadgeReset');
if (unsavedBadgeResetBtn){
  unsavedBadgeResetBtn.addEventListener('click', (ev)=>{
    ev.preventDefault();
    restoreFromBaseline();
  });
}

function markUnsavedSoon(){
  queueUnsavedEvaluation();
}

function ensureUnsavedChangeListener(){
  if (!_unsavedInputListener){
    _unsavedInputListener = (ev)=>{
      if (!ev?.isTrusted) return;
      if (ev?.target?.type === 'file') return;
      markUnsavedSoon();
      dockPushDebounced();
    };
    document.addEventListener('input',  _unsavedInputListener, true);
    document.addEventListener('change', _unsavedInputListener, true);
  }
  if (!_unsavedBlurListener){
    _unsavedBlurListener = ()=> queueUnsavedEvaluation();
    document.addEventListener('focusout', _unsavedBlurListener, true);
  }
}

try {
  const nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(key, value){
    let result;
    try {
      result = nativeSetItem.apply(this, arguments);
      return result;
    } finally {
      const store = (typeof globalThis !== 'undefined' && globalThis.localStorage) ? globalThis.localStorage : null;
      if (store && this === store && (key === 'scheduleDraft' || key === 'settingsDraft')){
        markUnsavedSoon();
      }
    }
  };
} catch (err) {
  console.warn('[admin] Unsaved badge: Storage patch failed', err);
}

const globalScope = (typeof globalThis === 'object') ? globalThis : (typeof window === 'object' ? window : undefined);
if (globalScope){
  globalScope.__markUnsaved = ()=> evaluateUnsavedState({ immediate: true });
  globalScope.__queueUnsaved = ()=> queueUnsavedEvaluation();
  globalScope.__clearUnsaved = ()=> setUnsavedState(false);
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', ()=> setUnsavedState(hasUnsavedChanges));
} else {
  setUnsavedState(hasUnsavedChanges);
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

  setUnsavedState(unsavedFromDraft);

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
}

// ============================================================================
// 2) Slides & Text (linke Seitenbox „Slideshow & Text“)
// ============================================================================
function renderSlidesBox(){
  const f = settings.fonts || {};
  const setV = (sel, val) => { const el = document.querySelector(sel); if (el) el.value = val; };
  const setC = (sel, val) => { const el = document.querySelector(sel); if (el) el.checked = !!val; };
  const renderTypeList = (hostId, selectedList = []) => {
    const host = document.getElementById(hostId);
    if (!host) return;
    host.innerHTML = '';
    const selected = new Set(Array.isArray(selectedList) ? selectedList.filter(key => PAGE_CONTENT_TYPE_KEYS.has(key)) : []);
    PAGE_CONTENT_TYPES.forEach(([key, label]) => {
      const option = document.createElement('label');
      const input = document.createElement('input');
      const text = document.createElement('span');
      option.className = 'type-pill';
      input.type = 'checkbox';
      input.value = key;
      input.checked = selected.has(key);
      input.addEventListener('change', () => {
        option.classList.toggle('is-checked', input.checked);
      });
      text.textContent = label;
      option.appendChild(input);
      option.appendChild(text);
      if (input.checked) option.classList.add('is-checked');
      host.appendChild(option);
    });
  };

  // Schrift
  setV('#fontFamily', f.family ?? DEFAULTS.fonts.family);
  setV('#fontScale',  f.scale  ?? 1);
  setV('#h1Scale',    f.h1Scale ?? 1);
  setV('#h2Scale',    f.h2Scale ?? 1);
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
  setV('#chipH',        Math.round((f.chipHeight ?? 1)*100));

  // Saunafolien (Kacheln)
  setV('#tileTextScale', f.tileTextScale ?? 0.8);
  setV('#tileWeight',    f.tileWeight    ?? 600);
  setV('#tilePct',       settings.slides?.tileWidthPercent ?? 45);
  setV('#tileMin',       settings.slides?.tileMinScale ?? 0.25);
  setV('#tileMax',       settings.slides?.tileMaxScale ?? 0.57);
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
  renderTypeList('pageLeftTypes', leftCfg.contentTypes);
  renderTypeList('pageRightTypes', rightCfg.contentTypes);
  const layoutModeSelect = document.getElementById('layoutMode');
  const applyLayoutVisibility = (mode) => {
    const rightWrap = document.getElementById('layoutRight');
    if (rightWrap) rightWrap.hidden = (mode !== 'split');
  };
  applyLayoutVisibility(layoutMode);
  if (layoutModeSelect) {
    layoutModeSelect.onchange = () => applyLayoutVisibility(layoutModeSelect.value === 'split' ? 'split' : 'single');
  }

  // Reset-Button (nur Felder dieser Box)
  const reset = document.querySelector('#resetSlides');
  if (!reset) return;
  reset.onclick = ()=>{
    setV('#fontFamily', DEFAULTS.fonts.family);
    setV('#fontScale', 1);
    setV('#h1Scale', 1);
    setV('#h2Scale', 1);

    setV('#h2Mode', DEFAULTS.h2.mode);
    setV('#h2Text', DEFAULTS.h2.text);
    setC('#h2ShowOverview', DEFAULTS.h2.showOnOverview);

    setV('#ovTitleScale', DEFAULTS.fonts.overviewTitleScale);
    setV('#ovHeadScale',  DEFAULTS.fonts.overviewHeadScale);
    setV('#ovCellScale',  DEFAULTS.fonts.overviewCellScale);
    setV('#chipH',        Math.round(DEFAULTS.fonts.chipHeight*100));
    setV('#chipOverflowMode', DEFAULTS.fonts.chipOverflowMode);
    setV('#flamePct',         DEFAULTS.fonts.flamePct);
    setV('#flameGap',         DEFAULTS.fonts.flameGapScale);

    setV('#tileTextScale', DEFAULTS.fonts.tileTextScale);
    setV('#tileWeight',    DEFAULTS.fonts.tileWeight);
    setV('#tilePct',       DEFAULTS.slides.tileWidthPercent);
    setV('#tileMin',       DEFAULTS.slides.tileMinScale);
    setV('#tileMax',       DEFAULTS.slides.tileMaxScale);
    setV('#badgeColor',    DEFAULTS.slides.infobadgeColor);

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
    renderTypeList('pageLeftTypes', defLeft.contentTypes);
    renderTypeList('pageRightTypes', defRight.contentTypes);
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
  const collectTypes = (hostId) => {
    const host = document.getElementById(hostId);
    if (!host) return [];
    return Array.from(host.querySelectorAll('input[type=checkbox]:checked'))
      .map(input => input.value)
      .filter(value => PAGE_CONTENT_TYPE_KEYS.has(value));
  };
  const getSourceValue = (id, fallback) => {
    const el = document.getElementById(id);
    const val = el?.value || fallback;
    return PAGE_SOURCE_KEYS.includes(val) ? val : fallback;
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
        chipHeight:(+($('#chipH').value||100)/100),
        chipOverflowMode: ($('#chipOverflowMode')?.value || 'scale'),
        flamePct:   +($('#flamePct')?.value || 55),
        flameGapScale:+($('#flameGap')?.value || 0.14),
        tileTextScale:+($('#tileTextScale').value||0.8),
        tileWeight:+($('#tileWeight').value||600)
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
        infobadgeColor:(() => {
          const el = document.getElementById('badgeColor');
          const fallback = settings.slides?.infobadgeColor || settings.theme?.accent || DEFAULTS.slides.infobadgeColor || '#5C3101';
          const current = (typeof fallback === 'string' ? fallback.toUpperCase() : '#5C3101');
          const raw = el?.value || '';
          return /^#([0-9A-F]{6})$/i.test(raw) ? raw.toUpperCase() : current;
        })(),
        badgeLibrary: (() => {
          const sanitized = sanitizeBadgeLibrary(settings.slides?.badgeLibrary, { assignMissingIds: true });
          (settings.slides ||= {}).badgeLibrary = sanitized;
          return sanitized;
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
            contentTypes:collectTypes('pageLeftTypes')
          },
          right:{
            ...(((settings.display||{}).pages||{}).right||{}),
            source:getSourceValue('pageRightSource', 'media'),
            timerSec:sanitizeTimer(document.getElementById('pageRightTimer')?.value),
            contentTypes:collectTypes('pageRightTypes')
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