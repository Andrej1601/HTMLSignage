(() => {
  const FITBOX = document.getElementById('fitbox');
  const CANVAS = document.getElementById('canvas');
  const STAGE  = document.getElementById('stage');
  const Q = new URLSearchParams(location.search);
  const IS_PREVIEW = Q.get('preview') === '1'; // NEU: Admin-Dock
  const LS_MEM = {};
  let lsWarned = false;
  function lsNotice(){
    if (lsWarned) return;
    lsWarned = true;
    alert('Speicher voll – Daten werden nur temporär gespeichert.');
  }
  const ls = {
    get(k){
      try { return localStorage.getItem(k); }
      catch(e){
        if (e instanceof DOMException){
          console.warn('[slideshow] localStorage.getItem failed', e);
          lsNotice();
          return LS_MEM[k] ?? null;
        }
        return null;
      }
    },
    set(k,v){
      try { localStorage.setItem(k,v); }
      catch(e){
        if (e instanceof DOMException){
          console.warn('[slideshow] localStorage.setItem failed', e);
          lsNotice();
          LS_MEM[k] = String(v);
        }
      }
    },
    remove(k){
      try { localStorage.removeItem(k); }
      catch(e){
        if (e instanceof DOMException){
          console.warn('[slideshow] localStorage.removeItem failed', e);
          lsNotice();
        }
      }
      delete LS_MEM[k];
    }
  };
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
  let nextQueue = [];
  let heroTimeline = [];
  let lastKey = null; // verhindert direkte Wiederholung derselben Folie
  let idx = 0;
  let slideTimer = 0, transTimer = 0;
  let onResizeCurrent = null;
  let cachedDisp = null;
  let heartbeatTimer = null;
  let pollTimer = null;

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

  const imgCache = new Set();
  const preloadQueue = [];
  const queuedUrls = new Set();
  let activePreloads = 0;
  const MAX_PRELOAD = 3;
  const PRELOAD_AHEAD = 4;

  function runPreloadQueue(){
    while (activePreloads < MAX_PRELOAD && preloadQueue.length) {
      const { url, resolve } = preloadQueue.shift();
      activePreloads++;
      const img = new Image();
      const done = () => {
        img.onload = img.onerror = null;
        img.src = '';
        queuedUrls.delete(url);
        imgCache.add(url);
        activePreloads--;
        resolve();
        runPreloadQueue();
      };
      img.onload = img.onerror = done;
      img.src = url;
    }
  }

  function queuePreload(url){
    if (!url || imgCache.has(url) || queuedUrls.has(url)) return Promise.resolve();
    queuedUrls.add(url);
    return new Promise(resolve => {
      preloadQueue.push({ url, resolve });
      runPreloadQueue();
    });
  }

  function preloadImage(url){
    return queuePreload(url);
  }

  function preloadImg(url){
    return new Promise(resolve => {
      if (!url) return resolve({ ok:false });
      const img = new Image();
      img.onload  = () => resolve({ ok:true,  w:img.naturalWidth, h:img.naturalHeight });
      img.onerror = () => resolve({ ok:false });
      img.src = url;
    });
  }
  async function preloadRightImages(){
    const urls = Object.values(settings?.assets?.rightImages || {});
    await Promise.all(urls.filter(Boolean).map(preloadImage));
  }
  async function preloadNextImages(){
    if (!nextQueue.length) return;
    const urls = [];
    for (let i = 0; i < PRELOAD_AHEAD; i++) {
      const item = nextQueue[(idx + i) % nextQueue.length];
      let url = null;
      if (item) {
        if (item.type === 'image') {
          url = item.src;
        } else if (item.type === 'story') {
          url = item.story?.heroUrl || item.story?.hero?.url || null;
        }
      }
      if (url) urls.push(url);
    }
    await Promise.all(urls.map(preloadImage));
  }

  async function preloadSlideImages(){
    await preloadNextImages();
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
  applyTheme(); applyDisplay(); maybeApplyPreset();
  buildQueue();
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
    applyTheme();
    applyDisplay();
    maybeApplyPreset();
    buildQueue();
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
    const msVar = (value, fallback) => {
      const num = Number.isFinite(+value) ? Math.max(0, +value) : fallback;
      return (Number.isFinite(num) ? num : fallback) + 'ms';
    };
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
      '--baseScale': settings?.fonts?.scale || 1,
      '--scale': 'calc(var(--baseScale)*var(--vwScale))',
      '--h1Scale': settings?.fonts?.h1Scale || 1,
      '--h2Scale': settings?.fonts?.h2Scale || 1,
      '--ovHeadScale': settings?.fonts?.overviewHeadScale || 0.9,
      '--ovCellScale': settings?.fonts?.overviewCellScale || 0.8,
      '--tileTextScale': settings?.fonts?.tileTextScale || 0.8,
      '--tileWeight': settings?.fonts?.tileWeight || 600,
      '--chipHScale': (settings?.fonts?.chipHeight || 1),
      '--badgeBg': settings?.slides?.infobadgeColor || t.accent || '#5C3101',
      '--badgeFg': t.boxFg || '#FFFFFF',
      '--tileEnterDuration': msVar(settings?.slides?.tileEnterMs, 600),
      '--tileEnterDelay': msVar(settings?.slides?.tileStaggerMs, 80),
      '--heroTimelineItemMs': msVar(settings?.slides?.heroTimelineItemMs, 500),
      '--heroTimelineItemDelay': msVar(settings?.slides?.heroTimelineItemDelayMs, 140),
      '--heroTimelineFillMs': msVar(settings?.slides?.heroTimelineFillMs, 8000),
      '--heroTimelineDelayMs': msVar(settings?.slides?.heroTimelineDelayMs, 400)
    });
    if (settings?.fonts?.family) document.documentElement.style.setProperty('--font', settings.fonts.family);
// Chip-Optionen (Übersicht): Größen & Overflow-Modus aus den Settings
  const f = settings?.fonts || {};
  setVars({
  '--chipFlamePct': Math.max(0.3, Math.min(1, (f.flamePct || 55) / 100)),
  '--chipFlameGapScale': Math.max(0, (f.flameGapScale ?? 0.14))
});
// 'scale' = Text automatisch verkleinern, 'ellipsis' = auf „…“ kürzen
document.body.dataset.chipOverflow = f.chipOverflowMode || 'scale';

 ensureFontFamily();
  }

  function applyDisplay() {
    cachedDisp = null;
    const d = settings?.display || {};
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
        const key = 'r' + ri + 'c' + colIdx;
        entries.push({
          sauna: saunaName,
          title: label,
          detail,
          highlight: !!highlight.byCell[key]
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
  function buildQueue() {
  // Tages-Preset ggf. anwenden
  maybeApplyPreset();

  const heroEnabled = !!(settings?.slides?.heroEnabled);
  const timeline = heroEnabled ? collectHeroTimelineData() : (heroTimeline = []);
  const hasHero = heroEnabled && timeline.length > 0;

  const finalizeQueue = (queue) => {
    const out = hasHero ? [{ type: 'hero-timeline' }, ...queue] : queue.slice();
    nextQueue.splice(0, nextQueue.length, ...out);
  };

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
    finalizeQueue(queue);
    return;
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

  finalizeQueue(queue);
}

  // ---------- DOM helpers ----------
  function h(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v; else if (k === 'style') el.setAttribute('style', v); else el.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c)); else if (c) el.appendChild(c);
    }
    return el;
  }

  function clearTimers(){ if (slideTimer){ clearTimeout(slideTimer); slideTimer = 0; } if (transTimer){ clearTimeout(transTimer); transTimer = 0; } }
  // ein globaler Resize-Listener ruft die für die aktuelle Folie gesetzte Funktion auf
  window.addEventListener('resize', () => { if (typeof onResizeCurrent === 'function') onResizeCurrent(); }, { passive:true });

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

  function renderComponentNodes(flags, defs, fallbackFactory){
    const enabled = flags || {};
    const anyEnabled = Object.values(enabled).some(Boolean);
    const nodes = [];
    defs.forEach(def => {
      if (!def) return;
      const { key } = def;
      if (!key) return;
      if (enabled[key] === false) return;
      const node = def.node ?? (typeof def.render === 'function' ? def.render() : null);
      if (!node) return;
      nodes.push(node);
    });
    if (!nodes.length && typeof fallbackFactory === 'function'){
      const fallbackNode = fallbackFactory(anyEnabled);
      if (fallbackNode) nodes.push(fallbackNode);
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

  function collectCellDetails(cell){
    if (!cell) return { description:'', aromas:[], facts:[], badgeLabel:'' };
    const description = firstText(cell.description, cell.detail, cell.subtitle, cell.text, cell.extra);
    const aromas = gatherList(cell.aromaList, cell.aromas, cell.aroma, cell.scent, cell.scents);
    const facts = gatherList(cell.facts, cell.details, cell.detailsList, cell.tags, cell.chips, cell.meta, cell.badges);
    const badgeLabel = firstText(cell.type);
    return { description, aromas, facts, badgeLabel };
  }

  function createDescriptionNode(text, className){
    const str = String(text || '').trim();
    if (!str) return null;
    return h('p', { class: className || 'description' }, str);
  }

  function createAromaListNode(items, className){
    const list = Array.isArray(items) ? items.filter(v => String(v || '').trim()) : [];
    if (!list.length) return null;
    const cls = className || 'aroma-list';
    const nodes = list.map(item => h('li', String(item)));
    return h('ul', { class: cls }, nodes);
  }

  function createFactsList(items, className = 'facts', chipClass = 'card-chip'){
    const list = Array.isArray(items) ? items.filter(v => String(v || '').trim()) : [];
    if (!list.length) return null;
    const nodes = list.map(fact => h('li', { class: chipClass }, fact));
    return h('ul', { class: className }, nodes);
  }

  function createBadgeRow(label, className){
    const str = String(label || '').trim();
    if (!str) return null;
    const iconChar = settings?.slides?.infobadgeIcon || '';
    const bits = [];
    if (iconChar) bits.push(h('span', { class: 'badge-icon', 'aria-hidden': 'true' }, iconChar));
    bits.push(h('span', { class: 'badge-label' }, str));
    const badge = h('span', { class: 'badge' }, bits);
    return h('div', { class: className || 'badge-row' }, [badge]);
  }

  // ---------- Highlight logic ----------
  function getHighlightMap() {
    const HL = settings?.highlightNext || {};
    if (!HL.enabled) return { bySauna: {}, byCell: {} };

    const before = Number.isFinite(+HL.minutesBeforeNext) ? +HL.minutesBeforeNext : (Number.isFinite(+HL.minutesWindow) ? +HL.minutesWindow : 15);
    const after  = Number.isFinite(+HL.minutesAfterStart) ? +HL.minutesAfterStart : (Number.isFinite(+HL.minutesAfter) ? +HL.minutesAfter : 15);
    const now = nowMinutes();

    const bySauna = {}; const byCell = {};
    (schedule.saunas || []).forEach((saunaName, colIdx) => {
      const times = [];
      (schedule.rows || []).forEach((row, ri) => {
        const cell = (row.entries || [])[colIdx];
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
    const notes = footnoteMap();
    const t = h('table', { class: 'grid' });
    const colg = h('colgroup');
    colg.appendChild(h('col', { class: 'c_time' }));
    for (const _ of (schedule.saunas || [])) colg.appendChild(h('col', { class: 'c_auto' }));
    t.appendChild(colg);

    const thead = h('thead');
    const tr = h('tr');
    tr.appendChild(h('th', { class: 'timecol corner' }, 'Zeit'));
    for (const s of (schedule.saunas || [])) tr.appendChild(h('th', {}, s));
    thead.appendChild(tr); t.appendChild(thead);

    const usedSet = new Set();
    const tb = h('tbody');
    (schedule.rows || []).forEach((row, ri) => {
      const trr = h('tr');
      trr.appendChild(h('td', { class: 'timecol' }, row.time));
      (row.entries || []).forEach((cell, ci) => {
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

// Flammen kompakt rechts
const flamesBox = h('div', { class: 'chip-flames' }, [flamesWrap(cell.flames || '')]);

// Chip-Container (Flex: Text links, Flammen rechts)
const chip = h('div', { class: 'chip' + (hlMap.byCell[key] ? ' highlight' : '') }, [txt, flamesBox]);
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

  function renderOverview() {
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
onResizeCurrent = recalc;
    return c;
  }

  function renderHeroTimeline() {
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
          const entryCls = 'timeline-entry' + (entry.highlight ? ' highlight' : '');
          const entryNode = h('div', { class: entryCls });
          entryNode.appendChild(h('span', { class: 'timeline-sauna' }, entry.sauna));
          entryNode.appendChild(h('span', { class: 'timeline-title' }, entry.title));
          if (entry.detail) entryNode.appendChild(h('span', { class: 'timeline-detail' }, entry.detail));
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

    onResizeCurrent = null;
    return container;
  }

// ---------- Interstitial image slide ----------
function renderImage(url) {
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
function renderVideo(src, opts = {}) {
  const disp = getDisplayRatio();
  const v = document.createElement('video');
  v.preload = 'auto';
  v.autoplay = true;
  if (opts.muted !== undefined) v.muted = !!opts.muted;
  else v.muted = true;
  v.playsInline = true;
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
    advanceQueue();
  });
  if (settings?.slides?.waitForVideo) {
    const done = () => {
      if (done.called) return;
      done.called = true;
      slideTimer = 0;
      hide(() => { idx++; step(); });
    };
    v.addEventListener('loadedmetadata', () => {
      const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : (dwellMsForItem(opts) / 1000);
      const ms = Math.max(1000, dur * 1000) + 500;
      slideTimer = setTimeout(done, ms);
    }, { once: true });
    v.addEventListener('ended', () => { clearTimeout(slideTimer); done(); }, { once: true });
  }
  const c = h('div', { class: 'container videoslide fade show', style: 'aspect-ratio:' + disp });
  c.appendChild(v);

  fetch(src, { method: 'HEAD' }).then(res => {
    if (!res.ok) {
      v.remove();
      const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
      c.appendChild(fallback);
      advanceQueue();
      return;
    }
    v.src = src;
  }).catch(() => {
    v.remove();
    const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
    c.appendChild(fallback);
    advanceQueue();
  });

  return c;
}

// ---------- Interstitial external URL slide ----------
function renderUrl(src) {
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

function renderStorySlide(story = {}) {
  const data = story || {};
  const container = h('div', { class: 'container story-slide fade show' });
  const columns = h('div', { class: 'story-columns' });
  const componentFlags = getSlideComponentFlags();

  const hero = h('div', { class: 'story-hero' });
  const heroUrl = data.heroUrl || data.hero?.url || '';
  const heroAlt = data.heroAlt || data.hero?.alt || '';
  if (heroUrl) {
    const img = h('img', { src: heroUrl, alt: heroAlt });
    img.addEventListener('error', () => {
      hero.classList.add('story-hero--placeholder');
      hero.innerHTML = '';
      hero.appendChild(h('div', { class: 'story-hero-placeholder' }, 'Bild nicht verfügbar'));
    });
    hero.appendChild(img);
  } else {
    hero.classList.add('story-hero--placeholder');
    hero.appendChild(h('div', { class: 'story-hero-placeholder' }, 'Kein Bild ausgewählt'));
  }

  const content = h('div', { class: 'story-content' });
  const title = String(data.title || '').trim() || 'Saunen & Aufgüsse erklärt';
  content.appendChild(h('h1', { class: 'story-title' }, title));
  if (data.subtitle) {
    content.appendChild(h('p', { class: 'story-subtitle' }, data.subtitle));
  }

  const paragraphNodes = (text) => {
    const str = String(text ?? '').trim();
    if (!str) return [];
    const lines = str.split(/\r?\n/).map(line => line.trim());
    const groups = [];
    let buf = [];
    for (const line of lines) {
      if (!line) {
        if (buf.length) { groups.push(buf.join(' ')); buf = []; }
      } else {
        buf.push(line);
      }
    }
    if (buf.length) groups.push(buf.join(' '));
    return groups.map(par => h('p', { class: 'story-paragraph' }, par));
  };

  const tipsNodes = (text) => {
    const str = String(text ?? '').trim();
    if (!str) return [];
    const lines = str.split(/\r?\n/).map(line => line.trim().replace(/^[-•]\s*/, '')).filter(Boolean);
    if (!lines.length) return [];
    if (lines.length === 1) return [h('p', { class: 'story-paragraph' }, lines[0])];
    const ul = h('ul', { class: 'story-tip-list' });
    lines.forEach(line => ul.appendChild(h('li', line)));
    return [ul];
  };

  const makeSection = (className, label, nodes) => {
    const items = nodes.filter(Boolean);
    if (!items.length) return null;
    return h('div', { class: 'story-section ' + className }, [
      h('h3', { class: 'story-section-title' }, label),
      ...items
    ]);
  };

  const richSectionNodes = () => {
    const items = Array.isArray(data.sections) ? data.sections : [];
    const nodes = [];
    items.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const title = String(entry.title || '').trim();
      let textSource = entry.text;
      if (Array.isArray(textSource)) textSource = textSource.join('\n\n');
      const text = paragraphNodes(textSource);
      let tipSource = entry.tips;
      if (tipSource == null && Array.isArray(entry.list)) tipSource = entry.list;
      if (Array.isArray(tipSource)) tipSource = tipSource.join('\n');
      const tips = tipsNodes(tipSource);
      const allContent = [];
      if (title) allContent.push(h('h3', { class: 'story-section-title' }, title));
      allContent.push(...text);
      allContent.push(...tips);
      const hasContent = allContent.length > 0;
      const imgUrl = entry.imageUrl || entry.mediaUrl || '';
      const imgAlt = entry.imageAlt || '';
      const imgCaption = entry.imageCaption || '';
      const layoutRaw = String(entry.layout || '').trim();
      const layout = ['media-left', 'media-right', 'full'].includes(layoutRaw) ? layoutRaw : 'media-right';
      if (!hasContent && !imgUrl) return;
      const sectionClass = ['story-section', 'story-section-rich'];
      if (imgUrl) {
        sectionClass.push('has-media');
        sectionClass.push('layout-' + layout);
      }
      const section = h('div', { class: sectionClass.join(' ') });
      const body = h('div', { class: 'story-section-content' }, allContent);
      let figure = null;
      if (imgUrl) {
        const img = h('img', { src: imgUrl, alt: imgAlt });
        figure = h('figure', { class: 'story-section-media' }, [
          img,
          imgCaption ? h('figcaption', imgCaption) : null
        ].filter(Boolean));
        img.addEventListener('error', () => {
          figure.classList.add('is-error');
          figure.replaceChildren(h('div', { class: 'story-section-media-fallback' }, 'Bild nicht verfügbar'));
        });
      }

      if (figure) {
        if (layout === 'media-left') {
          section.appendChild(figure);
          section.appendChild(body);
        } else if (layout === 'full') {
          section.appendChild(body);
          section.appendChild(figure);
        } else {
          section.appendChild(body);
          section.appendChild(figure);
        }
      } else {
        section.appendChild(body);
      }
      nodes.push(section);
    });
    return nodes;
  };

  const gallerySection = () => {
    const list = Array.isArray(data.gallery) ? data.gallery : [];
    const normalized = list
      .map(entry => {
        if (!entry) return null;
        if (typeof entry === 'string') {
          return { url: entry, alt: '', caption: '' };
        }
        const url = entry.url || entry.imageUrl || '';
        if (!url) return null;
        return {
          url,
          alt: entry.alt || entry.imageAlt || '',
          caption: entry.caption || ''
        };
      })
      .filter(Boolean);
    if (!normalized.length) return null;
    const grid = h('div', { class: 'story-gallery-grid' });
    normalized.forEach(item => {
      const img = h('img', { src: item.url, alt: item.alt || '' });
      const figure = h('figure', { class: 'story-gallery-item' }, [
        img,
        item.caption ? h('figcaption', item.caption) : null
      ].filter(Boolean));
      img.addEventListener('error', () => {
        figure.classList.add('is-error');
        figure.replaceChildren(h('div', { class: 'story-gallery-fallback' }, 'Bild nicht verfügbar'));
      });
      grid.appendChild(figure);
    });
    const label = String(data.galleryTitle || '').trim() || 'Galerie';
    return h('div', { class: 'story-section story-gallery' }, [
      h('h3', { class: 'story-section-title' }, label),
      grid
    ]);
  };

  const introSection = makeSection('story-intro', 'Einführung', paragraphNodes(data.intro));
  richSectionNodes().forEach(node => content.appendChild(node));
  if (introSection) content.appendChild(introSection);

  const ritualSection = makeSection('story-ritual', 'Ritual', paragraphNodes(data.ritual));
  if (ritualSection) content.appendChild(ritualSection);

  const tipsSection = makeSection('story-tips', 'Tipps', tipsNodes(data.tips));
  if (tipsSection) content.appendChild(tipsSection);

  const galleryNode = gallerySection();
  if (galleryNode) content.appendChild(galleryNode);

  const faqItems = Array.isArray(data.faq) ? data.faq.filter(item => {
    if (!item) return false;
    const q = String(item.question || '').trim();
    const a = String(item.answer || '').trim();
    return q || a;
  }) : [];
  if (faqItems.length) {
    const dl = h('dl', { class: 'story-faq-list' });
    faqItems.forEach(item => {
      const q = String(item.question || '').trim();
      const a = String(item.answer || '').trim();
      dl.appendChild(h('dt', q || 'Frage'));
      dl.appendChild(h('dd', a || ''));
    });
    const faqSection = makeSection('story-faq', 'FAQ', [dl]);
    if (faqSection) content.appendChild(faqSection);
  }

  const computeAvailability = () => {
    if (!schedule || !Array.isArray(schedule.rows) || !Array.isArray(schedule.saunas)) return [];
    const targetsRaw = Array.isArray(data.saunas) ? data.saunas
      : Array.isArray(data.saunaRefs) ? data.saunaRefs
      : (data.sauna ? [data.sauna] : []);
    const targets = targetsRaw
      .map(name => String(name || '').trim())
      .filter(Boolean);
    const indices = [];
    for (const name of targets) {
      const idx = schedule.saunas.indexOf(name);
      if (idx >= 0 && !indices.some(entry => entry.idx === idx)) {
        indices.push({ name, idx });
      }
    }
    if (!indices.length) return [];
    const now = nowMinutes();
    const items = [];
    (schedule.rows || []).forEach(row => {
      if (!row) return;
      const time = row.time || '';
      const m = parseHM(time);
      indices.forEach(({ name, idx }) => {
        const cell = Array.isArray(row.entries) ? row.entries[idx] : null;
        if (cell && cell.title) {
          const details = collectCellDetails(cell);
          items.push({
            sauna: name,
            title: cell.title,
            time,
            minutes: m,
            isUpcoming: (m != null) ? (m >= now) : false,
            ...details
          });
        }
      });
    });
    items.sort((a, b) => {
      const am = a.minutes ?? Infinity;
      const bm = b.minutes ?? Infinity;
      if (am === bm) return a.sauna.localeCompare(b.sauna, 'de');
      return am - bm;
    });
    const nextIdx = items.findIndex(it => it.minutes != null && it.minutes >= now);
    if (nextIdx >= 0) items[nextIdx].isNext = true;
    return items;
  };

  const availability = () => {
    const section = h('div', { class: 'story-section story-availability' });
    section.appendChild(h('h3', { class: 'story-section-title' }, 'Heute verfügbar'));
    const entries = computeAvailability();
    if (!entries.length) {
      const message = Array.isArray(data.saunas) && data.saunas.length
        ? 'Heute keine passenden Aufgüsse eingetragen.'
        : 'Keine Zuordnung zum Tagesplan hinterlegt.';
      section.appendChild(h('p', { class: 'story-availability-empty' }, message));
      return section;
    }
    const list = h('ul', { class: 'story-availability-list' });
    entries.forEach(entry => {
      const cls = ['story-availability-item'];
      if (entry.isNext) cls.push('is-next');
      else if (entry.isUpcoming) cls.push('is-upcoming');
      const li = h('li', { class: cls.join(' ') });
      const components = [
        {
          key: 'title',
          render: () => {
            const head = h('div', { class: 'story-availability-head' });
            head.appendChild(h('span', { class: 'story-availability-time' }, entry.time || '–'));
            const headline = h('div', { class: 'story-availability-headline' }, [
              h('span', { class: 'story-availability-sauna' }, entry.sauna),
              entry.title ? h('span', { class: 'story-availability-title' }, entry.title) : null
            ].filter(Boolean));
            head.appendChild(headline);
            return head;
          }
        },
        { key: 'description', render: () => createDescriptionNode(entry.description, 'story-availability-description') },
        { key: 'aromas', render: () => createAromaListNode(entry.aromas, 'aroma-list story-availability-aromas') },
        { key: 'facts', render: () => createFactsList(entry.facts, 'story-availability-facts', 'card-chip story-card-chip') },
        { key: 'badges', render: () => createBadgeRow(entry.badgeLabel, 'badge-row story-availability-badges') }
      ];
      renderComponentNodes(componentFlags, components, (anyEnabled) => h('div', {
        class: 'story-availability-empty-detail'
      }, anyEnabled ? 'Keine weiteren Details hinterlegt.' : 'Alle Komponenten deaktiviert.')).forEach(node => li.appendChild(node));
      list.appendChild(li);
    });
    section.appendChild(list);
    return section;
  };

  content.appendChild(availability());

  columns.appendChild(hero);
  columns.appendChild(content);
  container.appendChild(columns);
  return container;
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

    const iconSize = clamp(60, t * 0.18, 200);
    const padY = useIcons ? clamp(14, t * 0.045, 44) : clamp(10, t * 0.035, 32);
    const padX = useIcons
      ? Math.max(clamp(20, t * 0.07, 68), padY + 6)
      : Math.max(clamp(18, t * 0.06, 48), padY + 4);
    const gap = useIcons ? clamp(16, t * 0.05, 38) : clamp(12, t * 0.04, 30);
    const contentGap = useIcons ? clamp(8, t * 0.03, 26) : clamp(6, t * 0.022, 18);
    const chipGap = useIcons ? clamp(6, t * 0.022, 22) : clamp(4, t * 0.018, 16);
    const badgeOffset = useIcons ? clamp(10, t * 0.02, 28) : clamp(8, t * 0.018, 22);
    const radius = useIcons ? clamp(18, t * 0.06, 48) : clamp(16, t * 0.05, 44);
    const metaScale = useIcons ? clamp(0.72, t / 720, 1.12) : clamp(0.78, t / 820, 1.08);
    const flameSize = useIcons ? clamp(22, t * 0.03, 42) : clamp(18, t * 0.026, 32);

    container.style.setProperty('--tileIconSizePx', useIcons ? (iconSize.toFixed(2) + 'px') : '0px');
    container.style.setProperty('--tilePadYPx', padY.toFixed(2) + 'px');
    container.style.setProperty('--tilePadXPx', padX.toFixed(2) + 'px');
    container.style.setProperty('--tileGapPx', gap.toFixed(2) + 'px');
    container.style.setProperty('--tileContentGapPx', contentGap.toFixed(2) + 'px');
    container.style.setProperty('--tileChipGapPx', chipGap.toFixed(2) + 'px');
    container.style.setProperty('--tileBadgeOffsetPx', badgeOffset.toFixed(2) + 'px');
    container.style.setProperty('--tileRadiusPx', radius.toFixed(2) + 'px');
    container.style.setProperty('--tileMetaScale', metaScale.toFixed(3));
    container.style.setProperty('--flameSizePx', flameSize.toFixed(2));
  }

  // ---------- Sauna slide ----------
  function renderSauna(name) {
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
          badgeLabel: details.badgeLabel,
          hidden: isHidden,
          icon: cell.icon || null
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
      if (!iconsEnabled) tileClasses.push('tile--compact');

      const titleNode = h('div', { class: 'title' });
      const timeNode = h('span', { class: 'time' }, it.time + ' Uhr');
      const sepNode = h('span', { class: 'sep', 'aria-hidden': 'true' }, '–');
      const labelNode = h('span', { class: 'label' }, baseTitle);
      const supNote = noteSup(it, notes);
      if (supNote) {
        labelNode.appendChild(h('span', { class: 'notewrap' }, [supNote]));
        usedSet.add(it.noteId);
      } else if (hasStar) {
        labelNode.appendChild(h('span', { class: 'notewrap' }, [h('sup', { class: 'note legacy' }, '*')]));
      }
      titleNode.appendChild(timeNode);
      titleNode.appendChild(sepNode);
      titleNode.appendChild(labelNode);

      const contentBlock = h('div', { class: 'card-content' });
      renderComponentNodes(componentFlags, [
        { key: 'title', node: titleNode },
        { key: 'description', render: () => createDescriptionNode(it.description, 'description') },
        { key: 'aromas', render: () => createAromaListNode(it.aromas, (settings?.slides?.aromaItalic ? 'aroma-list is-italic' : 'aroma-list')) },
        { key: 'facts', render: () => createFactsList(it.facts, 'facts', 'card-chip') },
        { key: 'badges', render: () => createBadgeRow(it.badgeLabel, 'badge-row') }
      ], (anyEnabled) => h('div', { class: 'card-empty' }, anyEnabled ? 'Keine Details hinterlegt.' : 'Alle Komponenten deaktiviert.'))
        .forEach(node => contentBlock.appendChild(node));

      const tileChildren = [];
      if (iconsEnabled) {
        const iconUrl = it.icon || defaultIconForSauna || legacyIconFallback || '';
        const iconBox = h('div', { class: 'card-icon' + (iconUrl ? '' : ' is-empty') });
        if (iconUrl) {
          iconBox.appendChild(h('img', { src: iconUrl, alt: '' }));
        } else {
          const fallbackLabel = (() => {
            if (typeof name === 'string') {
              const trimmed = name.trim();
              if (trimmed.length >= 2) return trimmed.slice(0, 2);
              if (trimmed.length === 1) return trimmed;
            }
            return '?';
          })();
          iconBox.appendChild(h('span', { class: 'card-icon__fallback' }, fallbackLabel));
        }
        tileChildren.push(iconBox);
      }
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

    const recalc = () => applyTileSizing(c, { useIcons: iconsEnabled });
    setTimeout(recalc, 0);
    onResizeCurrent = recalc;

    return c;
  }

  // ---------- Stage helpers ----------
  function show(el) { STAGE.innerHTML = ''; STAGE.appendChild(el); requestAnimationFrame(() => { el.classList.add('show'); }); }
  function hide(cb) {
    const cur = STAGE.firstChild; if (cur) cur.classList.remove('show');
    const t = (settings?.slides?.transitionMs ?? 500);
    if (t > 0) {
      transTimer = setTimeout(cb, t);
    } else {
      cb();
    }
  }

  function advanceQueue(){
    clearTimers();
    hide(() => { idx++; step(); preloadNextImages(); });
  }

function dwellMsForItem(item) {
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

  return 6000; // Fallback
}

  // ---------- Loop ----------
function step() {
  if (!nextQueue.length) return;
  clearTimers();

let item = nextQueue[idx % nextQueue.length];
let key  = item.type + '|' + (item.sauna || item.src || item.url || item.storyId || item.story?.id || '');
if (key === lastKey && nextQueue.length > 1) {
  // eine Folie würde direkt wiederholt → eine weiter
    idx++;
    item = nextQueue[idx % nextQueue.length];
    key  = item.type + '|' + (item.sauna || item.src || item.url || item.storyId || item.story?.id || '');
}
  const el =
    (item.type === 'overview') ? renderOverview() :
    (item.type === 'sauna')    ? renderSauna(item.sauna) :
    (item.type === 'image')    ? renderImage(item.src) :
    (item.type === 'video')    ? renderVideo(item.src, item) :
    (item.type === 'url')      ? renderUrl(item.url) :
    (item.type === 'story')    ? renderStorySlide(item.story) :
    (item.type === 'hero-timeline') ? renderHeroTimeline() :
                                 renderImage(item.src || item.url);

  show(el);
  lastKey = key;

  if (!(settings?.slides?.waitForVideo && item.type === 'video')) {
    const dwell = dwellMsForItem(item);
    slideTimer = setTimeout(() => hide(() => { idx++; step(); }), dwell);
  }

}

//Showpairing
function showPairing(){
  STAGE.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'container fade show';
  box.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  box.innerHTML = `
    <div style="background:rgba(0,0,0,.55);color:#fff;padding:28px 32px;border-radius:16px;max-width:90vw;text-align:center">
      <div style="font-weight:800;font-size:28px;margin-bottom:10px">Gerät koppeln</div>
      <div id="code" style="font-size:42px;font-weight:900;letter-spacing:4px;background:rgba(255,255,255,.1);padding:8px 14px;border-radius:12px;display:inline-block;min-width:12ch">…</div>
      <div style="margin-top:10px;opacity:.9">Öffne im Admin „Geräte“ und gib den Code ein.</div>
    </div>`;
  STAGE.appendChild(box);

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
 if (p.settings) settings = p.settings;
 applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
 preloadSlideImages();
 idx = 0; lastKey = null;
 step();
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
    STAGE.innerHTML = '<div style="padding:16px;color:#fff;opacity:.75">Vorschau lädt…</div>';
    return; // kein Pairing im Admin-Dock
  }
  showPairing();
  return;
}
  }

  // Erst hier starten wir die Slideshow
  idx = 0;
  lastKey = null;
  step();

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
            clearTimers();
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
            lastSchedVer = newSchedVer; lastSetVer = newSetVer;
            applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
            preloadSlideImages();
            clearTimers();
            idx = idx % Math.max(1, nextQueue.length);
            lastKey = null;
            step();
          }
        } else {
          const s  = await loadJSON('/data/schedule.json');
          const cf = await loadJSON('/data/settings.json');
          if (s.version !== lastSchedVer || cf.version !== lastSetVer) {
            schedule=s; settings=cf; lastSchedVer=s.version; lastSetVer=cf.version;
            applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
            preloadSlideImages();
            clearTimers();
            idx = idx % Math.max(1, nextQueue.length);
            lastKey = null;
            step();
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
