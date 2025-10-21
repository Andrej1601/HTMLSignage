import { $, $$ } from '../../core/utils.js';
import { DEFAULTS } from '../../core/defaults.js';
import { syncActiveStyleSetSnapshot } from '../../ui/slides_master.js';

export function createColorsPanel({ getSettings }) {
  const colorField =(key,label,init) => {
    const valUp = String(init||'').toUpperCase();
    const valLow = valUp.toLowerCase();
    const row=document.createElement('div');
    row.className='kv';
    row.innerHTML = `
      <label>${label}</label>
      <div class="color-item">
        <div class="swatch" id="sw_${key}"></div>
        <input class="input" id="cl_${key}" type="text" value="${valUp}" placeholder="#RRGGBB">
        <input type="color" id="cp_${key}" value="${valLow}">
        <button class="btn sm ghost icon undo" type="button" title="Letzten Wert zurücksetzen" aria-label="Letzten Wert zurücksetzen">⟳</button>
      </div>`;
    return row;
  }
  const ensureColorTools = () => {
    const host = document.getElementById('colorList');
    if (!host) return;
    if (document.getElementById('colorToolsLink')) return; // schon da

    const link = document.createElement('a');
    link.id = 'colorToolsLink';
    link.href = 'https://colorhunt.co';
    link.target = '_blank';
    link.textContent = 'Colorhunt öffnen';

    // hinter die Farbliste setzen
    host.after(link);
  }
  const collectColors = () => {
    const settings = getSettings(); 
    const theme={...(settings.theme||{})};
    $$('#colorList input[type="text"]').forEach(inp=>{
      const v=String(inp.value).toUpperCase();
      if(/^#([0-9A-F]{6})$/.test(v)) theme[inp.id.replace(/^cl_/,'')]=v;
    });
    const bw=document.getElementById('bw_gridTableW');
    if(bw) theme.gridTableW = Math.max(0, Math.min(10, +bw.value||0));
    const cbw=document.getElementById('bw_chipBorderW');
    if(cbw) theme.chipBorderW = Math.max(0, Math.min(10, +cbw.value||0));
    return theme;
  }
  const renderColors = () => {
    const settings = getSettings();
    ensureColorTools();
  const host = $('#colorList');
    if (!host) return;
    host.innerHTML = '';
    const theme = settings.theme || {};

    // Grundfarben
    const A=document.createElement('div'); A.className='fieldset'; A.innerHTML='<div class="legend">Grundfarben</div>';
    A.appendChild(colorField('bg','Hintergrund', theme.bg||DEFAULTS.theme.bg));
    A.appendChild(colorField('fg','Vordergrund/Schrift', theme.fg||DEFAULTS.theme.fg));
    A.appendChild(colorField('accent','Akzent', theme.accent||DEFAULTS.theme.accent));

    // Übersichtstabelle
    const B=document.createElement('div'); B.className='fieldset'; B.innerHTML='<div class="legend">Übersichtstabelle</div>';
    B.appendChild(colorField('gridTable','Tabellenrahmen (nur Übersicht)', theme.gridTable||theme.gridBorder||DEFAULTS.theme.gridTable||DEFAULTS.theme.gridBorder));
    const bw=document.createElement('div'); bw.className='kv';
    bw.innerHTML='<label>Tabellenrahmen Breite (px)</label><input id="bw_gridTableW" class="input" type="number" min="0" max="10" step="1" value="'+(Number.isFinite(+theme.gridTableW)?theme.gridTableW:DEFAULTS.theme.gridTableW)+'">';
    B.appendChild(bw);
    B.appendChild(colorField('headRowBg','Kopfzeile Hintergrund', theme.headRowBg||DEFAULTS.theme.headRowBg));
    B.appendChild(colorField('headRowFg','Kopfzeile Schrift', theme.headRowFg||DEFAULTS.theme.headRowFg));
    B.appendChild(colorField('zebra1','Zebra (Inhalt) 1', theme.zebra1||DEFAULTS.theme.zebra1));
    B.appendChild(colorField('zebra2','Zebra (Inhalt) 2', theme.zebra2||DEFAULTS.theme.zebra2));
    B.appendChild(colorField('timeZebra1','Zeitspalte Zebra 1', theme.timeZebra1||DEFAULTS.theme.timeZebra1));
    B.appendChild(colorField('timeZebra2','Zeitspalte Zebra 2', theme.timeZebra2||DEFAULTS.theme.timeZebra2));
    B.appendChild(colorField('cornerBg','Ecke (oben-links) BG', theme.cornerBg||DEFAULTS.theme.cornerBg));
    B.appendChild(colorField('cornerFg','Ecke (oben-links) FG', theme.cornerFg||DEFAULTS.theme.cornerFg));
    B.appendChild(colorField('chipBorder','Chip-Rahmen', theme.chipBorder||DEFAULTS.theme.chipBorder));
    const chipBw=document.createElement('div'); chipBw.className='kv';
    chipBw.innerHTML='<label>Chip-Rahmen Breite (px)</label><input id="bw_chipBorderW" class="input" type="number" min="0" max="10" step="1" value="'+(Number.isFinite(+theme.chipBorderW)?theme.chipBorderW:DEFAULTS.theme.chipBorderW)+'">';
    B.appendChild(chipBw);

    // Saunafolien & Flammen
    const C=document.createElement('div'); C.className='fieldset'; C.innerHTML='<div class="legend">Sauna-Folien & Flammen</div>';
    C.appendChild(colorField('cellBg','Kachel-Hintergrund', theme.cellBg||DEFAULTS.theme.cellBg));
    C.appendChild(colorField('boxFg','Kachel-Schrift', theme.boxFg||DEFAULTS.theme.boxFg));
    C.appendChild(colorField('saunaColor','Sauna-Überschrift', theme.saunaColor||DEFAULTS.theme.saunaColor));
    C.appendChild(colorField('tileBorder','Kachel-Rahmen (nur Kacheln)', theme.tileBorder||theme.gridBorder||DEFAULTS.theme.tileBorder||DEFAULTS.theme.gridBorder));
    C.appendChild(colorField('flame','Flammen', theme.flame||DEFAULTS.theme.flame));

    host.appendChild(A); host.appendChild(B); host.appendChild(C);

    // Swatch-Vorschau & Synchronisation
    $$('#colorList .color-item').forEach(item=>{
      const txt = item.querySelector('input[type="text"]');
      const pick = item.querySelector('input[type="color"]');
      const sw = item.querySelector('.swatch');
      const undo = item.querySelector('.undo');
      const setVal = v=>{
        const hex = v.startsWith('#') ? v : '#'+v;
        if(!/^#([0-9A-Fa-f]{6})$/.test(hex)) return;
        sw.style.background = hex;
        pick.value = hex.toLowerCase();
        txt.value = hex.toUpperCase();
      };
      setVal(txt.value);
      item.dataset.prev = txt.value;
      txt.addEventListener('input',()=>{
        txt.value = txt.value.toUpperCase();
        if(/^#([0-9A-F]{6})$/.test(txt.value)) setVal(txt.value);
      });
      pick.addEventListener('input',()=> setVal(pick.value));
      if(undo){
        undo.addEventListener('click',()=>{
          const prev = item.dataset.prev;
          if(!prev) return;
          setVal(prev);
          item.dataset.prev = prev;
        });
        [txt,pick].forEach(el=>{
          el.addEventListener('keydown',e=>{
            if((e.ctrlKey||e.metaKey) && e.key==='z'){
              e.preventDefault();
              undo.click();
            }
          });
        });
      }
    });

    $('#resetColors').onclick = ()=>{
      $$('#colorList .color-item').forEach(item=>{
        const txt = item.querySelector('input[type="text"]');
        const pick = item.querySelector('input[type="color"]');
        const k = txt.id.replace(/^cl_/,'');
        const def = DEFAULTS.theme[k]||'#FFFFFF';
        txt.value = def;
        pick.value = def;
        const sw = item.querySelector('.swatch'); if(sw) sw.style.background=def;
      });
      const bws=document.getElementById('bw_gridTableW');
      if(bws) bws.value = DEFAULTS.theme.gridTableW ?? 2;
      const cbw=document.getElementById('bw_chipBorderW');
      if(cbw) cbw.value = DEFAULTS.theme.chipBorderW ?? 2;
      settings.theme = collectColors();
      try { syncActiveStyleSetSnapshot(settings, { includeFonts:false, includeSlides:false, includeDisplay:false }); }
      catch (error) { console.warn('[admin] Style palette sync failed after color reset', error); }
      window.__queueUnsaved?.();
      window.__markUnsaved?.();
      if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
    };

    if (host && !host.dataset.themeSyncBound) {
      const commitTheme = () => {
        settings.theme = collectColors();
        try { syncActiveStyleSetSnapshot(settings, { includeFonts:false, includeSlides:false, includeDisplay:false }); }
        catch (error) { console.warn('[admin] Style palette sync failed after color change', error); }
        window.__queueUnsaved?.();
        window.__markUnsaved?.();
        if (typeof window.dockPushDebounced === 'function') window.dockPushDebounced();
      };
      host.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.id.startsWith('cl_') || target.id.startsWith('cp_') || target.id === 'bw_gridTableW' || target.id === 'bw_chipBorderW') {
          commitTheme();
        }
      });
      host.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.type === 'color' || target.type === 'number') {
          if (target.id.startsWith('cp_') || target.id === 'bw_gridTableW' || target.id === 'bw_chipBorderW') {
            commitTheme();
          }
        }
      });
      host.dataset.themeSyncBound = '1';
    }
  }
  return { renderColors, collectColors };
}
