import type { DesignStyle, DisplayAppearance } from '@/types/settings.types';

export const DEFAULT_DISPLAY_APPEARANCE: DisplayAppearance = 'wellness-stage';
export const EDITORIAL_DISPLAY_APPEARANCE: DisplayAppearance = 'editorial-resort';
export const MINERAL_NOIR_DISPLAY_APPEARANCE: DisplayAppearance = 'mineral-noir';

export interface DisplayAppearanceOption {
  id: DisplayAppearance;
  title: string;
  description: string;
}

export interface ScheduleDesignStyleOption {
  id: DesignStyle;
  title: string;
  description: string;
}

export const DISPLAY_APPEARANCE_OPTIONS: DisplayAppearanceOption[] = [
  {
    id: DEFAULT_DISPLAY_APPEARANCE,
    title: 'Wellness Stage',
    description: 'Ruhige moderne Bühne mit klassischer Wellness-Anmutung.',
  },
  {
    id: EDITORIAL_DISPLAY_APPEARANCE,
    title: 'Editorial Resort',
    description: 'Inszenierte Resort-Bühne mit Karten, Lichtflächen und Magazin-Look.',
  },
  {
    id: MINERAL_NOIR_DISPLAY_APPEARANCE,
    title: 'Mineral Noir',
    description: 'Architektonischer Dark-Luxus — kühles Schiefer, Platin-Typografie, kein Schnörkel.',
  },
];

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

export function isModernScheduleDesignStyleValue(
  designStyle: string | undefined,
): designStyle is DesignStyle {
  return MODERN_SCHEDULE_DESIGN_STYLES.includes(designStyle as DesignStyle);
}

export function isEditorialDisplayAppearance(
  displayAppearance: string | undefined,
): displayAppearance is typeof EDITORIAL_DISPLAY_APPEARANCE {
  return displayAppearance === EDITORIAL_DISPLAY_APPEARANCE;
}

export function isMineralNoirDisplayAppearance(
  displayAppearance: string | undefined,
): displayAppearance is typeof MINERAL_NOIR_DISPLAY_APPEARANCE {
  return displayAppearance === MINERAL_NOIR_DISPLAY_APPEARANCE;
}

export function getDisplayAppearanceLabel(displayAppearance: string | undefined): string {
  return (
    DISPLAY_APPEARANCE_OPTIONS.find((appearance) => appearance.id === displayAppearance)?.title ||
    DISPLAY_APPEARANCE_OPTIONS[0].title
  );
}

export function getScheduleDesignStyleLabel(designStyle: string | undefined): string {
  return (
    SCHEDULE_DESIGN_STYLE_OPTIONS.find((style) => style.id === designStyle)?.title ||
    SCHEDULE_DESIGN_STYLE_OPTIONS[0].title
  );
}
