// Slideshow Configuration Types
//
// Atomic unions (SlideType, LayoutType, VideoPlaybackMode, MediaFitMode,
// TransitionType) live in @htmlsignage/shared — re-exported here so
// existing FE imports keep working while having a single source of truth.

import type {
  SlideType,
  LayoutType,
  VideoPlaybackMode,
  MediaFitMode,
  TransitionType,
} from '@htmlsignage/shared/settings';

export type {
  SlideType,
  LayoutType,
  VideoPlaybackMode,
  MediaFitMode,
  TransitionType,
};

export interface SlideshowDefinition {
  id: string;
  name: string;
  isDefault: boolean;
  config: SlideshowConfig;
  createdAt: string;
  updatedAt: string;
  deviceCount?: number;
  assignedDevices?: Array<{ id: string; name: string }>;
}

// Zone types
export type ZoneType =
  | 'persistent' // Always visible, static content (deprecated - use 'smart-persistent')
  | 'rotating' // Rotates through slides
  | 'smart-persistent'; // Persistent if 1 slide, rotates if multiple slides

// Zone definition - represents a display area
export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: number; // percentage (30-70) for persistent zones
}

// Individual slide configuration — discriminated union.
// Variant-specific fields are required on the matching variant only; consumers
// must narrow by `slide.type` before reading variant-specific fields.
export type {
  ContentPanelSlide,
  SaunaDetailSlide,
  MediaImageSlide,
  MediaVideoSlide,
  InfosSlide,
  EventsSlide,
} from '@htmlsignage/shared/settings';

import type {
  SlideConfigShared,
  VideoPlaybackMode as _VideoPlaybackMode,
  MediaFitMode as _MediaFitMode,
  TransitionType as _TransitionType,
} from '@htmlsignage/shared/settings';

export type SlideConfig = SlideConfigShared;

/**
 * Editor-internal form state — flat, all-optional variant fields. The editor
 * keeps this looser shape because the user is mid-edit and partial state is
 * expected. On save, the form is collapsed into the strict DU `SlideConfig`
 * via a runtime type/check that lives in the editor.
 */
export interface SlideFormData {
  type: SlideType;
  enabled: boolean;
  duration: number;
  order: number;
  zoneId?: string;
  saunaId?: string;
  mediaId?: string;
  videoPlayback?: _VideoPlaybackMode;
  mediaFit?: _MediaFitMode;
  infoId?: string;
  title?: string;
  showTitle?: boolean;
  transition?: _TransitionType;
  customCss?: string;
  notes?: string;
}

// Slideshow configuration
export interface SlideshowConfig {
  version: number;
  layout: LayoutType;
  slides: SlideConfig[];

  // Global settings
  defaultDuration: number; // seconds
  defaultTransition: import('@htmlsignage/shared/settings').TransitionType;
  enableTransitions: boolean;

  // Persistent zone settings (for layouts with persistent panel)
  persistentZonePosition?: 'left' | 'right' | 'top' | 'bottom';
  persistentZoneSize?: number; // percentage (30-70)

  // Audio override (per-slideshow)
  audioOverride?: import('@/types/settings.types').AudioSettings;

  // Design override (per-slideshow, used for event slideshows)
  displayAppearance?: import('@/types/settings.types').DisplayAppearance;
  designStyle?: import('@/types/settings.types').DesignStyle;
  saunaDetailStyle?: import('@/types/settings.types').SaunaDetailStyle;
  colorPalette?: import('@/types/settings.types').ColorPaletteName;
  theme?: Partial<import('@/types/settings.types').ThemeColors>;
  /**
   * Per-slideshow design-pack override. When set, this pack is used for
   * the slideshow regardless of the global `display.designPackId`. Lets
   * the same display swap between completely different visual identities
   * (e.g. event slideshow vs. standard) without per-device hacks.
   */
  designPackId?: string;
  /**
   * Per-slideshow design-pack token overrides. Layered on top of the
   * pack's `defaultTokens` and on top of the theme-derived overrides
   * emitted by `themeToTokenOverrides`. Use this for tenant-specific
   * tweaks (e.g. brand colour accents, tighter/looser spacing) without
   * code deploys.
   */
  tokenOverrides?: import('@htmlsignage/design-sdk').DesignTokenOverrides;
  /**
   * Partial override for the display's header/branding strip. Missing
   * fields fall through to the global `settings.header`. Use for
   * per-tenant / per-event branding (e.g. different logo text on an
   * event-specific slideshow) without touching the global config.
   */
  header?: Partial<import('@/types/settings.types').HeaderSettings>;
  /**
   * Partial override for the maintenance screen shown when the display
   * runtime goes into maintenance mode. Missing fields fall through to
   * `settings.maintenanceScreen`. Lets you ship slideshow-specific
   * maintenance copy (e.g. different language / event branding) without
   * touching the global default.
   */
  maintenanceScreen?: Partial<import('@/types/settings.types').MaintenanceScreenSettings>;

  // Advanced
  pauseOnInteraction?: boolean;
  showSlideIndicators?: boolean;
  showZoneBorders?: boolean;
}

// Layout metadata for UI
export interface LayoutOption {
  type: LayoutType;
  label: string;
  description: string;
  icon: string; // emoji or icon name
  zones: Zone[]; // Define which zones this layout has
  supportsPersistentZone: boolean; // Deprecated: use zones instead
  supportedSlideTypes: SlideType[];
}

// ─── Layout Registry ────────────────────────────────────────────────────────
//
// LAYOUT_OPTIONS is the ordered array used for UI rendering (picks up insertion order).
// LAYOUT_REGISTRY is a typed Record for O(1) lookup — adding a new layout means
// adding ONE entry here. All consumers call getLayout() and never need to change.

export const LAYOUT_OPTIONS: LayoutOption[] = [
  {
    type: 'split-view',
    label: 'Geteilte Ansicht',
    description: 'Persistenter Bereich links, rotierender Content rechts',
    icon: '⬌',
    zones: [
      { id: 'persistent', name: 'Linke Seite', type: 'smart-persistent', position: 'left', size: 50 },
      { id: 'main', name: 'Rechte Seite', type: 'rotating' },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['content-panel', 'sauna-detail', 'media-image', 'media-video', 'infos', 'events'],
  },
  {
    type: 'full-rotation',
    label: 'Vollbild-Rotation',
    description: 'Jeder Slide nimmt den ganzen Bildschirm ein',
    icon: '🔄',
    zones: [
      { id: 'main', name: 'Vollbild', type: 'rotating' },
    ],
    supportsPersistentZone: false,
    supportedSlideTypes: [
      'content-panel',
      'sauna-detail',
      'media-image',
      'media-video',
      'infos',
      'events',
    ],
  },
  {
    type: 'triple-view',
    label: 'Dreifach-Ansicht',
    description: '1 Bereich links, 2 Bereiche rechts (oben/unten) - Dashboard-Style',
    icon: '📊',
    zones: [
      { id: 'left', name: 'Links (Zeitplan/Grid)', type: 'smart-persistent', position: 'left', size: 66 },
      { id: 'top-right', name: 'Rechts Oben', type: 'smart-persistent', position: 'top', size: 50 },
      { id: 'bottom-right', name: 'Rechts Unten', type: 'smart-persistent', position: 'bottom', size: 50 },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['content-panel', 'sauna-detail', 'media-image', 'media-video', 'infos', 'events'],
  },
  {
    type: 'grid-2x2',
    label: '2x2 Raster',
    description: '4 Inhalte gleichzeitig in 2x2 Grid',
    icon: '⬜',
    zones: [
      { id: 'zone-1', name: 'Oben Links', type: 'rotating' },
      { id: 'zone-2', name: 'Oben Rechts', type: 'rotating' },
      { id: 'zone-3', name: 'Unten Links', type: 'rotating' },
      { id: 'zone-4', name: 'Unten Rechts', type: 'rotating' },
    ],
    supportsPersistentZone: false,
    supportedSlideTypes: ['content-panel', 'sauna-detail', 'media-image', 'media-video', 'infos', 'events'],
  },
];

// O(1) registry — indexed by LayoutType for fast lookup
export const LAYOUT_REGISTRY: Record<LayoutType, LayoutOption> = Object.fromEntries(
  LAYOUT_OPTIONS.map((opt) => [opt.type, opt])
) as Record<LayoutType, LayoutOption>;

/** Returns the layout definition for `type`. Falls back to `full-rotation` when unknown. */
export function getLayout(type: LayoutType): LayoutOption {
  return LAYOUT_REGISTRY[type] ?? LAYOUT_REGISTRY['full-rotation'];
}

// Slide type metadata
export interface SlideTypeOption {
  type: SlideType;
  label: string;
  description: string;
  icon: string;
  requiresSauna: boolean;
  requiresMedia: boolean;
  supportsVideo: boolean;
}

export const SLIDE_TYPE_OPTIONS: SlideTypeOption[] = [
  {
    type: 'content-panel',
    label: 'Inhaltsbereich',
    description: 'Persistenter Content-Bereich (z.B. Aufgussplan Grid)',
    icon: '📅',
    requiresSauna: false,
    requiresMedia: false,
    supportsVideo: false,
  },
  {
    type: 'sauna-detail',
    label: 'Sauna-Details',
    description: 'Zeigt Details einer spezifischen Sauna',
    icon: '🔥',
    requiresSauna: true,
    requiresMedia: false,
    supportsVideo: false,
  },
  {
    type: 'media-image',
    label: 'Bild',
    description: 'Zeigt ein Bild aus der Mediathek',
    icon: '🖼️',
    requiresSauna: false,
    requiresMedia: true,
    supportsVideo: false,
  },
  {
    type: 'media-video',
    label: 'Video',
    description: 'Spielt ein Video aus der Mediathek ab',
    icon: '🎬',
    requiresSauna: false,
    requiresMedia: true,
    supportsVideo: true,
  },
  {
    type: 'infos',
    label: 'Infos',
    description: 'Wellness-Tipps / Hinweise aus den Einstellungen',
    icon: 'ℹ️',
    requiresSauna: false,
    requiresMedia: false,
    supportsVideo: false,
  },
  {
    type: 'events',
    label: 'Events',
    description: 'Zeigt kommende Events aus den Einstellungen',
    icon: '📆',
    requiresSauna: false,
    requiresMedia: false,
    supportsVideo: false,
  },
];

// Helper functions
export function createEmptySlide(order: number = 0, zoneId?: string): Omit<SlideConfig, 'id'> {
  return {
    type: 'content-panel',
    enabled: true,
    duration: 10,
    order,
    zoneId,
    showTitle: true,
    transition: 'fade',
  };
}

export function createDefaultSlideshowConfig(): SlideshowConfig {
  return {
    version: 1,
    layout: 'split-view',
    slides: [],
    defaultDuration: 10,
    defaultTransition: 'fade',
    enableTransitions: true,
    persistentZonePosition: 'left',
    persistentZoneSize: 50,
    pauseOnInteraction: false,
    showSlideIndicators: true,
    showZoneBorders: true,
  };
}

/** @deprecated Use `getLayout()` instead — returns undefined if unknown rather than falling back. */
export function getLayoutOption(type: LayoutType): LayoutOption | undefined {
  return LAYOUT_REGISTRY[type];
}

export function getSlideTypeOption(type: SlideType): SlideTypeOption | undefined {
  return SLIDE_TYPE_OPTIONS.find((opt) => opt.type === type);
}

/** Resolves the media-fit for image/video slides; default depends on type. */
export function getEffectiveMediaFit(
  slide: { type: SlideType; mediaFit?: import('@htmlsignage/shared/settings').MediaFitMode },
): MediaFitMode {
  if (slide.mediaFit) return slide.mediaFit;
  return slide.type === 'media-video' ? 'contain' : 'cover';
}

export function getEnabledSlides(config: SlideshowConfig): SlideConfig[] {
  return config.slides.filter((slide) => slide.enabled).sort((a, b) => a.order - b.order);
}

export function reorderSlides(slides: SlideConfig[], fromIndex: number, toIndex: number): SlideConfig[] {
  const result = Array.from(slides);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);

  // Update order values
  return result.map((slide, index) => ({ ...slide, order: index }));
}

// Zone helper functions
export function getZonesForLayout(layoutType: LayoutType): Zone[] {
  return getLayout(layoutType).zones;
}

export function getSlidesByZone(slides: SlideConfig[], zoneId: string): SlideConfig[] {
  return slides
    // Backward-compatible default: slides without a zoneId belong to "main".
    .filter((slide) => (slide.zoneId || 'main') === zoneId)
    .sort((a, b) => a.order - b.order);
}

export function getSlidesByZoneMap(slides: SlideConfig[]): Map<string, SlideConfig[]> {
  const map = new Map<string, SlideConfig[]>();
  slides.forEach((slide) => {
    const zoneId = slide.zoneId || 'main'; // Default to 'main' if no zoneId
    if (!map.has(zoneId)) {
      map.set(zoneId, []);
    }
    map.get(zoneId)!.push(slide);
  });

  // Sort each zone's slides by order
  map.forEach((zoneSlides) => {
    zoneSlides.sort((a, b) => a.order - b.order);
  });

  return map;
}

export function assignZoneToSlides(slides: SlideConfig[], zoneId: string): SlideConfig[] {
  return slides.map((slide) => ({ ...slide, zoneId }));
}

/**
 * Determines if a zone should rotate based on its type and number of slides.
 * Smart-persistent zones: only rotate if there are 2+ enabled slides
 */
export function shouldZoneRotate(zone: Zone, slides: SlideConfig[]): boolean {
  const zoneSlides = getSlidesByZone(slides, zone.id);
  const enabledSlides = zoneSlides.filter((s) => s.enabled);

  switch (zone.type) {
    case 'rotating':
      return enabledSlides.length >= 2;
    case 'persistent':
      return false;
    case 'smart-persistent':
      // Rotate if 2 or more enabled slides, otherwise stay static
      return enabledSlides.length >= 2;
    default:
      return false;
  }
}
