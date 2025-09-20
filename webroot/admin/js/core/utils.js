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
