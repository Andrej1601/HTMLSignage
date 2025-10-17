'use strict';

import { genId } from './utils.js';
import { DEFAULTS } from './defaults.js';

const BADGE_ID_PREFIX = 'bdg_';
const ICON_FIELDS = ['icon', 'emoji', 'symbol'];
const LABEL_FIELDS = ['label', 'title', 'text', 'name', 'caption', 'headline'];
const IMAGE_FIELDS = ['imageUrl', 'iconUrl', 'image', 'media', 'asset'];

const DEFAULT_FALLBACK_LIBRARY = Array.isArray(DEFAULTS?.slides?.badgeLibrary)
  ? DEFAULTS.slides.badgeLibrary
  : [];

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

function readTextField(entry, keys) {
  for (const key of keys) {
    if (!hasOwn(entry, key)) continue;
    const value = entry[key];
    if (typeof value !== 'string') continue;
    return { value: value.trim(), present: true };
  }
  return { value: '', present: false };
}

function readImageField(entry) {
  for (const key of IMAGE_FIELDS) {
    if (!hasOwn(entry, key)) continue;
    const value = entry[key];
    if (typeof value === 'string') {
      return { value: value.trim(), present: true };
    }
    if (value && typeof value === 'object') {
      if (typeof value.url === 'string') {
        return { value: value.url.trim(), present: true };
      }
      if (typeof value.src === 'string') {
        return { value: value.src.trim(), present: true };
      }
    }
    return { value: '', present: true };
  }
  return { value: '', present: false };
}

const readId = (entry) => (typeof entry?.id === 'string' ? entry.id.trim() : '');

function buildFallbackMap(list) {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  list.forEach((entry) => {
    const normalized = normalizeBadgeEntry(entry, { assignId: false });
    if (!normalized) return;
    if (map.has(normalized.id)) return;
    map.set(normalized.id, normalized);
  });
  return map;
}

export function normalizeBadgeEntry(rawEntry, { assignId = false, fallback } = {}) {
  if (!rawEntry || typeof rawEntry !== 'object') return null;

  let id = readId(rawEntry);
  if (!id && assignId) {
    id = genId(BADGE_ID_PREFIX);
  }
  if (!id) return null;

  const iconInfo = readTextField(rawEntry, ICON_FIELDS);
  let icon = iconInfo.value;
  if (!iconInfo.present && fallback && typeof fallback.icon === 'string') {
    icon = fallback.icon;
  }
  icon = toTrimmedString(icon);

  const labelInfo = readTextField(rawEntry, LABEL_FIELDS);
  let label = labelInfo.value;
  if (!labelInfo.present && fallback && typeof fallback.label === 'string') {
    label = fallback.label;
  }
  label = typeof label === 'string' ? label : '';

  const imageInfo = readImageField(rawEntry);
  let imageUrl = imageInfo.value;
  if (!imageInfo.present && fallback && typeof fallback.imageUrl === 'string') {
    imageUrl = fallback.imageUrl;
  }
  imageUrl = toTrimmedString(imageUrl);

  const normalized = {
    id,
    icon,
    label
  };
  if (imageUrl) {
    normalized.imageUrl = imageUrl;
  }
  return normalized;
}

export function sanitizeBadgeLibrary(list, { assignMissingIds = false, fallback, previous } = {}) {
  const fallbackList = Array.isArray(fallback) ? fallback : [];
  const previousList = Array.isArray(previous) ? previous : [];
  const fallbackMap = buildFallbackMap(fallbackList);
  const previousMap = buildFallbackMap(previousList);

  const normalized = [];
  const seen = new Set();

  const pushEntry = (entry, assignId) => {
    const rawId = readId(entry);
    const fallbackEntry = previousMap.get(rawId) || fallbackMap.get(rawId);
    const normalizedEntry = normalizeBadgeEntry(entry, { assignId, fallback: fallbackEntry });
    if (!normalizedEntry) return;
    if (seen.has(normalizedEntry.id)) return;
    normalized.push(normalizedEntry);
    seen.add(normalizedEntry.id);
  };

  if (Array.isArray(list)) {
    list.forEach((entry) => pushEntry(entry, assignMissingIds));
  }

  if (!normalized.length && fallbackList.length) {
    fallbackList.forEach((entry) => pushEntry(entry, true));
  }

  return normalized;
}

export function ensureBadgeLibrary(settings, { fallback } = {}) {
  if (!settings || typeof settings !== 'object') return [];
  const slides = settings.slides = (settings.slides && typeof settings.slides === 'object')
    ? settings.slides
    : {};
  const existing = Array.isArray(slides.badgeLibrary) ? slides.badgeLibrary : null;
  const effectiveFallback = fallback ?? DEFAULT_FALLBACK_LIBRARY;
  const normalized = sanitizeBadgeLibrary(existing ?? effectiveFallback, {
    assignMissingIds: true,
    fallback: existing ? undefined : effectiveFallback,
    previous: existing ?? undefined
  });
  slides.badgeLibrary = normalized;
  return normalized;
}

export function cloneBadgeLibrary(list) {
  return sanitizeBadgeLibrary(list, { assignMissingIds: false }).map((entry) => ({ ...entry }));
}

export function propagateBadgeLibraryToStyleSets(settings, { fallback } = {}) {
  const library = ensureBadgeLibrary(settings, { fallback });
  const styleSets = settings?.slides?.styleSets;
  if (!styleSets || typeof styleSets !== 'object') {
    return library;
  }
  const cloneLibrary = () => library.map((entry) => ({ ...entry }));
  Object.values(styleSets).forEach((setEntry) => {
    if (!setEntry || typeof setEntry !== 'object') return;
    const targetSlides = setEntry.slides = (setEntry.slides && typeof setEntry.slides === 'object')
      ? setEntry.slides
      : {};
    targetSlides.badgeLibrary = cloneLibrary();
  });
  return library;
}

export function createBadge(overrides = {}) {
  const entry = normalizeBadgeEntry(overrides, { assignId: true });
  if (entry) return entry;
  return {
    id: genId(BADGE_ID_PREFIX),
    icon: '',
    label: ''
  };
}

export const BADGE_LIBRARY_DEFAULT = DEFAULT_FALLBACK_LIBRARY.map((entry) => ({ ...entry }));
