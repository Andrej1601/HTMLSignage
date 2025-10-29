export const clampNumber = (min, val, max) => Math.min(Math.max(val, min), max);

export const OVERVIEW_TIME_BASE_CH = 10;
export const OVERVIEW_TIME_SCALE_MIN = 0.5;
export const OVERVIEW_TIME_SCALE_MAX = 3;

export const HEADING_WIDTH_INPUT_MIN = 10;
export const HEADING_WIDTH_INPUT_MAX = 100;
export const HEADING_WIDTH_ACTUAL_MIN = 10;
export const HEADING_WIDTH_ACTUAL_MAX = 160;
export const HEADING_WIDTH_INPUT_SPAN = HEADING_WIDTH_INPUT_MAX - HEADING_WIDTH_INPUT_MIN;
export const HEADING_WIDTH_ACTUAL_SPAN = HEADING_WIDTH_ACTUAL_MAX - HEADING_WIDTH_ACTUAL_MIN;
export const HEADING_WIDTH_RATIO = HEADING_WIDTH_ACTUAL_SPAN / HEADING_WIDTH_INPUT_SPAN;

export const resolveHeadingWidthPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 100;
  if (num > HEADING_WIDTH_INPUT_MAX) {
    return clampNumber(HEADING_WIDTH_ACTUAL_MIN, num, HEADING_WIDTH_ACTUAL_MAX);
  }
  const clamped = clampNumber(HEADING_WIDTH_INPUT_MIN, num, HEADING_WIDTH_INPUT_MAX);
  return HEADING_WIDTH_ACTUAL_MIN + (clamped - HEADING_WIDTH_INPUT_MIN) * HEADING_WIDTH_RATIO;
};

export const STYLE_THEME_KEYS = [
  'bg','fg','accent','gridBorder','gridTable','gridTableW','cellBg','boxFg','headRowBg','headRowFg',
  'timeColBg','timeZebra1','timeZebra2','zebra1','zebra2','cornerBg','cornerFg','tileBorder','tileBorderW',
  'chipBorder','chipBorderW','flame','saunaColor'
];

export const STYLE_FONT_KEYS = [
  'family','tileTextScale','tileWeight','chipHeight','chipOverflowMode','flamePct','flameGapScale',
  'tileMetaScale','tileTimeScale','overviewTimeWidthScale','overviewShowFlames','overviewTitleScale','overviewHeadScale',
  'overviewCellScale','h1Scale','h2Scale'
];

export const STYLE_SLIDE_KEYS = [
  'infobadgeColor','badgeLibrary','badgeScale','badgeDescriptionScale',
  'tileHeightScale','tilePaddingScale','tileOverlayEnabled','tileOverlayStrength','badgeInlineColumn',
  'tileFlameSizeScale','tileFlameGapScale','saunaTitleMaxWidthPercent','appendTimeSuffix','heroTimelineItemMs',
  'heroTimelineItemDelayMs','heroTimelineFillMs','heroTimelineDelayMs','tileEnterMs','tileStaggerMs','showSaunaFlames'
];

export const LAYOUT_PROFILES = new Set([
  'landscape',
  'portrait-split',
  'triple',
  'asymmetric',
  'info-panel'
]);

export const LIVE_RETRY_BASE_DELAY = 2000;
export const LIVE_RETRY_MAX_DELAY = 60000;
export const LIVE_RETRY_MAX_ATTEMPTS = 5;
