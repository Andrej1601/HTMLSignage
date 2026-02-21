// Slideshow Configuration Types

// Slide types
export type SlideType =
  | 'content-panel' // Persistent content panel (e.g. schedule grid)
  | 'sauna-detail' // Individual sauna with info
  | 'media-image' // Image from media library
  | 'media-video' // Video from media library
  | 'infos' // Info panel (wellness tips, house rules, etc.)
  | 'events'; // Events panel

// Layout options for the slideshow display
export type LayoutType =
  | 'split-view' // Persistent panel + rotating content
  | 'full-rotation' // Full screen rotation of all slides
  | 'triple-view' // 1 left, 2 right (stacked) - Dashboard style
  | 'grid-2x2'; // 4 items in 2x2 grid

// Video playback behavior
export type VideoPlaybackMode =
  | 'duration' // Play for specified duration (loop if needed)
  | 'complete' // Play until video ends
  | 'loop-duration'; // Loop video for duration

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

// Individual slide configuration
export interface SlideConfig {
  id: string;
  type: SlideType;
  enabled: boolean;
  duration: number; // seconds
  order: number;
  zoneId?: string; // Which zone this slide belongs to (for multi-zone layouts)

  // Type-specific config
  saunaId?: string; // For sauna-detail
  mediaId?: string; // For media-image, media-video
  videoPlayback?: VideoPlaybackMode; // For media-video
  infoId?: string; // For infos

  // Display options
  title?: string; // Custom title override
  showTitle?: boolean;
  transition?: 'fade' | 'slide' | 'zoom' | 'none';

  // Advanced
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
  defaultTransition: 'fade' | 'slide' | 'zoom' | 'none';
  enableTransitions: boolean;

  // Persistent zone settings (for layouts with persistent panel)
  persistentZonePosition?: 'left' | 'right' | 'top' | 'bottom';
  persistentZoneSize?: number; // percentage (30-70)

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
    label: 'Split View',
    description: 'Persistenter Bereich links, rotierender Content rechts',
    icon: '⬌',
    zones: [
      { id: 'persistent', name: 'Persistenter Bereich', type: 'smart-persistent', position: 'left', size: 50 },
      { id: 'main', name: 'Rotierender Content', type: 'rotating' },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['content-panel', 'sauna-detail', 'media-image', 'media-video', 'infos', 'events'],
  },
  {
    type: 'full-rotation',
    label: 'Full Screen Rotation',
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
    label: 'Triple View Dashboard',
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
    label: '2x2 Grid',
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
    label: 'Content Panel',
    description: 'Persistenter Content-Bereich (z.B. Aufgussplan Grid)',
    icon: '📅',
    requiresSauna: false,
    requiresMedia: false,
    supportsVideo: false,
  },
  {
    type: 'sauna-detail',
    label: 'Sauna Detail',
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
