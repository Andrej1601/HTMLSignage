import { $, genId } from '../../core/utils.js';

export function createFootnotesPanel({ getSettings }) {
  const fnRow = (settings, fn, index, rerender) => {
    const wrap=document.createElement('div'); wrap.className='kv';
    wrap.innerHTML = `
      <label>Label/Text</label>
      <div class="row" style="gap:8px;flex-wrap:nowrap">
        <input class="input" id="fn_l_${index}" value="${fn.label||'*'}" style="width:6ch"/>
        <input class="input" id="fn_t_${index}" value="${fn.text||''}" style="min-width:0"/>
        <button class="btn sm" id="fn_x_${index}">✕</button>
      </div>`;
    wrap.querySelector(`#fn_l_${index}`).onchange=(e)=>{ fn.label = (e.target.value||'*').slice(0,2); };
    wrap.querySelector(`#fn_t_${index}`).onchange=(e)=>{ fn.text = e.target.value||''; };
    wrap.querySelector(`#fn_x_${index}`).onclick=()=>{ settings.footnotes.splice(index,1); rerender(); };
    return wrap;
  };
  const renderFootnotes = () => {
    const settings = getSettings();
    const host=$('#fnList'); if (!host) return;
    const section = $('#footnoteSection');
    const toggle = $('#footnoteToggle');
    const body = $('#footnoteBody');

    const getExpanded = () => !!(toggle && toggle.getAttribute('aria-expanded') === 'true');
    const setExpanded = (expanded) => {
      const isExpanded = !!expanded;
      if (toggle){ toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false'); }
      if (body){ body.setAttribute('aria-hidden', isExpanded ? 'false' : 'true'); }
      if (section){ section.classList.toggle('is-open', isExpanded); }
    };

    if (toggle && !toggle.dataset.bound){
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', () => {
        setExpanded(!getExpanded());
      });
    }

    const forceOpen = (body && body.dataset.forceOpen === '1');
    if (body) delete body.dataset.forceOpen;
    setExpanded(forceOpen ? true : getExpanded());

    host.innerHTML='';
    const layoutSel = document.getElementById('footnoteLayout');
    if (layoutSel){ layoutSel.value = settings.footnoteLayout || 'one-line'; layoutSel.onchange = ()=>{ settings.footnoteLayout = layoutSel.value; }; }
    const list = settings.footnotes || [];
    if (section) section.classList.toggle('has-items', list.length > 0);
    list.forEach((entry,i)=> host.appendChild(fnRow(settings, entry, i, renderFootnotes)));
    $('#fnAdd').onclick=()=>{
      (settings.footnotes ||= []).push({id:genId(), label:'*', text:''});
      if (body) body.dataset.forceOpen = '1';
      renderFootnotes();
    };
  };

  return { renderFootnotes };
}
