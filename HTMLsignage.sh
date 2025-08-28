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
/* Theme */
--bg:#E8DEBD; --fg:#5C3101; --accent:#5C3101;
--grid:#5C3101; --cell:#5C3101; --boxfg:#FFFFFF; --timecol:#E8DEBD;
--flame:#FFD166; --zebra1:#EDDFAF; --zebra2:#E6D6A1;


/* Typography */
--font: -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
--h1Scale: 1.0; /* per settings.fonts.h1Scale (0.5..4) */
--h2Scale: 1.0; /* per settings.fonts.h2Scale (0.5..4) */
--ovHeadScale: 1.0; /* per settings.fonts.overviewHeadScale (0.5..3) */


/* Layout – right strip (image) + cut */
--rightW:38%; /* % of canvas width */
--cutTop:28%; /* % from left edge at top */
--cutBottom:12%; /* % from left edge at bottom */


/* Tiles */
--tileVW:45; /* percentage of canvas width */
--tileMinPx:420px; /* clamp lower bound */
--tileMaxPx:1200px; /* clamp upper bound */


/* Highlight */
--hlColor:#FFDD66;


/* Calculated by JS (slideshow.js:setCanvasVars) */
--c1w: 10px; /* 1% of canvas width in px */
--c1h: 10px; /* 1% of canvas height in px */
--cmin: 10px; /* 1% of min(canvasW,canvasH) in px */
}


*{box-sizing:border-box}
html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font-family:var(--font)}
.slideshow{overflow:hidden}


/* 16:9 canvas pinned to center, no transform scaling */
.fitbox{position:fixed; inset:0; display:grid; place-items:center; background:var(--bg); height:100svh}
.canvas{position:relative; width:min(100vw, calc(100svh * (16/9))); aspect-ratio:16/9}
.stage{position:relative; width:100%; height:100%; overflow:hidden}


.fade{opacity:0;transition:opacity .5s}
.fade.show{opacity:1}


/* Container paddings scale with canvas */
.container{position:relative; height:100%; padding:calc(var(--c1h)*2.5) calc(var(--c1w)*2.2); display:flex; flex-direction:column; align-items:flex-start}
.container.has-right{padding-right:calc(var(--rightW) + calc(var(--c1w)*2.2))}
.container.overview{padding-right:calc(var(--c1w)*2.2)}


/* Headings scale from canvas min-dimension */
.h1{font-weight:800;letter-spacing:.02em;font-size:calc(var(--cmin)*6.4*var(--h1Scale));margin:0 0 calc(var(--c1h)*0.8)}
.h2{font-weight:700;letter-spacing:.01em;opacity:.95;font-size:calc(var(--cmin)*3.6*var(--h2Scale));margin:0 0 calc(var(--c1h)*1.0)}
.caption{opacity:.85;font-size:calc(var(--cmin)*2.0)}


/* Free body area to vertically center the list */
.body{flex:1; display:flex}
.list{display:flex;flex-direction:column;gap:calc(var(--c1h)*1.2);width:100%;align-items:flex-start;justify-content:center}


/* Right image panel with adjustable diagonal cut */
.rightPanel{
position:absolute; top:0; right:0; height:100%; width:var(--rightW);
background-size:cover; background-position:center; background-repeat:no-repeat;
-webkit-clip-path: polygon(var(--cutTop) 0, 100% 0, 100% 100%, var(--cutBottom) 100%);
clip-path: polygon(var(--cutTop) 0, 100% 0, 100% 100%, var(--cutBottom) 100%);
box-shadow: -6px 0 20px rgba(0,0,0,.15) inset;
}


/* Overview table – uses full width, auto height; scaled via .ovfit */
.grid{width:100%;max-width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
.grid th,.grid td{border:2px solid var(--grid);white-space:nowrap;overflow:hidden}
.grid thead th{font-size:calc(var(--cmin)*2.2*var(--ovHeadScale));padding:calc(var(--c1h)*0.5) calc(var(--c1w)*0.6);text-align:center;background:transparent;color:var(--fg)}
.grid tbody tr:nth-child(odd) td{background:var(--zebra1)}
.grid tbody tr:nth-child(even) td{background:var(--zebra2)}
.grid td{font-size:calc(var(--cmin)*2.4);padding:calc(var(--c1h)*0.6) calc(var(--c1w)*0.7)}
.grid .timecol{background:var(--timecol)!important;text-align:center;font-weight:800;min-width:10ch;color:var(--fg)}
.cellwrap{display:flex;align-items:center;justify-content:space-between;gap:calc(var(--c1w)*0.8);width:100%;min-width:0;white-space:nowrap}
.chip{display:inline-block;padding:.35em .6em;border-radius:10px;background:var(--cell); color:var(--boxfg); border:2px solid var(--grid); font-weight:700; letter-spacing:.2px; min-width:0; overflow:hidden;text-overflow:ellipsis}
.ovrow{transform-origin:top left; display:inline-block}


/* Sauna tiles – width relative to canvas with clamp; flames right-aligned */
.tile{display:grid; grid-template-columns:1fr auto; align-items:center; gap:calc(var(--c1w)*0.8);
width: clamp(var(--tileMinPx), calc(var(--tileVW) * 1vw), var(--tileMaxPx));
padding:calc(var(--c1h)*1.0) calc(var(--c1w)*1.0); background:var(--cell); border:2px solid var(--grid); border-radius:12px; color:var(--boxfg);
}
.title{font-size:calc(var(--cmin)*4.0);font-weight:700;min-width:0}
.flames{display:flex;gap:calc(var(--c1w)*0.5);align-items:center; justify-self:end; flex:0 0 auto}
.flame{width:calc(var(--cmin)*2.6);height:calc(var(--cmin)*2.6)}
.flame img,.flame svg{width:100%;height:100%;object-fit:contain}
.flame svg path{fill:var(--flame)}


/* Highlight */
.highlight{outline: max(4px, calc(var(--c1w)*0.35)) solid var(--hlColor); outline-offset: 2px; border-radius:10px}


.footer-note{margin-top:calc(var(--c1h)*0.8);font-size:calc(var(--cmin)*1.6);opacity:.9}
.brand{position:absolute;right:calc(var(--c1w)*1.4);bottom:calc(var(--c1h)*1.0);opacity:.6;font-size:14px;color:var(--fg)}
CSS

cat >/var/www/signage/assets/slideshow.js <<'JS'
(() => {
  const STAGE = document.getElementById('stage');
  let schedule = null, settings = null, nextQueue = [], idx = 0, tickInt = null;

  /* ---------- helpers ---------- */
  const nowMinutes = () => { const d=new Date(); return d.getHours()*60 + d.getMinutes(); };
  const toMin = (t) => { const m=/^(\d{2}):(\d{2})$/.exec(String(t||'')); if(!m) return null; return (+m[1])*60 + (+m[2]); };
  const h = (tag, attrs={}, children=[]) => { const el=document.createElement(tag); for(const [k,v] of Object.entries(attrs)){ if(k==='class') el.className=v; else if(k==='style') el.setAttribute('style',v); else el.setAttribute(k,v);} for(const c of [].concat(children)){ if(typeof c==='string') el.appendChild(document.createTextNode(c)); else if(c) el.appendChild(c);} return el; };
  const loadJSON = async (u) => { const r = await fetch(u + '?t=' + Date.now(), {cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status+' for '+u); return await r.json(); };

  /* ---------- layout units based on canvas size ---------- */
  function setCanvasVars(){
    const rect = STAGE.getBoundingClientRect();
    const cw = rect.width, ch = rect.height, cmin = Math.min(cw,ch);
    const root = document.documentElement.style;
    root.setProperty('--c1w', (cw/100) + 'px');
    root.setProperty('--c1h', (ch/100) + 'px');
    root.setProperty('--cmin', (cmin/100) + 'px');
  }
  window.addEventListener('resize', setCanvasVars);

  /* ---------- theme + fonts + display vars ---------- */
  function applyTheme(){
    const t = settings?.theme || {}; const m = {
      '--bg': t.bg, '--fg': t.fg, '--accent': t.accent, '--grid': t.gridBorder,
      '--cell': t.cellBg, '--boxfg': t.boxFg, '--timecol': t.timeColBg,
      '--flame': t.flame, '--zebra1': t.zebra1, '--zebra2': t.zebra2,
      '--hlColor': settings?.highlightNext?.color
    };
    for(const [k,v] of Object.entries(m)) if(v) document.documentElement.style.setProperty(k,v);
    const f = settings?.fonts || {};
    if (f.family) document.documentElement.style.setProperty('--font', f.family);
    if (typeof f.h1Scale==='number') document.documentElement.style.setProperty('--h1Scale', String(f.h1Scale));
    if (typeof f.h2Scale==='number') document.documentElement.style.setProperty('--h2Scale', String(f.h2Scale));
    if (typeof f.overviewHeadScale==='number') document.documentElement.style.setProperty('--ovHeadScale', String(f.overviewHeadScale));
    maybeLoadWebFont(f.family);
  }

  function maybeLoadWebFont(family){
    if(!family) return; const fam = family.split(',')[0].trim().replace(/['"]/g,'').toLowerCase();
    const head = document.head; const have = (href) => !!document.querySelector(`link[href="${href}"]`);
    const known = {
      'montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap',
      'inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap',
      'roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
      'open sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap'
    };
    const href = known[fam]; if(href && !have(href)){ const link=document.createElement('link'); link.rel='stylesheet'; link.href=href; head.appendChild(link); }
  }

  function applyLayout(){
    const d = settings?.display || {};
    const rightW = (typeof d.rightWidthPercent==='number') ? d.rightWidthPercent : 38;
    const cutTop = (typeof d.cutTopPercent==='number') ? d.cutTopPercent : 28;
    const cutBottom = (typeof d.cutBottomPercent==='number') ? d.cutBottomPercent : 12;
    document.documentElement.style.setProperty('--rightW', rightW + '%');
    document.documentElement.style.setProperty('--cutTop', cutTop + '%');
    document.documentElement.style.setProperty('--cutBottom', cutBottom + '%');

    const s = settings?.slides || {};
    const tile = (typeof s.tileWidthPercent==='number') ? s.tileWidthPercent : 45;
    const tmin = (typeof s.tileMinPx==='number') ? s.tileMinPx : 420;
    const tmax = (typeof s.tileMaxPx==='number') ? s.tileMaxPx : 1200;
    document.documentElement.style.setProperty('--tileVW', String(tile));
    document.documentElement.style.setProperty('--tileMinPx', tmin + 'px');
    document.documentElement.style.setProperty('--tileMaxPx', tmax + 'px');

    setCanvasVars();
  }

  /* ---------- queue ---------- */
  function buildQueue(){
    nextQueue = [];
    const order = settings?.slides?.order ?? ['overview', ...(schedule?.saunas||[])];
    for(const entry of order){ if(entry==='overview') nextQueue.push({type:'overview'}); else if (schedule.saunas.includes(entry)) nextQueue.push({type:'sauna', sauna:entry}); }
    idx = 0;
  }

  /* ---------- flames ---------- */
  function inlineFlameSVG(){ return h('svg',{viewBox:'0 0 24 24','aria-hidden':'true'},[h('path',{d:'M12 2c2 4-1 5-1 7 0 1 1 2 2 2 2 0 3-2 3-4 2 2 4 4 4 7 0 4-3 8-8 8s-8-4-8-8c0-5 5-7 8-12z'})]); }
  function flameNode(){ const url=settings?.assets?.flameImage; const box=h('div',{class:'flame'}); if(url){ const img=h('img',{src:url,alt:''}); img.addEventListener('error',()=>{ box.innerHTML=''; box.appendChild(inlineFlameSVG()); }); box.appendChild(img); return box; } box.appendChild(inlineFlameSVG()); return box; }
  function flamesWrap(spec){ let c=0, approx=false; if(!spec) c=0; else if(spec==='1') c=1; else if(spec==='2') c=2; else if(spec==='3') c=3; else if(spec==='1-2'){c=2;approx=true;} else if(spec==='2-3'||spec==='1-3'){c=3;approx=true;} const w=h('div',{class:'flames'+(approx?' approx':'')}); w.appendChild(c>=1?flameNode():h('span')); w.appendChild(c>=2?flameNode():h('span')); w.appendChild(c>=3?flameNode():h('span')); return w; }

  /* ---------- highlight logic ---------- */
  function highlightEnabled(){ return !!(settings?.highlightNext?.enabled); }
  function highlightMinutes(){ const m = Number(settings?.highlightNext?.minutesAfter); return Number.isFinite(m) ? m : 15; }
  function isHighlightedTime(tStr){ if(!highlightEnabled()) return false; const now = nowMinutes(); const start = toMin(tStr); if(start==null) return false; const end = (start + highlightMinutes()); if (now < start) return false; return now <= end; }
  function nextTimeForColumn(colIndex){
    const now = nowMinutes(); let next = null; for(const row of (schedule?.rows||[])){ const cell=row.entries[colIndex]; if(cell && cell.title){ const m=toMin(row.time); if(m!=null && m>=now){ next = row.time; break; } } }
    if(!next){ // next day first
      for(const row of (schedule?.rows||[])){ const cell=row.entries[colIndex]; if(cell && cell.title){ next = row.time; break; } }
    }
    return next;
  }

  /* ---------- overview table ---------- */
  function tableGrid(){
    const t = h('table',{class:'grid'}); const thead=h('thead'); const tr=h('tr');
    tr.appendChild(h('th',{class:'timecol'},'Zeit'));
    for(const s of schedule.saunas) tr.appendChild(h('th',{},s));
    thead.appendChild(tr); t.appendChild(thead);
    const tb=h('tbody');
    schedule.rows.forEach(row=>{
      const trr=h('tr'); trr.appendChild(h('td',{class:'timecol'},row.time));
      row.entries.forEach((cell,ci)=>{
        const td=h('td',{},[]);
        if(cell && cell.title){
          const wrap = h('div',{class:'cellwrap'},[
            h('span',{class:'chip'}, cell.title.replace(/\*+$/,'')),
            flamesWrap(cell.flames||'')
          ]);
          if(isHighlightedTime(row.time)) td.classList.add('highlight');
          td.appendChild(wrap);
        } else { td.appendChild(h('div',{class:'caption'},'—')); }
        trr.appendChild(td);
      });
      tb.appendChild(trr);
    });
    t.appendChild(tb);
    return t;
  }

  function fitOverview(container){
    const headH = Array.from(container.querySelectorAll('.h1')).reduce((a,el)=>a+el.getBoundingClientRect().height,0);
    const ov = container.querySelector('.ovrow'); if(!ov) return;
    const availH = container.clientHeight - headH - 8; // px
    ov.style.transform = 'scale(1)';
    const actualH = ov.getBoundingClientRect().height;
    const s = Math.min(1, availH / Math.max(1, actualH));
    ov.style.transform = `scale(${s})`;
  }

  function renderOverview(){
    const table = tableGrid();
    const wrap = h('div',{class:'ovrow'},[table]);
    const c = h('div',{class:'container overview fade show'},[
      h('h1',{class:'h1'},'Aufgusszeiten Übersicht'),
      wrap
    ]);
    // center horizontally with margins
    wrap.style.marginRight = 'auto'; wrap.style.marginLeft = 'auto';
    setTimeout(()=>{ fitOverview(c); },0);
    return c;
  }

  /* ---------- sauna slide ---------- */
  function renderSauna(name){
    const rightUrl = settings?.assets?.rightImages?.[name] || '';
    const c = h('div',{class:'container has-right fade show'},[
      h('div',{class:'rightPanel', style: rightUrl?`background-image:url("${rightUrl}");`:'display:none;'}),
      h('h1',{class:'h1',style:'color:var(--saunaColor);'},name),
      h('h2',{class:'h2'},'Aufgusszeiten')
    ]);

    const body=h('div',{class:'body'}); const list=h('div',{class:'list'});
    const colIdx=schedule.saunas.indexOf(name); const items=[];
    for(const row of schedule.rows){ const cell=row.entries[colIdx]; if(cell && cell.title) items.push({time:row.time,title:cell.title,flames:cell.flames||''}); }
    items.sort((a,b)=>a.time.localeCompare(b.time));

    const next = nextTimeForColumn(colIdx);
    for(const it of items){
      const label = `${it.time} Uhr – ${it.title.replace(/\*+$/,'')}`;
      const tile = h('div',{class:'tile'},[
        h('div',{class:'title'},label),
        flamesWrap(it.flames)
      ]);
      if(highlightEnabled() && it.time===next && isHighlightedTime(it.time)) tile.classList.add('highlight');
      list.appendChild(tile);
    }
    if(items.length===0) list.appendChild(h('div',{class:'caption'},'Keine Einträge.'));

    body.appendChild(list); c.appendChild(body);
    c.appendChild(h('div',{class:'brand'},'Signage'));
    return c;
  }

  /* ---------- slideshow engine ---------- */
  function show(el){ STAGE.innerHTML=''; STAGE.appendChild(el); requestAnimationFrame(()=>{ el.classList.add('show'); }); }
  function hide(cb){ const cur=STAGE.firstChild; if(cur) cur.classList.remove('show'); setTimeout(cb,(settings?.slides?.transitionMs ?? 500)); }
  function step(){ if(!nextQueue.length) return; const item = nextQueue[idx % nextQueue.length]; const el = (item.type==='overview')?renderOverview():renderSauna(item.sauna); show(el); const dwell = (item.type==='overview')? (settings?.slides?.overviewDurationSec??10)*1000 : (settings?.slides?.saunaDurationSec??6)*1000; setTimeout(()=> hide(()=>{ idx++; step(); }), dwell); }

  async function loadAll(){ const [s,cfg] = await Promise.all([ loadJSON('/data/schedule.json'), loadJSON('/data/settings.json') ]); schedule=s; settings=cfg; applyTheme(); applyLayout(); buildQueue(); setCanvasVars(); }

  function startTicker(){ if(tickInt) clearInterval(tickInt); tickInt = setInterval(()=>{ // only re-render if overview/sauna visible to update highlight
      const node = STAGE.firstChild; if(!node) return; if(node.querySelector('.grid') || node.querySelector('.list')){ const item = nextQueue[idx % nextQueue.length]; const refreshed = (item?.type==='overview')?renderOverview():renderSauna(item.sauna); show(refreshed); }
    }, 30000); }

  // Preview channel from Admin
  window.addEventListener('message', (e)=>{ const d=e.data||{}; if(d.type==='preview' && d.payload){ schedule=d.payload.schedule; settings=d.payload.settings; applyTheme(); applyLayout(); buildQueue(); idx=0; step(); }});

  async function bootstrap(){ await loadAll(); step(); startTicker(); setCanvasVars();
    let lastSched=schedule?.version||0, lastSet=settings?.version||0;
    setInterval(async()=>{
      try{ const s=await loadJSON('/data/schedule.json'); if(s.version!==lastSched){ schedule=s; lastSched=s.version; buildQueue(); } }catch{}
      try{ const c=await loadJSON('/data/settings.json'); if(c.version!==lastSet){ settings=c; lastSet=c.version; applyTheme(); applyLayout(); } }catch{}
    }, 3000);
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

    main.layout{width:100%;display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:16px;padding:16px 12px 18px 16px;align-items:start}
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

    .sgrid{display:grid;grid-template-columns: 1fr 64px auto auto auto;gap:10px;align-items:center}
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
          <div class="actions"><button class="btn sm ghost" id="resetSlides">Default</button></div>
        </summary>
        <div class="content">
          <div class="kv"><label>Übersicht (Sek.)</label><input id="overviewSec" class="input" type="number" min="1" value="10"></div>
          <div class="kv"><label>Saunafolie (Sek.)</label><input id="saunaSec" class="input" type="number" min="1" value="6"></div>
          <div class="kv"><label>Transition (ms)</label><input id="transMs" class="input" type="number" min="0" value="500"></div>
          <div class="kv"><label>H1-Skalierung</label><input id="h1Scale" class="input" type="number" step="0.05" min="0.5" max="4" value="1"></div>
          <div class="kv"><label>H2-Skalierung</label><input id="h2Scale" class="input" type="number" step="0.05" min="0.5" max="4" value="1"></div>
          <div class="kv"><label>Übersicht-Kopf (th)</label><input id="ovHeadScale" class="input" type="number" step="0.05" min="0.5" max="3" value="1"></div>
          <div class="kv"><label>Schriftart</label>
            <select id="fontFamily" class="input">
              <option value="">System-Standard</option>
              <option>Montserrat, Arial, sans-serif</option>
              <option>Inter, Arial, sans-serif</option>
              <option>Roboto, Arial, sans-serif</option>
              <option>Open Sans, Arial, sans-serif</option>
            </select>
          </div>
          <div class="kv"><label>Fußnote</label><input id="footnote" class="input" type="text" placeholder="z. B. * Nur am Fr und Sa"></div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Layout rechts & Schrägschnitt</div>
          <div class="actions"><button class="btn sm ghost" id="resetDiag">Default</button></div>
        </summary>
        <div class="content">
          <div class="kv"><label>Rechtsbreite (%)</label><input id="rightW" class="input" type="number" min="0" max="60" step="1"></div>
          <div class="kv"><label>Anker oben (%)</label><input id="cutTop" class="input" type="number" min="0" max="40" step="1"></div>
          <div class="kv"><label>Anker unten (%)</label><input id="cutBottom" class="input" type="number" min="0" max="40" step="1"></div>
          <div class="kv"><label>Kachelbreite (%)</label><input id="tileVW" class="input" type="number" min="20" max="100" step="1"></div>
          <div class="kv"><label>Kachel min (px)</label><input id="tileMin" class="input" type="number" min="200" max="2000" step="10"></div>
          <div class="kv"><label>Kachel max (px)</label><input id="tileMax" class="input" type="number" min="400" max="3000" step="10"></div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Hervorhebungen</div>
          <div class="actions"><button class="btn sm ghost" id="resetHL">Default</button></div>
        </summary>
        <div class="content">
          <div class="kv"><label>„Nächster Aufguss“ aktiv</label><input id="hlEnabled" type="checkbox"></div>
          <div class="kv"><label>Farbe (Hex)</label><div class="color-item"><div id="hlSw" class="swatch"></div><input id="hlColor" class="input" type="text" value="#FFDD66" placeholder="#RRGGBB"></div></div>
          <div class="kv"><label>Dauer nach Start (Min.)</label><input id="hlAfter" class="input" type="number" min="1" max="120" value="15"></div>
          <div class="kv"><label>Flammen-Bild</label>
            <div class="row" style="gap:8px">
              <img id="flamePrev" class="prev" alt="">
              <label class="btn sm ghost" style="position:relative;overflow:hidden"><input id="flameFile" type="file" accept="image/*" style="position:absolute;inset:0;opacity:0">Upload</label>
              <button class="btn sm" id="resetFlame">Default</button>
            </div>
          </div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Saunen</div>
          <div class="actions"><button class="btn sm" id="btnAddSauna">Sauna hinzufügen</button></div>
        </summary>
        <div class="content">
          <div class="sgrid shead" style="opacity:.7;font-weight:700;margin-bottom:6px">
            <div>Name</div><div>Preview</div><div>Upload</div><div>Default</div><div>Entfernen</div>
          </div>
          <div id="saunaGrid" class="sgrid"></div>
          <div class="row" style="justify-content:flex-end;margin-top:8px">
            <button class="btn sm ghost" id="btnClean">Assets aufräumen</button>
          </div>
        </div>
      </details>

      <details class="ac">
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Farben (Übersicht)</div>
          <div class="actions"><button class="btn sm ghost" id="resetColors">Default</button></div>
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
      slides:{ overviewDurationSec:10, saunaDurationSec:6, transitionMs:500, tileWidthPercent:45, tileMinPx:420, tileMaxPx:1200 },
      theme:{
        bg:'#E8DEBD', fg:'#5C3101', accent:'#5C3101', gridBorder:'#5C3101', cellBg:'#5C3101', boxFg:'#FFFFFF', saunaColor:'#5C3101', timeColBg:'#E8DEBD', flame:'#FFD166', zebra1:'#EDDFAF', zebra2:'#E6D6A1'
      },
      display:{ rightWidthPercent:38, cutTopPercent:28, cutBottomPercent:12 },
      fonts:{ family:'', h1Scale:1, h2Scale:1, overviewHeadScale:1 },
      highlightNext:{ enabled:false, color:'#FFDD66', minutesAfter:15 },
      assets:{ flameImage:'/assets/img/flame_test.svg', rightImage:'/assets/img/right_default.svg' }
    };

    let schedule=null, settings=null, curRow=0, curCol=0; const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
    const sanitizeUrl=(s)=>{ s=(s||'').trim(); if(!s) return ''; const ok=/^(https?:\/\/[^\s]+|\/assets\/img\/[-A-Za-z0-9_.\/]+)$/i.test(s); return ok?s:'' };
    const preloadImg=(u)=> new Promise(res=>{ if(!u) return res({ok:false}); const i=new Image(); i.onload=()=>res({ok:true,w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res({ok:false}); i.src=u; });
    const parseTime = (s) => { const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec((s||'').trim()); return m ? (m[1]+':'+m[2]) : null; };

    async function loadAll(){ const [s,cfg]=await Promise.all([ fetch('/admin/api/load.php').then(r=>r.json()), fetch('/admin/api/load_settings.php').then(r=>r.json()) ]); schedule=s; settings=cfg; renderGrid(); renderSlides(); renderDiag(); renderHighlightBox(); renderSaunasPanel(); renderColors(); }

    /* ------- Grid ------- */
    function renderGrid(){ const head=['Zeit',...(schedule.saunas||[])]; let html='<thead><tr>'+head.map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'; schedule.rows.forEach((row,ri)=>{ html+='<tr>'; html+=`<td class="time" data-ri="${ri}"><input class="input" type="text" value="${row.time}" style="width:7.5ch;text-align:center"></td>`; row.entries.forEach((cell,ci)=>{ const filled= cell&&cell.title? 'filled':''; const label = cell&&cell.title? (cell.title+(cell.flames?(' · '+cell.flames):'')) : '—'; html+=`<td><button class="cellbtn ${filled}" data-ri="${ri}" data-ci="${ci}">${label}</button></td>`; }); html+='</tr>'; }); html+='</tbody>'; $('#grid').innerHTML=html; $$('#grid .time input').forEach(inp=>{ inp.onchange=()=>{ const ri=+inp.parentElement.dataset.ri; const t=parseTime(inp.value); if(!t){ alert('Bitte HH:MM'); inp.value=schedule.rows[ri].time; return;} schedule.rows[ri].time=t; schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); renderGrid(); }; inp.onclick=()=>{ curRow=+inp.parentElement.dataset.ri; updateSelTime(); }; }); $$('#grid .cellbtn').forEach(btn=>{ btn.onclick=()=>{ curRow=+btn.dataset.ri; curCol=+btn.dataset.ci; updateSelTime(); const cell=schedule.rows[curRow].entries[curCol]; $('#m_time').value=schedule.rows[curRow].time; $('#m_title').value=cell?.title||''; $('#m_flames').value=cell?.flames||''; $('#modal').style.display='grid'; $('#m_title').focus(); }; }); }
    function updateSelTime(){ $('#selTime').textContent=schedule.rows[curRow]?.time||'—'; }

    // Dialog
    $('#m_cancel').onclick=()=> $('#modal').style.display='none';
    $('#m_ok').onclick=()=>{ const title=$('#m_title').value.trim(); const flames=$('#m_flames').value; const newTime=parseTime($('#m_time').value); if (!newTime && title){ alert('Bitte Zeit HH:MM'); return; } const newCell= title? {title,flames}:null; if (newTime && newTime!==schedule.rows[curRow].time && newCell){ let targetIdx=schedule.rows.findIndex(r => r.time===newTime); if(targetIdx===-1){ const cols=schedule.saunas.length; schedule.rows.push({time:newTime, entries:Array.from({length:cols}).map(()=>null)}); schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); targetIdx=schedule.rows.findIndex(r => r.time===newTime);} schedule.rows[targetIdx].entries[curCol]=newCell; schedule.rows[curRow].entries[curCol]=null; } else { schedule.rows[curRow].entries[curCol]=newCell; if (newTime) schedule.rows[curRow].time=newTime; } schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); $('#modal').style.display='none'; renderGrid(); };

    // Row ops
    $('#btnAddAbove').onclick=()=>{ const cols=schedule.saunas.length; schedule.rows.splice(curRow,0,{time:'00:00', entries:Array.from({length:cols}).map(()=>null)}); renderGrid(); };
    $('#btnAddBelow').onclick=()=>{ const cols=schedule.saunas.length; schedule.rows.splice(curRow+1,0,{time:'00:00', entries:Array.from({length:cols}).map(()=>null)}); renderGrid(); };
    $('#btnDeleteRow').onclick=()=>{ if(schedule.rows.length>1){ schedule.rows.splice(curRow,1); curRow=Math.max(0,curRow-1); renderGrid(); updateSelTime(); } };

    /* ------- Slides box ------- */
    function renderSlides(){ $('#overviewSec').value = settings.slides?.overviewDurationSec ?? DEFAULTS.slides.overviewDurationSec; $('#saunaSec').value = settings.slides?.saunaDurationSec ?? DEFAULTS.slides.saunaDurationSec; $('#transMs').value = settings.slides?.transitionMs ?? DEFAULTS.slides.transitionMs; $('#h1Scale').value = settings.fonts?.h1Scale ?? DEFAULTS.fonts.h1Scale; $('#h2Scale').value = settings.fonts?.h2Scale ?? DEFAULTS.fonts.h2Scale; $('#ovHeadScale').value = settings.fonts?.overviewHeadScale ?? DEFAULTS.fonts.overviewHeadScale; $('#footnote').value = settings.footnote || ''; const fam=settings.fonts?.family||''; $('#fontFamily').value = fam; $('#resetSlides').onclick = ()=>{ $('#overviewSec').value=DEFAULTS.slides.overviewDurationSec; $('#saunaSec').value=DEFAULTS.slides.saunaDurationSec; $('#transMs').value=DEFAULTS.slides.transitionMs; $('#h1Scale').value=DEFAULTS.fonts.h1Scale; $('#h2Scale').value=DEFAULTS.fonts.h2Scale; $('#ovHeadScale').value=DEFAULTS.fonts.overviewHeadScale; $('#fontFamily').value=''; $('#footnote').value=''; }; }

    /* ------- Diagonal/right panel ------- */
    function renderDiag(){ const d=settings.display||{}; $('#rightW').value = d.rightWidthPercent ?? DEFAULTS.display.rightWidthPercent; $('#cutTop').value = d.cutTopPercent ?? DEFAULTS.display.cutTopPercent; $('#cutBottom').value = d.cutBottomPercent ?? DEFAULTS.display.cutBottomPercent; $('#tileVW').value = settings.slides?.tileWidthPercent ?? DEFAULTS.slides.tileWidthPercent; $('#tileMin').value = settings.slides?.tileMinPx ?? DEFAULTS.slides.tileMinPx; $('#tileMax').value = settings.slides?.tileMaxPx ?? DEFAULTS.slides.tileMaxPx; $('#resetDiag').onclick=()=>{ $('#rightW').value=DEFAULTS.display.rightWidthPercent; $('#cutTop').value=DEFAULTS.display.cutTopPercent; $('#cutBottom').value=DEFAULTS.display.cutBottomPercent; $('#tileVW').value=DEFAULTS.slides.tileWidthPercent; $('#tileMin').value=DEFAULTS.slides.tileMinPx; $('#tileMax').value=DEFAULTS.slides.tileMaxPx; } }

    /* ------- Highlight (incl. flame) ------- */
    function renderHighlightBox(){ const hl=settings.highlightNext||DEFAULTS.highlightNext; $('#hlEnabled').checked = !!hl.enabled; $('#hlColor').value = hl.color || DEFAULTS.highlightNext.color; $('#hlAfter').value = Number.isFinite(+hl.minutesAfter)?hl.minutesAfter:DEFAULTS.highlightNext.minutesAfter; const setSw=()=> $('#hlSw').style.background = $('#hlColor').value; setSw(); $('#hlColor').addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)) setSw(); }); // Flame
      const u = settings.assets?.flameImage || DEFAULTS.assets.flameImage; updateFlamePreview(u);
      $('#resetFlame').onclick=()=>{ settings.assets=settings.assets||{}; settings.assets.flameImage = DEFAULTS.assets.flameImage; updateFlamePreview(settings.assets.flameImage); };
      $('#flameFile').onchange=()=> uploadGeneric($('#flameFile'), (p)=>{ settings.assets=settings.assets||{}; settings.assets.flameImage=p; updateFlamePreview(p); });
      $('#resetHL').onclick=()=>{ $('#hlEnabled').checked=false; $('#hlColor').value=DEFAULTS.highlightNext.color; $('#hlAfter').value=DEFAULTS.highlightNext.minutesAfter; setSw(); };
    }
    function updateFlamePreview(u){ const img=$('#flamePrev'); preloadImg(u).then(r=>{ if(r.ok){ img.src=u; img.title=r.w+'×'+r.h; } else { img.removeAttribute('src'); img.title=''; } }); }

    /* ------- Saunas panel ------- */
    function saunaRow(i){ const name = schedule.saunas[i]; const id='sx_'+i; const wrap=document.createElement('div'); wrap.className='sgrid'; const url = (settings.assets?.rightImages?.[name]) || '';
      wrap.innerHTML=`
        <input id="n_${id}" class="input" type="text" value="${name}" />
        <img id="p_${id}" class="prev" alt=""/>
        <label class="btn sm ghost" style="position:relative;overflow:hidden"><input id="f_${id}" type="file" accept="image/*" style="position:absolute;inset:0;opacity:0">Upload</label>
        <button class="btn sm" id="d_${id}">Default</button>
        <button class="btn sm" id="x_${id}">✕</button>`;
      const $name=$(`#n_${id}`,wrap), $img=$(`#p_${id}`,wrap), $file=$(`#f_${id}`,wrap), $def=$(`#d_${id}`,wrap), $del=$(`#x_${id}`,wrap);
      async function updPrev(){ const u=(settings.assets?.rightImages?.[name])||''; if(!u){ $img.src=''; return; } const r=await preloadImg(u); $img.src = r.ok? u : ''; }
      if (url) updPrev();
      $file.onchange=()=> uploadGeneric($file, (p)=>{ settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; settings.assets.rightImages[name]=p; updPrev(); });
      $def.onclick=()=>{ settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; settings.assets.rightImages[name]=DEFAULTS.assets.rightImage; updPrev(); };
      $del.onclick=()=>{ if(!confirm('Sauna wirklich entfernen?')) return; const removedName = schedule.saunas.splice(i,1)[0]; schedule.rows.forEach(r=> r.entries.splice(i,1)); if (settings.assets?.rightImages) delete settings.assets.rightImages[removedName]; renderGrid(); renderSaunasPanel(); };
      // rename mapping key
      $name.onchange=()=>{ const newName=$name.value.trim() || name; if (newName===name) return; const oldName=name; schedule.saunas[i]=newName; if(settings.assets?.rightImages){ const val=settings.assets.rightImages[oldName]; delete settings.assets.rightImages[oldName]; settings.assets.rightImages[newName]=val; } renderGrid(); renderSaunasPanel(); };
      return wrap;
    }
    function renderSaunasPanel(){ const host=$('#saunaGrid'); host.innerHTML=''; settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; (schedule.saunas||[]).forEach((_,i)=> host.appendChild(saunaRow(i)) ); $('#btnAddSauna').onclick=()=>{ const name = prompt('Neuer Saunananame:', 'Neue Sauna'); if(!name) return; schedule.saunas.push(name); schedule.rows.forEach(r=> r.entries.push(null)); renderGrid(); renderSaunasPanel(); }; $('#btnClean').onclick=cleanupAssets; }

    /* ------- Farben (Übersicht) ------- */
    function renderColors(){ const host=$('#colorList'); host.innerHTML=''; const theme=settings.theme||{}; const groups=[ ['Grundfarben', [['bg','Hintergrund'],['fg','Schrift'],['accent','Akzent'],['boxFg','Box-Schrift']]], ['Tabelle', [['gridBorder','Tabellenrand'],['cellBg','Zellen-Hintergrund'],['timeColBg','Zeitspalte'],['zebra1','Zebra 1'],['zebra2','Zebra 2']]], ['Sonstiges', [['saunaColor','Sauna-Überschrift'],['flame','Flammen']]] ]; groups.forEach(([g,fields])=>{ const h=document.createElement('div'); h.style.margin='6px 0 4px'; h.style.opacity='.8'; h.style.fontWeight='700'; h.textContent=g; host.appendChild(h); fields.forEach(([key,label])=>{ const row=document.createElement('div'); row.className='kv'; row.innerHTML=`<label>${label}</label><div class="color-item"><div class="swatch" id="sw_${key}"></div><input class="input" id="cl_${key}" type="text" value="${theme[key]||DEFAULTS.theme[key]||'#FFFFFF'}" placeholder="#RRGGBB"></div>`; host.appendChild(row); }); }); groups.flatMap(x=>x[1]).forEach(([key])=>{ const inp=$(`#cl_${key}`), sw=$(`#sw_${key}`); const setPrev=v=>sw.style.background=v; setPrev(inp.value); inp.addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test(inp.value)) setPrev(inp.value); }); }); $('#resetColors').onclick=()=>{ groups.flatMap(x=>x[1]).forEach(([key])=>{ $(`#cl_${key}`).value=(DEFAULTS.theme[key]||'#FFFFFF'); $(`#sw_${key}`).style.background=(DEFAULTS.theme[key]||'#FFFFFF'); }); }; }

    /* ------- Upload helper & cleanup ------- */
    function uploadGeneric(fileInput, onDone){ if(!fileInput.files || !fileInput.files[0]) return; const fd=new FormData(); fd.append('file', fileInput.files[0]); const xhr=new XMLHttpRequest(); xhr.open('POST','/admin/api/upload.php'); xhr.onload=()=>{ try{ const j=JSON.parse(xhr.responseText||'{}'); if(j.ok){ onDone(j.path); } else { alert('Upload-Fehler: '+(j.error||'')); } }catch{ alert('Upload fehlgeschlagen'); } }; xhr.onerror=()=> alert('Netzwerkfehler beim Upload'); xhr.send(fd); }
    async function cleanupAssets(){ if(!confirm('Unbenutzte Bilder in /assets/img/ löschen?')) return; const r=await fetch('/admin/api/cleanup_assets.php',{method:'POST'}); const j=await r.json(); alert(j.ok? ('Bereinigt: '+j.removed.join(', ')) : ('Fehler: '+(j.error||''))); }

    /* ------- Save / Preview ------- */
    function collectColors(){ const theme={...(settings.theme||{})}; $$('#colorList input[type="text"]').forEach(inp=>{ const v=inp.value.toUpperCase(); if(/^#([0-9A-Fa-f]{6})$/.test(v)) theme[inp.id.replace(/^cl_/,'')]=v; }); return theme; }
    function collectSettings(){ return { schedule:{...schedule}, settings:{ ...settings, footnote: $('#footnote')?.value || settings.footnote || '', fonts:{ family: $('#fontFamily').value||'', h1Scale:+$('#h1Scale').value||1, h2Scale:+$('#h2Scale').value||1, overviewHeadScale:+$('#ovHeadScale').value||1 }, slides:{ overviewDurationSec:+$('#overviewSec').value||10, saunaDurationSec:+$('#saunaSec').value||6, transitionMs:+$('#transMs').value||500, tileWidthPercent:+$('#tileVW').value||45, tileMinPx:+$('#tileMin').value||420, tileMaxPx:+$('#tileMax').value||1200 }, display:{ rightWidthPercent:+$('#rightW').value||38, cutTopPercent:+$('#cutTop').value||28, cutBottomPercent:+$('#cutBottom').value||12 }, theme: collectColors(), highlightNext:{ enabled: $('#hlEnabled').checked, color: /^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)? $('#hlColor').value.toUpperCase() : (settings.highlightNext?.color || DEFAULTS.highlightNext.color), minutesAfter: +( $('#hlAfter').value || DEFAULTS.highlightNext.minutesAfter ) } } }; }

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





