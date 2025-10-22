// /admin/js/core/utils.js
// Zentrale Helfer: DOM, Zeit, IDs, String-Escape, Preload, Clone

export const $  = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// Bilder vorladen → {ok,w,h}
export const preloadImg = (url) => new Promise((resolve) => {
  if (!url) return resolve({ ok:false });
  const img = new Image();
  img.onload  = () => resolve({ ok:true, w:img.naturalWidth, h:img.naturalHeight });
  img.onerror = () => resolve({ ok:false });
  img.src = url;
});

// "HH:MM" → validierter String oder null
export const parseTime = (s) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((s||'').trim());
  return m ? (m[1] + ':' + m[2]) : null;
};

// kurze IDs für Fußnoten etc.
export const genId = (prefix = 'fn_') => String(prefix ?? 'fn_') + Math.random().toString(36).slice(2, 9);

// HTML escapen für Option-Labels etc.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'
  }[m]));
}

// simple Deep-Clone (JSON-basiert, reicht für unsere Datenstrukturen)
export const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

export function deepEqual(a, b) {
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
    const keysA = Object.keys(a).filter((key) => typeof a[key] !== 'undefined').sort();
    const keysB = Object.keys(b).filter((key) => typeof b[key] !== 'undefined').sort();
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

function createApiError(message, { status, payload, cause } = {}) {
  const error = new Error(message || 'Unbekannter Fehler');
  if (status) error.status = status;
  if (payload !== undefined) error.payload = payload;
  if (cause) error.cause = cause;
  return error;
}

export async function fetchJson(url, options = {}) {
  const {
    expectOk = false,
    okPredicate,
    errorMessage,
    ...fetchOptions
  } = options || {};

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (cause) {
    throw createApiError(errorMessage || 'Netzwerkfehler: Anfrage fehlgeschlagen.', { cause });
  }

  let payload = null;
  let text = '';
  try {
    text = await response.text();
    if (/[\S]/.test(text)) payload = JSON.parse(text);
  } catch (cause) {
    throw createApiError(errorMessage || 'Server-Antwort ist kein gültiges JSON.', {
      status: response.status,
      payload: text,
      cause
    });
  }

  if (!response.ok) {
    const message = (payload && typeof payload.error === 'string' && payload.error.trim())
      ? payload.error.trim()
      : errorMessage || `Server-Fehler (${response.status})`;
    throw createApiError(message, { status: response.status, payload });
  }

  const predicate = typeof okPredicate === 'function'
    ? okPredicate
    : (data) => (expectOk ? !!(data && data.ok) : true);

  if (!predicate(payload)) {
    const message = (payload && typeof payload.error === 'string' && payload.error.trim())
      ? payload.error.trim()
      : errorMessage || 'Server meldete einen Fehler.';
    throw createApiError(message, { status: response.status, payload });
  }

  return payload;
}

export function mergeDeep(target, source) {
  if (!source || typeof source !== 'object') return target || {};
  const output = (target && typeof target === 'object') ? target : {};
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (!Array.isArray(value) && value && typeof value === 'object') {
      const base = (output[key] && typeof output[key] === 'object' && !Array.isArray(output[key]))
        ? { ...output[key] }
        : {};
      output[key] = mergeDeep(base, value);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}
