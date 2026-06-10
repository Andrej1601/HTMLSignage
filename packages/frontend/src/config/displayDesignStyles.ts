import type {
  DesignStyle,
  DisplayAppearance,
  SaunaDetailStyle,
} from '@/types/settings.types';

// Aurora Thermal — the production-flagship default. Warm charcoal stage
// with polished brass accents, rendered by the `aurora-thermal` design
// pack. Picks up all three SchedulePanel variants + sauna-detail variants.
export const AURORA_THERMAL_DISPLAY_APPEARANCE: DisplayAppearance = 'aurora-thermal';
export const DEFAULT_DISPLAY_APPEARANCE: DisplayAppearance = AURORA_THERMAL_DISPLAY_APPEARANCE;
export const WELLNESS_STAGE_DISPLAY_APPEARANCE: DisplayAppearance = 'wellness-stage';
export const EDITORIAL_DISPLAY_APPEARANCE: DisplayAppearance = 'editorial-resort';
export const MINERAL_NOIR_DISPLAY_APPEARANCE: DisplayAppearance = 'mineral-noir';

export interface ScheduleDesignStyleOption {
  id: DesignStyle;
  title: string;
  description: string;
}

export const SCHEDULE_DESIGN_STYLE_OPTIONS: ScheduleDesignStyleOption[] = [
  {
    id: 'modern-wellness',
    title: 'Modern Wellness Grid',
    description: 'Klassisches Wellness-Grid mit Saunakacheln.',
  },
  {
    id: 'modern-timeline',
    title: 'Modern Timeline',
    description: 'Zeitachsen-Layout mit Timeline-Tabelle.',
  },
  {
    id: 'compact-tiles',
    title: 'Chronologische Liste',
    description: 'Alle Aufgüsse aller Saunas in einer gemeinsamen Zeitleiste.',
  },
];

export const MODERN_SCHEDULE_DESIGN_STYLES: readonly DesignStyle[] =
  SCHEDULE_DESIGN_STYLE_OPTIONS.map((style) => style.id);

export interface SaunaDetailStyleOption {
  id: SaunaDetailStyle;
  title: string;
  description: string;
}

export const DEFAULT_SAUNA_DETAIL_STYLE: SaunaDetailStyle = 'split';

export const SAUNA_DETAIL_STYLE_OPTIONS: SaunaDetailStyleOption[] = [
  {
    id: 'split',
    title: 'Split',
    description: 'Bild links, kompletter Aufguss-Verlauf rechts — Standard-Fokus.',
  },
  {
    id: 'hero',
    title: 'Hero',
    description: 'Großes Bild als Bühne, Name und aktueller Aufguss als Overlay-Karte.',
  },
  {
    id: 'portrait',
    title: 'Portrait',
    description: 'Bild oben, Infos + Aufguss-Liste darunter. Ideal für hochformatige Zonen.',
  },
];

export function isKnownSaunaDetailStyle(value: string | undefined): value is SaunaDetailStyle {
  return SAUNA_DETAIL_STYLE_OPTIONS.some((option) => option.id === value);
}

export function isModernScheduleDesignStyleValue(
  designStyle: string | undefined,
): designStyle is DesignStyle {
  return MODERN_SCHEDULE_DESIGN_STYLES.includes(designStyle as DesignStyle);
}

/**
 * Human-readable label for a stored `displayAppearance`. Used by the
 * dashboard activity feed to surface settings changes from the legacy
 * appearance era; the constant values are still recognised so older
 * records render with a sensible label.
 */
export function getDisplayAppearanceLabel(displayAppearance: string | undefined): string {
  switch (displayAppearance) {
    case AURORA_THERMAL_DISPLAY_APPEARANCE: return 'Aurora Thermal';
    case WELLNESS_STAGE_DISPLAY_APPEARANCE: return 'Wellness Stage';
    case EDITORIAL_DISPLAY_APPEARANCE: return 'Editorial Resort';
    case MINERAL_NOIR_DISPLAY_APPEARANCE: return 'Mineral Noir';
    default: return 'Aurora Thermal';
  }
}

export function getScheduleDesignStyleLabel(designStyle: string | undefined): string {
  return (
    SCHEDULE_DESIGN_STYLE_OPTIONS.find((style) => style.id === designStyle)?.title ||
    SCHEDULE_DESIGN_STYLE_OPTIONS[0].title
  );
}
