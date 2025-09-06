(() => {
  const FITBOX = document.getElementById('fitbox');
  const CANVAS = document.getElementById('canvas');
  const STAGE  = document.getElementById('stage');
const Q = new URLSearchParams(location.search);
const IS_PREVIEW = Q.get('preview') === '1'; // NEU: Admin-Dock
const rawDevice = (Q.get('device') || localStorage.getItem('deviceId') || '').trim();
const DEVICE_ID = /^dev_[a-f0-9]{12}$/i.test(rawDevice) ? rawDevice : null;
if (!DEVICE_ID) localStorage.removeItem('deviceId'); // Karteileichen loswerden
let previewMode = IS_PREVIEW; // NEU: in Preview sofort aktiv (kein Pairing)

  let schedule = null;
  let settings = null;
  let nextQueue = [];
  let lastKey = null; // verhindert direkte Wiederholung derselben Folie
  let idx = 0;
  let slideTimer = 0, transTimer = 0;
  let onResizeCurrent = null;

  const imgCache = new Set();
  function preloadImage(url){
    return new Promise(res=>{
      if (!url || imgCache.has(url)) return res();
      const i = new Image();
      i.onload = i.onerror = () => res();
      i.src = url;
      imgCache.add(url);
    });
  }
  async function preloadRightImages(){
    const urls = Object.values(settings?.assets?.rightImages || {});
    await Promise.all(urls.filter(Boolean).map(preloadImage));
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
  await preloadRightImages();
  await buildQueue();
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
    await preloadRightImages();
    await buildQueue();
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
      '--chipHScale': (settings?.fonts?.chipHeight || 1)
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
    window.addEventListener('resize', updateVwScale, { passive:true });
  }

// ---------- Slide queue ----------
function buildQueue() {
  // Tages-Preset ggf. anwenden
  maybeApplyPreset();

  const showOverview = (settings?.slides?.showOverview !== false);
  const hidden = new Set(settings?.slides?.hiddenSaunas || []);
  const allSaunas = (schedule?.saunas || []);

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

  // Hilfen
  const idxOverview = () => queue.findIndex(x => x.type === 'overview');

  // Mehrpass-Einfügen, damit "nach Bild" funktioniert
  let remaining = media.slice();
  let guard = 0;
  while (remaining.length && guard++ < media.length * 3) {
    const postponed = [];
    for (const it of remaining) {
      const ref = (it.afterRef || it.after || 'overview');
      let insPos = -1;

      if (ref === 'overview') {
        const io = idxOverview();
        insPos = (io >= 0) ? io + 1 : 0;
      } else if (String(ref).startsWith('img:')) {
        // nach Bild/Medien-Item: nur einfügen, wenn das Ziel bereits platziert ist
        const prevId = String(ref).slice(4);
        const prevIndex = queue.findIndex(x => x.__id === prevId);
        if (prevIndex === -1) { postponed.push(it); continue; }
        insPos = prevIndex + 1;
      } else {
        // nach Sauna (Name)
        const saunaName = decodeURIComponent(String(ref));
        const direct = queue.findIndex(x => x.type === 'sauna' && x.sauna === saunaName);
        if (direct !== -1) {
          // Zielsauna ist sichtbar → direkt dahinter
          insPos = direct + 1;
        } else {
          // Zielsauna ist NICHT sichtbar → vor der nächsten sichtbaren Sauna in der Referenz-Reihenfolge
          let nextVisible = null;
          if (saunaOrderRef.length && visibleSaunas.length) {
            const start = saunaOrderRef.indexOf(saunaName);
            // falls die Referenzsauna gar nicht existiert, einfach ab 0 suchen
            let k = (start >= 0 ? start : -1) + 1;
            for (let step = 0; step < saunaOrderRef.length; step++, k++) {
              const cand = saunaOrderRef[k % saunaOrderRef.length];
              if (!hidden.has(cand)) { nextVisible = cand; break; }
            }
          }
          if (nextVisible) {
            const posQ = queue.findIndex(x => x.type === 'sauna' && x.sauna === nextVisible);
            insPos = (posQ >= 0) ? posQ : -1; // vor nächster Sauna einfügen
          }

          // Fallback: nach Overview oder ganz vorn
          if (insPos === -1) {
            const io = idxOverview();
            insPos = (io >= 0) ? io + 1 : 0;
          }
        }
      }

      // Medien-Node einfügen
      const dwell = Number.isFinite(+it.dwellSec)
        ? +it.dwellSec
        : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);

      const node = { type: it.type, dwell, __id: it.id || null };
      if (it.src) node.src = it.src;
      if (it.url && it.type === 'url') node.url = it.url;
      queue.splice(insPos, 0, node);
    }
    remaining = postponed;
  }

  // Falls nichts bleibt, notfalls Übersicht zeigen
  if (!queue.length && showOverview) queue.push({ type: 'overview' });

  nextQueue.splice(0, nextQueue.length, ...queue);
  idx = 0;
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

    // Nur typografisch skalieren (breite bleibt 100%)
    let iter = 0, lastTotal = Infinity;
    let m = measure();
while (m.totalH > availH && iter < 12) {
  const target = availH / m.totalH;
  const s = Math.max(0.25, Math.min(1, target * (iter ? 0.98 : 1)));
      container.style.setProperty('--ovAuto', String(s));
      lastTotal = m.totalH;
      m = measure();
      if (Math.abs(m.totalH - lastTotal) < 0.5) break;
      iter++;
    }
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

// ---------- Interstitial image slide ----------
function renderImage(url) {
  const c = h('div', { class: 'container imgslide fade show' }, [
    h('div', { class: 'imgFill', style: 'background-image:url("'+url+'")' })
  ]);
  return c;
}

// ---------- Interstitial video slide ----------
function renderVideo(src) {
  const v = document.createElement('video');
  v.preload = 'auto';
  v.autoplay = true;
  v.loop = true;
  v.muted = true;
  v.playsInline = true;
  v.setAttribute('style', 'width:100%;height:100%;object-fit:contain');
  v.src = src;
  v.addEventListener('canplay', () => v.play());
  v.addEventListener('error', (e) => {
    console.error('[video] error', e);
    const fallback = h('div', { class: 'video-error', style: 'padding:1em;color:#fff;text-align:center' }, 'Video konnte nicht geladen werden');
    if (v.parentNode) v.parentNode.replaceChild(fallback, v);
  });
  const c = h('div', { class: 'container videoslide fade show' });
  c.appendChild(v);
  return c;
}

// ---------- Interstitial external URL slide ----------
function renderUrl(src) {
  const f = h('iframe', {
    src,
    class: 'urlFill',
    style: 'width:100%;height:100%;border:0'
  });
  const c = h('div', { class: 'container urlslide fade show' }, [f]);
  return c;
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
  function applyTileSizing(container) {
    const avail = computeAvailContentWidth(container);
    const pct = (settings?.slides?.tileWidthPercent ?? 45) / 100;
    const target = Math.max(0, avail * pct);
    const minScale = Math.max(0, settings?.slides?.tileMinScale ?? 0.25);
    const maxScale = Math.max(minScale, settings?.slides?.tileMaxScale ?? 0.57);
    container.style.setProperty('--tileTargetPx', target + 'px');
    container.style.setProperty('--tileMinScale', String(minScale));
    container.style.setProperty('--tileMaxScale', String(maxScale));
  }

  // ---------- Sauna slide ----------
  function renderSauna(name) {
    const hlMap = getHighlightMap();
    const rightUrl = settings?.assets?.rightImages?.[name] || '';
    const headingWrap = h('div', { class: 'headings' }, [
      h('h1', { class: 'h1', style: 'color:var(--saunaColor);' }, name),
      h('h2', { class: 'h2' }, computeH2Text() || '')
    ]);
    const c = h('div', { class: 'container has-right fade show' }, [
      h('div', { class: 'rightPanel', style: rightUrl ? ('background-image:url(' + JSON.stringify(rightUrl) + ')') : 'display:none;' }),
      headingWrap
    ]);

    const body = h('div', { class: 'body' });
    const list = h('div', { class: 'list' });

    const notes = footnoteMap();
    const colIdx = (schedule.saunas || []).indexOf(name);
    const items = [];
    for (const row of (schedule.rows || [])) {
      const cell = (row.entries || [])[colIdx];
      if (cell && cell.title) items.push({ time: row.time, title: cell.title, flames: cell.flames || '', noteId: cell.noteId });
    }
    items.sort((a, b) => a.time.localeCompare(b.time));

    const usedSet = new Set();
    for (const it of items) {
      const baseTitle = String(it.title).replace(/\*+$/, '');
      const hasStar = /\*$/.test(it.title || '');
      const labelText = it.time + ' Uhr – ' + baseTitle;
      const titleNode = h('div', { class: 'title' }, labelText);
      const supNote = noteSup(it, notes);
      if (supNote) { titleNode.appendChild(h('span', { class: 'notewrap' }, [supNote])); usedSet.add(it.noteId); }
      else if (hasStar) { titleNode.appendChild(h('span', { class: 'notewrap' }, [h('sup',{class:'note legacy'}, '*')])); }
      const isHL = hlMap.bySauna[name] && hlMap.bySauna[name].has(it.time);
      const tile = h('div', { class: 'tile' + (isHL ? ' highlight' : '') }, [ titleNode, flamesWrap(it.flames) ]);
      list.appendChild(tile);
    }
    if (items.length === 0) list.appendChild(h('div', { class: 'caption' }, 'Keine Einträge.'));

    body.appendChild(list); c.appendChild(body);

const footNodes = [];
const order = (settings?.footnotes||[]).map(fn=>fn.id);
for (const id of order){ if (usedSet.has(id)){ const v = notes.get(id); if (v) footNodes.push(h('div',{class:'fnitem'}, [h('sup',{class:'note'}, String(v.label||'*')), ' ', v.text])); } }
const layout = (settings?.footnoteLayout ?? 'one-line');
const fnClass = 'footer-note ' + (layout==='multi' ? 'fn-multi' : layout==='stacked' ? 'fn-stack' : 'fn-one');
if (footNodes.length){
  const nodes = [];
  footNodes.forEach((n,i)=>{ if (i>0 && layout!=='stacked') nodes.push(h('span',{class:'fnsep','aria-hidden':'true'}, '•')); nodes.push(n); });
  c.appendChild(h('div', { class: fnClass }, nodes));
}

    c.appendChild(h('div', { class: 'brand' }, 'Signage'));

    const recalc = () => applyTileSizing(c);
    setTimeout(recalc, 0);
    onResizeCurrent = recalc;

    return c;
  }

  // ---------- Stage helpers ----------
  function show(el) { STAGE.innerHTML = ''; STAGE.appendChild(el); requestAnimationFrame(() => { el.classList.add('show'); }); }
  function hide(cb) {
    const cur = STAGE.firstChild; if (cur) cur.classList.remove('show');
    const t = (settings?.slides?.transitionMs ?? 500);
    transTimer = setTimeout(cb, t);
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

  return 6000; // Fallback
}

  // ---------- Loop ----------
function step() {
  if (!nextQueue.length) return;
  clearTimers();

let item = nextQueue[idx % nextQueue.length];
let key  = item.type + '|' + (item.sauna || item.src || item.url || '');
if (key === lastKey && nextQueue.length > 1) {
  // eine Folie würde direkt wiederholt → eine weiter
    idx++;
    item = nextQueue[idx % nextQueue.length];
    key  = item.type + '|' + (item.sauna || item.src || item.url || '');
}
  const el =
    (item.type === 'overview') ? renderOverview() :
    (item.type === 'sauna')    ? renderSauna(item.sauna) :
    (item.type === 'image')    ? renderImage(item.src) :
    (item.type === 'video')    ? renderVideo(item.src) :
    (item.type === 'url')      ? renderUrl(item.url) :
                                 renderImage(item.src || item.url);

  show(el);
lastKey = key;
  const dwell = dwellMsForItem(item);
  slideTimer = setTimeout(() => hide(() => { idx++; step(); }), dwell);
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
      // Bestehenden Code (Session) wiederverwenden – verhindert neuen Code bei Refresh
      let st = null; try { st = JSON.parse(sessionStorage.getItem('pairState')||'null'); } catch {}
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
        sessionStorage.setItem('pairState', JSON.stringify({ code, createdAt: Date.now() }));
      }

      const el = document.getElementById('code');
      if (el) el.textContent = code;

      const timer = setInterval(async ()=>{
        try {
          const rr = await fetch('/pair/poll?code='+encodeURIComponent(code), {cache:'no-store'});
          if (!rr.ok) return;
          const jj = await rr.json();
          if (jj && jj.paired && jj.deviceId){
            clearInterval(timer);
            try{ sessionStorage.removeItem('pairState'); }catch{}
            localStorage.setItem('deviceId', jj.deviceId);
            location.replace('/?device='+encodeURIComponent(jj.deviceId));
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
 idx = 0; lastKey = null;
 step();
 });
  const deviceMode = !!DEVICE_ID;

  if (!previewMode) {
    if (deviceMode) {
try {
 await loadDeviceResolved(DEVICE_ID);
 // Heartbeat: sofort + alle 30s (setzt "Zuletzt gesehen" direkt)
 fetch('/pair/touch?device='+encodeURIComponent(DEVICE_ID)).catch(()=>{});
 setInterval(()=>{ fetch('/pair/touch?device='+encodeURIComponent(DEVICE_ID)).catch(()=>{}); }, 30000);     
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
  step();

  // Live-Reload: bei Device NUR resolve pollen
  if (!previewMode) {
    let lastSchedVer = schedule?.version || 0;
    let lastSetVer   = settings?.version || 0;

    setInterval(async () => {
      try {
        if (deviceMode) {
          const r = await fetch(`/pair/resolve?device=${encodeURIComponent(DEVICE_ID)}&t=${Date.now()}`, {cache:'no-store'});
          if (!r.ok) throw new Error('resolve http '+r.status);
          const j = await r.json();
          if (!j || j.ok === false) throw new Error('resolve payload');

          const newSchedVer = j.schedule?.version || 0;
          const newSetVer   = j.settings?.version || 0;

          if (newSchedVer !== lastSchedVer || newSetVer !== lastSetVer) {
            schedule = j.schedule; settings = j.settings;
            lastSchedVer = newSchedVer; lastSetVer = newSetVer;
            applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
            clearTimers(); idx = idx % Math.max(1, nextQueue.length); step();
          }
        } else {
          const s  = await loadJSON('/data/schedule.json');
          const cf = await loadJSON('/data/settings.json');
          if (s.version !== lastSchedVer || cf.version !== lastSetVer) {
            schedule=s; settings=cf; lastSchedVer=s.version; lastSetVer=cf.version;
            applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
            clearTimers(); idx = idx % Math.max(1, nextQueue.length); step();
          }
        }
} catch(e) {
 console.warn('[poll] failed:', e);
 // robuster: nicht sofort zurück zum Pairing – erst nach 3 Fehlversuchen
 window.__pollErrs = (window.__pollErrs||0)+1;
 if (deviceMode && window.__pollErrs>=3) showPairing();      }
    }, 3000);
  }
}

  bootstrap();
})();
