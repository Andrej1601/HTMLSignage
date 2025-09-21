(() => {
  const FITBOX = document.getElementById('fitbox');
  const CANVAS = document.getElementById('canvas');
  const STAGE  = document.getElementById('stage');
  const STAGE_LEFT  = document.getElementById('stage-left');
  const STAGE_RIGHT = document.getElementById('stage-right');
  const Q = new URLSearchParams(location.search);
  const IS_PREVIEW = Q.get('preview') === '1'; // NEU: Admin-Dock
  const ls = createSafeLocalStorage({
    onFallback: () => {
      if (typeof alert === 'function') {
        alert('Speicher voll – Daten werden nur temporär gespeichert.');
      }
    },
    logger: (method, error) => console.warn(`[slideshow] localStorage.${method} failed`, error)
  });
  const rawDevice = (Q.get('device') || ls.get('deviceId') || '').trim();
  const DEVICE_ID = /^dev_[a-f0-9]{12}$/i.test(rawDevice) ? rawDevice : null;
  if (DEVICE_ID) {
    // persist valid device IDs for subsequent loads
    ls.set('deviceId', DEVICE_ID);
  } else {
    ls.remove('deviceId'); // Karteileichen loswerden
  }
  let previewMode = IS_PREVIEW; // NEU: in Preview sofort aktiv (kein Pairing)

  let schedule = null;
  let settings = null;
  let heroTimeline = [];
  let cachedDisp = null;
  const stageControllers = [];
  const resizeRegistry = createResizeRegistry();
  let heartbeatTimer = null;
  let pollTimer = null;
  let badgeLookupCache = null;

  window.addEventListener('beforeunload', () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  });

  const imagePreloader = createImagePreloader({ maxParallel: 3 });
  const PRELOAD_AHEAD = 4;

  function preloadImage(url){
    return imagePreloader.preload(url);
  }
  async function preloadRightImages(){
    const urls = Object.values(settings?.assets?.rightImages || {}).filter(Boolean);
    if (!urls.length) return;
    await imagePreloader.preloadMany(urls);
  }
  async function preloadNextImages(){
    const tasks = stageControllers.map(ctrl => preloadUpcomingForStage(ctrl, { offset: 0 }));
    await Promise.all(tasks);
  }

  async function preloadSlideImages(){
    await preloadNextImages();
  }

  function setResizeHandler(region, handler){
    resizeRegistry.set(region, handler);
  }

  function runResizeHandlers(){
    resizeRegistry.run();
  }

  window.addEventListener('resize', runResizeHandlers, { passive:true });

  function createSafeLocalStorage({ onFallback, logger } = {}) {
    const memory = {};
    let fallbackTriggered = false;
    let store = null;

    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        store = globalThis.localStorage;
      } else if (typeof window !== 'undefined' && window.localStorage) {
        store = window.localStorage;
      }
    } catch (error) {
      store = null;
    }

    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
    const notifyFallback = () => {
      if (fallbackTriggered) return;
      fallbackTriggered = true;
      if (typeof onFallback === 'function') onFallback();
    };
    const reportFailure = (method, error) => {
      if (error) {
        if (typeof logger === 'function') logger(method, error);
        else console.warn(`[slideshow] localStorage.${method} failed`, error);
      }
      notifyFallback();
    };

    return {
      get(key) {
        if (store) {
          try {
            return store.getItem(key);
          } catch (error) {
            reportFailure('getItem', error);
          }
        }
        return hasOwn(memory, key) ? memory[key] : null;
      },
      set(key, value) {
        if (store) {
          try {
            store.setItem(key, value);
            if (hasOwn(memory, key)) delete memory[key];
            return;
          } catch (error) {
            reportFailure('setItem', error);
          }
        }
        memory[key] = String(value);
      },
      remove(key) {
        if (store) {
          try {
            store.removeItem(key);
          } catch (error) {
            reportFailure('removeItem', error);
          }
        }
        delete memory[key];
      }
    };
  }

  function createImagePreloader({ maxParallel = 3 } = {}) {
    const processed = new Set();
    const queued = new Set();
    const queue = [];
    const limit = Number.isFinite(maxParallel) && maxParallel > 0
      ? Math.max(1, Math.floor(maxParallel))
      : 1;
    const supportsImage = typeof Image !== 'undefined';
    let active = 0;

    const cleanup = (img) => {
      if (!img) return;
      img.onload = null;
      img.onerror = null;
      try { img.src = ''; } catch (err) { /* ignore */ }
    };

    const dequeue = (url, resolve, img) => {
      cleanup(img);
      queued.delete(url);
      processed.add(url);
      active = Math.max(0, active - 1);
      resolve();
      run();
    };

    const run = () => {
      if (!supportsImage) {
        while (queue.length) {
          const { url, resolve } = queue.shift();
          queued.delete(url);
          processed.add(url);
          resolve();
        }
        return;
      }
      while (active < limit && queue.length) {
        const { url, resolve } = queue.shift();
        active++;
        const img = new Image();
        const done = () => dequeue(url, resolve, img);
        img.onload = done;
        img.onerror = done;
        img.src = url;
      }
    };

    const enqueue = (rawUrl) => {
      const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
      if (!url || processed.has(url) || queued.has(url)) return Promise.resolve();
      queued.add(url);
      return new Promise((resolve) => {
        queue.push({ url, resolve });
        run();
      });
    };

    return {
      preload: enqueue,
      preloadMany(urls) {
        if (!Array.isArray(urls) || !urls.length) return Promise.resolve();
        return Promise.all(urls.map(enqueue));
      },
      has(url) {
        const normalized = typeof url === 'string' ? url.trim() : '';
        return processed.has(normalized);
      }
    };
  }

  function createResizeRegistry() {
    const handlers = new Map();
    return {
      set(region, handler) {
        if (!region) return;
        if (typeof handler === 'function') handlers.set(region, handler);
        else handlers.delete(region);
      },
      run() {
        handlers.forEach((fn, key) => {
          if (typeof fn !== 'function') {
            handlers.delete(key);
            return;
          }
          try {
            fn();
          } catch (error) {
            console.warn('[slideshow] resize handler failed', error);
          }
        });
      }
    };
  }

  // ---------- Time helpers ----------
  const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const parseHM = (hm) => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };

  // ---------- Presets ----------
  function dayKey(){ return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]; }
  function maybeApplyPreset(){
    const auto = !!(settings && settings.presetAuto);
    const presets = (settings && settings.presets) || {};
    if (!auto) return;
    const key = dayKey();
    const preset = presets[key] || presets['Default'] || null;
    if (preset && preset.saunas && Array.isArray(preset.rows)) {
      schedule = preset; // gleiche Struktur wie schedule.json erwartet
    }
  }

// -----------DeviceLoader -------
async function loadDeviceResolved(id){
  const r = await fetch(`/pair/resolve?device=${encodeURIComponent(id)}&t=${Date.now()}`, {cache:'no-store'});
  if (!r.ok) throw new Error('device_resolve http '+r.status);
  const j = await r.json();
  if (!j || j.ok === false || !j.settings || !j.schedule) {
    throw new Error('device_resolve payload invalid');
  }
  schedule = j.schedule;
  settings = j.settings;
  badgeLookupCache = null;
  applyTheme(); applyDisplay(); maybeApplyPreset();
  refreshStageQueues({ resetIndex:true, autoplay:false });
  await Promise.all([preloadRightImages(), preloadSlideImages()]);
}


  // ---------- IO ----------
  async function loadJSON(u) { const r = await fetch(u + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + u); return await r.json(); }
  async function loadAll() {
    const [s, cfg] = await Promise.all([
      loadJSON('/data/schedule.json'),
      loadJSON('/data/settings.json')
    ]);
    schedule = s; settings = cfg;
    badgeLookupCache = null;
    applyTheme();
    applyDisplay();
    maybeApplyPreset();
    refreshStageQueues({ resetIndex:true, autoplay:false });
    await Promise.all([preloadRightImages(), preloadSlideImages()]);
  }

  // ---------- Theme & Display ----------
  function ensureFontFamily() {
    const fam = settings?.fonts?.family || '';
    if (/montserrat/i.test(fam)) {
      if (!document.getElementById('gfont_mont')) {
        const l = document.createElement('link'); l.id = 'gfont_mont'; l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(l);
      }
    }
  }
  function setVars(map){ for (const [k,v] of Object.entries(map)) if (v!==undefined && v!==null) document.documentElement.style.setProperty(k, String(v)); }

  function applyTheme() {
    const t = settings?.theme || {};
    const fonts = settings?.fonts || {};
    const slidesCfg = settings?.slides || {};
    const clamp = (min, val, max) => Math.min(Math.max(val, min), max);
    const msVar = (value, fallback) => {
      const num = Number.isFinite(+value) ? Math.max(0, +value) : fallback;
      return (Number.isFinite(num) ? num : fallback) + 'ms';
    };
    const overviewTimeWidth = Number.isFinite(+fonts.overviewTimeWidthCh)
      ? clamp(6, +fonts.overviewTimeWidthCh, 30)
      : 10;
    const overlayEnabled = slidesCfg.tileOverlayEnabled !== false;
    const overlayStrength = overlayEnabled
      ? clamp(0, Number(slidesCfg.tileOverlayStrength ?? 1), 3)
      : 0;
    const overlayOpacity = overlayEnabled ? clamp(0, 0.9 * overlayStrength, 1) : 0;
    const overlayLight = overlayEnabled ? clamp(0, 0.12 * overlayStrength, 1) : 0;
    const overlayShadow = overlayEnabled ? clamp(0, 0.42 * overlayStrength, 1) : 0;

    setVars({
      '--bg': t.bg, '--fg': t.fg, '--accent': t.accent,
      '--grid': t.gridBorder, '--cell': t.cellBg, '--boxfg': t.boxFg,
      '--gridTable':  t.gridTable  || t.gridBorder,
      '--gridTableW': (t.gridTableW ?? 2) + 'px',
      '--tileBorder':  t.tileBorder || t.gridBorder,
      '--tileBorderW': (t.tileBorderW ?? 3) + 'px',
      '--chipBorder':  t.chipBorder || t.gridBorder,
      '--chipBorderW': (t.chipBorderW ?? 2) + 'px',
      '--timecol': t.timeColBg, '--flame': t.flame,
      '--zebra1': t.zebra1, '--zebra2': t.zebra2,
      '--timeZebra1': t.timeZebra1 || '#EAD9A0', '--timeZebra2': t.timeZebra2 || '#E2CE91',
      '--headBg': t.headRowBg || t.timeColBg || '#E8DEBD', '--headFg': t.headRowFg || t.fg || '#5C3101',
      '--cornerBg': t.cornerBg || t.headRowBg || '#E8DEBD', '--cornerFg': t.cornerFg || t.headRowFg || '#5C3101',
      '--hlColor': (settings?.highlightNext?.color || '#FFDD66'),
      '--baseScale': fonts.scale || 1,
      '--scale': 'calc(var(--baseScale)*var(--vwScale))',
      '--h1Scale': fonts.h1Scale || 1,
      '--h2Scale': fonts.h2Scale || 1,
      '--ovTitleScale': fonts.overviewTitleScale || 1,
      '--ovHeadScale': fonts.overviewHeadScale || 0.9,
      '--ovCellScale': fonts.overviewCellScale || 0.8,
      '--ovTimeWidth': `${overviewTimeWidth}ch`,
      '--tileTextScale': fonts.tileTextScale || 0.8,
      '--tileWeight': fonts.tileWeight || 600,
      '--chipHScale': fonts.chipHeight || 1,
      '--badgeBg': slidesCfg.infobadgeColor || t.accent || '#5C3101',
      '--badgeFg': t.boxFg || '#FFFFFF',
      '--tileOverlayOpacity': overlayOpacity.toFixed(3),
      '--tileOverlayLight': overlayLight.toFixed(3),
      '--tileOverlayShadow': overlayShadow.toFixed(3),
      '--tileEnterDuration': msVar(slidesCfg.tileEnterMs, 600),
      '--tileEnterDelay': msVar(slidesCfg.tileStaggerMs, 80),
      '--heroTimelineItemMs': msVar(slidesCfg.heroTimelineItemMs, 500),
      '--heroTimelineItemDelay': msVar(slidesCfg.heroTimelineItemDelayMs, 140),
      '--heroTimelineFillMs': msVar(slidesCfg.heroTimelineFillMs, 8000),
      '--heroTimelineDelayMs': msVar(slidesCfg.heroTimelineDelayMs, 400)
    });
    if (fonts.family) document.documentElement.style.setProperty('--font', fonts.family);

    const showOverviewFlames = fonts.overviewShowFlames !== false;
    document.body.classList.toggle('overview-hide-flames', !showOverviewFlames);

    setVars({
      '--chipFlamePct': Math.max(0.3, Math.min(1, (fonts.flamePct || 55) / 100)),
      '--chipFlameGapScale': Math.max(0, (fonts.flameGapScale ?? 0.14))
    });
    document.body.dataset.chipOverflow = fonts.chipOverflowMode || 'scale';

    ensureFontFamily();
  }

  function applyDisplay() {
    cachedDisp = null;
    const d = settings?.display || {};
    const layoutMode = (d.layoutMode === 'split') ? 'split' : 'single';
    updateLayoutModeAttr(layoutMode);
    if (typeof d.rightWidthPercent === 'number') document.documentElement.style.setProperty('--rightW', d.rightWidthPercent + '%');
    if (typeof d.cutTopPercent === 'number')     document.documentElement.style.setProperty('--cutTop', d.cutTopPercent + '%');
    if (typeof d.cutBottomPercent === 'number')  document.documentElement.style.setProperty('--cutBottom', d.cutBottomPercent + '%');

    const baseW = d.baseW || 1920;
    document.documentElement.style.setProperty('--baseW', baseW + 'px');
    const updateVwScale = () => {
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const s = Math.max(0.25, vw / baseW); // untere Schranke gegen Ultra-Klein
      document.documentElement.style.setProperty('--vwScale', String(s));
    };
    updateVwScale();

    let resizeRaf = null;
    const onResize = () => {
      if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        updateVwScale();
      });
    };

    window.addEventListener('resize', onResize, { passive:true });
    window.addEventListener('orientationchange', onResize);

    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(document.documentElement);
    }
  }

  function getDisplayRatio() {
    if (cachedDisp !== null) return cachedDisp;
    const d = settings?.display || {};
    const baseW = d.baseW || 1920;
    const baseH = d.baseH || 1080;
    cachedDisp = baseW / baseH;
    return cachedDisp;
  }

  function chooseFit(mediaW, mediaH, opts = {}) {
    return 'cover';
  }

  function textFromValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) {
      return value
        .map(part => textFromValue(part))
        .filter(Boolean)
        .join(' · ');
    }
    if (typeof value === 'object') {
      const candidates = ['text', 'label', 'name', 'value', 'title'];
      for (const key of candidates) {
        const v = value[key];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    }
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    const str = String(value).trim();
    return str;
  }

  function firstTextValue(...values) {
    for (const value of values) {
      const txt = textFromValue(value);
      if (txt) return txt;
    }
    return '';
  }

  function firstImageUrl(...values) {
    for (const value of values) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        const found = firstImageUrl(...value);
        if (found) return found;
        continue;
      }
      if (typeof value === 'object') {
        const nested = firstImageUrl(
          value.url,
          value.src,
          value.href,
          value.image,
          value.imageUrl,
          value.path,
          value.value
        );
        if (nested) return nested;
        continue;
      }
      const str = String(value).trim();
      if (str) return str;
    }
    return '';
  }

  function collectHeroTimelineData() {
    heroTimeline = [];
    if (!schedule || !Array.isArray(schedule.rows)) return heroTimeline;

    const saunas = Array.isArray(schedule.saunas) ? schedule.saunas : [];
    if (!saunas.length) return heroTimeline;

    const hiddenSaunas = new Set(settings?.slides?.hiddenSaunas || []);
    const highlight = getHighlightMap();
    const rawBase = settings?.slides?.heroTimelineBaseMinutes;
    const parsedBase = Number(rawBase);
    const baseMinutes = Number.isFinite(parsedBase) && parsedBase > 0
      ? Math.max(1, Math.round(parsedBase))
      : 15;
    const rawMax = settings?.slides?.heroTimelineMaxEntries;
    const parsedMax = Number(rawMax);
    const maxEntries = Number.isFinite(parsedMax) && parsedMax > 0
      ? Math.max(1, Math.floor(parsedMax))
      : null;

    (schedule.rows || []).forEach((row, ri) => {
      if (!row) return;
      const time = String(row.time || '').trim();
      const minute = parseHM(time);
      if (!time || minute === null) return;
      const entries = [];
      saunas.forEach((saunaName, colIdx) => {
        if (hiddenSaunas.has(saunaName)) return;
        const cell = (row.entries || [])[colIdx];
        if (!cell || !cell.title) return;
        if (cell.hidden === true || cell.visible === false || cell.enabled === false) return;
        const label = String(cell.title).replace(/\*+$/, '').trim();
        if (!label) return;
        const detail = firstTextValue(
          cell.subtitle,
          cell.detail,
          cell.aroma,
          cell.aromas,
          cell.extra
        );
        const badges = collectCellBadges(cell);
        const saunaImage = settings?.assets?.rightImages?.[saunaName];
        const imageUrl = firstImageUrl(
          cell.heroImage,
          cell.timelineImage,
          cell.image,
          cell.imageUrl,
          cell.mediaUrl,
          cell.badgeImage,
          saunaImage
        );
        const key = 'r' + ri + 'c' + colIdx;
        entries.push({
          sauna: saunaName,
          title: label,
          detail,
          highlight: !!highlight.byCell[key],
          badges,
          imageUrl: imageUrl ? imageUrl : ''
        });
      });
      if (entries.length) heroTimeline.push({ time, minute, entries });
    });

    heroTimeline.sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      return a.time.localeCompare(b.time);
    });

    if (maxEntries && heroTimeline.length > maxEntries) {
      heroTimeline = heroTimeline.slice(0, maxEntries);
    }

    for (let i = 0; i < heroTimeline.length; i++) {
      const cur = heroTimeline[i];
      const next = heroTimeline[i + 1] || null;
      const diff = next ? Math.max(1, next.minute - cur.minute) : baseMinutes;
      const ratio = diff / baseMinutes;
      cur.durationRatio = Number.isFinite(ratio) ? Math.max(0.25, Math.min(4, ratio)) : 1;
      cur.isActive = cur.entries.some(entry => entry.highlight);
    }

    return heroTimeline;
  }

  // ---------- Slide queue ----------
  function buildMasterQueue() {
    maybeApplyPreset();

    const heroEnabled = !!(settings?.slides?.heroEnabled);
    const timeline = heroEnabled ? collectHeroTimelineData() : (heroTimeline = []);
    const hasHero = heroEnabled && timeline.length > 0;
    const withHero = (queue) => hasHero ? [{ type: 'hero-timeline' }, ...queue] : queue.slice();

  const showOverview = (settings?.slides?.showOverview !== false);
  const hidden = new Set(settings?.slides?.hiddenSaunas || []);
  const allSaunas = (schedule?.saunas || []);
  const sortOrder = Array.isArray(settings?.slides?.sortOrder) ? settings.slides.sortOrder : null;

  const storySlidesAll = Array.isArray(settings?.slides?.storySlides)
    ? settings.slides.storySlides
    : [];
  const storyKey = (story, idx) => {
    if (!story) return null;
    if (story.id != null) return String(story.id);
    return 'story_idx_' + idx;
  };
  const storyEntriesAll = storySlidesAll
    .map((story, idx) => {
      const key = storyKey(story, idx);
      if (!story || !key) return null;
      return { key, story, idx };
    })
    .filter(Boolean);
  const storyEntriesEnabled = storyEntriesAll.filter(entry => entry.story.enabled !== false);
  const storyMapAll = new Map(storyEntriesAll.map(entry => [entry.key, entry.story]));
  const storyMapEnabled = new Map(storyEntriesEnabled.map(entry => [entry.key, entry.story]));

  if (sortOrder && sortOrder.length) {
    const queue = [];
    if (showOverview) queue.push({ type: 'overview' });
    const mediaAll = Array.isArray(settings?.interstitials) ? settings.interstitials : [];
    const mediaMap = new Map(mediaAll.map(it => [String(it.id), it]));
    const usedSaunas = new Set();
    const usedMedia = new Set();
    const usedStories = new Set();
    for (const entry of sortOrder) {
      if (entry.type === 'sauna') {
        const name = entry.name;
        if (allSaunas.includes(name) && !hidden.has(name)) {
          queue.push({ type: 'sauna', sauna: name });
          usedSaunas.add(name);
        }
      } else if (entry.type === 'media') {
        const it = mediaMap.get(String(entry.id));
        if (it && it.enabled) {
          const dwell = Number.isFinite(+it.dwellSec)
            ? +it.dwellSec
            : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);
          const node = { type: it.type, dwell, __id: it.id || null };
          if (it.url) {
            if (it.type === 'url') node.url = it.url; else node.src = it.url;
          }
          queue.push(node);
          usedMedia.add(String(it.id));
        }
      } else if (entry.type === 'story') {
        const key = String(entry.id ?? '');
        const story = storyMapEnabled.get(key);
        if (story) {
          queue.push({ type: 'story', story, storyId: key });
          usedStories.add(key);
        }
      }
    }
    for (const s of allSaunas) {
      if (!usedSaunas.has(s) && !hidden.has(s)) queue.push({ type: 'sauna', sauna: s });
    }
    for (const it of mediaAll) {
      const idStr = String(it.id);
      if (!usedMedia.has(idStr) && it && it.enabled) {
        const dwell = Number.isFinite(+it.dwellSec)
          ? +it.dwellSec
          : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);
        const node = { type: it.type, dwell, __id: it.id || null };
        if (it.url) {
          if (it.type === 'url') node.url = it.url; else node.src = it.url;
        }
        queue.push(node);
      }
    }
    for (const entry of storyEntriesEnabled) {
      if (!usedStories.has(entry.key)) {
        queue.push({ type: 'story', story: entry.story, storyId: entry.key });
      }
    }
    const clean = [];
    for (const q of queue) {
      if (q.type === 'sauna') clean.push({ type: 'sauna', name: q.sauna });
      else if (q.__id != null) clean.push({ type: 'media', id: q.__id });
      else if (q.type === 'story') {
        const id = q.storyId ?? (q.story?.id ?? null);
        if (id != null && storyMapAll.has(String(id))) clean.push({ type: 'story', id: String(id) });
      }
    }
    settings.slides.sortOrder = clean;
    if (!queue.length && showOverview) queue.push({ type: 'overview' });
    return withHero(queue);
  }

  // Referenz-Reihenfolge für Saunen (Order aus Settings, dann Rest)
  const cfgOrder = Array.isArray(settings?.slides?.order) ? settings.slides.order.slice() : null;
  let saunaOrderRef = [];
  if (cfgOrder && cfgOrder.length) {
    const seen = new Set();
    for (const e of cfgOrder) if (allSaunas.includes(e) && !seen.has(e)) { saunaOrderRef.push(e); seen.add(e); }
    for (const s of allSaunas) if (!seen.has(s)) saunaOrderRef.push(s);
  } else {
    saunaOrderRef = allSaunas.slice();
  }

  // Sichtbare Saunen in der gleichen (reflektierten) Reihenfolge
  const visibleSaunas = saunaOrderRef.filter(n => !hidden.has(n));

  // Basis-Queue (ohne Bilder)
  const queue = [];
  if (showOverview) queue.push({ type: 'overview' });
  for (const s of visibleSaunas) queue.push({ type: 'sauna', sauna: s });

  // Bilder/Medien vorbereiten
  const mediaAll = Array.isArray(settings?.interstitials) ? settings.interstitials : [];
  const media = [];
  for (const it of mediaAll) {
    if (!it || !it.enabled) continue;
    const base = { ...it };
    switch (it.type) {
      case 'video':
      case 'image':
        if (it.url) media.push({ ...base, type: it.type, src: it.url });
        break;
      case 'url':
        if (it.url) media.push({ ...base, type: 'url', url: it.url });
        break;
      default:
        if (it.url) media.push({ ...base, type: 'image', src: it.url });
    }
  }

  // Medien nach Übersicht einfügen
  const idxOverview = () => queue.findIndex(x => x.type === 'overview');
  let insPos = idxOverview();
  insPos = (insPos >= 0) ? insPos + 1 : 0;
  for (const it of media) {
    const dwell = Number.isFinite(+it.dwellSec)
      ? +it.dwellSec
      : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);
    const node = { type: it.type, dwell, __id: it.id || null };
    if (it.src) node.src = it.src;
    if (it.url && it.type === 'url') node.url = it.url;
    queue.splice(insPos++, 0, node);
  }

  // Story-Slides anhängen
  for (const entry of storyEntriesEnabled) {
    queue.push({ type: 'story', story: entry.story, storyId: entry.key });
  }

  // Falls nichts bleibt, notfalls Übersicht zeigen
  if (!queue.length && showOverview) queue.push({ type: 'overview' });

  return withHero(queue);
}

  // ---------- DOM helpers ----------
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    const isNode = (val) => typeof Node !== 'undefined' && val instanceof Node;
    const toArray = (val) => {
      if (val === undefined || val === null) return [];
      return Array.isArray(val) ? val : [val];
    };

    let attrObj = attrs;
    let childList = children;

    if (!attrObj || typeof attrObj !== 'object' || Array.isArray(attrObj) || isNode(attrObj)) {
      childList = toArray(attrObj).concat(toArray(children));
      attrObj = {};
    } else {
      childList = toArray(children);
    }

    for (const [k, v] of Object.entries(attrObj)) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v);
    }

    for (const c of [].concat(childList)) {
      if (typeof c === 'string' || typeof c === 'number') {
        el.appendChild(document.createTextNode(String(c)));
      } else if (c) {
        el.appendChild(c);
      }
    }
    return el;
  }

  // ---------- Flames ----------
  function inlineFlameSVG() { return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [ h('path', { d: 'M12 2c2 4-1 5-1 7 0 1 1 2 2 2 2 0 3-2 3-4 2 2 4 4 4 7 0 4-3 8-8 8s-8-4-8-8c0-5 5-7 8-12z' }) ]); }
  function formatWeekday(d=new Date()){
    return new Intl.DateTimeFormat('de-DE', { weekday:'long' }).format(d);
  }
  function formatDate(d=new Date()){
    return new Intl.DateTimeFormat('de-DE').format(d);
  }
  function computeH2Text(){
    const cfg = settings?.h2 || { mode:'text', text:'Aufgusszeiten', showOnOverview:true };
    const base = (cfg.text || '').trim();
    const wd = formatWeekday();
    const dt = formatDate();
    switch((cfg.mode||'text')){
      case 'none': return '';
      case 'text': return base;
      case 'weekday': return wd;
      case 'date': return dt;
      case 'text+weekday': return [base, wd].filter(Boolean).join(' ');
      case 'text+date': return [base, dt].filter(Boolean).join(' ');
      default: return base;
    }
  }
 function flameNode() {
    const url = settings?.assets?.flameImage || '/assets/img/flame_test.svg';
    const box = h('div', { class: 'flame' });
    if (url) { const img = h('img', { src: url, alt: '' }); img.addEventListener('error', () => { box.innerHTML = ''; box.appendChild(inlineFlameSVG()); }); box.appendChild(img); return box; }
    box.appendChild(inlineFlameSVG()); return box;
  }
  function flamesWrap(spec) {
    let count = 0, approx = false;
    if (!spec) count = 0; else if (spec === '1') count = 1; else if (spec === '2') count = 2; else if (spec === '3') count = 3; else if (spec === '1-2') { count = 2; approx = true; } else if (spec === '2-3' || spec === '1-3') { count = 3; approx = true; }
    const wrap = h('div', { class: 'flames' + (approx ? ' approx' : '') });
    wrap.appendChild(count >= 1 ? flameNode() : h('span'));
    wrap.appendChild(count >= 2 ? flameNode() : h('span'));
    wrap.appendChild(count >= 3 ? flameNode() : h('span'));
    return wrap;
  }

  // ---------- Footnotes ----------
  function footnoteMap() {
    const list = Array.isArray(settings?.footnotes) ? settings.footnotes : [];
    const map = new Map();
    for (const fn of list) if (fn && fn.id) map.set(fn.id, { label: fn.label || '*', text: fn.text || '' });
    return map;
  }
  function noteSup(cell, notes) {
    const id = cell?.noteId; if (!id) return null;
    const fn = notes.get(id); if (!fn) return null;
    return h('sup', { class: 'note' }, String(fn.label || '*'));
  }

  const SLIDE_COMPONENT_DEFAULTS = { title:true, description:true, aromas:true, facts:true, badges:true };

  function getSlideComponentFlags(){
    const src = settings?.slides?.enabledComponents;
    const merged = { ...SLIDE_COMPONENT_DEFAULTS };
    if (src && typeof src === 'object'){
      Object.keys(merged).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(src, key)) merged[key] = !!src[key];
      });
    }
    return merged;
  }

  function renderComponentNodes(flags, defs, fallbackFactory, onNode){
    const enabled = flags || {};
    const anyEnabled = Object.values(enabled).some(Boolean);
    const nodes = [];
    let appendedCount = 0;
    defs.forEach(def => {
      if (!def) return;
      const { key } = def;
      if (!key) return;
      if (enabled[key] === false) return;
      const node = def.node ?? (typeof def.render === 'function' ? def.render() : null);
      if (!node) return;
      if (typeof onNode === 'function') {
        const res = onNode(node, def);
        if (res === undefined) {
          appendedCount++;
        } else if (res && res !== false) {
          nodes.push(res);
          appendedCount++;
        }
      } else {
        nodes.push(node);
        appendedCount++;
      }
    });
    if (appendedCount === 0 && typeof fallbackFactory === 'function'){
      const fallbackNode = fallbackFactory(anyEnabled);
      if (fallbackNode) {
        if (typeof onNode === 'function') {
          const res = onNode(fallbackNode, null);
          if (res === undefined) {
            appendedCount++;
          } else if (res && res !== false) {
            nodes.push(res);
            appendedCount++;
          }
        } else {
          nodes.push(fallbackNode);
          appendedCount++;
        }
      }
    }
    return nodes;
  }

  function gatherList(...values){
    const seen = new Set();
    const out = [];
    const add = (txt) => {
      const str = String(txt ?? '').trim();
      if (!str) return;
      const key = str.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(str);
    };
    const walk = (value) => {
      if (value == null) return;
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (typeof value === 'object') {
        if (typeof value.text === 'string') { walk(value.text); return; }
        if (typeof value.label === 'string') { walk(value.label); return; }
        if (typeof value.value === 'string') { walk(value.value); return; }
        if (typeof value.name === 'string') { walk(value.name); return; }
        return;
      }
      if (typeof value === 'string') {
        value.split(/[|•·;\n\r]+/).forEach(part => add(part));
        return;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        add(value);
      }
    };
    values.forEach(walk);
    return out;
  }

  function firstText(...values){
    for (const value of values) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        const parts = value.map(v => firstText(v)).filter(Boolean);
        if (parts.length) return parts.join(' · ');
        continue;
      }
      if (typeof value === 'object') {
        if (typeof value.text === 'string' && value.text.trim()) return value.text.trim();
        if (typeof value.label === 'string' && value.label.trim()) return value.label.trim();
        if (typeof value.value === 'string' && value.value.trim()) return value.value.trim();
        if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
        continue;
      }
      const str = String(value).trim();
      if (str) return str;
    }
    return '';
  }

  function normalizeBadgeDescriptor(descriptor, fallbackId){
    if (descriptor == null) return null;
    const entry = (descriptor && typeof descriptor === 'object' && !Array.isArray(descriptor)) ? descriptor : null;
    const visible = entry ? (entry.enabled !== false && entry.visible !== false && entry.hidden !== true) : true;
    if (!visible) return null;
    const label = entry ? firstText(entry.label, entry.text, entry.title, entry.name, entry.value) : firstText(descriptor);
    const icon = entry ? firstText(entry.icon, entry.symbol, entry.glyph, entry.emoji) : '';
    const fallbackStr = (typeof fallbackId === 'string' || typeof fallbackId === 'number' || typeof fallbackId === 'boolean')
      ? String(fallbackId).trim()
      : '';
    let id = '';
    if (entry) {
      const rawId = entry.id ?? entry.key ?? entry.code ?? entry.slug ?? entry.uid ?? fallbackStr;
      if (typeof rawId === 'string' || typeof rawId === 'number' || typeof rawId === 'boolean') {
        id = String(rawId).trim();
      }
    } else {
      id = fallbackStr;
    }
    const labelStr = String(label || '').trim();
    const iconStr = String(icon || '').trim();
    const preferLabelId = (!entry || (fallbackStr && id === fallbackStr && /^(?:row:|idx:|cell:|legacy$)/i.test(fallbackStr)));
    const finalId = preferLabelId ? (labelStr || iconStr || id) : (id || labelStr || iconStr);
    if (!finalId || (!labelStr && !iconStr)) return null;
    return { id: finalId, label: labelStr, icon: iconStr };
  }

  function getBadgeLookup(){
    const lib = settings?.slides?.badgeLibrary;
    const source = lib || null;
    if (badgeLookupCache && badgeLookupCache.source === source) return badgeLookupCache.value;
    const byId = new Map();
    const byLower = new Map();
    const addEntry = (descriptor, fallbackId) => {
      const badge = normalizeBadgeDescriptor(descriptor, fallbackId);
      if (!badge) return;
      const key = badge.id;
      if (!key) return;
      byId.set(key, badge);
      byLower.set(key.toLowerCase(), badge);
    };
    if (Array.isArray(lib)) {
      lib.forEach((entry, idx) => {
        if (entry == null) return;
        let fallback = `idx:${idx}`;
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          const rawId = entry.id ?? entry.key ?? entry.code ?? entry.slug ?? entry.uid;
          if (typeof rawId === 'string' || typeof rawId === 'number' || typeof rawId === 'boolean') {
            fallback = rawId;
          }
        }
        addEntry(entry, fallback);
      });
    } else if (lib && typeof lib === 'object') {
      Object.entries(lib).forEach(([key, value]) => {
        addEntry(value, key);
      });
    }
    const value = { byId, byLower };
    badgeLookupCache = { source, value };
    return value;
  }

  function collectCellBadges(cell){
    if (!cell) return [];
    const { byId, byLower } = getBadgeLookup();
    const out = [];
    const seen = new Set();
    const addBadge = (badge) => {
      if (!badge) return;
      const idKey = (typeof badge.id === 'string') ? badge.id.trim().toLowerCase() : '';
      const composite = [badge.label, badge.icon]
        .map(v => String(v || '').trim().toLowerCase())
        .join('|');
      const dedupeKey = idKey || composite;
      if (!dedupeKey || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      out.push({ ...badge });
    };
    const lookupBadge = (raw, idx) => {
      if (raw == null) return;
      if (typeof raw === 'object' && !Array.isArray(raw)) {
        const badge = normalizeBadgeDescriptor(raw, raw.id ?? raw.key ?? raw.code ?? `cell:${idx}`);
        if (badge) addBadge(badge);
        return;
      }
      let id = '';
      if (typeof raw === 'string') id = raw.trim();
      else if (typeof raw === 'number' || typeof raw === 'boolean') id = String(raw);
      if (!id) return;
      const badge = byId.get(id) || byLower.get(id.toLowerCase());
      if (badge) addBadge(badge);
    };
    const ids = cell.badgeIds;
    if (Array.isArray(ids)) ids.forEach((value, idx) => lookupBadge(value, idx));
    else if (ids != null) lookupBadge(ids, 0);
    if (cell.badgeId != null) lookupBadge(cell.badgeId, 'single');
    if (!out.length) {
      const legacy = normalizeBadgeDescriptor({
        label: firstText(cell?.badgeLabel, cell?.badgeText, cell?.type),
        icon: firstText(cell?.badgeIcon)
      }, 'legacy');
      if (legacy) addBadge(legacy);
    }
    return out;
  }

  function collectCellDetails(cell){
    if (!cell) return { description:'', aromas:[], facts:[], badges:[] };
    const description = firstText(cell.description, cell.detail, cell.subtitle, cell.text, cell.extra);
    const aromas = gatherList(cell.aromaList, cell.aromas, cell.aroma, cell.scent, cell.scents);
    const facts = gatherList(cell.facts, cell.details, cell.detailsList, cell.tags, cell.chips, cell.meta, cell.badges);
    const badges = collectCellBadges(cell);
    return { description, aromas, facts, badges };
  }

  function createDescriptionNode(text, className){
    const str = String(text || '').trim();
    if (!str) return null;
    return h('p', { class: className || 'description' }, str);
  }

  function createAromaListNode(items, className){
    const values = [];
    let italic = false;
    const pushValue = (value) => {
      if (value == null) return;
      if (Array.isArray(value)) { value.forEach(pushValue); return; }
      const text = firstText(value);
      if (text) values.push(text);
    };
    if (Array.isArray(items)) {
      items.forEach(pushValue);
    } else if (items && typeof items === 'object') {
      if (Array.isArray(items.items)) items.items.forEach(pushValue);
      else if (Array.isArray(items.list)) items.list.forEach(pushValue);
      else if (Array.isArray(items.values)) items.values.forEach(pushValue);
      else if (Array.isArray(items.aromas)) items.aromas.forEach(pushValue);
      else pushValue(items);
      italic = items.italic === true || items.isItalic === true || items.style === 'italic';
    } else if (items != null) {
      pushValue(items);
    }
    if (!values.length) return null;
    const clsParts = (typeof className === 'string' && className.trim())
      ? className.split(/\s+/).filter(Boolean)
      : [];
    const hadLegacyItalic = clsParts.includes('is-italic');
    const filteredCls = clsParts.filter(cls => cls !== 'is-italic');
    if (!filteredCls.length) filteredCls.push('aroma-list');
    const shouldItalic = italic || hadLegacyItalic;
    const attrs = { class: filteredCls.join(' ') };
    if (shouldItalic) attrs.style = 'font-style:italic;';
    const nodes = values.map(item => h('li', item));
    return h('ul', attrs, nodes);
  }

  function createFactsList(items, className = 'facts', chipClass = 'card-chip'){
    const list = Array.isArray(items) ? items.filter(v => String(v || '').trim()) : [];
    if (!list.length) return null;
    const nodes = list.map(fact => h('li', { class: chipClass }, fact));
    return h('ul', { class: className }, nodes);
  }

  function collectUniqueBadges(badges){
    const list = [];
    const collect = (value, idx) => {
      if (value == null) return;
      const fallbackId = (value && typeof value === 'object' && !Array.isArray(value))
        ? (value.id ?? value.key ?? value.code ?? value.slug ?? value.uid ?? `row:${idx}`)
        : `row:${idx}`;
      const badge = normalizeBadgeDescriptor(value, fallbackId);
      if (badge) list.push(badge);
    };
    if (Array.isArray(badges)) badges.forEach((value, idx) => collect(value, idx));
    else if (badges != null) collect(badges, 0);
    if (!list.length) return [];
    const seen = new Set();
    const uniqueBadges = [];
    list.forEach(badge => {
      const idKey = (typeof badge.id === 'string') ? badge.id.trim().toLowerCase() : '';
      const composite = [badge.label, badge.icon]
        .map(v => String(v || '').trim().toLowerCase())
        .join('|');
      const dedupeKey = idKey || composite;
      if (!dedupeKey || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      uniqueBadges.push({ ...badge });
    });
    return uniqueBadges;
  }

  function createBadgeRow(badges, className){
    const uniqueBadges = collectUniqueBadges(badges);
    if (!uniqueBadges.length) return null;
    const defaultIcon = String(settings?.slides?.infobadgeIcon || '').trim();
    const nodes = [];
    uniqueBadges.forEach(badge => {
      const iconChar = String(badge.icon || '').trim();
      const label = String(badge.label || '').trim();
      const bits = [];
      const glyph = iconChar || defaultIcon;
      if (glyph) bits.push(h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, glyph));
      if (label) bits.push(h('span', { class: 'badge-label' }, label));
      if (!bits.length) return;
      const attrs = { class: 'badge' };
      if (badge.id) attrs['data-badge-id'] = badge.id;
      nodes.push(h('span', attrs, bits));
    });
    if (!nodes.length) return null;
    const clsParts = (typeof className === 'string' && className.trim())
      ? className.split(/\s+/).filter(Boolean)
      : [];
    if (!clsParts.includes('badge-row')) clsParts.unshift('badge-row');
    const node = h('div', { class: clsParts.join(' ') }, nodes);
    Object.defineProperty(node, '__badgeList', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: uniqueBadges
    });
    return node;
  }

  // ---------- Highlight logic ----------
  function getHighlightMap() {
    const HL = settings?.highlightNext || {};
    if (!HL.enabled) return { bySauna: {}, byCell: {} };

    const before = Number.isFinite(+HL.minutesBeforeNext) ? +HL.minutesBeforeNext : (Number.isFinite(+HL.minutesWindow) ? +HL.minutesWindow : 15);
    const after  = Number.isFinite(+HL.minutesAfterStart) ? +HL.minutesAfterStart : (Number.isFinite(+HL.minutesAfter) ? +HL.minutesAfter : 15);
    const now = nowMinutes();

    const bySauna = {}; const byCell = {};
    (schedule?.saunas ?? []).forEach((saunaName, colIdx) => {
      const times = [];
      (schedule?.rows ?? []).forEach((row, ri) => {
        const cell = (row?.entries ?? [])[colIdx];
        if (cell && cell.title) { const m = parseHM(row.time); if (m !== null) times.push({ m, ri, time: row.time }); }
      });
      times.sort((a, b) => a.m - b.m);
      let chosen = null;
      for (const t of times) { if (now >= t.m && now <= t.m + after) { chosen = t; break; } }
      if (!chosen) for (const t of times) { if (t.m >= now && (t.m - now) <= before) { chosen = t; break; } }
      if (chosen) { bySauna[saunaName] = new Set([chosen.time]); byCell['r' + chosen.ri + 'c' + colIdx] = true; }
    });
    return { bySauna, byCell };
  }

  // ---------- Overview table ----------

// --- Chip-Text fitting (Übersicht) ---
function fitChipText(el, mode){
  const chip = el.closest('.chip'); if (!chip) return;

  // Reset
  el.style.fontSize = '';
  el.classList.toggle('ellipsis', mode === 'ellipsis');
  if (mode === 'ellipsis') return; // CSS erledigt Kürzung

  const base = parseFloat(getComputedStyle(el).fontSize) || 16;
  el.style.fontSize = base + 'px';

  const cs = getComputedStyle(chip);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const flamesBox = chip.querySelector('.chip-flames');
  const flamesW = flamesBox ? flamesBox.getBoundingClientRect().width : 0;
  const free = chip.clientWidth - padX - flamesW - 1;

  if (el.scrollWidth <= free) return;

  let size = base;
  const min = Math.max(10, base * 0.6);
  while (size > min && el.scrollWidth > free){
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
  if (el.scrollWidth > free){
    el.classList.add('ellipsis'); // letzte Sicherung
  }
}
//ERRORS
window.onerror = function (msg, src, line, col) {
  const d = document.createElement('div');
  d.style = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,.5);color:#fff;padding:8px 10px;border-radius:8px;font:12px/1.2 monospace';
  d.textContent = '[JS] ' + msg + ' @ ' + (src||'') + ':' + line + ':' + col;
  document.body.appendChild(d);
};


function fitChipsIn(container){
  const mode = document.body.dataset.chipOverflow || 'scale';
  container.querySelectorAll('.chip .chip-text').forEach(n => fitChipText(n, mode));
}

function tableGrid(hlMap) {
  if (!schedule) {
    return h('div', { class: 'caption grid-placeholder' }, 'Keine Daten verfügbar.');
  }

  const notes = footnoteMap();
  const showFlames = (settings?.fonts?.overviewShowFlames !== false);
  const t = h('table', { class: 'grid' });
  const colg = h('colgroup');
  colg.appendChild(h('col', { class: 'c_time' }));
  for (const _ of (schedule?.saunas ?? [])) colg.appendChild(h('col', { class: 'c_auto' }));
  t.appendChild(colg);

  const thead = h('thead');
  const tr = h('tr');
  tr.appendChild(h('th', { class: 'timecol corner' }, 'Zeit'));
  for (const s of (schedule?.saunas ?? [])) tr.appendChild(h('th', {}, s));
  thead.appendChild(tr); t.appendChild(thead);

  const usedSet = new Set();
  const tb = h('tbody');
  (schedule?.rows ?? []).forEach((row, ri) => {
    const trr = h('tr');
    trr.appendChild(h('td', { class: 'timecol' }, row?.time || ''));
    (row?.entries ?? []).forEach((cell, ci) => {
      const td = h('td', {}, []);
      const key = 'r' + ri + 'c' + ci;
      if (cell && cell.title) {
          const title = String(cell.title).replace(/\*+$/, '');
          const hasStarInText = /\*$/.test(cell.title || '');
// Textbereich
const txt = h('div', { class: 'chip-text' }, title);
if (hasStarInText) txt.appendChild(h('span', { class: 'notewrap' }, [h('sup', {class:'note legacy'}, '*')]));
const supNote = noteSup(cell, notes);
if (supNote) { txt.appendChild(h('span', { class: 'notewrap' }, [supNote])); usedSet.add(cell.noteId); }

// Chip-Container (Flex: Text links, Flammen rechts)
const chipChildren = [txt];
if (showFlames) {
  chipChildren.push(h('div', { class: 'chip-flames' }, [flamesWrap(cell.flames || '')]));
}
const chip = h('div', { class: 'chip' + (hlMap?.byCell?.[key] ? ' highlight' : '') }, chipChildren);
const wrap = h('div', { class: 'cellwrap' }, [chip]);
          td.appendChild(wrap);
        } else {
          td.appendChild(h('div', { class: 'caption' }, '—'));
        }
        trr.appendChild(td);
      });
      tb.appendChild(trr);
    });
    t.appendChild(tb);

const footNodes = [];
const order = (settings?.footnotes||[]).map(fn=>fn.id);
for (const id of order){ if (usedSet.has(id)){ const v = notes.get(id); if (v) footNodes.push(h('div',{class:'fnitem'}, [h('sup',{class:'note'}, String(v.label||'*')), ' ', v.text])); } }
const layout = (settings?.footnoteLayout ?? 'one-line');
const fnClass = 'footer-note ' + (layout==='multi' ? 'fn-multi' : layout==='stacked' ? 'fn-stack' : 'fn-one');
if (footNodes.length){
  const nodes = [];
  footNodes.forEach((n,i)=>{ if (i>0 && layout!=='stacked') nodes.push(h('span',{class:'fnsep','aria-hidden':'true'}, '•')); nodes.push(n); });
  return h('div', {}, [ t, h('div', { class: fnClass }, nodes) ]);
}
return h('div', {}, [ t ]);
  }

  function autoScaleOverview(container) {
    const wrap = container.querySelector('.ovwrap'); if (!wrap) return;

    // Reset (keine Breiten-Skalierung)
    wrap.style.transform = 'none';
    container.style.setProperty('--ovAuto', '1');

    const measure = () => {
      const headH = Array.from(container.querySelectorAll('.h1,.h2'))
        .reduce((a, el) => a + el.getBoundingClientRect().height, 0);
      const footEl = container.querySelector('.footer-note');
      const wrapRect = wrap.getBoundingClientRect();
      const footH = footEl ? footEl.getBoundingClientRect().height : 0;
      return { headH, footH, wrapH: wrapRect.height, totalH: headH + wrapRect.height + footH + 8 };
    };

    const availH = container.clientHeight;

    // Erster grober Faktor
    let m = measure();
    let s = Math.max(0.25, Math.min(1, availH / m.totalH));
    container.style.setProperty('--ovAuto', String(s));

    // Nach Layout-Update neu messen und ggf. nachjustieren
    requestAnimationFrame(() => {
      let m2 = measure();
      if (m2.totalH <= availH) return;
      let lo = 0.25, hi = s;
      for (let i = 0; i < 4; i++) {
        const mid = (lo + hi) / 2;
        container.style.setProperty('--ovAuto', String(mid));
        m2 = measure();
        if (m2.totalH > availH) {
          hi = mid;
        } else {
          lo = mid;
        }
        if (Math.abs(m2.totalH - availH) < 1) break;
      }
    });
  }

  function renderOverview(region = 'left') {
    const hlMap = getHighlightMap();
    const table = tableGrid(hlMap);
    const rightH2 = (((settings?.h2?.showOnOverview) ?? true) && (settings?.h2?.mode||'text')!=='none')
      ? h('h2',{class:'h2'}, computeH2Text() || '')
      : null;
    const bar = h('div',{class:'ovbar headings'}, [ h('h1',{class:'h1'}, 'Aufgussplan'), rightH2 ]);
    const c = h('div', {class:'container overview fade show'}, [ bar, h('div', {class:'ovwrap'}, [table]) ]);
    const recalc = () => {
      autoScaleOverview(c);
      fitChipsIn(c); // nach dem Autoscale die Chip-Texte einpassen
    };
    setTimeout(recalc, 0);
    if (document.fonts?.ready) { document.fonts.ready.then(recalc).catch(()=>{}); }
    setResizeHandler(region, recalc);
    return c;
  }

  function renderHeroTimeline(region = 'left') {
    const data = (heroTimeline.length ? heroTimeline : collectHeroTimelineData()).slice();
    const headingWrap = h('div', { class: 'headings hero-headings' }, [
      h('h1', { class: 'h1' }, settings?.slides?.heroTitle || 'Tagesüberblick'),
      h('h2', { class: 'h2' }, computeH2Text() || '')
    ]);

    const list = h('div', { class: 'hero-timeline-list' });

    if (!data.length) {
      list.appendChild(h('div', { class: 'caption' }, 'Keine Einträge.'));
    } else {
      data.forEach((row, idx) => {
        const cls = 'timeline-item' + (row.isActive ? ' is-active' : '');
        const item = h('div', { class: cls });
        item.style.setProperty('--hero-index', String(idx));
        if (Number.isFinite(+row.durationRatio)) {
          item.style.setProperty('--hero-duration-ratio', String(row.durationRatio));
        }

        item.appendChild(h('div', { class: 'timeline-time' }, row.time + ' Uhr'));

        const details = h('div', { class: 'timeline-details' });
        row.entries.forEach(entry => {
          const hasBadges = Array.isArray(entry.badges) && entry.badges.length > 0;
          const classParts = ['timeline-entry'];
          if (entry.highlight) classParts.push('highlight');
          if (entry.imageUrl) classParts.push('has-thumb'); else classParts.push('no-thumb');
          if (hasBadges) classParts.push('has-badges');
          const entryNode = h('div', { class: classParts.join(' ') });

          const thumb = h('div', { class: 'timeline-entry-thumb' });
          if (entry.imageUrl) {
            const style = 'background-image:url(' + JSON.stringify(entry.imageUrl) + ')';
            thumb.appendChild(h('div', { class: 'timeline-entry-thumb-image', style }));
          } else {
            thumb.classList.add('is-empty');
            const fallbackSrc = firstText(entry.sauna, entry.title, entry.detail).trim();
            const fallbackChar = fallbackSrc ? fallbackSrc.charAt(0).toUpperCase() : '';
            if (fallbackChar) {
              thumb.appendChild(h('span', { class: 'timeline-entry-thumb-fallback' }, fallbackChar));
            }
          }
          entryNode.appendChild(thumb);

          const content = h('div', { class: 'timeline-entry-content' });
          const header = h('div', { class: 'timeline-entry-header' });
          header.appendChild(h('span', { class: 'timeline-sauna' }, entry.sauna));
          header.appendChild(h('span', { class: 'timeline-title' }, entry.title));
          content.appendChild(header);
          if (entry.detail) {
            content.appendChild(h('div', { class: 'timeline-detail' }, entry.detail));
          }
          if (hasBadges) {
            const badgeRow = createBadgeRow(entry.badges, 'timeline-entry-badges');
            if (badgeRow) content.appendChild(badgeRow);
          }
          entryNode.appendChild(content);
          details.appendChild(entryNode);
        });
        item.appendChild(details);

        const bar = h('div', { class: 'timeline-bar' }, [
          h('div', { class: 'timeline-progress' })
        ]);
        item.appendChild(bar);

        list.appendChild(item);
      });
    }

    const body = h('div', { class: 'hero-body' }, [list]);
    const container = h('div', { class: 'container hero hero-timeline fade show' }, [
      headingWrap,
      body,
      h('div', { class: 'brand' }, 'Signage')
    ]);

    setResizeHandler(region, null);
    return container;
  }

// ---------- Interstitial image slide ----------
function renderImage(url, region = 'left', ctx = {}) {
  const fill = h('div', { class: 'imgFill', style: 'background-image:url("'+url+'")' });
  const c = h('div', { class: 'container imgslide fade show' }, [ fill ]);
  const img = new Image();
  img.onload = () => {
    fill.style.backgroundSize = chooseFit(img.naturalWidth, img.naturalHeight);
  };
  img.src = url;
  return c;
}

// ---------- Interstitial video slide ----------
function renderVideo(src, opts = {}, region = 'left', ctx = {}) {
  const disp = getDisplayRatio();
  const v = document.createElement('video');
  v.preload = 'auto';
  v.autoplay = true;
  if (opts.muted !== undefined) v.muted = !!opts.muted;
  else v.muted = true;
  v.playsInline = true;
  const advance = typeof ctx.advance === 'function' ? ctx.advance : null;
  const scheduleAdvance = typeof ctx.scheduleAdvance === 'function' ? ctx.scheduleAdvance : null;
  const clearScheduledAdvance = typeof ctx.clearScheduledAdvance === 'function' ? ctx.clearScheduledAdvance : null;
  const fit = () => {
    const baseW = settings?.display?.baseW || 1920;
    const baseH = settings?.display?.baseH || 1080;
    v.style.objectFit = chooseFit(
      v.videoWidth || baseW,
      v.videoHeight || baseH,
      { type: 'video' }
    );
  };
  if (v.readyState >= 1) fit(); else v.addEventListener('loadedmetadata', fit);
  v.addEventListener('canplay', () => v.play());
  v.addEventListener('error', (e) => {
    console.error('[video] error', e);
    const srcUrl = v.src;
    v.remove();
    if (srcUrl.startsWith('blob:')) URL.revokeObjectURL(srcUrl);
    const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
    c.appendChild(fallback);
    if (advance) advance();
  });
  if (settings?.slides?.waitForVideo) {
    const done = () => {
      if (done.called) return;
      done.called = true;
      if (clearScheduledAdvance) clearScheduledAdvance();
      if (advance) advance();
    };
    v.addEventListener('loadedmetadata', () => {
      const dur = Number.isFinite(v.duration) && v.duration > 0
        ? v.duration
        : (dwellMsForItem(opts, ctx.pageConfig) / 1000);
      const ms = Math.max(1000, dur * 1000) + 500;
      if (scheduleAdvance) scheduleAdvance(ms);
    }, { once: true });
    v.addEventListener('ended', () => { if (clearScheduledAdvance) clearScheduledAdvance(); done(); }, { once: true });
  }
  const c = h('div', { class: 'container videoslide fade show', style: 'aspect-ratio:' + disp });
  c.appendChild(v);

  fetch(src, { method: 'HEAD' }).then(res => {
    if (!res.ok) {
      v.remove();
      const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
      c.appendChild(fallback);
      if (advance) advance();
      return;
    }
    v.src = src;
  }).catch(() => {
    v.remove();
    const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
    c.appendChild(fallback);
    if (advance) advance();
  });

  return c;
}

// ---------- Interstitial external URL slide ----------
function renderUrl(src, region = 'left', ctx = {}) {
  const f = h('iframe', {
    src,
    class: 'urlFill',
    style: 'border:0'
  });
  f.addEventListener('load', () => {
    try {
      const doc = f.contentWindow.document;
      const selectors = ['[id*="cookie"]', '.cookie-banner', '.cc-window', '.cookie-consent'];
      if (Array.isArray(settings?.popupSelectors)) {
        selectors.push(...settings.popupSelectors);
      }
      doc.querySelectorAll(selectors.join(',')).forEach(el => {
        if (typeof el.remove === 'function') el.remove();
        else el.style.display = 'none';
      });
    } catch (e) {
      /* ignore cross-origin */
    }
  });
  const c = h('div', { class: 'container urlslide fade show' }, [f]);
  return c;
}


function normalizeStoryLayout(value) {
  if (typeof value !== 'string') return '';
  const norm = value.trim().toLowerCase();
  if (!norm) return '';
  if (['single', 'single-column', '1col', 'one', 'one-column', 'column1'].includes(norm)) return 'single';
  if (['double', 'two', '2col', 'dual', 'split', 'two-column', 'columns'].includes(norm)) return 'double';
  return '';
}

function normalizeMediaPosition(value) {
  if (typeof value !== 'string') return '';
  const norm = value.trim().toLowerCase();
  if (!norm) return '';
  if (['media-left', 'left', 'start'].includes(norm)) return 'left';
  if (['media-right', 'right', 'end'].includes(norm)) return 'right';
  if (['top', 'above', 'header'].includes(norm)) return 'top';
  if (['bottom', 'below', 'footer'].includes(norm)) return 'bottom';
  if (['full', 'fullwidth', 'full-width', 'wide', 'banner'].includes(norm)) return 'full';
  return '';
}

function gatherStorySaunaTargets(value) {
  const list = [];
  const push = (entry) => {
    if (entry == null) return;
    if (Array.isArray(entry)) {
      entry.forEach(push);
      return;
    }
    if (typeof entry === 'object') {
      if (Array.isArray(entry.items)) { entry.items.forEach(push); return; }
      if (Array.isArray(entry.list)) { entry.list.forEach(push); return; }
      if (Array.isArray(entry.values)) { entry.values.forEach(push); return; }
    }
    const text = String(entry || '').trim();
    if (!text) return;
    if (!list.includes(text)) list.push(text);
  };
  push(value);
  return list;
}

function normalizeStoryImageEntry(entry) {
  if (!entry) return { url: '', alt: '', caption: '' };
  if (typeof entry === 'string') {
    const url = entry.trim();
    return { url, alt: '', caption: '' };
  }
  if (Array.isArray(entry)) {
    for (const item of entry) {
      const normalized = normalizeStoryImageEntry(item);
      if (normalized.url) return normalized;
    }
    return { url: '', alt: '', caption: '' };
  }
  if (typeof entry !== 'object') return { url: '', alt: '', caption: '' };
  const url = String(entry.url || entry.src || entry.imageUrl || '').trim();
  const alt = String(entry.alt || entry.imageAlt || entry.title || '').trim();
  const captionRaw = String(entry.caption || entry.imageCaption || '').trim();
  const credit = String(entry.credit || '').trim();
  const caption = credit ? [captionRaw, credit].filter(Boolean).join(' · ') : captionRaw;
  const result = { url, alt, caption };
  if (entry.aspect || entry.ratio) {
    const aspect = String(entry.aspect || entry.ratio || '').trim();
    if (aspect) result.aspect = aspect;
  }
  if (entry.placeholder) result.placeholder = entry.placeholder;
  return result;
}

function normalizeStoryGallery(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map(item => {
    if (!item) return null;
    if (typeof item === 'string') {
      const url = item.trim();
      return url ? { url, alt: '', caption: '' } : null;
    }
    if (typeof item !== 'object') return null;
    const url = String(item.url || item.imageUrl || item.src || '').trim();
    if (!url) return null;
    const alt = String(item.alt || item.imageAlt || '').trim();
    const caption = String(item.caption || item.text || '').trim();
    return { url, alt, caption };
  }).filter(Boolean);
}

function normalizeStoryFaq(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map(entry => {
    if (!entry || typeof entry !== 'object') return null;
    const question = String(entry.question || entry.q || '').trim();
    const answer = String(entry.answer || entry.a || '').trim();
    if (!question && !answer) return null;
    return { question: question || 'Frage', answer };
  }).filter(Boolean);
}

function normalizeParagraphString(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean).join('\n\n');
  }
  return String(value ?? '').trim();
}

function normalizeTipsList(value) {
  const out = [];
  const push = (entry) => {
    if (entry == null) return;
    if (Array.isArray(entry)) { entry.forEach(push); return; }
    const str = String(entry || '').trim();
    if (!str) return;
    str.split(/\r?\n/).forEach(line => {
      const cleaned = line.replace(/^[-•]\s*/, '').trim();
      if (cleaned) out.push(cleaned);
    });
  };
  push(value);
  return out;
}

function normalizeStorySectionType(value) {
  const norm = String(value || '').trim().toLowerCase();
  if (!norm) return '';
  if (['image', 'media', 'photo', 'picture'].includes(norm)) return 'image';
  if (['gallery', 'grid'].includes(norm)) return 'gallery';
  if (['faq', 'questions'].includes(norm)) return 'faq';
  if (['availability', 'schedule'].includes(norm)) return 'availability';
  if (['custom'].includes(norm)) return 'custom';
  return 'card';
}

function normalizeStorySection(section) {
  if (section == null) return null;
  if (typeof section === 'function') return { type: 'custom', render: section };
  if (typeof section === 'string') {
    const trimmed = section.trim();
    return trimmed ? { type: 'card', text: trimmed } : null;
  }
  if (Array.isArray(section)) {
    const merged = section.map(normalizeStorySection).filter(Boolean);
    if (!merged.length) return null;
    if (merged.length === 1) return merged[0];
    return { type: 'card', bodyNodes: merged.map(entry => entry.bodyNodes).flat().filter(Boolean) };
  }
  if (typeof section !== 'object') return null;
  if (typeof section.render === 'function') return { type: 'custom', render: section.render };
  const type = normalizeStorySectionType(section.type || section.kind || section.variant);
  if (type === 'image') {
    const image = normalizeStoryImageEntry(section.image || section.media || section);
    if (!image.url && !section.showPlaceholder) {
      const heading = String(section.heading || section.title || '').trim();
      const text = normalizeParagraphString(section.text || section.description);
      if (!heading && !text) return null;
    }
    const heading = String(section.heading || section.title || '').trim();
    const subheading = String(section.subheading || section.caption || '').trim();
    const description = String(section.text || section.description || '').trim();
    const out = {
      type: 'image',
      heading,
      subheading,
      description,
      image,
      className: String(section.className || '').trim(),
      variant: String(section.variant || '').trim()
    };
    if (section.showPlaceholder) out.showPlaceholder = true;
    return out;
  }
  if (type === 'availability') {
    return {
      type: 'availability',
      title: String(section.heading || section.title || section.label || '').trim(),
      description: String(section.description || section.text || '').trim(),
      emptyMessage: String(section.emptyMessage || section.emptyText || '').trim(),
      saunas: gatherStorySaunaTargets(section.saunas || section.saunaRefs || section.sauna)
    };
  }
  const gallery = normalizeStoryGallery(section.gallery || section.items || []);
  if (type === 'gallery' && gallery.length) {
    return {
      type: 'card',
      className: 'story-card--gallery',
      heading: String(section.heading || section.title || '').trim(),
      gallery,
      text: normalizeParagraphString(section.text)
    };
  }
  const faq = normalizeStoryFaq(section.faq || section.items || []);
  if (type === 'faq' && faq.length) {
    return {
      type: 'card',
      className: 'story-card--faq',
      heading: String(section.heading || section.title || 'FAQ').trim(),
      faq
    };
  }
  const card = {
    type: 'card',
    id: section.id,
    className: String(section.className || '').trim(),
    kicker: String(section.kicker || section.overline || section.label || '').trim(),
    heading: String(section.heading || section.title || '').trim(),
    subheading: String(section.subheading || '').trim(),
    text: normalizeParagraphString(section.text ?? section.body ?? section.description),
    paragraphs: Array.isArray(section.paragraphs) ? section.paragraphs : null,
    list: Array.isArray(section.list) ? section.list : (Array.isArray(section.items) ? section.items : null),
    listStyle: String(section.listStyle || section.listType || '').trim(),
    image: (section.image || section.media || section.imageUrl || section.mediaUrl)
      ? normalizeStoryImageEntry(section.image || section.media || { url: section.imageUrl || section.mediaUrl, alt: section.imageAlt, caption: section.imageCaption })
      : null,
    mediaPosition: normalizeMediaPosition(section.mediaPosition || section.imagePosition || section.layout),
    bodyNodes: Array.isArray(section.bodyNodes) ? section.bodyNodes : null,
    gallery: gallery.length ? gallery : null,
    faq: faq.length ? faq : null,
    badges: Array.isArray(section.badges) ? section.badges : null
  };
  const tips = normalizeTipsList(section.tips);
  if (tips.length) {
    card.list = Array.isArray(card.list) && card.list.length ? card.list : tips;
  }
  return card;
}

function normalizeStoryColumn(column) {
  const src = column && typeof column === 'object' ? column : {};
  const rawSections = Array.isArray(src.sections) ? src.sections : (Array.isArray(src.content) ? src.content : []);
  const sections = [];
  rawSections.forEach(entry => {
    const normalized = normalizeStorySection(entry);
    if (normalized) sections.push(normalized);
  });
  if (!sections.length && (src.image || src.imageUrl || src.url)) {
    const img = normalizeStoryImageEntry(src.image || { url: src.imageUrl || src.url, alt: src.alt, caption: src.caption });
    if (img.url) sections.push({ type: 'image', image: img });
  }
  return { sections, role: src.role || '', width: src.width || '' };
}

function normalizeLegacyRichSection(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const heading = String(entry.title || '').trim();
  const text = normalizeParagraphString(entry.text || entry.description);
  const tips = normalizeTipsList(entry.tips ?? entry.list);
  const imageSrc = entry.image || entry.media || (entry.imageUrl || entry.mediaUrl ? { url: entry.imageUrl || entry.mediaUrl, alt: entry.imageAlt, caption: entry.imageCaption } : null);
  const image = imageSrc ? normalizeStoryImageEntry(imageSrc) : null;
  const hasContent = heading || text || (tips.length) || (image && image.url);
  if (!hasContent) return null;
  return {
    type: 'card',
    className: 'story-card--rich',
    heading,
    text,
    list: tips.length ? tips : null,
    image,
    mediaPosition: normalizeMediaPosition(entry.layout)
  };
}

function convertLegacyStory(story, base = {}) {
  const heading = base.heading || String(story.title || '').trim();
  const subheading = base.subheading || String(story.subtitle || '').trim();
  const heroRaw = story.hero || { url: story.heroUrl, alt: story.heroAlt, caption: story.heroCaption };
  const hero = normalizeStoryImageEntry(heroRaw);
  const sections = [];
  const pushSection = (section) => { if (section) sections.push(section); };

  const createSimpleCard = ({ heading: cardHeading, subheading: cardSubheading, text, image, mediaPosition }) => {
    const headingText = String(cardHeading || '').trim();
    const subheadingText = String(cardSubheading || '').trim();
    const paragraph = normalizeParagraphString(text);
    const imageEntry = image ? normalizeStoryImageEntry(image) : null;
    const hasImage = imageEntry && imageEntry.url;
    const normalizedMediaPosition = normalizeMediaPosition(mediaPosition);
    if (!headingText && !subheadingText && !paragraph && !hasImage) return null;
    const card = { type: 'card' };
    if (headingText) card.heading = headingText;
    if (subheadingText) card.subheading = subheadingText;
    if (paragraph) card.text = paragraph;
    if (hasImage) card.image = imageEntry;
    if (normalizedMediaPosition) card.mediaPosition = normalizedMediaPosition;
    return card;
  };

  const convertLegacyRichSection = (entry) => {
    const richCard = normalizeLegacyRichSection(entry);
    if (!richCard) return null;
    const parts = [];
    if (richCard.text) parts.push(richCard.text);
    if (Array.isArray(richCard.list) && richCard.list.length) {
      parts.push(richCard.list.map(item => String(item || '').trim()).filter(Boolean).join(' · '));
    }
    return createSimpleCard({
      heading: richCard.heading,
      subheading: richCard.subheading,
      text: parts.join('\n\n'),
      image: richCard.image,
      mediaPosition: richCard.mediaPosition
    });
  };

  const legacyEntries = [];
  if (Array.isArray(story.sections)) legacyEntries.push(...story.sections);
  else if (Array.isArray(story.content)) legacyEntries.push(...story.content);

  legacyEntries.forEach(entry => {
    const section = convertLegacyRichSection(entry);
    if (section) pushSection(section);
  });

  const extras = [];
  const addExtra = (section) => { if (section) extras.push(section); };

  const intro = normalizeParagraphString(story.intro);
  if (intro) addExtra(createSimpleCard({ heading: 'Einführung', text: intro }));

  const ritual = normalizeParagraphString(story.ritual);
  if (ritual) addExtra(createSimpleCard({ heading: 'Ritual', text: ritual }));

  const tips = normalizeTipsList(story.tips);
  if (tips.length) addExtra(createSimpleCard({ heading: 'Tipps', text: tips.join(' · ') }));

  const galleryItems = normalizeStoryGallery(story.gallery);
  if (galleryItems.length) {
    const galleryTitle = String(story.galleryTitle || '').trim() || 'Galerie';
    galleryItems.forEach((item, index) => {
      const caption = String(item.caption || '').trim();
      const headingText = index === 0 ? galleryTitle : (caption || galleryTitle);
      const subheadingText = index === 0 && caption && caption !== headingText ? caption : '';
      addExtra(createSimpleCard({ heading: headingText, subheading: subheadingText, image: item }));
    });
  }

  const faqItems = normalizeStoryFaq(story.faq);
  if (faqItems.length) {
    const faqText = faqItems
      .map(item => {
        const question = String(item.question || '').trim();
        const answer = String(item.answer || '').trim();
        return [question ? `Q: ${question}` : '', answer ? `A: ${answer}` : ''].filter(Boolean).join(' ');
      })
      .filter(Boolean)
      .join('\n\n');
    addExtra(createSimpleCard({ heading: 'FAQ', text: faqText }));
  }

  const saunaTargets = gatherStorySaunaTargets(story.saunas || story.saunaRefs || story.sauna);
  if (saunaTargets.length) {
    addExtra(createSimpleCard({ heading: 'Heute verfügbar', text: saunaTargets.join(', ') }));
  }

  extras.forEach(pushSection);

  if (!sections.length) {
    const fallbackText = normalizeParagraphString(story.text || story.body || story.description);
    const fallbackSection = createSimpleCard({ text: fallbackText });
    if (fallbackSection) pushSection(fallbackSection);
  }

  const columns = [];
  if (sections.length) columns.push({ sections });
  if (hero.url) {
    columns.push({ sections: [{ type: 'image', image: hero, variant: 'hero', className: 'story-image-block--hero' }] });
  }
  const layout = hero.url ? 'double' : 'single';
  return {
    heading,
    subheading,
    layout,
    columns,
    origin: 'legacy',
    legacy: story,
    raw: story,
    __isNormalizedStory: true
  };
}

function normalizeStoryForRender(story = {}) {
  const headingRaw = String(story.heading || story.title || '').trim();
  const subheadingRaw = String(story.subheading || story.subtitle || '').trim();
  if (Array.isArray(story.columns)) {
    const columns = story.columns.map(normalizeStoryColumn).filter(col => col.sections.length);
    const layout = normalizeStoryLayout(story.layout) || (columns.length > 1 ? 'double' : 'single');
    return {
      heading: headingRaw,
      subheading: subheadingRaw,
      layout,
      columns,
      origin: 'structured',
      legacy: null,
      raw: story,
      __isNormalizedStory: true
    };
  }
  return convertLegacyStory(story, { heading: headingRaw, subheading: subheadingRaw });
}

function findPrimaryStoryImage(story) {
  const normalized = story && story.__isNormalizedStory ? story : normalizeStoryForRender(story || {});
  for (const column of normalized.columns || []) {
    for (const section of column.sections || []) {
      if (section.type === 'image' && section.image && section.image.url) return section.image.url;
      if (section.image && section.image.url) return section.image.url;
    }
  }
  const fallback = normalized.raw && (normalized.raw.heroUrl || (normalized.raw.hero && normalized.raw.hero.url));
  return fallback ? String(fallback).trim() : '';
}
function collectStoryImageUrls(story, limit = 3) {
  const normalized = story && story.__isNormalizedStory ? story : normalizeStoryForRender(story || {});
  const urls = [];
  const seen = new Set();
  const push = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };
  (normalized.columns || []).forEach(column => {
    (column.sections || []).forEach(section => {
      if (section && section.image && section.image.url) push(section.image.url);
      if (section && Array.isArray(section.gallery)) {
        section.gallery.forEach(item => push(item && item.url));
      }
    });
  });
  const fallback = normalized.raw && (normalized.raw.heroUrl || (normalized.raw.hero && normalized.raw.hero.url));
  push(fallback);
  if (typeof limit === 'number' && Number.isFinite(limit) && limit > 0) {
    return urls.slice(0, Math.max(1, Math.floor(limit)));
  }
  return urls;
}



function renderStorySlide(story = {}, region = 'left') {
  const normalized = normalizeStoryForRender(story || {});
  const layoutClass = normalized.layout === 'double' ? 'story-layout-double' : 'story-layout-single';
  const container = h('div', { class: `container story-slide fade show ${layoutClass}`.trim() });
  const headingText = String(normalized.heading || '').trim();
  container.appendChild(h('h1', { class: 'story-heading' }, headingText));

  const sectionsWrap = h('div', { class: 'story-sections' });
  const appendSectionNode = (section, context) => {
    const node = buildStorySectionNode(section, context);
    if (node) {
      if (context && context.columnIndex != null) {
        node.dataset.columnIndex = String(context.columnIndex);
      }
      if (context && context.sectionIndex != null) {
        node.dataset.sectionIndex = String(context.sectionIndex);
      }
      sectionsWrap.appendChild(node);
    }
  };

  (normalized.columns || []).forEach((column, columnIndex) => {
    (column.sections || []).forEach((section, sectionIndex) => {
      appendSectionNode(section, {
        columnIndex,
        sectionIndex,
        normalizedStory: normalized,
        rawStory: normalized.raw,
        legacyStory: normalized.legacy
      });
    });
  });

  if (!sectionsWrap.childNodes.length) {
    sectionsWrap.appendChild(
      h('section', { class: 'story-section story-section--empty' }, [
        h('p', { class: 'story-section-empty' }, 'Keine Inhalte verfügbar.')
      ])
    );
  }

  container.appendChild(sectionsWrap);
  return container;

  function buildStorySectionNode(section, ctx) {
    if (!section) return null;
    if (section.type === 'custom' && typeof section.render === 'function') {
      try {
        return section.render({ ...ctx, section });
      } catch (err) {
        console.warn('[slideshow] story custom section failed', err);
        return null;
      }
    }
    if (typeof section.render === 'function' && section.type !== 'card' && section.type !== 'image') {
      try {
        return section.render({ ...ctx, section });
      } catch (err) {
        console.warn('[slideshow] story section render failed', err);
        return null;
      }
    }
    if (section.type === 'image') return buildStoryImageBlock(section, ctx);
    if (section.type === 'availability') return buildStoryAvailabilityCard(section, ctx);
    return buildStoryCard(section, ctx);
  }

  function createStoryMediaFigure(image, options = {}) {
    const {
      className = 'story-section-figure',
      fallbackText = 'Bild nicht verfügbar',
      showPlaceholder = false
    } = options;
    const data = image || {};
    const url = String(data.url || '').trim();
    const alt = String(data.alt || '').trim();
    const caption = String(data.caption || '').trim();
    if (!url && !showPlaceholder) return null;
    const classList = String(className || '').trim() || 'story-section-figure';
    const baseClass = classList.split(/\s+/)[0] || 'story-section-figure';
    const fallbackClass = `${baseClass}-fallback`;
    const figure = h('figure', { class: classList });
    if (data.aspect) figure.dataset.aspect = data.aspect;
    if (url) {
      const img = h('img', { src: url, alt });
      img.addEventListener('error', () => {
        figure.classList.add('is-error');
        figure.replaceChildren(h('div', { class: fallbackClass }, fallbackText));
      });
      figure.appendChild(img);
      if (caption) figure.appendChild(h('figcaption', caption));
    } else {
      figure.classList.add('is-placeholder');
      figure.appendChild(h('div', { class: fallbackClass }, fallbackText));
    }
    return figure;
  }

  function collectParagraphStrings(value) {
    const blocks = [];
    const push = (input) => {
      if (input == null) return;
      if (Array.isArray(input)) { input.forEach(push); return; }
      const text = String(input || '').replace(/\r\n/g, '\n');
      const parts = text.split(/\n\s*\n+/);
      parts.forEach(part => {
        const cleaned = part.replace(/\s+/g, ' ').trim();
        if (cleaned) blocks.push(cleaned);
      });
    };
    push(value);
    return blocks;
  }

  function collectListItems(value) {
    const items = [];
    const push = (entry) => {
      if (entry == null) return;
      if (Array.isArray(entry)) { entry.forEach(push); return; }
      if (typeof entry === 'object') {
        const text = String(entry.text || entry.title || entry.label || entry.caption || '').trim();
        if (text) { push(text); }
        return;
      }
      const raw = String(entry || '').trim();
      if (!raw) return;
      const lines = raw.split(/\r?\n/).map(line => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
      if (lines.length) lines.forEach(line => items.push(line));
      else items.push(raw);
    };
    push(value);
    return items;
  }

  function buildStoryGalleryGrid(items) {
    const list = Array.isArray(items) ? items : [];
    const grid = h('div', { class: 'story-gallery-grid' });
    list.forEach(item => {
      const figure = createStoryMediaFigure(item, { className: 'story-gallery-item', fallbackText: 'Bild nicht verfügbar', showPlaceholder: false });
      if (figure) grid.appendChild(figure);
    });
    return grid.childNodes.length ? grid : null;
  }

  function buildStoryFaqList(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return null;
    const dl = h('dl', { class: 'story-faq-list' });
    list.forEach(item => {
      const question = String(item.question || '').trim() || 'Frage';
      const answer = String(item.answer || '').trim();
      dl.appendChild(h('dt', question));
      dl.appendChild(h('dd', answer));
    });
    return dl;
  }

  function buildStoryCard(section, ctx) {
    const classes = ['story-section', 'story-section--content'];
    if (section.className) {
      section.className.split(/\s+/).filter(Boolean).forEach(cls => {
        if (cls.startsWith('story-card--')) classes.push(`story-section--${cls.slice('story-card--'.length)}`);
        else classes.push(cls);
      });
    }

    const sectionEl = h('section', { class: classes.join(' ') });
    const mediaFigure = section.image
      ? createStoryMediaFigure(section.image, {
          className: 'story-section-figure',
          fallbackText: 'Bild nicht verfügbar',
          showPlaceholder: section.showPlaceholder === true
        })
      : null;

    const headerNodes = [];
    if (section.kicker) headerNodes.push(h('p', { class: 'story-section-kicker' }, section.kicker));
    if (section.heading) headerNodes.push(h('h2', { class: 'story-section-heading' }, section.heading));
    if (section.subheading) headerNodes.push(h('p', { class: 'story-section-subheading' }, section.subheading));

    const bodyChildren = [];
    const appendParagraphs = (value) => {
      collectParagraphStrings(value).forEach(text => bodyChildren.push(h('p', { class: 'story-section-paragraph' }, text)));
    };

    if (Array.isArray(section.bodyNodes)) {
      section.bodyNodes.forEach(node => {
        if (!node) return;
        if (typeof node === 'string') appendParagraphs(node);
        else if (node.nodeType) bodyChildren.push(node);
      });
    }

    appendParagraphs(section.text);
    if (section.paragraphs) appendParagraphs(section.paragraphs);
    if (section.description && !section.text) appendParagraphs(section.description);

    const listItems = collectListItems(section.list || section.tips);
    if (listItems.length) {
      const listTag = ['ol', 'ordered', 'numbered', 'numbers', 'numeric'].includes((section.listStyle || '').toLowerCase()) ? 'ol' : 'ul';
      bodyChildren.push(h(listTag, { class: 'story-section-list' }, listItems.map(item => h('li', item))));
    }

    if (section.gallery) {
      const galleryNode = buildStoryGalleryGrid(section.gallery);
      if (galleryNode) bodyChildren.push(galleryNode);
    }

    if (section.faq) {
      const faqNode = buildStoryFaqList(section.faq);
      if (faqNode) bodyChildren.push(faqNode);
    }

    if (section.badges) {
      const badgeRow = createBadgeRow(section.badges, 'badge-row story-section-badges');
      if (badgeRow) bodyChildren.push(badgeRow);
    }

    if (Array.isArray(section.extraBodyNodes)) {
      section.extraBodyNodes.forEach(node => {
        if (!node) return;
        if (typeof node === 'string') appendParagraphs(node);
        else if (node.nodeType) bodyChildren.push(node);
      });
    }

    const contentChildren = [];
    if (headerNodes.length) contentChildren.push(...headerNodes);
    if (bodyChildren.length) contentChildren.push(...bodyChildren);
    const content = contentChildren.length ? h('div', { class: 'story-section-content' }, contentChildren) : null;

    const mediaPosition = String(section.mediaPosition || '').trim().toLowerCase();
    const mediaWrapper = mediaFigure ? h('div', { class: 'story-section-media' }, [mediaFigure]) : null;

    if (mediaWrapper) {
      sectionEl.classList.add('story-section--has-media');
      if (mediaPosition === 'right') sectionEl.classList.add('story-section--media-right');
      else if (mediaPosition === 'bottom') sectionEl.classList.add('story-section--media-bottom');
      else if (mediaPosition === 'full') sectionEl.classList.add('story-section--media-full');
      else sectionEl.classList.add('story-section--media-left');
    }

    const childNodes = [];
    if (mediaWrapper && (mediaPosition === 'right' || mediaPosition === 'bottom')) {
      if (content) childNodes.push(content);
      childNodes.push(mediaWrapper);
    } else {
      if (mediaWrapper) childNodes.push(mediaWrapper);
      if (content) childNodes.push(content);
    }

    childNodes.forEach(node => sectionEl.appendChild(node));
    if (!sectionEl.childNodes.length) return null;
    return sectionEl;
  }

  function resolveAvailabilityTargets(section, ctx) {
    const sources = [
      section && (section.saunas || section.saunaRefs || section.sauna),
      ctx.rawStory && (ctx.rawStory.saunas || ctx.rawStory.saunaRefs || ctx.rawStory.sauna),
      ctx.legacyStory && ctx.legacyStory !== ctx.rawStory && (ctx.legacyStory.saunas || ctx.legacyStory.saunaRefs || ctx.legacyStory.sauna)
    ];
    const names = [];
    sources.forEach(src => {
      gatherStorySaunaTargets(src).forEach(name => {
        if (!names.includes(name)) names.push(name);
      });
    });
    return names;
  }

  function computeStoryAvailabilityItems(targets) {
    const names = Array.isArray(targets) ? targets : [];
    if (!names.length) return [];
    if (!schedule || !Array.isArray(schedule.rows) || !Array.isArray(schedule.saunas)) return [];
    const indices = [];
    const seen = new Set();
    names.forEach(name => {
      const trimmed = String(name || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (seen.has(lower)) return;
      const idx = schedule.saunas.indexOf(trimmed);
      if (idx >= 0) {
        seen.add(lower);
        indices.push({ name: trimmed, idx });
      }
    });
    if (!indices.length) return [];
    const now = nowMinutes();
    const items = [];
    (schedule.rows || []).forEach(row => {
      const time = row && row.time ? row.time : '';
      const minutes = parseHM(time);
      indices.forEach(({ name, idx }) => {
        const cell = row && Array.isArray(row.entries) ? row.entries[idx] : null;
        if (cell && cell.title) {
          const details = collectCellDetails(cell);
          items.push({
            sauna: name,
            title: cell.title,
            time,
            minutes,
            isUpcoming: minutes != null ? minutes >= now : false,
            description: details.description,
            aromas: details.aromas,
            facts: details.facts,
            badges: details.badges
          });
        }
      });
    });
    items.sort((a, b) => {
      const am = a.minutes != null ? a.minutes : Infinity;
      const bm = b.minutes != null ? b.minutes : Infinity;
      if (am === bm) return a.sauna.localeCompare(b.sauna, 'de');
      return am - bm;
    });
    const nextIdx = items.findIndex(item => item.minutes != null && item.minutes >= now);
    if (nextIdx >= 0) items[nextIdx].isNext = true;
    return items;
  }

  function buildStoryAvailabilityCard(section, ctx) {
    const targets = resolveAvailabilityTargets(section, ctx);
    const entries = computeStoryAvailabilityItems(targets);
    const nodes = [];
    if (section.description) {
      nodes.push(h('p', { class: 'story-availability-description' }, section.description));
    }
    if (!entries.length) {
      const message = section.emptyMessage || (targets.length ? 'Heute keine passenden Aufgüsse eingetragen.' : 'Keine Zuordnung zum Tagesplan hinterlegt.');
      nodes.push(h('p', { class: 'story-availability-empty' }, message));
    } else {
      const list = h('ul', { class: 'story-availability-list' });
      entries.forEach(entry => {
        const cls = ['story-availability-item'];
        if (entry.isUpcoming) cls.push('is-upcoming');
        if (entry.isNext) cls.push('is-next');
        const li = h('li', { class: cls.join(' ') });
        const head = h('div', { class: 'story-availability-head' }, [
          h('span', { class: 'story-availability-time' }, entry.time || '–'),
          h('div', { class: 'story-availability-headline' }, [
            h('span', { class: 'story-availability-sauna' }, entry.sauna),
            entry.title ? h('span', { class: 'story-availability-title' }, entry.title) : null
          ].filter(Boolean))
        ]);
        li.appendChild(head);
        const detailNodes = [
          createDescriptionNode(entry.description, 'story-availability-description'),
          createAromaListNode(entry.aromas, 'aroma-list story-availability-aromas'),
          createFactsList(entry.facts, 'story-availability-facts', 'card-chip story-section-chip'),
          createBadgeRow(entry.badges, 'badge-row story-availability-badges')
        ].filter(Boolean);
        if (detailNodes.length) {
          li.appendChild(h('div', { class: 'story-availability-details' }, detailNodes));
        }
        list.appendChild(li);
      });
      nodes.push(list);
    }
    return buildStoryCard({
      type: 'card',
      className: 'story-card--availability',
      heading: section.title || 'Heute verfügbar',
      bodyNodes: nodes
    }, ctx);
  }

  function buildStoryImageBlock(section, ctx) {
    const figure = createStoryMediaFigure(section.image, {
      className: 'story-section-figure',
      fallbackText: 'Bild nicht verfügbar',
      showPlaceholder: section.showPlaceholder !== false
    });
    if (!figure) return null;
    const classes = ['story-section', 'story-section--image'];
    if (section.className) {
      section.className.split(/\s+/).filter(Boolean).forEach(cls => {
        if (cls.startsWith('story-image-block--')) classes.push(`story-section--${cls.slice('story-image-block--'.length)}`);
        else classes.push(cls);
      });
    }
    if (section.variant) classes.push(`story-section--${section.variant}`);
    const block = h('section', { class: classes.join(' ') });
    block.classList.add('story-section--has-media', 'story-section--media-full');

    const mediaWrapper = h('div', { class: 'story-section-media' }, [figure]);
    block.appendChild(mediaWrapper);

    const contentNodes = [];
    const heading = String(section.heading || '').trim();
    const subheading = String(section.subheading || '').trim();
    const description = String(section.description || '').trim();
    if (heading) contentNodes.push(h('h2', { class: 'story-section-heading' }, heading));
    if (subheading) contentNodes.push(h('p', { class: 'story-section-subheading' }, subheading));
    if (description) contentNodes.push(h('p', { class: 'story-section-paragraph' }, description));
    if (contentNodes.length) {
      block.appendChild(h('div', { class: 'story-section-content' }, contentNodes));
    }
    return block;
  }
}


  // ---------- Sauna tile sizing by unobscured width ----------
  function computeAvailContentWidth(container) {
    const cw = container.clientWidth;
    const rightPct = (settings?.display?.rightWidthPercent ?? 38) / 100;
    const cutTop = (settings?.display?.cutTopPercent ?? 28) / 100;
    const cutBottom = (settings?.display?.cutBottomPercent ?? 12) / 100;
    const panelW = cw * rightPct;
    const minCut = Math.min(cutTop, cutBottom);
    const intrude = panelW * (1 - minCut);
    const padding = 32;
    return Math.max(0, cw - intrude - padding);
  }
  function applyTileSizing(container, opts = {}) {
    const useIcons = opts.useIcons !== false;
    const avail = computeAvailContentWidth(container);
    const defaultPct = useIcons ? 45 : 42;
    const pct = ((settings?.slides?.tileWidthPercent ?? defaultPct) / 100);
    const target = Math.max(0, avail * pct);
    const minScale = Math.max(0, settings?.slides?.tileMinScale ?? 0.25);
    const maxScale = Math.max(minScale, settings?.slides?.tileMaxScale ?? 0.57);
    container.style.setProperty('--tileTargetPx', target + 'px');
    container.style.setProperty('--tileMinScale', String(minScale));
    container.style.setProperty('--tileMaxScale', String(maxScale));

    const baseW = settings?.display?.baseW || 1920;
    const fallbackTarget = baseW * ((minScale + maxScale) / 2);
    const t = target > 0 ? target : fallbackTarget;
    const clamp = (min, val, max) => Math.min(Math.max(val, min), max);

    const iconSize = clamp(56, t * 0.16, 200);
    const basePadY = useIcons ? clamp(12, t * 0.04, 40) : clamp(9, t * 0.032, 28);
    const basePadX = useIcons
      ? Math.max(clamp(18, t * 0.062, 64), basePadY + 6)
      : Math.max(clamp(16, t * 0.055, 44), basePadY + 4);
    const padScale = Number.isFinite(+settings?.slides?.tilePaddingScale)
      ? clamp(0.4, +settings.slides.tilePaddingScale, 1.6)
      : 0.85;
    const padY = clamp(6, basePadY * padScale, basePadY * 1.6);
    const padX = Math.max(
      clamp(10, basePadX * padScale, basePadX * 1.6),
      padY + (useIcons ? 6 : 4)
    );
    const gap = useIcons ? clamp(16, t * 0.05, 38) : clamp(12, t * 0.04, 30);
    const contentGap = useIcons ? clamp(8, t * 0.03, 26) : clamp(6, t * 0.022, 18);
    const chipGap = useIcons ? clamp(6, t * 0.022, 22) : clamp(4, t * 0.018, 16);
    const badgeOffset = useIcons ? clamp(10, t * 0.02, 28) : clamp(8, t * 0.018, 22);
    const radius = useIcons ? clamp(18, t * 0.06, 48) : clamp(16, t * 0.05, 44);
    const metaScale = useIcons ? clamp(0.72, t / 720, 1.12) : clamp(0.78, t / 820, 1.08);
    const userMetaScale = Number.isFinite(+settings?.fonts?.tileMetaScale)
      ? clamp(0.5, +settings.fonts.tileMetaScale, 2)
      : 1;
    const userBadgeScale = Number.isFinite(+settings?.slides?.badgeScale)
      ? clamp(0.3, +settings.slides.badgeScale, 3)
      : 1;
    const userBadgeDescriptionScale = Number.isFinite(+settings?.slides?.badgeDescriptionScale)
      ? clamp(0.3, +settings.slides.badgeDescriptionScale, 3)
      : 1;
    const heightScale = Number.isFinite(+settings?.slides?.tileHeightScale)
      ? clamp(0.5, +settings.slides.tileHeightScale, 2)
      : 1;
    const flameSize = useIcons ? clamp(22, t * 0.03, 42) : clamp(18, t * 0.026, 32);
    const iconColumn = useIcons ? clamp(44, iconSize * 0.78, iconSize * 1.52) : 0;
    const tileMinHeight = useIcons
      ? clamp(78, iconSize * 0.9, iconSize * 1.12)
      : clamp(66, padY * 3.1, 120);
    const iconHeightScale = useIcons
      ? clamp(0.72, tileMinHeight / Math.max(iconSize, 1), 1.05)
      : 0;

    container.style.setProperty('--tileIconSizePx', useIcons ? (iconSize.toFixed(2) + 'px') : '0px');
    container.style.setProperty('--tilePadYPx', padY.toFixed(2) + 'px');
    container.style.setProperty('--tilePadXPx', padX.toFixed(2) + 'px');
    container.style.setProperty('--tileGapPx', gap.toFixed(2) + 'px');
    container.style.setProperty('--tileContentGapPx', contentGap.toFixed(2) + 'px');
    container.style.setProperty('--tileChipGapPx', chipGap.toFixed(2) + 'px');
    container.style.setProperty('--tileBadgeOffsetPx', badgeOffset.toFixed(2) + 'px');
    container.style.setProperty('--tileRadiusPx', radius.toFixed(2) + 'px');
    const combinedMeta = metaScale * userMetaScale;
    container.style.setProperty('--tileMetaScale', combinedMeta.toFixed(3));
    container.style.setProperty('--tileBadgeScale', (combinedMeta * userBadgeScale).toFixed(3));
    container.style.setProperty('--tileDescriptionScale', (combinedMeta * userBadgeDescriptionScale).toFixed(3));
    container.style.setProperty('--flameSizePx', flameSize.toFixed(2));
    container.style.setProperty('--tileIconColumnPx', useIcons ? (iconColumn.toFixed(2) + 'px') : '0px');
    container.style.setProperty('--tileHeightScale', heightScale.toFixed(3));
    container.style.setProperty('--tileMinHeightPx', (tileMinHeight * heightScale).toFixed(2) + 'px');
    container.style.setProperty('--tileIconHeightScale', iconHeightScale.toFixed(3));
  }

  function createTilePager(list) {
    let timer = 0;
    let frame = 0;
    let pages = [];
    let index = 0;
    let opts = null;

    const clearTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = 0;
      }
    };

    const showAll = () => {
      const tiles = Array.from(list.querySelectorAll('.tile'));
      tiles.forEach(tile => {
        tile.hidden = false;
        tile.classList.remove('tile-pager-exit', 'tile-pager-enter');
        tile.style.removeProperty('animation');
      });
      list.classList.remove('is-paged');
      delete list.dataset.tilePages;
      delete list.dataset.tilePage;
    };

    const showPage = (nextIndex) => {
      const prevTiles = pages[index] || [];
      const nextTiles = pages[nextIndex] || [];
      if (nextIndex === index && nextTiles.every(tile => !tile.hidden)) return;
      prevTiles.forEach(tile => {
        tile.classList.remove('tile-pager-enter');
        tile.classList.add('tile-pager-exit');
        setTimeout(() => {
          tile.hidden = true;
          tile.classList.remove('tile-pager-exit');
        }, 220);
      });
      nextTiles.forEach(tile => {
        tile.hidden = false;
        tile.classList.remove('tile-pager-exit');
        tile.classList.add('tile-pager-enter');
        tile.style.animation = 'none';
        void tile.offsetWidth;
        tile.style.removeProperty('animation');
        tile.addEventListener('animationend', () => tile.classList.remove('tile-pager-enter'), { once: true });
      });
      index = nextIndex;
      list.dataset.tilePage = String(nextIndex + 1);
      list.dataset.tilePages = String(pages.length);
    };

    const recompute = () => {
      const current = opts;
      if (!current || !current.body || !current.container) {
        clearTimer();
        pages = [];
        index = 0;
        showAll();
        return;
      }
      const body = current.body;
      const tiles = Array.from(list.querySelectorAll('.tile'));
      if (!tiles.length) {
        clearTimer();
        pages = [];
        index = 0;
        showAll();
        return;
      }
      const available = body.clientHeight;
      if (available <= 0) {
        clearTimer();
        pages = [];
        index = 0;
        showAll();
        return;
      }

      tiles.forEach(tile => {
        tile.hidden = false;
        tile.classList.remove('tile-pager-exit', 'tile-pager-enter');
        tile.style.removeProperty('animation');
      });

      const style = getComputedStyle(list);
      const gap = parseFloat(style.rowGap || style.gap || '0') || 0;

      const pagesNew = [];
      let currentPage = [];
      let currentHeight = 0;
      tiles.forEach(tile => {
        const rect = tile.getBoundingClientRect();
        const height = rect.height;
        const extra = currentPage.length ? gap : 0;
        if (currentPage.length && (currentHeight + extra + height) > available + 1) {
          pagesNew.push(currentPage);
          currentPage = [tile];
          currentHeight = height;
        } else {
          currentPage.push(tile);
          currentHeight += extra + height;
        }
      });
      if (currentPage.length) pagesNew.push(currentPage);

      if (pagesNew.length <= 1) {
        clearTimer();
        pages = pagesNew;
        index = 0;
        showAll();
        return;
      }

      pages = pagesNew;
      list.classList.add('is-paged');
      if (index >= pages.length) index = 0;

      const pageConfig = typeof getPageConfig === 'function' ? getPageConfig(current.region || 'left') : null;
      const dwellMs = Math.max(4000, dwellMsForItem({ type: 'sauna', sauna: current.saunaName || '' }, pageConfig));
      const duration = Math.min(Math.max(Math.floor(dwellMs / pages.length), 2200), 12000);

      showPage(index);

      clearTimer();
      timer = setInterval(() => {
        showPage((index + 1) % pages.length);
      }, duration);
    };

    const scheduleUpdate = (nextOpts = {}) => {
      opts = { ...opts, ...nextOpts };
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        recompute();
      });
    };

    const destroy = () => {
      clearTimer();
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      pages = [];
      index = 0;
      opts = null;
      showAll();
      delete list.__tilePager;
    };

    return { scheduleUpdate, destroy };
  }

  function ensureTilePager(list) {
    if (!list) return null;
    if (list.__tilePager) return list.__tilePager;
    const pager = createTilePager(list);
    list.__tilePager = pager;
    return pager;
  }

  // ---------- Sauna slide ----------
  function renderSauna(name, region = 'left') {
    const hlMap = getHighlightMap();
    const rightUrl = settings?.assets?.rightImages?.[name] || '';
    const iconsEnabled = settings?.slides?.showIcons !== false;
    const cardIconMap = (iconsEnabled && settings?.slides?.cardIcons && typeof settings.slides.cardIcons === 'object')
      ? settings.slides.cardIcons
      : null;
    const migrationDone = settings?.slides?.cardIconsMigrated === true;
    const defaultIconForSauna = (cardIconMap && typeof cardIconMap[name] === 'string') ? cardIconMap[name] : '';
    const legacyIconFallback = (!migrationDone && iconsEnabled && rightUrl) ? rightUrl : '';
    const headingWrap = h('div', { class: 'headings' }, [
      h('h1', { class: 'h1', style: 'color:var(--saunaColor);' }, name),
      h('h2', { class: 'h2' }, computeH2Text() || '')
    ]);
    const c = h('div', { class: 'container has-right fade show' }, [
      h('div', { class: 'rightPanel', style: rightUrl ? ('background-image:url(' + JSON.stringify(rightUrl) + ')') : 'display:none;' }),
      headingWrap
    ]);
    if (iconsEnabled) c.classList.add('has-card-icons'); else c.classList.add('no-card-icons');

    const body = h('div', { class: 'body' });
    const list = h('div', { class: 'list' });

    const notes = footnoteMap();
    const colIdx = (schedule.saunas || []).indexOf(name);
    const hiddenSaunas = new Set(settings?.slides?.hiddenSaunas || []);
    const componentFlags = getSlideComponentFlags();
    const iconVariantMap = (settings?.slides?.iconVariants && typeof settings.slides.iconVariants === 'object')
      ? settings.slides.iconVariants
      : null;
    const iconVariantDefault = (() => {
      const norm = normalizeIconVariant(settings?.slides?.iconVariant);
      return norm || 'default';
    })();

    function normalizeIconVariant(value) {
      if (typeof value !== 'string') return '';
      const norm = value.trim().toLowerCase();
      if (!norm) return '';
      if (norm === 'round' || norm === 'circle') return 'badge';
      if (norm === 'corner') return 'overlay';
      if (norm === 'stripe' || norm === 'banner') return 'strip';
      if (['default', 'badge', 'strip', 'overlay'].includes(norm)) return norm;
      return '';
    }

    function resolveIconVariant(preferred) {
      if (!iconsEnabled) return 'hidden';
      const fromItem = normalizeIconVariant(preferred);
      if (fromItem) return fromItem;
      if (iconVariantMap) {
        const bySauna = normalizeIconVariant(iconVariantMap[name]);
        if (bySauna) return bySauna;
        const wildcard = normalizeIconVariant(iconVariantMap['*'] || iconVariantMap.default);
        if (wildcard) return wildcard;
      }
      return iconVariantDefault;
    }

    const items = [];
    for (const row of (schedule.rows || [])) {
      const cell = (row.entries || [])[colIdx];
      if (cell && cell.title) {
        const details = collectCellDetails(cell);
        const isHidden = cell.hidden === true || cell.visible === false || cell.enabled === false;
        items.push({
          time: row.time,
          title: cell.title,
          flames: cell.flames || '',
          noteId: cell.noteId,
          description: details.description,
          aromas: details.aromas,
          facts: details.facts,
          badges: details.badges,
          hidden: isHidden,
          icon: cell.icon || null,
          iconVariant: cell.iconVariant || cell.iconLayout || null
        });
      }
    }
    items.sort((a, b) => a.time.localeCompare(b.time));

    const usedSet = new Set();
    for (const it of items) {
      const baseTitle = String(it.title).replace(/\*+$/, '');
      const hasStar = /\*$/.test(it.title || '');
      const tileClasses = ['tile'];
      if (hlMap.bySauna[name] && hlMap.bySauna[name].has(it.time)) tileClasses.push('highlight');
      if (it.hidden || hiddenSaunas.has(name)) tileClasses.push('is-hidden');
      let iconVariant = 'default';
      if (iconsEnabled) {
        iconVariant = resolveIconVariant(it.iconVariant);
        if (iconVariant === 'badge') tileClasses.push('tile--icon-badge');
        if (iconVariant === 'strip') tileClasses.push('tile--icon-strip');
        if (iconVariant === 'overlay') tileClasses.push('tile--icon-overlay');
      }

      const titleNode = h('div', { class: 'title' });
      if (it.time) {
        titleNode.appendChild(h('span', { class: 'time' }, it.time + ' Uhr'));
        titleNode.appendChild(h('span', { class: 'sep', 'aria-hidden': 'true' }, '–'));
      }
      const labelNode = h('span', { class: 'label' }, baseTitle);
      const supNote = noteSup(it, notes);
      if (supNote) {
        labelNode.appendChild(h('span', { class: 'notewrap' }, [supNote]));
        usedSet.add(it.noteId);
      } else if (hasStar) {
        labelNode.appendChild(h('span', { class: 'notewrap' }, [h('sup', { class: 'note legacy' }, '*')]));
      }
      titleNode.appendChild(labelNode);

      const badgeRowNode = createBadgeRow(it.badges, 'badge-row');
      const mainColumn = h('div', { class: 'card-main' });
      const contentBlock = h('div', { class: 'card-content' }, [mainColumn]);
      let metaColumn = null;
      const ensureMetaColumn = () => {
        if (metaColumn) return metaColumn;
        metaColumn = h('div', { class: 'card-meta' });
        contentBlock.insertBefore(metaColumn, mainColumn);
        contentBlock.classList.add('card-content--with-meta');
        return metaColumn;
      };

      const componentDefs = [
        { key: 'title', node: titleNode, target: 'main' },
        { key: 'description', render: () => createDescriptionNode(it.description, 'description'), target: 'main' },
        { key: 'aromas', render: () => createAromaListNode(it.aromas, 'aroma-list'), target: 'main' },
        { key: 'facts', render: () => createFactsList(it.facts, 'facts', 'card-chip'), target: 'main' },
        { key: 'badges', render: () => badgeRowNode, target: 'main' }
      ];
      renderComponentNodes(
        componentFlags,
        componentDefs,
        (anyEnabled) => h('div', { class: 'card-empty' }, anyEnabled ? 'Keine Details hinterlegt.' : 'Alle Komponenten deaktiviert.'),
        (node, def) => {
          if (def && def.target === 'meta') {
            ensureMetaColumn().appendChild(node);
          } else {
            mainColumn.appendChild(node);
          }
        }
      );

      const tileChildren = [];
      tileChildren.push(contentBlock);
      tileChildren.push(flamesWrap(it.flames));

      const tile = h('div', { class: tileClasses.join(' '), 'data-time': it.time }, tileChildren);
      tile.style.setProperty('--tile-index', String(list.children.length));

      if (it.hidden || hiddenSaunas.has(name)) {
        tile.appendChild(h('div', { class: 'card-chip card-chip--status', 'data-role': 'hidden' }, 'Ausgeblendet'));
      }

      list.appendChild(tile);
    }
    if (items.length === 0) list.appendChild(h('div', { class: 'caption' }, 'Keine Einträge.'));

    body.appendChild(list);
    c.appendChild(body);

    const footNodes = [];
    const order = (settings?.footnotes || []).map(fn => fn.id);
    for (const id of order) {
      if (usedSet.has(id)) {
        const v = notes.get(id);
        if (v) footNodes.push(h('div', { class: 'fnitem' }, [h('sup', { class: 'note' }, String(v.label || '*')), ' ', v.text]));
      }
    }
    const layout = (settings?.footnoteLayout ?? 'one-line');
    const fnClass = 'footer-note ' + (layout === 'multi' ? 'fn-multi' : layout === 'stacked' ? 'fn-stack' : 'fn-one');
    if (footNodes.length) {
      const nodes = [];
      footNodes.forEach((n, i) => {
        if (i > 0 && layout !== 'stacked') nodes.push(h('span', { class: 'fnsep', 'aria-hidden': 'true' }, '•'));
        nodes.push(n);
      });
      c.appendChild(h('div', { class: fnClass }, nodes));
    }

    c.appendChild(h('div', { class: 'brand' }, 'Signage'));

    const pager = ensureTilePager(list);
    c.__cleanup = () => {
      if (pager && typeof pager.destroy === 'function') pager.destroy();
    };

    const recalc = () => {
      applyTileSizing(c, { useIcons: iconsEnabled });
      if (pager) pager.scheduleUpdate({ container: c, body, region, saunaName: name });
    };
    setTimeout(recalc, 0);
    setResizeHandler(region, recalc);

    return c;
  }

  // ---------- Stage management ----------
  const EMPTY_STAGE_MESSAGES = {
    left: 'Keine Inhalte verfügbar.',
    right: 'Keine Inhalte für rechte Seite definiert.'
  };

  const VALID_CONTENT_TYPES = ['overview','sauna','hero-timeline','image','video','url','story'];
  const PAGE_DEFAULTS = {
    left: { source:'master', timerSec:null, contentTypes:['overview','sauna','hero-timeline','story','image','video','url'], playlist:[] },
    right:{ source:'media',  timerSec:null, contentTypes:['image','video','url'], playlist:[] }
  };
  const SOURCE_FILTERS = {
    master: null,
    schedule: ['overview','sauna','hero-timeline'],
    media: ['image','video','url'],
    story: ['story']
  };

  function updateLayoutModeAttr(mode){
    const normalized = (mode === 'split') ? 'split' : 'single';
    if (document.body) document.body.setAttribute('data-layout', normalized);
    if (STAGE) STAGE.dataset.layout = normalized;
  }

  function slideKey(item){
    if (!item) return '';
    return item.type + '|' + (item.sauna || item.src || item.url || item.storyId || item.story?.id || '');
  }

  function dwellMsForItem(item, pageConfig) {
    const override = Number(pageConfig?.timerSec);
    if (Number.isFinite(override) && override > 0) {
      return Math.max(1, Math.round(override)) * 1000;
    }

    const slides = settings?.slides || {};
    const mode = slides.durationMode || 'uniform';
    const sec = (x) => Math.max(1, Math.floor(+x || 0));

    if (item.type === 'overview') {
      return sec(slides.overviewDurationSec ?? 10) * 1000;
    }

    if (item.type === 'sauna') {
      if (mode !== 'per') {
        const g = slides.globalDwellSec ?? slides.saunaDurationSec ?? 6;
        return sec(g) * 1000;
      } else {
        const perMap = slides.saunaDurations || {};
        const v = perMap[item.sauna];
        const fb = slides.globalDwellSec ?? slides.saunaDurationSec ?? 6;
        return sec(Number.isFinite(+v) ? v : fb) * 1000;
      }
    }

    if (['image', 'video', 'url'].includes(item.type)) {
      if (mode !== 'per') {
        const g = slides.globalDwellSec ?? slides.imageDurationSec ?? slides.saunaDurationSec ?? 6;
        return sec(g) * 1000;
      } else {
        const v = Number.isFinite(+item.dwell) ? +item.dwell : (slides.imageDurationSec ?? slides.globalDwellSec ?? 6);
        return sec(v) * 1000;
      }
    }

    if (item.type === 'story') {
      const story = item.story || {};
      if (mode !== 'per') {
        const g = slides.storyDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 8;
        return sec(g) * 1000;
      }
      const v = Number.isFinite(+story.dwellSec)
        ? +story.dwellSec
        : (slides.storyDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 8);
      return sec(v) * 1000;
    }

    if (item.type === 'hero-timeline') {
      const fallback = slides.heroDurationSec ?? slides.globalDwellSec ?? slides.saunaDurationSec ?? 10;
      return sec(fallback) * 1000;
    }

    return 6000;
  }

  function renderStageFallback(id){
    return h('div', { class: 'container fade show empty' }, [
      h('div', { class: 'empty-message' }, EMPTY_STAGE_MESSAGES[id] || 'Keine Inhalte verfügbar.')
    ]);
  }

  function cleanupNode(node) {
    if (!node) return;
    if (typeof node.__cleanup === 'function') {
      try {
        node.__cleanup();
      } catch (err) {
        console.error('Cleanup error:', err);
      }
    }
    const children = node.childNodes ? Array.from(node.childNodes) : [];
    for (const child of children) cleanupNode(child);
  }

  function cleanupChildNodes(target) {
    if (!target || !target.childNodes) return;
    Array.from(target.childNodes).forEach(cleanupNode);
  }

  function createStageController(id, element){
    let queue = [];
    let index = 0;
    let last = null;
    let slideTimer = 0;
    let transTimer = 0;
    let config = { enabled: id === 'left', timerSec: null, source:'master', contentTypes: [] };
    let hasCustomContent = false;

    const controller = {
      id,
      element,
      apply,
      play,
      stop: clear,
      advance,
      showCustom,
      isEnabled: () => !!config.enabled,
      getQueue: () => queue,
      getIndex: () => index,
      getConfig: () => ({ ...config }),
      scheduleAdvance
    };

    stageControllers.push(controller);
    updateActiveState();
    return controller;

    function updateActiveState(){
      if (!element) return;
      const active = config.enabled || hasCustomContent;
      element.classList.toggle('stage-area--inactive', !active);
      element.classList.toggle('stage-area--empty', active && !hasCustomContent && queue.length === 0);
      element.classList.toggle('stage-area--custom', hasCustomContent);
    }

    function clearTimers(){
      if (slideTimer) { clearTimeout(slideTimer); slideTimer = 0; }
      if (transTimer) { clearTimeout(transTimer); transTimer = 0; }
    }

    function show(node){
      if (!element) return;
      cleanupChildNodes(element);
      element.innerHTML = '';
      if (!node) return;
      element.appendChild(node);
      requestAnimationFrame(() => node.classList.add('show'));
    }

    function hide(cb){
      if (!element) { if (typeof cb === 'function') cb(); return; }
      const cur = element.firstChild;
      if (cur) cur.classList.remove('show');
      setResizeHandler(id, null);
      const raw = settings?.slides?.transitionMs;
      const ms = Number.isFinite(+raw) ? Math.max(0, +raw) : 500;
      if (ms > 0) {
        transTimer = setTimeout(() => {
          transTimer = 0;
          if (typeof cb === 'function') cb();
        }, ms);
      } else if (typeof cb === 'function') {
        cb();
      }
    }

    function scheduleAdvance(ms){
      clearTimeout(slideTimer);
      const wait = Math.max(250, Math.floor(ms || 0));
      slideTimer = setTimeout(() => {
        slideTimer = 0;
        advance();
      }, wait);
    }

    function apply(newQueue, newConfig = {}, { resetIndex = true } = {}){
      hasCustomContent = false;
      if (element) element.classList.remove('stage-area--custom');
      queue = Array.isArray(newQueue) ? newQueue.slice() : [];
      config = { ...config, ...newConfig };
      if (resetIndex || index >= queue.length) {
        index = 0;
        last = null;
      }
      updateActiveState();
    }

    function step(){
      clearTimers();
      if (!config.enabled) {
        clear();
        return;
      }
      if (!queue.length) {
        show(renderStageFallback(id));
        updateActiveState();
        return;
      }
      if (index < 0 || index >= queue.length) {
        index = ((index % queue.length) + queue.length) % queue.length;
      }
      let item = queue[index];
      let key = slideKey(item);
      if (key === last && queue.length > 1) {
        index = (index + 1) % queue.length;
        item = queue[index];
        key = slideKey(item);
      }
      const ctx = {
        region: id,
        advance,
        scheduleAdvance,
        clearScheduledAdvance: () => { if (slideTimer) { clearTimeout(slideTimer); slideTimer = 0; } },
        pageConfig: config
      };
      const node = renderSlideNode(item, ctx);
      show(node);
      last = key;
      updateActiveState();
      if (!(settings?.slides?.waitForVideo && item.type === 'video')) {
        const dwell = dwellMsForItem(item, config);
        scheduleAdvance(dwell);
      }
      preloadUpcomingForStage(controller, { offset: 1 });
    }

    function advance(){
      clearTimers();
      if (!config.enabled) {
        clear();
        return;
      }
      if (!queue.length) {
        show(renderStageFallback(id));
        updateActiveState();
        return;
      }
      hide(() => {
        index = (index + 1) % queue.length;
        step();
      });
    }

    function play(){
      clearTimers();
      if (!config.enabled) {
        clear();
        return;
      }
      if (!queue.length) {
        show(renderStageFallback(id));
        updateActiveState();
        return;
      }
      step();
    }

    function clear(){
      clearTimers();
      hasCustomContent = false;
      if (element) {
        element.classList.remove('stage-area--custom');
        cleanupChildNodes(element);
        element.innerHTML = '';
      }
      setResizeHandler(id, null);
      updateActiveState();
    }

    function showCustom(node){
      clearTimers();
      hasCustomContent = !!node;
      config.enabled = false;
      queue = [];
      index = 0;
      last = null;
      setResizeHandler(id, null);
      if (element) {
        element.classList.toggle('stage-area--custom', hasCustomContent);
        cleanupChildNodes(element);
        element.innerHTML = '';
        if (node) {
          element.appendChild(node);
          requestAnimationFrame(() => node.classList.add('show'));
        }
      }
      updateActiveState();
    }
  }

  function renderSlideNode(item, ctx){
    const region = ctx?.region || 'left';
    if (!item) return renderStageFallback(region);
    switch (item.type) {
      case 'overview':
        return renderOverview(region);
      case 'sauna':
        return renderSauna(item.sauna, region);
      case 'image':
        return renderImage(item.src, region, ctx);
      case 'video':
        return renderVideo(item.src, item, region, ctx);
      case 'url':
        return renderUrl(item.url, region, ctx);
      case 'story':
        return renderStorySlide(item.story, region);
      case 'hero-timeline':
        return renderHeroTimeline(region);
      default:
        return renderImage(item.src || item.url || '', region, ctx);
    }
  }

  function baseQueueForSource(masterQueue, source){
    const filter = SOURCE_FILTERS[source] || null;
    if (!filter) return masterQueue.slice();
    const allowed = new Set(filter);
    return masterQueue.filter(item => allowed.has(item.type));
  }

  function playlistEntryKeyFromConfig(entry){
    if (!entry || typeof entry !== 'object') return null;
    let type = String(entry.type || '').trim();
    if (!type) return null;
    if (type === 'image' || type === 'video' || type === 'url') type = 'media';
    switch (type) {
      case 'overview':
      case 'hero-timeline':
        return type;
      case 'sauna': {
        const name = typeof entry.name === 'string' ? entry.name : (typeof entry.sauna === 'string' ? entry.sauna : '');
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

  function sanitizePlaylistConfig(list){
    if (!Array.isArray(list)) return [];
    const normalized = [];
    const seen = new Set();
    for (const entry of list){
      const key = playlistEntryKeyFromConfig(entry);
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

  function playlistKeyForQueueItem(item){
    if (!item) return null;
    if (item.type === 'overview') return 'overview';
    if (item.type === 'hero-timeline') return 'hero-timeline';
    if (item.type === 'sauna') {
      const name = item.sauna || item.name;
      return name ? 'sauna:' + name : null;
    }
    if (item.type === 'story') {
      const id = item.storyId ?? item.story?.id;
      return id != null ? 'story:' + String(id) : null;
    }
    if (item.type === 'image' || item.type === 'video' || item.type === 'url') {
      const id = item.__id ?? item.id ?? null;
      return id != null ? 'media:' + String(id) : null;
    }
    return null;
  }

  function filterQueueForPage(masterQueue, pageConfig){
    const base = baseQueueForSource(masterQueue, pageConfig?.source || 'master');
    const playlist = Array.isArray(pageConfig?.playlist) ? sanitizePlaylistConfig(pageConfig.playlist) : [];
    if (playlist.length){
      const buckets = new Map();
      base.forEach(item => {
        const key = playlistKeyForQueueItem(item);
        if (!key) return;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(item);
      });
      const ordered = [];
      playlist.forEach(entry => {
        const key = playlistEntryKeyFromConfig(entry);
        if (!key) return;
        const bucket = buckets.get(key);
        if (bucket && bucket.length) {
          ordered.push(bucket.shift());
        }
      });
      if (ordered.length) return ordered;
    }
    const types = Array.isArray(pageConfig?.contentTypes) && pageConfig.contentTypes.length
      ? new Set(pageConfig.contentTypes)
      : null;
    if (!types) return base;
    return base.filter(item => types.has(item.type));
  }

  function getPageConfig(id){
    const display = settings?.display || {};
    const pages = display.pages || {};
    const raw = (typeof pages[id] === 'object' && pages[id]) ? pages[id] : {};
    const defaults = PAGE_DEFAULTS[id] || PAGE_DEFAULTS.left;
    const layoutMode = (display.layoutMode === 'split') ? 'split' : 'single';
    const enabled = id === 'left' ? true : (layoutMode === 'split');
    const source = SOURCE_FILTERS[raw.source] ? raw.source : (SOURCE_FILTERS[defaults.source] ? defaults.source : 'master');
    const timerNum = Number(raw.timerSec);
    const timerSec = Number.isFinite(timerNum) && timerNum > 0 ? Math.max(1, Math.round(timerNum)) : null;
    const rawTypes = Array.isArray(raw.contentTypes) ? raw.contentTypes : defaults.contentTypes;
    const filtered = rawTypes.filter(type => VALID_CONTENT_TYPES.includes(type));
    const contentTypes = filtered.length ? Array.from(new Set(filtered)) : defaults.contentTypes;
    const rawPlaylist = Array.isArray(raw.playlist) ? raw.playlist : defaults.playlist;
    const playlist = sanitizePlaylistConfig(rawPlaylist);
    return { id, enabled, source, timerSec, contentTypes, playlist };
  }

  async function preloadUpcomingForStage(controller, { offset = 0 } = {}){
    if (!controller || !controller.isEnabled()) return;
    const queue = controller.getQueue();
    if (!Array.isArray(queue) || !queue.length) return;
    let start = controller.getIndex() + offset;
    const len = queue.length;
    if (len <= 0) return;
    if (start < 0) start = ((start % len) + len) % len;
    const urls = [];
    for (let i = 0; i < PRELOAD_AHEAD && i < len; i++) {
      const item = queue[(start + i) % len];
      if (!item) continue;
      let url = null;
      if (item.type === 'image') {
        url = item.src;
      } else if (item.type === 'story') {
        const storyUrls = collectStoryImageUrls(item.story, 4);
        storyUrls.forEach(u => { if (u) urls.push(u); });
      }
      if (url) urls.push(url);
    }
    if (!urls.length) return;
    await Promise.all(urls.map(preloadImage));
  }

  const stageLeftController = createStageController('left', STAGE_LEFT || STAGE);
  const stageRightController = createStageController('right', STAGE_RIGHT);

  function stopAllStages(){
    stageControllers.forEach(ctrl => ctrl.stop());
  }

  function applyStagePlaylists(masterQueue, { resetIndex = true } = {}){
    const leftCfg = getPageConfig('left');
    const rightCfg = getPageConfig('right');
    stageLeftController.apply(
      filterQueueForPage(masterQueue, leftCfg),
      { enabled: leftCfg.enabled, timerSec: leftCfg.timerSec, source: leftCfg.source, contentTypes: leftCfg.contentTypes, playlist: leftCfg.playlist },
      { resetIndex }
    );
    stageRightController.apply(
      filterQueueForPage(masterQueue, rightCfg),
      { enabled: rightCfg.enabled, timerSec: rightCfg.timerSec, source: rightCfg.source, contentTypes: rightCfg.contentTypes, playlist: rightCfg.playlist },
      { resetIndex }
    );
    updateLayoutModeAttr(rightCfg.enabled ? 'split' : 'single');
  }

  function refreshStageQueues({ resetIndex = true, autoplay = true } = {}){
    const masterQueue = buildMasterQueue();
    applyStagePlaylists(masterQueue, { resetIndex });
    if (autoplay) stageControllers.forEach(ctrl => ctrl.play());
    return masterQueue;
  }

//Showpairing
function showPairing(){
  stopAllStages();
  updateLayoutModeAttr('single');
  const box = document.createElement('div');
  box.className = 'container fade show';
  box.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  box.innerHTML = `
    <div style="background:rgba(0,0,0,.55);color:#fff;padding:28px 32px;border-radius:16px;max-width:90vw;text-align:center">
      <div style="font-weight:800;font-size:28px;margin-bottom:10px">Gerät koppeln</div>
      <div id="code" style="font-size:42px;font-weight:900;letter-spacing:4px;background:rgba(255,255,255,.1);padding:8px 14px;border-radius:12px;display:inline-block;min-width:12ch">…</div>
      <div style="margin-top:10px;opacity:.9">Öffne im Admin „Geräte“ und gib den Code ein.</div>
    </div>`;

  if (stageLeftController) stageLeftController.showCustom(box);
  else if (STAGE_LEFT || STAGE) {
    const target = STAGE_LEFT || STAGE;
    if (target) {
      target.innerHTML = '';
      target.appendChild(box);
      requestAnimationFrame(() => box.classList.add('show'));
    }
  }
  if (stageRightController) stageRightController.showCustom(null);

  (async ()=>{
    try {
      // Bestehenden Code (localStorage) wiederverwenden – Tabs teilen den Code
      let st = null; try { st = JSON.parse(ls.get('pairState')||'null'); } catch {}
      let code = (st && st.code && (Date.now() - (st.createdAt||0) < 15*60*1000)) ? st.code : null;

      if (!code) {
        const r = await fetch('/pair/begin', { method:'POST', headers:{'X-Pair-Request':'1'} });
        if (!r.ok){
          const err = new Error('begin http '+r.status);
          err.status = r.status;
          throw err;
        }
        const j0 = await r.json();
        if (!j0 || !j0.code) throw new Error('begin payload');
        code = j0.code;
        ls.set('pairState', JSON.stringify({ code, createdAt: Date.now() }));
      }

      const el = document.getElementById('code');
      if (el) el.textContent = code;

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(async () => {
        try {
          const rr = await fetch('/pair/poll?code=' + encodeURIComponent(code), { cache: 'no-store' });
          if (!rr.ok) return;
          const jj = await rr.json();
          if (jj && jj.paired && jj.deviceId) {
            clearInterval(pollTimer);
            pollTimer = null;
            ls.remove('pairState');
            ls.set('deviceId', jj.deviceId);
            // sofortigen Heartbeat absetzen und dann aktualisieren
            fetch('/api/heartbeat.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device: jj.deviceId })
            }).then(r => {
              if (!r.ok) throw new Error('heartbeat http ' + r.status);
            }).catch(e => console.error('[heartbeat] post-pair failed', e));
            location.replace('/?device=' + encodeURIComponent(jj.deviceId));
          }
        } catch {}
      }, 3000);
    } catch (e) {
      const el = document.getElementById('code');
      if (el) el.textContent = (e && e.status) ? String(e.status) : 'NETZ-FEHLER';
      console.error('[pair] begin failed', e);
    }
  })();
}


  // ---------- Bootstrap & live update ----------
async function bootstrap(){
// Preview-Bridge: Admin sendet {type:'preview', payload:{schedule,settings}}
 window.addEventListener('message', (ev) => {
  const d = ev?.data || {};
  if (d?.type !== 'preview') return;
  previewMode = true;
  try { if (window.__pairTimer) clearInterval(window.__pairTimer); } catch {}
  const p = d.payload || {};
  if (p.schedule) schedule = p.schedule;
  if (p.settings) { settings = p.settings; badgeLookupCache = null; }
  applyTheme();
  applyDisplay();
  maybeApplyPreset();
  refreshStageQueues({ resetIndex:true });
  preloadSlideImages();
});
  const deviceMode = !!DEVICE_ID;

  if (!previewMode) {
    if (deviceMode) {
try {
    await loadDeviceResolved(DEVICE_ID);
    // Heartbeat: sofort + alle 30s
    const sendHeartbeat = () => {
      const payload = JSON.stringify({ device: DEVICE_ID });
      const blob = new Blob([payload], { type: 'application/json' });
      let sent = false;
      if (navigator.sendBeacon) {
        try {
          sent = navigator.sendBeacon('/api/heartbeat.php', blob);
        } catch (e) {
          console.error('[heartbeat] beacon failed', e);
        }
      }
      if (!sent) {
        fetch('/api/heartbeat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload
        }).then(r => {
          if (!r.ok) throw new Error('heartbeat http ' + r.status);
        }).catch(e => console.error('[heartbeat] failed', e));
      }
    };
    sendHeartbeat();
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(sendHeartbeat, 30 * 1000);
 } catch (e) {
console.error('[bootstrap] resolve failed:', e);
 showPairing();
 return; // HIER abbrechen, sonst bleibt die Stage leer
      }
} else {
  if (IS_PREVIEW) {
    const info = document.createElement('div');
    info.className = 'container fade show empty';
    const inner = document.createElement('div');
    inner.className = 'empty-message';
    inner.textContent = 'Vorschau lädt…';
    info.appendChild(inner);
    stopAllStages();
    updateLayoutModeAttr('single');
    if (stageLeftController) stageLeftController.showCustom(info);
    if (stageRightController) stageRightController.showCustom(null);
    return; // kein Pairing im Admin-Dock
  }
  showPairing();
  return;
}
  }

  // Erst hier starten wir die Slideshow
  refreshStageQueues({ resetIndex:true });
  preloadSlideImages();

  // Live-Reload: bei Device NUR resolve pollen
  // Polling beibehalten, da Versionsänderungen zuverlässig erkannt werden
  if (!previewMode) {
    let lastSchedVer = schedule?.version || 0;
    let lastSetVer   = settings?.version || 0;

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      try {
        if (deviceMode) {
          const r = await fetch(`/pair/resolve?device=${encodeURIComponent(DEVICE_ID)}&t=${Date.now()}`, {cache:'no-store'});
          if (r.status === 404) {
            clearInterval(pollTimer);
            pollTimer = null;
            stopAllStages();
            showPairing();
            return;
          }
          if (!r.ok) {
            console.warn('[poll] http', r.status);
            return;
          }
          const j = await r.json();
          if (!j || j.ok === false) {
            console.warn('[poll] payload invalid');
            return;
          }

          const newSchedVer = j.schedule?.version || 0;
          const newSetVer   = j.settings?.version || 0;

          if (newSchedVer !== lastSchedVer || newSetVer !== lastSetVer) {
            schedule = j.schedule; settings = j.settings;
            badgeLookupCache = null;
            lastSchedVer = newSchedVer; lastSetVer = newSetVer;
            applyTheme();
            applyDisplay();
            maybeApplyPreset();
            refreshStageQueues({ resetIndex:true });
            preloadSlideImages();
          }
        } else {
          const s  = await loadJSON('/data/schedule.json');
          const cf = await loadJSON('/data/settings.json');
          if (s.version !== lastSchedVer || cf.version !== lastSetVer) {
            schedule=s; settings=cf; lastSchedVer=s.version; lastSetVer=cf.version;
            badgeLookupCache = null;
            applyTheme();
            applyDisplay();
            maybeApplyPreset();
            refreshStageQueues({ resetIndex:true });
            preloadSlideImages();
          }
        }
      } catch(e) {
        console.warn('[poll] failed:', e);
      }
    }, 3000);
  }
}

  bootstrap();
})();
