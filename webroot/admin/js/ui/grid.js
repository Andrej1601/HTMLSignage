// /admin/js/ui/grid.js
// Rendert die Übersichtstabelle (#grid), bedient den Zellen-Dialog und die Row-Buttons.
// Abhängigkeiten: utils ($,$$,parseTime) + Zugriff auf schedule/settings via init(ctx).

import { $, $$, parseTime } from '../core/utils.js';
import { sanitizeBadgeLibrary } from '../core/config.js';
import { notifyWarning } from '../core/notifications.js';

let ctx = null;           // { getSchedule, getSettings }
let curRow = 0, curCol = 0;
let inited = false;
let undoStack = [];
let redoStack = [];

const TIME_WIDTH_BASE_CH = 10;
const TIME_WIDTH_SCALE_MIN = 0.5;
const TIME_WIDTH_SCALE_MAX = 3;

function clampNumber(value, min, max){
  return Math.min(Math.max(value, min), max);
}

function getRowSortOffset(row){
  if (!row || typeof row !== 'object') return 0;
  const raw = Number(row.dayOffset ?? row.sortOffset);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(7, Math.max(0, Math.round(raw)));
}

function setRowSortOffset(row, offset){
  if (!row || typeof row !== 'object') return;
  const normalized = Number(offset);
  if (Number.isFinite(normalized) && normalized > 0){
    row.dayOffset = Math.min(7, Math.max(1, Math.round(normalized)));
  } else {
    delete row.dayOffset;
  }
}

function sortRows(rows = []){
  rows.sort((a, b) => {
    const offsetDiff = getRowSortOffset(a) - getRowSortOffset(b);
    if (offsetDiff !== 0) return offsetDiff;
    const timeA = typeof a?.time === 'string' ? a.time : '';
    const timeB = typeof b?.time === 'string' ? b.time : '';
    const cmp = timeA.localeCompare(timeB);
    if (cmp !== 0) return cmp;
    return 0;
  });
  return rows;
}

function resolveTimeWidthScale(fonts = {}){
  const rawScale = Number(fonts.overviewTimeWidthScale);
  if (Number.isFinite(rawScale) && rawScale > 0){
    return clampNumber(rawScale, TIME_WIDTH_SCALE_MIN, TIME_WIDTH_SCALE_MAX);
  }
  const legacyWidth = Number(fonts.overviewTimeWidthCh);
  if (Number.isFinite(legacyWidth) && legacyWidth > 0){
    const legacyScale = legacyWidth / TIME_WIDTH_BASE_CH;
    return clampNumber(legacyScale, TIME_WIDTH_SCALE_MIN, TIME_WIDTH_SCALE_MAX);
  }
  return 1;
}

function updateTimeColumnMetrics(table){
  if (!table) return;
  const settings = ctx?.getSettings?.() || {};
  const fonts = settings.fonts || {};
  const widthScale = resolveTimeWidthScale(fonts);
  const scaleRaw = Number(fonts.overviewTimeScale ?? fonts.overviewCellScale);
  const timeScale = Number.isFinite(scaleRaw) ? clampNumber(scaleRaw, 0.5, 3) : 1;
  table.style.setProperty('--grid-time-width-scale', String(widthScale));
  table.style.setProperty('--grid-time-width', `calc(${TIME_WIDTH_BASE_CH}ch * ${widthScale})`);
  table.style.setProperty('--grid-time-scale', String(timeScale));
}

function scheduleChanged(reason = 'grid-update'){
  if (!ctx || typeof ctx.notifyScheduleChanged !== 'function') return;
  try {
    ctx.notifyScheduleChanged({ reason });
  } catch (error) {
    console.warn('[admin] schedule change notification failed', error);
  }
}

function cloneCell(cell){
  if (!cell) return null;
  if (typeof structuredClone === 'function'){
    try { return structuredClone(cell); }
    catch {}
  }
  return JSON.parse(JSON.stringify(cell));
}

function cloneRows(rows){
  return (rows || []).map(r=>{
    const clone = {
      time: r.time,
      entries: (r.entries || []).map(cloneCell)
    };
    const offset = getRowSortOffset(r);
    if (offset) clone.dayOffset = offset;
    return clone;
  });
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
  const list = sanitizeBadgeLibrary(settings?.slides?.badgeLibrary, { assignMissingIds: false }) || [];
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
  const normalized = Array.isArray(selectedIds) ? selectedIds : [];
  const selectedList = [];
  normalized.forEach(id => {
    const value = String(id ?? '').trim();
    if (value && !selectedList.includes(value)) selectedList.push(value);
  });
  const selected = new Set(selectedList);
  host._badgeSelectedOrder = selectedList.slice();
  host.innerHTML = '';
  host.classList.remove('is-open', 'is-disabled');
  host.classList.add('badge-picker');

  if (!library.length){
    host._badgeSelectedOrder = [];
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

  const hint = document.createElement('div');
  hint.className = 'badge-picker-hint';
  hint.hidden = true;
  wrapper.insertBefore(hint, popup);

  const moveBadge = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= selectedList.length || fromIdx === toIdx) return false;
    const [id] = selectedList.splice(fromIdx, 1);
    selectedList.splice(toIdx, 0, id);
    return true;
  };

  let pendingFocus = null;

  const updateSummary = () => {
    const selectedBadges = selectedList
      .map(id => library.find(entry => entry.id === id))
      .filter(Boolean);
    toggleLabel.textContent = selectedList.length
      ? `${selectedList.length} ausgewählt`
      : 'Badges wählen';

    chips.innerHTML = '';
    if (!selectedBadges.length){
      const placeholder = document.createElement('span');
      placeholder.className = 'badge-picker-placeholder';
      placeholder.textContent = 'Keine Badges ausgewählt.';
      chips.appendChild(placeholder);
    } else {
      selectedBadges.forEach((entry, idx) => {
        const chip = document.createElement('span');
        chip.className = 'badge-picker-chip';
        chip.dataset.badgeId = entry.id;
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

        if (selectedBadges.length > 1){
          const controls = document.createElement('span');
          controls.className = 'badge-picker-chip-controls';

          const btnLeft = document.createElement('button');
          btnLeft.type = 'button';
          btnLeft.className = 'badge-picker-chip-move';
          btnLeft.dataset.dir = 'left';
          btnLeft.innerHTML = '◀';
          btnLeft.title = 'Badge nach links verschieben';
          btnLeft.disabled = (idx === 0);
          btnLeft.addEventListener('click', () => {
            pendingFocus = { id: entry.id, dir: 'left' };
            if (moveBadge(idx, idx - 1)) updateSummary();
          });

          const btnRight = document.createElement('button');
          btnRight.type = 'button';
          btnRight.className = 'badge-picker-chip-move';
          btnRight.dataset.dir = 'right';
          btnRight.innerHTML = '▶';
          btnRight.title = 'Badge nach rechts verschieben';
          btnRight.disabled = (idx === selectedBadges.length - 1);
          btnRight.addEventListener('click', () => {
            pendingFocus = { id: entry.id, dir: 'right' };
            if (moveBadge(idx, idx + 1)) updateSummary();
          });

          controls.appendChild(btnLeft);
          controls.appendChild(btnRight);
          chip.appendChild(controls);
        }

        chips.appendChild(chip);
      });
    }

    const missing = selectedList.filter(id => !library.some(b => b.id === id));
    if (missing.length){
      const note = document.createElement('div');
      note.className = 'badge-picker-missing';
      note.textContent = `Nicht verfügbar: ${missing.join(', ')}`;
      chips.appendChild(note);
    }

    if (selectedBadges.length > 1){
      hint.hidden = false;
      hint.textContent = 'Reihenfolge über die Pfeile anpassen.';
    } else {
      hint.hidden = true;
      hint.textContent = '';
    }

    host._badgeSelectedOrder = selectedList.slice();

    if (pendingFocus){
      requestAnimationFrame(() => {
        const chip = chips.querySelector(`[data-badge-id="${pendingFocus.id}"]`);
        if (!chip) { pendingFocus = null; return; }
        let target = null;
        if (pendingFocus.dir === 'left') {
          target = chip.querySelector('button[data-dir="left"]');
        } else if (pendingFocus.dir === 'right') {
          target = chip.querySelector('button[data-dir="right"]');
        }
        if (!target || target.disabled) target = chip.querySelector('button');
        if (target) target.focus();
        pendingFocus = null;
      });
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
      const id = badge.id;
      if (input.checked){
        selected.add(id);
        if (!selectedList.includes(id)) selectedList.push(id);
      } else {
        selected.delete(id);
        const idx = selectedList.indexOf(id);
        if (idx !== -1) selectedList.splice(idx, 1);
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
      if (pointerHandler) document.removeEventListener('pointerdown', pointerHandler);
      if (keyHandler) document.removeEventListener('keydown', keyHandler);
      delete host._badgePointerHandler;
      delete host._badgeKeyHandler;
    }
  };

  toggle.addEventListener('click', () => setOpen(!host.classList.contains('is-open')));

  updateSummary();
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
  scheduleChanged('undo');
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
  scheduleChanged('redo');
  renderGrid();
  updateSelTime();
  updateUndoRedoButtons();
  saveDraft();
}

function updateSelTime(){
  const sc = ctx.getSchedule();
  const row = Array.isArray(sc.rows) ? sc.rows[curRow] : null;
  if (!row){
    $('#selTime').textContent = '—';
    return;
  }
  const offset = getRowSortOffset(row);
  $('#selTime').textContent = offset ? `${row.time || '—'} (+${offset})` : (row.time || '—');
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

  const rows = Array.isArray(sc.rows) ? sc.rows : [];
  if (curRow >= rows.length) curRow = Math.max(0, rows.length - 1);
  rows.forEach((row, ri) => {
    html += '<tr>';
    const offset = getRowSortOffset(row);
    const offsetLabel = offset
      ? `<span class="time-offset" title="Nach Mitternacht einordnen">+${offset}</span>`
      : '';
    html += `<td class="time timecol" data-ri="${ri}" data-offset="${offset}">
               <input class="input time-input" type="text" value="${row.time ?? ''}" inputmode="numeric" autocomplete="off" spellcheck="false">
               ${offsetLabel}
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

  const table = $('#grid');
  table.innerHTML = html;
  updateTimeColumnMetrics(table);

  // Zeit-Spalte
  $$('#grid .time input').forEach(inp => {
    inp.onchange = () => {
      const cell = inp.closest('td');
      const ri = cell ? Number(cell.dataset.ri) : NaN;
      const sc2 = ctx.getSchedule();
      const rowsRef = Array.isArray(sc2.rows) ? sc2.rows : [];
      const rowRef = Number.isFinite(ri) ? rowsRef[ri] : null;
      const t  = parseTime(inp.value);
      if (!rowRef) return;
      if (!t) {
        notifyWarning('Bitte HH:MM');
        inp.value = rowRef.time || '';
        return;
      }
      pushHistory();
      rowRef.time = t;
      sortRows(rowsRef);
      curRow = Math.max(0, rowsRef.indexOf(rowRef));
      scheduleChanged('time-edit');
      renderGrid();
      updateSelTime();
    };
    inp.onclick = () => {
      const cell = inp.closest('td');
      curRow = cell ? Number(cell.dataset.ri) || 0 : 0;
      updateSelTime();
    };
  });

  // Zellen-Buttons
  $$('#grid .cellbtn').forEach(btn => {
    btn.onclick = () => {
      const sc2 = ctx.getSchedule();
      curRow = +btn.dataset.ri;
      curCol = +btn.dataset.ci;
      updateSelTime();

      const row = sc2.rows[curRow];
      const cell = row.entries[curCol] || {};
      $('#m_time').value  = row.time;
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

      const nextDayField = $('#m_nextDay');
      if (nextDayField) nextDayField.checked = getRowSortOffset(row) > 0;

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
    const rows = Array.isArray(sc.rows) ? sc.rows : [];
    const currentRow = rows[curRow];
    if (!currentRow) return;

    const title   = $('#m_title').value.trim();
    const flames  = $('#m_flames').value;
    const newTime = parseTime($('#m_time').value);
    const hasNote = $('#m_hasNote').checked;
    const noteId  = hasNote ? $('#m_note').value : null;
    const description = $('#m_description').value.trim();
    const badgeIds = (() => {
      const host = $('#m_badgeList');
      if (!host) return [];
      const ordered = Array.isArray(host._badgeSelectedOrder) ? host._badgeSelectedOrder : null;
      if (ordered && ordered.length){
        const unique = new Set();
        const list = [];
        ordered.forEach(id => {
          const value = String(id ?? '').trim();
          if (!value || unique.has(value)) return;
          unique.add(value);
          list.push(value);
        });
        if (list.length) return list;
      }

      const checked = Array.from(host.querySelectorAll('input[type=checkbox]:checked'));
      const unique = new Set();
      const list = [];
      checked.forEach(inp => {
        const value = String(inp.value ?? '').trim();
        if (!value || unique.has(value)) return;
        unique.add(value);
        list.push(value);
      });
      return list;
    })();

    if (!newTime && title) { notifyWarning('Bitte Zeit HH:MM'); return; }

    const newCell = title ? { title, flames } : null;
    if (newCell && hasNote) newCell.noteId = noteId;
    if (newCell){
      if (description) newCell.description = description;
      if (badgeIds.length) newCell.badgeIds = badgeIds;
    }

    const nextDayField = $('#m_nextDay');
    const sortOffset = nextDayField && nextDayField.checked ? 1 : 0;

    pushHistory();

    setRowSortOffset(currentRow, sortOffset);

    let targetRow = currentRow;

    if (newTime && newTime !== currentRow.time && newCell){
      // ggf. neue Zeile anlegen/verschieben
      let targetIdx = rows.findIndex((r, idx) => idx !== curRow && r.time === newTime && getRowSortOffset(r) === sortOffset);
      if (targetIdx === -1){
        const cols = sc.saunas.length;
        const newRow = { time:newTime, entries: Array.from({length:cols}).map(()=>null) };
        setRowSortOffset(newRow, sortOffset);
        rows.push(newRow);
        targetIdx = rows.length - 1;
      }
      targetRow = rows[targetIdx];
      targetRow.entries[curCol] = newCell;
      currentRow.entries[curCol]    = null;
    } else {
      currentRow.entries[curCol] = newCell;
      if (newTime) currentRow.time = newTime;
    }

    sortRows(rows);
    curRow = Math.max(0, rows.indexOf(targetRow));

    scheduleChanged('cell-edit');
    $('#modal').style.display = 'none';
    renderGrid();
    updateSelTime();
  };

  // Row-Operationen
  $('#btnAddAbove').onclick = () => {
    const sc = ctx.getSchedule();
    pushHistory();
    const cols = sc.saunas.length;
    const referenceOffset = getRowSortOffset(sc.rows[curRow]);
    const newRow = { time:'00:00', entries: Array.from({length:cols}).map(()=>null) };
    setRowSortOffset(newRow, referenceOffset);
    sc.rows.splice(curRow, 0, newRow);
    scheduleChanged('row-insert-above');
    renderGrid();
  };
  $('#btnAddBelow').onclick = () => {
    const sc = ctx.getSchedule();
    pushHistory();
    const cols = sc.saunas.length;
    const referenceOffset = getRowSortOffset(sc.rows[curRow]);
    const newRow = { time:'00:00', entries: Array.from({length:cols}).map(()=>null) };
    setRowSortOffset(newRow, referenceOffset);
    sc.rows.splice(curRow+1, 0, newRow);
    scheduleChanged('row-insert-below');
    renderGrid();
  };
  $('#btnDeleteRow').onclick = () => {
    const sc = ctx.getSchedule();
    if (sc.rows.length > 1){
      pushHistory();
      sc.rows.splice(curRow, 1);
      curRow = Math.max(0, curRow - 1);
      scheduleChanged('row-delete');
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
  const table = $('#grid');
  const updateMetricsFromControls = () => updateTimeColumnMetrics(table);
  ['#ovTimeWidthScale', '#ovTimeScale'].forEach(sel => {
    const el = document.querySelector(sel);
    if (!el || el.dataset.gridMetricsBound) return;
    el.addEventListener('input', updateMetricsFromControls);
    el.addEventListener('change', updateMetricsFromControls);
    el.dataset.gridMetricsBound = '1';
  });
  updateSelTime();
  renderGrid();
  updateUndoRedoButtons();
}

export function getSelection(){ return { row:curRow, col:curCol }; }
export function setSelection(row, col){ curRow=row|0; curCol=col|0; updateSelTime(); }
