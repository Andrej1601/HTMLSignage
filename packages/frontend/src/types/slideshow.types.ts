// Slideshow Configuration Types

// Slide types
export type SlideType =
  | 'content-panel' // Persistent content panel (e.g. schedule grid)
  | 'sauna-detail' // Individual sauna with info
  | 'media-image' // Image from media library
  | 'media-video' // Video from media library
  | 'sauna-overview' // All saunas overview
  | 'current-aufguss'; // Current/next aufguss highlight

// Layout options for the slideshow display
export type LayoutType =
  | 'split-view' // Persistent panel + rotating content
  | 'full-rotation' // Full screen rotation of all slides
  | 'picture-in-picture' // Small persistent panel overlay on content
  | 'carousel' // Persistent panel top/bottom, carousel in middle
  | 'sidebar-left' // Sidebar left, content main area
  | 'sidebar-right' // Sidebar right, content main area
  | 'triple-view' // 1 left, 2 right (stacked) - Dashboard style
  | 'grid-2x2' // 4 items in 2x2 grid
  | 'grid-3x3'; // 9 items in 3x3 grid

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

// Layout options registry
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
    supportedSlideTypes: ['sauna-detail', 'media-image', 'media-video', 'sauna-overview'],
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
      'sauna-overview',
      'current-aufguss',
    ],
  },
  {
    type: 'picture-in-picture',
    label: 'Picture-in-Picture',
    description: 'Kleines persistentes Overlay über Content',
    icon: '📺',
    zones: [
      { id: 'persistent', name: 'Overlay', type: 'smart-persistent', size: 25 },
      { id: 'main', name: 'Hintergrund Content', type: 'rotating' },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['sauna-detail', 'media-image', 'media-video', 'sauna-overview'],
  },
  {
    type: 'carousel',
    label: 'Carousel',
    description: 'Persistenter Bereich oben/unten, Content-Carousel in der Mitte',
    icon: '🎠',
    zones: [
      { id: 'persistent', name: 'Persistenter Bereich', type: 'smart-persistent', position: 'top', size: 30 },
      { id: 'main', name: 'Carousel', type: 'rotating' },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['sauna-detail', 'media-image', 'media-video', 'sauna-overview'],
  },
  {
    type: 'sidebar-left',
    label: 'Sidebar Links',
    description: 'Persistenter Bereich als Sidebar links, Content nimmt Hauptbereich',
    icon: '📋',
    zones: [
      { id: 'persistent', name: 'Sidebar', type: 'smart-persistent', position: 'left', size: 30 },
      { id: 'main', name: 'Hauptbereich', type: 'rotating' },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['sauna-detail', 'media-image', 'media-video', 'sauna-overview'],
  },
  {
    type: 'sidebar-right',
    label: 'Sidebar Rechts',
    description: 'Persistenter Bereich als Sidebar rechts, Content nimmt Hauptbereich',
    icon: '📄',
    zones: [
      { id: 'persistent', name: 'Sidebar', type: 'smart-persistent', position: 'right', size: 30 },
      { id: 'main', name: 'Hauptbereich', type: 'rotating' },
    ],
    supportsPersistentZone: true,
    supportedSlideTypes: ['sauna-detail', 'media-image', 'media-video', 'sauna-overview'],
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
    supportedSlideTypes: ['content-panel', 'sauna-detail', 'media-image', 'media-video', 'sauna-overview', 'current-aufguss'],
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
    supportedSlideTypes: ['sauna-detail', 'media-image', 'sauna-overview', 'current-aufguss'],
  },
  {
    type: 'grid-3x3',
    label: '3x3 Grid',
    description: '9 Inhalte gleichzeitig in 3x3 Grid',
    icon: '▦',
    zones: [
      { id: 'zone-1', name: 'Position 1', type: 'rotating' },
      { id: 'zone-2', name: 'Position 2', type: 'rotating' },
      { id: 'zone-3', name: 'Position 3', type: 'rotating' },
      { id: 'zone-4', name: 'Position 4', type: 'rotating' },
      { id: 'zone-5', name: 'Position 5', type: 'rotating' },
      { id: 'zone-6', name: 'Position 6', type: 'rotating' },
      { id: 'zone-7', name: 'Position 7', type: 'rotating' },
      { id: 'zone-8', name: 'Position 8', type: 'rotating' },
      { id: 'zone-9', name: 'Position 9', type: 'rotating' },
    ],
    supportsPersistentZone: false,
    supportedSlideTypes: ['sauna-detail', 'media-image', 'sauna-overview'],
  },
];

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
    type: 'sauna-overview',
    label: 'Sauna Übersicht',
    description: 'Zeigt alle Saunas auf einmal',
    icon: '🏛️',
    requiresSauna: false,
    requiresMedia: false,
    supportsVideo: false,
  },
  {
    type: 'current-aufguss',
    label: 'Aktueller Aufguss',
    description: 'Hebt den aktuellen/nächsten Aufguss hervor',
    icon: '⏰',
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
  };
}

export function getLayoutOption(type: LayoutType): LayoutOption | undefined {
  return LAYOUT_OPTIONS.find((opt) => opt.type === type);
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
  const layout = getLayoutOption(layoutType);
  return layout?.zones || [];
}

export function getSlidesByZone(slides: SlideConfig[], zoneId: string): SlideConfig[] {
  return slides
    .filter((slide) => slide.zoneId === zoneId)
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
      return true;
    case 'persistent':
      return false;
    case 'smart-persistent':
      // Rotate if 2 or more enabled slides, otherwise stay static
      return enabledSlides.length >= 2;
    default:
      return false;
  }
}
