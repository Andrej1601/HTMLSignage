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
import { initContextHelp } from './ui/context_help.js';
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

function getPanelHost(id){
  const host = document.getElementById(id);
  if (!host) return null;
  if (!host.__placeholder) {
    const placeholder = host.querySelector('.panel-placeholder');
    if (placeholder) host.__placeholder = placeholder;
  }
  return host;
}

async function createDevicesPane(){
  const host = getPanelHost('devicesPaneHost');
  if (!host) return null;

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

  if (host.__placeholder && host.__placeholder.parentElement === host) {
    host.__placeholder.remove();
  }
  host.appendChild(card);

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
  const host = getPanelHost('previewPaneHost');
  if (!host) return null;

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
  if (host.__placeholder && host.__placeholder.parentElement === host) {
    host.__placeholder.remove();
  }
  host.appendChild(wrap);

  const frame = wrap.querySelector('#dockFrame');
  frame.src = SLIDESHOW_ORIGIN + '/?preview=1';
  frame.addEventListener('load', ()=> dockSend(false), { once:true });
  wrap.querySelector('#dockReload')?.addEventListener('click', ()=> dockSend(true));

  setDockPane(wrap);
  return wrap;
}

function destroyDockPane(){
  const host = getPanelHost('previewPaneHost');
  const pane = document.getElementById('dockPane');
  if (pane){
    const frame = pane.querySelector('#dockFrame');
    if (frame) frame.src = 'about:blank';
    pane.remove();
  }
  setDockPane(null);
  if (host && !host.childElementCount && host.__placeholder) {
    host.appendChild(host.__placeholder);
  }
}

function destroyDevicesPane(){
  const pane = getDevicesPane();
  const host = getPanelHost('devicesPaneHost');
  if (pane){
    clearInterval(pane.__refreshInterval);
    window.__refreshDevicesPane = undefined;
    pane.remove();
    setDevicesPane(null);
  }
  if (host && !host.childElementCount && host.__placeholder) {
    host.appendChild(host.__placeholder);
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

  detachDockLivePush();
  await applyDevicesPaneState();

  if (v === 'grid'){
    destroyDockPane();
    document.dispatchEvent(new CustomEvent('shell:show-panel', {
      detail: { panel: 'planning', focus: '#gridPane' }
    }));
    return;
  }

  if (!document.getElementById('dockPane')) createDockPane();
  attachDockLivePush();
  document.dispatchEvent(new CustomEvent('shell:show-panel', {
    detail: { panel: 'monitoring', focus: '#dockPane' }
  }));
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
