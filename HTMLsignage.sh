#!/usr/bin/env bash
# file: /root/signage_web_install.sh
# Zweck   : Web-native Digital Signage (HTML/JS) mit Editor & Settings – 16:9 fix, Zebra, Hex-Farben
#           Enthält alle bisherigen Patches + (a) rechte Spalte Breite (%) + (b) Kachelbreite Min/Max
# Stack   : Nginx + PHP-FPM (ohne OnlyOffice)
# Ziel-OS : Ubuntu 24.04 (root erforderlich)

set -Eeuo pipefail
IFS=$'\n\t'
C_G="\033[1;32m"; C_B="\033[1;34m"; C_R="\033[1;31m"; C_0="\033[0m"
ok(){   echo -e "${C_G}[OK  ]${C_0} $*"; }
info(){ echo -e "${C_B}[INFO]${C_0} $*"; }
err(){  echo -e "${C_R}[ERR ]${C_0} $*"; }
trap 'rc=$?; line=${BASH_LINENO[0]:-0}; [[ $rc -ne 0 ]] && err "Abbruch in Zeile $line (RC=$rc)"; exit $rc' ERR

# ---------------------------
# Defaults (anpassbar via ENV)
# ---------------------------
: "${SIGNAGE_PUBLIC_PORT:=80}"
: "${SIGNAGE_ADMIN_PORT:=8888}"
: "${SIGNAGE_ADMIN_USER:=admin}"
: "${SIGNAGE_ADMIN_PASS:=admin}"
: "${SETUP_UFW:=1}"

# ---------------------------
# Pakete
# ---------------------------
info "Pakete installieren…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx php8.3-fpm php8.3-cli php8.3-xml php8.3-mbstring php8.3-curl \
                   jq unzip curl git

systemctl enable --now nginx php8.3-fpm

# ---------------------------
# Verzeichnisse
# ---------------------------
install -d -o www-data -g www-data -m 2775 /var/www/signage
install -d -o www-data -g www-data -m 2775 /var/www/signage/{admin,assets,assets/img,data}
install -o www-data -g www-data -m 0644 /dev/null /var/www/signage/favicon.ico || true

# ---------------------------
# Startdaten (Schedule + Settings)
# ---------------------------
cat >/var/www/signage/data/schedule.json <<'JSON'
{
  "version": 1,
  "saunas": ["Aufgusssauna","Finnische Sauna","Kelosauna","Dampfbad","Fenster zur Welt"],
  "rows": [
    {"time":"11:00","entries":[null,{"title":"Guten Morgen","flames":"1"},null,null,null]},
    {"time":"11:30","entries":[null,null,null,null,{"title":"Soft","flames":"1"}]},
    {"time":"12:00","entries":[null,null,{"title":"Sudritual","flames":"2"},null,null]},
    {"time":"13:00","entries":[{"title":"Waldauszeit","flames":"2"},null,null,null,null]},
    {"time":"13:30","entries":[null,null,null,{"title":"Salz","flames":"1"},null]},
    {"time":"14:00","entries":[null,{"title":"Fruchtoase","flames":"2"},null,null,{"title":"Soft","flames":"1-2"}]},
    {"time":"15:00","entries":[null,null,null,{"title":"Maske","flames":"1"},null]},
    {"time":"15:30","entries":[{"title":"Vulkan","flames":"3"},null,null,null,null]},
    {"time":"16:00","entries":[null,null,null,null,{"title":"Soft","flames":"1"}]},
    {"time":"16:30","entries":[{"title":"Überraschung","flames":"2-3"},null,null,null,null]},
    {"time":"17:00","entries":[null,{"title":"Saisonzeit","flames":"2"},null,null,null]},
    {"time":"17:30","entries":[null,null,null,{"title":"Honig","flames":"1"},null]},
    {"time":"18:00","entries":[{"title":"Vulkan","flames":"3"},null,null,null,null]},
    {"time":"18:30","entries":[null,null,null,null,{"title":"Soft","flames":"1"}]},
    {"time":"19:00","entries":[{"title":"Ice on Fire","flames":"3"},null,null,null,null]},
    {"time":"19:30","entries":[null,null,null,{"title":"Peeling","flames":"1"},null]},
    {"time":"20:00","entries":[null,null,{"title":"Sudritual","flames":"2"},null,null]},
    {"time":"21:00","entries":[{"title":"Waldauszeit","flames":"2"},null,null,null,null]},
    {"time":"22:00","entries":[null,{"title":"Gute Nacht*","flames":"1"},null,null,null]}
  ]
}
JSON

cat >/var/www/signage/data/settings.json <<'JSON'
{
  "version": 1,
  "theme": {
    "bg": "#E8DEBD",
    "fg": "#5C3101",
    "accent": "#5C3101",
    "gridBorder": "#5C3101",
    "cellBg": "#5C3101",
    "boxFg": "#FFFFFF",
    "saunaColor": "#5C3101",
    "timeColBg": "#E8DEBD",
    "flame": "#FFD166",
    "zebra1": "#EDDFAF",
    "zebra2": "#E6D6A1"
  },
  "fonts": {
    "family": "-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
    "scale": 1.00
  },
  "display": {
    "rightWidthPercent": 38,
    "cutTopPercent": 28,
    "cutBottomPercent": 12
  },
  "slides": {
    "overviewDurationSec": 10,
    "saunaDurationSec": 6,
    "transitionMs": 500,
    "tileWidthPercent": 45,
    "tileMinPx": 480,
    "tileMaxPx": 1100,
    "loop": true,
    "order": ["overview","Aufgusssauna","Finnische Sauna","Kelosauna","Dampfbad","Fenster zur Welt"]
  },
  "assets": {
    "rightImages": {
      "Aufgusssauna": "/assets/img/right_default.svg",
      "Finnische Sauna": "/assets/img/right_default.svg",
      "Kelosauna": "/assets/img/right_default.svg",
      "Dampfbad": "/assets/img/right_default.svg",
      "Fenster zur Welt": "/assets/img/right_default.svg"
    },
    "flameImage": "/assets/img/flame_test.svg"
  },
  "footnote": "* Nur am Fr und Sa"
}
JSON

# Platzhalterbilder
cat >/var/www/signage/assets/img/right_default.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1600" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#8b5a2b"/>
      <stop offset="100%" stop-color="#5C3101"/>
    </linearGradient>
  </defs>
  <rect fill="url(#g)" width="100%" height="100%"/>
</svg>
SVG

cat >/var/www/signage/assets/img/flame_test.svg <<'SVG'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="#FFD166"/><stop offset="100%" stop-color="#E07B27"/>
  </linearGradient></defs>
  <path fill="url(#g)" d="M32 4c5 8-3 10-3 14 0 2 2 4 5 4 5 0 8-5 8-9 6 5 12 12 12 21 0 12-9 26-22 26S10 46 10 34c0-15 14-21 22-30z"/>
</svg>
SVG

chown -R www-data:www-data /var/www/signage/data /var/www/signage/assets
find /var/www/signage/assets -type f -exec chmod 0644 {} +

# ---------------------------
# Static: Slideshow (index.html + CSS + JS)
# ---------------------------
cat >/var/www/signage/index.html <<'HTML'
<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aufguss – Slideshow</title>
<link rel="stylesheet" href="/assets/design.css">
</head><body class="slideshow">
  <div id="fitbox" class="fitbox">
    <div id="canvas" class="canvas">
      <div id="stage" class="stage"></div>
    </div>
  </div>
  <script src="/assets/slideshow.js" defer></script>
</body></html>
HTML

cat >/var/www/signage/assets/design.css <<'CSS'
:root{
  /* theme */
  --bg:#E8DEBD; --fg:#5C3101; --accent:#5C3101;
  --grid:#5C3101; --cell:#5C3101; --boxfg:#FFFFFF; --timecol:#E8DEBD;
  --flame:#FFD166; --zebra1:#EDDFAF; --zebra2:#E6D6A1; --hlColor:#FFDD66;
  /* typography */
  --font:-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  --scale:1;            /* global */
  --h1Scale:1.00;       /* extra multiplier for H1 */
  --h2Scale:1.00;       /* extra multiplier for H2 */
  --ovHeadScale:0.90;   /* overview thead */
  --ovCellScale:0.80;   /* overview body */
  --tileTextScale:0.80; /* sauna tile text (default 20% kleiner) */
  --tileWeight:600;     /* 400/500/600/700 */
  --flameSizePx:28;     /* base flame icon px */

  /* 16:9 base canvas */
  --baseW:1920; --baseH:1080;

  /* right panel shape */
  --rightW:38%;         /* percent of canvas width */
  --cutTop:28%;         /* polygon anchor X top */
  --cutBottom:12%;      /* polygon anchor X bottom */

  /* sauna tile width clamp (works in design pixels, then scaled by canvas) */
  --tileMinPx:480px; --tileMaxPx:1100px; --tileVW:45; /* vw relative, used only in vw-mode variants */
}
*{box-sizing:border-box}
html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font-family:var(--font)}
.slideshow{overflow:hidden}

/* 16:9 Canvas – fixed design, scaled to viewport */
.fitbox{position:fixed; inset:0; display:grid; place-items:center; background:var(--bg); height:100svh; min-height:100vh}
.canvas{position:relative; width:calc(var(--baseW) * 1px); height:calc(var(--baseH) * 1px); transform-origin:top left}
.stage{position:relative; width:100%; height:100%; overflow:hidden}

.fade{opacity:0;transition:opacity .5s}
.fade.show{opacity:1}

/* layout */
.container{position:relative; height:100%; padding:32px 30px; display:flex; flex-direction:column; align-items:flex-start}
.container.has-right{padding-right:calc(var(--rightW) + 30px)}
.container.overview{padding-right:30px}
.h1{font-weight:800;letter-spacing:.02em;font-size:calc(56px*var(--scale)*var(--h1Scale));margin:0 0 10px}
.h2{font-weight:700;letter-spacing:.01em;opacity:.95;font-size:calc(36px*var(--scale)*var(--h2Scale));margin:0 0 14px}
.caption{opacity:.85;font-size:calc(20px*var(--scale))}

/* content area under headings is vertically centered */
.body{flex:1; display:flex}
.list{display:flex;flex-direction:column;gap:18px;width:100%;align-items:flex-start;justify-content:center}

/* right image panel with adjustable diagonal */
.rightPanel{
  position:absolute; top:0; right:0; height:100%; width:var(--rightW);
  background-size:cover; background-position:center; background-repeat:no-repeat;
  -webkit-clip-path: polygon(var(--cutTop) 0, 100% 0, 100% 100%, var(--cutBottom) 100%);
          clip-path: polygon(var(--cutTop) 0, 100% 0, 100% 100%, var(--cutBottom) 100%);
  box-shadow: -6px 0 20px rgba(0,0,0,.15) inset;
}

/* overview table */
.grid{width:100%;max-width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
.grid th,.grid td{border:2px solid var(--grid);white-space:nowrap}
.grid thead th{font-size:calc(22px*var(--scale)*var(--ovHeadScale));padding:8px 12px;text-align:center;background:transparent;color:var(--fg)}
.grid tbody tr:nth-child(odd) td{background:var(--zebra1)}
.grid tbody tr:nth-child(even) td{background:var(--zebra2)}
.grid td{font-size:calc(22px*var(--scale)*var(--ovCellScale));padding:8px 12px}
.grid .timecol{background:var(--timecol)!important;text-align:center;font-weight:800;min-width:10ch;color:var(--fg)}
.cellwrap{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;min-width:0}
.cellwrap .chip{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
.cellwrap .flames{flex:0 0 auto}
.chip{display:inline-block;padding:.35em .6em;border-radius:10px;background:var(--cell);color:var(--boxfg);border:2px solid var(--grid);font-weight:700;letter-spacing:.2px}
.chip sup{font-weight:900;margin-left:.25em}

/* overview auto-fit wrapper keeps left edge aligned */
.ovwrap{transform-origin:top left; width:100%}

/* sauna tiles */
.tile{display:grid; grid-template-columns:1fr auto; align-items:center; gap:16px;
  width: clamp(var(--tileMinPx), calc(var(--tileVW) * 1vw), var(--tileMaxPx));
  padding:14px 18px; background:var(--cell); border:3px solid var(--grid); border-radius:16px; color:var(--boxfg);
}
.title{font-size:calc(40px*var(--scale)*var(--tileTextScale)); font-weight:var(--tileWeight)}
.flames{display:flex;gap:10px;align-items:center; justify-self:end}
.flame{width:calc(var(--flameSizePx)*1px*var(--scale)); height:calc(var(--flameSizePx)*1px*var(--scale))}
.flame img,.flame svg{width:100%;height:100%;object-fit:contain}
.flame svg path{fill:var(--flame)}

/* highlight */
.tile.highlight{border-color:var(--hlColor); box-shadow:0 0 0 4px var(--hlColor) inset}
.chip.highlight{outline:3px solid var(--hlColor); outline-offset:2px}

.footer-note{margin-top:12px;font-size:calc(16px*var(--scale));opacity:.9}
.brand{position:absolute;right:20px;bottom:16px;opacity:.6;font-size:14px;color:var(--fg)}
CSS

cat >/var/www/signage/assets/slideshow.js <<'JS'
(() => {
  const FITBOX = document.getElementById('fitbox');
  const CANVAS = document.getElementById('canvas');
  const STAGE = document.getElementById('stage');
  let schedule = null, settings = null, nextQueue = [], idx = 0;

  const nowMinutes = () => {
    const d = new Date();
    return d.getHours()*60 + d.getMinutes();
  };
  const parseHM = (hm) => { const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hm||''); return m ? (+m[1])*60 + (+m[2]) : null; };

  async function loadJSON(u) {
    const r = await fetch(u + '?t=' + Date.now(), {cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status+' for '+u);
    return await r.json();
  }
  async function loadAll() {
    const [s, cfg] = await Promise.all([
      loadJSON('/data/schedule.json'),
      loadJSON('/data/settings.json')
    ]);
    schedule = s; settings = cfg;
    applyTheme();
    applyDisplay();
    buildQueue();
  }

  function ensureFontFamily(){
    const fam = settings?.fonts?.family || '';
    if (/montserrat/i.test(fam)) {
      if (!document.getElementById('gfont_mont')){
        const l = document.createElement('link'); l.id='gfont_mont'; l.rel='stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(l);
      }
    }
  }

  function applyTheme(){
    const t = settings?.theme || {};
    const map = {
      '--bg': t.bg, '--fg': t.fg, '--accent': t.accent,
      '--grid': t.gridBorder, '--cell': t.cellBg, '--boxfg': t.boxFg,
      '--timecol': t.timeColBg, '--flame': t.flame,
      '--zebra1': t.zebra1, '--zebra2': t.zebra2,
      '--hlColor': (settings?.highlightNext?.color || '#FFDD66'),
      '--scale': settings?.fonts?.scale,
      '--h1Scale': settings?.fonts?.h1Scale || 1,
      '--h2Scale': settings?.fonts?.h2Scale || 1,
      '--ovHeadScale': settings?.fonts?.overviewHeadScale || 0.9,
      '--ovCellScale': settings?.fonts?.overviewCellScale || 0.8,
      '--tileTextScale': settings?.fonts?.tileTextScale || 0.8,
      '--tileWeight': settings?.fonts?.tileWeight || 600,
    };
    for (const [k,v] of Object.entries(map)) if (v!==undefined && v!==null) document.documentElement.style.setProperty(k, String(v));
    if (settings?.fonts?.family) document.documentElement.style.setProperty('--font', settings.fonts.family);
    ensureFontFamily();
  }

  function applyDisplay(){
    const d = settings?.display || {}; const baseW = d.baseW||1920, baseH = d.baseH||1080;
    document.documentElement.style.setProperty('--baseW', baseW);
    document.documentElement.style.setProperty('--baseH', baseH);
    // right panel shape
    if (typeof d.rightWidthPercent === 'number') document.documentElement.style.setProperty('--rightW', d.rightWidthPercent+'%');
    if (typeof d.cutTopPercent === 'number') document.documentElement.style.setProperty('--cutTop', d.cutTopPercent+'%');
    if (typeof d.cutBottomPercent === 'number') document.documentElement.style.setProperty('--cutBottom', d.cutBottomPercent+'%');

    const fit = d.fit||'contain';
    const fitOnce = () => {
      const vw = FITBOX.clientWidth, vh = FITBOX.clientHeight;
      const sW = vw / baseW; const sH = vh / baseH;
      let s = (fit==='width') ? sW : Math.min(sW, sH);
      if (fit==='width' && baseH*s > vh) s = Math.min(sW, sH); // fallback if too tall
      CANVAS.style.transform = `scale(${s})`;
    };
    window.onresize = fitOnce; fitOnce();
  }

  function buildQueue(){
    nextQueue = [];
    const order = settings?.slides?.order ?? ['overview', ...(schedule?.saunas||[])];
    for (const entry of order) {
      if (entry==='overview') nextQueue.push({type:'overview'});
      else if (schedule.saunas.includes(entry)) nextQueue.push({type:'sauna', sauna: entry});
    }
    idx = 0;
  }

  function h(tag, attrs={}, children=[]){
    const el = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k==='class') el.className=v; else if (k==='style') el.setAttribute('style', v); else el.setAttribute(k,v);
    }
    for (const c of [].concat(children)) { if (typeof c==='string') el.appendChild(document.createTextNode(c)); else if (c) el.appendChild(c); }
    return el;
  }

  function inlineFlameSVG(){
    return h('svg', {viewBox:'0 0 24 24', 'aria-hidden':'true'}, [h('path', {d:'M12 2c2 4-1 5-1 7 0 1 1 2 2 2 2 0 3-2 3-4 2 2 4 4 4 7 0 4-3 8-8 8s-8-4-8-8c0-5 5-7 8-12z'})]);
  }
  function flameNode() {
    const url = settings?.assets?.flameImage || '/assets/img/flame_test.svg';
    const box = h('div', {class:'flame'});
    if (url) { const img = h('img', {src:url, alt:''}); img.addEventListener('error', () => { box.innerHTML=''; box.appendChild(inlineFlameSVG()); }); box.appendChild(img); return box; }
    box.appendChild(inlineFlameSVG()); return box;
  }
  function flamesWrap(spec){
    let count = 0, approx = false;
    if (!spec) count = 0; else if (spec==='1') count=1; else if (spec==='2') count=2; else if (spec==='3') count=3; else if (spec==='1-2'){count=2;approx=true;} else if (spec==='2-3'||spec==='1-3'){count=3;approx=true;}
    const wrap = h('div', {class:'flames'+(approx?' approx':'')});
    wrap.appendChild(count>=1 ? flameNode() : h('span'));
    wrap.appendChild(count>=2 ? flameNode() : h('span'));
    wrap.appendChild(count>=3 ? flameNode() : h('span'));
    return wrap;
  }

  // ---- Highlight logic (window before/after start) ----
  function getHighlightMap(){
    const HL = settings?.highlightNext || {};
    if (!HL.enabled) return { bySauna:{}, byCell:{} };
    const win = Number.isFinite(+HL.minutesWindow) ? +HL.minutesWindow : (Number.isFinite(+HL.minutesAfter) ? +HL.minutesAfter : 15);
    const now = nowMinutes();
    const bySauna = {};   // saunaName -> set of HM strings to highlight
    const byCell = {};    // key `r{rowIdx}c{colIdx}` -> true for overview

    schedule.saunas.forEach((saunaName, colIdx)=>{
      const times = [];
      schedule.rows.forEach((row, ri)=>{
        const cell = row.entries[colIdx];
        if (cell && cell.title){ const m = parseHM(row.time); if (m!==null) times.push({m, ri, time:row.time}); }
      });
      times.sort((a,b)=>a.m-b.m);
      let chosen = null;
      // 1) active within [start, start+win]
      for (const t of times){ if (now>=t.m && now<=t.m+win){ chosen=t; break; } }
      // 2) pre-window highlight if within win minutes before next start
      if (!chosen){ for (const t of times){ if (t.m>=now && (t.m-now)<=win){ chosen=t; break; } } }
      // 3) else nothing
      if (chosen){
        bySauna[saunaName] = new Set([chosen.time]);
        byCell[`r${chosen.ri}c${colIdx}`] = true;
      }
    });
    return {bySauna, byCell};
  }

  function tableGrid(hlMap){
    const t = h('table', {class:'grid'});
    const thead = h('thead'); const tr = h('tr');
    tr.appendChild(h('th', {class:'timecol'}, 'Zeit'));
    for (const s of schedule.saunas) tr.appendChild(h('th', {}, s));
    thead.appendChild(tr); t.appendChild(thead);
    const tb = h('tbody');
    schedule.rows.forEach((row, ri)=>{
      const trr = h('tr'); trr.appendChild(h('td', {class:'timecol'}, row.time));
      row.entries.forEach((cell, ci) => {
        const td = h('td', {}, []);
        const key = `r${ri}c${ci}`;
        if (cell && cell.title) {
          const title = cell.title.replace(/\*+$/,'');
          const hasStar = /\*$/.test(cell.title||'');
          const chip = h('span', {class:'chip'+(hlMap.byCell[key]?' highlight':'' )}, title);
          if (hasStar) chip.appendChild(h('sup', {}, '*'));
          const wrap = h('div', {class:'cellwrap'}, [ chip, flamesWrap(cell.flames||'') ]);
          td.appendChild(wrap);
        } else { td.appendChild(h('div', {class:'caption'}, '—')); }
        trr.appendChild(td);
      });
      tb.appendChild(trr);
    });
    t.appendChild(tb);

    const anyStar = schedule.rows.some(r => (r.entries||[]).some(c => c && /\*$/.test(c.title||'')));
    if (anyStar && settings?.footnote) return h('div', {}, [t, h('div', {class:'footer-note'}, settings.footnote)]);
    return t;
  }

  function fitOverview(container){
    const headH = Array.from(container.querySelectorAll('.h1,.h2')).reduce((a,el)=>a+el.getBoundingClientRect().height,0);
    const wrap = container.querySelector('.ovwrap'); if (!wrap) return;
    wrap.style.transform = 'scale(1)';
    const availW = container.clientWidth - 2; // padding already applied by parent
    const availH = container.clientHeight - headH - 16;
    const box = wrap.getBoundingClientRect();
    const s = Math.min( availW / Math.max(1, box.width), availH / Math.max(1, box.height) );
    wrap.style.transform = `scale(${Math.min(1, s)})`;
  }

  function renderOverview(){
    const hlMap = getHighlightMap();
    const table = tableGrid(hlMap);
    const c = h('div', {class:'container overview fade show'}, [ h('h1', {class:'h1'}, 'Aufgussplan'), h('div', {class:'ovwrap'}, [table]) ]);
    setTimeout(()=>fitOverview(c),0); window.onresize = () => fitOverview(c);
    return c;
  }

  function renderSauna(name){
    const hlMap = getHighlightMap();
    const rightUrl = settings?.assets?.rightImages?.[name] || '';
    const c = h('div', {class:'container has-right fade show'}, [
      h('div', {class:'rightPanel', style: rightUrl ? `background-image:url("${rightUrl}");` : 'display:none;'}),
      h('h1', {class:'h1', style:'color:var(--saunaColor);'}, name),
      h('h2', {class:'h2'}, 'Aufgusszeiten')
    ]);

    const body = h('div', {class:'body'}); const list = h('div', {class:'list'});
    const colIdx = schedule.saunas.indexOf(name);
    const items = [];
    for (const row of schedule.rows) {
      const cell = row.entries[colIdx];
      if (cell && cell.title) items.push({time: row.time, title: cell.title, flames: cell.flames||''});
    }
    items.sort((a,b)=>a.time.localeCompare(b.time));

    for (const it of items) {
      const title = it.title.replace(/\*+$/,'');
      const hasStar = /\*$/.test(it.title||'');
      const label = `${it.time} Uhr – ${title}`;
      const isHL = hlMap.bySauna[name] && hlMap.bySauna[name].has(it.time);
      const tile = h('div', {class:'tile'+(isHL?' highlight':'')}, [ h('div', {class:'title'}, label + (hasStar?'*':'')), flamesWrap(it.flames) ]);
      list.appendChild(tile);
    }
    if (items.length===0) list.appendChild(h('div', {class:'caption'}, 'Keine Einträge.'));

    body.appendChild(list); c.appendChild(body);

    const hasStar = items.some(x => /\*$/.test(x.title));
    if (hasStar && settings?.footnote) c.appendChild(h('div', {class:'footer-note'}, settings.footnote));

    c.appendChild(h('div', {class:'brand'}, 'Signage'));
    return c;
  }

  function show(el){ STAGE.innerHTML=''; STAGE.appendChild(el); requestAnimationFrame(()=>{ el.classList.add('show'); }); }
  function hide(cb){ const cur = STAGE.firstChild; if (cur) cur.classList.remove('show'); setTimeout(cb, (settings?.slides?.transitionMs ?? 500)); }

  function step(){
    if (!nextQueue.length) return;
    const item = nextQueue[idx % nextQueue.length];
    const el = (item.type==='overview') ? renderOverview() : renderSauna(item.sauna);
    show(el);
    const dwell = (item.type==='overview') ? (settings?.slides?.overviewDurationSec ?? 10)*1000 : (settings?.slides?.saunaDurationSec ?? 6)*1000;
    setTimeout(()=> hide(()=>{ idx++; step(); }), dwell);
  }

  async function bootstrap(){
    await loadAll(); step();
    let lastSchedVer = schedule?.version || 0, lastSetVer = settings?.version || 0;
    setInterval(async ()=>{
      try { const s = await loadJSON('/data/schedule.json'); if (s.version !== lastSchedVer) { schedule=s; lastSchedVer=s.version; buildQueue(); } } catch(e){}
      try { const cf = await loadJSON('/data/settings.json'); if (cf.version !== lastSetVer) { settings=cf; lastSetVer=cf.version; applyTheme(); applyDisplay(); } } catch(e){}
    }, 3000);

    // Preview channel from admin (live settings without save)
    window.addEventListener('message', (ev)=>{
      if (!ev?.data || ev.data.type!=='preview') return;
      const p = ev.data.payload || {}; if (p.schedule) schedule=p.schedule; if (p.settings) settings=p.settings;
      applyTheme(); applyDisplay(); buildQueue(); idx=0; step();
    });
  }
  bootstrap();
})();
JS

chown -R www-data:www-data /var/www/signage/assets
chmod -R 0644 /var/www/signage/assets/* /var/www/signage/index.html

# ---------------------------
# Admin-UI (Editor) – Farben (Hex/Preview), Kachel-Min/Max, rechte Spalte %, Schrägschnitt, Flammen-Bild
# ---------------------------
cat >/var/www/signage/admin/index.html <<'HTML'
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aufguss – Admin</title>
  <style>
    :root{ --bg:#070a12; --fg:#e8eeff; --mut:#9aa3b7; --acc:#E7B416; --acc2:#ffd560; --br:#21314e; --card:#0c1220; --card2:#0a0f1a; --input:#0e1426; --inbr:#2a3a5c; --ok:#22c55e; --err:#ef4444; --shadow:0 10px 30px rgba(0,0,0,.35); }
    *{box-sizing:border-box}
    html,body{height:100%;margin:0;background:radial-gradient(1200px 600px at 20% -5%, #0e1630, #070a12);color:var(--fg);font:14px/1.45 system-ui,Segoe UI,Roboto,Arial,sans-serif}
    a{color:#98c7ff}
    header{position:sticky;top:0;z-index:60;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--br);background:rgba(7,10,18,.85);backdrop-filter:blur(8px)}
    h1{margin:0;font-size:16px;letter-spacing:.3px}
    .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .btn{border:1px solid var(--inbr);background:linear-gradient(180deg,#131a2d,#0e1426);color:#eaf0ff;padding:9px 12px;border-radius:12px;cursor:pointer;transition:transform .06s ease,filter .2s}
    .btn:hover{filter:brightness(1.06)} .btn:active{transform:translateY(1px)} .btn.primary{background:var(--acc);color:#0b0d12;border-color:var(--acc);font-weight:700} .btn.ghost{background:transparent} .btn.sm{padding:6px 10px;border-radius:10px}

    main.layout{width:100%;display:grid;grid-template-columns:minmax(0,1fr) 480px;gap:16px;padding:16px 12px 18px 16px;align-items:start}
    .leftcol{display:flex;flex-direction:column;gap:16px;min-width:0}
    .rightbar{position:sticky;top:64px;max-height:calc(100svh - 64px);overflow:auto;padding-right:6px;justify-self:end}

    .card, details.ac{border:1px solid var(--br);border-radius:16px;background:linear-gradient(180deg,var(--card),var(--card2));box-shadow:var(--shadow)}
    .card .content{padding:14px}
    details.ac{overflow:hidden}
    summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid transparent}
    details[open] > summary{border-bottom-color:var(--br)}
    summary .ttl{display:flex;align-items:center;gap:10px;font-weight:700}
    summary .actions{display:flex;gap:8px}
    summary .chev{transition:transform .2s ease} details[open] .chev{transform:rotate(90deg)}
    .content{padding:14px 16px}

    table.tbl{width:100%;border-collapse:separate;border-spacing:0}
    .tbl th,.tbl td{border:1px solid var(--inbr);padding:8px;background:#0f1529}
    .tbl th{position:sticky;top:64px;background:#10172b;z-index:1}
    .tbl .time{min-width:8ch;text-align:center;font-weight:700}
    .cellbtn{width:100%;text-align:left;background:#0f1529;border:1px dashed #39486c;color:#d9e1ff;padding:9px;border-radius:12px}
    .cellbtn.filled{border-style:solid;background:#0b1224;border-color:#2a3450}

    .kv{display:grid;grid-template-columns:170px 1fr;gap:10px;align-items:center}
    .input, select, textarea{background:var(--input);border:1px solid var(--inbr);color:#fff;border-radius:12px;padding:9px;width:100%}

    /* Saunen list rows (vertical) */
    .saunarow{display:grid;grid-template-columns:1fr 64px auto auto auto;gap:10px;align-items:center;margin-bottom:10px}
    .prev{width:64px;height:46px;border-radius:10px;border:1px solid var(--inbr);object-fit:cover;background:#0d1426}

    .color-item{display:flex;align-items:center;gap:8px}
    .swatch{width:24px;height:24px;border-radius:6px;border:1px solid #2f3f60}

    footer{display:flex;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--br);color:var(--mut)}

    .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;place-items:center;z-index:100}
    .box{background:#0e1426;border:1px solid var(--inbr);border-radius:16px;min-width:340px;max-width:95vw;max-height:90svh;overflow:auto;padding:16px}
    .grid2{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center}
    .iframeWrap{width:min(92vw,1600px);height:min(85svh,900px);border:1px solid var(--inbr);border-radius:14px;overflow:hidden;background:#000}
    .iframeWrap iframe{width:100%;height:100%;display:block;border:0}
  </style>
</head>
<body>
  <header>
    <h1>Aufguss – Admin</h1>
    <div class="row">
      <button class="btn" id="btnOpen">Slideshow öffnen</button>
      <button class="btn" id="btnPreview">Vorschau (ohne Speichern)</button>
      <button class="btn primary" id="btnSave">Speichern</button>
    </div>
  </header>

  <main class="layout">
    <section class="leftcol">
      <div class="card">
        <div class="content" style="padding-bottom:0">
          <div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <div style="font-weight:700">Tabelle <span style="opacity:.7">(Zeiten × Saunen)</span></div>
            <div class="row"><span style="opacity:.7">Ausgewählte Zeit:</span> <span id="selTime" style="font-weight:700">—</span></div>
          </div>
          <table id="grid" class="tbl"></table>
          <div class="row" style="margin:12px 0 4px">
            <button class="btn sm" id="btnAddAbove">Zeile darüber +</button>
            <button class="btn sm" id="btnAddBelow">Zeile darunter +</button>
            <button class="btn sm" id="btnDeleteRow">Ausgewählte Zeile löschen</button>
            <span style="opacity:.7">Zelle klicken = Zeile markieren · Zeit im Dialog verschiebt korrekt.</span>
          </div>
        </div>
      </div>
    </section>

    <aside class="rightbar">
      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Slideshow & Text</div>
          <div class="actions"><button class="btn sm ghost" id="resetSlides">Standardwerte</button></div>
        </summary>
        <div class="content">
          <div class="kv"><label>Übersicht (Sek.)</label><input id="overviewSec" class="input" type="number" min="1" value="10"></div>
          <div class="kv"><label>Saunafolie (Sek.)</label><input id="saunaSec" class="input" type="number" min="1" value="6"></div>
          <div class="kv"><label>Transition (ms)</label><input id="transMs" class="input" type="number" min="0" value="500"></div>
          <div class="kv"><label>Schriftfamilie</label>
            <select id="fontFamily" class="input">
              <option value="system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif">System (Default)</option>
              <option value="Montserrat, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">Montserrat</option>
              <option value="Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif">Roboto</option>
              <option value="'Open Sans', system-ui, -apple-system, Segoe UI, Arial, sans-serif">Open Sans</option>
              <option value="Lato, system-ui, -apple-system, Segoe UI, Arial, sans-serif">Lato</option>
            </select>
          </div>
          <div class="kv"><label>Globaler Scale</label><input id="fontScale" class="input" type="number" step="0.05" min="0.5" max="3" value="1"></div>
          <div class="kv"><label>H1 Scale</label><input id="h1Scale" class="input" type="number" step="0.05" min="0.5" max="3.5" value="1"></div>
          <div class="kv"><label>H2 Scale</label><input id="h2Scale" class="input" type="number" step="0.05" min="0.5" max="3.5" value="1"></div>
          <div class="kv"><label>Kachel-Text Scale</label><input id="tileTextScale" class="input" type="number" step="0.05" min="0.5" max="3" value="0.8"></div>
          <div class="kv"><label>Kachel Font-Weight</label>
            <select id="tileWeight" class="input">
              <option value="400">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600" selected>Semibold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">Extra Bold (800)</option>
            </select>
          </div>
          <div class="kv"><label>Übersicht Kopf Scale</label><input id="ovHeadScale" class="input" type="number" step="0.05" min="0.5" max="3" value="0.9"></div>
          <div class="kv"><label>Übersicht Zellen Scale</label><input id="ovCellScale" class="input" type="number" step="0.05" min="0.5" max="3" value="0.8"></div>
          <div class="kv"><label>Fußnote</label><input id="footnote" class="input" type="text" placeholder="z. B. * Nur am Fr und Sa"></div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Hervorhebungen</div>
        </summary>
        <div class="content">
          <div class="kv"><label>„Nächster Aufguss“ aktiv</label><input id="hlEnabled" type="checkbox"></div>
          <div class="kv"><label>Farbe (Hex)</label><div class="color-item"><div id="hlSw" class="swatch"></div><input id="hlColor" class="input" type="text" value="#FFDD66" placeholder="#RRGGBB"></div></div>
          <div class="kv"><label>Fenster (Min.) ±</label><input id="hlWindow" class="input" type="number" min="1" max="120" value="15"></div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Saunen</div>
          <div class="actions"><button class="btn sm" id="btnAddSauna">Sauna hinzufügen</button></div>
        </summary>
        <div class="content" id="saunaBox">
          <div class="row" style="opacity:.7;font-weight:700;margin-bottom:6px"><div style="width:100%">Name · Vorschau · Upload · Default · Entfernen</div></div>
          <div id="saunaList" ></div>
        </div>
      </details>

      <details class="ac">
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Farben (Übersicht)</div>
          <div class="actions"><button class="btn sm ghost" id="resetColors">Standardwerte</button></div>
        </summary>
        <div class="content" id="colorList"></div>
      </details>
    </aside>
  </main>

  <footer>© Andrej Soennecken</footer>

  <!-- Dialog Zelle -->
  <div id="modal" class="modal">
    <div class="box">
      <div class="grid2">
        <label>Uhrzeit</label><input id="m_time" class="input" type="text" placeholder="HH:MM">
        <label>Titel</label><input id="m_title" class="input" type="text" placeholder="z.B. Vulkan">
        <label>Flammen</label>
        <select id="m_flames" class="input">
          <option value="">—</option>
          <option>1</option><option>2</option><option>3</option>
          <option>1-2</option><option>2-3</option><option>1-3</option>
        </select>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:14px">
        <button class="btn" id="m_cancel">Abbrechen</button>
        <button class="btn primary" id="m_ok">OK</button>
      </div>
    </div>
  </div>

  <!-- Vorschau-Modal -->
  <div id="prevModal" class="modal">
    <div class="box">
      <div class="row" style="justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700">Vorschau</div>
        <div class="row"><button class="btn sm" id="prevReload">Neu laden</button><button class="btn sm" id="prevClose">Schließen</button></div>
      </div>
      <div class="iframeWrap"><iframe id="prevFrame" src="/"></iframe></div>
      <small style="opacity:.7;display:block;margin-top:8px">Die Vorschau verwendet die aktuellen (nicht gespeicherten) Einstellungen.</small>
    </div>
  </div>

  <script>
    const DEFAULTS = {
      slides:{ overviewDurationSec:10, saunaDurationSec:6, transitionMs:500 },
      display:{ fit:'contain', baseW:1920, baseH:1080, rightWidthPercent:38, cutTopPercent:28, cutBottomPercent:12 },
      theme:{ bg:'#E8DEBD', fg:'#5C3101', accent:'#5C3101', gridBorder:'#5C3101', cellBg:'#5C3101', boxFg:'#FFFFFF', saunaColor:'#5C3101', timeColBg:'#E8DEBD', flame:'#FFD166', zebra1:'#EDDFAF', zebra2:'#E6D6A1' },
      highlightNext:{ enabled:false, color:'#FFDD66', minutesWindow:15 },
      fonts:{ family:"system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif", scale:1, h1Scale:1, h2Scale:1, overviewHeadScale:0.9, overviewCellScale:0.8, tileTextScale:0.8, tileWeight:600 }
    };

    let schedule=null, settings=null, curRow=0, curCol=0; const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
    const sanitizeUrl=(s)=>{ s=(s||'').trim(); if(!s) return ''; const ok=/^(https?:\/\/[^\s]+|\/assets\/img\/[-A-Za-z0-9_.\/]+)$/i.test(s); return ok?s:'' };
    const preloadImg=(u)=> new Promise(res=>{ if(!u) return res({ok:false}); const i=new Image(); i.onload=()=>res({ok:true,w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res({ok:false}); i.src=u; });
    const parseTime = (s) => { const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec((s||'').trim()); return m ? (m[1]+':'+m[2]) : null; };

    async function loadAll(){ const [s,cfg]=await Promise.all([ fetch('/admin/api/load.php').then(r=>r.json()), fetch('/admin/api/load_settings.php').then(r=>r.json()) ]); schedule=s; settings=cfg; renderGrid(); renderSlides(); renderHighlightBox(); renderSaunasPanel(); renderColors(); }

    // ------- Grid -------
    function renderGrid(){ const head=['Zeit',...(schedule.saunas||[])]; let html='<thead><tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'; schedule.rows.forEach((row,ri)=>{ html+='<tr>'; html+=`<td class="time" data-ri="${ri}"><input class="input" type="text" value="${row.time}" style="width:7.5ch;text-align:center"></td>`; row.entries.forEach((cell,ci)=>{ const filled= cell&&cell.title? 'filled':''; const label = cell&&cell.title? (cell.title+(cell.flames?(' · '+cell.flames):'')) : '—'; html+=`<td><button class="cellbtn ${filled}" data-ri="${ri}" data-ci="${ci}">${label}</button></td>`; }); html+='</tr>'; }); html+='</tbody>'; $('#grid').innerHTML=html; $$('#grid .time input').forEach(inp=>{ inp.onchange=()=>{ const ri=+inp.parentElement.dataset.ri; const t=parseTime(inp.value); if(!t){ alert('Bitte HH:MM'); inp.value=schedule.rows[ri].time; return;} schedule.rows[ri].time=t; schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); renderGrid(); }; inp.onclick=()=>{ curRow=+inp.parentElement.dataset.ri; updateSelTime(); }; }); $$('#grid .cellbtn').forEach(btn=>{ btn.onclick=()=>{ curRow=+btn.dataset.ri; curCol=+btn.dataset.ci; updateSelTime(); const cell=schedule.rows[curRow].entries[curCol]; $('#m_time').value=schedule.rows[curRow].time; $('#m_title').value=cell?.title||''; $('#m_flames').value=cell?.flames||''; $('#modal').style.display='grid'; $('#m_title').focus(); }; }); }
    function updateSelTime(){ $('#selTime').textContent=schedule.rows[curRow]?.time||'—'; }

    // Dialog
    $('#m_cancel').onclick=()=> $('#modal').style.display='none';
    $('#m_ok').onclick=()=>{ const title=$('#m_title').value.trim(); const flames=$('#m_flames').value; const newTime=parseTime($('#m_time').value); if (!newTime && title){ alert('Bitte Zeit HH:MM'); return; } const newCell= title? {title,flames}:null; if (newTime && newTime!==schedule.rows[curRow].time && newCell){ let targetIdx=schedule.rows.findIndex(r => r.time===newTime); if(targetIdx===-1){ const cols=schedule.saunas.length; schedule.rows.push({time:newTime, entries:Array.from({length:cols}).map(()=>null)}); schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); targetIdx=schedule.rows.findIndex(r => r.time===newTime);} schedule.rows[targetIdx].entries[curCol]=newCell; schedule.rows[curRow].entries[curCol]=null; } else { schedule.rows[curRow].entries[curCol]=newCell; if (newTime) schedule.rows[curRow].time=newTime; } schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); $('#modal').style.display='none'; renderGrid(); };

    // Row ops
    $('#btnAddAbove').onclick=()=>{ const cols=schedule.saunas.length; schedule.rows.splice(curRow,0,{time:'00:00', entries:Array.from({length:cols}).map(()=>null)}); renderGrid(); };
    $('#btnAddBelow').onclick=()=>{ const cols=schedule.saunas.length; schedule.rows.splice(curRow+1,0,{time:'00:00', entries:Array.from({length:cols}).map(()=>null)}); renderGrid(); };
    $('#btnDeleteRow').onclick=()=>{ if(schedule.rows.length>1){ schedule.rows.splice(curRow,1); curRow=Math.max(0,curRow-1); renderGrid(); updateSelTime(); } };

    // ------- Slides box -------
    function renderSlides(){ const f=settings.fonts||{}; $('#overviewSec').value = settings.slides?.overviewDurationSec??10; $('#saunaSec').value = settings.slides?.saunaDurationSec??6; $('#transMs').value = settings.slides?.transitionMs??500; $('#fontFamily').value = f.family || DEFAULTS.fonts.family; $('#fontScale').value = f.scale ?? 1; $('#h1Scale').value = f.h1Scale ?? 1; $('#h2Scale').value = f.h2Scale ?? 1; $('#tileTextScale').value = f.tileTextScale ?? 0.8; $('#tileWeight').value = f.tileWeight ?? 600; $('#ovHeadScale').value = f.overviewHeadScale ?? 0.9; $('#ovCellScale').value = f.overviewCellScale ?? 0.8; $('#footnote').value = settings.footnote||''; $('#resetSlides').onclick = ()=>{ $('#overviewSec').value=DEFAULTS.slides.overviewDurationSec; $('#saunaSec').value=DEFAULTS.slides.saunaDurationSec; $('#transMs').value=DEFAULTS.slides.transitionMs; $('#fontFamily').value=DEFAULTS.fonts.family; $('#fontScale').value=1; $('#h1Scale').value=1; $('#h2Scale').value=1; $('#tileTextScale').value=0.8; $('#tileWeight').value=600; $('#ovHeadScale').value=0.9; $('#ovCellScale').value=0.8; $('#footnote').value=''; }; }

    // ------- Hervorhebungen -------
    function renderHighlightBox(){ const hl=settings.highlightNext||DEFAULTS.highlightNext; $('#hlEnabled').checked = !!hl.enabled; $('#hlColor').value = hl.color || DEFAULTS.highlightNext.color; $('#hlWindow').value = Number.isFinite(+hl.minutesWindow)?hl.minutesWindow:(hl.minutesAfter||15); const setSw=()=> $('#hlSw').style.background = $('#hlColor').value; setSw(); $('#hlColor').addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)) setSw(); }); }

    // ------- Saunen panel (vertical) -------
    function saunaRow(i){ const name=schedule.saunas[i]; const id='sx_'+i; const wrap=document.createElement('div'); wrap.className='saunarow'; wrap.innerHTML=`
        <input id="n_${id}" class="input" type="text" value="${name}" />
        <img id="p_${id}" class="prev" alt=""/>
        <label class="btn sm ghost" style="position:relative;overflow:hidden"><input id="f_${id}" type="file" accept="image/*" style="position:absolute;inset:0;opacity:0">Upload</label>
        <button class="btn sm" id="d_${id}">Default</button>
        <button class="btn sm" id="x_${id}">✕</button>`;
      const $name=$(`#n_${id}`,wrap), $img=$(`#p_${id}`,wrap), $file=$(`#f_${id}`,wrap), $def=$(`#d_${id}`,wrap), $del=$(`#x_${id}`,wrap);
      const url = (settings.assets?.rightImages?.[name]) || '';
      (async()=>{ if(url){ const r=await preloadImg(url); if(r.ok) $img.src=url; } })();
      // upload
      $file.onchange=()=> uploadGeneric($file, (p)=>{ settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; settings.assets.rightImages[name]=p; $img.src=p; });
      // default
      $def.onclick=()=>{ settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; settings.assets.rightImages[name]='/assets/img/right_default.svg'; $img.src='/assets/img/right_default.svg'; };
      // delete sauna
      $del.onclick=()=>{ if(!confirm('Sauna wirklich entfernen?')) return; const removedName=schedule.saunas.splice(i,1)[0]; schedule.rows.forEach(r=> r.entries.splice(i,1)); if (settings.assets?.rightImages) delete settings.assets.rightImages[removedName]; renderGrid(); renderSaunasPanel(); };
      // rename sauna
      $name.onchange=()=>{ const newName=$name.value.trim()||name; if(newName===name) return; const old=name; schedule.saunas[i]=newName; if(settings.assets?.rightImages){ const val=settings.assets.rightImages[old]; delete settings.assets.rightImages[old]; settings.assets.rightImages[newName]=val; } renderGrid(); renderSaunasPanel(); };
      return wrap;
    }
    function renderSaunasPanel(){ const host=$('#saunaList'); host.innerHTML=''; settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; (schedule.saunas||[]).forEach((_,i)=> host.appendChild(saunaRow(i)) ); $('#btnAddSauna').onclick=()=>{ const name = prompt('Neuer Saunananame:', 'Neue Sauna'); if(!name) return; schedule.saunas.push(name); schedule.rows.forEach(r=> r.entries.push(null)); renderGrid(); renderSaunasPanel(); }; }

    // ------- Farben (Übersicht) -------
    function renderColors(){ const host=$('#colorList'); host.innerHTML=''; const theme=settings.theme||{}; const fields=[ ['bg','Hintergrund'],['fg','Vordergrund/Schrift'],['accent','Akzent'],['gridBorder','Tabellenrand'],['cellBg','Zellen-Hintergrund'],['boxFg','Box-Schrift'],['saunaColor','Sauna-Überschrift'],['timeColBg','Zeitspalten-Hintergrund'],['flame','Flammen'],['zebra1','Zebra 1'],['zebra2','Zebra 2'] ]; fields.forEach(([key,label])=>{ const row=document.createElement('div'); row.className='kv'; row.innerHTML=`<label>${label}</label><div class="color-item"><div class="swatch" id="sw_${key}"></div><input class="input" id="cl_${key}" type="text" value="${theme[key]||DEFAULTS.theme[key]||'#FFFFFF'}" placeholder="#RRGGBB"></div>`; host.appendChild(row); }); fields.forEach(([key])=>{ const inp=$(`#cl_${key}`), sw=$(`#sw_${key}`); const setPrev=v=>sw.style.background=v; setPrev(inp.value); inp.addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test(inp.value)) setPrev(inp.value); }); }); $('#resetColors').onclick=()=>{ fields.forEach(([key])=>{ $(`#cl_${key}`).value=(DEFAULTS.theme[key]||'#FFFFFF'); $(`#sw_${key}`).style.background=(DEFAULTS.theme[key]||'#FFFFFF'); }); }; }

    // ------- Upload helper -------
    function uploadGeneric(fileInput, onDone){ if(!fileInput.files || !fileInput.files[0]) return; const fd=new FormData(); fd.append('file', fileInput.files[0]); const xhr=new XMLHttpRequest(); xhr.open('POST','/admin/api/upload.php'); xhr.onload=()=>{ try{ const j=JSON.parse(xhr.responseText||'{}'); if(j.ok){ onDone(j.path); } else { alert('Upload-Fehler: '+(j.error||'')); } }catch{ alert('Upload fehlgeschlagen'); } }; xhr.onerror=()=> alert('Netzwerkfehler beim Upload'); xhr.send(fd); }

    // ------- Save / Preview -------
    function collectColors(){ const theme={...(settings.theme||{})}; $$('#colorList input[type="text"]').forEach(inp=>{ const v=inp.value.toUpperCase(); if(/^#([0-9A-Fa-f]{6})$/.test(v)) theme[inp.id.replace(/^cl_/,'')]=v; }); return theme; }
    function collectSettings(){ return { schedule:{...schedule}, settings:{ ...settings, footnote: $('#footnote')?.value || settings.footnote || '', fonts:{ family: $('#fontFamily').value, scale: +($('#fontScale')?.value||1), h1Scale:+($('#h1Scale').value||1), h2Scale:+($('#h2Scale').value||1), overviewHeadScale:+($('#ovHeadScale').value||0.9), overviewCellScale:+($('#ovCellScale').value||0.8), tileTextScale:+($('#tileTextScale').value||0.8), tileWeight:+($('#tileWeight').value||600) }, slides:{ ...(settings.slides||{}), overviewDurationSec:+($('#overviewSec')?.value||10), saunaDurationSec:+($('#saunaSec')?.value||6), transitionMs:+($('#transMs')?.value||500) }, theme: collectColors(), highlightNext:{ enabled: $('#hlEnabled').checked, color: /^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)? $('#hlColor').value.toUpperCase() : (settings.highlightNext?.color || DEFAULTS.highlightNext.color), minutesWindow: +( $('#hlWindow').value || DEFAULTS.highlightNext.minutesWindow ) }, display:{ ...(settings.display||{}), fit:'contain', baseW:1920, baseH:1080 } } }; }

    $('#btnOpen').onclick=()=> window.open('/', '_blank');
    $('#btnPreview').onclick=()=>{ $('#prevModal').style.display='grid'; sendPreview(); };
    $('#prevReload').onclick=()=> sendPreview(true);
    $('#prevClose').onclick=()=> $('#prevModal').style.display='none';
    function sendPreview(reload){ const f=$('#prevFrame'); if(reload){ f.contentWindow.location.reload(); setTimeout(()=>sendPreview(),400); return; } const payload=collectSettings(); setTimeout(()=>{ f.contentWindow.postMessage({type:'preview', payload}, '*'); }, 350); }

    $('#btnSave').onclick=async()=>{ const body=collectSettings(); body.schedule.version = (Date.now()/1000|0); body.settings.version = (Date.now()/1000|0); const r=await fetch('/admin/api/save.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const j=await r.json(); alert(j.ok? 'Gespeichert.' : ('Fehler: '+(j.error||'unbekannt'))); };

    loadAll();
  </script>
</body>
</html>
HTML

# ---------------------------
# Admin API (PHP)
# ---------------------------
install -d -o www-data -g www-data -m 2775 /var/www/signage/admin/api

cat >/var/www/signage/admin/api/load.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
$fn = '/var/www/signage/data/schedule.json';
if(!is_file($fn)){ http_response_code(404); echo json_encode(['error'=>'no-schedule']); exit; }
echo file_get_contents($fn);
PHP

cat >/var/www/signage/admin/api/load_settings.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
$fn = '/var/www/signage/data/settings.json';
if(!is_file($fn)){
echo json_encode([
'version'=>1,
'theme'=>[
'bg'=>'#E8DEBD','fg'=>'#5C3101','accent'=>'#5C3101','gridBorder'=>'#5C3101','cellBg'=>'#5C3101','boxFg'=>'#FFFFFF',
'saunaColor'=>'#5C3101','timeColBg'=>'#E8DEBD','flame'=>'#FFD166','zebra1'=>'#EDDFAF','zebra2'=>'#E6D6A1'
],
'fonts'=>['family'=>"-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif", 'scale'=>1],
'display'=>['fit'=>'width','rightWidthPercent'=>38,'cutTopPercent'=>28,'cutBottomPercent'=>12],
'slides'=>[
'overviewDurationSec'=>10,
'saunaDurationSec'=>6,
'transitionMs'=>500,
'tileWidthPercent'=>45,
'tileMinPx'=>480,
'tileMaxPx'=>1100,
'loop'=>true,
'order'=>['overview','Aufgusssauna','Finnische Sauna','Kelosauna','Dampfbad','Fenster zur Welt']
],
'assets'=>['rightImages'=>[], 'flameImage'=>'/assets/img/flame_test.svg'],
'footnote'=>''
]);
exit;
}
echo file_get_contents($fn);
PHP

cat >/var/www/signage/admin/api/save.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
$raw = file_get_contents('php://input');
if ($raw===''){ http_response_code(400); echo json_encode(['ok'=>false,'error'=>'empty']); exit; }
$data = json_decode($raw,true);
if (!is_array($data) || !isset($data['schedule']) || !isset($data['settings'])) {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad-json']); exit;
}
$ok1 = file_put_contents('/var/www/signage/data/schedule.json', json_encode($data['schedule'], JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
$ok2 = file_put_contents('/var/www/signage/data/settings.json', json_encode($data['settings'], JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
if (!$ok1 || !$ok2) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'write-failed']); exit; }
echo json_encode(['ok'=>true]);
PHP

chown -R www-data:www-data /var/www/signage/admin
chmod -R 0644 /var/www/signage/admin/api/*.php
find /var/www/signage -type d -exec chmod 2775 {} \;

# ---------------------------
# Uploader
# ---------------------------
cat >/var/www/signage/admin/api/upload.php <<'PHP'
<?php
// file: /var/www/signage/admin/api/upload.php
// Zweck: Sicheren Upload großer Bilder nach /assets/img/ (PNG/JPG/WebP/SVG)
// Hinweise: Nginx client_max_body_size & PHP upload_max_filesize/post_max_size müssen groß genug sein.


header('Content-Type: application/json; charset=UTF-8');


function fail($msg, $code=400){ http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]); exit; }


if ($_SERVER['REQUEST_METHOD']!=='POST') fail('method');
if (!isset($_FILES['file'])) fail('nofile');


$u = $_FILES['file'];
if (!empty($u['error'])) fail('upload-error-'.$u['error']);
if (!is_uploaded_file($u['tmp_name'])) fail('tmp-missing');


// Limits (kann via PHP-INI/Nginx größer sein)
$maxBytes = 256*1024*1024; // 256MB
if (filesize($u['tmp_name']) > $maxBytes) fail('too-large (server limit)');


$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($u['tmp_name']) ?: 'application/octet-stream';
$allowed = [
'image/png' => 'png',
'image/jpeg'=> 'jpg',
'image/webp'=> 'webp',
'image/svg+xml' => 'svg'
];
if (!isset($allowed[$mime])) fail('unsupported-type: '.$mime);


$ext = $allowed[$mime];
$orig = preg_replace('/[^A-Za-z0-9._-]/','_', $u['name']);
if (!$orig) $orig = 'upload.' . $ext;
if (!preg_match('/\.' . preg_quote($ext,'/') . '$/i', $orig)) $orig .= '.' . $ext;


$baseDir = '/var/www/signage/assets/img/';
if (!is_dir($baseDir)) { @mkdir($baseDir, 02775, true); @chown($baseDir,'www-data'); @chgrp($baseDir,'www-data'); }


$dest = $baseDir . $orig;
$pi = pathinfo($dest);
$fname = $pi['filename']; $i=0;
while (file_exists($dest)) { $i++; $dest = $pi['dirname'].'/'.$fname.'_'.$i.'.'.$ext; }


if (!@move_uploaded_file($u['tmp_name'], $dest)) fail('move-failed', 500);
@chmod($dest, 0644); @chown($dest,'www-data'); @chgrp($dest,'www-data');


$publicPath = '/assets/img/' . basename($dest);
echo json_encode(['ok'=>true,'path'=>$publicPath]);
PHP

# ---------------------------
# AssetCleaner
# ---------------------------
cat >/var/www/signage/admin/api/cleanup_assets.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
$assetsDir = '/var/www/signage/assets/img';
$settingsFile = '/var/www/signage/data/settings.json';

if (!is_dir($assetsDir)) { echo json_encode(['ok'=>false,'error'=>'missing-assets-dir']); exit; }
$cfg = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$keep = [];
$keep[] = '/assets/img/right_default.svg';
$keep[] = '/assets/img/flame_test.svg';

if (!empty($cfg['assets']['flameImage'])) $keep[] = $cfg['assets']['flameImage'];
if (!empty($cfg['assets']['rightImages']) && is_array($cfg['assets']['rightImages'])) {
  foreach($cfg['assets']['rightImages'] as $p){ if($p) $keep[]=$p; }
}

$keepReal = array_map(function($p){ return '/var/www/signage'. $p; }, array_unique($keep));

$removed = [];
$it = new DirectoryIterator($assetsDir);
foreach ($it as $f){ if($f->isDot()||!$f->isFile()) continue; $full = $f->getPathname(); if (!in_array($full, $keepReal, true)) { @unlink($full); if(!file_exists($full)) $removed[] = str_replace('/var/www/signage','', $full); } }

echo json_encode(['ok'=>true,'removed'=>$removed]);
PHP


# ---------------------------
# Nginx vHosts
# ---------------------------
PHP_SOCK=$(ls /run/php/php*-fpm.sock 2>/dev/null | head -n1 || echo /run/php/php8.3-fpm.sock)

cat >/etc/nginx/sites-available/signage-slideshow.conf <<'NGINX'
server {
  listen __PUBLIC_PORT__ default_server;
  listen [::]:__PUBLIC_PORT__ default_server;
  server_name _;
  root /var/www/signage;

  add_header Cache-Control "no-store" always;
  add_header X-Served-By signage-slideshow always;

  index index.html;

  location ^~ /assets/ { try_files $uri =404; }
  location ^~ /data/   {
    add_header Cache-Control "no-store, must-revalidate" always;
    try_files $uri =404;
  }
}
NGINX


cat >/etc/nginx/sites-available/signage-admin.conf <<'NGINX'
server {
  listen __ADMIN_PORT__;
  listen [::]:__ADMIN_PORT__;
  server_name _;
  root /var/www/signage;

  # große Uploads zulassen (muss zu PHP post_max_size passen)
  client_max_body_size 256m;

  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options SAMEORIGIN always;
  add_header Referrer-Policy no-referrer-when-downgrade always;
  add_header X-Served-By signage-admin always;

  auth_basic "Restricted";
  auth_basic_user_file /etc/nginx/.signage_admin;

  location /admin/ {
    try_files $uri /admin/index.html;
  }

  location ~ ^/admin/api/.*\.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    fastcgi_pass unix:/run/php/php8.3-fpm.sock;
  }
}
NGINX

sed -i "s/__PUBLIC_PORT__/${SIGNAGE_PUBLIC_PORT}/g" /etc/nginx/sites-available/signage-slideshow.conf
sed -i "s/__ADMIN_PORT__/${SIGNAGE_ADMIN_PORT}/g"     /etc/nginx/sites-available/signage-admin.conf


ln -sf /etc/nginx/sites-available/signage-slideshow.conf /etc/nginx/sites-enabled/signage-slideshow.conf
ln -sf /etc/nginx/sites-available/signage-admin.conf     /etc/nginx/sites-enabled/signage-admin.conf
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl reload nginx


# PHP Upload/Exec-Limits für große Bilder
cat >/etc/php/8.3/fpm/conf.d/zz-signage.ini <<'INI'
; file: /etc/php/8.3/fpm/conf.d/zz-signage.ini
; Zweck: Uploads in Admin-UI (große PNG/WebP/SVG) erlauben

upload_max_filesize = 256M
post_max_size       = 256M
memory_limit        = 512M
max_execution_time  = 120
max_input_time      = 120

; Sicherheit / saubere Ausgaben
expose_php = Off
INI

systemctl reload php8.3-fpm


# ---------------------------
# BasicAuth
# ---------------------------
if [[ ! -s /etc/nginx/.signage_admin ]]; then
  info "Setze Admin-Login – User: ${SIGNAGE_ADMIN_USER}"
  printf "%s:%s\n" "$SIGNAGE_ADMIN_USER" "$(openssl passwd -apr1 "$SIGNAGE_ADMIN_PASS")" > /etc/nginx/.signage_admin
fi

nginx -t
systemctl reload nginx
ok "Nginx bereit"

# ---------------------------
# UFW (optional)
# ---------------------------
if (( SETUP_UFW )) && command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || true
  ufw allow ${SIGNAGE_PUBLIC_PORT}/tcp  >/dev/null 2>&1 || true
  ufw allow ${SIGNAGE_ADMIN_PORT}/tcp   >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

IP=$(hostname -I | awk '{print $1}')
echo
echo -e "${C_G}Installation fertig${C_0}"
echo "Slideshow  :  http://${IP}:${SIGNAGE_PUBLIC_PORT}/"
echo "Admin-UI   :  http://${IP}:${SIGNAGE_ADMIN_PORT}/admin/  (User: ${SIGNAGE_ADMIN_USER})"
echo
echo "Dateien:"
echo "  /var/www/signage/data/schedule.json   — Zeiten & Inhalte"
echo "  /var/www/signage/data/settings.json   — Theme, Display, Slides (inkl. tileWidth%, tileMin/Max, rightWidth%, cutTop/Bottom)"
echo "  /var/www/signage/assets/design.css    — Layout (16:9), Zebra, Farben"






