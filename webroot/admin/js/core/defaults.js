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
  overviewTimeWidthCh:10,
  overviewShowFlames:true,
  tileTextScale:0.8, tileWeight:600, chipHeight:1,
  tileMetaScale:1,
  chipOverflowMode:'scale', flamePct:55, flameGapScale:0.14
};

const DEFAULT_ENABLED_COMPONENTS = {
  title:true,
  description:true,
  badges:true
};

const DEFAULT_BADGE_LIBRARY = [
  { id:'bdg_classic', icon:'🌿', label:'Klassisch' },
  { id:'bdg_event', icon:'⭐', label:'Event' },
  { id:'bdg_ritual', icon:'🔥', label:'Ritual' }
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
      tileMetaScale:DEFAULT_FONTS.tileMetaScale,
      chipOverflowMode:DEFAULT_FONTS.chipOverflowMode,
      overviewTimeWidthCh:DEFAULT_FONTS.overviewTimeWidthCh,
      overviewShowFlames:DEFAULT_FONTS.overviewShowFlames,
      flamePct:DEFAULT_FONTS.flamePct,
      flameGapScale:DEFAULT_FONTS.flameGapScale
    },
    slides:{
      infobadgeColor:'#5C3101',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
      badgeScale:1,
      badgeDescriptionScale:1,
      tilePaddingScale:0.75,
      tileFlameSizeScale:1,
      tileFlameGapScale:1,
      saunaTitleMaxWidthPercent:100
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
      tileMetaScale:DEFAULT_FONTS.tileMetaScale,
      overviewTimeWidthCh:DEFAULT_FONTS.overviewTimeWidthCh,
      overviewShowFlames:DEFAULT_FONTS.overviewShowFlames,
      chipOverflowMode:'scale',
      flamePct:60,
      flameGapScale:0.16
    },
    slides:{
      infobadgeColor:'#4EA8DE',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
      badgeScale:1,
      badgeDescriptionScale:1,
      tilePaddingScale:0.75,
      tileFlameSizeScale:1,
      tileFlameGapScale:1,
      saunaTitleMaxWidthPercent:100
    }
  },
  sunset:{
    label:'Sunset Glow',
    theme:{
      bg:'#2B1A3F', fg:'#FFE7D9', accent:'#FF914D',
      gridBorder:'#3D2556',
      gridTable:'#3D2556', gridTableW:2,
      cellBg:'#3F285B', boxFg:'#FFE7D9',
      headRowBg:'#341F4B', headRowFg:'#FFE7D9',
      timeColBg:'#2F1C46', timeZebra1:'#3B2555', timeZebra2:'#27163B',
      zebra1:'#462C63', zebra2:'#2E1A42',
      cornerBg:'#2F1C46', cornerFg:'#FFE7D9',
      tileBorder:'#FF914D', tileBorderW:3,
      chipBorder:'#FF914D', chipBorderW:2,
      flame:'#FFB347',
      saunaColor:'#FF914D'
    },
    fonts:{
      family:"'Poppins', 'Montserrat', system-ui, sans-serif",
      tileTextScale:0.84,
      tileWeight:600,
      chipHeight:1.05,
      tileMetaScale:DEFAULT_FONTS.tileMetaScale,
      overviewTimeWidthCh:DEFAULT_FONTS.overviewTimeWidthCh,
      overviewShowFlames:true,
      chipOverflowMode:'scale',
      flamePct:58,
      flameGapScale:0.15
    },
    slides:{
      infobadgeColor:'#FF914D',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
      badgeScale:1,
      badgeDescriptionScale:1,
      tilePaddingScale:0.78,
      tileFlameSizeScale:1.05,
      tileFlameGapScale:1,
      saunaTitleMaxWidthPercent:100
    }
  },
  midnight:{
    label:'Midnight Calm',
    theme:{
      bg:'#050913', fg:'#E6F1FF', accent:'#4F7BFF',
      gridBorder:'#0F1A33',
      gridTable:'#101B37', gridTableW:2,
      cellBg:'#0E172C', boxFg:'#E6F1FF',
      headRowBg:'#0B1324', headRowFg:'#E6F1FF',
      timeColBg:'#0B1324', timeZebra1:'#101A31', timeZebra2:'#09101F',
      zebra1:'#0F1B33', zebra2:'#091327',
      cornerBg:'#0B1324', cornerFg:'#E6F1FF',
      tileBorder:'#4F7BFF', tileBorderW:3,
      chipBorder:'#4F7BFF', chipBorderW:2,
      flame:'#7CB8FF',
      saunaColor:'#4F7BFF'
    },
    fonts:{
      family:"'IBM Plex Sans', system-ui, sans-serif",
      tileTextScale:0.88,
      tileWeight:500,
      chipHeight:1,
      tileMetaScale:0.95,
      overviewTimeWidthCh:DEFAULT_FONTS.overviewTimeWidthCh,
      overviewShowFlames:false,
      chipOverflowMode:'scale',
      flamePct:64,
      flameGapScale:0.18
    },
    slides:{
      infobadgeColor:'#4F7BFF',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
      badgeScale:1,
      badgeDescriptionScale:1,
      tilePaddingScale:0.72,
      tileFlameSizeScale:0.92,
      tileFlameGapScale:1,
      saunaTitleMaxWidthPercent:90
    }
  },
  celebration:{
    label:'Event Highlight',
    theme:{
      bg:'#1A1A1A', fg:'#FDF6E3', accent:'#FFCD3C',
      gridBorder:'#2A2A2A',
      gridTable:'#2A2A2A', gridTableW:3,
      cellBg:'#222222', boxFg:'#FDF6E3',
      headRowBg:'#101010', headRowFg:'#FFCD3C',
      timeColBg:'#101010', timeZebra1:'#1C1C1C', timeZebra2:'#121212',
      zebra1:'#252525', zebra2:'#1B1B1B',
      cornerBg:'#101010', cornerFg:'#FFCD3C',
      tileBorder:'#FFCD3C', tileBorderW:4,
      chipBorder:'#FFCD3C', chipBorderW:3,
      flame:'#FF6B3C',
      saunaColor:'#FFCD3C'
    },
    fonts:{
      family:"'Source Sans Pro', system-ui, sans-serif",
      tileTextScale:0.9,
      tileWeight:700,
      chipHeight:1.12,
      tileMetaScale:1,
      overviewTimeWidthCh:11,
      overviewShowFlames:true,
      chipOverflowMode:'scroll',
      flamePct:70,
      flameGapScale:0.2
    },
    slides:{
      infobadgeColor:'#FFCD3C',
      badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
      badgeScale:1.05,
      badgeDescriptionScale:1.05,
      tilePaddingScale:0.82,
      tileFlameSizeScale:1.1,
      tileFlameGapScale:1.05,
      saunaTitleMaxWidthPercent:100
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
    tileHeightScale:1,
    tilePaddingScale:0.75,
    appendTimeSuffix:false,
    tileFlameSizeScale:1,
    tileFlameGapScale:1,
    saunaTitleMaxWidthPercent:100,
    tileOverlayEnabled:true,
    tileOverlayStrength:1,
    showSaunaFlames:true,
    badgeInlineColumn:false,
    infobadgeColor:'#5C3101',
    badgeLibrary: JSON.parse(JSON.stringify(DEFAULT_BADGE_LIBRARY)),
    badgeScale:1,
    badgeDescriptionScale:1,
    heroEnabled:false,
    heroTimelineFillMs:8000,
    heroTimelineBaseMinutes:15,
    heroTimelineMaxEntries:null,
    enabledComponents:{ ...DEFAULT_ENABLED_COMPONENTS },
    styleSets:{ ...DEFAULT_STYLE_SETS },
    activeStyleSet:'classic',
    styleAutomation:{
      enabled:true,
      fallbackStyle:'classic',
      timeSlots:[
        { id:'morning', label:'Vormittag', mode:'daily', start:'06:00', style:'classic' },
        { id:'evening', label:'Abend', mode:'daily', start:'18:00', style:'sunset' },
        { id:'night', label:'Nacht', mode:'daily', start:'21:30', style:'midnight' }
      ]
    }
  },
  display:{
    fit:'auto',
    baseW:1920,
    baseH:1080,
    rightWidthPercent:38,
    cutTopPercent:28,
    cutBottomPercent:12,
    layoutMode:'single',
    layoutProfile:'landscape',
    pages:{
      left:{
        source:'master',
        timerSec:null,
        contentTypes:['overview','sauna','hero-timeline','story','wellness-tip','event-countdown','gastronomy-highlight','image','video','url'],
        playlist:[]
      },
      right:{
        source:'media',
        timerSec:null,
        contentTypes:['wellness-tip','event-countdown','gastronomy-highlight','image','video','url'],
        playlist:[]
      }
    }
  },
  theme:{ ...DEFAULT_THEME },
  highlightNext:{ enabled:false, color:'#FFDD66', minutesBeforeNext:15, minutesAfterStart:15 },
  fonts:{ ...DEFAULT_FONTS },
  h2:{ mode:'text', text:'Aufgusszeiten', showOnOverview:true },
  assets:{ flameImage:'/assets/img/flame_test.svg' },
  footnotes:[ { id:'star', label:'*', text:'Nur am Fr und Sa' } ],
  extras:{
    wellnessTips:[
      { id:'wellness_hydrate', icon:'💧', title:'Hydration', text:'Vor und nach dem Saunagang ausreichend Wasser trinken.', dwellSec: null },
      { id:'wellness_cooldown', icon:'❄️', title:'Abkühlen', text:'Zwischen den Gängen an die frische Luft gehen und kalt abduschen.', dwellSec: null }
    ],
    eventCountdowns:[
      { id:'event_moonlight', title:'Moonlight-Special', subtitle:'Heute Abend', target:'2024-12-24T20:00', style:'celebration', dwellSec: null }
    ],
    gastronomyHighlights:[
      { id:'bar_vital', title:'Vital-Bar', description:'Hausgemachtes Ingwerwasser und frische Obstspieße im Ruhebereich.', dwellSec: null }
    ]
  }
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
