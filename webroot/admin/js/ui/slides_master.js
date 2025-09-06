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

import { $, $$, preloadImg, escapeHtml } from '../core/utils.js';
import { uploadGeneric } from '../core/upload.js';
import { renderGrid as renderGridUI } from './grid.js';
import { DAYS, DAY_LABELS, dayKeyToday } from '../core/defaults.js';
import { DEFAULTS } from '../core/defaults.js';

// App-Context (Getter/Setter aus app.js)
let ctx = null; // { getSchedule, getSettings, setSchedule, setSettings }
let wiredStatic = false;

// HTML-Editor Message Handling
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || !d.type) return;
  if (d.type === 'htmlRequest'){
    const it = (ctx?.getSettings().interstitials || []).find(im => im.id === d.id);
    e.source?.postMessage({ type:'htmlInit', id:d.id, html: it?.html || '' }, '*');
  } else if (d.type === 'htmlSave'){
    const it = (ctx?.getSettings().interstitials || []).find(im => im.id === d.id);
    if (it) { it.html = d.html || ''; renderSlidesMaster(); }
  }
});

// ============================================================================
// 1) Wochentage / Presets
// ============================================================================
let activeDayKey = 'Mon';

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

  // 7) Verweise in Medien-Slides („Nach Slide“)
  (settings.interstitials || []).forEach(it => {
    const v = it.afterRef || '';
    if (v && v.startsWith('sauna:')){
      const n = decodeURIComponent(v.slice(6));
      if (n === name){ it.afterRef = 'overview'; it.after = 'overview'; }
    } else if (it.after === name){
      it.after = 'overview';
      it.afterRef = 'overview';
    }
  });

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

  // Interstitial-Referenzen
  (settings.interstitials||[]).forEach(it=>{
    if (!it) return;
    if (it.after === oldName) it.after = newName;
    const encOld = 'sauna:' + encodeURIComponent(oldName);
    const encNew = 'sauna:' + encodeURIComponent(newName);
    if (it.afterRef === encOld) it.afterRef = encNew;
  });
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
        settings.assets.rightImages[name] = p;
        preloadImg(p).then(r => {
          if (r.ok) { $img.src = p; $img.title = `${r.w}×${r.h}`; }
          else { $img.removeAttribute('src'); $img.removeAttribute('title'); }
        });
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
  const schedule = ctx.getSchedule();
  const settings = ctx.getSettings();
  let dragIdx = null;
  Array.from(host.children).forEach((row,i)=>{
    row.draggable = true;
    row.addEventListener('dragstart', e=>{ dragIdx = i; e.dataTransfer.effectAllowed='move'; });
    row.addEventListener('dragover', e=>e.preventDefault());
    row.addEventListener('drop', e=>{
      e.preventDefault();
      const rows = Array.from(host.children);
      const dropIdx = rows.indexOf(row);
      if (dropIdx === -1 || dragIdx === null || dragIdx === dropIdx) return;
      const arr = schedule.saunas || [];
      const [m] = arr.splice(dragIdx,1);
      arr.splice(dropIdx,0,m);
      settings.slides ||= {};
      settings.slides.order = arr.slice();
      renderSlidesMaster();
      renderGridUI();
    });
  });
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
function usedAfterImageIds(exceptId){
  const settings = ctx.getSettings();
  const list = settings.interstitials || [];
  const set = new Set();
  list.forEach(im => {
    if (!im || im.id === exceptId) return;
    const v = im.afterRef || '';
    if (v.startsWith('img:')) { set.add(v.slice(4)); return; }
    // Legacy by name
    if (im.after && im.after !== 'overview' && !(ctx.getSchedule().saunas || []).includes(im.after)){
      const hit = list.find(x => x && x.id !== im.id && (x.name || '') === im.after);
      if (hit && hit.id) set.add(hit.id);
    }
  });
  return set;
}

function interAfterOptionsHTML(currentId){
  const schedule = ctx.getSchedule();
  const settings = ctx.getSettings();

  const used = usedAfterImageIds(currentId);

  const saunaOpts = (schedule.saunas || [])
    .map(v => `<option value="sauna:${encodeURIComponent(v)}">${escapeHtml(v)}</option>`);

  const imgOpts = (settings.interstitials || [])
    .filter(x => x && x.id && x.id !== currentId)
    .map(x => {
      const val = 'img:' + x.id;
      const taken = used.has(x.id);
      const label = 'Bild: ' + (x.name || x.id) + (taken ? ' (belegt)' : '');
      return `<option value="${val}"${taken ? ' disabled' : ''}>${escapeHtml(label)}</option>`;
    });

  return [`<option value="overview">Übersicht</option>`, ...saunaOpts, ...imgOpts].join('');
}

function getAfterSelectValue(it, currentId){
  const schedule = ctx.getSchedule();
  if (it.afterRef) return it.afterRef;
  const a = it.after;
  if (a === 'overview' || !a) return 'overview';
  if ((schedule.saunas || []).includes(a)) return 'sauna:' + encodeURIComponent(a);
  const hit = (ctx.getSettings().interstitials || []).find(im => im && im.id !== currentId && (im.name || '') === a);
  if (hit) return 'img:' + hit.id;
  return 'overview';
}

function applyAfterSelect(it, value){
  const settings = ctx.getSettings();
  it.afterRef = value;
  if (value === 'overview'){
    it.after = 'overview';
  } else if (value.startsWith('sauna:')){
    const name = decodeURIComponent(value.slice(6));
    it.after = name;
  } else if (value.startsWith('img:')){
    const id = value.slice(4);
    const img = (settings.interstitials || []).find(im => im && im.id === id);
    it.after = img ? (img.name || '') : '';
  }
}

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
      <option value="mpd">MPD</option>
      <option value="html">HTML</option>
    </select>
    <img id="p_${id}" class="prev" alt="" title=""/>
    <input id="sec_${id}" class="input num3 dur intSec" type="number" min="1" max="60" step="1" />
    <span id="m_${id}" class="media-field"></span>
    <button class="btn sm ghost icon" id="x_${id}" title="Entfernen">✕</button>
    <select id="a_${id}" class="input sel-after">${interAfterOptionsHTML(it.id)}</select>
    <input id="en_${id}" type="checkbox" />
  `;

  const $name  = wrap.querySelector('#n_'+id);
  const $type  = wrap.querySelector('#t_'+id);
  const $prev  = wrap.querySelector('#p_'+id);
  const $sec   = wrap.querySelector('#sec_'+id);
  const $media = wrap.querySelector('#m_'+id);
  const $del   = wrap.querySelector('#x_'+id);
  const $after = wrap.querySelector('#a_'+id);
  const $en    = wrap.querySelector('#en_'+id);

  // Werte
  if ($type) $type.value = it.type || 'image';
  if ($en) $en.checked = !!it.enabled;
  if ($sec){
    $sec.value = Number.isFinite(+it.dwellSec)
      ? +it.dwellSec
      : (ctx.getSettings().slides?.imageDurationSec ?? ctx.getSettings().slides?.saunaDurationSec ?? 6);
  }
  if ($after) $after.value = getAfterSelectValue(it, it.id);

  const FALLBACK_THUMB = '/assets/img/thumb_fallback.svg';
  if (it.thumb){
    preloadImg(it.thumb).then(r => {
      if (r.ok){
        $prev.src = it.thumb; $prev.title = `${r.w}×${r.h}`;
      } else {
        $prev.src = FALLBACK_THUMB; $prev.title = '';
      }
    });
  } else {
    $prev.src = FALLBACK_THUMB;
  }

  // Uniform-Mode blendet Dauer-Feld aus
  const uniform = (ctx.getSettings().slides?.durationMode !== 'per');
  if ($sec) $sec.style.display = uniform ? 'none' : '';

  const renderMediaField = () => {
    if (!$media) return;
    $media.innerHTML = '';

    // Preview Upload Button (immer vorhanden)
    const pb = document.createElement('button');
    pb.className = 'btn sm ghost icon';
    pb.title = 'Vorschau-Bild hochladen';
    pb.textContent = '⤴︎';
    pb.onclick = () => {
      const fi = document.createElement('input');
      fi.type = 'file'; fi.accept = 'image/*';
      fi.onchange = () => uploadGeneric(fi, (p) => {
        it.thumb = p;
        preloadImg(p).then(r => {
          if (r.ok){ $prev.src = p; $prev.title = `${r.w}×${r.h}`; }
          else { $prev.src = FALLBACK_THUMB; $prev.title = ''; }
        });
      });
      fi.click();
    };
    $media.appendChild(pb);

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
        if (t === 'video'){
          const ti = document.createElement('input');
          ti.type = 'file'; ti.accept = 'image/*';
          ti.onchange = () => uploadGeneric(fi, (p, tp) => {
            it.url = p;
            if (tp){
              it.thumb = tp;
              preloadImg(tp).then(r => {
                if (r.ok){ $prev.src = tp; $prev.title = `${r.w}×${r.h}`; }
                else { $prev.src = FALLBACK_THUMB; $prev.title = ''; }
              });
            }
          }, ti);
          fi.onchange = () => { if (fi.files[0]) ti.click(); };
        } else {
          fi.onchange = () => uploadGeneric(fi, (p) => {
            it.url = p; it.thumb = p;
            preloadImg(p).then(r => {
              if (r.ok){ $prev.src = p; $prev.title = `${r.w}×${r.h}`; }
              else { $prev.src = FALLBACK_THUMB; $prev.title = ''; }
            });
          });
        }
        fi.click();
      };
      $media.appendChild(mb);
    } else if (t === 'url' || t === 'mpd'){
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'input';
      inp.value = it.url || '';
      inp.onchange = () => { it.url = inp.value.trim(); };
      $media.appendChild(inp);
    } else if (t === 'html'){
      const btn = document.createElement('button');
      btn.className = 'btn sm ghost';
      btn.textContent = 'HTML';
      btn.onclick = () => {
        window.open('/admin/html-editor.html?id=' + encodeURIComponent(it.id), '_blank', 'width=800,height=600');
      };
      $media.appendChild(btn);
    }
  };

  renderMediaField();

  // Events
  if ($name)  $name.onchange  = () => { it.name = ($name.value || '').trim(); renderSlidesMaster(); };
  if ($type)  $type.onchange  = () => { it.type = $type.value; renderMediaField(); };
  if ($after) $after.onchange = () => {
    const v = $after.value;
    if (v === 'img:' + it.id){
      alert('Ein Bild kann nicht nach sich selbst kommen.');
      $after.value = 'overview';
      applyAfterSelect(it, 'overview');
      return;
    }
    if (v.startsWith('img:')){
      const used = usedAfterImageIds(it.id);
      const targetId = v.slice(4);
      if (used.has(targetId)){
        alert('Dieses Bild ist bereits als „Nach Bild“ gewählt.');
        $after.value = 'overview';
        applyAfterSelect(it, 'overview');
        return;
      }
    }
    applyAfterSelect(it, v);
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
  settings.interstitials = list.map(it => ({ type:'image', thumb:'', html:'', ...it }));

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
      html:'',
      after:'overview',
      dwellSec:6
    });
    renderSlidesMaster();
  };
}

// ============================================================================
// 7) Haupt-Renderer
// ============================================================================
export function renderSlidesMaster(){
  const settings = ctx.getSettings();
  const schedule = ctx.getSchedule();

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

  // Medien-Slides
  renderInterstitialsPanel('interList2');

  // Reset & Add Sauna
  const rs = $('#resetTiming');
  if (rs) rs.onclick = () => {
    settings.slides ||= {};
    settings.slides.showOverview = true;
    settings.slides.overviewDurationSec = 10;
    settings.slides.transitionMs = 500;
    settings.slides.durationMode = 'uniform';
    settings.slides.globalDwellSec = 6;
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
