// /admin/js/core/config.js
// Gemeinsame Konstanten & Sanitizer für Einstellungen und Playlists.

'use strict';

import { DEFAULTS } from './defaults.js';
import { deepClone, genId } from './utils.js';

export const PAGE_CONTENT_TYPES = [
  ['overview', 'Übersicht'],
  ['sauna', 'Saunen'],
  ['hero-timeline', 'Hero-Timeline'],
  ['story', 'Erklärungen'],
  ['image', 'Bilder'],
  ['video', 'Videos'],
  ['url', 'Webseiten']
];

export const PAGE_CONTENT_TYPE_KEYS = new Set(PAGE_CONTENT_TYPES.map(([key]) => key));

export const PAGE_SOURCE_KEYS = ['master', 'schedule', 'media', 'story'];

export const SOURCE_PLAYLIST_LIMITS = {
  master: null,
  schedule: new Set(['overview', 'sauna', 'hero-timeline']),
  media: new Set(['media']),
  story: new Set(['story'])
};

export function playlistKeyFromSanitizedEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  switch (entry.type) {
    case 'overview':
    case 'hero-timeline':
      return entry.type;
    case 'sauna':
      return entry.name ? 'sauna:' + entry.name : null;
    case 'story':
      return entry.id != null ? 'story:' + String(entry.id) : null;
    case 'media':
      return entry.id != null ? 'media:' + String(entry.id) : null;
    default:
      return null;
  }
}

function playlistEntryKey(entry) {
  if (!entry || typeof entry !== 'object') return null;
  let type = String(entry.type || '').trim();
  if (!type) return null;
  if (type === 'image' || type === 'video' || type === 'url') type = 'media';
  switch (type) {
    case 'overview':
    case 'hero-timeline':
      return type;
    case 'sauna': {
      const name = typeof entry.name === 'string'
        ? entry.name
        : (typeof entry.sauna === 'string' ? entry.sauna : '');
      return name ? 'sauna:' + name : null;
    }
    case 'story': {
      const rawId = entry.id ?? entry.storyId;
      return rawId != null ? 'story:' + String(rawId) : null;
    }
    case 'media': {
      const rawId = entry.id ?? entry.mediaId ?? entry.__id ?? entry.slug;
      return rawId != null ? 'media:' + String(rawId) : null;
    }
    default:
      return null;
  }
}

export function sanitizePagePlaylist(list = []) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  const seen = new Set();
  for (const entry of list) {
    const key = playlistEntryKey(entry);
    if (!key || seen.has(key)) continue;
    const [prefix, rest] = key.split(':');
    switch (prefix) {
      case 'overview':
      case 'hero-timeline':
        normalized.push({ type: prefix });
        seen.add(key);
        break;
      case 'sauna':
        if (rest) {
          normalized.push({ type: 'sauna', name: rest });
          seen.add(key);
        }
        break;
      case 'story':
        if (rest) {
          normalized.push({ type: 'story', id: rest });
          seen.add(key);
        }
        break;
      case 'media':
        if (rest) {
          normalized.push({ type: 'media', id: rest });
          seen.add(key);
        }
        break;
      default:
        break;
    }
  }
  return normalized;
}

export function sanitizeBadgeLibrary(list, { assignMissingIds = false, fallback } = {}) {
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

  if (Array.isArray(list)) {
    list.forEach((entry) => pushEntry(entry, assignMissingIds));
  }

  if (!normalized.length && Array.isArray(fallback)) {
    fallback.forEach((entry) => pushEntry(entry, true));
  }

  return normalized;
}

export function normalizeSettings(source, { assignMissingIds = false } = {}) {
  const src = source ? deepClone(source) : {};
  src.slides = { ...DEFAULTS.slides, ...(src.slides || {}) };
  src.display = { ...DEFAULTS.display, ...(src.display || {}) };
  src.theme = { ...DEFAULTS.theme, ...(src.theme || {}) };
  src.fonts = { ...DEFAULTS.fonts, ...(src.fonts || {}) };
  src.assets = { ...DEFAULTS.assets, ...(src.assets || {}) };
  src.h2 = { ...DEFAULTS.h2, ...(src.h2 || {}) };
  src.highlightNext = { ...DEFAULTS.highlightNext, ...(src.highlightNext || {}) };
  src.footnotes = Array.isArray(src.footnotes) ? src.footnotes : (DEFAULTS.footnotes || []);
  src.interstitials = Array.isArray(src.interstitials)
    ? src.interstitials.map((it) => {
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
  src.presets = src.presets || {};

  const defaultDisplayPages = DEFAULTS.display?.pages || {};
  const sanitizePageConfig = (page, defaults = {}) => {
    const cfg = page && typeof page === 'object' ? { ...page } : {};
    const def = defaults && typeof defaults === 'object' ? defaults : {};
    cfg.source = PAGE_SOURCE_KEYS.includes(cfg.source)
      ? cfg.source
      : (PAGE_SOURCE_KEYS.includes(def.source) ? def.source : 'master');
    const timerNum = Number(cfg.timerSec);
    cfg.timerSec = Number.isFinite(timerNum) && timerNum > 0
      ? Math.max(1, Math.round(timerNum))
      : null;
    const rawList = Array.isArray(cfg.contentTypes) ? cfg.contentTypes : def.contentTypes;
    const filtered = Array.isArray(rawList)
      ? rawList.filter((type) => PAGE_CONTENT_TYPE_KEYS.has(type))
      : [];
    const defaultTypes = Array.isArray(def.contentTypes)
      ? def.contentTypes.slice()
      : PAGE_CONTENT_TYPES.map(([key]) => key);
    cfg.contentTypes = filtered.length ? Array.from(new Set(filtered)) : defaultTypes;
    const rawPlaylist = Array.isArray(cfg.playlist) ? cfg.playlist : def.playlist;
    cfg.playlist = sanitizePagePlaylist(rawPlaylist);
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

export function sanitizeScheduleForCompare(src) {
  return deepClone(src || {});
}

export function sanitizeSettingsForCompare(src) {
  return normalizeSettings(src || {}, { assignMissingIds: false });
}
