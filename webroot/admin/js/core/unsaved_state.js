// /admin/js/core/unsaved_state.js
// Verwaltungsmodul für den Unsaved-Indikator samt Baseline-Handling.

'use strict';

import { deepClone, deepEqual } from './utils.js';

function sanitizeInput(fn, value) {
  if (typeof fn !== 'function') {
    return value == null ? null : deepClone(value);
  }
  return fn(value);
}

function normalizeSettingsValue(fn, value) {
  if (typeof fn !== 'function') {
    return value == null ? null : deepClone(value);
  }
  return fn(value);
}

export function createUnsavedTracker(options = {}) {
  const {
    document: doc = (typeof document === 'object' ? document : undefined),
    window: win = (typeof globalThis === 'object' ? globalThis : (typeof window === 'object' ? window : undefined)),
    unsavedBadge,
    getSchedule,
    getSettings,
    setSchedule,
    setSettings,
    sanitizeSchedule,
    sanitizeSettings,
    normalizeSettings,
    clearDrafts,
    onDirty,
    onRestore,
    onStateChange
  } = options;

  let hasUnsavedChanges = false;
  let baselineSchedule = null;
  let baselineSettings = null;
  let baselineSanitizedSchedule = null;
  let baselineSanitizedSettings = null;
  let indicatorTimer = 0;
  let evalTimer = 0;
  let inputListener = null;
  let blurListener = null;

  const clearTimers = () => {
    clearTimeout(indicatorTimer);
    clearTimeout(evalTimer);
    indicatorTimer = 0;
    evalTimer = 0;
  };

  const syncDomState = () => {
    if (unsavedBadge) {
      unsavedBadge.hidden = !hasUnsavedChanges;
      unsavedBadge.setAttribute('aria-hidden', hasUnsavedChanges ? 'false' : 'true');
    }
    doc?.body?.classList.toggle('has-unsaved-changes', hasUnsavedChanges);
  };

  const setUnsavedState = (next, { skipDraftClear = false } = {}) => {
    hasUnsavedChanges = !!next;
    syncDomState();
    if (!hasUnsavedChanges) {
      clearTimers();
      if (!skipDraftClear) {
        try { clearDrafts?.(); } catch {}
      }
    }
    if (typeof onStateChange === 'function') {
      try { onStateChange(hasUnsavedChanges); } catch {}
    }
  };

  const cloneBaselineSource = (value) => (value == null ? null : deepClone(value));

  const setBaseline = (scheduleSrc, settingsSrc) => {
    baselineSchedule = cloneBaselineSource(scheduleSrc);
    baselineSettings = cloneBaselineSource(settingsSrc);
    baselineSanitizedSchedule = scheduleSrc == null ? null : sanitizeInput(sanitizeSchedule, scheduleSrc);
    baselineSanitizedSettings = settingsSrc == null ? null : sanitizeInput(sanitizeSettings, settingsSrc);
  };

  const getCurrentSanitizedSchedule = () => sanitizeInput(sanitizeSchedule, getSchedule?.());
  const getCurrentSanitizedSettings = () => sanitizeInput(sanitizeSettings, getSettings?.());

  const matchesBaseline = () => {
    if (!baselineSanitizedSchedule || !baselineSanitizedSettings) return false;
    const currentSchedule = getCurrentSanitizedSchedule();
    const currentSettings = getCurrentSanitizedSettings();
    if (!currentSchedule || !currentSettings) return false;
    return deepEqual(currentSchedule, baselineSanitizedSchedule)
      && deepEqual(currentSettings, baselineSanitizedSettings);
  };

  const evaluate = ({ immediate = false } = {}) => {
    if (!baselineSanitizedSchedule || !baselineSanitizedSettings) return;
    clearTimeout(indicatorTimer);
    if (matchesBaseline()) {
      clearTimers();
      try { clearDrafts?.(); } catch {}
      setUnsavedState(false, { skipDraftClear: true });
      return;
    }
    if (immediate) {
      setUnsavedState(true, { skipDraftClear: true });
      return;
    }
    indicatorTimer = setTimeout(() => {
      setUnsavedState(true, { skipDraftClear: true });
    }, 180);
  };

  const queueEvaluation = (options) => {
    clearTimeout(evalTimer);
    evalTimer = setTimeout(() => {
      evalTimer = 0;
      evaluate(options || {});
    }, 60);
  };

  const markSoon = () => queueEvaluation();

  const ensureListeners = () => {
    if (!doc) return;
    if (!inputListener) {
      inputListener = (ev) => {
        if (!ev?.isTrusted) return;
        if (ev?.target?.type === 'file') return;
        markSoon();
        try { onDirty?.(); } catch {}
      };
      doc.addEventListener('input', inputListener, true);
      doc.addEventListener('change', inputListener, true);
    }
    if (!blurListener) {
      blurListener = () => queueEvaluation();
      doc.addEventListener('focusout', blurListener, true);
    }
  };

  const restoreBaseline = () => {
    if (!baselineSchedule || !baselineSettings) return;
    if (typeof setSchedule === 'function') {
      try { setSchedule(cloneBaselineSource(baselineSchedule)); } catch {}
    }
    if (typeof setSettings === 'function') {
      try {
        const cloned = cloneBaselineSource(baselineSettings);
        const normalized = normalizeSettingsValue(normalizeSettings, cloned);
        setSettings(normalized);
      } catch {}
    }
    if (typeof onRestore === 'function') {
      try { onRestore(); } catch {}
    }
    try { clearDrafts?.(); } catch {}
    setUnsavedState(false, { skipDraftClear: true });
    setBaseline(getSchedule?.(), getSettings?.());
  };

  const setupStoragePatch = () => {
    if (!win) return;
    if (win.__unsavedTrackerStoragePatched) return;
    try {
      const nativeSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function patchedSetItem(key, value) {
        let result;
        try {
          result = nativeSetItem.apply(this, arguments);
          return result;
        } finally {
          const store = (typeof win.localStorage !== 'undefined') ? win.localStorage : null;
          if (store && this === store && (key === 'scheduleDraft' || key === 'settingsDraft')) {
            markSoon();
          }
        }
      };
      win.__unsavedTrackerStoragePatched = true;
    } catch (err) {
      console.warn('[admin] Unsaved badge: Storage patch failed', err);
    }
  };

  const exposeGlobals = () => {
    if (!win) return;
    win.__markUnsaved = () => evaluate({ immediate: true });
    win.__queueUnsaved = () => queueEvaluation();
    win.__clearUnsaved = () => setUnsavedState(false);
  };

  const initDomSync = () => {
    const sync = () => setUnsavedState(hasUnsavedChanges, { skipDraftClear: true });
    if (!doc) return sync();
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', sync, { once: true });
    } else {
      sync();
    }
  };

  setupStoragePatch();
  exposeGlobals();
  initDomSync();

  return {
    setBaseline,
    evaluate,
    queueEvaluation,
    markSoon,
    setUnsavedState,
    restoreBaseline,
    ensureListeners,
    hasUnsaved: () => hasUnsavedChanges
  };
}
