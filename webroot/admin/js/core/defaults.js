// /admin/js/core/defaults.js
// DEFAULTS + Wochentags-Helfer als Single Source of Truth
const DEFAULT_THEME = {
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
};

const DEFAULT_FONTS = {
  family:"system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
  scale:1, h1Scale:1, h2Scale:1,
  overviewTitleScale:1, overviewHeadScale:0.9, overviewCellScale:0.8,
  tileTextScale:0.8, tileWeight:600, chipHeight:1,
  chipOverflowMode:'scale', flamePct:55, flameGapScale:0.14
};

const DEFAULT_ENABLED_COMPONENTS = {
  title:true,
  description:true,
  aromas:true,
  facts:true,
  badges:true
};

const DEFAULT_BADGE_LIBRARY = [
  { id:'bdg_classic', icon:'🌿', label:'Klassisch', imageUrl:'', iconUrl:'', presetKey:'classic' },
  { id:'bdg_event', icon:'⭐', label:'Event', imageUrl:'', iconUrl:'', presetKey:'event' },
  { id:'bdg_ritual', icon:'🔥', label:'Ritual', imageUrl:'', iconUrl:'', presetKey:'ritual' }
];

const DEFAULT_STYLE_SETS = {
  classic:{
    label:'Klassisch',
    theme:{ ...DEFAULT_THEME },
    fonts:{
      family:DEFAULT_FONTS.family,
      tileTextScale:DEFAULT_FONTS.tileTextScale,
      tileWeight:DEFAULT_FONTS.tileWeight,
      chipHeight:DEFAULT_FONTS.chipHeight,
      chipOverflowMode:DEFAULT_FONTS.chipOverflowMode,
      flamePct:DEFAULT_FONTS.flamePct,
      flameGapScale:DEFAULT_FONTS.flameGapScale
    },
    slides:{
      infobadgeColor:'#5C3101',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY))
    }
  },
  fresh:{
    label:'Frisch & Modern',
    theme:{
      bg:'#0F172A', fg:'#F4F6FF', accent:'#4EA8DE',
      gridBorder:'#1E2A4A',
      gridTable:'#1E2A4A', gridTableW:2,
      cellBg:'#1B2542', boxFg:'#F4F6FF',
      headRowBg:'#131D36', headRowFg:'#F4F6FF',
      timeColBg:'#131D36', timeZebra1:'#1C2747', timeZebra2:'#15203A',
      zebra1:'#1F2B4D', zebra2:'#18233F',
      cornerBg:'#131D36', cornerFg:'#F4F6FF',
      tileBorder:'#4EA8DE', tileBorderW:3,
      chipBorder:'#4EA8DE', chipBorderW:2,
      flame:'#FFB703',
      saunaColor:'#4EA8DE'
    },
    fonts:{
      family:"'Montserrat', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      tileTextScale:0.86,
      tileWeight:600,
      chipHeight:1.05,
      chipOverflowMode:'scale',
      flamePct:60,
      flameGapScale:0.16
    },
    slides:{
      infobadgeColor:'#4EA8DE',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY))
    }
  }
};

export const DEFAULTS = {
  slides:{
    overviewDurationSec:10,
    saunaDurationSec:6,
    transitionMs:500,
    tileWidthPercent:45,
    tileMinScale:0.25,
    tileMaxScale:0.57,
    infobadgeColor:'#5C3101',
    badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
    heroEnabled:false,
    heroTimelineFillMs:8000,
    heroTimelineBaseMinutes:15,
    heroTimelineMaxEntries:null,
    enabledComponents:{ ...DEFAULT_ENABLED_COMPONENTS },
    styleSets:{ ...DEFAULT_STYLE_SETS },
    activeStyleSet:'classic'
  },
  display:{ fit:'auto', baseW:1920, baseH:1080, rightWidthPercent:38, cutTopPercent:28, cutBottomPercent:12 },
  theme:{ ...DEFAULT_THEME },
  highlightNext:{ enabled:false, color:'#FFDD66', minutesBeforeNext:15, minutesAfterStart:15 },
  fonts:{ ...DEFAULT_FONTS },
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
