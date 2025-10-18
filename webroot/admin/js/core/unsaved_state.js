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
  let detailTimer = 0;
  let unsavedSince = 0;
  let inputListener = null;
  let blurListener = null;

  const badgeTitle = unsavedBadge?.querySelector('[data-role="unsaved-title"]') || null;
  const badgeDetail = unsavedBadge?.querySelector('[data-role="unsaved-detail"]') || null;
  const savedTitleText = 'Alles gespeichert';
  const savedDetailText = 'Alle Änderungen wurden gespeichert.';

  const clearDetailTimer = () => {
    if (detailTimer) {
      clearInterval(detailTimer);
      detailTimer = 0;
    }
  };

  const describeUnsavedAge = () => {
    if (!unsavedSince) return 'wenigen Augenblicken';
    const diff = Date.now() - unsavedSince;
    if (!Number.isFinite(diff) || diff < 0) {
      return 'wenigen Augenblicken';
    }
    if (diff < 15_000) return 'wenigen Sekunden';
    if (diff < 60_000) return 'unter einer Minute';
    if (diff < 120_000) return 'etwa einer Minute';
    if (diff < 3_600_000) {
      const minutes = Math.round(diff / 60_000);
      return minutes === 1 ? 'etwa einer Minute' : `${minutes} Minuten`;
    }
    const hours = Math.round(diff / 3_600_000);
    return hours === 1 ? 'etwa einer Stunde' : `${hours} Stunden`;
  };

  const updateBadgeMessaging = () => {
    if (!badgeTitle && !badgeDetail) return;
    if (hasUnsavedChanges) {
      if (badgeTitle) {
        badgeTitle.textContent = 'Änderungen ausstehend';
      }
      if (badgeDetail) {
        badgeDetail.textContent = `Zuletzt geändert vor ${describeUnsavedAge()} – bitte speichern.`;
      }
    } else {
      if (badgeTitle) {
        badgeTitle.textContent = savedTitleText;
      }
      if (badgeDetail) {
        badgeDetail.textContent = savedDetailText;
      }
    }
  };

  const ensureDetailTimer = () => {
    if (!badgeDetail || detailTimer) return;
    detailTimer = setInterval(() => {
      if (!hasUnsavedChanges) return;
      if (!badgeDetail) return;
      badgeDetail.textContent = `Zuletzt geändert vor ${describeUnsavedAge()} – bitte speichern.`;
    }, 15_000);
  };

  const clearTimers = () => {
    clearTimeout(indicatorTimer);
    clearTimeout(evalTimer);
    clearDetailTimer();
    indicatorTimer = 0;
    evalTimer = 0;
  };

  const syncDomState = () => {
    if (unsavedBadge) {
      unsavedBadge.hidden = !hasUnsavedChanges;
      unsavedBadge.setAttribute('aria-hidden', hasUnsavedChanges ? 'false' : 'true');
    }
    doc?.body?.classList.toggle('has-unsaved-changes', hasUnsavedChanges);
    updateBadgeMessaging();
  };

  const setUnsavedState = (next, { skipDraftClear = false } = {}) => {
    const prevState = hasUnsavedChanges;
    hasUnsavedChanges = !!next;
    if (hasUnsavedChanges) {
      if (!prevState) {
        unsavedSince = Date.now();
      }
      ensureDetailTimer();
    } else {
      unsavedSince = 0;
    }
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
