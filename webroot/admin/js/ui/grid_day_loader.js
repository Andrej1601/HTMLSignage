// /admin/js/ui/grid_day_loader.js
// Zweck: "Aus Tag laden" im Grid-Header – lädt einen Preset-Wochentag in das aktuelle Grid,
// ohne den aktiven Tag (Pillen) umzuschalten.
//
// Abhängigkeiten:
//  - ../core/utils.js  : $, deepClone
//  - ../core/defaults.js : DAYS, DAY_LABELS
//  - ./grid.js         : renderGrid (nach Laden neu zeichnen)
//  - ./slides_master.js: renderSlidesMaster (Saunenliste etc. synchron halten)

// /admin/js/ui/grid_day_loader.js
// "Aus Tag laden" im Grid-Header (links oben neben „Aufgussplan“)

import { $, deepClone } from '../core/utils.js';
import { DAY_LABELS } from '../core/defaults.js';
import { renderGrid as renderGridUI } from './grid.js';
import { renderSlidesMaster } from './slides_master.js';
import { notifyWarning } from '../core/notifications.js';

let ctx = null; // { getSchedule, getSettings, setSchedule }

function ensureUI() {
  // Ziel-Container links oben neben "Aufgussplan"
  const host = document.getElementById('gridActionsLeft');
  if (!host) return; // host noch nicht da? später nochmal versuchen

  // idempotent
  let wrap = document.getElementById('gridDayLoader');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'gridDayLoader';
    wrap.className = 'row';
    wrap.style.gap = '8px';
    host.appendChild(wrap);
  }

  const saved = localStorage.getItem('gridLoadDay') || 'Mon';

  wrap.innerHTML = `
    <span class="mut">Aus Tag laden:</span>
    <select id="gridLoadDay" class="input sm" style="width:auto"></select>
    <button id="btnGridLoadDay" class="btn sm">Laden</button>
  `;

  // Optionen füllen (Mo–So)
  const sel = wrap.querySelector('#gridLoadDay');
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(key => {
    const lab = (DAY_LABELS && DAY_LABELS[key]) || key;
    const o = document.createElement('option');
    o.value = key;
    o.textContent = lab;
    sel.appendChild(o);
  });
  sel.value = saved;
  sel.onchange = () => localStorage.setItem('gridLoadDay', sel.value);

  // Laden-Button
  const btn = wrap.querySelector('#btnGridLoadDay');
  btn.onclick = () => {
    const settings = ctx.getSettings();
    const key = sel.value;
    const preset = settings?.presets?.[key];
    if (!preset) {
      notifyWarning(`Kein Preset für "${(DAY_LABELS && DAY_LABELS[key]) || key}" vorhanden.`);
      return;
    }
    // Preset ins aktuelle Schedule übernehmen (deep clone)
    const hadUnsaved = typeof ctx?.hasUnsavedChanges === 'function' ? !!ctx.hasUnsavedChanges() : false;
    ctx.setSchedule(deepClone(preset));
    renderGridUI();
    renderSlidesMaster();
    ctx.queueUnsavedEvaluation?.({});
    if (!hadUnsaved) {
      ctx.resetUnsavedBaseline?.({ skipDraftClear: true });
    }
  };
}

// ---- öffentlicher Einstieg ----
export function initGridDayLoader(context) {
  ctx = context;
  // einmal jetzt versuchen …
  ensureUI();
  // … und vorsichtshalber noch einmal nach einem Tick (falls DOM-Teil später gerendert wird)
  setTimeout(ensureUI, 0);
}
