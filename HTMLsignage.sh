#!/usr/bin/env bash
# file: /root/signage_web_install.sh
# Zweck   : Web-native Digital Signage (HTML/JS) mit Editor & Settings – 16:9 fix, Zebra, Hex-Farben
#           Enthält alle bisherigen Patches + (a) rechte Spalte Breite (%) + (b) Kachelbreite Min/Max
# Stack   : Nginx + PHP-FPM (ohne OnlyOffice)
# Ziel-OS : Ubuntu 24.04 (root erforderlich)

set -Eeuo pipefail
umask 0002   # Gruppen-Schreibrecht in setgid-Verzeichnissen
IFS=$'\n\t'
C_G="\033[1;32m"; C_B="\033[1;34m"; C_R="\033[1;31m"; C_0="\033[0m"
ok(){   echo -e "${C_G}[OK  ]${C_0} $*"; }
info(){ echo -e "${C_B}[INFO]${C_0} $*"; }
err(){  echo -e "${C_R}[ERR ]${C_0} $*"; }
trap 'rc=$?; line=${BASH_LINENO[0]:-0}; [[ $rc -ne 0 ]] && err "Abbruch in Zeile $line (RC=$rc)"; exit $rc' ERR
shopt -s dotglob nullglob


WEBROOT="/var/www/signage"

# --- Helpers---
ensure_dir_www() { install -d -m 2775 -o www-data -g www-data "$1"; }
ensure_dir_root(){ install -d -m 755 "$1"; }  # für Systempfade (/etc/nginx/...)
write_file() {                # write_file /abs/pfad/datei <<'EOF' ... EOF
  local f="$1"; shift
  ensure_dir_root "$(dirname "$f")"
  cat >"$f"
  chown root:root "$f"
  chmod 0644 "$f"
}


# Basis-Verzeichnisse anlegen (Owner/Gruppenrechte korrekt)
ensure_dir_www  "$WEBROOT"
ensure_dir_www  "$WEBROOT/data"
ensure_dir_www  "$WEBROOT/assets"
ensure_dir_www  "$WEBROOT/assets/img"
ensure_dir_www  "$WEBROOT/admin"
ensure_dir_www  "$WEBROOT/admin/api"
ensure_dir_www  "$WEBROOT/admin/css"
ensure_dir_www  "$WEBROOT/admin/js"
ensure_dir_www  "$WEBROOT/admin/js/core"
ensure_dir_www  "$WEBROOT/admin/js/ui"

# Nginx-Verzeichnisstruktur (root)
ensure_dir_root /etc/nginx/sites-available
ensure_dir_root /etc/nginx/sites-enabled


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
# Misc
# ---------------------------
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
--chipFlamePct:.55;   /* Anteil der Chip-Höhe für Flammen */
--chipFlameGap:6px;   /* Abstand zwischen Flammen */
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

/* interstitial image */
.container.imgslide{padding:0}
.imgFill{position:absolute; inset:0; background-size:cover; background-position:center; background-repeat:no-repeat}

/* layout */
.container{position:relative; height:100%; padding:calc(32px*var(--vwScale)); display:flex; flex-direction:column; align-items:flex-start}
.container.has-right{padding-right:calc(var(--rightW) + 32px)}
.container.overview{padding-right:32px}
.h1{font-weight:800;letter-spacing:.02em;font-size:calc(56px*var(--scale)*var(--h1Scale));margin:0 0 10px}
.h2{font-weight:700;letter-spacing:.01em;opacity:.95;font-size:calc(36px*var(--scale)*var(--h2Scale));margin:0 0 14px}
.overview .h1{font-size:calc(56px*var(--scale)*var(--h1Scale)*var(--ovAuto))}
.overview .h2{font-size:calc(36px*var(--scale)*var(--h2Scale)*var(--ovAuto))}
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
.grid th,.grid td{border:var(--gridTableW) solid var(--gridTable);white-space:nowrap}
.grid col.c_time{width:10ch}
.grid col.c_auto{width:auto}
.grid thead th{font-size:calc(22px*var(--scale)*var(--ovHeadScale)*var(--ovAuto));padding:calc(8px*var(--vwScale)) calc(12px*var(--vwScale));text-align:center;background:var(--headBg);color:var(--headFg)}
.overview .grid thead th{padding:calc(8px*var(--ovAuto)) calc(12px*var(--ovAuto))}
.grid thead th.corner{background:var(--cornerBg);color:var(--cornerFg)}

/* zebra: rows for content cells, separate zebra for time column */
.grid tbody tr:nth-child(odd) td:not(.timecol){background:var(--zebra1)}
.grid tbody tr:nth-child(even) td:not(.timecol){background:var(--zebra2)}
.grid tbody tr:nth-child(odd) td.timecol{background:var(--timeZebra1)!important}
.grid tbody tr:nth-child(even) td.timecol{background:var(--timeZebra2)!important}

.grid td{font-size:calc(22px*var(--scale)*var(--ovCellScale)*var(--ovAuto));padding:calc(8px*var(--vwScale)) calc(12px*var(--vwScale))}
.overview .grid td{padding:calc(8px*var(--ovAuto)) calc(12px*var(--ovAuto))}
.grid th.timecol, .grid td.timecol{width:10ch}
.grid td.timecol{background:var(--timecol)!important;text-align:center;font-weight:800;min-width:10ch;color:var(--fg)}

/* equal chips */
.cellwrap{display:block;width:100%;min-width:0}

.chip{
  display:flex; align-items:center; width:100%;
  height:var(--chipH);
  padding:0 .8em;
  border-radius:10px;
  background:var(--cell); color:var(--boxfg);
  border:var(--chipBorderW) solid var(--chipBorder);
  font-weight:700; letter-spacing:.2px;
  overflow:hidden;
}
.overview .chip{height:calc(var(--chipH)*var(--ovAuto))}

/* Text links, kann ellipsisieren oder (per JS) skaliert werden */
.chip-text{
  flex:1 1 auto; min-width:0;
  white-space:nowrap;
}
.chip-text.ellipsis{
  overflow:hidden; text-overflow:ellipsis;
}

/* Flammen rechts, kompakt und nie über dem Text */
.chip-flames{
  flex:0 0 auto; display:inline-flex; margin-left:.6em;
}
.chip-flames .flames{ display:inline-flex; gap:var(--chipFlameGap); }
.chip-flames .flame{
  height:calc(var(--chipH) * var(--chipFlamePct));
  width:auto;
}

/* overview wrapper */
.ovwrap{transform-origin:top left; width:100%; will-change:contents}

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
.footer-note{margin-top:12px;font-size:calc(16px*var(--scale)*var(--ovAuto));opacity:.9}
/* Fußnoten-Layout: oneline bevorzugt, wrap nur zwischen Items */
.footer-note .fnitem{display:flex;align-items:baseline;gap:.35em;min-width:0}
.footer-note .fnitem sup.note{font-weight:400;opacity:.8}

/* Einzeilig: keine Zeilenumbrüche, ggf. abgeschnitten */
.footer-note.fn-one{display:flex;flex-wrap:nowrap;align-items:baseline;gap:calc(10px*var(--ovAuto));overflow:hidden;white-space:nowrap}
.footer-note.fn-one .fnitem{white-space:inherit}

/* Mehrzeilig: Container darf umbrechen; Items dürfen intern umbrechen */
.footer-note.fn-multi{display:flex;flex-wrap:wrap;align-items:baseline;gap:calc(10px*var(--ovAuto));white-space:normal}
.footer-note.fn-multi .fnitem{flex:1 1 260px;min-width:200px;max-width:100%;white-space:normal;overflow-wrap:anywhere}

/* Gestapelt: jede Fußnote in eigener Zeile */
.footer-note.fn-stack{
  display:flex;
  flex-direction:column;
  gap:calc(6px*var(--ovAuto));
}
.footer-note.fn-stack .fnitem{
  display:block;
  white-space:normal;
}
.footer-note.fn-stack .fnsep{ display:none }

/* Trenner-Punkt zwischen Items (nur optisch) */
.footer-note .fnsep{ margin:0 calc(8px*var(--ovAuto)); opacity:.7 }
.brand{position:absolute;right:20px;bottom:16px;opacity:.6;font-size:14px;color:var(--fg)}
CSS

cat >/var/www/signage/assets/slideshow.js <<'JS'
(() => {
  const FITBOX = document.getElementById('fitbox');
  const CANVAS = document.getElementById('canvas');
  const STAGE  = document.getElementById('stage');
const Q = new URLSearchParams(location.search);
const IS_PREVIEW = Q.get('preview') === '1'; // NEU: Admin-Dock
const rawDevice = (Q.get('device') || localStorage.getItem('deviceId') || '').trim();
const DEVICE_ID = /^dev_[a-f0-9]{12}$/i.test(rawDevice) ? rawDevice : null;
if (!DEVICE_ID) localStorage.removeItem('deviceId'); // Karteileichen loswerden
let previewMode = IS_PREVIEW; // NEU: in Preview sofort aktiv (kein Pairing)

  let schedule = null;
  let settings = null;
  let nextQueue = [];
  let lastKey = null; // verhindert direkte Wiederholung derselben Folie
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

// -----------DeviceLoader -------
async function loadDeviceResolved(id){
  const r = await fetch(`/pair/resolve?device=${encodeURIComponent(id)}&t=${Date.now()}`, {cache:'no-store'});
  if (!r.ok) throw new Error('device_resolve http '+r.status);
  const j = await r.json();
  if (!j || j.ok === false || !j.settings || !j.schedule) {
    throw new Error('device_resolve payload invalid');
  }
  schedule = j.schedule;
  settings = j.settings;
  applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
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
    maybeApplyPreset();
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
// Chip-Optionen (Übersicht): Größen & Overflow-Modus aus den Settings
const f = settings?.fonts || {};
setVars({
  '--chipFlamePct': Math.max(0.3, Math.min(1, (f.flamePct || 55) / 100)),
  '--chipFlameGap': (f.flameGapPx ?? 6) + 'px'
});
// 'scale' = Text automatisch verkleinern, 'ellipsis' = auf „…“ kürzen
document.body.dataset.chipOverflow = f.chipOverflowMode || 'scale';

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
  // Tages-Preset ggf. anwenden
  maybeApplyPreset();

  const showOverview = (settings?.slides?.showOverview !== false);
  const hidden = new Set(settings?.slides?.hiddenSaunas || []);
  const allSaunas = (schedule?.saunas || []);

  // Referenz-Reihenfolge für Saunen (Order aus Settings, dann Rest)
  const cfgOrder = Array.isArray(settings?.slides?.order) ? settings.slides.order.slice() : null;
  let saunaOrderRef = [];
  if (cfgOrder && cfgOrder.length) {
    const seen = new Set();
    for (const e of cfgOrder) if (allSaunas.includes(e) && !seen.has(e)) { saunaOrderRef.push(e); seen.add(e); }
    for (const s of allSaunas) if (!seen.has(s)) saunaOrderRef.push(s);
  } else {
    saunaOrderRef = allSaunas.slice();
  }

  // Sichtbare Saunen in der gleichen (reflektierten) Reihenfolge
  const visibleSaunas = saunaOrderRef.filter(n => !hidden.has(n));

  // Basis-Queue (ohne Bilder)
  const queue = [];
  if (showOverview) queue.push({ type: 'overview' });
  for (const s of visibleSaunas) queue.push({ type: 'sauna', sauna: s });

  // Bilder vorbereiten (nur aktive mit URL)
  const imgsAll = Array.isArray(settings?.interstitials) ? settings.interstitials : [];
  const imgs = imgsAll.filter(it => it && it.enabled && it.url);

  // Hilfen
  const idxOverview = () => queue.findIndex(x => x.type === 'overview');

  // Mehrpass-Einfügen, damit "nach Bild" funktioniert
  let remaining = imgs.slice();
  let guard = 0;
  while (remaining.length && guard++ < imgs.length * 3) {
    const postponed = [];
    for (const it of remaining) {
      const ref = (it.afterRef || it.after || 'overview');
      let insPos = -1;

      if (ref === 'overview') {
        const io = idxOverview();
        insPos = (io >= 0) ? io + 1 : 0;
      } else if (String(ref).startsWith('img:')) {
        // nach Bild: nur einfügen, wenn das Bild bereits platziert ist
        const prevId = String(ref).slice(4);
        const prevIndex = queue.findIndex(x => x.type === 'image' && x.__id === prevId);
        if (prevIndex === -1) { postponed.push(it); continue; }
        insPos = prevIndex + 1;
      } else {
        // nach Sauna (Name)
        const saunaName = decodeURIComponent(String(ref));
        const direct = queue.findIndex(x => x.type === 'sauna' && x.sauna === saunaName);
        if (direct !== -1) {
          // Zielsauna ist sichtbar → direkt dahinter
          insPos = direct + 1;
        } else {
          // Zielsauna ist NICHT sichtbar → vor der nächsten sichtbaren Sauna in der Referenz-Reihenfolge
          let nextVisible = null;
          if (saunaOrderRef.length && visibleSaunas.length) {
            const start = saunaOrderRef.indexOf(saunaName);
            // falls die Referenzsauna gar nicht existiert, einfach ab 0 suchen
            let k = (start >= 0 ? start : -1) + 1;
            for (let step = 0; step < saunaOrderRef.length; step++, k++) {
              const cand = saunaOrderRef[k % saunaOrderRef.length];
              if (!hidden.has(cand)) { nextVisible = cand; break; }
            }
          }
          if (nextVisible) {
            const posQ = queue.findIndex(x => x.type === 'sauna' && x.sauna === nextVisible);
            insPos = (posQ >= 0) ? posQ : -1; // vor nächster Sauna einfügen
          }

          // Fallback: nach Overview oder ganz vorn
          if (insPos === -1) {
            const io = idxOverview();
            insPos = (io >= 0) ? io + 1 : 0;
          }
        }
      }

      // Bild-Node einfügen
      const dwell = Number.isFinite(+it.dwellSec)
        ? +it.dwellSec
        : (settings?.slides?.imageDurationSec ?? settings?.slides?.saunaDurationSec ?? 6);

      const node = { type:'image', url: it.url, dwell, __id: it.id || null };
      queue.splice(insPos, 0, node);
    }
    remaining = postponed;
  }

  // Falls nichts bleibt, notfalls Übersicht zeigen
  if (!queue.length && showOverview) queue.push({ type: 'overview' });

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

// --- Chip-Text fitting (Übersicht) ---
function fitChipText(el, mode){
  const chip = el.closest('.chip'); if (!chip) return;

  // Reset
  el.style.fontSize = '';
  el.classList.toggle('ellipsis', mode === 'ellipsis');
  if (mode === 'ellipsis') return; // CSS erledigt Kürzung

  const base = parseFloat(getComputedStyle(el).fontSize) || 16;
  el.style.fontSize = base + 'px';

  const cs = getComputedStyle(chip);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const flamesBox = chip.querySelector('.chip-flames');
  const flamesW = flamesBox ? flamesBox.getBoundingClientRect().width : 0;
  const free = chip.clientWidth - padX - flamesW - 1;

  if (el.scrollWidth <= free) return;

  let size = base;
  const min = Math.max(10, base * 0.6);
  while (size > min && el.scrollWidth > free){
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
  if (el.scrollWidth > free){
    el.classList.add('ellipsis'); // letzte Sicherung
  }
}
//ERRORS
window.onerror = function (msg, src, line, col) {
  const d = document.createElement('div');
  d.style = 'position:fixed;left:8px;bottom:8px;z-index:99999;background:rgba(0,0,0,.5);color:#fff;padding:8px 10px;border-radius:8px;font:12px/1.2 monospace';
  d.textContent = '[JS] ' + msg + ' @ ' + (src||'') + ':' + line + ':' + col;
  document.body.appendChild(d);
};


function fitChipsIn(container){
  const mode = document.body.dataset.chipOverflow || 'scale';
  container.querySelectorAll('.chip .chip-text').forEach(n => fitChipText(n, mode));
}

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
// Textbereich
const txt = h('div', { class: 'chip-text' }, title);
if (hasStarInText) txt.appendChild(h('span', { class: 'notewrap' }, [h('sup', {class:'note legacy'}, '*')]));
const supNote = noteSup(cell, notes);
if (supNote) { txt.appendChild(h('span', { class: 'notewrap' }, [supNote])); usedSet.add(cell.noteId); }

// Flammen kompakt rechts
const flamesBox = h('div', { class: 'chip-flames' }, [flamesWrap(cell.flames || '')]);

// Chip-Container (Flex: Text links, Flammen rechts)
const chip = h('div', { class: 'chip' + (hlMap.byCell[key] ? ' highlight' : '') }, [txt, flamesBox]);
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
const layout = (settings?.footnoteLayout ?? 'one-line');
const fnClass = 'footer-note ' + (layout==='multi' ? 'fn-multi' : layout==='stacked' ? 'fn-stack' : 'fn-one');
if (footNodes.length){
  const nodes = [];
  footNodes.forEach((n,i)=>{ if (i>0 && layout!=='stacked') nodes.push(h('span',{class:'fnsep','aria-hidden':'true'}, '•')); nodes.push(n); });
  return h('div', {}, [ t, h('div', { class: fnClass }, nodes) ]);
}
return h('div', {}, [ t ]);
  }

  function autoScaleOverview(container) {
    const wrap = container.querySelector('.ovwrap'); if (!wrap) return;

    // Reset (keine Breiten-Skalierung)
    wrap.style.transform = 'none';
    container.style.setProperty('--ovAuto', '1');

    const measure = () => {
      const headH = Array.from(container.querySelectorAll('.h1,.h2'))
        .reduce((a, el) => a + el.getBoundingClientRect().height, 0);
      const footEl = container.querySelector('.footer-note');
      const wrapRect = wrap.getBoundingClientRect();
      const footH = footEl ? footEl.getBoundingClientRect().height : 0;
      return { headH, footH, wrapH: wrapRect.height, totalH: headH + wrapRect.height + footH + 8 };
    };

    const availH = container.clientHeight;

    // Nur typografisch skalieren (breite bleibt 100%)
    let iter = 0, lastTotal = Infinity;
    let m = measure();
while (m.totalH > availH && iter < 12) {
  const target = availH / m.totalH;
  const s = Math.max(0.25, Math.min(1, target * (iter ? 0.98 : 1)));
      container.style.setProperty('--ovAuto', String(s));
      lastTotal = m.totalH;
      m = measure();
      if (Math.abs(m.totalH - lastTotal) < 0.5) break;
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
const recalc = () => { 
  autoScaleOverview(c);
  fitChipsIn(c); // nach dem Autoscale die Chip-Texte einpassen
};
setTimeout(recalc, 0);
if (document.fonts?.ready) { document.fonts.ready.then(recalc).catch(()=>{}); }
onResizeCurrent = recalc;
    return c;
  }

// ---------- Interstitial image slide ----------
function renderImage(url) {
  const c = h('div', { class: 'container imgslide fade show' }, [
    h('div', { class: 'imgFill', style: 'background-image:url("'+url+'")' })
  ]);
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
const layout = (settings?.footnoteLayout ?? 'one-line');
const fnClass = 'footer-note ' + (layout==='multi' ? 'fn-multi' : layout==='stacked' ? 'fn-stack' : 'fn-one');
if (footNodes.length){
  const nodes = [];
  footNodes.forEach((n,i)=>{ if (i>0 && layout!=='stacked') nodes.push(h('span',{class:'fnsep','aria-hidden':'true'}, '•')); nodes.push(n); });
  c.appendChild(h('div', { class: fnClass }, nodes));
}

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

function dwellMsForItem(item) {
  const slides = settings?.slides || {};
  const mode = slides.durationMode || 'uniform';
  const sec = (x) => Math.max(1, Math.floor(+x || 0));

  if (item.type === 'overview') {
    return sec(slides.overviewDurationSec ?? 10) * 1000;
  }

  if (item.type === 'sauna') {
    if (mode !== 'per') {
      const g = slides.globalDwellSec ?? slides.saunaDurationSec ?? 6;
      return sec(g) * 1000;
    } else {
      const perMap = slides.saunaDurations || {};
      const v = perMap[item.sauna];
      const fb = slides.globalDwellSec ?? slides.saunaDurationSec ?? 6;
      return sec(Number.isFinite(+v) ? v : fb) * 1000;
    }
  }

  if (item.type === 'image') {
    if (mode !== 'per') {
      const g = slides.globalDwellSec ?? slides.imageDurationSec ?? slides.saunaDurationSec ?? 6;
      return sec(g) * 1000;
    } else {
      const v = Number.isFinite(+item.dwell) ? +item.dwell : (slides.imageDurationSec ?? slides.globalDwellSec ?? 6);
      return sec(v) * 1000;
    }
  }

  return 6000; // Fallback
}

  // ---------- Loop ----------
function step() {
  if (!nextQueue.length) return;
  clearTimers();

let item = nextQueue[idx % nextQueue.length];
let key  = item.type + '|' + (item.sauna || item.url || '');
if (key === lastKey && nextQueue.length > 1) {
  // eine Folie würde direkt wiederholt → eine weiter
  idx++;
  item = nextQueue[idx % nextQueue.length];
  key  = item.type + '|' + (item.sauna || item.url || '');
}
  const el =
    (item.type === 'overview') ? renderOverview() :
    (item.type === 'sauna')    ? renderSauna(item.sauna) :
                                 renderImage(item.url);

  show(el);
lastKey = key;
  const dwell = dwellMsForItem(item);
  slideTimer = setTimeout(() => hide(() => { idx++; step(); }), dwell);
}

//Showpairing
function showPairing(){
  STAGE.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'container fade show';
  box.style.cssText = 'display:flex;align-items:center;justify-content:center;';
  box.innerHTML = `
    <div style="background:rgba(0,0,0,.55);color:#fff;padding:28px 32px;border-radius:16px;max-width:90vw;text-align:center">
      <div style="font-weight:800;font-size:28px;margin-bottom:10px">Gerät koppeln</div>
      <div id="code" style="font-size:42px;font-weight:900;letter-spacing:4px;background:rgba(255,255,255,.1);padding:8px 14px;border-radius:12px;display:inline-block;min-width:12ch">…</div>
      <div style="margin-top:10px;opacity:.9">Öffne im Admin „Geräte“ und gib den Code ein.</div>
    </div>`;
  STAGE.appendChild(box);

  (async ()=>{
    try {
      // Bestehenden Code (Session) wiederverwenden – verhindert neuen Code bei Refresh
      let st = null; try { st = JSON.parse(sessionStorage.getItem('pairState')||'null'); } catch {}
      let code = (st && st.code && (Date.now() - (st.createdAt||0) < 15*60*1000)) ? st.code : null;

      if (!code) {
        const r = await fetch('/pair/begin', { method:'POST', headers:{'X-Pair-Request':'1'} });
        if (!r.ok){
          const err = new Error('begin http '+r.status);
          err.status = r.status;
          throw err;
        }
        const j0 = await r.json();
        if (!j0 || !j0.code) throw new Error('begin payload');
        code = j0.code;
        sessionStorage.setItem('pairState', JSON.stringify({ code, createdAt: Date.now() }));
      }

      const el = document.getElementById('code');
      if (el) el.textContent = code;

      const timer = setInterval(async ()=>{
        try {
          const rr = await fetch('/pair/poll?code='+encodeURIComponent(code), {cache:'no-store'});
          if (!rr.ok) return;
          const jj = await rr.json();
          if (jj && jj.paired && jj.deviceId){
            clearInterval(timer);
            try{ sessionStorage.removeItem('pairState'); }catch{}
            localStorage.setItem('deviceId', jj.deviceId);
            location.replace('/?device='+encodeURIComponent(jj.deviceId));
          }
        } catch {}
      }, 3000);
    } catch (e) {
      const el = document.getElementById('code');
      if (el) el.textContent = (e && e.status) ? String(e.status) : 'NETZ-FEHLER';
      console.error('[pair] begin failed', e);
    }
  })();
}


  // ---------- Bootstrap & live update ----------
async function bootstrap(){
// Preview-Bridge: Admin sendet {type:'preview', payload:{schedule,settings}}
 window.addEventListener('message', (ev) => {
 const d = ev?.data || {};
 if (d?.type !== 'preview') return;
 previewMode = true;
 try { if (window.__pairTimer) clearInterval(window.__pairTimer); } catch {}
 const p = d.payload || {};
 if (p.schedule) schedule = p.schedule;
 if (p.settings) settings = p.settings;
 applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
 idx = 0; lastKey = null;
 step();
 });
  const deviceMode = !!DEVICE_ID;

  if (!previewMode) {
    if (deviceMode) {
try {
 await loadDeviceResolved(DEVICE_ID);
 // Heartbeat: sofort + alle 30s (setzt "Zuletzt gesehen" direkt)
 fetch('/pair/touch?device='+encodeURIComponent(DEVICE_ID)).catch(()=>{});
 setInterval(()=>{ fetch('/pair/touch?device='+encodeURIComponent(DEVICE_ID)).catch(()=>{}); }, 30000);     
 } catch (e) {
console.error('[bootstrap] resolve failed:', e);
 showPairing();
 return; // HIER abbrechen, sonst bleibt die Stage leer
      }
} else {
  if (IS_PREVIEW) {
    STAGE.innerHTML = '<div style="padding:16px;color:#fff;opacity:.75">Vorschau lädt…</div>';
    return; // kein Pairing im Admin-Dock
  }
  showPairing();
  return;
}
  }

  // Erst hier starten wir die Slideshow
  step();

  // Live-Reload: bei Device NUR resolve pollen
  if (!previewMode) {
    let lastSchedVer = schedule?.version || 0;
    let lastSetVer   = settings?.version || 0;

    setInterval(async () => {
      try {
        if (deviceMode) {
          const r = await fetch(`/pair/resolve?device=${encodeURIComponent(DEVICE_ID)}&t=${Date.now()}`, {cache:'no-store'});
          if (!r.ok) throw new Error('resolve http '+r.status);
          const j = await r.json();
          if (!j || j.ok === false) throw new Error('resolve payload');

          const newSchedVer = j.schedule?.version || 0;
          const newSetVer   = j.settings?.version || 0;

          if (newSchedVer !== lastSchedVer || newSetVer !== lastSetVer) {
            schedule = j.schedule; settings = j.settings;
            lastSchedVer = newSchedVer; lastSetVer = newSetVer;
            applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
            clearTimers(); idx = idx % Math.max(1, nextQueue.length); step();
          }
        } else {
          const s  = await loadJSON('/data/schedule.json');
          const cf = await loadJSON('/data/settings.json');
          if (s.version !== lastSchedVer || cf.version !== lastSetVer) {
            schedule=s; settings=cf; lastSchedVer=s.version; lastSetVer=cf.version;
            applyTheme(); applyDisplay(); maybeApplyPreset(); buildQueue();
            clearTimers(); idx = idx % Math.max(1, nextQueue.length); step();
          }
        }
} catch(e) {
 console.warn('[poll] failed:', e);
 // robuster: nicht sofort zurück zum Pairing – erst nach 3 Fehlversuchen
 window.__pollErrs = (window.__pollErrs||0)+1;
 if (deviceMode && window.__pollErrs>=3) showPairing();      }
    }, 3000);
  }
}

  bootstrap();
})();
JS

chown -R www-data:www-data /var/www/signage/assets

# ---------------------------
# Admin-UI (Editor) – Farben (Hex/Preview), Kachel-Min/Max, rechte Spalte %, Schrägschnitt, Flammen-Bild
# ---------------------------

cat > /var/www/signage/admin/css/admin.css <<'CSS'
/* ===================== Admin UI – Compact, Aligned, Themed ===================== */
/* Light ist Default (body class="theme-light"), Dark via .theme-dark auf <body>  */
/* ============================================================================== */

/* ---------- Design Tokens: LIGHT (Default) ---------- */
:root{
  /* Flächen & Text */
  --bg:#f6f8ff; --panel:#ffffff; --fg:#0b1220; --muted:#5b6478;
  --border:#d6deee; --inbr:#c9d4ea;

  /* Buttons – Flieder (default) + Orange (primary) */
  --btn-accent:#7C3AED; --btn-accent-hover:#6D28D9; --btn-accent-fg:#ffffff;
  --btn-primary:#F59E0B; --btn-primary-2:#FBBF24; --btn-primary-fg:#0b0d12;

  /* Ghost-Buttons */
  --ghost-bg:transparent; --ghost-border:#c9d4ea; --ghost-fg:#0b1220;

  /* Inputs */
  --input-bg:#ffffff; --input-fg:#0b1220; --input-border:#c9d4ea; --input-focus:#6D28D9;

  /* Grid/Übersicht (Fallbacks – können per Settings überschrieben werden) */
  --gridTable:#d1d5db; --gridTableW:2px;
  --headRowBg:#f3f4f6; --headRowFg:#111827;
  --zebra1:#ffffff; --zebra2:#f9fafb;
  --timeZebra1:#f3f4f6; --timeZebra2:#eef2f7;
  --cornerBg:#eef2f7; --cornerFg:#6b7280;

  /* Grid: Zellen vs. Eingabe farblich trennen */
  --grid-cell-bg:#f2f5fb;  /* Tabellenzelle */
  --grid-entry-bg:#ffffff; /* Button in Zelle (.cellbtn) */

  /* „Kein Aufguss“-Pillen (Light) */
  --pill-bg:#edf1f7;

  /* Größen */
  --fs:14px;
  --input-min-h:30px;          /* kompakt wie früher */
  --input-pad:4px 8px;
  --btn-pad:9px 12px;
  --btn-sm-pad:6px 10px;
  --radius:12px; --radius-sm:10px;

  /* Innerer Rand rechts für Inputs, damit sie nicht am Boxrand kleben */
  --edge-gap:6px;

  /* Slides: Spaltenbreiten (gemeinsam für Header & Zeilen) */
  --col-name:minmax(140px,0.9fr);
  --col-prev:64px; --col-dur:70px; --col-btn:28px; --col-del:28px; --col-vis:22px; --col-after:minmax(150px,1fr);

  /* Preview-Größe */
  --prev-w:60px; --prev-h:42px;

  /* Dichte */
  --gap:6px;
}

/* ---------- Design Tokens: DARK (aktiv via .theme-dark) ---------- */
.theme-dark{
  --bg:#0b1220; --panel:#111827; --fg:#e5e7eb; --muted:#9ca3af;
  --border:#1f2937; --inbr:#263041;

  --btn-accent:#C4B5FD; --btn-accent-hover:#A78BFA; --btn-accent-fg:#111827;
  --btn-primary:#F59E0B; --btn-primary-2:#FBBF24; --btn-primary-fg:#0b0d12;

  --ghost-bg:rgba(255,255,255,.04); --ghost-border:#263041; --ghost-fg:var(--fg);

  --input-bg:#0f1629; --input-fg:var(--fg); --input-border:#1f2937; --input-focus:#8B5CF6;

  --gridTable:#374151; --headRowBg:#111827; --headRowFg:#e5e7eb;
  --zebra1:#0f1629; --zebra2:#0d1426; --timeZebra1:#0e162b; --timeZebra2:#0c1324;
  --cornerBg:#0d1426; --cornerFg:#9ca3af;

  --grid-cell-bg:#0f1629; --grid-entry-bg:#121a34;
  --pill-bg:#182134;
}

/* ---------- Base ---------- */
html,body{height:100%}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--fg);
  font:var(--fs)/1.45 system-ui, Segoe UI, Roboto, Arial, sans-serif;
}
a{ color: color-mix(in oklab, var(--btn-accent) 70%, #1e3a8a); text-decoration:none; }

.row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.mut,.help{ color:var(--muted); }

/* ---------- Header ---------- */
header{
  position:sticky; top:0; z-index:60;
  display:flex; justify-content:space-between; align-items:center; gap:12px;
  padding:14px 16px; border-bottom:1px solid var(--border);
  background: color-mix(in oklab, var(--panel) 85%, transparent);
  backdrop-filter: blur(8px);
}
h1{ margin:0; font-size:16px; letter-spacing:.3px; }

/* ---------- Layout: Main + Rightbar ---------- */
main.layout{
  width:100%;
  display:grid;
  grid-template-columns:minmax(0,1fr) clamp(360px, 32vw, 540px);
  gap:14px; padding:16px 12px 18px 16px; align-items:start;
}
.leftcol{ display:flex; flex-direction:column; gap:16px; min-width:0; }
.rightbar{
  position:sticky; top:64px;
  max-height:calc(100svh - 64px);
  overflow:auto; padding-right:6px;
  justify-self:end;
  width: clamp(360px, 32vw, 540px);
}

/* ---------- Cards / Details ---------- */
.card, details.ac{
  background:var(--panel); border:1px solid var(--border);
  border-radius:16px; box-shadow:0 8px 20px rgba(0,0,0,.06);
}
.card .content, .content{ padding:12px 14px; }
summary{
  list-style:none; cursor:pointer; display:flex; align-items:center;
  justify-content:space-between; gap:12px; padding:12px 14px;
  border-bottom:1px solid transparent;
}
details[open] > summary{ border-bottom-color:var(--border); }
summary .ttl{ display:flex; align-items:center; gap:10px; font-weight:700; }
summary .actions{ display:flex; gap:8px; }
summary .chev{ transition: transform .2s ease; }
details[open] .chev{ transform: rotate(90deg); }

/* ---------- Inputs ---------- */
.input, select, textarea{
  background:var(--input-bg); color:var(--input-fg);
  border:1px solid var(--input-border); border-radius:10px;
  padding:var(--input-pad); min-height:var(--input-min-h);
  width:100%;
}
.input::placeholder, textarea::placeholder{
  color: color-mix(in oklab, var(--input-fg) 55%, transparent);
}
.input:focus, select:focus, textarea:focus{
  outline:0; border-color:var(--input-focus);
  box-shadow:0 0 0 3px color-mix(in oklab, var(--input-focus) 25%, transparent);
}

/* kleiner Innenabstand rechts in der Sidebar, damit Inputs nicht am Rand kleben */
.rightbar .input,
.rightbar select,
.rightbar textarea{
  width: calc(100% - var(--edge-gap));
  margin-right: var(--edge-gap);
  min-height:30px; padding:4px 8px; border-radius:10px; font-size:14px; line-height:1.2;
}

/* spezielle kompakte Inputs */
.input.num3{ width:6ch !important; text-align:center; padding-left:0; padding-right:0; }
.input.name{ width:auto; min-width:140px; }

/* ---------- Buttons ---------- */
.btn{
  display:inline-flex; align-items:center; justify-content:center;
  font-weight:700; padding:var(--btn-pad); border-radius:12px;
  border:1px solid transparent; cursor:pointer; user-select:none;
  transition: transform .06s ease, filter .15s, background .15s, border-color .15s, color .15s;
}
.btn.sm{ padding:var(--btn-sm-pad); border-radius:10px; }
.btn.icon{ width:28px; height:28px; padding:0; display:grid; place-items:center; }

/* Default (flieder) */
.btn:not(.ghost):not(.primary){ background:var(--btn-accent); color:var(--btn-accent-fg); }
.btn:not(.ghost):not(.primary):hover{ background:var(--btn-accent-hover); }
.btn:not(.ghost):not(.primary):active{ transform:translateY(1px); }

/* Primary (orange) */
.btn.primary{
  background: linear-gradient(180deg, var(--btn-primary), var(--btn-primary-2));
  color: var(--btn-primary-fg); border-color: var(--btn-primary);
}

/* Ghost (grau) */
.btn.ghost{
  background:var(--ghost-bg); color:var(--ghost-fg); border:1px solid var(--ghost-border);
}
.btn.ghost:hover{ background: color-mix(in oklab, var(--ghost-fg) 6%, transparent); }

/* Toggle */
.toggle{
  display:flex; align-items:center; gap:8px;
  border:1px solid var(--ghost-border); padding:7px 10px; border-radius:12px; background:var(--panel);
}
.toggle input{
  appearance:none; width:28px; height:16px; border-radius:999px; background:#94a3b8; position:relative; outline:0;
}
.theme-dark .toggle input{ background:#4b5563; }
.toggle input:checked{ background:#22c55e; }
.toggle input::after{
  content:''; position:absolute; top:2px; left:2px; width:12px; height:12px;
  border-radius:50%; background:#fff; transition:left .15s;
}
.toggle input:checked::after{ left:14px; }

/* ---------- Grid-Tabelle (links) ---------- */
table.tbl{ width:100%; border-collapse:separate; border-spacing:0; }
.tbl th,.tbl td{ border:1px solid var(--inbr); padding:7px; }
.tbl th{
  background:var(--headRowBg); color:var(--headRowFg);
  position:sticky; top:64px; z-index:1;
}
.tbl td{ background:var(--grid-cell-bg); color:var(--fg); }
.tbl .time{ min-width:8ch; text-align:center; font-weight:700; }

/* Button in der Zelle = „Eingabe“ */
.cellbtn{
  width:100%; text-align:left;
  background:var(--grid-entry-bg);
  border:1px dashed color-mix(in oklab, var(--input-border) 75%, transparent);
  color:var(--fg); padding:8px; border-radius:12px;
}
.cellbtn.filled{
  border-style:solid;
  background: color-mix(in oklab, var(--grid-entry-bg) 85%, transparent);
  border-color: color-mix(in oklab, var(--input-border) 85%, transparent);
}

/* ---------- Key/Value-Linien ---------- */
.kv{
  display:grid; grid-template-columns:220px minmax(0,1fr);
  gap:10px; align-items:center;
}
.content .kv{ margin-bottom:8px; }

/* „Dauer (einheitlich)“: Inputs exakt untereinander (2-zeiliges Grid in Spalte 2) */
#rowDwellAll > .row{
  display:grid;
  grid-template-columns:auto max-content;
  grid-auto-rows:auto;
  column-gap:8px; row-gap:6px;
  align-items:center;
  width: calc(100% - var(--edge-gap));   /* kleiner Innenabstand rechts */
  margin-right: var(--edge-gap);
}
/* Reihenfolge passt: span,input,span,input  → 2x2 Raster automatisch */
#rowDwellAll .mut{ white-space:nowrap; }
#rowDwellAll .input.num3{ justify-self:start; }

/* ---------- Slides-Listen (rechte Sidebar) ---------- */
.groupHead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
.groupHead .legend, #extraTitle{ font-weight:800; }

/* Spaltenköpfe + Zeilen – exakt gleiche Grid-Spalten */
.sl-head, .saunarow, .imgrow{
  width:100%; display:grid; gap:var(--gap); align-items:center; grid-auto-rows:minmax(42px,auto);
}
.sl-head{ margin: 2px 0 6px; }
.sl-head span{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

.sl-head.sl-saunas, .saunarow{
  grid-template-columns: var(--col-name) var(--col-prev) var(--col-dur) var(--col-btn) var(--col-btn) var(--col-del) var(--col-vis);
}
.sl-head.sl-images, .imgrow{
  grid-template-columns: var(--col-name) var(--col-prev) var(--col-dur) var(--col-btn) var(--col-del) var(--col-after) var(--col-vis);
}

/* Uniform-Modus: Dauer-Spalte komplett entfernen (Header + Rows) */
body.mode-uniform #headSaunaDur, body.mode-uniform #headImgDur{ display:none; }
body.mode-uniform .sl-head.sl-saunas, body.mode-uniform .saunarow{
  grid-template-columns: var(--col-name) var(--col-prev) var(--col-btn) var(--col-btn) var(--col-del) var(--col-vis);
}
body.mode-uniform .sl-head.sl-images, body.mode-uniform .imgrow{
  grid-template-columns: var(--col-name) var(--col-prev) var(--col-btn) var(--col-del) var(--col-after) var(--col-vis);
}
body.mode-uniform .intSec{ display:none !important; }
body.mode-uniform #ovSec{ display:none !important; }

/* Übersicht-Row: Canvas/IMG wie Previews dimensionieren */
#overviewRow .prev, #overviewRow canvas#ovPrev{ width:var(--prev-w); height:var(--prev-h); }

/* Preview-Kacheln */
.prev{
  width:var(--prev-w); height:var(--prev-h);
  display:grid; place-items:center; font-size:12px; opacity:.9;
  background:var(--panel); border:1px solid var(--inbr); border-radius:10px; object-fit:cover;
}

/* Checkbox-Spalte bündig */
.saunarow input[type="checkbox"], .imgrow input[type="checkbox"]{ justify-self:center; }

/* Upload/Default Buttons kompakt */
.btn.icon{ width:28px; height:28px; }

/* Kein Überlaufen der Grids in der Sidebar */
.saunarow > *, .imgrow > *{ min-width:0; }

/* --- Wunschanpassungen: Breiten innerhalb der Spalten ----------------------- */
/* Sauna-Namen 20% schmaler (lässt innen Luft im Spaltenbereich) */
.saunarow .input.name{ width:80%; }

/* Bild-Slides: Name 30% schmaler */
.imgrow .input.name{ width:50%; }

/* Bild-Slides: „Nach Slide“-Select 20% schmaler */
.imgrow .sel-after{ width:70%; justify-self:start; min-width:120px; max-width:100%; }

/* „Kein Aufguss“-Pillen – kleiner, mehr Abstand */
.pills{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.pill{
  font-size:10.5px; line-height:1; padding:2px 6px;
  border:1px solid var(--inbr); border-radius:999px; background:var(--pill-bg);
  opacity:.96;
}
.saunarow .namewrap{ display:flex; flex-direction:column; gap:6px; }
.saunarow .tag{ display:inline-block; margin-left:6px; padding:2px 6px; border:1px solid var(--inbr); border-radius:8px; font-size:11px; opacity:.8; }

/* DnD Feedback */
.sauna-bucket{ border:1px dashed var(--inbr); border-radius:12px; padding:8px; margin-top:6px; }
.sauna-bucket.drag-over{ outline:2px solid var(--btn-accent); }
.saunarow[draggable="true"]{ cursor:grab; }
.saunarow[draggable="true"]:active{ cursor:grabbing; }

/* Wochentags-Pills */
.day-pills .day-btn{
  border:1px solid var(--ghost-border); border-radius:999px; padding:6px 10px;
  background:transparent; cursor:pointer; color:var(--ghost-fg);
}
.day-btn.active{
  background:var(--btn-accent); color:var(--btn-accent-fg); border-color:var(--btn-accent); font-weight:700;
}

/* ---------- Farben-Editor ---------- */
.color-cols{ display:grid; grid-template-columns:1fr; gap:12px; }
.fieldset{ border:1px dashed var(--inbr); border-radius:12px; padding:10px 12px; }
.fieldset > .legend{ opacity:.85; font-weight:700; margin-bottom:8px; }
.color-item{ display:flex; align-items:center; gap:8px; }
.swatch{ width:24px; height:24px; border-radius:6px; border:1px solid var(--inbr); }

/* ---------- Footer ---------- */
footer{ display:flex; justify-content:flex-end; padding:12px 16px; border-top:1px solid var(--border); color:var(--muted); }

/* ---------- Modal ---------- */
.modal{ position:fixed; inset:0; background:rgba(0,0,0,.5); display:none; place-items:center; z-index:100; }
.box{ background:var(--panel); color:var(--fg); border:1px solid var(--inbr); border-radius:16px;
  min-width:min(340px,95vw); max-width:95vw; max-height:90svh; overflow:auto; padding:16px; }
.grid2{ display:grid; grid-template-columns:130px minmax(0,1fr); gap:10px; align-items:center; width:min(560px,calc(95vw - 36px)); margin:0 auto 12px; }
.iframeWrap{ width:min(92vw,1600px); height:min(85svh,900px); border:1px solid var(--inbr); border-radius:14px; overflow:hidden; background:#000; }
.iframeWrap iframe{ width:100%; height:100%; display:block; border:0; }

/* Card in der linken Spalte immer voll breit strecken */
.leftcol > .card,
.leftcol > .card .content {
  width: 100%;
}

/* Docked Preview: volle Breite + 16:9, inkl. Fallback ohne aspect-ratio */
.dockWrap{
  display:block;
  width:100%;
  max-width:100%;
  background:#000;
  border:1px solid var(--inbr);
  border-radius:14px;
  overflow:hidden;
  position:relative;
  aspect-ratio: 16 / 9; /* moderne Browser */
}

/* Fallback für ältere Mobile Browser (kein aspect-ratio) */
@supports not (aspect-ratio: 1 / 1) {
  .dockWrap { height:auto; }
  .dockWrap::before{
    content:"";
    display:block;
    padding-top:56.25%; /* 16:9 */
  }
  .dockWrap > iframe{
    position:absolute;
    inset:0;
  }
}

.dockWrap > iframe{
  position:absolute;  /* bei aspect-ratio: greift auch */
  inset:0;
  width:100%;
  height:100%;
  border:0;
  display:block;
}

/* Falls die Dock-Box mal in einer .row (flex) sitzt: trotzdem volle Zeile belegen */
.row > .dockWrap{
  flex: 1 1 100%;
}

/* Farb-Tools (über der Farbliste) */
.fieldset .legend{opacity:.8;font-weight:700;margin-bottom:8px}
#colorTools{margin-bottom:12px}
.pickerFrame{width:100%;height:180px;border:1px dashed var(--inbr);border-radius:12px;background:#0000}
#quickColor{width:52px;min-width:52px;padding:3px;border-radius:10px}
#quickHex{text-transform:uppercase;width:10ch}
#copyHex{white-space:nowrap}

/* Farb-Tools */
.fieldset .legend{opacity:.8;font-weight:700;margin-bottom:8px}
#colorTools{margin-bottom:12px}
#colorTools .legendRow{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#togglePickerSize{min-width:0;padding:4px 8px}
.pickerResizable{
  height:180px;
  width:100%;
  min-height:140px;
  max-height:70vh;
  min-width:260px;
  max-width:calc(100vw - 48px);
  resize:both;               
  overflow:auto;
  border:1px dashed var(--inbr);
  border-radius:12px;
  background:#0000;
  transition:height .2s ease;
}
#colorTools.exp .pickerResizable{ height:420px; width:100%; }
.pickerFrame{width:100%;height:100%;border:0}
#quickColor{width:52px;min-width:52px;padding:3px;border-radius:10px}
#quickHex{text-transform:uppercase;width:10ch}
#copyHex{white-space:nowrap}
#colorTools.float{
  position:fixed; right:16px; bottom:16px; z-index:999;
  width:min(90vw, 1200px);
  background:var(--card); border:1px solid var(--inbr); border-radius:12px;
  box-shadow:var(--shadow); padding:12px;
}
#colorTools.float .pickerResizable{
  width:100%; height:min(60vh, 700px); max-height:80vh; resize:both;
}

/* Ansicht-Menü (Header) */
.menuwrap{ position:relative; }
.dropdown{
  position:absolute; top:calc(100% + 6px); left:0; z-index:80;
  min-width: 220px; padding:6px;
  background:var(--panel); border:1px solid var(--border); border-radius:12px;
  box-shadow:0 12px 24px rgba(0,0,0,.12);
}
.dd-item{
  display:flex; align-items:center; gap:8px;
  width:100%; padding:8px 10px; border:0; background:transparent; cursor:pointer;
  border-radius:10px; text-align:left; font-weight:700; color:var(--fg);
}
.dd-item:hover{ background: color-mix(in oklab, var(--ghost-fg) 6%, transparent); }
.dd-item[aria-checked="true"]{ outline:2px solid color-mix(in oklab, var(--btn-accent) 60%, transparent); outline-offset:2px; }
CSS

cat > /var/www/signage/admin/css/admin.mobile.css <<'CSS'
/* file: /var/www/signage/admin/admin.mobile.css */

/* Portrait oder sehr schmale Displays: Boxen unter der Tabelle (einspaltig) */
@media (orientation: portrait), (max-width: 900px) {
  main.layout {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }
  .rightbar {
    position: static !important; /* Sticky aus */
    max-height: unset !important;
    padding-right: 0 !important;
  }
  header { position: sticky; top: 0; }
  /* Überschriften etwas kleiner */
  .sl-head { font-size: 11px; }
  /* Spalten können bei sehr schmaler Breite umbrechen */
  .sl-head span { white-space: normal; }
}

/* Landscape (z.B. Tablets quer): 2/3 Tabelle, 1/3 Einstellungsboxen */
@media (orientation: landscape) {
  /* festes 2/3 : 1/3 Verhältnis – Desktop-Clamp bleibt außerhalb aktiv */
  main.layout {
    grid-template-columns: 2fr 1fr !important;
    gap: 14px !important;
  }
  .rightbar {
    position: sticky;
    top: 64px;
    max-height: calc(100svh - 64px);
    width: auto; /* Verhältnis bestimmt die Breite */
  }
}

/* Optionale Mikro-Optimierungen für Touch */
@media (hover: none) and (pointer: coarse) {
  .btn { padding: 10px 14px; }
  .btn.sm { padding: 8px 12px; }
  .input, select, textarea { min-height: 42px; }
}
CSS


cat >/var/www/signage/admin/index.html <<'HTML'
 <!doctype html> <html lang="de"> <head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Aufguss – Admin</title>
<link rel="stylesheet" href="/admin/css/admin.mobile.css">
<link rel="stylesheet" href="/admin/css/admin.css">

</head>
<body class="theme-light">
  <header>
    <h1>Aufguss – Admin</h1>
    <div class="row">
      <label class="toggle" title="Hell/Dunkel">
        <input type="checkbox" id="themeMode">
        <span id="themeLabel">Dunkel</span>
      </label>
<!-- Ansicht-Menü -->
<div class="menuwrap" id="viewMenuWrap">
  <button class="btn" id="viewMenuBtn" aria-haspopup="menu" aria-expanded="false">
    Ansicht: <span id="viewMenuLabel">Grid</span> ▾
  </button>
  <div class="dropdown" id="viewMenu" role="menu" hidden>
    <button class="dd-item" role="menuitemradio" data-view="grid" aria-checked="true">▦ Grid</button>
    <button class="dd-item" role="menuitemradio" data-view="preview" aria-checked="false">▶ Vorschau</button>
    <button class="dd-item" role="menuitemradio" data-view="devices" aria-checked="false">🖥 Geräte</button>
  </div>
</div>

      <button class="btn" id="btnOpen">Slideshow öffnen</button>
      <button class="btn primary" id="btnSave">Speichern</button>
    </div>
  </header>

  <main class="layout">
    <section class="leftcol">
<div class="card" id="gridPane">
        <div class="content" style="padding-bottom:0">
<div class="row" id="planHead" style="justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;flex-wrap:wrap">
  <div style="font-weight:700">Aufgussplan <span class="mut">(<span id="activeDayLabel">—</span>)</span></div>
  <div id="gridActionsLeft"></div>
<div class="row" style="gap:8px;flex-wrap:wrap">
    <div id="weekdayPills" class="row" style="gap:6px"></div>
    <button class="btn sm" id="btnSavePreset" title="Wochentag speichern">💾 Wochentag speichern</button>
    <span class="mut">Ausgewählte Zeit:</span> <span id="selTime" style="font-weight:700">—</span>
  </div>
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
<!-- Slides – Masterbox -->
<details class="ac" open id="slidesMaster">
  <summary>
    <div class="ttl">▶<span class="chev">⮞</span> Slides – Reihenfolge, Sichtbarkeit & Zeiten</div>
    <div class="actions">
      <button class="btn sm ghost" id="resetTiming">Standardwerte</button>
    </div>
  </summary>
  <div class="content">

<!-- Dauer-Modus (global, gilt für Saunen + Bilder) -->
<div class="kv" id="rowDurMode">
  <label>Dauer-Modus</label>
  <div class="row">
    <label class="btn sm ghost" style="gap:6px"><input type="radio" name="durMode" id="durUniform" value="uniform"> Einheitlich</label>
    <label class="btn sm ghost" style="gap:6px"><input type="radio" name="durMode" id="durPer" value="per"> Individuell pro Slide</label>
  </div>
</div>

<div class="kv" id="rowDwellAll">
  <label>Dauer (einheitlich)</label>
  <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
    <span class="mut" style="min-width:14ch;">alle außer Übersicht</span>
    <input id="dwellAll" class="input num3" type="number" min="1" max="120" step="1" />

    <span class="mut" style="min-width:10ch;">Übersicht</span>
    <input id="ovSecGlobal" class="input num3" type="number" min="1" max="120" step="1" />
  </div>
</div>

<!-- Transition -->
<div class="kv"><label>Transition (ms)</label>
  <input id="transMs2" class="input" type="number" min="0" value="500">
</div>

<div class="kv"><label>Auto je Wochentag</label><input id="presetAuto" type="checkbox"></div>
<div class="help">Wenn aktiv, wird beim Öffnen und beim Wechsel des Tabs automatisch das Preset des aktuellen Wochentags geladen (falls vorhanden).</div>

    <!-- Unterbox 1: Saunen & Übersicht -->
    <details class="ac sub" open id="boxSaunas">
      <summary><div class="ttl">▶<span class="chev">⮞</span> Saunen & Übersicht</div>
 <div class="actions"><button class="btn sm" id="btnAddSauna">Sauna hinzufügen</button></div>
</summary>      
<div class="content">

        <!-- Übersicht im Saunen-Stil -->
        <div class="fieldset" style="margin-bottom:10px">
          <div class="legend">Übersicht (Aufgussplan)</div>
          <div id="overviewRow"></div>
        </div>

        <!-- Saunenliste -->
		<!-- Kopf für den Bereich "Aufguss" + 2. Wochentags-Pillen -->
<div class="groupHead">
  <div class="legend">Aufguss</div>
  <div id="weekdayPills2" class="day-pills row" style="gap:6px"></div>
</div>
 	<!-- Aufguss -->
<div class="sl-head sl-saunas">
  <span class="col-name">Name</span>
  <span class="col-prev">Preview</span>
  <span class="col-dur" id="headSaunaDur">Dauer (s)*</span>
  <span class="col-up">Upload</span>
  <span class="col-def">Default</span>
  <span class="col-del">✕</span>
  <span class="col-vis">Anzeigen</span>
</div>
        
	<!-- kein Aufguss -->
	<div id="saunaList"></div>
	<div class="subh" id="extraTitle" style="display:none">Heute kein Aufguss</div>
	<div id="extraSaunaList"></div>

        <div class="help" style="margin-top:6px">* Dauer nur sichtbar, wenn „Individuell“ gewählt ist.</div>
      </div>
    </details>

    <!-- Unterbox 2: Bild-Slides -->
    <details class="ac sub" id="boxImages">
<summary>
    <div class="ttl">▶<span class="chev">⮞</span> Bild-Slides</div>
    <div class="actions"><button class="btn sm" id="btnInterAdd2">Bild hinzufügen</button></div>
  </summary>
<small class="help">* Dauer nur sichtbar, wenn „Individuell pro Slide“ gewählt ist.</small>
  <div class="content">
<div class="sl-head sl-images">
    <span class="col-name">Name</span>
    <span class="col-prev">Preview</span>
    <span class="col-dur" id="headImgDur">Dauer (s)</span>
    <span class="col-up">Upload</span>
    <span class="col-del">✕</span>
    <span class="col-after">Nach Slide</span>
    <span class="col-vis">Anzeigen</span>
  </div>
    <div id="interList2"></div>
  </div>
</details>

<!-- Unterbox 3: Fußnoten -->
<details class="ac sub" id="boxFootnotes">
  <summary>
    <div class="ttl">▶<span class="chev">⮞</span> Fußnoten</div>
    <div class="actions"><button class="btn sm" id="fnAdd">Hinzufügen</button></div>
  </summary>
  <div class="content">
    <div id="fnList"></div>
    <div class="subh">Darstellung</div>
    <div class="kv">
      <label>Fußnoten-Layout</label>
      <select id="footnoteLayout" class="input">
        <option value="one-line" selected>Möglichst einzeilig</option>
        <option value="multi">Mehrzeilig</option>
        <option value="stacked">Untereinander (jede Zeile)</option>
      </select>
    </div>
  </div>
</details>

  </div>
</details>

 <details class="ac" id="boxSlidesText">
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
<div class="kv"><label>Textüberlänge</label>
  <select id="chipOverflowMode" class="input">
    <option value="scale" selected>Automatisch skalieren</option>
    <option value="ellipsis">Mit „…“ kürzen</option>
  </select>
</div>
<div class="kv"><label>Flammen-Größe (% der Chip-Höhe)</label>
  <input id="flamePct" class="input" type="number" min="30" max="100" value="55">
</div>
<div class="kv"><label>Flammen-Abstand (px)</label>
  <input id="flameGap" class="input" type="number" min="0" max="24" value="6">
</div>

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

      <details class="ac">
        <summary>
          <div class="ttl">▶<span class="chev">⮞</span> Farben (Übersicht & Zeitspalte)</div>
          <div class="actions"><button class="btn sm ghost" id="resetColors">Standardwerte</button></div>
        </summary>
        <div class="content color-cols" id="colorList"></div>
    </div>
</details>     
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
         <button class="btn sm ghost" id="btnCleanupSys">Assets aufräumen</button>
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

<!-- Geräte-Vorschau (ohne Pairing) – ACHTUNG: SIBLING, NICHT im prevModal! -->
<div id="devPrevModal" class="modal">
  <div class="box">
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:700" data-devprev-title>Geräte-Ansicht</div>
      <div class="row">
        <button class="btn sm" id="devPrevReload">Neu laden</button>
        <button class="btn sm" id="devPrevClose">Schließen</button>
      </div>
    </div>
    <div class="iframeWrap">
      <iframe id="devPrevFrame" src="about:blank" loading="lazy" referrerpolicy="no-referrer"></iframe>
    </div>
    <small class="mut" style="display:block;margin-top:8px">
      Live-Ansicht des ausgewählten Geräts (nur Lesen; kein Pairing, keine Speicherung).
    </small>
  </div>
</div>

<script type="module" src="/admin/js/app.js"></script>
</body>
</html>
HTML

# ---------------------------
# Admin JS
# ---------------------------


# ---- Admin JS: core ----
cat > /var/www/signage/admin/js/core/defaults.js <<'JS'
// /admin/js/core/defaults.js
// DEFAULTS + Wochentags-Helfer als Single Source of Truth

export const DEFAULTS = {
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
  fonts:{
    family:"system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
    scale:1, h1Scale:1, h2Scale:1,
    overviewTitleScale:1, overviewHeadScale:0.9, overviewCellScale:0.8,
    tileTextScale:0.8, tileWeight:600, chipHeight:44,
    chipOverflowMode:'scale', flamePct:55, flameGapPx:6
  },
  h2:{ mode:'text', text:'Aufgusszeiten', showOnOverview:true },
  assets:{ flameImage:'/assets/img/flame_test.svg' },
  footnotes:[ { id:'star', label:'*', text:'Nur am Fr und Sa' } ]
};

// Wochentage + Labels (+ „Opt“ als manueller Tag)
export const DAYS = [
  ['Mon','Mo'],['Tue','Di'],['Wed','Mi'],['Thu','Do'],['Fri','Fr'],['Sat','Sa'],['Sun','So'],
  ['Opt','Opt']
];
export const DAY_LABELS = Object.fromEntries(DAYS);

export function dayKeyToday(){
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
}
JS

cat > /var/www/signage/admin/js/core/utils.js <<'JS'
// /admin/js/core/utils.js
// Zentrale Helfer: DOM, Zeit, IDs, String-Escape, Preload, Clone

export const $  = (sel, root=document) => root.querySelector(sel);
export const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// Bilder vorladen → {ok,w,h}
export const preloadImg = (url) => new Promise((resolve) => {
  if (!url) return resolve({ ok:false });
  const img = new Image();
  img.onload  = () => resolve({ ok:true, w:img.naturalWidth, h:img.naturalHeight });
  img.onerror = () => resolve({ ok:false });
  img.src = url;
});

// "HH:MM" → validierter String oder null
export const parseTime = (s) => {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((s||'').trim());
  return m ? (m[1] + ':' + m[2]) : null;
};

// kurze IDs für Fußnoten etc.
export const genId = () => 'fn_' + Math.random().toString(36).slice(2, 9);

// HTML escapen für Option-Labels etc.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'
  }[m]));
}

// simple Deep-Clone (JSON-basiert, reicht für unsere Datenstrukturen)
export const deepClone = (obj) => JSON.parse(JSON.stringify(obj));
JS

cat > /var/www/signage/admin/js/core/upload.js <<'JS'
// /admin/js/core/upload.js
// Minimaler, wiederverwendbarer Uploader (wie dein bisheriger uploadGeneric)

export function uploadGeneric(fileInput, onDone){
  if(!fileInput.files || !fileInput.files[0]) return;
  const fd = new FormData();
  fd.append('file', fileInput.files[0]);

  const xhr = new XMLHttpRequest();
  xhr.open('POST','/admin/api/upload.php');
  xhr.onload = () => {
    try{
      const j = JSON.parse(xhr.responseText||'{}');
      if (j.ok) onDone(j.path);
      else alert('Upload-Fehler: '+(j.error||''));
    }catch{
      alert('Upload fehlgeschlagen');
    }
  };
  xhr.onerror = () => alert('Netzwerkfehler beim Upload');
  xhr.send(fd);
}
JS

# ---- Admin JS: ui ----
cat > /var/www/signage/admin/js/ui/grid.js <<'JS'
// /admin/js/ui/grid.js
// Rendert die Übersichtstabelle (#grid), bedient den Zellen-Dialog und die Row-Buttons.
// Abhängigkeiten: utils ($,$$,parseTime) + Zugriff auf schedule/settings via init(ctx).

import { $, $$, parseTime } from '../core/utils.js';

let ctx = null;           // { getSchedule, getSettings }
let curRow = 0, curCol = 0;
let inited = false;

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

      populateNoteSelect();
      const has = !!cell.noteId;
      $('#m_hasNote').checked = has;
      $('#m_noteRow').style.display = has ? 'flex' : 'none';
      if (has) $('#m_note').value = cell.noteId;

      $('#modal').style.display = 'grid';
      $('#m_title').focus();
    };
  });
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

    if (!newTime && title) { alert('Bitte Zeit HH:MM'); return; }

    const newCell = title ? { title, flames } : null;
    if (newCell && hasNote) newCell.noteId = noteId;

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
    const cols = sc.saunas.length;
    sc.rows.splice(curRow, 0, { time:'00:00', entries: Array.from({length:cols}).map(()=>null) });
    renderGrid();
  };
  $('#btnAddBelow').onclick = () => {
    const sc = ctx.getSchedule();
    const cols = sc.saunas.length;
    sc.rows.splice(curRow+1, 0, { time:'00:00', entries: Array.from({length:cols}).map(()=>null) });
    renderGrid();
  };
  $('#btnDeleteRow').onclick = () => {
    const sc = ctx.getSchedule();
    if (sc.rows.length > 1){
      sc.rows.splice(curRow, 1);
      curRow = Math.max(0, curRow - 1);
      renderGrid();
      updateSelTime();
    }
  };
}

// --- Public API ---
export function initGridUI(context){
  // context: { getSchedule:()=>schedule, getSettings:()=>settings }
  ctx = context;
  initOnce();
  updateSelTime();
  renderGrid();
}

export function getSelection(){ return { row:curRow, col:curCol }; }
export function setSelection(row, col){ curRow=row|0; curCol=col|0; updateSelTime(); }
JS

cat > /var/www/signage/admin/js/ui/grid_day_loader.js <<'JS'
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
      alert(`Kein Preset für "${(DAY_LABELS && DAY_LABELS[key]) || key}" vorhanden.\nMit „Wochentag speichern“ kannst du eins anlegen.`);
      return;
    }
    // Preset ins aktuelle Schedule übernehmen (deep clone)
    ctx.setSchedule(deepClone(preset));
    renderGridUI();
    renderSlidesMaster();
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
JS

cat > /var/www/signage/admin/js/ui/slides_master.js <<'JS'
// /admin/js/ui/slides_master.js
// ============================================================================
// Master-Panel: Saunen (inkl. „Kein Aufguss“), Übersicht-Row, Bild-Slides,
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

  // 7) Verweise in Bild-Slides („Nach Slide“)
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
// 6) Interstitial Images (Bild-Slides)
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
  wrap.className = 'imgrow';
  wrap.innerHTML = `
    <input id="n_${id}" class="input name" type="text" value="${escapeHtml(it.name || '')}" />
    <img id="p_${id}" class="prev" alt="" title=""/>
    <input id="sec_${id}" class="input num3 dur intSec" type="number" min="1" max="60" step="1" />
    <button class="btn sm ghost icon" id="f_${id}" title="Upload">⤴︎</button>
    <button class="btn sm ghost icon" id="x_${id}" title="Entfernen">✕</button>
    <select id="a_${id}" class="input sel-after">${interAfterOptionsHTML(it.id)}</select>
    <input id="en_${id}" type="checkbox" />
  `;

  const $name  = wrap.querySelector('#n_'+id);
  const $prev  = wrap.querySelector('#p_'+id);
  const $sec   = wrap.querySelector('#sec_'+id);
  const $up    = wrap.querySelector('#f_'+id);
  const $del   = wrap.querySelector('#x_'+id);
  const $after = wrap.querySelector('#a_'+id);
  const $en    = wrap.querySelector('#en_'+id);

  // Werte
  if ($en) $en.checked = !!it.enabled;
  if ($sec){
    $sec.value = Number.isFinite(+it.dwellSec)
      ? +it.dwellSec
      : (ctx.getSettings().slides?.imageDurationSec ?? ctx.getSettings().slides?.saunaDurationSec ?? 6);
  }
  if ($after) $after.value = getAfterSelectValue(it, it.id);

  if (it.url){
    preloadImg(it.url).then(r => { if (r.ok){ $prev.src = it.url; $prev.title = `${r.w}×${r.h}`; } });
  }

  // Uniform-Mode blendet Dauer-Feld aus
  const uniform = (ctx.getSettings().slides?.durationMode !== 'per');
  if ($sec) $sec.style.display = uniform ? 'none' : '';

  // Events
  if ($name)  $name.onchange  = () => { it.name = ($name.value || '').trim(); renderSlidesMaster(); };
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

  if ($up){
    $up.onclick = () => {
      const fi = document.createElement('input');
      fi.type='file'; fi.accept='image/*';
      fi.onchange = () => uploadGeneric(fi, (p) => {
        it.url = p;
        preloadImg(p).then(r => { if (r.ok){ $prev.src = p; $prev.title = `${r.w}×${r.h}`; } });
      });
      fi.click();
    };
  }

  if ($del) $del.onclick = () => { ctx.getSettings().interstitials.splice(i,1); renderSlidesMaster(); };

  return wrap;
}

function renderInterstitialsPanel(hostId='interList2'){
  const settings = ctx.getSettings();
  settings.interstitials = Array.isArray(settings.interstitials) ? settings.interstitials : [];
  const host = document.getElementById(hostId);
  if (!host) return;

  host.innerHTML = '';
  settings.interstitials.forEach((_, i) => host.appendChild(interRow(i)));

  const add = document.getElementById('btnInterAdd2');
  if (add) add.onclick = () => {
    (settings.interstitials ||= []).push({
      id:'im_'+Math.random().toString(36).slice(2,9),
      name:'',
      enabled:true,
      url:'',
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

  // Bild-Slides
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
JS

# ---- Admin JS: app (Entry) ----
cat > /var/www/signage/admin/js/app.js <<'JS'
// /admin/js/app.js
// ============================================================================
// Admin-App Bootstrap & Seitenweite Einstellungen
// - Lädt Schedule + Settings
// - Initialisiert Grid-UI, Slides-Master-UI und Grid-Day-Loader
// - Stellt Seitenboxen bereit (Schrift/Slides, Farben, Fußnoten, Highlight/Flame)
// - Speichern, Preview, Export/Import, Theme-Toggle, Cleanup
// ============================================================================

'use strict';

// === Modular imports =========================================================
import { $, $$, preloadImg, genId, deepClone } from './core/utils.js';
import { DEFAULTS } from './core/defaults.js';
import { initGridUI, renderGrid as renderGridUI } from './ui/grid.js';
import { initSlidesMasterUI, renderSlidesMaster } from './ui/slides_master.js';
import { initGridDayLoader } from './ui/grid_day_loader.js';
import { uploadGeneric } from './core/upload.js';

// === Global State ============================================================
let schedule = null;
let settings = null;
let baseSettings = null;            // globale Settings (Quelle)
let currentDeviceCtx = null;        // z.B. "dev_abc..."
let currentDeviceName = null;
let currentView = localStorage.getItem('adminView') || 'grid'; // 'grid' | 'preview' | 'devices'
let dockPane = null;     // Vorschau-Pane (wird nur bei "Vorschau" erzeugt)
let devicesPane = null;  // Geräte-Pane (nur bei "Geräte")


// --- Kontext-Badge (Header) im Modul-Scope ---
function renderContextBadge(){
  const h1 = document.querySelector('header h1');
  if (!h1) return;
  let el = document.getElementById('ctxBadge');
  if (!currentDeviceCtx){
    if (el) el.remove();
    return;
  }
  if (!el){
    el = document.createElement('span'); el.id='ctxBadge';
    el.className='ctx-badge';
    h1.after(el);
  }
  el.innerHTML = `Kontext: ${currentDeviceName || currentDeviceCtx} <button id="ctxReset" title="Zurück zu Global">×</button>`;
  el.querySelector('#ctxReset').onclick = ()=> exitDeviceContext();
}

// --- e) Kontext-Wechsel-Funktionen (Modul-Scope) ---
async function enterDeviceContext(id, name){
  // aktuelle Geräte-Daten holen, Overrides herausziehen
  const r = await fetch('/admin/api/devices_list.php');
  const j = await r.json();
  const dev = (j.devices||[]).find(d=>d.id===id);
  const ov  = dev?.overrides?.settings || {};

  currentDeviceCtx = id;
  currentDeviceName = name || id;

  // globale Settings als Basis
  settings = deepClone(baseSettings);

  // Overrides mergen (flach genug für unsere Struktur)
  (function merge(t, s){
    for (const k of Object.keys(s)){
      if (s[k] && typeof s[k]==='object' && !Array.isArray(s[k])){
        t[k] = t[k] && typeof t[k]==='object' ? deepClone(t[k]) : {};
        merge(t[k], s[k]);
      } else {
        t[k] = s[k];
      }
    }
  })(settings, ov);

  // UI neu zeichnen
  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();
  initSlidesMasterUI({
    getSchedule:()=>schedule,
    getSettings:()=>settings,
    setSchedule:(s)=>{schedule=s;},
    setSettings:(cs)=>{settings=cs;}
  });
  renderContextBadge();

  // in den Grid-Modus springen (falls du showView hast)
if (typeof showView==='function') showView('grid');
}

function exitDeviceContext(){
  currentDeviceCtx = null;
  currentDeviceName = null;

  settings = deepClone(baseSettings);

  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();
  initSlidesMasterUI({
    getSchedule:()=>schedule,
    getSettings:()=>settings,
    setSchedule:(s)=>{schedule=s;},
    setSettings:(cs)=>{settings=cs;}
  });
  renderContextBadge();
}


// ============================================================================
// 1) Bootstrap: Laden + Initialisieren
// ============================================================================
async function loadAll(){
  const [s, cfg] = await Promise.all([
    fetch('/admin/api/load.php').then(r=>r.json()),
    fetch('/admin/api/load_settings.php').then(r=>r.json())
  ]);

  schedule = s || {};
  settings = cfg || {};
  baseSettings = deepClone(settings);

  // Defaults mergen (defensiv)
  settings.slides        = { ...DEFAULTS.slides,   ...(settings.slides||{}) };
  settings.display       = { ...DEFAULTS.display,  ...(settings.display||{}) };
  settings.theme         = { ...DEFAULTS.theme,    ...(settings.theme||{}) };
  settings.fonts         = { ...DEFAULTS.fonts,    ...(settings.fonts||{}) };
  settings.assets        = { ...DEFAULTS.assets,   ...(settings.assets||{}) };
  settings.footnotes     = Array.isArray(settings.footnotes) ? settings.footnotes : (DEFAULTS.footnotes || []);
  settings.interstitials = Array.isArray(settings.interstitials) ? settings.interstitials : [];
  settings.presets       = settings.presets || {};

  // --- UI-Module initialisieren ---------------------------------------------
  initGridUI({
    getSchedule : () => schedule,
    getSettings : () => settings,
    setSchedule : (s) => { schedule = s; }   // wichtig für Grid-Operationen
  });

  initSlidesMasterUI({
    getSchedule : () => schedule,
    getSettings : () => settings,
    setSchedule : (s)  => { schedule = s; },
    setSettings : (cs) => { settings = cs; }
  });

  initGridDayLoader({
    getSchedule : () => schedule,
    getSettings : () => settings,
    setSchedule : (s) => { schedule = s; }
  });

  // --- Seitenboxen rendern ---------------------------------------------------
  renderSlidesBox();
  renderHighlightBox();
  renderColors();
  renderFootnotes();

  // --- globale UI-Schalter (Theme/Backup/Cleanup) ---------------------------
  initThemeToggle();
  initBackupButtons();
  initCleanupInSystem();
  initViewMenu();
}

// ============================================================================
// 2) Slides & Text (linke Seitenbox „Slideshow & Text“)
// ============================================================================
function renderSlidesBox(){
  const f = settings.fonts || {};
  const setV = (sel, val) => { const el = document.querySelector(sel); if (el) el.value = val; };
  const setC = (sel, val) => { const el = document.querySelector(sel); if (el) el.checked = !!val; };

  // Anzeige / Scaling
  setV('#fitMode', settings.display?.fit || 'cover');

  // Schrift
  setV('#fontFamily', f.family ?? DEFAULTS.fonts.family);
  setV('#fontScale',  f.scale  ?? 1);
  setV('#h1Scale',    f.h1Scale ?? 1);
  setV('#h2Scale',    f.h2Scale ?? 1);
  setV('#chipOverflowMode', f.chipOverflowMode ?? 'scale');
  setV('#flamePct',         f.flamePct         ?? 55);
  setV('#flameGap',         f.flameGapPx       ?? 6);

  // H2
  setV('#h2Mode', settings.h2?.mode ?? DEFAULTS.h2.mode);
  setV('#h2Text', settings.h2?.text ?? DEFAULTS.h2.text);
  setC('#h2ShowOverview', (settings.h2?.showOnOverview ?? DEFAULTS.h2.showOnOverview));

  // Übersicht (Tabelle)
  setV('#ovTitleScale', f.overviewTitleScale ?? 1);
  setV('#ovHeadScale',  f.overviewHeadScale  ?? 0.9);
  setV('#ovCellScale',  f.overviewCellScale  ?? 0.8);
  setV('#chipH',        f.chipHeight         ?? 44);

  // Saunafolien (Kacheln)
  setV('#tileTextScale', f.tileTextScale ?? 0.8);
  setV('#tileWeight',    f.tileWeight    ?? 600);
  setV('#tilePct',       settings.slides?.tileWidthPercent ?? 45);
  setV('#tileMin',       settings.slides?.tileMinPx ?? 480);
  setV('#tileMax',       settings.slides?.tileMaxPx ?? 1100);

  // Bildspalte / Schrägschnitt
  setV('#rightW',   settings.display?.rightWidthPercent ?? 38);
  setV('#cutTop',   settings.display?.cutTopPercent ?? 28);
  setV('#cutBottom',settings.display?.cutBottomPercent ?? 12);

  // Reset-Button (nur Felder dieser Box)
  const reset = document.querySelector('#resetSlides');
  if (!reset) return;
  reset.onclick = ()=>{
    setV('#fitMode', 'cover');

    setV('#fontFamily', DEFAULTS.fonts.family);
    setV('#fontScale', 1);
    setV('#h1Scale', 1);
    setV('#h2Scale', 1);

    setV('#h2Mode', DEFAULTS.h2.mode);
    setV('#h2Text', DEFAULTS.h2.text);
    setC('#h2ShowOverview', DEFAULTS.h2.showOnOverview);

    setV('#ovTitleScale', DEFAULTS.fonts.overviewTitleScale);
    setV('#ovHeadScale',  DEFAULTS.fonts.overviewHeadScale);
    setV('#ovCellScale',  DEFAULTS.fonts.overviewCellScale);
    setV('#chipH',        DEFAULTS.fonts.chipHeight);
    setV('#chipOverflowMode', DEFAULTS.fonts.chipOverflowMode);
    setV('#flamePct',         DEFAULTS.fonts.flamePct);
    setV('#flameGap',         DEFAULTS.fonts.flameGapPx);

    setV('#tileTextScale', DEFAULTS.fonts.tileTextScale);
    setV('#tileWeight',    DEFAULTS.fonts.tileWeight);
    setV('#tilePct',       DEFAULTS.slides.tileWidthPercent);
    setV('#tileMin',       DEFAULTS.slides.tileMinPx);
    setV('#tileMax',       DEFAULTS.slides.tileMaxPx);

    setV('#rightW',   DEFAULTS.display.rightWidthPercent);
    setV('#cutTop',   DEFAULTS.display.cutTopPercent);
    setV('#cutBottom',DEFAULTS.display.cutBottomPercent);
  };
}

// ============================================================================
// 3) Highlights & Flames (rechte Box „Slideshow & Text“ – unterer Teil)
// ============================================================================
function renderHighlightBox(){
  const hl = settings.highlightNext || DEFAULTS.highlightNext;

  $('#hlEnabled').checked = !!hl.enabled;
  $('#hlColor').value     = hl.color || DEFAULTS.highlightNext.color;
  $('#hlBefore').value    = Number.isFinite(+hl.minutesBeforeNext) ? hl.minutesBeforeNext : DEFAULTS.highlightNext.minutesBeforeNext;
  $('#hlAfter').value     = Number.isFinite(+hl.minutesAfterStart) ? hl.minutesAfterStart  : DEFAULTS.highlightNext.minutesAfterStart;

  const setSw = ()=> $('#hlSw').style.background = $('#hlColor').value;
  setSw();
  $('#hlColor').addEventListener('input',()=>{
    if(/^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)) setSw();
  });

  // Flammenbild
  $('#flameImg').value = settings.assets?.flameImage || DEFAULTS.assets.flameImage;
  updateFlamePreview($('#flameImg').value);

  $('#flameFile').onchange = ()=> uploadGeneric($('#flameFile'), (p)=>{
    settings.assets = settings.assets || {};
    settings.assets.flameImage = p;
    $('#flameImg').value = p;
    updateFlamePreview(p);
  });

  $('#resetFlame').onclick = ()=>{
    const def = DEFAULTS.assets.flameImage;
    settings.assets = settings.assets || {};
    settings.assets.flameImage = def;
    $('#flameImg').value = def;
    updateFlamePreview(def);
  };
}

function updateFlamePreview(u){
  const img = $('#flamePrev');
  preloadImg(u).then(r=>{
    if(r.ok){ img.src = u; img.title = r.w+'×'+r.h; }
    else { img.removeAttribute('src'); img.title = ''; }
  });
}

// ============================================================================
// 4) Farben-Panel
// ============================================================================
function colorField(key,label,init){
  const row=document.createElement('div');
  row.className='kv';
  row.innerHTML = `
    <label>${label}</label>
    <div class="color-item">
      <div class="swatch" id="sw_${key}"></div>
      <input class="input" id="cl_${key}" type="text" value="${init}" placeholder="#RRGGBB">
    </div>`;
  return row;
}

function renderColors(){
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

  // Saunafolien & Flammen
  const C=document.createElement('div'); C.className='fieldset'; C.innerHTML='<div class="legend">Sauna-Folien & Flammen</div>';
  C.appendChild(colorField('cellBg','Kachel-Hintergrund', theme.cellBg||DEFAULTS.theme.cellBg));
  C.appendChild(colorField('boxFg','Kachel-Schrift', theme.boxFg||DEFAULTS.theme.boxFg));
  C.appendChild(colorField('saunaColor','Sauna-Überschrift', theme.saunaColor||DEFAULTS.theme.saunaColor));
  C.appendChild(colorField('tileBorder','Kachel-Rahmen (nur Kacheln)', theme.tileBorder||theme.gridBorder||DEFAULTS.theme.tileBorder||DEFAULTS.theme.gridBorder));
  C.appendChild(colorField('flame','Flammen', theme.flame||DEFAULTS.theme.flame));

  host.appendChild(A); host.appendChild(B); host.appendChild(C);

  // Swatch-Vorschau & Reset
  $$('#colorList input[type="text"]').forEach(inp=>{
    const sw=$('#sw_'+inp.id.replace(/^cl_/,''));
    const setPrev=v=> sw.style.background=v;
    setPrev(inp.value);
    inp.addEventListener('input',()=>{ if(/^#([0-9A-Fa-f]{6})$/.test(inp.value)) setPrev(inp.value); });
  });
  $('#resetColors').onclick = ()=>{ 
    $$('#colorList input[type="text"]').forEach(inp=>{
      const k=inp.id.replace(/^cl_/,'');
      inp.value=(DEFAULTS.theme[k]||'#FFFFFF');
      const sw=$('#sw_'+k); if(sw) sw.style.background=inp.value;
    });
    const bws=document.getElementById('bw_gridTableW');
    if(bws) bws.value = DEFAULTS.theme.gridTableW ?? 2;
  };
}

function ensureColorTools(){
  const host = document.getElementById('colorList');
  if (!host) return;
  if (document.getElementById('colorTools')) return; // schon da

  const box = document.createElement('div');
  box.id = 'colorTools';
  box.className = 'fieldset';
  box.innerHTML = `
    <div class="legendRow">
      <div class="legend">Farb-Werkzeuge</div>
<button class="btn sm ghost" id="togglePickerSize" title="Iframe Höhe expandieren/zusammenklappen">⛶</button>
<button class="btn sm ghost" id="dockPicker" title="Als schwebendes Fenster anzeigen">⇱</button>

</div>

        <div id="pickerWrap" class="pickerResizable">
          <iframe
            id="hexPickerFrame"
            class="pickerFrame"
            src="https://colorhunt.co/"
            loading="lazy"
            referrerpolicy="no-referrer"
            title="Hex Color Picker"></iframe>
        </div>
      </div>
    </div>

    <div class="kv">
      <label>Schnell-Picker</label>
      <div class="row" style="gap:8px;flex-wrap:nowrap">
        <input type="color" id="quickColor" class="input">
        <input type="text" id="quickHex" class="input" value="#FFDD66" placeholder="#RRGGBB">
        <button class="btn sm" id="copyHex" title="Hex in Zwischenablage kopieren"># kopieren</button>
        <span id="copyState" class="mut"></span>
      </div>
    </div>
  `;

  // vor die Farbliste setzen
  host.parentElement.insertBefore(box, host);

  // Controls
  const $wrap = document.getElementById('pickerWrap');
  const $toggle = document.getElementById('togglePickerSize');
  const $qc = document.getElementById('quickColor');
  const $qh = document.getElementById('quickHex');
  const $cp = document.getElementById('copyHex');
  const $st = document.getElementById('copyState');

  // Höhe aus LocalStorage wiederherstellen (nur "Normalmodus")
const savedH = parseInt(localStorage.getItem('colorPickerH') || '0', 10);
const savedW = parseInt(localStorage.getItem('colorPickerW') || '0', 10);
if (savedH >= 140) $wrap.style.height = savedH + 'px';
if (savedW >= 260) $wrap.style.width  = savedW + 'px';

  // expand/collapse
$toggle.onclick = ()=>{
  if (!box.classList.contains('exp')){
    box.dataset.prevH = $wrap.clientHeight;
    box.dataset.prevW = $wrap.clientWidth;
    box.classList.add('exp');
    $wrap.style.width = '100%';
  } else {
    box.classList.remove('exp');
    const h = parseInt(box.dataset.prevH || '180', 10);
    const w = parseInt(box.dataset.prevW || '0',   10);
    $wrap.style.height = Math.max(140, h) + 'px';
    if (w) $wrap.style.width = Math.max(260, w) + 'px';
  }
};

// Größe speichern (nur wenn nicht expanded)
const ro = new ResizeObserver((entries)=>{
  if (box.classList.contains('exp')) return;
  for (const e of entries){
    const {height, width} = e.contentRect;
    if (height >= 140) localStorage.setItem('colorPickerH', String(Math.round(height)));
    if (width  >= 260) localStorage.setItem('colorPickerW', String(Math.round(width)));
  }
});
ro.observe($wrap);

  // Schnell-Picker Logik
  if (/^#([0-9A-Fa-f]{6})$/.test($qh.value)) $qc.value = $qh.value;
  $qc.addEventListener('input', ()=>{ $qh.value = ($qc.value || '').toUpperCase(); });
  $qh.addEventListener('input', ()=>{
    const v = ($qh.value||'').trim();
    if (/^#([0-9A-Fa-f]{6})$/.test(v)) $qc.value = v;
  });
  $cp.onclick = async ()=>{
    const v = ($qh.value||'').trim().toUpperCase();
    if (!/^#([0-9A-F]{6})$/.test(v)) { alert('Bitte gültigen Hex-Wert: #RRGGBB'); return; }
    try { await navigator.clipboard.writeText(v); $st.textContent = 'kopiert'; setTimeout(()=> $st.textContent='', 1000); }
    catch { $qh.select(); document.execCommand?.('copy'); $st.textContent = 'kopiert'; setTimeout(()=> $st.textContent='', 1000); }
  };
const $dock = document.getElementById('dockPicker');
$dock.onclick = ()=> box.classList.toggle('float');
}


// ============================================================================
// 5) Fußnoten
// ============================================================================
function renderFootnotes(){
  const host=$('#fnList'); if (!host) return;
  host.innerHTML='';
  const layoutSel = document.getElementById('footnoteLayout');
  if (layoutSel){ layoutSel.value = settings.footnoteLayout || 'one-line'; layoutSel.onchange = ()=>{ settings.footnoteLayout = layoutSel.value; }; }
  const list = settings.footnotes || [];
  list.forEach((fn,i)=> host.appendChild(fnRow(fn,i)));
  $('#fnAdd').onclick=()=>{ (settings.footnotes ||= []).push({id:genId(), label:'*', text:''}); renderFootnotes(); };
}

function fnRow(fn,i){
  const wrap=document.createElement('div'); wrap.className='kv';
  wrap.innerHTML = `
    <label>Label/Text</label>
    <div class="row" style="gap:8px;flex-wrap:nowrap">
      <input class="input" id="fn_l_${i}" value="${fn.label||'*'}" style="width:6ch"/>
      <input class="input" id="fn_t_${i}" value="${fn.text||''}" style="min-width:0"/>
      <button class="btn sm" id="fn_x_${i}">✕</button>
    </div>`;
  wrap.querySelector(`#fn_l_${i}`).onchange=(e)=>{ fn.label = (e.target.value||'*').slice(0,2); };
  wrap.querySelector(`#fn_t_${i}`).onchange=(e)=>{ fn.text = e.target.value||''; };
  wrap.querySelector(`#fn_x_${i}`).onclick=()=>{ settings.footnotes.splice(i,1); renderFootnotes(); };
  return wrap;
}

// ============================================================================
// 6) Speichern / Preview / Export / Import
// ============================================================================
function collectColors(){ 
  const theme={...(settings.theme||{})}; 
  $$('#colorList input[type="text"]').forEach(inp=>{
    const v=String(inp.value).toUpperCase();
    if(/^#([0-9A-Fa-f]{6})$/.test(v)) theme[inp.id.replace(/^cl_/,'')]=v;
  });
  const bw=document.getElementById('bw_gridTableW');
  if(bw) theme.gridTableW = Math.max(0, Math.min(10, +bw.value||0));
  return theme; 
}

function collectSettings(){
  return {
    schedule: { ...schedule },
    settings: {
      ...settings,
      footnoteLayout: document.getElementById('footnoteLayout')?.value || settings.footnoteLayout || 'one-line',
      fonts:{
        family: $('#fontFamily').value,
        scale: +($('#fontScale')?.value||1),
        h1Scale:+($('#h1Scale').value||1),
        h2Scale:+($('#h2Scale').value||1),
        overviewTitleScale:+($('#ovTitleScale').value||1),
        overviewHeadScale:+($('#ovHeadScale').value||0.9),
        overviewCellScale:+($('#ovCellScale').value||0.8),
        chipHeight:+($('#chipH').value||44),
        chipOverflowMode: ($('#chipOverflowMode')?.value || 'scale'),
        flamePct:   +($('#flamePct')?.value || 55),
        flameGapPx: +($('#flameGap')?.value || 6),
        tileTextScale:+($('#tileTextScale').value||0.8),
        tileWeight:+($('#tileWeight').value||600)
      },
      h2:{
        mode: $('#h2Mode').value || 'text',
        text: ($('#h2Text').value ?? '').trim(),
        showOnOverview: !!$('#h2ShowOverview').checked
      },
      slides:{
        ...(settings.slides||{}),
        showOverview: !!document.getElementById('ovShow')?.checked,
	overviewDurationSec: (() => {
  	const el = document.getElementById('ovSec') || document.getElementById('ovSecGlobal');
  	const fallback = settings?.slides?.overviewDurationSec ?? (DEFAULTS?.slides?.overviewDurationSec ?? 10);
  	const v = el?.value;
  	const n = Number(v);
  	return Number.isFinite(n) ? Math.max(1, Math.min(120, n)) : fallback;
	})(),
        transitionMs: +(document.getElementById('transMs2')?.value || 500),
        durationMode: (document.querySelector('input[name=durMode]:checked')?.value || 'uniform'),
        globalDwellSec: +(document.getElementById('dwellAll')?.value || 6)
      },
      theme: collectColors(),
      highlightNext:{
        enabled: $('#hlEnabled').checked,
        color: /^#([0-9A-Fa-f]{6})$/.test($('#hlColor').value)? $('#hlColor').value.toUpperCase() : (settings.highlightNext?.color || DEFAULTS.highlightNext.color),
        minutesBeforeNext: +( $('#hlBefore').value || DEFAULTS.highlightNext.minutesBeforeNext ),
        minutesAfterStart: +( $('#hlAfter').value || DEFAULTS.highlightNext.minutesAfterStart )
      },
      assets:{ ...(settings.assets||{}), flameImage: $('#flameImg').value || DEFAULTS.assets.flameImage },
      display:{ ...(settings.display||{}), fit: $('#fitMode').value, baseW:1920, baseH:1080,
        rightWidthPercent:+($('#rightW').value||38), cutTopPercent:+($('#cutTop').value||28), cutBottomPercent:+($('#cutBottom').value||12) },
      footnotes: settings.footnotes,
      interstitials: settings.interstitials || [],
      presets: settings.presets || {},
      presetAuto: !!document.getElementById('presetAuto')?.checked
    }
  };
}

// Buttons: Open / Preview / Save
$('#btnOpen')?.addEventListener('click', ()=> window.open('/', '_blank'));

$('#btnSave')?.addEventListener('click', async ()=>{
  const body = collectSettings();

  if (!currentDeviceCtx){
    // Global speichern
    body.schedule.version = (Date.now()/1000|0);
    body.settings.version = (Date.now()/1000|0);
    const r=await fetch('/admin/api/save.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    const j=await r.json().catch(()=>({ok:false}));
    if (j.ok){ baseSettings = deepClone(body.settings); }
    alert(j.ok ? 'Gespeichert (Global).' : ('Fehler: '+(j.error||'unbekannt')));
  } else {
    // Geräte-Override speichern
    const payload = { device: currentDeviceCtx, settings: body.settings };
    const r=await fetch('/admin/api/devices_save_override.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    const j=await r.json().catch(()=>({ok:false}));
    alert(j.ok ? ('Gespeichert für Gerät: '+currentDeviceName) : ('Fehler: '+(j.error||'unbekannt')));
  }
});

// --- Dock ----------------------------------------------------------
let _dockTimer = 0;
let _dockInputListener = null;

function dockPushDebounced(){
  clearTimeout(_dockTimer);
  _dockTimer = setTimeout(()=> dockSend(false), 250);
}
function dockSend(reload){
  const frame = document.getElementById('dockPane')?.querySelector('#dockFrame');
  if (!frame || !frame.contentWindow) return;
  const payload = collectSettings();
  if (reload){
    try { frame.contentWindow.location.reload(); } catch {}
    setTimeout(()=> { try { frame.contentWindow.postMessage({type:'preview', payload}, '*'); } catch {} }, 350);
    return;
  }
  try { frame.contentWindow.postMessage({type:'preview', payload}, '*'); } catch {}
}
function attachDockLivePush(){
  if (_dockInputListener) return;
  _dockInputListener = (ev)=>{
    if (ev?.target?.type === 'file') return;
    dockPushDebounced();
  };
  document.addEventListener('input',  _dockInputListener, true);
  document.addEventListener('change', _dockInputListener, true);
}
function detachDockLivePush(){
  if (!_dockInputListener) return;
  document.removeEventListener('input',  _dockInputListener, true);
  document.removeEventListener('change', _dockInputListener, true);
  _dockInputListener = null;
  clearTimeout(_dockTimer);
}


// --- Devices: Claim ----------------------------------------------------------
async function claim(codeFromUI, nameFromUI) {
  const code = (codeFromUI || '').trim().toUpperCase();
  const name = (nameFromUI || '').trim() || ('Display ' + code.slice(-3));
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    alert('Bitte einen 6-stelligen Code eingeben.'); return;
  }
  const r = await fetch('/admin/api/devices_claim.php', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ code, name })
  });
  const j = await r.json().catch(()=>({ok:false}));
  if (!j.ok) { alert('Fehler: ' + (j.error || 'unbekannt')); return; }

  // kleine Quality-of-life Info:
  if (j.deviceId) {
    const url = location.origin + '/?device=' + j.deviceId;
    console.log('Gepaart:', j.deviceId, url);
  }
  // Pane neu laden (siehe createDevicesPane -> render)
  if (typeof window.__refreshDevicesPane === 'function') await window.__refreshDevicesPane();
  alert('Gerät gekoppelt' + (j.already ? ' (war bereits gekoppelt)' : '') + '.');
}

async function createDevicesPane(){
  const host = document.querySelector('.leftcol');
  const card = document.createElement('div');
  card.className = 'card';
  card.id = 'devicesPane';
  card.innerHTML = `
    <div class="content">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
        <div style="font-weight:800">Geräte</div>
        <div class="row" style="gap:6px">
          <button class="btn sm" id="devPairManual">Code eingeben…</button>
          <button class="btn sm" id="devRefresh">Aktualisieren</button>
          <button class="btn sm danger" id="devGc">Aufräumen</button>
      </div>
      </div>

      <div id="devPendingWrap">
        <div class="subh" style="font-weight:700;margin:8px 0">Ungepairt</div>
        <div id="devPendingList" class="kv"></div>
      </div>

      <div id="devPairedWrap" style="margin-top:12px">
        <div class="subh" style="font-weight:700;margin:8px 0">Gepaart</div>
        <div id="devPairedList" class="kv"></div>
      </div>

      <small class="mut">Tipp: Rufe auf dem TV die Standard-URL auf – es erscheint ein Pairing-Code.</small>
    </div>`;

  host?.insertBefore(card, host.firstChild);

  // --- API-Adapter: devices_list.php (wenn vorhanden) oder Fallback auf devices.json
  async function fetchDevicesStatus(){
    try {
      const r = await fetch('/admin/api/devices_list.php', {cache:'no-store'});
      if (r.ok) { const j = await r.json(); j.ok ??= true; return j; }
    } catch(e){}
    // Fallback: /data/devices.json -> normalisierte Struktur
    const r2 = await fetch('/data/devices.json?t='+Date.now(), {cache:'no-store'});
    const j2 = await r2.json();
    const pairings = Object.values(j2.pairings || {})
      .filter(p => !p.deviceId)
      .map(p => ({ code: p.code, createdAt: p.created }));
    const devices = Object.values(j2.devices || {})
      .map(d => ({ id: d.id, name: d.name || '', lastSeenAt: d.lastSeen || 0 }));
    return { ok:true, pairings, devices };
  }

  async function render(){
    const j = await fetchDevicesStatus();

    // Pending
    const P = document.getElementById('devPendingList');
    P.innerHTML = '';
    const pend = (j.pairings || []).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if (!pend.length) {
      P.innerHTML = '<div class="mut">Keine offenen Pairings.</div>';
    } else {
      pend.forEach(d=>{
        const row = document.createElement('div'); row.className='row'; row.style.gap='8px';
        const ts = d.createdAt ? new Date(d.createdAt*1000).toLocaleString('de-DE') : '—';
        row.innerHTML = `
          <div class="pill">Code: <b>${d.code}</b></div>
          <div class="mut">seit ${ts}</div>
          <button class="btn sm" data-code>Pairen…</button>
        `;
        row.querySelector('[data-code]').onclick = async ()=>{
          const name = prompt('Name des Geräts (z. B. „Foyer TV“):','') || '';
          await claim(d.code, name);
        };
        P.appendChild(row);
      });
    }

    // Paired
    const L = document.getElementById('devPairedList');
    L.innerHTML = '';
    const paired = (j.devices || []);
    if (!paired.length) {
      L.innerHTML = '<div class="mut">Noch keine Geräte gekoppelt.</div>';
    } else {
      paired.forEach(d=>{
        const row = document.createElement('div'); row.className='row'; row.style.gap='8px'; row.style.alignItems='center';
        const seen = d.lastSeenAt ? new Date(d.lastSeenAt*1000).toLocaleString('de-DE') : '—';
        row.innerHTML = `
          <div class="pill"><b>${d.name || d.id}</b></div>
          <div class="mut">ID: ${d.id}</div>
          <div class="mut">Zuletzt: ${seen}</div>
<button class="btn sm" data-view>Ansehen</button>
<button class="btn sm ghost" data-url>URL kopieren</button>
          <button class="btn sm" data-edit>Im Editor bearbeiten</button>
          <button class="btn sm danger" data-unpair>Trennen…</button>
          `;

row.querySelector('[data-unpair]').onclick = async ()=>{
  if (!/^dev_/.test(String(d.id))) {
    alert('Dieses Gerät hat eine alte/ungültige ID. Bitte ein neues Gerät koppeln und das alte ignorieren.');
    return;
  }
  const check = prompt('Wirklich trennen? Tippe „Ja“ zum Bestätigen:');
  if ((check||'').trim().toLowerCase() !== 'ja') return;

  const r = await fetch('/admin/api/devices_unpair.php', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ device: d.id, purge: 1 })
  });
  const jj = await r.json().catch(()=>({ok:false}));
  if (!jj.ok) { alert('Fehler: '+(jj.error||'unbekannt')); return; }
  alert('Gerät getrennt.');
  render();
};

row.querySelector('[data-view]').onclick = ()=>{
 openDevicePreview(d.id, d.name || d.id);
 };
 row.querySelector('[data-url]').onclick = async ()=>{
          const url = location.origin + '/?device=' + d.id;
          try { await navigator.clipboard.writeText(url); alert('URL kopiert:\n'+url); }
          catch { prompt('URL kopieren:', url); }
        };
        row.querySelector('[data-edit]').onclick = ()=>{
          enterDeviceContext(d.id, d.name || d.id);
        };
        L.appendChild(row);
      });
    }
  }

  // oben rechts: „Code eingeben…“
  card.querySelector('#devPairManual').onclick = async ()=>{
    const code = prompt('Pairing-Code (6 Zeichen):','');
    if (!code) return;
    const name = prompt('Gerätename (optional):','') || '';
    await claim(code, name);
  };

  // Refresh & einmalig laden
  card.querySelector('#devRefresh').onclick = render;
  await render();

card.querySelector('#devGc').onclick = async ()=>{
  const conf = prompt('Geräte/Pairings aufräumen? Tippe „Ja“ zum Bestätigen:');
  if ((conf||'').trim().toLowerCase() !== 'ja') return;
  const r = await fetch('/admin/api/devices_gc.php', { method:'POST' });
  const j = await r.json().catch(()=>({ok:false}));
  if (!j.ok){ alert('Fehler: '+(j.error||'unbekannt')); return; }
  alert(`Bereinigt: ${j.deletedDevices} Geräte, ${j.deletedPairings} Pairing-Codes.`);
  card.querySelector('#devRefresh').click();
};


  // globaler Hook, damit claim() nach erfolgreichem Pairen neu laden kann
  window.__refreshDevicesPane = render;

  return card;
}

// Geräte‑Vorschau (neues Modal)
function openDevicePreview(id, name){
  const m = document.getElementById('devPrevModal');
  const f = document.getElementById('devPrevFrame');
  if (!m || !f) {
    console.error('[devPrev] Modal oder Frame nicht gefunden. Existieren #devPrevModal und #devPrevFrame als SIBLINGS von #prevModal?');
    alert('Geräte-Vorschau nicht verfügbar (siehe Konsole).');
    return;
  }
  const t = m.querySelector('[data-devprev-title]');
  if (t) t.textContent = name ? ('Geräte-Ansicht: ' + name) : 'Geräte-Ansicht';
  f.src = '/?device=' + encodeURIComponent(id) + '&t=' + Date.now();
  m.style.display = 'grid';
}
document.getElementById('devPrevReload')?.addEventListener('click', ()=>{
  const f = document.getElementById('devPrevFrame');
  try { f?.contentWindow?.location?.reload(); } catch {}
});
document.getElementById('devPrevClose')?.addEventListener('click', ()=>{
  const m = document.getElementById('devPrevModal');
  const f = document.getElementById('devPrevFrame');
  if (m) m.style.display = 'none';
  if (f) f.src = 'about:blank';
});

function createDockPane(){
  const gridCard = document.getElementById('gridPane');
  if (!gridCard) return null;

  const wrap = document.createElement('div');
  wrap.className = 'card';
  wrap.id = 'dockPane';
  wrap.innerHTML = `
    <div class="content" style="padding-top:10px">
      <div class="row" style="justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:700">Vorschau</div>
        <div class="row" style="gap:8px">
          <button class="btn sm" id="dockReload">Neu laden</button>
          <span class="mut">zeigt nicht gespeicherte Änderungen</span>
        </div>
      </div>
      <div class="dockWrap">
        <iframe id="dockFrame" src="about:blank" title="Slideshow Vorschau"></iframe>
      </div>
    </div>
  `;
  gridCard.style.display = 'none';
  gridCard.after(wrap);

  const frame = wrap.querySelector('#dockFrame');
  frame.src = '/?preview=1';
  frame.addEventListener('load', ()=> dockSend(false), { once:true });
  wrap.querySelector('#dockReload')?.addEventListener('click', ()=> dockSend(true));

  return wrap;
}

function destroyDockPane(){
  const pane = document.getElementById('dockPane');
  if (pane){
    const frame = pane.querySelector('#dockFrame');
    if (frame) frame.src = 'about:blank';
    pane.remove();
  }
}

function viewLabel(v){ return v==='preview' ? 'Vorschau' : v==='devices' ? 'Geräte' : 'Grid'; }

async function showView(v){
  currentView = v;
  localStorage.setItem('adminView', v);

  const labelEl = document.getElementById('viewMenuLabel');
  if (labelEl) labelEl.textContent = viewLabel(v);
  document.querySelectorAll('#viewMenu .dd-item').forEach(it=>{
    it.setAttribute('aria-checked', it.dataset.view === v ? 'true' : 'false');
  });

  const gridCard = document.getElementById('gridPane');
  if (!gridCard) return;

  // Alles schließen/aufräumen
  detachDockLivePush();

  if (v === 'grid'){
    gridCard.style.display = '';
    destroyDockPane();
    if (devicesPane && devicesPane.remove) { devicesPane.remove(); devicesPane = null; }
    return;
  }

  if (v === 'preview'){
    gridCard.style.display = 'none';
    if (devicesPane && devicesPane.remove) { devicesPane.remove(); devicesPane = null; }
    if (!document.getElementById('dockPane')) createDockPane();
    attachDockLivePush();
    return;
  }

  if (v === 'devices'){
    gridCard.style.display = 'none';
    destroyDockPane();
    if (!devicesPane){
      // WICHTIG: createDevicesPane ist async → Ergebnis abwarten
      devicesPane = await createDevicesPane();
    }
    return;
  }
}

function initViewMenu(){
  const btn  = document.getElementById('viewMenuBtn');
  const menu = document.getElementById('viewMenu');
  if (!btn || !menu) return;

  const openMenu  = ()=>{ menu.hidden=false; btn.setAttribute('aria-expanded','true'); };
  const closeMenu = ()=>{ menu.hidden=true;  btn.setAttribute('aria-expanded','false'); };

  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    (btn.getAttribute('aria-expanded')==='true') ? closeMenu() : openMenu();
  });

  menu.querySelectorAll('.dd-item').forEach(it=>{
    it.addEventListener('click', async ()=>{
      await showView(it.dataset.view);
      closeMenu();
    });
  });

  document.addEventListener('click', (e)=>{
    if (!menu.hidden && !document.getElementById('viewMenuWrap').contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', async (e)=>{
    if (e.key === 'Escape' && !menu.hidden) closeMenu();
    const typing = /input|textarea|select/i.test(e.target?.tagName||'');
    if (typing) return;
    if (e.key === '1') { await showView('grid');    closeMenu(); }
    if (e.key === '2') { await showView('preview'); closeMenu(); }
    if (e.key === '3') { await showView('devices'); closeMenu(); }
  });

  document.getElementById('viewMenuLabel').textContent = viewLabel(currentView);
  // Initial zeichnen
  Promise.resolve().then(()=> showView(currentView));
}


// Export/Import + Optionen
function initBackupButtons(){
  const expBtn   = document.getElementById('btnExport');
  const impFile  = document.getElementById('importFile');
  const impWrite = document.getElementById('impWriteImg');

  if (expBtn) expBtn.onclick = async ()=>{
    const incImg = document.getElementById('expWithImg')?.checked ? 1 : 0;
    const incSet = document.getElementById('expWithSettings')?.checked ? 1 : 0;
    const incSch = document.getElementById('expWithSchedule')?.checked ? 1 : 0;
    const stamp  = new Date().toISOString().slice(0,10);
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

// ============================================================================
// 7) Theme-Toggle
// ============================================================================
function initThemeToggle(){
  const cb = document.getElementById('themeMode');
  const label = document.getElementById('themeLabel');

  const apply = (mode) => {
    document.body.classList.toggle('theme-light', mode === 'light');
    document.body.classList.toggle('theme-dark',  mode === 'dark');
    label.textContent = (mode === 'light') ? 'Hell' : 'Dunkel';
    localStorage.setItem('adminTheme', mode);
  };

  // ⬇️ Standard jetzt "light"
  const saved = localStorage.getItem('adminTheme') || 'light';
  cb.checked = (saved === 'light');
  apply(saved);

  cb.onchange = () => apply(cb.checked ? 'light' : 'dark');
}

// ============================================================================
// 8) System: Cleanup-Buttons (Assets aufräumen mit Auswahl)
// ============================================================================
function initCleanupInSystem(){
  const btn = document.getElementById('btnCleanupSys');
  if(!btn) return;
  btn.onclick = async ()=>{
    const delSauna = confirm('Sauna-Bilder löschen? OK = Ja, Abbrechen = Nein');
    const delInter = confirm('Bild-Slides löschen? OK = Ja, Abbrechen = Nein');
    const delFlame = confirm('Flammen-Bild löschen? OK = Ja, Abbrechen = Nein');

    const qs = new URLSearchParams({
      sauna: delSauna ? '1' : '0',
      inter: delInter ? '1' : '0',
      flame: delFlame ? '1' : '0'
    });
    const r = await fetch('/admin/api/cleanup_assets.php?'+qs.toString());
    const j = await r.json().catch(()=>({ok:false}));
    alert(j.ok ? (`Bereinigt: ${j.removed||'?'} Dateien entfernt.`) : ('Fehler: '+(j.error||'')));
  };
}

// ============================================================================
// 9) Start
// ============================================================================
loadAll();
JS

# ---------------------------
# Admin API (PHP)
# ---------------------------
install -d -o www-data -g www-data -m 2775 /var/www/signage/admin/api

# ---------------------------
# Device Manager
# ---------------------------
cat >/var/www/signage/admin/api/devices_store.php <<'PHP'
<?php
// /admin/api/devices_store.php – vollständige Helfer (ohne Platzhalter)
// Warum: Wird von /pair/* Endpunkten und Admin-API geteilt; zentrale, robuste Umsetzung.

const DEV_DB = '/var/www/signage/data/devices.json';

function dev_db_load(){
  if (!is_file(DEV_DB)) return ['version'=>1,'pairings'=>[],'devices'=>[]];
  $j = json_decode(@file_get_contents(DEV_DB), true);
  return is_array($j) ? $j : ['version'=>1,'pairings'=>[],'devices'=>[]];
}

function dev_db_save($db){
  @mkdir(dirname(DEV_DB), 02775, true);
  $json = json_encode($db, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
  $bytes = @file_put_contents(DEV_DB, $json, LOCK_EX);
  if ($bytes === false) {
    throw new RuntimeException('Unable to write device database');
  }
  @chmod(DEV_DB, 0644);
  @chown(DEV_DB,'www-data'); @chgrp(DEV_DB,'www-data');
  return true;
}

// Koppel-Code (AAAAAA) aus A–Z (ohne I/O) generieren; keine Speicherung hier
function dev_gen_code($db){
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for ($i=0; $i<500; $i++) {
    $code = '';
    for ($j=0; $j<6; $j++) $code .= $alphabet[random_int(0, strlen($alphabet)-1)];
    if (empty($db['pairings'][$code])) return $code;
  }
  return null;
}

// Geräte-ID im Format dev_ + 12 hex (Regex im Player erwartet exakt das)
function dev_gen_id($db){
  for ($i=0; $i<1000; $i++) {
    $id = 'dev_'.bin2hex(random_bytes(6));
    if (empty($db['devices'][$id])) return $id;
  }
  return null;
}

// Aufräumen: offene Pairings >15min löschen; verwaiste Links bereinigen
function dev_gc(&$db){
  $now = time();
  foreach (($db['pairings'] ?? []) as $code => $p) {
    $age = $now - (int)($p['created'] ?? $now);
    if ($age > 900 && empty($p['deviceId'])) unset($db['pairings'][$code]);
    // Referenz auf nicht-existentes Device? -> lösen
    if (!empty($p['deviceId']) && empty($db['devices'][$p['deviceId']])) {
      $db['pairings'][$code]['deviceId'] = null;
    }
  }
}
PHP

cat >/var/www/signage/admin/api/device_resolve.php <<'PHP'
<?php
/**
 * File: /var/www/signage/admin/api/device_resolve.php
 * Zweck: Liefert aufgelöste Einstellungen (global + Geräte-Overrides) und Zeitplan.
 * Warum wichtige Checks: Verhindert "undefined"-Geräte & sorgt für robuste Fallbacks.
 */

require_once __DIR__ . '/devices_lib.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

// --- kleine Helfer (nur "warum"-kritische Funktionalität) -------------------

/** Rekursives Merge nur für assoziative Arrays; Geräte-Overrides haben Vorrang. */
function merge_r($a, $b) {
  if (!is_array($a)) $a = [];
  if (!is_array($b)) return $a;
  foreach ($b as $k => $v) {
    $a[$k] = (is_array($v) && array_key_exists($k, $a) && is_array($a[$k]))
      ? merge_r($a[$k], $v)
      : $v;
  }
  return $a;
}

/** JSON sicher lesen; bei defekten/fehlenden Dateien leere Defaults liefern. */
function read_json_file($absPath) {
  if (!is_file($absPath)) return [];
  $raw = @file_get_contents($absPath);
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

// --- Input ------------------------------------------------------------------

$devId = isset($_GET['device']) ? trim($_GET['device']) : '';
if ($devId === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'missing-device'], JSON_UNESCAPED_SLASHES);
  exit;
}
if (!preg_match('/^dev_[a-f0-9]{12}$/i', $devId)) {
  // Schützt vor Karteileichen/Fehlformaten
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'invalid-device-format'], JSON_UNESCAPED_SLASHES);
  exit;
}

// --- DB & Gerät -------------------------------------------------------------

$db  = devices_load();
$dev = $db['devices'][$devId] ?? null;
if (!$dev) {
  http_response_code(404);
  echo json_encode(['ok'=>false, 'error'=>'device-not-found'], JSON_UNESCAPED_SLASHES);
  exit;
}

// --- Pfade & Basiskonfiguration --------------------------------------------

$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
if ($docRoot === '' || !is_dir($docRoot)) {
  // Fallback, falls PHP-FPM nicht mit korrektem DOCUMENT_ROOT läuft
  $docRoot = rtrim(realpath(__DIR__ . '/../../'), '/');
}

$baseSettings = read_json_file($docRoot . '/data/settings.json');
$baseSchedule = read_json_file($docRoot . '/data/schedule.json');

$overSettings = $dev['overrides']['settings'] ?? [];
if (!is_array($overSettings)) $overSettings = [];

// --- Merge & Versionen ------------------------------------------------------

$mergedSettings = merge_r($baseSettings, $overSettings);

// Version als einfache Cache-Bremse; nimmt höchste bekannte Version
$mergedSettings['version'] = max(
  intval($baseSettings['version'] ?? 0),
  intval($overSettings['version'] ?? 0)
);
$baseSchedule['version'] = intval($baseSchedule['version'] ?? 0);

// --- Antwort ----------------------------------------------------------------

$out = [
  'ok'       => true,
  'device'   => [
    'id'   => $devId,
    'name' => $dev['name'] ?? $devId,
  ],
  'settings' => $mergedSettings,
  'schedule' => $baseSchedule,
  'now'      => time(),
];

echo json_encode($out, JSON_UNESCAPED_SLASHES);
PHP

cat >/var/www/signage/admin/api/devices_begin.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false,'error'=>'method-not-allowed']);
  exit;
}
if (strtolower($_SERVER['HTTP_X_PAIR_REQUEST'] ?? '') !== '1') {
  http_response_code(403);
  echo json_encode(['ok'=>false,'error'=>'forbidden']);
  exit;
}

$db = dev_db_load();
dev_gc($db);

$code = dev_gen_code($db);
if (!$code) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'code-gen']); exit; }

$db['pairings'][$code] = ['code'=>$code, 'created'=>time(), 'deviceId'=>null];
dev_db_save($db);

echo json_encode(['ok'=>true,'code'=>$code]);
PHP

cat >/var/www/signage/admin/api/devices_claim.php <<'PHP'
<?php
// Hängt am ADMIN-VHost (BasicAuth schützt), nicht im öffentlichen /pair/*
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
$code = strtoupper(trim($in['code'] ?? ''));
$name = trim($in['name'] ?? '');

if ($code===''){ echo json_encode(['ok'=>false,'error'=>'no-code']); exit; }

$db = dev_db_load();
$p  = $db['pairings'][$code] ?? null;
if (!$p){ echo json_encode(['ok'=>false,'error'=>'unknown-code']); exit; }
if (!empty($p['deviceId'])){ echo json_encode(['ok'=>true,'deviceId'=>$p['deviceId'], 'already'=>true]); exit; }

$id = dev_gen_id($db);
$db['devices'][$id] = [
  'id'=>$id, 'name'=>$name, 'created'=>time(), 'lastSeen'=>0
];
$db['pairings'][$code]['deviceId'] = $id;
dev_db_save($db);

echo json_encode(['ok'=>true,'deviceId'=>$id]);
PHP

cat >/var/www/signage/admin/api/devices_gc.php <<'PHP'
<?php
// /admin/api/devices_gc.php – aufräumen & reparieren (vollständig)
require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$db = devices_load();
if (!$db) { echo json_encode(['ok'=>false,'error'=>'load-failed']); exit; }

$deletedDevices = 0;
$deletedPairings = 0;

// 1) Ungültige Geräte-IDs entfernen
foreach (($db['devices'] ?? []) as $id => $_) {
 if (!preg_match('/^dev_[a-f0-9]{12}$/i', (string)$id)) {
 unset($db['devices'][$id]);
 $deletedDevices++;
 }
}

// 2) Abgelaufene, nicht gekoppelte Pairings entfernen (>15min)
$now = time();
foreach (($db['pairings'] ?? []) as $code => $row) {
 $age = $now - (int)($row['created'] ?? $now);
 if (empty($row['deviceId']) && $age > 900) {
 unset($db['pairings'][$code]);
 $deletedPairings++;
 }
}

// 3) Beziehungen reparieren: deviceId, die auf nicht-existentes Device zeigt, lösen
foreach (($db['pairings'] ?? []) as $code => $row) {
 $did = $row['deviceId'] ?? null;
 if ($did && empty($db['devices'][$did])) {
 $db['pairings'][$code]['deviceId'] = null;
 }
}

if (!devices_save($db)) { echo json_encode(['ok'=>false,'error'=>'save-failed']); exit; }
echo json_encode(['ok'=>true,'deletedDevices'=>$deletedDevices,'deletedPairings'=>$deletedPairings]);
PHP

cat >/var/www/signage/admin/api/devices_lib.php <<'PHP'
<?php
// admin/api/devices_lib.php
function devices_path() {
  return $_SERVER['DOCUMENT_ROOT'].'/data/devices.json';
}
function devices_load() {
  $p = devices_path();
  if (!file_exists($p)) return ['version'=>1,'devices'=>[],'pairings'=>[]];
  $j = json_decode(file_get_contents($p), true);
  return is_array($j) ? $j : ['version'=>1,'devices'=>[],'pairings'=>[]];
}
function devices_save($data) {
  $p = devices_path();
  $tmp = $p.'.tmp';
  if (!is_dir(dirname($p))) mkdir(dirname($p), 0775, true);
  $ok = file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)) !== false;
  if ($ok) $ok = rename($tmp, $p);
  return $ok;
}
PHP

cat >/var/www/signage/admin/api/devices_list.php <<'PHP'
<?php
// /admin/api/devices_list.php – liefert getrennte Arrays { pairings, devices }
// Warum: Die Admin-UI erwartet dieses Format; gemischte Ausgabe verursachte
// "undefined"-Einträge & fehlschlagendes Löschen.

require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$db = devices_load();
$now = time();

$pairings = [];
foreach (($db['pairings'] ?? []) as $code => $row) {
 if (!empty($row['deviceId'])) continue; // nur offene Codes anzeigen
 $created = (int)($row['created'] ?? 0);
 $pairings[] = [
 'code' => $row['code'] ?? $code,
 'createdAt' => $created,
 'expiresAt' => $created ? ($created + 900) : null
 ];
}
usort($pairings, fn($a,$b)=>($b['createdAt']??0)-($a['createdAt']??0));

$devices = [];
foreach (($db['devices'] ?? []) as $id => $d) {
 $devices[] = [
 'id' => $id,
 'name' => $d['name'] ?? $id,
 'lastSeenAt' => (int)($d['lastSeen'] ?? 0) ?: null,
 'overrides' => [ 'settings' => $d['overrides']['settings'] ?? (object)[] ]
 ];
}

echo json_encode(['ok'=>true, 'pairings'=>$pairings, 'devices'=>$devices], JSON_UNESCAPED_SLASHES);
PHP

cat >/var/www/signage/admin/api/devices_pair.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
require __DIR__.'/devices_lib.php';
$raw = file_get_contents('php://input'); $j = json_decode($raw,true) ?: [];
$code = trim($j['code'] ?? '');
$name = trim($j['name'] ?? '');
if ($code==='' || $name===''){ echo json_encode(['ok'=>false,'error'=>'missing']); exit; }
$db = dev_load();
$d =& dev_find_by_code($db, $code);
if (!$d){ echo json_encode(['ok'=>false,'error'=>'not-found']); exit; }
if (!empty($d['paired'])){ echo json_encode(['ok'=>false,'error'=>'already']); exit; }
$id = dev_newid('dev_');
$d['id'] = $id;
$d['name'] = $name;
$d['paired'] = true;
$d['code'] = null;
$d['overrides'] = ['settings'=>new stdClass()]; // Platzhalter
dev_save($db);
echo json_encode(['ok'=>true,'deviceId'=>$id,'url'=>'/?device='.$id]);
PHP

cat >/var/www/signage/admin/api/devices_pending.php <<'PHP'
<?php
require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');

$state = devices_load(); // liest /var/www/signage/data/devices.json
$pending = [];
if (!empty($state['pending']) && is_array($state['pending'])) {
  foreach ($state['pending'] as $code => $info) {
    $pending[] = ['code'=>$code, 'ts'=>$info['ts'] ?? null, 'ip'=>$info['ip'] ?? null];
  }
}
echo json_encode(['ok'=>true,'pending'=>$pending], JSON_UNESCAPED_SLASHES);
PHP

cat >/var/www/signage/admin/api/devices_poll.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$code = isset($_GET['code']) ? strtoupper(preg_replace('/[^A-Z0-9]/','',$_GET['code'])) : '';
if ($code===''){ echo json_encode(['ok'=>false,'error'=>'no-code']); exit; }

$db = dev_db_load();
$p = $db['pairings'][$code] ?? null;
if (!$p){ echo json_encode(['ok'=>true,'paired'=>false,'exists'=>false]); exit; }

if (!empty($p['deviceId'])){
  echo json_encode(['ok'=>true,'paired'=>true,'deviceId'=>$p['deviceId']]); exit;
}
echo json_encode(['ok'=>true,'paired'=>false,'exists'=>true]);
PHP

cat >/var/www/signage/admin/api/devices_save_override.php <<'PHP'
<?php
require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
if (!$in || !isset($in['device']) || !is_array($in['settings'])) {
  echo json_encode(['ok'=>false, 'error'=>'missing']); exit;
}
$devId = $in['device'];
$set   = $in['settings'];

$dev = devices_load();
if (!isset($dev['devices'][$devId])) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']); exit;
}

// Version hochzählen (Signal für Clients)
$set['version'] = intval($set['version'] ?? 0) + 1;

$dev['devices'][$devId]['overrides'] = $dev['devices'][$devId]['overrides'] ?? [];
$dev['devices'][$devId]['overrides']['settings'] = $set;

if (!devices_save($dev)) {
  echo json_encode(['ok'=>false, 'error'=>'write-failed']); exit;
}
echo json_encode(['ok'=>true, 'version'=>$set['version']]);
PHP

cat >/var/www/signage/admin/api/devices_status.php <<'PHP'
<?php
// /var/www/signage/admin/api/devices_status.php
header('Content-Type: application/json; charset=UTF-8');

$fn = __DIR__ . '/../../data/devices.json';
$state = json_decode(@file_get_contents($fn), true);
if (!$state) $state = ['version'=>1, 'devices'=>[], 'pairings'=>[]];

$pairings = array_values($state['pairings'] ?? []);
// neuestes NICHT beanspruchtes Pairing finden
$open = null;
foreach ($pairings as $p) {
  if (empty($p['deviceId'])) {
    if ($open === null || (int)$p['created'] > (int)$open['created']) $open = $p;
  }
}

$devices = array_values($state['devices'] ?? []);
echo json_encode([
  'ok' => true,
  'now' => time(),
  'openPairing' => $open,   // {code, created} oder null
  'devices' => $devices     // [{id,name,created,lastSeen}, ...]
]);
PHP

cat >/var/www/signage/admin/api/load.php <<'PHP'
<?php
// /admin/api/devices_store.php – vollständige Helfer (ohne Platzhalter)
// Warum: Wird von /pair/* Endpunkten und Admin-API geteilt; zentrale, robuste Umsetzung.

const DEV_DB = '/var/www/signage/data/devices.json';

function dev_db_load(){
 if (!is_file(DEV_DB)) return ['version'=>1,'pairings'=>[],'devices'=>[]];
 $j = json_decode(@file_get_contents(DEV_DB), true);
 return is_array($j) ? $j : ['version'=>1,'pairings'=>[],'devices'=>[]];
}

function dev_db_save($db){
 @mkdir(dirname(DEV_DB), 02775, true);
 file_put_contents(DEV_DB, json_encode($db, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
 @chmod(DEV_DB, 0644);
 @chown(DEV_DB,'www-data'); @chgrp(DEV_DB,'www-data');
}

// Koppel-Code (AAAAAA) aus A–Z (ohne I/O) generieren; keine Speicherung hier
function dev_gen_code($db){
 $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
 for ($i=0; $i<500; $i++) {
 $code = '';
 for ($j=0; $j<6; $j++) $code .= $alphabet[random_int(0, strlen($alphabet)-1)];
 if (empty($db['pairings'][$code])) return $code;
 }
 return null;
}

// Geräte-ID im Format dev_ + 12 hex (Regex im Player erwartet exakt das)
function dev_gen_id($db){
 for ($i=0; $i<1000; $i++) {
 $id = 'dev_'.bin2hex(random_bytes(6));
 if (empty($db['devices'][$id])) return $id;
 }
 return null;
}

// Aufräumen: offene Pairings >15min löschen; verwaiste Links bereinigen
function dev_gc(&$db){
 $now = time();
 foreach (($db['pairings'] ?? []) as $code => $p) {
 $age = $now - (int)($p['created'] ?? $now);
 if ($age > 900 && empty($p['deviceId'])) unset($db['pairings'][$code]);
 // Referenz auf nicht-existentes Device? -> lösen
 if (!empty($p['deviceId']) && empty($db['devices'][$p['deviceId']])) {
 $db['pairings'][$code]['deviceId'] = null;
 }
 }
}
PHP

cat >/var/www/signage/admin/api/devices_touch.php <<'PHP'
<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$id = isset($_GET['device']) ? $_GET['device'] : '';
if ($id===''){ echo json_encode(['ok'=>false,'error'=>'no-device']); exit; }

$db = dev_db_load();
if (!isset($db['devices'][$id])){ echo json_encode(['ok'=>false,'error'=>'unknown-device']); exit; }
$db['devices'][$id]['lastSeen'] = time();
dev_db_save($db);
echo json_encode(['ok'=>true]);
PHP

cat >/var/www/signage/admin/api/devices_unpair.php <<'PHP'
<?php
require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$body  = json_decode(file_get_contents('php://input'), true) ?: [];
$didIn = trim((string)($body['device'] ?? ''));
$purge = !empty($body['purge']);

$db = devices_load();
if (!$db) { echo json_encode(['ok'=>false,'error'=>'load-failed']); exit; }

$validNew = function($id){ return is_string($id) && preg_match('/^dev_[a-f0-9]{12}$/i', $id); };

// exakte Übereinstimmung (neues Format) …
$foundKey = isset($db['devices'][$didIn]) ? $didIn : null;

// … oder Legacy: numerische Schlüssel als String ("0","1",…)
if ($foundKey === null) {
  $legacyKey = (string)intval($didIn);
  if (isset($db['devices'][$legacyKey])) $foundKey = $legacyKey;
}

if ($foundKey === null) { echo json_encode(['ok'=>false,'error'=>'unknown-device']); exit; }

// Pairings entkoppeln
if (!empty($db['pairings'])) {
  foreach ($db['pairings'] as $code => &$row) {
    if (($row['deviceId'] ?? null) === $foundKey) unset($row['deviceId']);
  }
  unset($row);
}

// Purge: Gerätseintrag ganz weg, sonst nur Overrides löschen
if ($purge) { unset($db['devices'][$foundKey]); }
else {
  if (isset($db['devices'][$foundKey]['overrides'])) unset($db['devices'][$foundKey]['overrides']);
}

if (!devices_save($db)) { echo json_encode(['ok'=>false,'error'=>'save-failed']); exit; }
echo json_encode(['ok'=>true,'device'=>$foundKey,'removed'=>$purge?1:0]);
PHP

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
    'bg'=>'#E8DEBD','fg'=>'#5C3101','accent'=>'#5C3101',
    'gridBorder'=>'#5C3101','gridTable'=>'#5C3101','gridTableW'=>2,
    'cellBg'=>'#5C3101','boxFg'=>'#FFFFFF',
    'headRowBg'=>'#E8DEBD','headRowFg'=>'#5C3101',
    'timeColBg'=>'#E8DEBD','timeZebra1'=>'#EAD9A0','timeZebra2'=>'#E2CE91',
    'zebra1'=>'#EDDFAF','zebra2'=>'#E6D6A1',
    'cornerBg'=>'#E8DEBD','cornerFg'=>'#5C3101',
    'tileBorder'=>'#5C3101','chipBorder'=>'#5C3101','chipBorderW'=>2,
    'flame'=>'#FFD166','saunaColor'=>'#5C3101'
  ],
  'fonts'=>[
    'family'=>"-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
    'scale'=>1, 'h1Scale'=>1, 'h2Scale'=>1,
    'overviewTitleScale'=>1, 'overviewHeadScale'=>0.9, 'overviewCellScale'=>0.8,
    'tileTextScale'=>0.8, 'tileWeight'=>600, 'chipHeight'=>44,
    'chipOverflowMode'=>'scale','flamePct'=>55,'flameGapPx'=>6
  ],
  'h2'=>['mode'=>'text','text'=>'Aufgusszeiten','showOnOverview'=>true],
  'display'=>['fit'=>'cover','rightWidthPercent'=>38,'cutTopPercent'=>28,'cutBottomPercent'=>12],
  'slides'=>[
    'overviewDurationSec'=>10,'saunaDurationSec'=>6,'transitionMs'=>500,
    'tileWidthPercent'=>45,'tileMinPx'=>480,'tileMaxPx'=>1100,
    'durationMode'=>'uniform','globalDwellSec'=>6,'loop'=>true,
    'order'=>['overview']
  ],
  'assets'=>['rightImages'=>[], 'flameImage'=>'/assets/img/flame_test.svg'],
  'footnotes'=>[ ['id'=>'star','label'=>'*','text'=>'Nur am Fr und Sa'] ],
  'interstitials'=>[],
  'presets'=>[],
  'presetAuto'=>false
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
cat >/var/www/signage/admin/api/import.php <<'PHP'
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
if (!$settings && !$schedule) fail('missing-sections');

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


# --- Final: saubere Ownership & Rechte im Webroot ---
chown -R www-data:www-data "$WEBROOT"

# Verzeichnisse setgid + gruppenschreibbar, Dateien 0644
find "$WEBROOT" -type d -exec chmod 2775 {} +
find "$WEBROOT" -type f -exec chmod 0644 {} +

# PHP-Skripte sicherstellen (falls Shell-Globs mal nicht trafen)
find "$WEBROOT/admin/api" -type f -name '*.php' -exec chmod 0644 {} +


# ---------------------------
# Nginx vHosts
# ---------------------------
PHP_SOCK=$(ls /run/php/php*-fpm.sock 2>/dev/null | head -n1 || echo /run/php/php8.3-fpm.sock)

cat >/etc/nginx/snippets/signage-pairing.conf <<'EOF'
# /etc/nginx/snippets/signage-pairing.conf
# Pairing/Device-API – ohne Auth, gleicher Origin (auf :80 und :8888 nutzbar)

location = /pair/begin {
  auth_basic off;
  add_header X-Pair "begin" always;
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/signage/admin/api/devices_begin.php;
  fastcgi_param SCRIPT_NAME     /admin/api/devices_begin.php;
  fastcgi_pass unix:__PHP_SOCK__;
}

location = /pair/poll {
  auth_basic off;
  add_header X-Pair "poll" always;
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/signage/admin/api/devices_poll.php;
  fastcgi_param SCRIPT_NAME     /admin/api/devices_poll.php;
  fastcgi_pass unix:__PHP_SOCK__;
}

location = /pair/touch {
  auth_basic off;
  add_header X-Pair "touch" always;
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/signage/admin/api/devices_touch.php;
  fastcgi_param SCRIPT_NAME     /admin/api/devices_touch.php;
  fastcgi_pass unix:__PHP_SOCK__;
}

location = /pair/resolve {
  auth_basic off;
  add_header X-Pair "resolve" always;
  include fastcgi_params;
  fastcgi_param SCRIPT_FILENAME /var/www/signage/admin/api/device_resolve.php;
  fastcgi_param SCRIPT_NAME     /admin/api/device_resolve.php;
  fastcgi_pass unix:__PHP_SOCK__;
}
EOF


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
# Pairing/Device-API – ohne Auth, gleicher Origin (Port 80)
include /etc/nginx/snippets/signage-pairing.conf;
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
    fastcgi_pass unix:__PHP_SOCK__;
  }
location ^~ /data/ {
  add_header Cache-Control "no-store, must-revalidate" always;
  auth_basic off;                       # WICHTIG: ohne Login
  try_files $uri =404;
}
include /etc/nginx/snippets/signage-pairing.conf;
}
NGINX

# Variablen haben Defaults – zusätzlich exportieren schadet nicht
export SIGNAGE_PUBLIC_PORT SIGNAGE_ADMIN_PORT

# Platzhalter ersetzen
sed -i "s/__PUBLIC_PORT__/${SIGNAGE_PUBLIC_PORT}/g" /etc/nginx/sites-available/signage-slideshow.conf
sed -i "s/__ADMIN_PORT__/${SIGNAGE_ADMIN_PORT}/g"   /etc/nginx/sites-available/signage-admin.conf
sed -i "s|__PHP_SOCK__|${PHP_SOCK}|g"               /etc/nginx/sites-available/signage-admin.conf
sed -i "s|__PHP_SOCK__|${PHP_SOCK}|g"               /etc/nginx/snippets/signage-pairing.conf

# Safety-Check: sind noch Platzhalter in den Nginx-Configs?
if grep -R -q "__ADMIN_PORT__\|__PUBLIC_PORT__\|__PHP_SOCK__" /etc/nginx/sites-available; then
  err "Nginx-Konfiguration enthält noch Platzhalter. Ersetzungen prüfen."
fi

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





















