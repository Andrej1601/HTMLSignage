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
