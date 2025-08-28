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
  /* separate borders */
  --gridTable: var(--grid);
  --gridTableW: 2px;
  --tileBorder: var(--grid);
  --tileBorderW: 3px;
  --chipBorder: var(--grid);
  --chipBorderW: 2px;
  --timeZebra1:#EAD9A0; --timeZebra2:#E2CE91; /* Zeitspalte Zebra */
  --headBg:#E8DEBD; --headFg:#5C3101;       /* Kopfzeile */
  --cornerBg:#E8DEBD; --cornerFg:#5C3101;   /* Ecke (oben-links) */
  /* typography */
  --font:-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
  --baseScale:1; --vwScale:1; --scale:calc(var(--baseScale)*var(--vwScale)); --h1Scale:1; --h2Scale:1; --ovHeadScale:0.90; --ovCellScale:0.80;
  --tileTextScale:0.80; --tileWeight:600; --flameSizePx:28; --chipH:44px;
  --ovAuto:1; /* overview-only autoscale factor */

  /* right panel shape */
  --rightW:38%; --cutTop:28%; --cutBottom:12%;

  /* sauna tile clamp (JS sets --tileTargetPx) */
  --tileMinPx:480px; --tileMaxPx:1100px; --tileTargetPx:860px;
  --flameSizePxOv:18; /* kleine Flames in Übersicht-Chips */
  --ovTitleScale:1; /* nur H1 der Übersicht */
  --flamesColW: calc(var(--flameSizePx)*1px*var(--scale)*3 + 24px);
}
*{box-sizing:border-box}
html,body{height:100%;margin:0;background:var(--bg);color:var(--fg);font-family:var(--font)}
.slideshow{overflow:hidden}

/* Full-viewport – no transform */
.fitbox{position:fixed; inset:0;}
.canvas{position:relative; width:100vw; height:100vh;}
.stage{position:relative; width:100%; height:100%; overflow:hidden}

.fade{opacity:0;transition:opacity .5s}
.fade.show{opacity:1}

/* layout */
.container{position:relative; height:100%; padding:calc(32px*var(--vwScale)); display:flex; flex-direction:column; align-items:flex-start}
.container.has-right{padding-right:calc(var(--rightW) + 32px)}
.container.overview{padding-right:32px}
.h1{font-weight:800;letter-spacing:.02em;font-size:calc(56px*var(--scale)*var(--h1Scale));margin:0 0 10px}
.h2{font-weight:700;letter-spacing:.01em;opacity:.95;font-size:calc(36px*var(--scale)*var(--h2Scale));margin:0 0 14px}
/* overview-only multiply with --ovAuto */
.ovbar{display:flex;align-items:baseline;justify-content:space-between;gap:12px;width:100%;margin:0 0 10px}
.overview .h1{font-size:calc(56px*var(--scale)*var(--ovTitleScale)*var(--ovAuto))}
.overview .h2{font-size:calc(36px*var(--scale)*var(--h2Scale)*var(--ovAuto))}
.caption{opacity:.85;font-size:calc(20px*var(--scale))}

/* content area under headings is vertically centered */
.body{flex:1; display:flex}
.list{display:flex;flex-direction:column;gap:calc(18px*var(--vwScale));width:100%;align-items:flex-start;justify-content:center}

/* right image panel */
.rightPanel{
  position:absolute; top:0; right:0; height:100%; width:var(--rightW);
  background-size:cover; background-position:center; background-repeat:no-repeat;
  -webkit-clip-path: polygon(var(--cutTop) 0, 100% 0, 100% 100%, var(--cutBottom) 100%);
          clip-path: polygon(var(--cutTop) 0, 100% 0, 100% 100%, var(--cutBottom) 100%);
  box-shadow: -6px 0 20px rgba(0,0,0,.15) inset;
}

/* overview table */
.grid{width:100%;max-width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed}
.grid col.c_time{width:10ch}
.grid th,.grid td{border:var(--gridTableW) solid var(--gridTable);white-space:nowrap}
.grid thead th{font-size:calc(22px*var(--scale)*var(--ovHeadScale)*var(--ovAuto));padding:calc(8px*var(--vwScale)) calc(12px*var(--vwScale));text-align:center;background:var(--headBg);color:var(--headFg)}
.grid thead th.corner{background:var(--cornerBg);color:var(--cornerFg)}

/* zebra: rows for content cells, separate zebra for time column */
.grid tbody tr:nth-child(odd) td:not(.timecol){background:var(--zebra1)}
.grid tbody tr:nth-child(even) td:not(.timecol){background:var(--zebra2)}
.grid tbody tr:nth-child(odd) td.timecol{background:var(--timeZebra1)!important}
.grid tbody tr:nth-child(even) td.timecol{background:var(--timeZebra2)!important}

.grid td{font-size:calc(22px*var(--scale)*var(--ovCellScale)*var(--ovAuto));padding:calc(8px*var(--vwScale)) calc(12px*var(--vwScale))}
.grid th.timecol, .grid td.timecol{width:10ch}
.grid td.timecol{background:var(--timecol)!important;text-align:center;font-weight:800;min-width:10ch;color:var(--fg)}

/* equal chips */
.cellwrap{display:block;width:100%;min-width:0}
.chip{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:var(--chipH);padding:0 .8em;padding-right:calc(3*(var(--flameSizePxOv)*1px*var(--scale))+24px);border-radius:10px;background:var(--cell);color:var(--boxfg);border:var(--chipBorderW) solid var(--chipBorder);font-weight:700;letter-spacing:.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip sup{margin-left:.25em}
/* flames inside chip */
.chip .flames{position:absolute;right:.6em;top:50%;transform:translateY(-50%);gap:6px}
.overview .chip .flame{width:calc(var(--flameSizePxOv)*1px*var(--scale));height:calc(var(--flameSizePxOv)*1px*var(--scale))}

/* overview wrapper */
.ovwrap{display:block;width:100%}

/* sauna tiles */
.tile{display:grid; grid-template-columns:1fr auto; align-items:center; gap:calc(16px*var(--vwScale));
  width: clamp(calc(var(--tileMinPx)*var(--vwScale)), var(--tileTargetPx), calc(var(--tileMaxPx)*var(--vwScale)));
  padding:calc(14px*var(--vwScale)) calc(18px*var(--vwScale)); background:var(--cell);   border:calc(var(--tileBorderW)*var(--vwScale)) solid var(--tileBorder); border-radius:16px; color:var(--boxfg);
}
.title{font-size:calc(40px*var(--scale)*var(--tileTextScale)); font-weight:var(--tileWeight)}
.flames{display:flex;gap:10px;align-items:center; justify-self:end}
.flame{width:calc(var(--flameSizePx)*1px*var(--scale)); height:calc(var(--flameSizePx)*1px*var(--scale))}
.flame img,.flame svg{width:100%;height:100%;object-fit:contain}
.flame svg path{fill:var(--flame)}

/* note markers subtle */
.notewrap sup.note{font-weight:400; opacity:.75; font-size:.8em}

/* highlight */
.tile.highlight{border-color:var(--hlColor); box-shadow:0 0 0 4px var(--hlColor)}
.chip.highlight{outline:3px solid var(--hlColor); outline-offset:2px}

/* footnotes inline */
.footer-note{margin-top:12px;font-size:calc(16px*var(--scale)*var(--ovAuto));opacity:.9; display:flex; align-items:center; gap:16px; flex-wrap:wrap}
.footer-note .fnitem{display:flex; align-items:baseline; gap:6px}

.brand{position:absolute;right:20px;bottom:16px;opacity:.6;font-size:14px;color:var(--fg)}
CSS

cat >/var/www/signage/assets/slideshow.js <<'JS'
(() => {
  const FITBOX = document.getElementById('fitbox');
  const CANVAS = document.getElementById('canvas');
  const STAGE  = document.getElementById('stage');

  let schedule = null;
  let settings = null;
  let nextQueue = [];
  let idx = 0;
  let slideTimer = 0, transTimer = 0;
  let onResizeCurrent = null;

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
    buildQueue();
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
      '--chipH': (settings?.fonts?.chipHeight || 44) + 'px'
    });
    if (settings?.fonts?.family) document.documentElement.style.setProperty('--font', settings.fonts.family);
    ensureFontFamily();
  }

  function applyDisplay() {
    const d = settings?.display || {};
    if (typeof d.rightWidthPercent === 'number') document.documentElement.style.setProperty('--rightW', d.rightWidthPercent + '%');
    if (typeof d.cutTopPercent === 'number')     document.documentElement.style.setProperty('--cutTop', d.cutTopPercent + '%');
    if (typeof d.cutBottomPercent === 'number')  document.documentElement.style.setProperty('--cutBottom', d.cutBottomPercent + '%');

    const baseW = d.baseW || 1920;
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
    const cfgOrder = Array.isArray(settings?.slides?.order) ? settings.slides.order.slice() : null;
    const allSaunas = (schedule?.saunas || []).slice();
    const queue = []; const seen = new Set();

    if (!cfgOrder || cfgOrder.length === 0) {
      queue.push({ type: 'overview' });
      for (const s of allSaunas) queue.push({ type: 'sauna', sauna: s });
    } else {
      let addedOverview = false;
      for (const e of cfgOrder) {
        if (e === 'overview') { if (!addedOverview) { queue.push({ type: 'overview' }); addedOverview = true; } continue; }
        if (allSaunas.includes(e) && !seen.has(e)) { seen.add(e); queue.push({ type: 'sauna', sauna: e }); }
      }
      for (const s of allSaunas) if (!seen.has(s)) queue.push({ type: 'sauna', sauna: s });
      if (!queue.some(x => x.type === 'overview')) queue.unshift({ type: 'overview' });
    }
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
          const chip = h('span', { class: 'chip' + (hlMap.byCell[key] ? ' highlight' : '') }, title);
          if (hasStarInText) chip.appendChild(h('span', { class: 'notewrap' }, [h('sup', {class:'note legacy'}, '*')]));
          const supNote = noteSup(cell, notes);
          if (supNote) { chip.appendChild(h('span', { class: 'notewrap' }, [supNote])); usedSet.add(cell.noteId); }
          // Flames INSIDE the chip (overview-specific sizing via CSS)
          chip.appendChild(flamesWrap(cell.flames || ''));
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
    if (footNodes.length) return h('div', {}, [t, h('div', { class: 'footer-note' }, footNodes)]);
    return t;
  }

  function autoScaleOverview(container) {
    const wrap = container.querySelector('.ovwrap'); if (!wrap) return;
    const measure = () => {
      const headH = Array.from(container.querySelectorAll('.h1,.h2'))
        .reduce((a, el) => a + el.getBoundingClientRect().height, 0);
      const foot = container.querySelector('.footer-note');
      const wrapH = wrap.getBoundingClientRect().height;
      const footH = foot ? foot.getBoundingClientRect().height : 0;
      return headH + wrapH + footH + 8; // small safety
    };
    const avail = container.clientHeight;
    let s = 1, total, last = Infinity, iter = 0;
    container.style.setProperty('--ovAuto', '1');
    total = measure();
    // iterate to converge (z. B. wenn Fonts/Paddings mitskalieren)
    while (total > avail && iter < 6) {
      const target = avail / total;
      // leichte Dämpfung verhindert Übersteuern
      s = Math.max(0.4, Math.min(1, target * (iter ? 0.98 : 1)));
      container.style.setProperty('--ovAuto', String(s));
      last = total;
      total = measure();
      if (Math.abs(total - last) < 0.5) break; // konvergiert
      iter++;
    }
  }

  function renderOverview() {
    const hlMap = getHighlightMap();
    const table = tableGrid(hlMap);
    const rightH2 = (((settings?.h2?.showOnOverview) ?? true) && (settings?.h2?.mode||'text')!=='none')
      ? h('h2',{class:'h2'}, computeH2Text() || '')
      : null;
    const bar = h('div',{class:'ovbar'}, [ h('h1',{class:'h1'}, 'Aufgussplan'), rightH2 ]);
    const c = h('div', {class:'container overview fade show'}, [ bar, h('div', {class:'ovwrap'}, [table]) ]);
    const recalc = () => autoScaleOverview(c);
    setTimeout(recalc, 0);
    onResizeCurrent = recalc;
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
    const minPx = settings?.slides?.tileMinPx ?? 480;
    const maxPx = settings?.slides?.tileMaxPx ?? 1100;
    container.style.setProperty('--tileTargetPx', target + 'px');
    container.style.setProperty('--tileMinPx', minPx + 'px');
    container.style.setProperty('--tileMaxPx', maxPx + 'px');
  }

  // ---------- Sauna slide ----------
  function renderSauna(name) {
    const hlMap = getHighlightMap();
    const rightUrl = settings?.assets?.rightImages?.[name] || '';
    const c = h('div', { class: 'container has-right fade show' }, [
      h('div', { class: 'rightPanel', style: rightUrl ? ('background-image:url("' + rightUrl + '")') : 'display:none;' }),
      h('h1', { class: 'h1', style: 'color:var(--saunaColor);' }, name),
      h('h2', {class:'h2'}, computeH2Text() || '')
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
    if (footNodes.length) c.appendChild(h('div', { class: 'footer-note' }, footNodes));

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

  // ---------- Loop ----------
  function step() {
    if (!nextQueue.length) return;
    clearTimers(); // verhindert Doppelplanung z. B. nach Preview/Reload

    const item = nextQueue[idx % nextQueue.length];
    const el = (item.type === 'overview') ? renderOverview() : renderSauna(item.sauna);
    show(el);

    const base = (item.type === 'overview')
      ? (settings?.slides?.overviewDurationSec ?? 10) * 1000
      : (settings?.slides?.saunaDurationSec ?? 6) * 1000;

    // Standard: Sichtzeit = base, Transition kommt oben drauf
    const dwell = base;

    slideTimer = setTimeout(() => hide(() => { idx++; step(); }), dwell);
  }

  // ---------- Bootstrap & live update ----------
  async function bootstrap() {
    await loadAll();
    step();
    let lastSchedVer = schedule?.version || 0;
    let lastSetVer   = settings?.version || 0;
    setInterval(async () => {
      try { const s = await loadJSON('/data/schedule.json'); if (s.version !== lastSchedVer) { schedule = s; lastSchedVer = s.version; buildQueue(); } } catch (e) {}
      try {
        const cf = await loadJSON('/data/settings.json');
        if (cf.version !== lastSetVer) {
          settings = cf; lastSetVer = cf.version;
          applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
          clearTimers(); idx = idx % nextQueue.length; step(); // sofort neu rendern (H2 inkl.)
        }
      } catch (e) {}
    }, 3000);

    window.addEventListener('message', (ev) => {
      if (!ev?.data || ev.data.type !== 'preview') return;
      const p = ev.data.payload || {};
      if (p.schedule) schedule = p.schedule;
      if (p.settings) settings = p.settings;
      clearTimers();
      applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue(); idx = 0; step();
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
    /* Light theme overrides (apply via <body class="theme-light">) */
    .theme-light{
      --bg:#f6f8ff; --fg:#0b1220; --mut:#5b6478; --acc:#C38700; --acc2:#E7B416;
      --br:#d6deee; --card:#ffffff; --card2:#f6f8ff; --input:#ffffff; --inbr:#c9d4ea; --shadow:0 8px 20px rgba(0,0,0,.08);
    }
    /* Light mode: schwarze Schrift in Inputs & helle Tabelle */
    .theme-light .input,
    .theme-light select,
    .theme-light textarea{ color:#0b1220 !important; background:#ffffff !important; border-color:#c9d4ea !important; }

    .theme-light .tbl th,
    .theme-light .tbl td{ background:#eef2f7 !important; color:#0b1220 !important; border-color:#c9d4ea !important; }
    .theme-light .tbl th{ background:#e9eef7 !important; }

    .theme-light .cellbtn{ color:#0b1220 !important; background:#ffffff !important; border-color:#c9d4ea !important; }
    .theme-light .cellbtn.filled{ background:#f7f9ff !important; border-color:#c9d4ea !important; }

    .theme-light .help{ color:#5b6478 !important; }

    *{box-sizing:border-box}
    html,body{height:100%;margin:0;background:radial-gradient(1200px 600px at 20% -5%, #0e1630, #070a12);color:var(--fg);font:14px/1.45 system-ui,Segoe UI,Roboto,Arial,sans-serif}
    body.theme-light{ background:radial-gradient(1200px 600px at 20% -5%, #ffffff, #e9edf7); color:var(--fg); }
    a{color:#98c7ff}
    header{position:sticky;top:0;z-index:60;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--br);background:rgba(7,10,18,.85);backdrop-filter:blur(8px)}
    .theme-light header h1{ color:#ffffff !important; }  
h1{margin:0;font-size:16px;letter-spacing:.3px}
    .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .btn{border:1px solid var(--inbr);background:linear-gradient(180deg,#131a2d,#0e1426);color:#eaf0ff;padding:9px 12px;border-radius:12px;cursor:pointer;transition:transform .06s ease,filter .2s}
    .btn:hover{filter:brightness(1.06)} .btn:active{transform:translateY(1px)} .btn.primary{background:var(--acc);color:#0b0d12;border-color:var(--acc);font-weight:700} .btn.ghost{background:transparent} .btn.sm{padding:6px 10px;border-radius:10px}
    /* theme toggle */
    .theme-light .btn.ghost,
    .theme-light label.btn.ghost{ color:#0b1220 !important; }
    .theme-light #btnCleanup,
    .theme-light #resetColors,
    .theme-light #resetSlides{ color:#0b1220 !important; }
.theme-light .toggle{background:#fff}
    .toggle{display:flex;align-items:center;gap:8px;border:1px solid var(--inbr);padding:7px 10px;border-radius:12px;background:linear-gradient(180deg,#131a2d,#0e1426);cursor:pointer}
    .toggle input{appearance:none;width:28px;height:16px;border-radius:999px;background:#4b5563;position:relative;outline:0}
    .toggle input:checked{background:#22c55e}
    .toggle input::after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:left .15s}
    .toggle input:checked::after{left:14px}


    main.layout{width:100%;display:grid;grid-template-columns:minmax(0,1fr) 580px;gap:16px;padding:16px 12px 18px 16px;align-items:start}
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

    .kv{display:grid;grid-template-columns:220px 1fr;gap:10px;align-items:center}
    .input, select, textarea{background:var(--input);border:1px solid var(--inbr);color:#fff;border-radius:12px;padding:9px;width:100%}

    .saunarow{display:grid;grid-template-columns:1fr 64px auto auto auto auto;gap:10px;align-items:center;margin-bottom:10px}
    .prev{width:64px;height:46px;border-radius:10px;border:1px solid var(--inbr);object-fit:cover;background:#0d1426}

    .color-cols{display:grid;grid-template-columns:1fr;gap:12px}
    .fieldset{border:1px dashed var(--inbr);border-radius:12px;padding:10px}
    .fieldset > .legend{opacity:.8;font-weight:700;margin-bottom:8px}
    .color-item{display:flex;align-items:center;gap:8px}
    .swatch{width:24px;height:24px;border-radius:6px;border:1px solid #2f3f60}

    .subh{margin:12px 0 6px;font-weight:800;opacity:.95}
    .mut{opacity:.7}
    .help{opacity:.7;font-size:12px}

    footer{display:flex;justify-content:flex-end;padding:12px 16px;border-top:1px solid var(--br);color:var(--mut)}

    .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;place-items:center;z-index:100}
    .modal .input, .modal select, .modal textarea{ min-width:0 }
    .modal .row{ flex-wrap:wrap; }
    .theme-light .modal .box{ background:#eef2f7 !important; color:#0b1220 !important; border-color:#c9d4ea !important; }
    .box{background:#0e1426;border:1px solid var(--inbr);border-radius:16px;min-width:min(340px,95vw);max-width:95vw;max-height:90svh;overflow:auto;padding:16px}
    .grid2{display:grid;grid-template-columns:130px minmax(0,1fr);gap:10px;align-items:center; width:min(560px,calc(95vw - 36px)); margin:0 auto 12px}
    .iframeWrap{width:min(92vw,1600px);height:min(85svh,900px);border:1px solid var(--inbr);border-radius:14px;overflow:hidden;background:#000}
    .iframeWrap iframe{width:100%;height:100%;display:block;border:0}
  </style>
</head>
<body>
  <header>
    <h1>Aufguss – Admin</h1>
    <div class="row">
      <label class="toggle" title="Hell/Dunkel">
        <input type="checkbox" id="themeMode">
        <span id="themeLabel">Dunkel</span>
      </label>
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
            <div style="font-weight:700">Tabelle <span class="mut">(Zeiten × Saunen)</span></div>
            <div class="row"><span class="mut">Ausgewählte Zeit:</span> <span id="selTime" style="font-weight:700">—</span></div>
          </div>
          <table id="grid" class="tbl"></table>
          <div class="row" style="margin:12px 0 4px">
            <button class="btn sm" id="btnAddAbove">Zeile darüber +</button>
            <button class="btn sm" id="btnAddBelow">Zeile darunter +</button>
            <button class="btn sm" id="btnDeleteRow">Ausgewählte Zeile löschen</button>
            <span class="mut">Zeit anklicken = Zeile markieren · Zeitänderungen im Dialog verschieben Aufguss korrekt.</span>
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
          <div class="subh">Skalierung & 16:9</div>
          <div class="kv"><label>Fit‑Modus</label>
            <select id="fitMode" class="input">
              <option value="cover">Cover (bildschirmfüllend, kann beschneiden)</option>
              <option value="contain">Contain (einpassen, keine Beschneidung)</option>
              <option value="width">Nur Breite anpassen</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div class="help">„Cover“ füllt 1080p/1440p **ohne Rand**. Andere Verhältnisse werden ggf. beschnitten. „Contain“ zeigt immer alles (Rand möglich).</div>

          <div class="subh">Zeiten & Dauer</div>
          <div class="kv"><label>Übersicht (Sek.)</label><input id="overviewSec" class="input" type="number" min="1" value="10"></div>
          <div class="kv"><label>Saunafolie (Sek.)</label><input id="saunaSec" class="input" type="number" min="1" value="6"></div>
          <div class="kv"><label>Transition (ms)</label><input id="transMs" class="input" type="number" min="0" value="500"></div>

          <div class="subh">Schrift</div>
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
          <div class="kv"><label>H2 Modus</label>
            <select id="h2Mode" class="input">
              <option value="none">— nichts —</option>
              <option value="text" selected>Nur Text</option>
              <option value="weekday">Wochentag</option>
              <option value="date">Datum</option>
              <option value="text+weekday">Text + Wochentag</option>
              <option value="text+date">Text + Datum</option>
            </select>
          </div>
          <div class="kv"><label>H2 Text</label><input id="h2Text" class="input" type="text" placeholder="Aufgusszeiten"></div>
          <div class="kv"><label>H2 in Übersicht anzeigen</label><input id="h2ShowOverview" type="checkbox" checked></div>

          <div class="subh">Übersicht (Tabelle)</div>
          <div class="kv"><label>Übersichtstitel Scale</label><input id="ovTitleScale" class="input" type="number" step="0.05" min="0.4" max="4" value="1"></div>
          <div class="kv"><label>Kopf‑Scale</label><input id="ovHeadScale" class="input" type="number" step="0.05" min="0.5" max="3" value="0.9"></div>
          <div class="kv"><label>Zellen‑Scale</label><input id="ovCellScale" class="input" type="number" step="0.05" min="0.5" max="3" value="0.8"></div>
          <div class="kv"><label>Chip‑Höhe (px)</label><input id="chipH" class="input" type="number" min="20" max="120" value="44"></div>
          <div class="help">Chips sind immer gleich breit/hoch (füllen die Zelle) und zentriert.</div>

          <div class="subh">Saunafolien (Kacheln)</div>
          <div class="kv"><label>Text‑Scale</label><input id="tileTextScale" class="input" type="number" step="0.05" min="0.5" max="3" value="0.8"></div>
          <div class="kv"><label>Font‑Weight</label>
            <select id="tileWeight" class="input">
              <option value="400">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600" selected>Semibold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">Extra Bold (800)</option>
            </select>
          </div>
          <div class="kv"><label>Kachel‑Breite % (sichtbarer Bereich)</label><input id="tilePct" class="input" type="number" min="1" max="100" value="45"></div>
          <div class="kv"><label>Kachel‑Breite min (px)</label><input id="tileMin" class="input" type="number" min="100" max="2000" value="480"></div>
          <div class="kv"><label>Kachel‑Breite max (px)</label><input id="tileMax" class="input" type="number" min="200" max="3000" value="1100"></div>

          <div class="subh">Bildspalte / Schrägschnitt</div>
          <div class="kv"><label>Breite rechts (%)</label><input id="rightW" class="input" type="number" min="0" max="70" value="38"></div>
          <div class="kv"><label>Schnitt oben (%)</label><input id="cutTop" class="input" type="number" min="0" max="100" value="28"></div>
          <div class="kv"><label>Schnitt unten (%)</label><input id="cutBottom" class="input" type="number" min="0" max="100" value="12"></div>
          <div class="help">Bestimmt Breite der Bildspalte und die beiden Ankerpunkte (oben/unten) der diagonalen Schnittkante.</div>

          <div class="subh">Flammen / Hervorhebungen</div>
          <div class="kv"><label>Highlight aktiv</label><input id="hlEnabled" type="checkbox"></div>
          <div class="kv"><label>Highlight‑Farbe (Hex)</label><div class="color-item"><div id="hlSw" class="swatch"></div><input id="hlColor" class="input" type="text" value="#FFDD66" placeholder="#RRGGBB"></div></div>
          <div class="kv"><label>Min. vor Start</label><input id="hlBefore" class="input" type="number" min="0" max="120" value="15"></div>
          <div class="kv"><label>Min. nach Start</label><input id="hlAfter" class="input" type="number" min="0" max="120" value="15"></div>
          <div class="kv"><label>Flammen‑Bild</label>
            <div class="row" style="gap:8px">
              <img id="flamePrev" class="prev" alt="">
              <input id="flameImg" type="hidden" />
              <label class="btn sm ghost" style="position:relative;overflow:hidden"><input id="flameFile" type="file" accept="image/*" style="position:absolute;inset:0;opacity:0">Upload</label>
              <button class="btn sm" id="resetFlame">Default</button>
            </div>
          </div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Saunen</div>
          <div class="actions">
            <button class="btn sm" id="btnAddSauna">Sauna hinzufügen</button>
            <button class="btn sm ghost" id="btnCleanup">Assets aufräumen</button>
          </div>
        </summary>
        <div class="content">
          <div class="row mut" style="font-weight:700;margin-bottom:6px">
            <div style="width:100%">Name · Preview · Upload · Default · Entfernen</div>
          </div>
          <div id="saunaList"></div>
        </div>
      </details>

      <details class="ac">
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Presets (Zeitpläne)</div>
        </summary>
        <div class="content">
          <div class="kv"><label>Wochentag</label>
            <select id="presetKey" class="input">
              <option value="Mon">Montag</option><option value="Tue">Dienstag</option><option value="Wed">Mittwoch</option>
              <option value="Thu">Donnerstag</option><option value="Fri">Freitag</option><option value="Sat">Samstag</option>
              <option value="Sun">Sonntag</option><option value="Default">Default</option>
            </select>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn sm" id="psSave">Preset speichern (aus aktueller Tabelle)</button>
            <button class="btn sm" id="psLoad">Preset laden → Tabelle</button>
          </div>
          <div class="kv" style="margin-top:8px">
            <label>Auto je Wochentag</label><input id="presetAuto" type="checkbox">
          </div>
          <div class="help">„Speichern“ legt das ausgewählte Wochentags-Preset an/aktualisiert (inkl. Saunenspalten). „Laden“ überschreibt die Tabelle.</div>
        </div>
      </details>

      <details class="ac" open>
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Farben (Übersicht & Zeitspalte)</div>
          <div class="actions"><button class="btn sm ghost" id="resetColors">Standardwerte</button></div>
        </summary>
        <div class="content color-cols" id="colorList"></div>
      </details>

      <details class="ac">
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Fußnoten (Liste)</div>
          <div class="actions"><button class="btn sm" id="fnAdd">Hinzufügen</button></div>
        </summary>
        <div class="content">
          <div id="fnList"></div>
          <div class="help">Jede Fußnote hat ein <b>Label</b> (z. B. *, †, 1) und einen <b>Text</b>. Label erscheint als Hochstellung am Eintrag und in der Legende.</div>
        </div>
      </details>

      <details class="ac">
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> System</div>
        </summary>
        <div class="content">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <button class="btn" id="btnExport">Export</button>

            <label class="btn sm ghost" style="gap:6px;display:flex;align-items:center">
              <input type="checkbox" id="expWithSettings" checked>Einstellungen einschließen
            </label>
            <label class="btn sm ghost" style="gap:6px;display:flex;align-items:center">
              <input type="checkbox" id="expWithSchedule" checked>Aufgusszeiten einschließen
            </label>
            <label class="btn sm ghost" style="gap:6px;display:flex;align-items:center">
              <input type="checkbox" id="expWithImg">Bilder einschließen
            </label>

            <label class="btn" style="position:relative;overflow:hidden">
              Import<input id="importFile" type="file" accept="application/json" style="position:absolute;inset:0;opacity:0">
            </label>
            <label class="btn sm ghost" style="gap:6px;display:flex;align-items:center">
              <input type="checkbox" id="impWriteSettings" checked>Einstellungen anwenden
            </label>
            <label class="btn sm ghost" style="gap:6px;display:flex;align-items:center">
              <input type="checkbox" id="impWriteSchedule" checked>Aufgusszeiten anwenden
            </label>
            <label class="btn sm ghost" style="gap:6px;display:flex;align-items:center">
              <input type="checkbox" id="impWriteImg" checked>Bilder einspielen
            </label>
          </div>
          <small class="help">Export/Import von Einstellungen & Plan. „Bilder einschließen“ packt Flamme & Saunen-Bilder mit ein.</small>
        </div>
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
        <label>Fußnote</label>
        <div>
          <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="m_hasNote"> hinzufügen</label>
          <div class="row" id="m_noteRow" style="margin-top:8px;display:none">
            <select id="m_note" class="input"></select>
          </div>
        </div>
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
      <small class="mut" style="display:block;margin-top:8px">Die Vorschau verwendet die aktuellen (nicht gespeicherten) Einstellungen.</small>
    </div>
  </div>

  <script>
    const DEFAULTS = {
      slides:{ overviewDurationSec:10, saunaDurationSec:6, transitionMs:500, tileWidthPercent:45, tileMinPx:480, tileMaxPx:1100 },
      display:{ fit:'cover', baseW:1920, baseH:1080, rightWidthPercent:38, cutTopPercent:28, cutBottomPercent:12 },
      theme:{
        bg:'#E8DEBD', fg:'#5C3101', accent:'#5C3101',
        gridBorder:'#5C3101',
        gridTable:'#5C3101', gridTableW:2,
        cellBg:'#5C3101', boxFg:'#FFFFFF',
        headRowBg:'#E8DEBD', headRowFg:'#5C3101',
        timeColBg:'#E8DEBD', timeZebra1:'#EAD9A0', timeZebra2:'#E2CE91',
        zebra1:'#EDDFAF', zebra2:'#E6D6A1',
        cornerBg:'#E8DEBD', cornerFg:'#5C3101',
        tileBorder:'#5C3101',
        chipBorder:'#5C3101', chipBorderW:2,
        flame:'#FFD166',
        saunaColor:'#5C3101'
      },
      highlightNext:{ enabled:false, color:'#FFDD66', minutesBeforeNext:15, minutesAfterStart:15 },
      fonts:{ family:"system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif", scale:1, h1Scale:1, h2Scale:1, overviewTitleScale:1, overviewHeadScale:0.9, overviewCellScale:0.8, tileTextScale:0.8, tileWeight:600, chipHeight:44 },
      h2:{ mode:'text', text:'Aufgusszeiten', showOnOverview:true },
 assets:{ flameImage:'/assets/img/flame_test.svg' },
      footnotes:[ {id:'star', label:'*', text:'Nur am Fr und Sa'} ]
    };

    let schedule=null, settings=null, curRow=0, curCol=0;
    const $=(s,r=document)=>r.querySelector(s);
    const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
    const preloadImg=(u)=> new Promise(res=>{ if(!u) return res({ok:false}); const i=new Image(); i.onload=()=>res({ok:true,w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res({ok:false}); i.src=u; });
    const parseTime = (s) => { const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec((s||'').trim()); return m ? (m[1]+':'+m[2]) : null; };
    const genId = () => 'fn_' + Math.random().toString(36).slice(2,9);

    async function loadAll(){
      const [s,cfg]=await Promise.all([
        fetch('/admin/api/load.php').then(r=>r.json()),
        fetch('/admin/api/load_settings.php').then(r=>r.json())
      ]);
      schedule=s; settings=cfg;
      settings.slides = { ...DEFAULTS.slides, ...(settings.slides||{}) };
      settings.display= { ...DEFAULTS.display, ...(settings.display||{}) };
      settings.theme  = { ...DEFAULTS.theme,   ...(settings.theme||{}) };
      settings.fonts  = { ...DEFAULTS.fonts,   ...(settings.fonts||{}) };
      settings.assets = { ...DEFAULTS.assets,  ...(settings.assets||{}) };
      settings.footnotes = Array.isArray(settings.footnotes) ? settings.footnotes : (DEFAULTS.footnotes||[]);

      renderGrid();
      renderSlides();
      renderHighlightBox();
      renderSaunasPanel();
      renderColors();
      renderFootnotes();
renderPresets();
    }

    // ------- Grid -------
    function renderGrid(){
      const head=['Zeit',...(schedule.saunas||[])];
      let html='<thead><tr>' + head.map((h,i)=>`<th class="${i===0?'timecol corner':''}">${h}</th>`).join('') + '</tr></thead><tbody>';
      (schedule.rows||[]).forEach((row,ri)=>{
        html+='<tr>';
        html+=`<td class="time timecol" data-ri="${ri}"><input class="input" type="text" value="${row.time}" style="width:7.5ch;text-align:center"></td>`;
        (row.entries||[]).forEach((cell,ci)=>{
          const filled = (cell && cell.title) ? 'filled' : '';
          const label = (cell && cell.title) ? (cell.title + (cell.flames ? (' · '+cell.flames) : '')) : '—';
          html+=`<td><button class="cellbtn ${filled}" data-ri="${ri}" data-ci="${ci}">${label}</button></td>`;
        });
        html+='</tr>';
      });
      html+='</tbody>';
      $('#grid').innerHTML=html;

      $$('#grid .time input').forEach(inp=>{
        inp.onchange=()=>{
          const ri=+inp.parentElement.dataset.ri;
          const t=parseTime(inp.value);
          if(!t){ alert('Bitte HH:MM'); inp.value=schedule.rows[ri].time; return;}
          schedule.rows[ri].time=t;
          schedule.rows.sort((a,b)=>a.time.localeCompare(b.time));
          renderGrid();
        };
        inp.onclick=()=>{ curRow=+inp.parentElement.dataset.ri; updateSelTime(); };
      });
      $$('#grid .cellbtn').forEach(btn=>{
        btn.onclick=()=>{
          curRow=+btn.dataset.ri; curCol=+btn.dataset.ci; updateSelTime();
          const cell=schedule.rows[curRow].entries[curCol]||{};
          $('#m_time').value=schedule.rows[curRow].time;
          $('#m_title').value=cell.title||'';
          $('#m_flames').value=cell.flames||'';
          populateNoteSelect();
          const has = !!cell.noteId;
          $('#m_hasNote').checked = has;
          $('#m_noteRow').style.display = has ? 'flex' : 'none';
          if (has) $('#m_note').value = cell.noteId;
          $('#modal').style.display='grid';
          $('#m_title').focus();
        };
      });
    }
    function updateSelTime(){ $('#selTime').textContent=schedule.rows[curRow]?.time||'—'; }

    // Dialog
    $('#m_cancel').onclick=()=> $('#modal').style.display='none';
    $('#m_hasNote').onchange=()=>{ $('#m_noteRow').style.display = $('#m_hasNote').checked ? 'flex' : 'none'; };
    function populateNoteSelect(){
      const sel = $('#m_note'); sel.innerHTML='';
      (settings.footnotes||[]).forEach(fn=>{
        const o=document.createElement('option'); o.value=fn.id; o.textContent=`${fn.label} — ${fn.text}`; sel.appendChild(o);
      });
    }
    $('#m_ok').onclick=()=>{
      const title=$('#m_title').value.trim();
      const flames=$('#m_flames').value;
      const newTime=parseTime($('#m_time').value);
      const hasNote=$('#m_hasNote').checked;
      const noteId= hasNote ? $('#m_note').value : null;
      if (!newTime && title){ alert('Bitte Zeit HH:MM'); return; }
      const newCell= title? {title,flames} : null;
      if (newCell && hasNote) newCell.noteId = noteId;

      if (newTime && newTime!==schedule.rows[curRow].time && newCell){
        let targetIdx=schedule.rows.findIndex(r => r.time===newTime);
        if(targetIdx===-1){ const cols=schedule.saunas.length; schedule.rows.push({time:newTime, entries:Array.from({length:cols}).map(()=>null)}); schedule.rows.sort((a,b)=>a.time.localeCompare(b.time)); targetIdx=schedule.rows.findIndex(r => r.time===newTime);} 
        schedule.rows[targetIdx].entries[curCol]=newCell; schedule.rows[curRow].entries[curCol]=null;
      } else {
        schedule.rows[curRow].entries[curCol]=newCell; if (newTime) schedule.rows[curRow].time=newTime;
      }
      schedule.rows.sort((a,b)=>a.time.localeCompare(b.time));
      $('#modal').style.display='none';
      renderGrid();
    };

    // Row ops
    $('#btnAddAbove').onclick=()=>{ const cols=schedule.saunas.length; schedule.rows.splice(curRow,0,{time:'00:00', entries:Array.from({length:cols}).map(()=>null)}); renderGrid(); };
    $('#btnAddBelow').onclick=()=>{ const cols=schedule.saunas.length; schedule.rows.splice(curRow+1,0,{time:'00:00', entries:Array.from({length:cols}).map(()=>null)}); renderGrid(); };
    $('#btnDeleteRow').onclick=()=>{ if(schedule.rows.length>1){ schedule.rows.splice(curRow,1); curRow=Math.max(0,curRow-1); renderGrid(); updateSelTime(); } };

    // ------- Slides & Settings -------
    function renderSlides(){
      const f=settings.fonts||{};
      $('#fitMode').value   = settings.display?.fit || 'cover';
      $('#overviewSec').value = settings.slides?.overviewDurationSec??10;
      $('#saunaSec').value    = settings.slides?.saunaDurationSec??6;
      $('#transMs').value     = settings.slides?.transitionMs??500;

      $('#fontFamily').value  = f.family || DEFAULTS.fonts.family;
      $('#fontScale').value   = f.scale ?? 1;
      $('#h1Scale').value     = f.h1Scale ?? 1;
      $('#h2Scale').value     = f.h2Scale ?? 1;
      $('#h2Mode').value = settings.h2?.mode ?? DEFAULTS.h2.mode;
      $('#h2Text').value = settings.h2?.text ?? DEFAULTS.h2.text;
      $('#h2ShowOverview').checked = (settings.h2?.showOnOverview ?? DEFAULTS.h2.showOnOverview);
$('#ovHeadScale').value = f.overviewHeadScale ?? 0.9;
      $('#ovCellScale').value = f.overviewCellScale ?? 0.8;
      $('#chipH').value       = f.chipHeight ?? 44;
 $('#ovTitleScale').value = f.overviewTitleScale ?? 1;

      $('#tileTextScale').value = f.tileTextScale ?? 0.8;
      $('#tileWeight').value    = f.tileWeight ?? 600;
      $('#tilePct').value = settings.slides?.tileWidthPercent ?? 45;
      $('#tileMin').value = settings.slides?.tileMinPx ?? 480;
      $('#tileMax').value = settings.slides?.tileMaxPx ?? 1100;

      $('#rightW').value   = settings.display?.rightWidthPercent ?? 38;
      $('#cutTop').value   = settings.display?.cutTopPercent ?? 28;
      $('#cutBottom').value= settings.display?.cutBottomPercent ?? 12;

      $('#resetSlides').onclick = ()=>{
        $('#fitMode').value='cover';
        $('#overviewSec').value=DEFAULTS.slides.overviewDurationSec;
        $('#saunaSec').value=DEFAULTS.slides.saunaDurationSec;
        $('#transMs').value=DEFAULTS.slides.transitionMs;
        $('#fontFamily').value=DEFAULTS.fonts.family;
        $('#fontScale').value=1; $('#h1Scale').value=1; $('#h2Scale').value=1;
        $('#ovTitleScale').value=1;
        $('#h2Mode').value='text';
        $('#h2Text').value='Aufgusszeiten';
        $('#h2ShowOverview').checked=true;
$('#ovHeadScale').value=DEFAULTS.fonts.overviewHeadScale;
        $('#ovCellScale').value=DEFAULTS.fonts.overviewCellScale;
        $('#chipH').value=44;
        $('#tileTextScale').value=0.8; $('#tileWeight').value=600;
        $('#tilePct').value=45; $('#tileMin').value=480; $('#tileMax').value=1100;
        $('#rightW').value=38; $('#cutTop').value=28; $('#cutBottom').value=12;
      };
    }

    // ------- Highlights & Flames -------
    function renderHighlightBox(){
      const hl=settings.highlightNext||DEFAULTS.highlightNext;
      $('#hlEnabled').checked = !!hl.enabled;
      $('#hlColor').value = hl.color || DEFAULTS.highlightNext.color;
      $('#hlBefore').value = Number.isFinite(+hl.minutesBeforeNext)?hl.minutesBeforeNext:DEFAULTS.highlightNext.minutesBeforeNext;
      $('#hlAfter').value  = Number.isFinite(+hl.minutesAfterStart)?hl.minutesAfterStart:DEFAULTS.highlightNext.minutesAfterStart;
      const setSw=()=> $('#hlSw').style.background = $('#hlColor').value; setSw();
      $('#hlColor').addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)) setSw(); });

      $('#flameImg').value    = settings.assets?.flameImage || DEFAULTS.assets.flameImage;
      updateFlamePreview($('#flameImg').value);
      $('#flameFile').onchange= ()=> uploadGeneric($('#flameFile'), (p)=>{ settings.assets=settings.assets||{}; settings.assets.flameImage=p; $('#flameImg').value=p; updateFlamePreview(p); });
      $('#resetFlame').onclick= ()=>{ const def=DEFAULTS.assets.flameImage; settings.assets=settings.assets||{}; settings.assets.flameImage=def; $('#flameImg').value=def; updateFlamePreview(def); };
    }
    function updateFlamePreview(u){ const img=$('#flamePrev'); preloadImg(u).then(r=>{ if(r.ok){ img.src=u; img.title=r.w+'×'+r.h; } else { img.removeAttribute('src'); img.title=''; } }); }

    // ------- Saunen panel -------
    function saunaRow(i){
      const name=schedule.saunas[i];
      const id='sx_'+i;
      const wrap=document.createElement('div');
      wrap.className='saunarow';
      wrap.innerHTML=
        `<input id="n_${id}" class="input" type="text" value="${name}" />
         <img id="p_${id}" class="prev" alt=""/>
         <label class="btn sm ghost" style="position:relative;overflow:hidden"><input id="f_${id}" type="file" accept="image/*" style="position:absolute;inset:0;opacity:0">Upload</label>
         <button class="btn sm" id="d_${id}">Default</button>
         <button class="btn sm" id="x_${id}">✕</button>
         <span id="s_${id}" class="mut"></span>`;
      const $name=$(`#n_${id}`,wrap), $img=$(`#p_${id}`,wrap), $file=$(`#f_${id}`,wrap), $def=$(`#d_${id}`,wrap), $del=$(`#x_${id}`,wrap), $st=$(`#s_${id}`,wrap);
      const url = (settings.assets?.rightImages?.[name]) || '';
      (async()=>{ if(url){ const r=await preloadImg(url); if(r.ok){ $img.src=url; $st.textContent=`${r.w}×${r.h}`; } } })();
      $file.onchange=()=> uploadGeneric($file, (p)=>{ settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; settings.assets.rightImages[name]=p; $img.src=p; $st.textContent='gespeichert'; });
      $def.onclick=()=>{ settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{}; settings.assets.rightImages[name]='/assets/img/right_default.svg'; $img.src='/assets/img/right_default.svg'; $st.textContent='Default'; };
      $del.onclick=()=>{ if(!confirm('Sauna wirklich entfernen?')) return; const removedName=schedule.saunas.splice(i,1)[0]; schedule.rows.forEach(r=> r.entries.splice(i,1)); if (settings.assets?.rightImages) delete settings.assets.rightImages[removedName]; renderGrid(); renderSaunasPanel(); };
      $name.onchange=()=>{ const newName=$name.value.trim()||name; if(newName===name) return; const old=name; schedule.saunas[i]=newName; if(settings.assets?.rightImages){ const val=settings.assets.rightImages[old]; delete settings.assets.rightImages[old]; settings.assets.rightImages[newName]=val; } renderGrid(); renderSaunasPanel(); };
      return wrap;
    }
    function renderSaunasPanel(){
      const host=$('#saunaList'); host.innerHTML='';
      settings.assets=settings.assets||{}; settings.assets.rightImages=settings.assets.rightImages||{};
      (schedule.saunas||[]).forEach((_,i)=> host.appendChild(saunaRow(i)) );
      $('#btnAddSauna').onclick=()=>{ const name = prompt('Neuer Saunananame:', 'Neue Sauna'); if(!name) return; schedule.saunas.push(name); schedule.rows.forEach(r=> r.entries.push(null)); renderGrid(); renderSaunasPanel(); };
      $('#btnCleanup').onclick=cleanupAssets;
    }

    function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

    function renderPresets(){
      settings.presets = settings.presets || {};
      const sel = document.getElementById('presetKey');
      const auto = document.getElementById('presetAuto');
      auto.checked = !!settings.presetAuto;

      document.getElementById('psSave').onclick = () => {
        const key = sel.value || 'Default';
        settings.presets[key] = deepClone(schedule);
        alert('Preset "'+key+'" gespeichert.');
      };
      document.getElementById('psLoad').onclick = () => {
        const key = sel.value || 'Default';
        const p = settings.presets[key];
        if (!p) { alert('Kein Preset für '+key); return; }
        schedule = deepClone(p);
        renderGrid();
        renderSaunasPanel();
      };
      auto.onchange = () => { settings.presetAuto = auto.checked; };
    }

// ------- Farben -------
    function colorField(key,label,init){ const row=document.createElement('div'); row.className='kv'; row.innerHTML=`<label>${label}</label><div class="color-item"><div class="swatch" id="sw_${key}"></div><input class="input" id="cl_${key}" type="text" value="${init}" placeholder="#RRGGBB"></div>`; return row; }
    function renderColors(){
      const host=$('#colorList'); host.innerHTML='';
      const theme=settings.theme||{};
      const A=document.createElement('div'); A.className='fieldset'; A.innerHTML='<div class="legend">Grundfarben</div>';
      A.appendChild(colorField('bg','Hintergrund', theme.bg||DEFAULTS.theme.bg));
      A.appendChild(colorField('fg','Vordergrund/Schrift', theme.fg||DEFAULTS.theme.fg));
      A.appendChild(colorField('accent','Akzent', theme.accent||DEFAULTS.theme.accent));

const B=document.createElement('div'); B.className='fieldset'; B.innerHTML='<div class="legend">Übersichtstabelle</div>';
B.appendChild(colorField('gridTable','Tabellenrahmen (nur Übersicht)', theme.gridTable||theme.gridBorder||DEFAULTS.theme.gridTable||DEFAULTS.theme.gridBorder));
// Breite (Spinner)
      const bw=document.createElement('div'); bw.className='kv'; bw.innerHTML='<label>Tabellenrahmen Breite (px)</label><input id="bw_gridTableW" class="input" type="number" min="0" max="10" step="1" value="'+(Number.isFinite(+theme.gridTableW)?theme.gridTableW:DEFAULTS.theme.gridTableW)+'">';
      B.appendChild(bw);
      B.appendChild(colorField('headRowBg','Kopfzeile Hintergrund', theme.headRowBg||DEFAULTS.theme.headRowBg));
      B.appendChild(colorField('headRowFg','Kopfzeile Schrift', theme.headRowFg||DEFAULTS.theme.headRowFg));
      B.appendChild(colorField('zebra1','Zebra (Inhalt) 1', theme.zebra1||DEFAULTS.theme.zebra1));
      B.appendChild(colorField('zebra2','Zebra (Inhalt) 2', theme.zebra2||DEFAULTS.theme.zebra2));
      B.appendChild(colorField('timeZebra1','Zeitspalte Zebra 1', theme.timeZebra1||DEFAULTS.theme.timeZebra1));
      B.appendChild(colorField('timeZebra2','Zeitspalte Zebra 2', theme.timeZebra2||DEFAULTS.theme.timeZebra2));
      B.appendChild(colorField('cornerBg','Ecke (oben‑links) BG', theme.cornerBg||DEFAULTS.theme.cornerBg));
      B.appendChild(colorField('cornerFg','Ecke (oben‑links) FG', theme.cornerFg||DEFAULTS.theme.cornerFg));

 const C=document.createElement('div'); C.className='fieldset'; C.innerHTML='<div class="legend">Sauna-Folien & Flammen</div>';
 C.appendChild(colorField('cellBg','Kachel-Hintergrund', theme.cellBg||DEFAULTS.theme.cellBg));
 C.appendChild(colorField('boxFg','Kachel-Schrift', theme.boxFg||DEFAULTS.theme.boxFg));
 C.appendChild(colorField('saunaColor','Sauna-Überschrift', theme.saunaColor||DEFAULTS.theme.saunaColor));
 C.appendChild(colorField('tileBorder','Kachel-Rahmen (nur Kacheln)', theme.tileBorder||theme.gridBorder||DEFAULTS.theme.tileBorder||DEFAULTS.theme.gridBorder));
 C.appendChild(colorField('flame','Flammen', theme.flame||DEFAULTS.theme.flame));

      host.appendChild(A); host.appendChild(B); host.appendChild(C);
      $$('#colorList input[type="text"]').forEach(inp=>{ const sw=$('#sw_'+inp.id.replace(/^cl_/,'')); const setPrev=v=>sw.style.background=v; setPrev(inp.value); inp.addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test(inp.value)) setPrev(inp.value); }); });
      $('#resetColors').onclick=()=>{ 
        $$('#colorList input[type="text"]').forEach(inp=>{ const k=inp.id.replace(/^cl_/,''); inp.value=(DEFAULTS.theme[k]||'#FFFFFF'); const sw=$('#sw_'+k); if(sw) sw.style.background=inp.value; }); 
        const bw=document.getElementById('bw_gridTableW'); if(bw) bw.value = DEFAULTS.theme.gridTableW ?? 2;
      };
    }
    
// ------- Fußnoten -------
    function renderFootnotes(){
      const host=$('#fnList'); host.innerHTML='';
      const list = settings.footnotes || [];
      list.forEach((fn,i)=> host.appendChild(fnRow(fn,i)));
      $('#fnAdd').onclick=()=>{ (settings.footnotes ||= []).push({id:genId(), label:'*', text:''}); renderFootnotes(); };
    }
    function fnRow(fn,i){
      const wrap=document.createElement('div'); wrap.className='kv';
      wrap.innerHTML = `<label>Label/Text</label><div class="row" style="gap:8px;flex-wrap:nowrap"><input class="input" id="fn_l_${i}" value="${fn.label||'*'}" style="width:6ch"/><input class="input" id="fn_t_${i}" value="${fn.text||''}"/><button class="btn sm" id="fn_x_${i}">✕</button></div>`;
      wrap.querySelector(`#fn_l_${i}`).onchange=(e)=>{ fn.label = (e.target.value||'*').slice(0,2); };
      wrap.querySelector(`#fn_t_${i}`).onchange=(e)=>{ fn.text = e.target.value||''; };
      wrap.querySelector(`#fn_x_${i}`).onclick=()=>{ settings.footnotes.splice(i,1); renderFootnotes(); };
      return wrap;
    }

    // ------- Upload helper & cleanup -------
    function uploadGeneric(fileInput, onDone){ if(!fileInput.files || !fileInput.files[0]) return; const fd=new FormData(); fd.append('file', fileInput.files[0]); const xhr=new XMLHttpRequest(); xhr.open('POST','/admin/api/upload.php'); xhr.onload=()=>{ try{ const j=JSON.parse(xhr.responseText||'{}'); if(j.ok){ onDone(j.path); } else { alert('Upload-Fehler: '+(j.error||'')); } }catch{ alert('Upload fehlgeschlagen'); } }; xhr.onerror=()=> alert('Netzwerkfehler beim Upload'); xhr.send(fd); }
    async function cleanupAssets(){ if(!confirm('Überflüssige Bilder in /assets/img/ löschen (Defaults & aktuell verwendete bleiben erhalten)?')) return; const r=await fetch('/admin/api/cleanup_assets.php'); const j=await r.json().catch(()=>({ok:false})); alert(j.ok? (`Bereinigt: ${j.removed} Dateien entfernt.`):('Fehler: '+(j.error||''))); }

    // ------- Save / Preview -------
    function collectColors(){ 
      const theme={...(settings.theme||{})}; 
      $$('#colorList input[type="text"]').forEach(inp=>{ const v=inp.value.toUpperCase(); if(/^#([0-9A-Fa-f]{6})$/.test(v)) theme[inp.id.replace(/^cl_/,'')]=v; }); 
      const bw=document.getElementById('bw_gridTableW'); if(bw) theme.gridTableW = Math.max(0, Math.min(10, +bw.value||0));
      return theme; 
    }
    function collectSettings(){
      return {
        schedule:{...schedule},
        settings:{
          ...settings,
          fonts:{
            family: $('#fontFamily').value,
            scale: +($('#fontScale')?.value||1),
            h1Scale:+($('#h1Scale').value||1),
            h2Scale:+($('#h2Scale').value||1),
            overviewTitleScale:+($('#ovTitleScale').value||1),
            overviewHeadScale:+($('#ovHeadScale').value||0.9),
            overviewCellScale:+($('#ovCellScale').value||0.8),
            chipHeight:+($('#chipH').value||44),
            tileTextScale:+($('#tileTextScale').value||0.8), tileWeight:+($('#tileWeight').value||600) },
            h2:{
              mode: $('#h2Mode').value || 'text',
              text: ($('#h2Text').value ?? '').trim(),
              showOnOverview: !!$('#h2ShowOverview').checked
            },
            slides:{ ...(settings.slides||{}), overviewDurationSec:+($('#overviewSec')?.value||10), saunaDurationSec:+($('#saunaSec')?.value||6), transitionMs:+($('#transMs')?.value||500) },
          theme: collectColors(),
          highlightNext:{
            enabled: $('#hlEnabled').checked,
            color: /^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)? $('#hlColor').value.toUpperCase() : (settings.highlightNext?.color || DEFAULTS.highlightNext.color),
            minutesBeforeNext: +( $('#hlBefore').value || DEFAULTS.highlightNext.minutesBeforeNext ),
            minutesAfterStart: +( $('#hlAfter').value || DEFAULTS.highlightNext.minutesAfterStart )
          },
          assets:{ ...(settings.assets||{}), flameImage: $('#flameImg').value || DEFAULTS.assets.flameImage },
          display:{ ...(settings.display||{}), fit: $('#fitMode').value, baseW:1920, baseH:1080, rightWidthPercent:+($('#rightW').value||38), cutTopPercent:+($('#cutTop').value||28), cutBottomPercent:+($('#cutBottom').value||12) },
          footnotes: settings.footnotes,
          presets: settings.presets || {},
          presetAuto: !!document.getElementById('presetAuto')?.checked
        }
      };
    }

    $('#btnOpen').onclick=()=> window.open('/', '_blank');
    $('#btnPreview').onclick=()=>{ $('#prevModal').style.display='grid'; sendPreview(); };
    $('#prevReload').onclick=()=> sendPreview(true);
    $('#prevClose').onclick=()=> $('#prevModal').style.display='none';
    function sendPreview(reload){ const f=$('#prevFrame'); if(reload){ f.contentWindow.location.reload(); setTimeout(()=>sendPreview(),400); return; } const payload=collectSettings(); setTimeout(()=>{ f.contentWindow.postMessage({type:'preview', payload}, '*'); }, 350); }

    $('#btnSave').onclick=async()=>{ const body=collectSettings(); body.schedule.version = (Date.now()/1000|0); body.settings.version = (Date.now()/1000|0); const r=await fetch('/admin/api/save.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const j=await r.json(); alert(j.ok? 'Gespeichert.' : ('Fehler: '+(j.error||'unbekannt'))); };

    function initBackupButtons(){
      const expBtn = document.getElementById('btnExport');
      const expWithImg = document.getElementById('expWithImg');
      const impFile = document.getElementById('importFile');
      const impWrite = document.getElementById('impWriteImg');

      if (expBtn) expBtn.onclick = async ()=>{
        const incImg = document.getElementById('expWithImg')?.checked ? 1 : 0;
        const incSet = document.getElementById('expWithSettings')?.checked ? 1 : 0;
        const incSch = document.getElementById('expWithSchedule')?.checked ? 1 : 0;
        const stamp = new Date().toISOString().slice(0,10);
        const url = `/admin/api/export.php?include=${incImg}&settings=${incSet}&schedule=${incSch}&name=${encodeURIComponent('signage_export_'+stamp)}`;
        window.location.assign(url);
      };

      if (impFile) impFile.onchange = async ()=>{
        if(!impFile.files || !impFile.files[0]) return;
        const fd = new FormData();
        fd.append('file', impFile.files[0]);
        fd.append('writeAssets', (impWrite?.checked ? '1' : '0'));
        fd.append('writeSettings', document.getElementById('impWriteSettings')?.checked ? '1' : '0');
        fd.append('writeSchedule', document.getElementById('impWriteSchedule')?.checked ? '1' : '0');
 const res = await fetch('/admin/api/import.php',{ method:'POST', body: fd });
        let j=null; try{ j=await res.json(); }catch{}
        alert(j?.ok ? 'Import erfolgreich.' : ('Fehler: '+(j?.error||'unbekannt')));
        if(j?.ok) location.reload();
      };
    }


    function initThemeToggle(){
      const cb = document.getElementById('themeMode');
      const label = document.getElementById('themeLabel');
      const apply = (mode) => {
        document.body.classList.toggle('theme-light', mode==='light');
        label.textContent = (mode==='light') ? 'Hell' : 'Dunkel';
        localStorage.setItem('adminTheme', mode);
      };
      const saved = localStorage.getItem('adminTheme') || 'dark';
      cb.checked = (saved==='light');
      apply(saved);
      cb.onchange = () => apply(cb.checked ? 'light' : 'dark');
    }

    initThemeToggle();
initBackupButtons();   
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
'h2'=>['mode'=>'text','text'=>'Aufgusszeiten','showOnOverview'=>true],
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
# Export
# ---------------------------
cat >/var/www/signage/admin/api/export.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');

function get_flag(string $name, int $default=1): int {
  if (!isset($_GET[$name])) return $default;
  $v = strtolower((string)$_GET[$name]);
  return in_array($v, ['1','true','yes','on'], true) ? 1 : 0;
}

$settingsFile = '/var/www/signage/data/settings.json';
$scheduleFile = '/var/www/signage/data/schedule.json';
if (!is_file($settingsFile) || !is_file($scheduleFile)) {
  http_response_code(404);
  echo json_encode(['ok'=>false,'error'=>'missing-data']); exit;
}

$settings = json_decode(file_get_contents($settingsFile), true);
$schedule = json_decode(file_get_contents($scheduleFile), true);
$include     = get_flag('include', 0);  // Bilder
$incSettings = get_flag('settings', 1);
$incSchedule = get_flag('schedule', 1);

$out = [
  'kind'       => 'signage-export',
  'version'    => 1,
  'exportedAt' => gmdate('c'),
  'includeImages' => $include ? true : false,
];
if ($incSettings) $out['settings'] = $settings;
if ($incSchedule) $out['schedule'] = $schedule;

if ($include && $incSettings) {
  $paths = [];
  if (!empty($settings['assets']['flameImage'])) $paths[] = $settings['assets']['flameImage'];
  if (!empty($settings['assets']['rightImages']) && is_array($settings['assets']['rightImages'])) {
    foreach ($settings['assets']['rightImages'] as $p) if ($p) $paths[] = $p;
  }
  $paths = array_values(array_unique(array_filter($paths, fn($p)=>is_string($p) && str_starts_with($p,'/assets/img/'))));
  $blobs = [];
  $base = '/var/www/signage';
  $fi = new finfo(FILEINFO_MIME_TYPE);
  foreach ($paths as $rel) {
    $abs = $base . $rel;
    if (!is_file($abs)) continue;
    $mime = $fi->file($abs) ?: 'application/octet-stream';
    $b64  = base64_encode(file_get_contents($abs));
    $blobs[$rel] = ['mime'=>$mime, 'b64'=>$b64, 'name'=>basename($abs), 'rel'=>$rel];
  }
  $out['blobs'] = $blobs;
}

$name = isset($_GET['name']) ? preg_replace('/[^A-Za-z0-9_.-]/','_', $_GET['name']) : ('signage_export_'.date('Ymd'));
header('Content-Disposition: attachment; filename="'.$name.($include?'_with-images':'').'.json"');
echo json_encode($out, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
PHP

# ---------------------------
# Import
# ---------------------------
cat >var/www/signage/admin/api/import.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');

function fail($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); exit; }

$raw = '';
if (!empty($_FILES['file']['tmp_name'])) {
  $raw = file_get_contents($_FILES['file']['tmp_name']);
} else {
  $raw = file_get_contents('php://input');
}
if ($raw==='') fail('no-data');

$j = json_decode($raw, true);
if (!$j || ($j['kind']??'')!=='signage-export') fail('bad-format');

$writeAssets   = !empty($_POST['writeAssets']) || !empty($_GET['writeAssets']);
$writeSettings = isset($_POST['writeSettings']) ? ($_POST['writeSettings']==='1') : true;
$writeSchedule = isset($_POST['writeSchedule']) ? ($_POST['writeSchedule']==='1') : true;
$settings = $j['settings'] ?? null; $schedule = $j['schedule'] ?? null;
if (!$settings || !$schedule) fail('missing-sections');

$base = '/var/www/signage';
$assetsDir = $base.'/assets/img';
@mkdir($assetsDir, 02775, true);

$pathMap = []; // original rel path => new rel path
if ($writeAssets && !empty($j['blobs']) && is_array($j['blobs'])) {
  $i = 0;
  foreach ($j['blobs'] as $rel => $info) {
    $mime = $info['mime'] ?? 'application/octet-stream';
    $b64  = $info['b64'] ?? '';
    if (!$b64) continue;
    $ext = match($mime){
      'image/png' => 'png',
      'image/jpeg'=> 'jpg',
      'image/webp'=> 'webp',
      'image/svg+xml'=>'svg',
      default => 'bin'
    };
    $name = pathinfo($info['name'] ?? basename($rel), PATHINFO_FILENAME);
    $outRel = '/assets/img/import_'.date('Ymd_His').'_'.($i++).'.'.$ext;
    $outAbs = $base.$outRel;
    file_put_contents($outAbs, base64_decode($b64));
    @chmod($outAbs, 0644);
    $pathMap[$rel] = $outRel;
  }

  // remap settings asset paths to the newly written files (if present)
  if (!empty($settings['assets']['flameImage']) && isset($pathMap[$settings['assets']['flameImage']])) {
    $settings['assets']['flameImage'] = $pathMap[$settings['assets']['flameImage']];
  }
  if (!empty($settings['assets']['rightImages']) && is_array($settings['assets']['rightImages'])) {
    foreach ($settings['assets']['rightImages'] as $k=>$p) {
      if (isset($pathMap[$p])) $settings['assets']['rightImages'][$k] = $pathMap[$p];
    }
  }
}

// bump versions (nur wenn vorhanden & aktiviert)
if ($writeSettings && is_array($settings)) $settings['version'] = time();
if ($writeSchedule && is_array($schedule)) $schedule['version'] = time();

$ok1 = true; $ok2 = true;
if ($writeSettings && is_array($settings)) {
  $ok1 = (bool)file_put_contents($base.'/data/settings.json', json_encode($settings, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
}
if ($writeSchedule && is_array($schedule)) {
  $ok2 = (bool)file_put_contents($base.'/data/schedule.json', json_encode($schedule, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
}
if (!$ok1 || !$ok2) fail('write-failed', 500);

echo json_encode(['ok'=>true, 'assetsWritten'=>count($pathMap), 'remapped'=>$pathMap]);
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










