/**
 * Device specific helpers for entering/leaving a device override context.
 *
 * @module core/device_context
 */

import { deepClone, mergeDeep } from './utils.js';
import { normalizeSettings } from './config.js';
import { notifyError, notifyWarning } from './notifications.js';

/**
 * Normalises badge metadata so the UI can render a consistent badge.
 *
 * @param {unknown} source
 * @returns {{icon: string, imageUrl: string, label: string}|null}
 */
export function normalizeContextBadge(source) {
  if (!source) return null;
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (!trimmed) return null;
    const isUrl = /^(?:https?:)?\//i.test(trimmed) || /^data:/i.test(trimmed);
    if (isUrl) return { icon: '', imageUrl: trimmed, label: '' };
    return { icon: trimmed, imageUrl: '', label: '' };
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

/**
 * @typedef {ReturnType<import('./app_state.js').createAppState>} AppStateApi
 */

/**
 * Factory that encapsulates device context related behaviour.
 *
 * @param {Object} deps
 * @param {Document} deps.document
 * @param {AppStateApi} deps.state
 * @param {(schedule: any, settings: any) => void} deps.updateBaseline
 * @param {(options?: { immediate?: boolean }) => void} deps.evaluateUnsavedState
 * @param {(value: boolean, options?: any) => void} deps.setUnsavedState
 * @param {() => void} deps.refreshAllUi
 * @param {(view: 'grid'|'preview') => Promise<void>|void} deps.showView
 * @param {(id: string) => Promise<any>} deps.loadDeviceById
 * @returns {{enterDeviceContext: Function, exitDeviceContext: Function, renderContextBadge: Function, getDeviceContext: Function}}
 */
export function createDeviceContextManager({
  document,
  state,
  updateBaseline,
  evaluateUnsavedState,
  setUnsavedState,
  refreshAllUi,
  showView,
  loadDeviceById
}) {
  const renderContextBadge = () => {
    const header = document?.querySelector('header');
    const actions = header?.querySelector('.header-actions');
    if (!header) return;
    let wrap = header.querySelector('.ctx-wrap');
    let el = document.getElementById('ctxBadge');
    const ctx = state.getDeviceContext();
    if (!ctx.id) {
      if (wrap) wrap.remove();
      return;
    }
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'ctx-wrap';
    }
    if (actions) {
      header.insertBefore(wrap, actions);
    } else if (!wrap.isConnected) {
      header.appendChild(wrap);
    }
    if (!el) {
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
    if (textEl) {
      textEl.textContent = `Kontext: ${ctx.name || ctx.id}`;
    }

    const mediaWrap = el.querySelector('.ctx-badge-media');
    const mediaImage = el.querySelector('.ctx-badge-media-image');
    const mediaIcon = el.querySelector('.ctx-badge-media-icon');
    const badge = ctx.badge;
    if (mediaWrap && mediaImage && mediaIcon) {
      const iconText = (badge?.icon || '').trim();
      const imageUrl = (badge?.imageUrl || '').trim();
      if (badge && (iconText || imageUrl)) {
        if (imageUrl) {
          mediaImage.src = imageUrl;
          mediaImage.hidden = false;
          mediaIcon.hidden = true;
          mediaIcon.textContent = '';
        } else {
          mediaIcon.textContent = iconText;
          mediaIcon.hidden = false;
          mediaImage.hidden = true;
        }
        mediaWrap.hidden = false;
        el.classList.add('has-media');
      } else {
        mediaWrap.hidden = true;
        mediaImage.hidden = true;
        mediaIcon.hidden = true;
        mediaIcon.textContent = '';
        el.classList.remove('has-media');
      }
    }
  };

  const enterDeviceContext = async (deviceLike, fallbackName) => {
    const provided = (deviceLike && typeof deviceLike === 'object') ? deviceLike : null;
    const rawId = provided?.id ?? deviceLike;
    const deviceId = typeof rawId === 'string' ? rawId : String(rawId ?? '');
    if (!deviceId) {
      notifyWarning('Gerät wurde nicht gefunden.');
      return;
    }

    let device = provided;
    if (!device?.overrides?.settings) {
      try {
        device = await loadDeviceById(deviceId);
      } catch (error) {
        console.error('[admin] Geräte-Kontext konnte nicht geladen werden', error);
        notifyError('Gerät konnte nicht geladen werden: ' + error.message);
        return;
      }
    }

    const overrides = (device?.overrides?.settings && typeof device.overrides.settings === 'object')
      ? device.overrides.settings
      : {};
    const badgeSource = device?.badgeSource ?? device?.badge ?? device?.badgeInfo ?? null;

    state.setDeviceContext({
      id: deviceId,
      name: device?.name || fallbackName || deviceId,
      badge: normalizeContextBadge(badgeSource)
    });
    document?.body?.classList.add('device-mode');

    const base = state.getBaseState() || {};
    const mergedSettings = mergeDeep(deepClone(base.settings || {}), overrides);
    const normalizedSettings = normalizeSettings(mergedSettings, { assignMissingIds: false });
    state.setSettings(normalizedSettings);

    const scheduleClone = deepClone(state.getSchedule());
    const settingsClone = deepClone(normalizedSettings);
    state.setDeviceBaseState(scheduleClone, settingsClone);
    updateBaseline(scheduleClone, settingsClone);
    setUnsavedState(false);

    refreshAllUi();
    if (typeof showView === 'function') showView('grid');
  };

  const exitDeviceContext = () => {
    state.clearDeviceContext();
    document?.body?.classList.remove('device-mode');

    const base = state.getBaseState() || {};
    const baseSettings = deepClone(base.settings || {});
    const baseSchedule = deepClone(base.schedule || {});
    state.setSettings(baseSettings);
    state.setSchedule(baseSchedule);
    state.clearDeviceBaseState();
    updateBaseline(baseSchedule, baseSettings);
    evaluateUnsavedState({ immediate: true });
    refreshAllUi();
  };

  return {
    enterDeviceContext,
    exitDeviceContext,
    renderContextBadge,
    getDeviceContext: () => state.getDeviceContext()
  };
}

export default createDeviceContextManager;
