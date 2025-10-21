// /admin/js/core/config.js
// Gemeinsame Konstanten & Sanitizer für Einstellungen und Playlists.

'use strict';

import { DEFAULTS } from './defaults.js';
import { sanitizeBadgeLibrary } from './badge_library.js';
import { deepClone, genId } from './utils.js';

export { sanitizeBadgeLibrary } from './badge_library.js';

export const WELLNESS_GLOBAL_ID = '__wellness_bundle__';

const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

const OVERVIEW_TIME_BASE_CH = 10;
const OVERVIEW_TIME_SCALE_MIN = 0.5;
const OVERVIEW_TIME_SCALE_MAX = 3;

const HEADING_WIDTH_INPUT_MIN = 10;
const HEADING_WIDTH_INPUT_MAX = 100;
const HEADING_WIDTH_ACTUAL_MIN = 10;
const HEADING_WIDTH_ACTUAL_MAX = 160;
const HEADING_WIDTH_INPUT_SPAN = HEADING_WIDTH_INPUT_MAX - HEADING_WIDTH_INPUT_MIN;
const HEADING_WIDTH_ACTUAL_SPAN = HEADING_WIDTH_ACTUAL_MAX - HEADING_WIDTH_ACTUAL_MIN;
const HEADING_WIDTH_RATIO = HEADING_WIDTH_ACTUAL_SPAN / HEADING_WIDTH_INPUT_SPAN;
const HEADING_WIDTH_INV_RATIO = HEADING_WIDTH_INPUT_SPAN / HEADING_WIDTH_ACTUAL_SPAN;

export const SAUNA_HEADING_WIDTH_LIMITS = Object.freeze({
  inputMin: HEADING_WIDTH_INPUT_MIN,
  inputMax: HEADING_WIDTH_INPUT_MAX,
  actualMin: HEADING_WIDTH_ACTUAL_MIN,
  actualMax: HEADING_WIDTH_ACTUAL_MAX
});

export function mapSaunaHeadingWidthToActual(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return HEADING_WIDTH_ACTUAL_MAX;
  }
  if (num > HEADING_WIDTH_INPUT_MAX) {
    return clamp(HEADING_WIDTH_ACTUAL_MIN, num, HEADING_WIDTH_ACTUAL_MAX);
  }
  const clamped = clamp(HEADING_WIDTH_INPUT_MIN, num, HEADING_WIDTH_INPUT_MAX);
  return HEADING_WIDTH_ACTUAL_MIN + (clamped - HEADING_WIDTH_INPUT_MIN) * HEADING_WIDTH_RATIO;
}

export function mapSaunaHeadingWidthToInput(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return HEADING_WIDTH_INPUT_MAX;
  }
  if (num > HEADING_WIDTH_INPUT_MAX) {
    const clampedActual = clamp(HEADING_WIDTH_ACTUAL_MIN, num, HEADING_WIDTH_ACTUAL_MAX);
    return HEADING_WIDTH_INPUT_MIN + (clampedActual - HEADING_WIDTH_ACTUAL_MIN) * HEADING_WIDTH_INV_RATIO;
  }
  return clamp(HEADING_WIDTH_INPUT_MIN, num, HEADING_WIDTH_INPUT_MAX);
}

export function normalizeSaunaHeadingWidth(value, { fallback } = {}) {
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (num > HEADING_WIDTH_INPUT_MAX) {
      return mapSaunaHeadingWidthToInput(num);
    }
    return clamp(HEADING_WIDTH_INPUT_MIN, num, HEADING_WIDTH_INPUT_MAX);
  }
  if (fallback != null) {
    const fallbackNum = Number(fallback);
    if (Number.isFinite(fallbackNum)) {
      return normalizeSaunaHeadingWidth(fallbackNum);
    }
  }
  return HEADING_WIDTH_INPUT_MAX;
}

const STYLE_THEME_KEYS = [
  'bg','fg','accent','gridBorder','gridTable','gridTableW','cellBg','boxFg','headRowBg','headRowFg',
  'timeColBg','timeZebra1','timeZebra2','zebra1','zebra2','cornerBg','cornerFg','tileBorder','tileBorderW',
  'chipBorder','chipBorderW','flame','saunaColor'
];

const STYLE_FONT_KEYS = [
  'family','tileTextScale','tileWeight','chipHeight','chipOverflowMode','flamePct','flameGapScale',
  'tileMetaScale','overviewTimeScale','overviewTimeWidthScale','overviewShowFlames'
];

const STYLE_SLIDE_KEYS = [
  'infobadgeColor','badgeLibrary','badgeScale','badgeDescriptionScale',
  'tileHeightScale','tilePaddingScale','tileOverlayEnabled','tileOverlayStrength','badgeInlineColumn',
  'tileFlameSizeScale','tileFlameGapScale','saunaTitleMaxWidthPercent','appendTimeSuffix'
];

const cloneSubset = (src = {}, keys = []) => {
  const out = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = deepClone(src[key]);
    }
  });
  return out;
};

export const PAGE_CONTENT_TYPES = [
  ['overview', 'Übersicht'],
  ['sauna', 'Saunen'],
  ['hero-timeline', 'Event Countdown'],
  ['story', 'Erklärungen'],
  ['wellness-tip', 'Wellness-Tipps'],
  ['event-countdown', 'Event-Countdown'],
  ['gastronomy-highlight', 'Gastronomie'],
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
    case 'wellness-tip':
      return 'wellness:' + WELLNESS_GLOBAL_ID;
    case 'event-countdown':
      return entry.id != null ? 'event:' + String(entry.id) : null;
    case 'gastronomy-highlight':
      return entry.id != null ? 'gastro:' + String(entry.id) : null;
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
    case 'wellness-tip': {
      return 'wellness:' + WELLNESS_GLOBAL_ID;
    }
    case 'event-countdown': {
      const rawId = entry.id ?? entry.eventId;
      return rawId != null ? 'event:' + String(rawId) : null;
    }
    case 'gastronomy-highlight': {
      const rawId = entry.id ?? entry.highlightId;
      return rawId != null ? 'gastro:' + String(rawId) : null;
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
      case 'wellness':
        if (!seen.has('wellness:' + WELLNESS_GLOBAL_ID)) {
          normalized.push({ type: 'wellness-tip', id: WELLNESS_GLOBAL_ID });
          seen.add('wellness:' + WELLNESS_GLOBAL_ID);
        }
        break;
      case 'event':
        if (rest) {
          normalized.push({ type: 'event-countdown', id: rest });
          seen.add(key);
        }
        break;
      case 'gastro':
        if (rest) {
          normalized.push({ type: 'gastronomy-highlight', id: rest });
          seen.add(key);
        }
        break;
      default:
        break;
    }
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

  const fonts = src.fonts || {};
  const defaultTimeWidthScale = Number(DEFAULTS.fonts?.overviewTimeWidthScale ?? 1);
  const rawTimeWidthScale = Number(fonts.overviewTimeWidthScale);
  if (Number.isFinite(rawTimeWidthScale) && rawTimeWidthScale > 0) {
    fonts.overviewTimeWidthScale = clamp(
      OVERVIEW_TIME_SCALE_MIN,
      rawTimeWidthScale,
      OVERVIEW_TIME_SCALE_MAX
    );
  } else {
    const legacyWidth = Number(fonts.overviewTimeWidthCh);
    if (Number.isFinite(legacyWidth) && legacyWidth > 0) {
      fonts.overviewTimeWidthScale = clamp(
        OVERVIEW_TIME_SCALE_MIN,
        legacyWidth / OVERVIEW_TIME_BASE_CH,
        OVERVIEW_TIME_SCALE_MAX
      );
    } else {
      fonts.overviewTimeWidthScale = clamp(
        OVERVIEW_TIME_SCALE_MIN,
        defaultTimeWidthScale,
        OVERVIEW_TIME_SCALE_MAX
      );
    }
  }
  delete fonts.overviewTimeWidthCh;

  src.footnotes = Array.isArray(src.footnotes) ? src.footnotes : (DEFAULTS.footnotes || []);
  src.extras = sanitizeExtras(src.extras, DEFAULTS.extras);
  const styleSetState = sanitizeStyleSets(src.slides?.styleSets, DEFAULTS.slides?.styleSets, src.slides?.activeStyleSet);
  src.slides.styleSets = styleSetState.sets;
  src.slides.activeStyleSet = styleSetState.active;
  const headingFallback = DEFAULTS.slides?.saunaTitleMaxWidthPercent ?? SAUNA_HEADING_WIDTH_LIMITS.inputMax;
  src.slides.saunaTitleMaxWidthPercent = normalizeSaunaHeadingWidth(src.slides.saunaTitleMaxWidthPercent, {
    fallback: headingFallback
  });
  const styleSets = src.slides.styleSets;
  if (styleSets && typeof styleSets === 'object') {
    Object.values(styleSets).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      if (!entry.slides || typeof entry.slides !== 'object') return;
      entry.slides.saunaTitleMaxWidthPercent = normalizeSaunaHeadingWidth(
        entry.slides.saunaTitleMaxWidthPercent,
        { fallback: src.slides.saunaTitleMaxWidthPercent }
      );
    });
  }
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
  const allowedProfiles = new Set(['landscape','portrait','portrait-split','triple','asymmetric']);
  const rawProfile = typeof src.display.layoutProfile === 'string' ? src.display.layoutProfile : 'landscape';
  src.display.layoutProfile = allowedProfiles.has(rawProfile) ? rawProfile : 'landscape';
  src.display.pages = {
    left: sanitizePageConfig(pagesRaw.left, defaultDisplayPages.left),
    right: sanitizePageConfig(pagesRaw.right, defaultDisplayPages.right)
  };

  sanitizeStyleAutomation(src);

  const slidesCfg = src.slides || {};
  slidesCfg.heroEnabled = slidesCfg.heroEnabled !== false;
  const defaultHeroFill = Number(DEFAULTS.slides?.heroTimelineFillMs) || 8000;
  const rawHeroFill = Number(slidesCfg.heroTimelineFillMs);
  slidesCfg.heroTimelineFillMs = Number.isFinite(rawHeroFill) && rawHeroFill > 0
    ? Math.max(1000, Math.round(rawHeroFill < 1000 ? rawHeroFill * 1000 : rawHeroFill))
    : defaultHeroFill;
  const defaultHeroBase = Number(DEFAULTS.slides?.heroTimelineBaseMinutes) || 15;
  const rawHeroBase = Number(slidesCfg.heroTimelineBaseMinutes);
  slidesCfg.heroTimelineBaseMinutes = Number.isFinite(rawHeroBase) && rawHeroBase > 0
    ? Math.max(1, Math.round(rawHeroBase))
    : defaultHeroBase;
  const rawHeroMax = Number(slidesCfg.heroTimelineMaxEntries);
  slidesCfg.heroTimelineMaxEntries = Number.isFinite(rawHeroMax) && rawHeroMax > 0
    ? Math.max(1, Math.round(rawHeroMax))
    : null;
  slidesCfg.heroTimelineWaitForScroll = slidesCfg.heroTimelineWaitForScroll === true;
  const defaultHeroScrollSpeed = Number(DEFAULTS.slides?.heroTimelineScrollSpeed) || 28;
  const rawHeroScrollSpeed = Number(slidesCfg.heroTimelineScrollSpeed);
  slidesCfg.heroTimelineScrollSpeed = Number.isFinite(rawHeroScrollSpeed) && rawHeroScrollSpeed > 0
    ? clamp(4, Math.round(rawHeroScrollSpeed), 240)
    : defaultHeroScrollSpeed;
  const defaultHeroPause = Number(DEFAULTS.slides?.heroTimelineScrollPauseMs) || 4000;
  const rawHeroPause = Number(slidesCfg.heroTimelineScrollPauseMs);
  slidesCfg.heroTimelineScrollPauseMs = Number.isFinite(rawHeroPause) && rawHeroPause >= 0
    ? Math.max(0, Math.round(rawHeroPause < 1000 ? rawHeroPause * 1000 : rawHeroPause))
    : defaultHeroPause;

  const hasBadgeArray = Array.isArray(src.slides?.badgeLibrary);
  src.slides.badgeLibrary = sanitizeBadgeLibrary(src.slides.badgeLibrary, {
    assignMissingIds,
    fallback: hasBadgeArray ? undefined : DEFAULTS.slides?.badgeLibrary
  });
  const defaultBadgeScale = DEFAULTS.slides?.badgeScale ?? 1;
  const defaultBadgeDescScale = DEFAULTS.slides?.badgeDescriptionScale ?? 1;
  const badgeScaleRaw = Number(src.slides?.badgeScale);
  src.slides.badgeScale = Number.isFinite(badgeScaleRaw)
    ? clamp(0.3, badgeScaleRaw, 3)
    : defaultBadgeScale;
  const badgeDescRaw = Number(src.slides?.badgeDescriptionScale);
  src.slides.badgeDescriptionScale = Number.isFinite(badgeDescRaw)
    ? clamp(0.3, badgeDescRaw, 3)
    : defaultBadgeDescScale;
  return src;
}

export function sanitizeScheduleForCompare(src) {
  return deepClone(src || {});
}

export function sanitizeSettingsForCompare(src) {
  return normalizeSettings(src || {}, { assignMissingIds: false });
}

function sanitizeStyleSets(rawSets, defaultSets, activeId) {
  const source = (rawSets && typeof rawSets === 'object') ? rawSets : {};
  const fallback = (defaultSets && typeof defaultSets === 'object') ? defaultSets : {};
  const cleaned = {};
  const seen = new Set();

  const pushEntry = (key, value) => {
    if (!value || typeof value !== 'object') return;
    const slug = typeof key === 'string' ? key.trim() : '';
    if (!slug || seen.has(slug)) return;
    const entry = {
      label: typeof value.label === 'string' ? value.label.trim() : '',
      theme: cloneSubset(value.theme, STYLE_THEME_KEYS),
      fonts: cloneSubset(value.fonts, STYLE_FONT_KEYS),
      slides: cloneSubset(value.slides, STYLE_SLIDE_KEYS)
    };
    cleaned[slug] = {
      label: entry.label || slug,
      theme: entry.theme,
      fonts: entry.fonts,
      slides: entry.slides
    };
    seen.add(slug);
  };

  Object.entries(source).forEach(([key, value]) => pushEntry(key, value));

  if (!Object.keys(cleaned).length) {
    Object.entries(fallback).forEach(([key, value]) => pushEntry(key, value));
  }

  const ids = Object.keys(cleaned);
  const candidate = typeof activeId === 'string' ? activeId.trim() : '';
  const active = ids.includes(candidate) ? candidate : (ids[0] || '');

  return { sets: cleaned, ids, active };
}

function sanitizeExtras(extras, defaults){
  const fallback = (defaults && typeof defaults === 'object') ? defaults : {};
  const src = (extras && typeof extras === 'object') ? extras : {};
  return {
    wellnessTips: sanitizeWellnessTips(src.wellnessTips, fallback.wellnessTips),
    eventCountdowns: sanitizeEventCountdowns(src.eventCountdowns, fallback.eventCountdowns),
    gastronomyHighlights: sanitizeGastronomyHighlights(src.gastronomyHighlights, fallback.gastronomyHighlights)
  };
}

function sanitizeWellnessTips(list, fallback){
  const source = Array.isArray(list) ? list : (Array.isArray(fallback) ? fallback : []);
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    let id = entry.id != null ? String(entry.id).trim() : '';
    if (!id) id = genId('well_');
    if (seen.has(id)) return;
    const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    const enabled = entry.enabled !== false;
    const dwellSec = sanitizeDwellSeconds(entry.dwellSec);
    const record = { id, icon, title, text };
    if (!enabled) record.enabled = false;
    if (dwellSec != null) record.dwellSec = dwellSec;
    normalized.push(record);
    seen.add(id);
  });
  return normalized;
}

function sanitizeEventCountdowns(list, fallback){
  const source = Array.isArray(list) ? list : (Array.isArray(fallback) ? fallback : []);
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    let id = entry.id != null ? String(entry.id).trim() : '';
    if (!id) id = genId('evt_');
    if (seen.has(id)) return;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const subtitle = typeof entry.subtitle === 'string' ? entry.subtitle.trim() : '';
    const rawTarget = typeof entry.target === 'string' ? entry.target.trim() : '';
    const target = rawTarget || '';
    const style = typeof entry.style === 'string' ? entry.style.trim() : '';
    const image = typeof entry.image === 'string' ? entry.image.trim() : '';
    const imageThumb = typeof entry.imageThumb === 'string' ? entry.imageThumb.trim() : '';
    const record = { id, title, subtitle, target, style };
    if (image) record.image = image;
    if (imageThumb) record.imageThumb = imageThumb;
    normalized.push(record);
    seen.add(id);
  });
  return normalized;
}

function sanitizeGastronomyHighlights(list, fallback){
  const source = Array.isArray(list) ? list : (Array.isArray(fallback) ? fallback : []);
  const normalized = [];
  const seen = new Set();
  source.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    let id = entry.id != null ? String(entry.id).trim() : '';
    if (!id) id = genId('gas_');
    if (seen.has(id)) return;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    const description = typeof entry.description === 'string' ? entry.description.trim() : '';
    const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
    const details = Array.isArray(entry.items)
      ? entry.items.map((it) => (typeof it === 'string' ? it.trim() : '')).filter(Boolean)
      : [];
    const textList = Array.isArray(entry.textLines)
      ? entry.textLines.map((it) => (typeof it === 'string' ? it.trim() : '')).filter(Boolean)
      : [];
    const dwellSec = sanitizeDwellSeconds(entry.dwellSec);
    const record = { id, title, description, icon, items: details, textLines: textList };
    if (dwellSec != null) record.dwellSec = dwellSec;
    normalized.push(record);
    seen.add(id);
  });
  return normalized;
}

function normalizeTimeString(raw){
  if (typeof raw !== 'string') return null;
  const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(raw);
  if (!match) return null;
  let hour = Number(match[1]);
  let minute = Number(match[2] ?? '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  hour = Math.max(0, Math.min(23, hour));
  minute = Math.max(0, Math.min(59, minute));
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function normalizeDateTimeLocal(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/, 'T');
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!Number.isFinite(year) || year < 1970 || year > 9999) return null;
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const ms = new Date(year, month - 1, day, hour, minute).getTime();
  if (!Number.isFinite(ms)) return null;
  return { iso, ms };
}

function sanitizeDwellSeconds(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.max(1, Math.round(num));
}

function sanitizeStyleAutomation(settings){
  const slides = settings?.slides || {};
  const styleSets = slides.styleSets && typeof slides.styleSets === 'object' ? slides.styleSets : {};
  const availableStyles = new Set(Object.keys(styleSets));
  const defaults = DEFAULTS.slides?.styleAutomation || {};
  const raw = slides.styleAutomation && typeof slides.styleAutomation === 'object'
    ? slides.styleAutomation
    : {};

  const normalized = {
    enabled: raw.enabled !== false,
    fallbackStyle: availableStyles.has(raw.fallbackStyle)
      ? raw.fallbackStyle
      : (availableStyles.has(defaults.fallbackStyle) ? defaults.fallbackStyle : Array.from(availableStyles)[0] || ''),
    timeSlots: []
  };

  const slotSource = Array.isArray(raw.timeSlots) && raw.timeSlots.length
    ? raw.timeSlots
    : (Array.isArray(defaults.timeSlots) ? defaults.timeSlots : []);
  const seen = new Set();
  slotSource.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const id = entry.id ? String(entry.id).trim() : genId('style_');
    if (seen.has(id)) return;
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    const style = availableStyles.has(entry.style) ? entry.style : normalized.fallbackStyle;
    const mode = entry.mode === 'range' || (entry.startDateTime && entry.endDateTime)
      ? 'range'
      : 'daily';
    if (mode === 'range') {
      const startInfo = normalizeDateTimeLocal(entry.startDateTime || entry.startDate || entry.start);
      const endInfo = normalizeDateTimeLocal(entry.endDateTime || entry.endDate || entry.end);
      if (!startInfo || !endInfo || endInfo.ms < startInfo.ms) return;
      normalized.timeSlots.push({
        id,
        label,
        style,
        mode: 'range',
        startDateTime: startInfo.iso,
        endDateTime: endInfo.iso
      });
    } else {
      const start = normalizeTimeString(entry.start || entry.startTime || '');
      if (!start) return;
      normalized.timeSlots.push({ id, label, start, style, mode: 'daily' });
    }
    seen.add(id);
  });
  normalized.timeSlots.sort((a, b) => {
    const groupA = a.mode === 'range' ? 0 : 1;
    const groupB = b.mode === 'range' ? 0 : 1;
    if (groupA !== groupB) return groupA - groupB;
    if (groupA === 0) {
      return (a.startDateTime || '').localeCompare(b.startDateTime || '');
    }
    return (a.start || '').localeCompare(b.start || '');
  });
  slides.styleAutomation = normalized;
  return normalized;
}
