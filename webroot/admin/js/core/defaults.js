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
