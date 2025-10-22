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
import { ensureBadgeLibrary } from './core/badge_library.js';
import { initGridUI, renderGrid as renderGridUI } from './ui/grid.js';
import { initSlidesMasterUI, renderSlidesMaster, getActiveDayKey, syncActiveStyleSetSnapshot } from './ui/slides_master.js';
import { initGridDayLoader } from './ui/grid_day_loader.js';
import { uploadGeneric } from './core/upload.js';
import { createUnsavedTracker } from './core/unsaved_state.js';
import storage from './core/storage.js';
import { createAppState } from './core/app_state.js';
import { createDeviceContextManager } from './core/device_context.js';
import { registerStateAccess } from './app/state_store.js';
import { createRoleRestrictionApplier } from './app/access_control.js';
import { initSidebarResize as initSidebarResizeModule } from './app/sidebar_resize.js';
import { createSlidesPanel } from './app/panels/slides_panel.js';
import { createHighlightPanel } from './app/panels/highlight_panel.js';
import { createColorsPanel } from './app/panels/colors_panel.js';
import { createFootnotesPanel } from './app/panels/footnotes_panel.js';
import {
  mergeAvailablePermissions,
  resolvePermissionsForRoles,
  normalizeRoleName,
  normalizePermissionName,
  createPermissionSet
} from './core/permissions.js';
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from './core/notifications.js';
import {
  PAGE_CONTENT_TYPE_KEYS,
  PAGE_SOURCE_KEYS,
  sanitizePagePlaylist,
  sanitizeBadgeLibrary,
  normalizeSettings,
  sanitizeScheduleForCompare,
  sanitizeSettingsForCompare,
  normalizeSaunaHeadingWidth,
  SAUNA_HEADING_WIDTH_LIMITS
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
let authServiceModulePromise = null;
let authServiceCatalogInitialized = false;
let authRolesCatalog = ['saunameister', 'editor', 'admin'];

const ensureAuthServiceModule = () => {
  if (!authServiceModulePromise) {
    authServiceModulePromise = import('./core/auth_service.js').then((module) => {
      if (!authServiceCatalogInitialized) {
        authServiceCatalogInitialized = true;
        if (Array.isArray(module.AVAILABLE_PERMISSIONS) && module.AVAILABLE_PERMISSIONS.length) {
          availablePermissions = mergeAvailablePermissions(module.AVAILABLE_PERMISSIONS);
        }
      }
      if (Array.isArray(module.AVAILABLE_ROLES) && module.AVAILABLE_ROLES.length) {
        authRolesCatalog = module.AVAILABLE_ROLES.slice();
      }
      return module;
    });
  }
  return authServiceModulePromise;
};

const SLIDESHOW_ORIGIN = window.SLIDESHOW_ORIGIN || location.origin;
const THUMB_FALLBACK = '/assets/img/thumb_fallback.svg';

const lsGet = (key) => storage.get(key);
const lsSet = (key, value) => storage.set(key, value);
const lsRemove = (key) => storage.remove(key);


let availablePermissions = mergeAvailablePermissions();
const defaultAdminPermissions = resolvePermissionsForRoles(['admin']);

let currentUser = { username: null, displayName: null, roles: ['admin'], permissions: defaultAdminPermissions };
let currentUserRoles = new Set(currentUser.roles.map((role) => normalizeRoleName(role)));
let currentUserPermissions = createPermissionSet(currentUser.permissions);

const hasRole = (role) => currentUserRoles.has(normalizeRoleName(role));
const hasPermission = (permission) => currentUserPermissions.has(normalizePermissionName(permission));

let lazyModuleManagerPromise = null;

const ensureLazyModuleManager = async () => {
  if (!lazyModuleManagerPromise) {
    lazyModuleManagerPromise = Promise.all([
      import('./app/lazy_modules.js'),
      ensureAuthServiceModule()
    ])
      .then(([{ createLazyModuleManager }, authService]) => createLazyModuleManager({
        hasPermission,
        fetchJson,
        fetchUserAccounts: authService.fetchUsers,
        saveUserAccount: authService.saveUser,
        deleteUserAccount: authService.deleteUser,
        authRoles: authRolesCatalog,
        getAvailablePermissions: () => availablePermissions,
        setAvailablePermissions: (permissions) => {
          availablePermissions = permissions;
        },
        mergeAvailablePermissions
      }))
      .catch((error) => {
        console.error('[admin] Lazy-Module konnten nicht vorbereitet werden', error);
        lazyModuleManagerPromise = null;
        throw error;
      });
  }
  return lazyModuleManagerPromise;
};

const setupLazyAdminModules = async () => {
  if (!hasPermission('system') && !hasPermission('user-admin')) {
    return;
  }
  try {
    const manager = await ensureLazyModuleManager();
    manager.setupLazyAdminModules();
  } catch (error) {
    console.error('[admin] Lazy-Module konnten nicht initialisiert werden', error);
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

let setUnsavedStateImpl = () => {};
const setUnsavedState = (state, options) => setUnsavedStateImpl(state, options);
let unsavedHasChangesImpl = () => false;
const unsavedHasChanges = () => unsavedHasChangesImpl();
let resetUnsavedBaselineImpl = () => {};
const resetUnsavedBaseline = (options) => resetUnsavedBaselineImpl(options);
let queueUnsavedEvaluationImpl = () => {};
const queueUnsavedEvaluation = (options) => queueUnsavedEvaluationImpl(options);

const OVERVIEW_TIME_BASE_CH = 10;
const OVERVIEW_TIME_SCALE_MIN = 0.5;
const OVERVIEW_TIME_SCALE_MAX = 3;

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

const resolveOverviewTimeWidthScale = (fonts = {}, { fallback = 1 } = {}) => {
  const rawScale = Number(fonts?.overviewTimeWidthScale);
  if (Number.isFinite(rawScale) && rawScale > 0) {
    return clampNumber(rawScale, OVERVIEW_TIME_SCALE_MIN, OVERVIEW_TIME_SCALE_MAX);
  }
  const legacyWidth = Number(fonts?.overviewTimeWidthCh);
  if (Number.isFinite(legacyWidth) && legacyWidth > 0) {
    const legacyScale = legacyWidth / OVERVIEW_TIME_BASE_CH;
    return clampNumber(legacyScale, OVERVIEW_TIME_SCALE_MIN, OVERVIEW_TIME_SCALE_MAX);
  }
  return clampNumber(fallback, OVERVIEW_TIME_SCALE_MIN, OVERVIEW_TIME_SCALE_MAX);
};

const stateAccess = {
  getSchedule: () => schedule,
  getSettings: () => settings,
  setSchedule: (next) => {
    schedule = next;
    appState.setSchedule(next);
    if (typeof window === 'object') {
      try { window.__queueUnsaved?.(); } catch {}
    }
  },
  setSettings: (next) => {
    settings = next;
    appState.setSettings(next);
    if (typeof window === 'object') {
      try { window.__queueUnsaved?.(); } catch {}
    }
  }
};

const { renderSlidesBox } = createSlidesPanel({
  getSettings: () => settings,
  thumbFallback: THUMB_FALLBACK,
  setUnsavedState,
  resolveOverviewTimeWidthScale
});

const { renderHighlightBox } = createHighlightPanel({
  getSettings: () => settings,
  thumbFallback: THUMB_FALLBACK,
  updateFlamePreview
});

const { renderColors, collectColors } = createColorsPanel({
  getSettings: () => settings
});

const { renderFootnotes } = createFootnotesPanel({
  getSettings: () => settings
});



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

registerStateAccess({
  getSchedule: () => schedule,
  setSchedule: (next) => {
    schedule = next;
  },
  getSettings: () => settings,
  setSettings: (next) => {
    settings = next;
  },
  setBaseState: (scheduleValue, settingsValue) => {
    baseSchedule = scheduleValue;
    baseSettings = settingsValue;
  },
  getBaseState: () => ({ schedule: baseSchedule, settings: baseSettings }),
  setDeviceBaseState: (scheduleValue, settingsValue) => {
    deviceBaseSchedule = scheduleValue;
    deviceBaseSettings = settingsValue;
  },
  getDeviceBaseState: () => ({ schedule: deviceBaseSchedule, settings: deviceBaseSettings }),
  clearDeviceBaseState: () => {
    deviceBaseSchedule = null;
    deviceBaseSettings = null;
  },
  setDeviceContext: (ctx) => deviceContextState.setDeviceContext(ctx),
  getDeviceContext: () => deviceContextState.getDeviceContext(),
  clearDeviceContext: () => deviceContextState.clearDeviceContext(),
  setCurrentView: (view) => deviceContextState.setCurrentView(view),
  getCurrentView: () => deviceContextState.getCurrentView(),
  setDevicesPinned: (flag) => deviceContextState.setDevicesPinned(flag),
  isDevicesPinned: () => deviceContextState.isDevicesPinned(),
  setDockPane: (pane) => deviceContextState.setDockPane(pane),
  getDockPane: () => deviceContextState.getDockPane(),
  setDevicesPane: (pane) => deviceContextState.setDevicesPane(pane),
  getDevicesPane: () => deviceContextState.getDevicesPane()
});

function createGridContext() {
  return {
    getSchedule: stateAccess.getSchedule,
    getSettings: stateAccess.getSettings,
    setSchedule: stateAccess.setSchedule,
    notifyScheduleChanged: (info = {}) => {
      const reason = typeof info?.reason === 'string' ? info.reason : 'grid-update';
      safeInvoke(`[admin] Slides master sync failed after grid change (${reason})`, () => {
        renderSlidesMaster();
      });
    },
    hasUnsavedChanges: () => unsavedHasChanges(),
    resetUnsavedBaseline: (options) => resetUnsavedBaseline(options || {}),
    queueUnsavedEvaluation: (options) => queueUnsavedEvaluation(options || {})
  };
}

function createSlidesMasterContext() {
  return {
    getSchedule: stateAccess.getSchedule,
    getSettings: stateAccess.getSettings,
    setSchedule: stateAccess.setSchedule,
    setSettings: stateAccess.setSettings,
    refreshSlidesBox: renderSlidesBox,
    refreshColors: renderColors,
    hasUnsavedChanges: () => unsavedHasChanges(),
    resetUnsavedBaseline: (options) => resetUnsavedBaseline(options || {}),
    queueUnsavedEvaluation: (options) => queueUnsavedEvaluation(options || {})
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
  const fallbackHeading = DEFAULTS.slides?.saunaTitleMaxWidthPercent ?? SAUNA_HEADING_WIDTH_LIMITS.inputMax;
  const sanitizeSlidesDraft = (target) => {
    if (!target || typeof target !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(target, 'badgeLibrary')) {
      target.badgeLibrary = sanitizeBadgeLibrary(target.badgeLibrary, { assignMissingIds: true });
    }
    if (Object.prototype.hasOwnProperty.call(target, 'customBadgeEmojis')) {
      const list = Array.isArray(target.customBadgeEmojis)
        ? target.customBadgeEmojis.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
        : [];
      if (list.length) target.customBadgeEmojis = list;
      else delete target.customBadgeEmojis;
    }
    if (Object.prototype.hasOwnProperty.call(target, 'saunaTitleMaxWidthPercent')) {
      target.saunaTitleMaxWidthPercent = normalizeSaunaHeadingWidth(
        target.saunaTitleMaxWidthPercent,
        { fallback: fallbackHeading }
      );
    }
  };

  if (source.slides && typeof source.slides === 'object') {
    sanitizeSlidesDraft(source.slides);
    const sets = source.slides.styleSets;
    if (sets && typeof sets === 'object') {
      Object.values(sets).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        sanitizeSlidesDraft(entry.slides);
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
setUnsavedStateImpl = (state, options) => unsavedTracker.setUnsavedState(state, options);
const restoreFromBaseline = unsavedTracker.restoreBaseline;
const ensureUnsavedChangeListener = unsavedTracker.ensureListeners;
queueUnsavedEvaluationImpl = (options) => unsavedTracker.queueEvaluation(options || {});

if (typeof window === 'object') {
  const originalQueueUnsaved = window.__queueUnsaved;
  if (typeof originalQueueUnsaved === 'function' && !window.__queueUnsavedPatched) {
    window.__queueUnsaved = (...args) => {
      const result = originalQueueUnsaved(...args);
      try {
        const currentSettings = stateAccess.getSettings?.() || settings;
        if (currentSettings) syncActiveStyleSetSnapshot(currentSettings);
      } catch (error) {
        console.warn('[admin] Style palette sync failed after unsaved queue', error);
      }
      return result;
    };
    window.__queueUnsavedPatched = true;
  }
}
unsavedHasChangesImpl = () => unsavedTracker.hasUnsaved();
resetUnsavedBaselineImpl = ({ skipDraftClear = true } = {}) => {
  updateBaseline(stateAccess.getSchedule(), stateAccess.getSettings());
  setUnsavedState(false, { skipDraftClear });
};

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

const initSidebarResize = () => initSidebarResizeModule({ lsGet, lsSet });

// ============================================================================
// 0) Zugriff & Rollensteuerung
// ============================================================================
async function resolveCurrentUser() {
  const authService = await ensureAuthServiceModule();
  try {
    const session = await authService.fetchSession();
    const payload = session?.user || {};
    const normalizedRoles = Array.isArray(payload.roles)
      ? payload.roles
        .map((role) => normalizeRoleName(role))
        .filter((role) => role)
      : [];
    currentUserRoles = normalizedRoles.length ? new Set(normalizedRoles) : new Set();
    const normalizedPermissions = Array.isArray(payload.permissions)
      ? payload.permissions
        .map((permission) => normalizePermissionName(permission))
        .filter((permission) => permission)
      : [];
    const fallbackPermissions = normalizedPermissions.length
      ? normalizedPermissions
      : resolvePermissionsForRoles(Array.from(currentUserRoles));
    currentUserPermissions = createPermissionSet(fallbackPermissions);
    currentUser = {
      username: typeof payload.username === 'string' ? payload.username : null,
      displayName: typeof payload.displayName === 'string' && payload.displayName !== ''
        ? payload.displayName
        : null,
      roles: Array.from(currentUserRoles),
      permissions: Array.from(currentUserPermissions)
    };
    if (currentUser.roles.length === 0 && normalizedRoles.length === 0 && session?.ok === false) {
      currentUser.roles = ['admin'];
      currentUserRoles = new Set(['admin']);
      currentUserPermissions = createPermissionSet(resolvePermissionsForRoles(['admin']));
      currentUser.permissions = Array.from(currentUserPermissions);
    }
  } catch (error) {
    console.warn('[admin] Benutzerstatus konnte nicht geladen werden', error);
    currentUser = { username: null, displayName: null, roles: ['admin'], permissions: resolvePermissionsForRoles(['admin']) };
    currentUserRoles = new Set(['admin']);
    currentUserPermissions = createPermissionSet(currentUser.permissions);
  }
  try {
    window.__currentUser = currentUser;
    window.__currentUserRoles = Array.from(currentUserRoles);
    window.__currentUserPermissions = Array.from(currentUserPermissions);
  } catch {}
}

const applyRoleRestrictions = createRoleRestrictionApplier({
  hasPermission,
  getAvailablePermissions: () => availablePermissions,
  setDevicesPinned,
  lsRemove,
  destroyDevicesPane
});

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
    notifyError('Fehler beim Laden der Daten: ' + error.message);
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
  await setupLazyAdminModules();
  initViewMenu();
  initSidebarResize();
}

// ============================================================================
// 2) Slides & Text (linke Seitenbox „Slideshow & Text“)
// ============================================================================


// ============================================================================
// 3) Highlights & Flames (rechte Box „Slideshow & Text“ – unterer Teil)
// ============================================================================


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






// ============================================================================
// 5) Fußnoten
// ============================================================================




// ============================================================================
// 6) Speichern / Preview / Export / Import
// ============================================================================


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
        overviewTimeScale:(() => {
          const raw = Number($('#ovTimeScale')?.value);
          if (!Number.isFinite(raw)) {
            return settings.fonts?.overviewTimeScale ?? settings.fonts?.overviewCellScale ?? DEFAULTS.fonts.overviewTimeScale ?? 0.8;
          }
          return clamp(0.5, raw, 3);
        })(),
        overviewTimeWidthScale:(() => {
          const raw = Number($('#ovTimeWidthScale')?.value);
          if (Number.isFinite(raw) && raw > 0) {
            return clamp(OVERVIEW_TIME_SCALE_MIN, raw, OVERVIEW_TIME_SCALE_MAX);
          }
          return resolveOverviewTimeWidthScale(settings.fonts, {
            fallback: DEFAULTS.fonts?.overviewTimeWidthScale ?? 1
          });
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
        styleSets: deepClone(settings.slides?.styleSets || {}),
        styleAutomation: deepClone(settings.slides?.styleAutomation || {}),
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
          const el = $('#saunaHeadingWidth');
          const fallback = settings.slides?.saunaTitleMaxWidthPercent
            ?? DEFAULTS.slides.saunaTitleMaxWidthPercent
            ?? SAUNA_HEADING_WIDTH_LIMITS.inputMax;
          return normalizeSaunaHeadingWidth(el?.value, { fallback });
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
          const library = ensureBadgeLibrary(settings);
          return library.map((entry) => ({ ...entry }));
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
        heroTimelineScrollSpeed: (() => {
          const el = document.getElementById('heroTimelineScrollSpeed');
          const fallback = settings?.slides?.heroTimelineScrollSpeed ?? (DEFAULTS?.slides?.heroTimelineScrollSpeed ?? 28);
          const raw = Number(el?.value);
          if (!Number.isFinite(raw) || raw <= 0) return Math.max(4, Math.round(fallback));
          return Math.max(4, Math.round(raw));
        })(),
        heroTimelineScrollPauseMs: (() => {
          const el = document.getElementById('heroTimelineScrollPause');
          const fallback = settings?.slides?.heroTimelineScrollPauseMs ?? (DEFAULTS?.slides?.heroTimelineScrollPauseMs ?? 4000);
          const fallbackMs = Number.isFinite(fallback) && fallback >= 0
            ? Math.max(0, Math.round(fallback < 1000 ? fallback * 1000 : fallback))
            : 4000;
          const raw = Number(el?.value);
          if (!Number.isFinite(raw) || raw < 0) return fallbackMs;
          return Math.max(0, Math.round(raw * 1000));
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
      notifySuccess('Gespeichert (Global).');
    } catch (error) {
      console.error('[admin] Speichern (global) fehlgeschlagen', error);
      notifyError('Fehler: ' + error.message);
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
      notifySuccess('Gespeichert für Gerät: ' + (ctx.name || ctx.id));
    } catch (error) {
      console.error('[admin] Speichern (Gerät) fehlgeschlagen', error);
      notifyError('Fehler: ' + error.message);
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
    notifyWarning('Bitte einen 6-stelligen Code eingeben.'); return;
  }
  let response;
  try {
    response = await claimDevice(code, name);
  } catch (error) {
    console.error('[admin] Pairing fehlgeschlagen', error);
    notifyError('Fehler: ' + error.message);
    return;
  }

  // kleine Quality-of-life Info:
  if (response.deviceId) {
    const url = SLIDESHOW_ORIGIN + '/?device=' + response.deviceId;
    console.log('Gepaart:', response.deviceId, url);
  }
  // Pane neu laden (siehe createDevicesPane -> render)
  await refreshDevicesPane({ bypassCache: true });
  notifySuccess('Gerät gekoppelt' + (response.already ? ' (war bereits gekoppelt)' : '') + '.');
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
            notifyError('Fehler: ' + error.message);
            modeInput.checked = !desiredMode;
            const rollback = !!modeInput.checked;
            modeLabel.textContent = rollback ? 'Individuell' : 'Global';
            row.classList.toggle('ind', rollback);
            modeWrap.classList.toggle('ind-active', rollback);
          }
        });

        row.querySelector('[data-unpair]')?.addEventListener('click', async () => {
          if (!/^dev_/.test(String(device.id))) {
            notifyWarning('Dieses Gerät hat eine alte/ungültige ID. Bitte ein neues Gerät koppeln und das alte ignorieren.');
            return;
          }
          const check = prompt('Wirklich trennen? Tippe „Ja“ zum Bestätigen:');
          if ((check || '').trim().toLowerCase() !== 'ja') return;
          try {
            await unpairDevice(device.id, { purge: true });
            notifySuccess('Gerät getrennt.');
            await render({ bypassCache: true });
          } catch (error) {
            console.error('[admin] Gerät trennen fehlgeschlagen', error);
            notifyError('Fehler: ' + error.message);
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
              notifyInfo('URL kopiert: ' + url);
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
              notifySuccess('Name gespeichert.');
              await render({ bypassCache: true });
            } catch (error) {
              console.error('[admin] Gerät umbenennen fehlgeschlagen', error);
              notifyError('Fehler: ' + error.message);
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
      notifySuccess(`Bereinigt: ${deletedDevices} Geräte, ${deletedPairings} Pairing-Codes.`);
      await triggerRender({ bypassCache: true });
    } catch (error) {
      console.error('[admin] Gerätebereinigung fehlgeschlagen', error);
      notifyError('Fehler: ' + error.message);
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
    notifyWarning('Geräte-Vorschau nicht verfügbar (siehe Konsole).');
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

  const canUseDevices = hasPermission('devices');
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
    if (!btnDevices || !canUseDevices) return;
    const pinned = isDevicesPinned();
    btnDevices.classList.toggle('active', pinned);
    btnDevices.setAttribute('aria-pressed', pinned ? 'true' : 'false');
  };
  const toggleDevicesPane = async ()=>{
    if (!canUseDevices) return;
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
    if (e.key === '3' && canUseDevices) { await toggleDevicesPane(); closeMenu(); }
  });

  if (btnDevices) {
    if (canUseDevices) {
      btnDevices.onclick = toggleDevicesPane;
      updateDevicesButton();
    } else {
      btnDevices.remove();
    }
  }

  document.getElementById('viewMenuLabel').textContent = viewLabel(getCurrentView());
  // Initial zeichnen
  Promise.resolve().then(()=> showView(getCurrentView()));
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
// 10) Start
// ============================================================================
async function bootstrap(){
  await resolveCurrentUser();
  applyRoleRestrictions();
  await loadAll();
}

bootstrap().catch((error) => {
  console.error('[admin] Initialisierung fehlgeschlagen', error);
});
