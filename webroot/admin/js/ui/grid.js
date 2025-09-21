// /admin/js/ui/grid.js
// Rendert die Übersichtstabelle (#grid), bedient den Zellen-Dialog und die Row-Buttons.
// Abhängigkeiten: utils ($,$$,parseTime) + Zugriff auf schedule/settings via init(ctx).

import { $, $$, parseTime } from '../core/utils.js';

let ctx = null;           // { getSchedule, getSettings }
let curRow = 0, curCol = 0;
let inited = false;
let undoStack = [];
let redoStack = [];

function cloneCell(cell){
  if (!cell) return null;
  if (typeof structuredClone === 'function'){
    try { return structuredClone(cell); }
    catch {}
  }
  return JSON.parse(JSON.stringify(cell));
}

function cloneRows(rows){
  return (rows || []).map(r=>({
    time: r.time,
    entries: (r.entries || []).map(cloneCell)
  }));
}

function normalizeText(value){
  if (value == null) return '';
  if (Array.isArray(value)){
    return value.map(v => normalizeText(v)).filter(Boolean).join('\n');
  }
  if (typeof value === 'object'){
    const nested = value.text ?? value.label ?? value.value ?? value.name;
    return normalizeText(nested);
  }
  return String(value);
}

function getBadgeLibrary(){
  const settings = ctx?.getSettings?.();
  const list = Array.isArray(settings?.slides?.badgeLibrary) ? settings.slides.badgeLibrary : [];
  const seen = new Set();
  const out = [];
  list.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const id = String(entry.id ?? '').trim();
    if (!id || seen.has(id)) return;
    const icon = typeof entry.icon === 'string' ? entry.icon : '';
    const label = typeof entry.label === 'string' ? entry.label : '';
    out.push({ id, icon, label });
    seen.add(id);
  });
  return out;
}

function renderBadgePicker(selectedIds = []){
  const host = $('#m_badgeList');
  if (!host) return;
  if (host._badgePointerHandler){
    document.removeEventListener('pointerdown', host._badgePointerHandler);
    delete host._badgePointerHandler;
  }
  if (host._badgeKeyHandler){
    document.removeEventListener('keydown', host._badgeKeyHandler);
    delete host._badgeKeyHandler;
  }
  host.classList.remove('is-open');
  const library = getBadgeLibrary();
  const selected = new Set((Array.isArray(selectedIds) ? selectedIds : []).map(id => String(id ?? '')).filter(Boolean));
  host.innerHTML = '';
  host.classList.remove('is-open', 'is-disabled');
  host.classList.add('badge-picker');

  if (!library.length){
    host.classList.add('is-disabled');
    const empty = document.createElement('div');
    empty.className = 'badge-picker-empty';
    empty.textContent = 'Keine Badges konfiguriert.';
    host.appendChild(empty);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'badge-picker-wrap';
  host.appendChild(wrapper);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'badge-picker-toggle';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');

  const toggleLabel = document.createElement('span');
  toggleLabel.className = 'badge-picker-toggle-label';
  toggle.appendChild(toggleLabel);

  wrapper.appendChild(toggle);

  const chips = document.createElement('div');
  chips.className = 'badge-picker-chips';
  wrapper.appendChild(chips);

  const popup = document.createElement('div');
  popup.className = 'badge-picker-popup';
  popup.setAttribute('role', 'listbox');
  popup.setAttribute('aria-hidden', 'true');
  wrapper.appendChild(popup);

  const optionList = document.createElement('div');
  optionList.className = 'badge-picker-options';
  popup.appendChild(optionList);

  const updateSummary = () => {
    const selectedBadges = library.filter(entry => selected.has(entry.id));
    toggleLabel.textContent = selectedBadges.length
      ? `${selectedBadges.length} ausgewählt`
      : 'Badges wählen';

    chips.innerHTML = '';
    if (!selectedBadges.length){
      const placeholder = document.createElement('span');
      placeholder.className = 'badge-picker-placeholder';
      placeholder.textContent = 'Keine Badges ausgewählt.';
      chips.appendChild(placeholder);
    } else {
      selectedBadges.forEach(entry => {
        const chip = document.createElement('span');
        chip.className = 'badge-picker-chip';
        const iconText = (entry.icon || '').trim();
        if (iconText){
          const media = document.createElement('span');
          media.className = 'badge-picker-chip-media';
          const iconEl = document.createElement('span');
          iconEl.className = 'badge-picker-chip-icon';
          iconEl.textContent = iconText;
          media.appendChild(iconEl);
          chip.appendChild(media);
        }
        const label = document.createElement('span');
        label.textContent = entry.label || entry.id;
        chip.appendChild(label);
        chips.appendChild(chip);
      });
    }

    const missing = Array.from(selected).filter(id => !library.some(b => b.id === id));
    if (missing.length){
      const note = document.createElement('div');
      note.className = 'badge-picker-missing';
      note.textContent = `Nicht verfügbar: ${missing.join(', ')}`;
      chips.appendChild(note);
    }
  };

  library.forEach(badge => {
    const option = document.createElement('label');
    option.className = 'badge-picker-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = badge.id;
    input.checked = selected.has(badge.id);
    input.tabIndex = -1;
    input.addEventListener('change', () => {
      if (input.checked){
        selected.add(badge.id);
      } else {
        selected.delete(badge.id);
      }
      option.classList.toggle('is-checked', input.checked);
      updateSummary();
    });

    const label = document.createElement('span');
    label.className = 'badge-picker-option-label';
    label.textContent = badge.label || badge.id;

    option.appendChild(input);
    const iconText = (badge.icon || '').trim();
    if (iconText){
      const media = document.createElement('span');
      media.className = 'badge-picker-option-media';
      const iconEl = document.createElement('span');
      iconEl.className = 'badge-picker-option-icon';
      iconEl.textContent = iconText;
      media.appendChild(iconEl);
      option.appendChild(media);
    }
    option.appendChild(label);
    option.classList.toggle('is-checked', input.checked);

    optionList.appendChild(option);
  });

  let pointerHandler = null;
  let keyHandler = null;

  const setOpen = (open) => {
    const isOpen = host.classList.contains('is-open');
    if (open === isOpen) return;
    if (open){
      host.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      popup.setAttribute('aria-hidden', 'false');
      optionList.querySelectorAll('input[type="checkbox"]').forEach(inp => { inp.tabIndex = 0; });
      pointerHandler = (ev) => {
        if (!wrapper.contains(ev.target)) setOpen(false);
      };
      keyHandler = (ev) => {
        if (ev.key === 'Escape'){ ev.preventDefault(); setOpen(false); toggle.focus(); }
      };
      document.addEventListener('pointerdown', pointerHandler);
      document.addEventListener('keydown', keyHandler);
      host._badgePointerHandler = pointerHandler;
      host._badgeKeyHandler = keyHandler;
    } else {
      host.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      popup.setAttribute('aria-hidden', 'true');
      optionList.querySelectorAll('input[type="checkbox"]').forEach(inp => { inp.tabIndex = -1; });
      if (pointerHandler){
        document.removeEventListener('pointerdown', pointerHandler);
        if (host._badgePointerHandler === pointerHandler) delete host._badgePointerHandler;
        pointerHandler = null;
      }
      if (keyHandler){
        document.removeEventListener('keydown', keyHandler);
        if (host._badgeKeyHandler === keyHandler) delete host._badgeKeyHandler;
        keyHandler = null;
      }
    }
  };

  toggle.addEventListener('click', () => {
    setOpen(!host.classList.contains('is-open'));
  });

  updateSummary();
  setOpen(false);
}

function pushHistory(){
  const sc = ctx.getSchedule();
  undoStack.push(cloneRows(sc.rows));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
}

function updateUndoRedoButtons(){
  const undoBtn = $('#btnUndo');
  const redoBtn = $('#btnRedo');
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}

function saveDraft(){
  try { localStorage.setItem('scheduleDraft', JSON.stringify(ctx.getSchedule())); } catch {}
}

function undo(){
  if (!undoStack.length) return;
  const sc = ctx.getSchedule();
  redoStack.push(cloneRows(sc.rows));
  sc.rows = undoStack.pop();
  renderGrid();
  updateSelTime();
  updateUndoRedoButtons();
  saveDraft();
}

function redo(){
  if (!redoStack.length) return;
  const sc = ctx.getSchedule();
  undoStack.push(cloneRows(sc.rows));
  sc.rows = redoStack.pop();
  renderGrid();
  updateSelTime();
  updateUndoRedoButtons();
  saveDraft();
}

function updateSelTime(){
  const sc = ctx.getSchedule();
  $('#selTime').textContent = sc.rows?.[curRow]?.time || '—';
}

function populateNoteSelect(){
  const sel = $('#m_note'); if (!sel) return;
  sel.innerHTML = '';
  const list = ctx.getSettings().footnotes || [];
  list.forEach(fn => {
    const o = document.createElement('option');
    o.value = fn.id;
    o.textContent = `${fn.label || '*'} — ${fn.text || ''}`;
    sel.appendChild(o);
  });
}

// --- Render Grid table ---
export function renderGrid(){
  const sc = ctx.getSchedule();

  const head = ['Zeit', ...(sc.saunas || [])];
  let html = '<thead><tr>' +
    head.map((h,i)=>`<th class="${i===0?'timecol corner':''}">${h}</th>`).join('') +
    '</tr></thead><tbody>';

  (sc.rows || []).forEach((row, ri) => {
    html += '<tr>';
    html += `<td class="time timecol" data-ri="${ri}">
               <input class="input" type="text" value="${row.time}" style="width:7.5ch;text-align:center">
             </td>`;
    (row.entries || []).forEach((cell, ci) => {
      const filled = (cell && cell.title) ? 'filled' : '';
      const label  = (cell && cell.title)
        ? (cell.title + (cell.flames ? (' · ' + cell.flames) : ''))
        : '—';
      html += `<td><button class="cellbtn ${filled}" data-ri="${ri}" data-ci="${ci}">${label}</button></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  $('#grid').innerHTML = html;

  // Zeit-Spalte
  $$('#grid .time input').forEach(inp => {
    inp.onchange = () => {
      const ri = +inp.parentElement.dataset.ri;
      const t  = parseTime(inp.value);
      const sc2 = ctx.getSchedule();
      if (!t) {
        alert('Bitte HH:MM');
        inp.value = sc2.rows[ri].time;
        return;
      }
      pushHistory();
      sc2.rows[ri].time = t;
      sc2.rows.sort((a,b)=>a.time.localeCompare(b.time));
      renderGrid();
    };
    inp.onclick = () => { curRow = +inp.parentElement.dataset.ri; updateSelTime(); };
  });

  // Zellen-Buttons
  $$('#grid .cellbtn').forEach(btn => {
    btn.onclick = () => {
      const sc2 = ctx.getSchedule();
      curRow = +btn.dataset.ri;
      curCol = +btn.dataset.ci;
      updateSelTime();

      const cell = sc2.rows[curRow].entries[curCol] || {};
      $('#m_time').value  = sc2.rows[curRow].time;
      $('#m_title').value = cell.title || '';
      $('#m_flames').value= cell.flames || '';
      $('#m_description').value = normalizeText(cell.description ?? cell.detail ?? cell.subtitle ?? cell.text ?? cell.extra ?? '');
      const initialBadgeIds = (() => {
        if (Array.isArray(cell.badgeIds) && cell.badgeIds.length) return cell.badgeIds;
        const legacyLabel = normalizeText(cell.type ?? '');
        if (!legacyLabel) return [];
        const library = getBadgeLibrary();
        const match = library.find(entry => entry.label && entry.label.trim().toLowerCase() === legacyLabel.toLowerCase());
        return match ? [match.id] : [];
      })();
      renderBadgePicker(initialBadgeIds);

      populateNoteSelect();
      const has = !!cell.noteId;
      $('#m_hasNote').checked = has;
      $('#m_noteRow').style.display = has ? 'flex' : 'none';
      if (has) $('#m_note').value = cell.noteId;

      $('#modal').style.display = 'grid';
      $('#m_title').focus();
    };
  });

  updateUndoRedoButtons();
  saveDraft();
}

// --- einmalige Dialog/Buttons-Wiring ---
function initOnce(){
  if (inited) return;
  inited = true;

  // Dialog
  $('#m_cancel').onclick = () => $('#modal').style.display = 'none';
  $('#m_hasNote').onchange = () => {
    $('#m_noteRow').style.display = $('#m_hasNote').checked ? 'flex' : 'none';
  };
  $('#m_ok').onclick = () => {
    const sc = ctx.getSchedule();

    const title   = $('#m_title').value.trim();
    const flames  = $('#m_flames').value;
    const newTime = parseTime($('#m_time').value);
    const hasNote = $('#m_hasNote').checked;
    const noteId  = hasNote ? $('#m_note').value : null;
    const description = $('#m_description').value.trim();
    const badgeIds = (() => {
      const host = $('#m_badgeList');
      if (!host) return [];
      const checked = Array.from(host.querySelectorAll('input[type=checkbox]:checked'));
      const unique = new Set();
      checked.forEach(inp => {
        const value = String(inp.value ?? '').trim();
        if (value) unique.add(value);
      });
      return Array.from(unique);
    })();

    if (!newTime && title) { alert('Bitte Zeit HH:MM'); return; }

    const newCell = title ? { title, flames } : null;
    if (newCell && hasNote) newCell.noteId = noteId;
    if (newCell){
      if (description) newCell.description = description;
      if (badgeIds.length) newCell.badgeIds = badgeIds;
    }

    pushHistory();

    if (newTime && newTime !== sc.rows[curRow].time && newCell){
      // ggf. neue Zeile anlegen/verschieben
      let targetIdx = sc.rows.findIndex(r => r.time === newTime);
      if (targetIdx === -1){
        const cols = sc.saunas.length;
        sc.rows.push({ time:newTime, entries: Array.from({length:cols}).map(()=>null) });
        sc.rows.sort((a,b)=>a.time.localeCompare(b.time));
        targetIdx = sc.rows.findIndex(r => r.time === newTime);
      }
      sc.rows[targetIdx].entries[curCol] = newCell;
      sc.rows[curRow].entries[curCol]    = null;
    } else {
      sc.rows[curRow].entries[curCol] = newCell;
      if (newTime) sc.rows[curRow].time = newTime;
    }
    sc.rows.sort((a,b)=>a.time.localeCompare(b.time));

    $('#modal').style.display = 'none';
    renderGrid();
  };

  // Row-Operationen
  $('#btnAddAbove').onclick = () => {
    const sc = ctx.getSchedule();
    pushHistory();
    const cols = sc.saunas.length;
    sc.rows.splice(curRow, 0, { time:'00:00', entries: Array.from({length:cols}).map(()=>null) });
    renderGrid();
  };
  $('#btnAddBelow').onclick = () => {
    const sc = ctx.getSchedule();
    pushHistory();
    const cols = sc.saunas.length;
    sc.rows.splice(curRow+1, 0, { time:'00:00', entries: Array.from({length:cols}).map(()=>null) });
    renderGrid();
  };
  $('#btnDeleteRow').onclick = () => {
    const sc = ctx.getSchedule();
    if (sc.rows.length > 1){
      pushHistory();
      sc.rows.splice(curRow, 1);
      curRow = Math.max(0, curRow - 1);
      renderGrid();
      updateSelTime();
    }
  };

  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;
}

// --- Public API ---
export function initGridUI(context){
  // context: { getSchedule:()=>schedule, getSettings:()=>settings }
  ctx = context;
  initOnce();
  updateSelTime();
  renderGrid();
  updateUndoRedoButtons();
}

export function getSelection(){ return { row:curRow, col:curCol }; }
export function setSelection(row, col){ curRow=row|0; curCol=col|0; updateSelTime(); }
