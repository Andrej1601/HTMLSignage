import type { LayoutType, SlideConfig, SlideshowConfig } from '@/types/slideshow.types';

export interface SlideshowTemplateDefinition {
  id: string;
  label: string;
  description: string;
  layout: LayoutType;
  accent: 'primary' | 'info' | 'success';
  buildSlides: () => Array<Omit<SlideConfig, 'id'>>;
  defaults?: Partial<SlideshowConfig>;
}

function createTemplateSlide(
  slide: Partial<SlideConfig> & Pick<SlideConfig, 'type' | 'zoneId'>,
  order: number,
): Omit<SlideConfig, 'id'> {
  return {
    enabled: true,
    duration: 12,
    order,
    showTitle: true,
    transition: 'fade',
    ...slide,
  };
}

function createSlideId(prefix: string, index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${index}`;
}

export const SLIDESHOW_TEMPLATES: SlideshowTemplateDefinition[] = [
  {
    id: 'split-wellness',
    label: 'Wellness Split',
    description: 'Tagesplan links, Hinweise und Events rechts im Wechsel.',
    layout: 'split-view',
    accent: 'primary',
    defaults: {
      defaultDuration: 12,
      defaultTransition: 'fade',
      enableTransitions: true,
    },
    buildSlides: () => [
      createTemplateSlide({ type: 'content-panel', zoneId: 'persistent', title: 'Tagesplan', duration: 18 }, 0),
      createTemplateSlide({ type: 'infos', zoneId: 'main', title: 'Hinweise', duration: 12 }, 0),
      createTemplateSlide({ type: 'events', zoneId: 'main', title: 'Events', duration: 12 }, 1),
    ],
  },
  {
    id: 'triple-dashboard',
    label: 'Triple Dashboard',
    description: 'Zeitplan links, Hinweise oben rechts, Events unten rechts.',
    layout: 'triple-view',
    accent: 'info',
    defaults: {
      defaultDuration: 12,
      defaultTransition: 'slide',
      enableTransitions: true,
    },
    buildSlides: () => [
      createTemplateSlide({ type: 'content-panel', zoneId: 'left', title: 'Zeitplan', duration: 20 }, 0),
      createTemplateSlide({ type: 'infos', zoneId: 'top-right', title: 'Hinweise', duration: 12 }, 0),
      createTemplateSlide({ type: 'events', zoneId: 'bottom-right', title: 'Events', duration: 12 }, 0),
    ],
  },
  {
    id: 'rotation-story',
    label: 'Rotation Story',
    description: 'Vollbild-Rotation für ruhige, serielle Ausspielung.',
    layout: 'full-rotation',
    accent: 'success',
    defaults: {
      defaultDuration: 14,
      defaultTransition: 'zoom',
      enableTransitions: true,
    },
    buildSlides: () => [
      createTemplateSlide({ type: 'content-panel', zoneId: 'main', title: 'Plan', duration: 18 }, 0),
      createTemplateSlide({ type: 'infos', zoneId: 'main', title: 'Infos', duration: 12 }, 1),
      createTemplateSlide({ type: 'events', zoneId: 'main', title: 'Events', duration: 12 }, 2),
    ],
  },
];

export function applySlideshowTemplate(
  currentConfig: SlideshowConfig,
  template: SlideshowTemplateDefinition,
): SlideshowConfig {
  const nextSlides = template.buildSlides().map((slide, index) => ({
    ...slide,
    id: createSlideId(template.id, index),
  }));

  return {
    ...currentConfig,
    ...template.defaults,
    layout: template.layout,
    slides: nextSlides,
  };
}
