// /admin/js/ui/slides_master.js
// ============================================================================
// Master-Panel: Saunen (inkl. „Kein Aufguss“), Übersicht-Row, Medien-Slides,
// Dauer-Modus (einheitlich/individuell), Presets & Wochentage.
// ----------------------------------------------------------------------------
// Abhängigkeiten:
//  - ../core/utils.js   : $, $$, preloadImg, escapeHtml
//  - ../core/upload.js  : uploadGeneric
//  - ../core/defaults.js: DAYS, DAY_LABELS, dayKeyToday
//  - ./grid.js          : renderGrid (nach Schedule-Änderungen neu zeichnen)
// ============================================================================

'use strict';

import { $, $$, preloadImg, escapeHtml, genId } from '../core/utils.js';
import { uploadGeneric } from '../core/upload.js';
import { renderGrid as renderGridUI } from './grid.js';
import { DAYS, DAY_LABELS, dayKeyToday } from '../core/defaults.js';
import { DEFAULTS } from '../core/defaults.js';

// App-Context (Getter/Setter aus app.js)
let ctx = null; // { getSchedule, getSettings, setSchedule, setSettings }
let wiredStatic = false;

const COMPONENT_KEYS = ['title','description','aromas','facts','badges'];

const STYLE_THEME_KEYS = [
  'bg','fg','accent','gridBorder','gridTable','gridTableW','cellBg','boxFg','headRowBg','headRowFg',
  'timeColBg','timeZebra1','timeZebra2','zebra1','zebra2','cornerBg','cornerFg','tileBorder','tileBorderW',
  'chipBorder','chipBorderW','flame','saunaColor'
];

const STYLE_FONT_KEYS = [
  'family','tileTextScale','tileWeight','chipHeight','chipOverflowMode','flamePct','flameGapScale',
  'tileMetaScale','overviewTimeWidthCh','overviewShowFlames'
];
const STYLE_SLIDE_KEYS = [
  'infobadgeColor','badgeLibrary','customBadgeEmojis','badgeScale','badgeDescriptionScale',
  'tileHeightScale','tileOverlayEnabled','tileOverlayStrength'
];

const SUGGESTED_BADGE_EMOJIS = [
  { value:'🌿', label:'Kräuter & Natur' },
  { value:'🔥', label:'Feuer & Hitze' },
  { value:'💧', label:'Wasser & Dampf' },
  { value:'❄️', label:'Eis & Frische' },
  { value:'🌸', label:'Blüten & Duft' },
  { value:'🍋', label:'Zitrus & Frucht' },
  { value:'🍯', label:'Honig' },
  { value:'🧘', label:'Entspannung' },
  { value:'🎉', label:'Event & Special' },
  { value:'⭐', label:'Highlight' },
  { value:'🌙', label:'Abend' },
  { value:'🎵', label:'Musik' },
  { value:'⚡', label:'Energie' },
  { value:'🌲', label:'Wald & Holz' },
  { value:'🧊', label:'Eisaufguss' },
  { value:'🧖', label:'Sauna & Wellness' },
  { value:'🪵', label:'Rituale & Räucherwerk' },
  { value:'🧴', label:'Peeling & Pflege' },
  { value:'🧂', label:'Salz & Sole' },
  { value:'🍫', label:'Schokolade' },
  { value:'🫧', label:'Schaum & Pflege' },
  { value:'🌊', label:'Meer & Gischt' },
  { value:'🌞', label:'Sonne & Wärme' },
  { value:'🌅', label:'Morgenstimmung' },
  { value:'🍀', label:'Glück & Wohlbefinden' }
];

const cloneValue = (value) => {
  if (value == null) return value;
  if (typeof value === 'object') return JSON.parse(JSON.stringify(value));
  return value;
};

function cloneSubset(src = {}, keys = []){
  const out = {};
  keys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(src, key)) out[key] = cloneValue(src[key]);
  });
  return out;
}

function ensureEnabledComponents(settings){
  settings.slides ||= {};
  const defaults = DEFAULTS.slides?.enabledComponents || {};
  const merged = { ...defaults };
  const current = settings.slides.enabledComponents;
  if (current && typeof current === 'object'){
    COMPONENT_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(current, key)) merged[key] = !!current[key];
    });
  }
  settings.slides.enabledComponents = merged;
  return merged;
}

function sanitizeStyleSetEntry(entry = {}){
  const label = String(entry.label || '').trim();
  const clean = {
    label: label || null,
    theme: cloneSubset(entry.theme, STYLE_THEME_KEYS),
    fonts: cloneSubset(entry.fonts, STYLE_FONT_KEYS),
    slides: cloneSubset(entry.slides, STYLE_SLIDE_KEYS)
  };
  if (!clean.label) clean.label = null;
  return clean;
}

function ensureStyleSets(settings){
  settings.slides ||= {};
  let sets = settings.slides.styleSets;
  if (!sets || typeof sets !== 'object'){
    sets = JSON.parse(JSON.stringify(DEFAULTS.slides?.styleSets || {}));
  }

  const cleaned = {};
  Object.entries(sets).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;
    const slug = String(key || '').trim();
    if (!slug) return;
    const entry = sanitizeStyleSetEntry(value);
    cleaned[slug] = {
      label: entry.label || slug,
      theme: entry.theme,
      fonts: entry.fonts,
      slides: entry.slides
    };
  });

  if (!Object.keys(cleaned).length){
    Object.assign(cleaned, JSON.parse(JSON.stringify(DEFAULTS.slides?.styleSets || {})));
  }

  settings.slides.styleSets = cleaned;
  const ids = Object.keys(cleaned);
  if (!settings.slides.activeStyleSet || !ids.includes(settings.slides.activeStyleSet)){
    settings.slides.activeStyleSet = ids[0] || '';
  }
  return cleaned;
}

function ensureBadgeLibrary(settings){
  settings.slides ||= {};
  const seen = new Set();
  const normalized = [];
  const pushEntry = (entry, assignId = false) => {
    if (!entry || typeof entry !== 'object') return;
    let id = String(entry.id ?? '').trim();
    if (!id && assignId) id = genId('bdg_');
    if (!id || seen.has(id)) return;
    const icon = typeof entry.icon === 'string' ? entry.icon.trim() : '';
    const label = typeof entry.label === 'string' ? entry.label.trim() : '';
    normalized.push({
      id,
      icon,
      label
    });
    seen.add(id);
  };

  const raw = settings.slides.badgeLibrary;
  const hadArray = Array.isArray(raw);
  const hadEntries = hadArray && raw.some(entry => entry && typeof entry === 'object');
  if (hadArray){
    raw.forEach(entry => pushEntry(entry, true));
  }

  if (!normalized.length && (!hadArray || hadEntries)){
    const fallback = DEFAULTS.slides?.badgeLibrary || [];
    if (Array.isArray(fallback)) fallback.forEach(entry => pushEntry(entry, true));
  }

  settings.slides.badgeLibrary = normalized;
  return normalized;
}

function ensureCustomBadgeEmojis(settings){
  settings.slides ||= {};
  const raw = settings.slides.customBadgeEmojis;
  const list = Array.isArray(raw) ? raw : [];
  const filtered = [];
  list.forEach(entry => {
    if (typeof entry !== 'string') return;
    const value = entry.trim();
    if (!value || filtered.includes(value)) return;
    filtered.push(value);
  });
  settings.slides.customBadgeEmojis = filtered;
  return filtered;
}

function snapshotStyleSet(settings){
  return {
    theme: cloneSubset(settings.theme, STYLE_THEME_KEYS),
    fonts: cloneSubset(settings.fonts, STYLE_FONT_KEYS),
    slides: cloneSubset(settings.slides, STYLE_SLIDE_KEYS)
  };
}

function slugifyStyleSet(label, existingIds = []){
  const base = (label || 'palette').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'palette';
  const set = new Set(existingIds);
  let slug = base;
  let i = 2;
  while (set.has(slug)){
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

function applyStyleSet(settings, id){
  const sets = ensureStyleSets(settings);
  const entry = sets[id];
  if (!entry) return false;
  if (entry.theme && typeof entry.theme === 'object'){
    settings.theme = { ...(settings.theme || {}), ...cloneSubset(entry.theme, STYLE_THEME_KEYS) };
  }
  if (entry.fonts && typeof entry.fonts === 'object'){
    settings.fonts = { ...(settings.fonts || {}), ...cloneSubset(entry.fonts, STYLE_FONT_KEYS) };
  }
  if (entry.slides && typeof entry.slides === 'object'){
    settings.slides = { ...(settings.slides || {}), ...cloneSubset(entry.slides, STYLE_SLIDE_KEYS) };
  }
  settings.slides.activeStyleSet = id;
  return true;
}

// ============================================================================
// 1) Wochentage / Presets
// ============================================================================
let activeDayKey = 'Mon';

// Exported getter to expose the currently active day
export function getActiveDayKey(){
  return activeDayKey;
}

function setActiveDay(key, { loadPreset = true } = {}){
  activeDayKey = key;
  localStorage.setItem('adminActiveDay', key);

  // Label + Pills-Active
  const lbl = $('#activeDayLabel');
  if (lbl) lbl.textContent = DAY_LABELS[key] || key;
  $$('.day-pills .day-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.key === key)
  );

  // Optional: Preset in den aktuellen Schedule laden
  const settings = ctx.getSettings();
  if (loadPreset && key !== 'Opt' && settings?.presets?.[key]) {
    const cloned = JSON.parse(JSON.stringify(settings.presets[key]));
    ctx.setSchedule(cloned);
    renderGridUI();
    renderSlidesMaster();
  } else {
    const empty = { saunas: ctx.getSchedule().saunas.slice(), rows: [] };
    ctx.setSchedule(empty);
    renderGridUI();
    renderSlidesMaster();
  }
}

function buildDayPills(hostId){
  const host = document.getElementById(hostId);
  if (!host) return;
  host.classList.add('day-pills');
  host.innerHTML = '';
  DAYS.forEach(([key, lab]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'day-btn';
    b.dataset.key = key;
    b.textContent = lab;
    b.onclick = () => setActiveDay(key, { loadPreset: true });
    host.appendChild(b);
  });
}

function initWeekdayUI(){
  buildDayPills('weekdayPills');
  buildDayPills('weekdayPills2');

  const settings = ctx.getSettings();
  const saved = localStorage.getItem('adminActiveDay');
  const initKey = (settings.presetAuto ? dayKeyToday() : (saved || 'Mon'));
  setActiveDay(initKey, { loadPreset: !!settings.presetAuto });

  const saveBtn = $('#btnSavePreset');
  if (saveBtn) saveBtn.onclick = () => {
    const s = ctx.getSettings();
    s.presets ||= {};
    s.presets[activeDayKey] = JSON.parse(JSON.stringify(ctx.getSchedule()));
    localStorage.setItem('settingsDraft', JSON.stringify(ctx.getSettings()));
    if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();

    alert('Wochentag gespeichert: ' + (DAY_LABELS[activeDayKey] || activeDayKey));
  };
}

// ============================================================================
// 2) Helpers: Saunen / Inventar / Entfernen
// ============================================================================
function getAllSaunas(){
  const settings = ctx.getSettings();
  const schedule = ctx.getSchedule();

  // Namen aus Presets einsammeln
  const fromPresets = new Set();
  const P = settings?.presets || {};
  Object.values(P).forEach(ps => (ps?.saunas || []).forEach(n => fromPresets.add(n)));

  // Merge: Einstellungen, aktueller Tag, Presets
  const all = new Set(settings.allSaunas || []);
  (schedule.saunas || []).forEach(n => all.add(n));
  fromPresets.forEach(n => all.add(n));

  settings.allSaunas = Array.from(all).sort((a,b)=> a.localeCompare(b,'de'));
  return settings.allSaunas;
}

function removeSaunaColumnFromSchedule(sc, name){
  if (!sc || !Array.isArray(sc.saunas)) return;
  const idx = sc.saunas.indexOf(name);
  if (idx === -1) return;
  sc.saunas.splice(idx, 1);
  (sc.rows || []).forEach(r => {
    if (Array.isArray(r.entries)) r.entries.splice(idx, 1);
  });
}

function deleteSaunaEverywhere(name){
  const settings = ctx.getSettings();
  const schedule = ctx.getSchedule();

  // 1) Inventar
  settings.allSaunas = (settings.allSaunas || []).filter(n => n !== name);

  // 2) Aktueller Tag
  removeSaunaColumnFromSchedule(schedule, name);

  // 3) Presets
  const P = settings.presets || {};
  Object.keys(P).forEach(k => removeSaunaColumnFromSchedule(P[k] || {}, name));

  // 4) Assets (Bild rechts)
  if (settings.assets?.rightImages && settings.assets.rightImages[name]){
    delete settings.assets.rightImages[name];
  }

  // 5) Per-Sauna-Dauern
  if (settings.slides?.saunaDurations && settings.slides.saunaDurations[name] != null){
    delete settings.slides.saunaDurations[name];
  }

  // 6) Sichtbarkeit
  if (settings.slides?.hiddenSaunas){
    settings.slides.hiddenSaunas = settings.slides.hiddenSaunas.filter(n => n !== name);
  }

  renderSlidesMaster();
  renderGridUI();
}

function renameSaunaEverywhere(oldName, newName){
  const settings = ctx.getSettings();

  // Inventar
  const inv = new Set(settings.allSaunas || []);
  if (inv.has(oldName)) inv.delete(oldName);
  inv.add(newName);
  settings.allSaunas = Array.from(inv).sort((a,b)=> a.localeCompare(b,'de'));

  // Presets: saunas[] direkt ersetzen (Spaltenindex bleibt erhalten)
  const P = settings.presets || {};
  Object.values(P).forEach(ps=>{
    if (!ps || !Array.isArray(ps.saunas)) return;
    const idx = ps.saunas.indexOf(oldName);
    if (idx !== -1){
      ps.saunas[idx] = newName;
      // rows/entries unverändert (Spalte bleibt dieselbe)
    }
  });

  // Assets (rechtes Bild)
  if (settings.assets?.rightImages && (oldName in settings.assets.rightImages)){
    const val = settings.assets.rightImages[oldName];
    delete settings.assets.rightImages[oldName];
    settings.assets.rightImages[newName] = val;
  }

  // Per-Sauna-Dauern
  if (settings.slides?.saunaDurations && (oldName in settings.slides.saunaDurations)){
    settings.slides.saunaDurations[newName] = settings.slides.saunaDurations[oldName];
    delete settings.slides.saunaDurations[oldName];
  }

  // Sichtbarkeit
  if (settings.slides?.hiddenSaunas){
    settings.slides.hiddenSaunas = settings.slides.hiddenSaunas.map(n => n===oldName ? newName : n);
  }

}

function addSaunaToActive(name){
  const schedule = ctx.getSchedule();
  if (!name) return;
  if ((schedule.saunas || []).includes(name)) return;
  schedule.saunas.push(name);
  schedule.rows.forEach(r => r.entries.push(null));
  renderSlidesMaster();
  renderGridUI();
}

function removeSaunaFromActive(name){
  const schedule = ctx.getSchedule();
  const idx = (schedule.saunas || []).indexOf(name);
  if (idx === -1) return;
  if (!confirm(`Sauna "${name}" für ${DAY_LABELS[activeDayKey] || activeDayKey} auf „Kein Aufguss“ verschieben?\nDie Spalte wird gelöscht.`)) return;
  schedule.saunas.splice(idx,1);
  schedule.rows.forEach(r => r.entries.splice(idx,1));
  renderSlidesMaster();
  renderGridUI();
}

// Für Markierungen der „Kein Aufguss“-Liste
function computePresetSaunaDays(){
  const settings = ctx.getSettings();
  const map = new Map();
  const P = settings?.presets || {};
  const days = DAYS.filter(d => d[0] !== 'Opt'); // nur echte Wochentage
  for (const [key, label] of days) {
    const sc = P[key];
    const list = Array.isArray(sc?.saunas) ? sc.saunas : [];
    for (const name of list) {
      const arr = map.get(name) || [];
      if (!arr.includes(label)) arr.push(label);
      map.set(name, arr);
    }
  }
  return map;
}

// ============================================================================
// 3) UI-Bausteine: Übersicht-Row & Sauna-Row
// ============================================================================
function overviewRowRender(){
  const settings = ctx.getSettings();
  const perMode  = (settings.slides?.durationMode === 'per');

  const wrap = document.createElement('div');
  wrap.className = 'saunarow overview';
wrap.innerHTML = `
  <div style="font-weight:600">Übersicht</div>
  <canvas id="ovPrev" class="prev"></canvas>
  ${perMode ? '<input id="ovSec" class="input num3 intSec" type="number" min="1" max="120" step="1" />' : ''}
  <span></span><span></span><span></span>
  <input id="ovShow" type="checkbox" />
`;

  const ovSecEl  = wrap.querySelector('#ovSec');
  const ovShowEl = wrap.querySelector('#ovShow');

  if (ovSecEl){
    ovSecEl.value = settings.slides?.overviewDurationSec ?? 10;
    ovSecEl.onchange = ()=>{
      (settings.slides ||= {});
      settings.slides.overviewDurationSec = Math.max(1, Math.min(120, +ovSecEl.value||10));
    };
  }
  if (ovShowEl){
    ovShowEl.checked = (settings.slides?.showOverview !== false);
    ovShowEl.onchange = ()=>{
      (settings.slides ||= {});
      settings.slides.showOverview = !!ovShowEl.checked;
    };
  }

  // NEU: Canvas zeichnen
  const canvas = wrap.querySelector('#ovPrev');
  if (canvas) drawOverviewPreview(canvas);

  return wrap;
}

function drawOverviewPreview(canvas){
  // Größe dynamisch an die Sauna-Previews angleichen
  const ref = document.querySelector('#saunaList .saunarow .prev');
  const refStyle = ref ? getComputedStyle(ref) : null;
  const cssW = ref ? Math.max(80, parseInt(refStyle.width)  || ref.clientWidth  || 160) : 160;
  const cssH = ref ? Math.max(50, parseInt(refStyle.height) || ref.clientHeight || 90)  : 90;

  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width  = cssW * DPR;
  canvas.height = cssH * DPR;
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const g = canvas.getContext('2d');
  g.setTransform(DPR,0,0,DPR,0,0);

  const settings = ctx.getSettings();
  const schedule = ctx.getSchedule() || {};
  const saunas = Array.isArray(schedule.saunas) ? schedule.saunas : [];
  const rows   = Array.isArray(schedule.rows) ? schedule.rows : [];

  const T = settings.theme || {};
  const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const val = (k, v, d) => (T[k] || css(v) || d);

  const colGrid  = val('gridTable',  '--gridTable',  '#374151');
  const wGrid    = Number.isFinite(+T.gridTableW) ? +T.gridTableW : 2;
  const headBg   = val('headRowBg',  '--headRowBg',  '#111827');
  const headFg   = val('headRowFg',  '--headRowFg',  '#e5e7eb');
  const z1       = val('zebra1',     '--zebra1',     '#0f1629');
  const z2       = val('zebra2',     '--zebra2',     '#0d1426');
  const tz1      = val('timeZebra1', '--timeZebra1', '#0e162b');
  const tz2      = val('timeZebra2', '--timeZebra2', '#0c1324');
  const cornerBg = val('cornerBg',   '--cornerBg',   '#0d1426');
  const cornerFg = val('cornerFg',   '--cornerFg',   '#9ca3af');

  const cols = Math.max(2, 1 + saunas.length);
  const rws  = Math.max(2, 1 + rows.length);
  const cellW = Math.floor(cssW / cols);
  const cellH = Math.floor(cssH / rws);

  g.clearRect(0,0,cssW,cssH);

  // Kopf
  g.fillStyle = cornerBg; g.fillRect(0,0,cellW,cellH);
  g.fillStyle = headBg;   g.fillRect(cellW,0, cssW-cellW, cellH);
  g.fillStyle = cornerFg; g.font = '600 10px system-ui, sans-serif';
  g.textBaseline = 'middle'; g.textAlign = 'start';
  g.fillText('Zeit', 6, cellH/2);

  g.fillStyle = headFg; g.font = '600 9px system-ui, sans-serif';
  saunas.slice(0, 20).forEach((name, i)=>{
    const x = cellW + i*cellW + 6;
    g.fillText(String(name).slice(0,10), x, cellH/2);
  });

  // Inhalt
  for (let r=1; r<rws; r++){
    const y = r*cellH;
    g.fillStyle = (r%2 ? tz1 : tz2); g.fillRect(0,y, cellW, cellH);
    g.fillStyle = (r%2 ? z1  : z2 ); g.fillRect(cellW,y, cssW-cellW, cellH);
  }

  // Raster
  g.strokeStyle = colGrid;
  g.lineWidth = Math.max(1, Math.min(3, wGrid));
  g.beginPath();
  for (let c=0; c<=cols; c++){ const x = Math.min(cssW-0.5, c*cellW); g.moveTo(x, 0); g.lineTo(x, rws*cellH); }
  for (let r=0; r<=rws; r++){ const y = Math.min(cssH-0.5, r*cellH); g.moveTo(0, y); g.lineTo(cols*cellW, y); }
  g.stroke();

  if (saunas.length === 0 || rows.length === 0){
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.font = '700 18px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Plan', cssW/2, cssH/2);
  }
}

function saunaRow({ name, index = null, mode = 'normal', dayLabels = [] }){
  const settings = ctx.getSettings();
  const id = 'sx_' + Math.random().toString(36).slice(2,8);

  const wrap = document.createElement('div');
  wrap.className = 'saunarow' + (mode !== 'normal' ? ' sauna-ghost' : '');

  // Name-Bereich (mit Escaping!)
  const safeName = escapeHtml(name || '');
  const namePart = (() => {
    if (mode === 'normal') {
      return `<input id="n_${id}" class="input name" type="text" value="${safeName}" />`;
    }
    const tag = (mode === 'ghost') ? '<span class="tag ghosttag">Preset</span>' : '';
    const pills = (Array.isArray(dayLabels) && dayLabels.length && mode === 'extra')
      ? `<div class="pills">${dayLabels.map(d => `<span class="pill">${escapeHtml(d)}</span>`).join('')}</div>` : '';
    return `<div class="namewrap">
      <input id="n_${id}" class="input name" type="text" value="${safeName}" disabled />
      ${tag}${pills}
    </div>`;
  })();

  wrap.innerHTML = `
    ${namePart}
    <img id="p_${id}" class="prev" alt="" title=""/>
    <input id="sec_${id}" class="input num3 intSec" type="number" min="1" max="60" step="1" />
    <button class="btn sm ghost icon" id="f_${id}" title="Upload">⤴︎</button>
    <button class="btn sm ghost icon" id="d_${id}" title="Default">⟳</button>
    ${
      mode === 'normal'
        ? `<button class="btn sm ghost icon" id="x_${id}" title="Kein Aufguss (Spalte für diesen Tag entfernen)">✕</button>`
        : `<div class="row" style="gap:6px">
             <button class="btn sm ghost icon" id="mv_${id}" title="Zu Aufguss hinzufügen">➕</button>
             <button class="btn sm ghost icon" id="delinv_${id}" title="Dauerhaft löschen">🗑</button>
           </div>`
    }
    ${ mode === 'normal' ? `<input id="en_${id}" type="checkbox" checked />` : `<span></span>` }
  `;

  // DOM-Refs
  const $name   = wrap.querySelector('#n_'+id);
  const $img    = wrap.querySelector('#p_'+id);
  const $sec    = wrap.querySelector('#sec_'+id);
  const $up     = wrap.querySelector('#f_'+id);
  const $def    = wrap.querySelector('#d_'+id);
  const $del    = wrap.querySelector('#x_'+id);
  const $mv     = wrap.querySelector('#mv_'+id);
  const $delinv = wrap.querySelector('#delinv_'+id);
  const $en     = wrap.querySelector('#en_'+id);

  // Bild-Preview
  const url = (settings.assets?.rightImages?.[name]) || '';
  if (url){
    preloadImg(url).then(r => { if (r.ok){ $img.src = url; $img.title = `${r.w}×${r.h}`; } });
  }

  // Dauer pro Sauna
  const per = (settings.slides?.durationMode === 'per');
  const perMap = settings.slides?.saunaDurations || {};
  if ($sec){
    $sec.disabled = !per;
    $sec.style.display = per ? '' : 'none';
    $sec.value = Number.isFinite(+perMap[name]) ? perMap[name]
               : (settings.slides?.globalDwellSec ?? settings.slides?.saunaDurationSec ?? 6);
    $sec.onchange = () => {
      settings.slides ||= {}; settings.slides.saunaDurations ||= {};
      settings.slides.saunaDurations[name] = Math.max(1, Math.min(60, +$sec.value || 6));
    };
  }

  // Sichtbarkeit
  if ($en){
    const hidden = new Set(settings.slides?.hiddenSaunas || []);
    $en.checked = !hidden.has(name);
    $en.onchange = () => {
      const set = new Set(settings.slides?.hiddenSaunas || []);
      if ($en.checked) set.delete(name); else set.add(name);
      settings.slides ||= {}; settings.slides.hiddenSaunas = Array.from(set);
    };
  }

  // Upload
  if ($up){
    $up.onclick = () => {
      const fi = document.createElement('input'); fi.type='file'; fi.accept='image/*';
      fi.onchange = () => uploadGeneric(fi, (p) => {
        settings.assets ||= {}; settings.assets.rightImages ||= {};
        const prevRight = (settings.assets.rightImages[name] || '').trim();
        const newUrl = (typeof p === 'string') ? p.trim() : '';
        settings.assets.rightImages[name] = newUrl;

        const previewUrl = newUrl || p;
        preloadImg(previewUrl).then(r => {
          if (r.ok && previewUrl) { $img.src = previewUrl; $img.title = `${r.w}×${r.h}`; }
          else { $img.removeAttribute('src'); $img.removeAttribute('title'); }
        });
        if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
        if (ctx && typeof ctx.refreshSlidesBox === 'function') ctx.refreshSlidesBox();
      });
      fi.click();
    };
  }

  // Default-Bild
  if ($def){
$def.onclick = () => {
  if (!confirm('Zuordnung entfernen und Standardbild verwenden?\n\nDas individuelle Bild wird gelöscht.')) return;

  (settings.assets ||= {}); (settings.assets.rightImages ||= {});
  // Eintrag wirklich entfernen:
  delete settings.assets.rightImages[name];

  // Preview auf Default (optional) – oder ganz leeren:
  $img.src = '/assets/img/right_default.svg';
  $img.title = '';
};
  }

  // Entfernen/Bewegen/Löschen
  if ($del)    $del.onclick    = () => removeSaunaFromActive(name);
  if ($mv)     $mv.onclick     = () => addSaunaToActive(name);
  if ($delinv) $delinv.onclick = () => {
    const txt = prompt(
      `Sauna „${name}“ dauerhaft löschen?\n\n`+
      `Dies entfernt sie aus dem Inventar, aus dem aktuellen Tag, aus allen Presets,\n`+
      `löscht Bildzuweisungen, Dauer-Einträge und Verweise.\n\n`+
      `Zum Bestätigen bitte genau "Ja" eingeben:`,
      ''
    );
    if ((txt || '').trim() !== 'Ja') return;
    deleteSaunaEverywhere(name);
  };

  // Umbenennen (normal mode)
if ($name && mode === 'normal') {
  $name.addEventListener('change', ()=>{
    const schedule = ctx.getSchedule();
    const old = name;
    const newName = ($name.value || '').trim();

    // validieren
    if (!newName){ $name.value = old; return; }
    if (newName === old) return;

    // Duplikate im aktuellen Tag verhindern
    const existsIdx = (schedule.saunas||[]).findIndex((n,i)=> n===newName && i!==index);
    if (existsIdx !== -1){
      alert('Es existiert bereits eine Sauna mit diesem Namen am aktuellen Tag.');
      $name.value = old;
      return;
    }

    // tatsächliches Umbenennen
    schedule.saunas[index] = newName;
    renameSaunaEverywhere(old, newName);

    // UI aktualisieren
    renderSlidesMaster();
    renderGridUI();
  });
}

  return wrap;
}

const saunaExtraRow = (name, dayLabels) =>
  saunaRow({ name, mode:'extra', dayLabels: dayLabels || [] });

// ============================================================================
// 4) Drag & Drop
// ============================================================================
function makeRowDraggable(el, name, src){
  if (!el) return;
  el.setAttribute('draggable','true');
  el.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/sauna', name);
    e.dataTransfer.setData('text/src', src); // 'on' oder 'off'
  });
}
function applyDnD(){
  const onHost  = $('#saunaList');
  const offHost = $('#extraSaunaList');
  [onHost, offHost].forEach(h => {
    if (!h) return;
    h.addEventListener('dragover', e => { e.preventDefault(); h.classList.add('drag-over'); });
    h.addEventListener('dragleave', () => h.classList.remove('drag-over'));
    h.addEventListener('drop', e => {
      e.preventDefault(); h.classList.remove('drag-over');
      const name = e.dataTransfer.getData('text/sauna');
      const src  = e.dataTransfer.getData('text/src');
      if (!name) return;
      if (h === onHost  && src !== 'on')  addSaunaToActive(name);
      if (h === offHost && src !== 'off') removeSaunaFromActive(name);
    });
  });
}

function enableSaunaOrder(){
  const host = $('#saunaList');
  if (!host) return;
  let dragIdx = null;

  if (!host.dataset.orderBound){
    host.addEventListener('dragstart', e => {
      const row = e.target.closest('.saunarow');
      if (!row) return;
      dragIdx = Array.from(host.children).indexOf(row);
      e.dataTransfer.effectAllowed = 'move';
    });

    host.addEventListener('dragover', e => {
      if (e.target.closest('.saunarow')) e.preventDefault();
    });

    host.addEventListener('drop', e => {
      const row = e.target.closest('.saunarow');
      if (!row) return;
      e.preventDefault();
      const rows = Array.from(host.children);
      const dropIdx = rows.indexOf(row);
      if (dropIdx === -1 || dragIdx === null || dragIdx === dropIdx) return;
      const schedule = ctx.getSchedule();
      const settings = ctx.getSettings();
      const arr = schedule.saunas || [];
      const [m] = arr.splice(dragIdx,1);
      arr.splice(dropIdx,0,m);
      settings.slides ||= {};
      settings.slides.order = arr.slice();
      renderSlidesMaster();
      renderGridUI();
      dragIdx = null;
    });

    host.dataset.orderBound = '1';
  }
}

// ============================================================================
// 5) „Kein Aufguss“ / Inventar
// ============================================================================
function renderSaunaOffList(){
  const schedule = ctx.getSchedule();
  const all = getAllSaunas();
  const activeSet = new Set(schedule.saunas || []);
  const off = all.filter(n => !activeSet.has(n));

  const extraTitle = $('#extraTitle');
  const host = $('#extraSaunaList');
  if (!host) return;
  host.innerHTML = '';

  const presentMap = computePresetSaunaDays(); // Map name -> ['Mo','Di',...]

  off.forEach(name => {
    const pills = presentMap.get(name) || [];
    const row = saunaExtraRow(name, pills);
    row.title = 'Ziehen, um zu „Aufguss“ hinzuzufügen';
    makeRowDraggable(row, name, 'off');
    host.appendChild(row);
  });

  if (extraTitle) extraTitle.style.display = off.length ? '' : 'none';
}

// ============================================================================
// 6) Interstitial Media (Medien-Slides)
// ============================================================================
function interRow(i){
  const settings = ctx.getSettings();
  const it = settings.interstitials[i];
  const id = 'inter_' + i;

  const wrap = document.createElement('div');
  wrap.className = 'mediarow';
  wrap.innerHTML = `
    <input id="n_${id}" class="input name" type="text" value="${escapeHtml(it.name || '')}" />
    <select id="t_${id}" class="input sel-type">
      <option value="image">Bild</option>
      <option value="video">Video</option>
      <option value="url">URL</option>
    </select>
    <img id="p_${id}" class="prev" alt="" title=""/>
    <input id="sec_${id}" class="input num3 dur intSec" type="number" min="1" max="60" step="1" />
    <span id="m_${id}" class="media-field"></span>
    <button class="btn sm ghost icon" id="x_${id}" title="Entfernen">✕</button>
    <input id="en_${id}" type="checkbox" />
  `;

  const $name  = wrap.querySelector('#n_'+id);
  const $type  = wrap.querySelector('#t_'+id);
  const $prev  = wrap.querySelector('#p_'+id);
  const $sec   = wrap.querySelector('#sec_'+id);
  const $media = wrap.querySelector('#m_'+id);
  const $del   = wrap.querySelector('#x_'+id);
  const $en    = wrap.querySelector('#en_'+id);

  if ($prev) $prev.onclick = () => {
    if ($type?.value !== 'video' && $type?.value !== 'url') return;
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.onchange = () => uploadGeneric(fi, (p) => {
      if (!p) return;
      const ts = Date.now();
      const addV = (u) => {
        const clean = stripCache(u);
        return clean + (clean.includes('?') ? '&' : '?') + 'v=' + ts;
      };
      it.thumb = addV(p);
      updatePrev(it.thumb);
      renderSlidesMaster();
    });
    fi.click();
  };

  // Werte
  if ($type) $type.value = it.type || 'image';
  if ($en) $en.checked = !!it.enabled;
  if ($sec){
    $sec.value = Number.isFinite(+it.dwellSec)
      ? +it.dwellSec
      : (ctx.getSettings().slides?.imageDurationSec ?? ctx.getSettings().slides?.saunaDurationSec ?? 6);
  }

  const FALLBACK_THUMB = '/assets/img/thumb_fallback.svg';
  const stripCache = (u = '') => u.split('?')[0];
  const updatePrev = (src) => {
    if (!src){ $prev.src = FALLBACK_THUMB; $prev.title = ''; return; }
    src = stripCache(src);
    if (src === FALLBACK_THUMB){ $prev.src = FALLBACK_THUMB; $prev.title=''; return; }
    const url = src + '?v=' + Date.now();
    preloadImg(url).then(r => {
      if (r.ok){ $prev.src = url; $prev.title = `${r.w}×${r.h}`; }
      else { $prev.src = FALLBACK_THUMB; $prev.title = ''; it.thumb = FALLBACK_THUMB; }
    });
  };
  updatePrev(it.thumb);

  // Uniform-Mode blendet Dauer-Feld aus
  const uniform = (ctx.getSettings().slides?.durationMode !== 'per');
  if ($sec) $sec.style.display = uniform ? 'none' : '';

  const renderMediaField = () => {
    if (!$media) return;
    $media.innerHTML = '';
    const t = $type?.value || 'image';
    if (t === 'image' || t === 'video'){
      const mb = document.createElement('button');
      mb.className = 'btn sm ghost icon';
      mb.title = 'Datei hochladen';
      mb.textContent = '⤴︎';
      mb.onclick = () => {
        const fi = document.createElement('input');
        fi.type = 'file';
        fi.accept = (t === 'video') ? 'video/*' : 'image/*';
        fi.onchange = () => uploadGeneric(fi, (p, tp) => {
          const ts = Date.now();
          const addV = (u) => {
            const clean = stripCache(u);
            return clean + (clean.includes('?') ? '&' : '?') + 'v=' + ts;
          };
          it.url   = addV(p);
          it.thumb = addV(tp || p || FALLBACK_THUMB);
          updatePrev(it.thumb);
          renderSlidesMaster();
        });
        fi.click();
      };
      $media.appendChild(mb);
    } else if (t === 'url'){
      const mb = document.createElement('button');
      mb.className = 'btn sm ghost icon';
      mb.textContent = '🔗';
      mb.title = 'URL';
      mb.onclick = () => {
        const val = prompt('URL:', it.url ? stripCache(it.url) : '');
        if (val !== null) {
          it.url = stripCache(val.trim());
          if (it.url) {
            try {
              const origin = new URL(it.url).origin;
              it.thumb = `${origin}/favicon.ico`;
            } catch {
              it.thumb = FALLBACK_THUMB;
            }
            updatePrev(it.thumb);
          } else {
            it.thumb = FALLBACK_THUMB;
            updatePrev(FALLBACK_THUMB);
          }
          renderSlidesMaster();
        }
      };
      $media.appendChild(mb);
    }
  };

  renderMediaField();

  // Events
  if ($name)  $name.onchange  = () => { it.name = ($name.value || '').trim(); renderSlidesMaster(); };
  if ($type)  $type.onchange  = () => {
    it.type = $type.value;
    it.url = '';
    it.thumb = '';
    updatePrev('');
    renderMediaField();
    renderSlidesMaster();
  };

  if ($en)  $en.onchange  = () => { it.enabled = !!$en.checked; };
  if ($sec) $sec.onchange = () => { it.dwellSec = Math.max(1, Math.min(60, +$sec.value || 6)); };

  if ($del) $del.onclick = () => { ctx.getSettings().interstitials.splice(i,1); renderSlidesMaster(); };

  return wrap;
}

function renderInterstitialsPanel(hostId='interList2'){
  const settings = ctx.getSettings();
  const list = Array.isArray(settings.interstitials) ? settings.interstitials : [];
  settings.interstitials = list.map(it => {
    const { after, afterRef, ...rest } = it || {};
    return ({ type:'image', thumb:'', ...rest });
  });

  const host = document.getElementById(hostId);
  if (!host) return;

  host.innerHTML = '';
  settings.interstitials.forEach((_, i) => host.appendChild(interRow(i)));

  const add = document.getElementById('btnMediaAdd');
  if (add) add.onclick = () => {
    (settings.interstitials ||= []).push({
      id:'im_'+Math.random().toString(36).slice(2,9),
      name:'',
      enabled:true,
      type:'image',
      url:'',
      thumb:'',
      dwellSec:6
    });
    renderSlidesMaster();
  };
}

// ============================================================================
// 6c) Story Slides
// ============================================================================

const FALLBACK_HERO = '/assets/img/thumb_fallback.svg';
const stripCacheSimple = (u = '') => u.split('?')[0];

function ensureStorySlides(settings){
  settings.slides ||= {};
  let list = Array.isArray(settings.slides.storySlides) ? settings.slides.storySlides : [];
  list = list.filter(item => item && typeof item === 'object');
  list.forEach((story) => {
    if (!story.id) story.id = 'story_' + Math.random().toString(36).slice(2, 9);
    if (!Array.isArray(story.faq)) story.faq = [];
    if (Array.isArray(story.saunaRefs) && !Array.isArray(story.saunas)) {
      story.saunas = story.saunaRefs.slice();
    }
    if (!Array.isArray(story.saunas)) story.saunas = [];
    story.enabled = (story.enabled === false) ? false : true;
    story.heroUrl = typeof story.heroUrl === 'string' ? story.heroUrl : '';
    story.heroAlt = typeof story.heroAlt === 'string' ? story.heroAlt : '';
    story.intro = typeof story.intro === 'string' ? story.intro : '';
    story.ritual = typeof story.ritual === 'string' ? story.ritual : '';
    story.tips = typeof story.tips === 'string' ? story.tips : '';

    const ensureSectionId = () => 'story_sec_' + Math.random().toString(36).slice(2, 9);
    const normalizeSection = (section = {}, { defaultFullImage = false } = {}) => {
      if (section && typeof section === 'string') {
        return {
          id: ensureSectionId(),
          heading: '',
          body: String(section || '').trim(),
          imageUrl: '',
          imageAlt: '',
          fullImage: !!defaultFullImage
        };
      }
      const src = (section && typeof section === 'object') ? section : {};
      let id = src.id != null ? String(src.id) : '';
      if (!id) id = ensureSectionId();
      const heading = typeof src.heading === 'string'
        ? src.heading
        : (typeof src.title === 'string' ? src.title : '');
      const body = typeof src.body === 'string'
        ? src.body
        : (typeof src.text === 'string' ? src.text : '');
      let imageUrl = typeof src.imageUrl === 'string'
        ? src.imageUrl
        : (typeof src.url === 'string' ? src.url
          : (typeof src.mediaUrl === 'string' ? src.mediaUrl : ''));
      if (!imageUrl && src.image && typeof src.image === 'string') {
        imageUrl = src.image;
      } else if (!imageUrl && src.image && typeof src.image.url === 'string') {
        imageUrl = src.image.url;
      }
      let imageAlt = typeof src.imageAlt === 'string'
        ? src.imageAlt
        : (typeof src.alt === 'string' ? src.alt : '');
      if (!imageAlt && src.image && typeof src.image.alt === 'string') {
        imageAlt = src.image.alt;
      }
      const fullImage = src.fullImage === true
        || src.full === true
        || src.onlyImage === true
        || src.layout === 'full'
        || (!!defaultFullImage && src.fullImage !== false);
      return {
        id,
        heading: String(heading || '').trim(),
        body: String(body || '').trim(),
        imageUrl: String(imageUrl || '').trim(),
        imageAlt: String(imageAlt || '').trim(),
        fullImage: !!fullImage
      };
    };

    const columnsSrc = (story.columns && typeof story.columns === 'object') ? story.columns : {};
    let left = Array.isArray(columnsSrc.left) ? columnsSrc.left.map(entry => normalizeSection(entry)) : [];
    let right = Array.isArray(columnsSrc.right) ? columnsSrc.right.map(entry => normalizeSection(entry)) : [];

    if (!left.length) {
      const legacySections = Array.isArray(story.sections) ? story.sections : [];
      left = legacySections.map(entry => normalizeSection({ ...entry }));
    }

    if (!right.length) {
      const legacyGallery = Array.isArray(story.gallery) ? story.gallery : [];
      right = legacyGallery
        .map(entry => {
          if (!entry) return null;
          if (typeof entry === 'string') {
            return normalizeSection({ imageUrl: entry }, { defaultFullImage: true });
          }
          const imageUrl = entry.url ?? entry.imageUrl ?? '';
          const imageAlt = entry.alt ?? entry.imageAlt ?? '';
          const heading = entry.caption ?? entry.title ?? '';
          return normalizeSection({
            id: entry.id,
            heading,
            body: '',
            imageUrl,
            imageAlt,
            fullImage: true
          }, { defaultFullImage: true });
        })
        .filter(Boolean);
    }

    story.columns = {
      left,
      right
    };

    const layoutRaw = typeof story.layout === 'string' ? story.layout : '';
    let layout = (layoutRaw === 'double') ? 'double' : 'single';
    if (layout !== 'double' && right.length) layout = 'double';
    story.layout = layout;

    story.heading = typeof story.heading === 'string' ? story.heading.trim() : '';
    const legacyTitle = typeof story.title === 'string' ? story.title.trim() : '';
    if (!story.heading && legacyTitle) story.heading = legacyTitle;
    story.title = story.heading || legacyTitle;

    story.sections = left.map(section => ({
      id: section.id,
      title: section.heading,
      text: section.body,
      imageUrl: section.imageUrl,
      imageAlt: section.imageAlt,
      imageCaption: section.fullImage ? section.heading || '' : ''
    }));

    story.gallery = right
      .filter(section => section.imageUrl)
      .map(section => ({
        id: section.id,
        url: section.imageUrl,
        alt: section.imageAlt,
        caption: section.heading || section.body || ''
      }));
  });
  settings.slides.storySlides = list;
  return settings.slides.storySlides;
}

function storyDefaults(){
  return {
    id: 'story_' + Math.random().toString(36).slice(2, 9),
    heading: '',
    title: '',
    layout: 'single',
    columns: { left: [], right: [] },
    heroUrl: '',
    heroAlt: '',
    saunas: [],
    intro: '',
    ritual: '',
    tips: '',
    sections: [],
    gallery: [],
    faq: [],
    enabled: true
  };
}

function storyEditor(story, idx){
  const settings = ctx.getSettings();
  const wrap = document.createElement('div');
  wrap.className = 'story-editor fieldset';

  const legend = document.createElement('div');
  legend.className = 'legend';
  const legendTitle = String(story.heading || story.title || '').trim();
  legend.textContent = legendTitle ? `Information: ${legendTitle}` : 'Neue Information';
  if (story.enabled === false) legend.textContent += ' (deaktiviert)';
  wrap.appendChild(legend);

  const header = document.createElement('div');
  header.className = 'row story-editor-head';
  header.style.gap = '8px';
  header.style.flexWrap = 'wrap';

  const headingInput = document.createElement('input');
  headingInput.type = 'text';
  headingInput.className = 'input';
  headingInput.placeholder = 'Überschrift (H1)';
  headingInput.value = story.heading || story.title || '';
  headingInput.onchange = () => {
    const value = headingInput.value.trim();
    story.heading = value;
    story.title = value;
    renderSlidesMaster();
  };
  header.appendChild(headingInput);

  const layoutWrap = document.createElement('div');
  layoutWrap.className = 'row story-layout-toggle';
  layoutWrap.style.gap = '6px';
  const layoutLabel = document.createElement('span');
  layoutLabel.className = 'mut';
  layoutLabel.textContent = 'Layout';
  layoutWrap.appendChild(layoutLabel);
  const layoutOptions = [
    { value: 'single', label: 'Einspaltig' },
    { value: 'double', label: 'Zweispaltig' }
  ];
  layoutOptions.forEach(option => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn sm ghost';
    btn.textContent = option.label;
    btn.classList.toggle('is-active', story.layout === option.value);
    btn.onclick = () => {
      if (story.layout === option.value) return;
      story.layout = option.value;
      renderSlidesMaster();
    };
    layoutWrap.appendChild(btn);
  });
  header.appendChild(layoutWrap);

  const enabledLabel = document.createElement('label');
  enabledLabel.className = 'btn sm ghost';
  enabledLabel.style.gap = '6px';
  const enabledInput = document.createElement('input');
  enabledInput.type = 'checkbox';
  enabledInput.checked = story.enabled !== false;
  enabledInput.onchange = () => { story.enabled = !!enabledInput.checked; renderSlidesMaster(); };
  enabledLabel.appendChild(enabledInput);
  enabledLabel.appendChild(document.createTextNode('Aktiv'));
  header.appendChild(enabledLabel);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn sm ghost icon';
  delBtn.title = 'Erklärung entfernen';
  delBtn.textContent = '✕';
  delBtn.onclick = () => {
    const arr = settings.slides.storySlides || [];
    arr.splice(idx, 1);
    if (Array.isArray(settings.slides.sortOrder)) {
      settings.slides.sortOrder = settings.slides.sortOrder.filter(entry => {
        if (!entry || entry.type !== 'story') return true;
        const id = String(entry.id ?? '');
        const sid = String(story.id ?? '');
        return id !== sid;
      });
    }
    renderSlidesMaster();
  };
  header.appendChild(delBtn);

  wrap.appendChild(header);

  const heroSection = document.createElement('div');
  heroSection.className = 'story-hero-editor';
  heroSection.style.display = 'grid';
  heroSection.style.gap = '8px';

  const heroRow = document.createElement('div');
  heroRow.className = 'row';
  heroRow.style.gap = '12px';
  heroRow.style.flexWrap = 'wrap';
  heroRow.style.alignItems = 'center';

  const heroPreview = document.createElement('img');
  heroPreview.className = 'story-hero-preview';
  heroPreview.style.maxWidth = '160px';
  heroPreview.style.height = '100px';
  heroPreview.style.objectFit = 'cover';
  heroPreview.style.borderRadius = '8px';
  heroPreview.alt = story.heroAlt || '';

  const updateHeroPreview = () => {
    if (story.heroUrl) {
      heroPreview.src = story.heroUrl;
      heroPreview.title = stripCacheSimple(story.heroUrl);
    } else {
      heroPreview.src = FALLBACK_HERO;
      heroPreview.title = 'Kein Bild ausgewählt';
    }
  };

  const heroBtnWrap = document.createElement('div');
  heroBtnWrap.className = 'row';
  heroBtnWrap.style.gap = '6px';

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.className = 'btn sm ghost';
  uploadBtn.textContent = 'Bild hochladen';
  uploadBtn.onclick = () => {
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/*';
    fi.onchange = () => uploadGeneric(fi, (url) => {
      const clean = stripCacheSimple(url || '');
      story.heroUrl = clean
        ? clean + (clean.includes('?') ? '&' : '?') + 'v=' + Date.now()
        : '';
      renderSlidesMaster();
    });
    fi.click();
  };
  heroBtnWrap.appendChild(uploadBtn);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn sm ghost';
  removeBtn.textContent = 'Bild entfernen';
  removeBtn.onclick = () => { story.heroUrl = ''; renderSlidesMaster(); };
  heroBtnWrap.appendChild(removeBtn);

  heroRow.appendChild(heroPreview);
  heroRow.appendChild(heroBtnWrap);
  heroSection.appendChild(heroRow);

  const altWrap = document.createElement('div');
  altWrap.className = 'kv';
  const altLabel = document.createElement('label');
  altLabel.textContent = 'Bildbeschreibung (Alt-Text)';
  const altInput = document.createElement('input');
  altInput.type = 'text';
  altInput.className = 'input';
  altInput.placeholder = 'Optional für Screenreader';
  altInput.value = story.heroAlt || '';
  altInput.onchange = () => { story.heroAlt = altInput.value.trim(); renderSlidesMaster(); };
  altWrap.appendChild(altLabel);
  altWrap.appendChild(altInput);
  heroSection.appendChild(altWrap);

  wrap.appendChild(heroSection);
  updateHeroPreview();

  const saunaWrap = document.createElement('div');
  saunaWrap.className = 'kv story-sauna-select';
  const saunaLabel = document.createElement('label');
  saunaLabel.textContent = 'Zugehörige Saunen';
  saunaWrap.appendChild(saunaLabel);
  const saunaList = document.createElement('div');
  saunaList.className = 'story-sauna-options';
  saunaList.style.display = 'flex';
  saunaList.style.flexWrap = 'wrap';
  saunaList.style.gap = '6px';

  const selected = new Set(Array.isArray(story.saunas) ? story.saunas : []);
  const saunas = getAllSaunas();
  if (saunas.length) {
    saunas.forEach(name => {
      const option = document.createElement('label');
      option.className = 'btn sm ghost story-sauna-option';
      option.style.gap = '4px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(name);
      cb.onchange = () => {
        const base = Array.isArray(story.saunas) ? story.saunas.slice() : [];
        const idxSel = base.indexOf(name);
        if (cb.checked && idxSel === -1) base.push(name);
        if (!cb.checked && idxSel !== -1) base.splice(idxSel, 1);
        story.saunas = base.sort((a, b) => a.localeCompare(b, 'de'));
        renderSlidesMaster();
      };
      option.appendChild(cb);
      option.appendChild(document.createTextNode(name));
      saunaList.appendChild(option);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'mut';
    empty.textContent = 'Noch keine Saunen im Inventar.';
    saunaList.appendChild(empty);
  }
  saunaWrap.appendChild(saunaList);
  wrap.appendChild(saunaWrap);

  const makeTextarea = (label, prop, rows = 3, placeholder = '') => {
    const kv = document.createElement('div');
    kv.className = 'kv';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    const ta = document.createElement('textarea');
    ta.className = 'input';
    ta.rows = rows;
    ta.placeholder = placeholder || label;
    ta.value = story[prop] || '';
    ta.onchange = () => { story[prop] = ta.value.trim(); renderSlidesMaster(); };
    kv.appendChild(lbl);
    kv.appendChild(ta);
    return kv;
  };

  wrap.appendChild(makeTextarea('Einführung', 'intro', 3, 'Hintergrund & Wirkung'));
  wrap.appendChild(makeTextarea('Ritual', 'ritual', 3, 'Ablauf oder Besonderheiten'));
  wrap.appendChild(makeTextarea('Tipps (je Zeile ein Tipp)', 'tips', 3, 'Tipps oder Hinweise'));

  const layoutHeader = document.createElement('div');
  layoutHeader.className = 'subh';
  layoutHeader.textContent = 'Abschnitte & Spalten';
  wrap.appendChild(layoutHeader);

  const layoutHelp = document.createElement('div');
  layoutHelp.className = 'help';
  layoutHelp.textContent = 'Spalten individuell mit Texten, Bildern und Specials befüllen.';
  wrap.appendChild(layoutHelp);

  const columnsWrap = document.createElement('div');
  columnsWrap.className = 'story-columns-editor';
  wrap.appendChild(columnsWrap);

  const ensureColumns = () => {
    if (!story.columns || typeof story.columns !== 'object') {
      story.columns = { left: [], right: [] };
    }
    if (!Array.isArray(story.columns.left)) story.columns.left = [];
    if (!Array.isArray(story.columns.right)) story.columns.right = [];
    return story.columns;
  };

  const createSectionDefaults = (_columnKey) => ({
    id: 'story_sec_' + Math.random().toString(36).slice(2, 9),
    heading: '',
    body: '',
    imageUrl: '',
    imageAlt: '',
    fullImage: false
  });

  const renderColumns = () => {
    const columns = ensureColumns();
    columnsWrap.innerHTML = '';

    const makeColumn = (columnKey, labelText) => {
      const columnWrap = document.createElement('div');
      columnWrap.className = 'story-column-card';
      columnWrap.dataset.column = columnKey;
      const isRight = columnKey === 'right';
      const isCollapsed = isRight && story.layout !== 'double';
      columnWrap.classList.toggle('is-collapsed', isCollapsed);

      const headRow = document.createElement('div');
      headRow.className = 'story-column-head';
      const title = document.createElement('div');
      title.className = 'story-column-title';
      title.textContent = labelText;
      headRow.appendChild(title);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn sm ghost';
      addBtn.textContent = 'Abschnitt hinzufügen';
      addBtn.onclick = () => {
        columns[columnKey].push(createSectionDefaults(columnKey));
        renderSlidesMaster();
      };
      headRow.appendChild(addBtn);
      columnWrap.appendChild(headRow);

      if (isCollapsed) {
        const note = document.createElement('div');
        note.className = 'story-column-placeholder';
        const count = columns[columnKey].length;
        note.textContent = count
          ? `Im einspaltigen Layout ausgeblendet (${count} Abschnitt${count === 1 ? '' : 'e'} hinterlegt).`
          : 'Im einspaltigen Layout ausgeblendet. Wechsle zu „Zweispaltig“, um Inhalte hinzuzufügen.';
        columnWrap.appendChild(note);
      }

      const list = document.createElement('div');
      list.className = 'story-section-list';
      columnWrap.appendChild(list);

      const arr = columns[columnKey];
      if (!arr.length) {
        const empty = document.createElement('div');
        empty.className = 'story-column-empty';
        empty.textContent = 'Noch keine Abschnitte angelegt.';
        list.appendChild(empty);
      } else {
        arr.forEach((section, sectionIdx) => {
          const card = document.createElement('div');
          card.className = 'story-section-card';
          card.classList.toggle('is-full-image', section.fullImage);

          const head = document.createElement('div');
          head.className = 'row story-section-card-head';
          head.style.alignItems = 'center';
          head.style.gap = '6px';

          const label = document.createElement('strong');
          label.className = 'story-section-card-title';
          label.textContent = section.heading?.trim() ? section.heading.trim() : `Abschnitt ${sectionIdx + 1}`;
          head.appendChild(label);

          const controls = document.createElement('div');
          controls.className = 'row story-section-card-controls';
          controls.style.gap = '4px';

          const move = (delta) => {
            const base = columns[columnKey];
            const nextIdx = sectionIdx + delta;
            if (nextIdx < 0 || nextIdx >= base.length) return;
            const [item] = base.splice(sectionIdx, 1);
            base.splice(nextIdx, 0, item);
            renderSlidesMaster();
          };

          const makeBtn = (labelTxt, titleTxt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn sm ghost icon';
            btn.textContent = labelTxt;
            btn.title = titleTxt;
            return btn;
          };

          const upBtn = makeBtn('↑', 'Nach oben verschieben');
          upBtn.onclick = () => move(-1);
          controls.appendChild(upBtn);

          const downBtn = makeBtn('↓', 'Nach unten verschieben');
          downBtn.onclick = () => move(1);
          controls.appendChild(downBtn);

          const removeBtn = makeBtn('✕', 'Abschnitt entfernen');
          removeBtn.onclick = () => {
            const base = columns[columnKey];
            base.splice(sectionIdx, 1);
            renderSlidesMaster();
          };
          controls.appendChild(removeBtn);

          head.appendChild(controls);
          card.appendChild(head);

          const mediaRow = document.createElement('div');
          mediaRow.className = 'row story-section-card-media';
          mediaRow.style.gap = '12px';
          mediaRow.style.flexWrap = 'wrap';
          mediaRow.style.alignItems = 'center';

          const preview = document.createElement('img');
          preview.className = 'story-section-card-preview';
          preview.alt = section.imageAlt || '';
          if (section.imageUrl) {
            preview.src = section.imageUrl;
            preview.title = stripCacheSimple(section.imageUrl);
          } else {
            preview.src = FALLBACK_HERO;
            preview.title = 'Kein Bild ausgewählt';
          }
          mediaRow.appendChild(preview);

          const mediaBtns = document.createElement('div');
          mediaBtns.className = 'row';
          mediaBtns.style.gap = '6px';

          const uploadBtn = document.createElement('button');
          uploadBtn.type = 'button';
          uploadBtn.className = 'btn sm ghost';
          uploadBtn.textContent = 'Bild hochladen';
          uploadBtn.onclick = () => {
            const fi = document.createElement('input');
            fi.type = 'file';
            fi.accept = 'image/*';
            fi.onchange = () => uploadGeneric(fi, (url) => {
              const clean = stripCacheSimple(url || '');
              section.imageUrl = clean
                ? clean + (clean.includes('?') ? '&' : '?') + 'v=' + Date.now()
                : '';
              renderSlidesMaster();
            });
            fi.click();
          };
          mediaBtns.appendChild(uploadBtn);

          const clearBtn = document.createElement('button');
          clearBtn.type = 'button';
          clearBtn.className = 'btn sm ghost';
          clearBtn.textContent = 'Bild entfernen';
          clearBtn.onclick = () => { section.imageUrl = ''; renderSlidesMaster(); };
          mediaBtns.appendChild(clearBtn);

          mediaRow.appendChild(mediaBtns);
          card.appendChild(mediaRow);

          const altWrap = document.createElement('div');
          altWrap.className = 'kv';
          const altLabel = document.createElement('label');
          altLabel.textContent = 'Bildbeschreibung (Alt-Text)';
          const altInput = document.createElement('input');
          altInput.type = 'text';
          altInput.className = 'input';
          altInput.placeholder = 'Optional für Screenreader';
          altInput.value = section.imageAlt || '';
          altInput.onchange = () => { section.imageAlt = altInput.value.trim(); renderSlidesMaster(); };
          altWrap.appendChild(altLabel);
          altWrap.appendChild(altInput);
          card.appendChild(altWrap);

          const headingWrap = document.createElement('div');
          headingWrap.className = 'kv';
          const headingLabel = document.createElement('label');
          headingLabel.textContent = 'Überschrift';
          const headingField = document.createElement('input');
          headingField.type = 'text';
          headingField.className = 'input';
          headingField.placeholder = columnKey === 'right' ? 'Optionale Überschrift' : 'Abschnittstitel';
          headingField.value = section.heading || '';
          headingField.disabled = (columnKey === 'right' && section.fullImage);
          headingField.onchange = () => { section.heading = headingField.value.trim(); renderSlidesMaster(); };
          headingWrap.appendChild(headingLabel);
          headingWrap.appendChild(headingField);
          card.appendChild(headingWrap);

          const bodyWrap = document.createElement('div');
          bodyWrap.className = 'kv';
          const bodyLabel = document.createElement('label');
          bodyLabel.textContent = 'Text';
          const bodyArea = document.createElement('textarea');
          bodyArea.className = 'input';
          bodyArea.rows = 3;
          bodyArea.placeholder = 'Inhalt';
          bodyArea.value = section.body || '';
          bodyArea.disabled = (columnKey === 'right' && section.fullImage);
          bodyArea.onchange = () => { section.body = bodyArea.value.trim(); renderSlidesMaster(); };
          bodyWrap.appendChild(bodyLabel);
          bodyWrap.appendChild(bodyArea);
          card.appendChild(bodyWrap);

          if (columnKey === 'right') {
            const toggleWrap = document.createElement('label');
            toggleWrap.className = 'story-fullimage-toggle';
            const toggle = document.createElement('input');
            toggle.type = 'checkbox';
            toggle.checked = !!section.fullImage;
            toggle.onchange = () => {
              section.fullImage = !!toggle.checked;
              renderSlidesMaster();
            };
            const toggleText = document.createElement('span');
            toggleText.textContent = 'Nur großes Bild';
            toggleWrap.appendChild(toggle);
            toggleWrap.appendChild(toggleText);
            card.appendChild(toggleWrap);
          }

          list.appendChild(card);
        });
      }

      return columnWrap;
    };

    columnsWrap.appendChild(makeColumn('left', 'Linke Spalte'));
    columnsWrap.appendChild(makeColumn('right', 'Rechte Spalte'));
  };
  renderColumns();

  const faqHeader = document.createElement('div');
  faqHeader.className = 'subh';
  faqHeader.textContent = 'FAQ';
  wrap.appendChild(faqHeader);

  const faqList = document.createElement('div');
  faqList.className = 'story-faq-editor';
  faqList.style.display = 'grid';
  faqList.style.gap = '8px';
  wrap.appendChild(faqList);

  const renderFaqList = () => {
    faqList.innerHTML = '';
    const data = Array.isArray(story.faq) ? story.faq : [];
    if (!data.length) {
      const empty = document.createElement('div');
      empty.className = 'mut';
      empty.textContent = 'Noch keine Fragen hinterlegt.';
      faqList.appendChild(empty);
      return;
    }
    data.forEach((entry, faqIdx) => {
      const row = document.createElement('div');
      row.className = 'row story-faq-row';
      row.style.gap = '6px';
      row.style.flexWrap = 'wrap';

      const q = document.createElement('input');
      q.type = 'text';
      q.className = 'input';
      q.style.flex = '1 1 220px';
      q.placeholder = 'Frage';
      q.value = entry?.question || '';
      q.onchange = () => { entry.question = q.value.trim(); renderSlidesMaster(); };

      const a = document.createElement('textarea');
      a.className = 'input';
      a.rows = 2;
      a.style.flex = '1 1 320px';
      a.placeholder = 'Antwort';
      a.value = entry?.answer || '';
      a.onchange = () => { entry.answer = a.value.trim(); renderSlidesMaster(); };

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn sm ghost icon';
      del.title = 'Eintrag entfernen';
      del.textContent = '✕';
      del.onclick = () => {
        data.splice(faqIdx, 1);
        renderSlidesMaster();
      };

      row.appendChild(q);
      row.appendChild(a);
      row.appendChild(del);
      faqList.appendChild(row);
    });
  };
  renderFaqList();

  const addFaqBtn = document.createElement('button');
  addFaqBtn.type = 'button';
  addFaqBtn.className = 'btn sm ghost';
  addFaqBtn.textContent = 'FAQ hinzufügen';
  addFaqBtn.onclick = () => {
    (story.faq ||= []).push({ question: '', answer: '' });
    renderSlidesMaster();
  };
  wrap.appendChild(addFaqBtn);

  return wrap;
}

function renderStorySlidesPanel(hostId='storyList'){
  const settings = ctx.getSettings();
  const list = ensureStorySlides(settings);
  const host = document.getElementById(hostId);
  if (!host) return;
  host.innerHTML = '';
  list.forEach((story, idx) => host.appendChild(storyEditor(story, idx)));

  const addBtn = document.getElementById('btnStoryAdd');
  if (addBtn) addBtn.onclick = () => {
    ensureStorySlides(settings).push(storyDefaults());
    renderSlidesMaster();
  };
}

// ============================================================================
// 6b) Slide Order View
// ============================================================================
export function collectSlideOrderStream({ normalizeSortOrder = true } = {}){
  const settings = ctx.getSettings();
  const schedule = ctx.getSchedule();
  const saunas = (schedule?.saunas || []).map(name => ({ kind: 'sauna', name }));
  const media = (Array.isArray(settings.interstitials) ? settings.interstitials : [])
    .map(it => ({ kind: 'media', item: it }));
  const storiesRaw = ensureStorySlides(settings);
  const stories = storiesRaw.map((item, i) => ({
    kind: 'story',
    item,
    key: item?.id != null ? String(item.id) : 'story_idx_' + i
  }));
  const hiddenSaunas = new Set(settings?.slides?.hiddenSaunas || []);

  let combined = [];
  const ord = settings?.slides?.sortOrder;
  if (Array.isArray(ord) && ord.length){
    const mapS = new Map(saunas.map(s => [s.name, s]));
    const mapM = new Map(media.map(m => [String(m.item.id), m]));
    const mapStory = new Map(stories.map(st => [st.key, st]));
    for (const o of ord){
      if (o.type === 'sauna' && mapS.has(o.name)){
        combined.push(mapS.get(o.name));
        mapS.delete(o.name);
      } else if (o.type === 'media' && mapM.has(String(o.id))){
        combined.push(mapM.get(String(o.id)));
        mapM.delete(String(o.id));
      } else if (o.type === 'story' && mapStory.has(String(o.id))){
        combined.push(mapStory.get(String(o.id)));
        mapStory.delete(String(o.id));
      }
    }
    combined = combined.concat(Array.from(mapS.values()), Array.from(mapM.values()), Array.from(mapStory.values()));
    if (normalizeSortOrder){
      settings.slides.sortOrder = combined.map(e => {
        if (e.kind === 'sauna') return { type: 'sauna', name: e.name };
        if (e.kind === 'media') return { type: 'media', id: e.item.id };
        return { type: 'story', id: e.item?.id ?? e.key };
      });
    }
  } else {
    combined = saunas.concat(media, stories);
  }

  return {
    entries: combined,
    saunas,
    media,
    stories,
    hiddenSaunas
  };
}

export function renderSlideOrderView(){
  const settings = ctx.getSettings();
  const host = document.getElementById('slideOrderGrid');
  if (!host) return;

  const { entries: combinedRaw, hiddenSaunas } = collectSlideOrderStream({ normalizeSortOrder: true });
  let combined = combinedRaw.slice();

  host.innerHTML = '';
  combined.forEach((entry, idx) => {
    const tile = document.createElement('div');
    tile.className = 'slide-order-tile';
    tile.draggable = true;
    tile.dataset.idx = idx;
    tile.dataset.type = entry.kind;

    const isHiddenSauna = entry.kind === 'sauna' && hiddenSaunas.has(entry.name);
    const isDisabledMedia = entry.kind === 'media' && entry.item?.enabled === false;
    const isDisabledStory = entry.kind === 'story' && entry.item?.enabled === false;
    if (isHiddenSauna) tile.classList.add('is-hidden');
    if (isHiddenSauna || isDisabledMedia || isDisabledStory) tile.classList.add('is-disabled');

    const title = document.createElement('div');
    title.className = 'title';
    let statusEl = null;
    if (isHiddenSauna || isDisabledMedia || isDisabledStory){
      statusEl = document.createElement('div');
      statusEl.className = 'slide-status';
      statusEl.dataset.state = 'hidden';
      statusEl.textContent = 'Ausgeblendet';
    }
    if (entry.kind === 'sauna'){
      tile.dataset.name = entry.name;
      title.textContent = entry.name;
      tile.appendChild(title);
      if (statusEl) tile.appendChild(statusEl);
      const imgSrc = settings.assets?.rightImages?.[entry.name] || '';
      if (imgSrc){
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = entry.name || '';
        tile.appendChild(img);
      }
    } else if (entry.kind === 'media') {
      tile.dataset.id = entry.item.id;
      title.textContent = entry.item.name || '(unbenannt)';
      tile.appendChild(title);
      if (statusEl) tile.appendChild(statusEl);
      const img = document.createElement('img');
      img.src = entry.item.thumb || entry.item.url || '';
      img.alt = entry.item.name || '';
      tile.appendChild(img);
    } else {
      tile.dataset.storyId = entry.item?.id || entry.key || '';
      title.textContent = entry.item?.title || 'Story-Slide';
      tile.appendChild(title);
      if (statusEl) tile.appendChild(statusEl);
      const img = document.createElement('img');
      img.src = entry.item?.heroUrl || FALLBACK_HERO;
      img.alt = entry.item?.heroAlt || '';
      tile.appendChild(img);
    }

    const controls = document.createElement('div');
    controls.className = 'reorder-controls';

    const stopDragPropagation = ev => {
      ev.stopPropagation();
    };

    const preventDragStart = ev => {
      ev.preventDefault();
    };

    const makeCtrlButton = (dir, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `reorder-btn ${dir > 0 ? 'reorder-down' : 'reorder-up'}`;
      btn.setAttribute('aria-label', label);
      btn.title = label;
      const iconMarkup = dir < 0
        ? '<svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="M8 3.5 12.5 8l-.7.7L8 4.9 4.2 8.7l-.7-.7Z"/></svg>'
        : '<svg aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="m8 12.5-4.5-4.5.7-.7L8 11.1l3.8-3.8.7.7Z"/></svg>';
      btn.innerHTML = iconMarkup;
      btn.draggable = false;
      btn.addEventListener('pointerdown', stopDragPropagation);
      btn.addEventListener('mousedown', stopDragPropagation);
      btn.addEventListener('touchstart', stopDragPropagation);
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        let moved = false;
        if (dir < 0){
          const prev = tile.previousElementSibling;
          if (prev){
            prev.before(tile);
            moved = true;
          }
        } else {
          const next = tile.nextElementSibling;
          if (next){
            next.after(tile);
            moved = true;
          }
        }
        if (!moved) return;
        clearDropIndicators();
        commitReorder();
        window.__queueUnsaved?.();
        window.dockPushDebounced?.();
      });
      btn.addEventListener('dragstart', preventDragStart);
      return btn;
    };

    controls.appendChild(makeCtrlButton(-1, 'Nach oben verschieben'));
    controls.appendChild(makeCtrlButton(1, 'Nach unten verschieben'));
    tile.appendChild(controls);

    host.appendChild(tile);
  });

  let dragged = null;
  const DROP_BEFORE = 'drop-before';
  const DROP_AFTER = 'drop-after';

  const clearDropIndicators = () => {
    host.querySelectorAll('.slide-order-tile').forEach(el => {
      el.classList.remove(DROP_BEFORE, DROP_AFTER);
    });
  };

  const commitReorder = () => {
    const tiles = Array.from(host.children);
    const reordered = tiles.map(el => combined[+el.dataset.idx]);
    combined = reordered;
    tiles.forEach((el, i) => { el.dataset.idx = i; });

    const newSaunas = [];
    const newMedia = [];
    const newStories = [];
    const sortOrder = [];
    for (const entry of reordered){
      if (entry.kind === 'sauna'){
        newSaunas.push(entry.name);
        sortOrder.push({ type:'sauna', name: entry.name });
      } else if (entry.kind === 'media') {
        newMedia.push(entry.item);
        sortOrder.push({ type:'media', id: entry.item.id });
      } else if (entry.kind === 'story') {
        newStories.push(entry.item);
        sortOrder.push({ type:'story', id: entry.item?.id ?? entry.key });
      }
    }
    schedule.saunas = newSaunas;
    settings.interstitials = newMedia;
    settings.slides.storySlides = newStories;
    settings.slides ||= {};
    settings.slides.sortOrder = sortOrder;
    window.__queueUnsaved?.();
    window.dockPushDebounced?.();
  };

  const updateDropIndicator = (target, before) => {
    if (!target || target === dragged) return;
    host.querySelectorAll('.slide-order-tile').forEach(el => {
      if (el !== target) el.classList.remove(DROP_BEFORE, DROP_AFTER);
    });
    target.classList.remove(DROP_BEFORE, DROP_AFTER);
    target.classList.add(before ? DROP_BEFORE : DROP_AFTER);
  };

  const isBeforeTarget = (event, target) => {
    const rect = target.getBoundingClientRect();
    const horizontal = rect.width > rect.height;
    return horizontal
      ? (event.clientX < rect.left + rect.width / 2)
      : (event.clientY < rect.top + rect.height / 2);
  };

  host.querySelectorAll('.slide-order-tile').forEach(tile => {
    tile.addEventListener('dragstart', e => {
      dragged = tile;
      tile.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tile.addEventListener('dragenter', e => {
      if (!dragged || tile === dragged) return;
      e.preventDefault();
      const before = isBeforeTarget(e, tile);
      updateDropIndicator(tile, before);
    });
    tile.addEventListener('dragover', e => {
      e.preventDefault();
      const target = tile;
      if (target === dragged) return;
      const before = isBeforeTarget(e, target);
      updateDropIndicator(target, before);
      if (before) target.before(dragged);
      else target.after(dragged);
    });
    tile.addEventListener('dragleave', e => {
      if (tile.contains(e.relatedTarget)) return;
      tile.classList.remove(DROP_BEFORE, DROP_AFTER);
    });
    tile.addEventListener('drop', e => {
      e.preventDefault();
      clearDropIndicators();
    });
    tile.addEventListener('dragend', () => {
      clearDropIndicators();
      tile.classList.remove('dragging');
      commitReorder();
      dragged = null;
    });
  });

  host.addEventListener('drop', e => {
    e.preventDefault();
    clearDropIndicators();
    if (dragged) dragged.classList.remove('dragging');
  });

  host.addEventListener('dragover', e => {
    e.preventDefault();
  });
}

// ============================================================================
// 7) Haupt-Renderer
// ============================================================================
export function renderSlidesMaster(){
  const settings = ctx.getSettings();
  const schedule = ctx.getSchedule();

  ensureStorySlides(settings);
  const styleSets = ensureStyleSets(settings);
  const componentFlags = ensureEnabledComponents(settings);
  // Transition
  const transEl = $('#transMs2');
  if (transEl){
    const val = Number.isFinite(+settings.slides?.transitionMs) ? +settings.slides.transitionMs : 500;
    transEl.value = val;
    transEl.onchange = () => { settings.slides ||= {}; settings.slides.transitionMs = Math.max(0, +transEl.value || 0); };
  }

  // Auto je Wochentag
  const autoEl = $('#presetAuto');
  if (autoEl){
    autoEl.checked = !!settings.presetAuto;
    autoEl.onchange = () => { settings.presetAuto = !!autoEl.checked; };
  }

  const waitEl = $('#waitForVideo');
  if (waitEl){
    waitEl.checked = !!settings.slides?.waitForVideo;
    waitEl.onchange = () => { (settings.slides ||= {}).waitForVideo = !!waitEl.checked; };
  }


  const heroToggle = $('#heroTimelineEnabled');
  const heroSettingsRow = $('#heroTimelineSettings');
  if (heroToggle){
    const enabled = !!settings.slides?.heroEnabled;
    heroToggle.checked = enabled;
    if (heroSettingsRow) heroSettingsRow.hidden = !enabled;
    heroToggle.onchange = () => {
      (settings.slides ||= {}).heroEnabled = !!heroToggle.checked;
      if (heroSettingsRow) heroSettingsRow.hidden = !heroToggle.checked;
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
    };
  } else if (heroSettingsRow){
    heroSettingsRow.hidden = true;
  }

  const heroDurationEl = $('#heroTimelineDuration');
  if (heroDurationEl){
    const fallback = Math.max(1000, Math.round(DEFAULTS.slides?.heroTimelineFillMs ?? 8000));
    const raw = settings.slides?.heroTimelineFillMs;
    const init = Number.isFinite(+raw) ? Math.max(1000, Math.round(+raw)) : fallback;
    heroDurationEl.value = String(Math.round(init / 1000));
    heroDurationEl.onchange = () => {
      const num = Number(heroDurationEl.value);
      if (!Number.isFinite(num) || num <= 0){
        (settings.slides ||= {}).heroTimelineFillMs = fallback;
        heroDurationEl.value = String(Math.round(fallback / 1000));
        return;
      }
      const secs = Math.max(1, Math.round(num));
      (settings.slides ||= {}).heroTimelineFillMs = secs * 1000;
      heroDurationEl.value = String(secs);
    };
  }

  const heroBaseEl = $('#heroTimelineBase');
  if (heroBaseEl){
    const fallback = Math.max(1, Math.round(DEFAULTS.slides?.heroTimelineBaseMinutes ?? 15));
    const raw = settings.slides?.heroTimelineBaseMinutes;
    const init = Number.isFinite(+raw) ? Math.max(1, Math.round(+raw)) : fallback;
    heroBaseEl.value = String(init);
    heroBaseEl.onchange = () => {
      const num = Number(heroBaseEl.value);
      if (!Number.isFinite(num) || num <= 0){
        (settings.slides ||= {}).heroTimelineBaseMinutes = fallback;
        heroBaseEl.value = String(fallback);
        return;
      }
      const minutes = Math.max(1, Math.round(num));
      (settings.slides ||= {}).heroTimelineBaseMinutes = minutes;
      heroBaseEl.value = String(minutes);
    };
  }

  const heroMaxEl = $('#heroTimelineMax');
  if (heroMaxEl){
    const raw = settings.slides?.heroTimelineMaxEntries;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0){
      const normalized = Math.max(1, Math.floor(raw));
      (settings.slides ||= {}).heroTimelineMaxEntries = normalized;
      heroMaxEl.value = String(normalized);
    } else {
      heroMaxEl.value = '';
    }
    heroMaxEl.onchange = () => {
      const value = heroMaxEl.value;
      if (value == null || String(value).trim() === ''){
        (settings.slides ||= {}).heroTimelineMaxEntries = null;
        heroMaxEl.value = '';
        return;
      }
      const num = Number(value);
      if (!Number.isFinite(num) || num <= 0){
        (settings.slides ||= {}).heroTimelineMaxEntries = null;
        heroMaxEl.value = '';
        return;
      }
      const normalized = Math.max(1, Math.floor(num));
      (settings.slides ||= {}).heroTimelineMaxEntries = normalized;
      heroMaxEl.value = String(normalized);
    };
  }

  const badgeColorEl = $('#badgeColor');
  if (badgeColorEl){
    const rawInit = settings.slides?.infobadgeColor || settings.theme?.accent || DEFAULTS.slides.infobadgeColor || '#5C3101';
    const initial = (typeof rawInit === 'string' ? rawInit.toUpperCase() : '#5C3101');
    badgeColorEl.value = initial;
    badgeColorEl.onchange = () => {
      const raw = badgeColorEl.value || '';
      const prev = settings.slides?.infobadgeColor || initial;
      const next = /^#([0-9A-F]{6})$/i.test(raw) ? raw.toUpperCase() : prev;
      (settings.slides ||= {}).infobadgeColor = next;
      badgeColorEl.value = next;
    };
  }

  const badgeListHost = $('#badgeLibraryList');
  const badgeAddBtn = $('#badgeAdd');
  const badgeSection = $('#badgeLibrarySection');
  const badgeToggle = $('#badgeLibraryToggle');
  const badgeBody = $('#badgeLibraryBody');

  const getBadgeSectionExpanded = () => !!(badgeToggle && badgeToggle.getAttribute('aria-expanded') === 'true');
  const setBadgeSectionExpanded = (expanded) => {
    const isExpanded = !!expanded;
    if (badgeToggle){
      badgeToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    }
    if (badgeBody){
      badgeBody.setAttribute('aria-hidden', isExpanded ? 'false' : 'true');
    }
    if (badgeSection){
      badgeSection.classList.toggle('is-open', isExpanded);
    }
  };

  if (badgeToggle && !badgeToggle.dataset.bound){
    badgeToggle.dataset.bound = '1';
    badgeToggle.addEventListener('click', () => {
      setBadgeSectionExpanded(!getBadgeSectionExpanded());
    });
  }
  if (badgeToggle || badgeBody){
    setBadgeSectionExpanded(getBadgeSectionExpanded());
  }

  const renderBadgeLibraryRows = () => {
    const list = ensureBadgeLibrary(settings);
    const customEmojis = ensureCustomBadgeEmojis(settings);
    const getCustomEmojiList = () => {
      settings.slides ||= {};
      if (!Array.isArray(settings.slides.customBadgeEmojis)) settings.slides.customBadgeEmojis = [];
      return settings.slides.customBadgeEmojis;
    };
    if (!badgeListHost) return;

    const notifyChange = () => {
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
    };

    const emojiInput = $('#badgeEmojiInput');
    const emojiAddBtn = $('#badgeEmojiAdd');
    const emojiCustomList = $('#badgeEmojiCustom');

    const updateEmojiAddState = () => {
      if (!emojiAddBtn) return;
      const value = (emojiInput?.value || '').trim();
      const listRef = getCustomEmojiList();
      emojiAddBtn.disabled = !value || listRef.includes(value);
    };

    const renderEmojiChips = () => {
      if (!emojiCustomList) return;
      emojiCustomList.innerHTML = '';
      const listRef = getCustomEmojiList();
      if (!listRef.length){
        const empty = document.createElement('div');
        empty.className = 'badge-lib-emoji-empty';
        empty.textContent = 'Keine eigenen Emojis gespeichert.';
        emojiCustomList.appendChild(empty);
        return;
      }
      listRef.forEach(value => {
        const chip = document.createElement('span');
        chip.className = 'badge-lib-emoji-chip';
        chip.textContent = value;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'badge-lib-emoji-remove';
        removeBtn.title = `${value} entfernen`;
        removeBtn.setAttribute('aria-label', `Emoji ${value} entfernen`);
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => {
          const list = getCustomEmojiList();
          const idx = list.indexOf(value);
          if (idx >= 0) list.splice(idx, 1);
          renderBadgeLibraryRows();
          notifyChange();
        });
        chip.appendChild(removeBtn);
        emojiCustomList.appendChild(chip);
      });
    };

    const addCustomEmoji = (rawValue) => {
      const value = (rawValue || '').trim();
      if (!value) return;
      const listRef = getCustomEmojiList();
      if (listRef.includes(value)) return;
      listRef.push(value);
      if (emojiInput){
        emojiInput.value = '';
      }
      renderBadgeLibraryRows();
      notifyChange();
    };

    if (emojiAddBtn && !emojiAddBtn.dataset.bound){
      emojiAddBtn.addEventListener('click', () => addCustomEmoji(emojiInput?.value));
      emojiAddBtn.dataset.bound = '1';
    }
    if (emojiInput && !emojiInput.dataset.bound){
      emojiInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter'){
          ev.preventDefault();
          addCustomEmoji(emojiInput.value);
        }
      });
      emojiInput.addEventListener('input', updateEmojiAddState);
      emojiInput.dataset.bound = '1';
    }

    updateEmojiAddState();
    renderEmojiChips();

    badgeListHost.innerHTML = '';
    if (!list.length){
      const empty = document.createElement('div');
      empty.className = 'mut';
      empty.textContent = 'Noch keine Badges angelegt.';
      badgeListHost.appendChild(empty);
      setBadgeSectionExpanded(false);
      badgeSection?.classList.toggle('has-items', false);
      return;
    }

    badgeSection?.classList.toggle('has-items', true);

    const makeField = (labelText, control) => {
      const field = document.createElement('div');
      field.className = 'badge-lib-field';
      const lbl = document.createElement('span');
      lbl.className = 'badge-lib-field-label';
      lbl.textContent = labelText;
      field.appendChild(lbl);
      field.appendChild(control);
      return field;
    };

    const usedIcons = Array.from(new Set(list
      .map(entry => (entry && typeof entry === 'object') ? String(entry.icon || '').trim() : '')
      .filter(Boolean)));

    const populateEmojiOptions = (selectEl, currentValue) => {
      if (!selectEl) return;
      const current = (currentValue || '').trim();
      selectEl.innerHTML = '';
      const added = new Set();
      const appendOption = (value, labelText, groupNode) => {
        const normalized = (value || '').trim();
        if (!normalized || added.has(normalized)) return;
        const option = document.createElement('option');
        option.value = normalized;
        option.textContent = labelText || normalized;
        if (normalized === current) option.selected = true;
        (groupNode || selectEl).appendChild(option);
        added.add(normalized);
      };

      const noneOption = document.createElement('option');
      noneOption.value = '';
      noneOption.textContent = '— Kein Emoji —';
      if (!current) noneOption.selected = true;
      selectEl.appendChild(noneOption);

      const addGroup = (label, entries, mapper) => {
        if (!entries.length) return;
        const group = document.createElement('optgroup');
        group.label = label;
        entries.forEach(entry => {
          const raw = mapper ? mapper(entry) : entry;
          const normalized = (typeof raw === 'string') ? raw.trim() : '';
          if (!normalized) return;
          const display = typeof entry === 'object'
            ? `${entry.value} ${entry.label}`
            : normalized;
          appendOption(normalized, display, group);
        });
        if (group.children.length) selectEl.appendChild(group);
      };

      addGroup('Empfohlen', SUGGESTED_BADGE_EMOJIS, (entry) => entry.value);
      addGroup('Eigene Emojis', customEmojis, (entry) => entry);
      const otherIcons = usedIcons.filter(value => !added.has(value));
      addGroup('Verwendet', otherIcons, (entry) => entry);

      if (current && !added.has(current)){
        appendOption(current, `${current} (aktuell)`);
      }
    };

    list.forEach((badge, index) => {
      const row = document.createElement('div');
      row.className = 'badge-lib-row';

      const preview = document.createElement('div');
      preview.className = 'badge-lib-preview';

      const chip = document.createElement('span');
      chip.className = 'badge-lib-chip';

      const chipIcon = document.createElement('span');
      chipIcon.className = 'badge-lib-chip-icon';

      const chipLabel = document.createElement('span');
      chipLabel.className = 'badge-lib-chip-label';

      chip.appendChild(chipIcon);
      chip.appendChild(chipLabel);
      preview.appendChild(chip);

      const idBadge = document.createElement('span');
      idBadge.className = 'badge-lib-id';
      idBadge.textContent = badge.id;
      preview.appendChild(idBadge);

      const editWrap = document.createElement('div');
      editWrap.className = 'badge-lib-edit';

      const actions = document.createElement('div');
      actions.className = 'badge-lib-actions';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'input badge-lib-input badge-lib-label';
      labelInput.value = badge.label || '';
      labelInput.placeholder = 'Badge-Text';
      labelInput.maxLength = 80;
      labelInput.setAttribute('aria-label', 'Badge-Text');

      const emojiSelect = document.createElement('select');
      emojiSelect.className = 'input badge-lib-input badge-lib-emoji-select';
      emojiSelect.setAttribute('aria-label', 'Badge-Emoji');
      populateEmojiOptions(emojiSelect, badge.icon || '');

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn sm ghost badge-lib-remove';
      removeBtn.textContent = 'Badge löschen';
      removeBtn.title = 'Badge entfernen';

      const fields = document.createElement('div');
      fields.className = 'badge-lib-fields';
      fields.appendChild(makeField('Badge-Text', labelInput));
      fields.appendChild(makeField('Emoji', emojiSelect));

      actions.appendChild(removeBtn);

      editWrap.appendChild(fields);
      editWrap.appendChild(actions);

      const updatePreview = () => {
        const iconValue = (emojiSelect.value || '').trim();
        const labelValue = labelInput.value.trim();
        chipLabel.textContent = labelValue || badge.id;
        chipIcon.textContent = iconValue || '';
        chipIcon.hidden = !iconValue;
        row.classList.toggle('has-icon', !!iconValue);
        row.classList.toggle('is-empty', !iconValue && !labelValue);
      };

      emojiSelect.addEventListener('input', updatePreview);
      emojiSelect.addEventListener('change', () => {
        badge.icon = emojiSelect.value.trim();
        updatePreview();
        notifyChange();
      });

      labelInput.addEventListener('input', updatePreview);
      labelInput.addEventListener('change', () => {
        badge.label = labelInput.value.trim();
        labelInput.value = badge.label;
        updatePreview();
        notifyChange();
      });

      removeBtn.addEventListener('click', () => {
        const listRef = ensureBadgeLibrary(settings);
        listRef.splice(index, 1);
        renderBadgeLibraryRows();
        notifyChange();
      });

      row.appendChild(preview);
      row.appendChild(editWrap);
      badgeListHost.appendChild(row);

      updatePreview();
    });
  };

  if (badgeAddBtn){
    badgeAddBtn.onclick = () => {
      const list = ensureBadgeLibrary(settings);
      list.push({ id: genId('bdg_'), icon:'', label:'' });
      setBadgeSectionExpanded(true);
      renderBadgeLibraryRows();
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
    };
  }
  renderBadgeLibraryRows();

  const toggleWrap = $('#componentToggleWrap');
  if (toggleWrap){
    toggleWrap.querySelectorAll('input[data-component]').forEach(inp => {
      if (!(inp instanceof HTMLInputElement)) return;
      const key = inp.dataset.component;
      if (!key) return;
      inp.checked = componentFlags[key] !== false;
      const label = inp.closest('label');
      if (label) label.classList.toggle('active', inp.checked);
      inp.onchange = () => {
        componentFlags[key] = !!inp.checked;
        if (label) label.classList.toggle('active', inp.checked);
        window.__queueUnsaved?.();
        window.__markUnsaved?.();
        if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      };
    });
  }

  const styleSelect = $('#styleSetSelect');
  const labelField = $('#styleSetLabel');
  const applyBtn = $('#styleSetApply');
  const saveBtn = $('#styleSetSave');
  const createBtn = $('#styleSetCreate');
  const deleteBtn = $('#styleSetDelete');
  const setIds = Object.keys(styleSets);
  const activeSetId = settings.slides?.activeStyleSet && setIds.includes(settings.slides.activeStyleSet)
    ? settings.slides.activeStyleSet
    : (setIds[0] || '');

  if (styleSelect){
    styleSelect.innerHTML = '';
    setIds.forEach(id => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = styleSets[id]?.label || id;
      opt.selected = (id === activeSetId);
      styleSelect.appendChild(opt);
    });
    styleSelect.disabled = setIds.length === 0;
  }

  const updateLabelField = () => {
    if (!labelField) return;
    const currentId = styleSelect?.value || activeSetId;
    if (currentId && styleSets[currentId]){
      labelField.disabled = false;
      labelField.value = styleSets[currentId].label || currentId;
    } else {
      labelField.disabled = true;
      labelField.value = '';
    }
  };
  updateLabelField();

  if (styleSelect){
    styleSelect.onchange = () => {
      updateLabelField();
    };
  }

  if (labelField){
    labelField.oninput = () => {
      const currentId = styleSelect?.value || activeSetId;
      if (!currentId || !styleSets[currentId]) return;
      styleSets[currentId].label = labelField.value.trim() || currentId;
      if (styleSelect){
        Array.from(styleSelect.options).forEach(opt => {
          if (opt.value === currentId){
            opt.textContent = styleSets[currentId].label || currentId;
          }
        });
      }
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
    };
  }

  if (applyBtn){
    applyBtn.onclick = () => {
      const currentId = styleSelect?.value || activeSetId;
      if (!currentId) return;
      if (!applyStyleSet(settings, currentId)) return;
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      if (typeof ctx.refreshSlidesBox === 'function') ctx.refreshSlidesBox();
      if (typeof ctx.refreshColors === 'function') ctx.refreshColors();
      renderSlidesMaster();
    };
  }

  if (saveBtn){
    saveBtn.onclick = () => {
      const currentId = styleSelect?.value || activeSetId;
      if (!currentId || !styleSets[currentId]) return;
      const snap = snapshotStyleSet(settings);
      styleSets[currentId] = {
        label: styleSets[currentId].label || currentId,
        theme: snap.theme,
        fonts: snap.fonts,
        slides: snap.slides
      };
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      renderSlidesMaster();
    };
  }

  if (createBtn){
    createBtn.onclick = () => {
      const name = prompt('Name der neuen Palette:', 'Neue Palette');
      if (name === null) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const newId = slugifyStyleSet(trimmed, Object.keys(styleSets));
      const snap = snapshotStyleSet(settings);
      styleSets[newId] = {
        label: trimmed,
        theme: snap.theme,
        fonts: snap.fonts,
        slides: snap.slides
      };
      settings.slides.activeStyleSet = newId;
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      renderSlidesMaster();
    };
  }

  if (deleteBtn){
    deleteBtn.onclick = () => {
      const currentId = styleSelect?.value || activeSetId;
      if (!currentId || !styleSets[currentId]) return;
      if (Object.keys(styleSets).length <= 1){
        alert('Mindestens eine Palette muss vorhanden sein.');
        return;
      }
      if (!confirm('Palette wirklich löschen?')) return;
      delete styleSets[currentId];
      if (settings.slides.activeStyleSet === currentId){
        settings.slides.activeStyleSet = Object.keys(styleSets)[0] || '';
      }
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      renderSlidesMaster();
    };
  }

// === Dauer-Modus (Uniform vs. Individuell) ===
const perMode = (settings.slides?.durationMode === 'per');

// Body-Klassen (falls CSS das nutzt)
document.body.classList.toggle('mode-uniform', !perMode);
document.body.classList.toggle('mode-per', perMode);

// --- Übersicht-Row (neu zeichnen + Canvas-Preview) ---
const ovHost = $('#overviewRow');
if (ovHost){
  ovHost.innerHTML = '';
  ovHost.appendChild(overviewRowRender());
  const cv = ovHost.querySelector('#ovPrev');
  if (cv) drawOverviewPreview(cv);
}

// --- Saunen-Liste (Aufguss) ---
const sHost = $('#saunaList');
if (sHost){
  sHost.innerHTML = '';
  (schedule.saunas || []).forEach((name, i) => {
    const el = saunaRow({ name, index: i, mode:'normal' });
    makeRowDraggable(el, name, 'on');
    sHost.appendChild(el);
  });
  enableSaunaOrder();
}

// --- „Kein Aufguss“ + Drag&Drop ---
renderSaunaOffList();
applyDnD();

// --- Sichtbarkeit der Dauer-Inputs gezielt steuern ---
// Per-Sauna-Dauer (nur im PER-Modus)
$$('.saunarow .intSec').forEach(inp => { if (inp) inp.style.display = perMode ? '' : 'none'; });
// Übersichtsdauer-Eingabe in der Übersicht-Reihe (#ovSec existiert nur im PER-Modus)
{
  const ovRowInput = document.querySelector('#overviewRow .intSec, #overviewRow #ovSec');
  if (ovRowInput) ovRowInput.style.display = perMode ? '' : 'none';
}

// --- Modus-Schalter + Globaldauer (nur UNIFORM sichtbar) ---
const durUniform = $('#durUniform');
const durPer     = $('#durPer');
const rowDwell   = $('#rowDwellAll');   // Container für „Dauer (alle außer Übersicht)“ + „Dauer Übersicht“
const dwellAll   = $('#dwellAll');      // Input global (uniform)
const ovGlobal   = $('#ovSecGlobal');   // Input Übersicht global (uniform)

// Radio-Buttons setzen
if (durUniform) durUniform.checked = !perMode;
if (durPer)     durPer.checked     =  perMode;

// Zeile mit globalen Feldern nur im Uniform-Modus zeigen
if (rowDwell) rowDwell.style.display = perMode ? 'none' : 'grid';

// Globale Dauer „alle außer Übersicht“ (nur uniform)
if (dwellAll) {
  dwellAll.style.display = perMode ? 'none' : '';
  dwellAll.value = settings.slides?.globalDwellSec ?? 6;
  dwellAll.onchange = () => {
    (settings.slides ||= {}).globalDwellSec = Math.max(1, Math.min(120, +dwellAll.value || 6));
  };
}

// Globale Übersichtsdauer (nur uniform)
if (ovGlobal) {
  ovGlobal.style.display = perMode ? 'none' : '';
  ovGlobal.value = settings.slides?.overviewDurationSec ?? 10;
  ovGlobal.onchange = () => {
    (settings.slides ||= {}).overviewDurationSec = Math.max(1, Math.min(120, +ovGlobal.value || 10));
  };
}

// Modus-Umschalter
if (durUniform) durUniform.onchange = () => {
  if (durUniform.checked){
    (settings.slides ||= {}).durationMode = 'uniform';
    renderSlidesMaster();
  }
};
if (durPer) durPer.onchange = () => {
  if (durPer.checked){
    (settings.slides ||= {}).durationMode = 'per';
    renderSlidesMaster();
  }
};

  // Story-Slides
  renderStorySlidesPanel('storyList');

  // Medien-Slides
  renderInterstitialsPanel('interList2');

  const sortBtn = $('#btnSortSlides');
  const orderOverlay = $('#slideOrderOverlay');
  const closeOrder = $('#slideOrderClose');
  if (sortBtn) sortBtn.onclick = () => {
    if (orderOverlay) {
      orderOverlay.hidden = false;
      renderSlideOrderView();
    }
  };
  if (closeOrder) closeOrder.onclick = () => {
    if (orderOverlay) orderOverlay.hidden = true;
    renderSlidesMaster();
  };
  if (orderOverlay) orderOverlay.addEventListener('click', e => {
    if (e.target === orderOverlay) {
      orderOverlay.hidden = true;
      renderSlidesMaster();
    }
  });

  // Reset & Add Sauna
  const rs = $('#resetTiming');
  if (rs) rs.onclick = () => {
    settings.slides ||= {};
    settings.slides.showOverview = true;
    settings.slides.overviewDurationSec = 10;
    settings.slides.transitionMs = 500;
    settings.slides.durationMode = 'uniform';
    settings.slides.globalDwellSec = 6;
    settings.slides.waitForVideo = false;
    settings.slides.hiddenSaunas = [];
    settings.slides.saunaDurations = {};
    renderSlidesMaster();
  };

  const addBtn = $('#btnAddSauna');
  if (addBtn) addBtn.onclick = () => {
    const name = (prompt('Neue Sauna anlegen (Inventar):', 'Neue Sauna') || '').trim();
    if (!name) return;
    const all = getAllSaunas();
    if (all.includes(name)){
      alert('Diesen Namen gibt es bereits im Inventar.');
      return;
    }
    const s = ctx.getSettings();
    s.allSaunas = all.concat(name).sort((a,b)=> a.localeCompare(b,'de'));
    renderSlidesMaster(); // erscheint unter „Kein Aufguss“
  };
}

// ============================================================================
// 8) Public API
// ============================================================================
export function initSlidesMasterUI(context){
  ctx = context;
  if (!wiredStatic){
    initWeekdayUI();
    wiredStatic = true;
  }
  renderSlidesMaster();
}
