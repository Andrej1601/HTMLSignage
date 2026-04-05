import type { DesignStyle } from '@/types/settings.types';
import type { SlideConfig } from '@/types/slideshow.types';
import {
  MODERN_SCHEDULE_DESIGN_STYLES,
} from '@/config/displayDesignStyles';

export function loadScheduleGridSlide() {
  return import('./ScheduleGridSlide').then((module) => ({ default: module.ScheduleGridSlide }));
}

export function loadTimelineScheduleSlide() {
  return import('./TimelineScheduleSlide').then((module) => ({ default: module.TimelineScheduleSlide }));
}

export function loadChronologicalListSlide() {
  return import('./ChronologicalListSlide').then((module) => ({ default: module.ChronologicalListSlide }));
}

export function loadSaunaDetailDashboard() {
  return import('./SaunaDetailDashboard').then((module) => ({ default: module.SaunaDetailDashboard }));
}

export function isModernDisplayDesignStyle(
  designStyle: DesignStyle | undefined,
): designStyle is DesignStyle {
  return MODERN_SCHEDULE_DESIGN_STYLES.includes(designStyle as DesignStyle);
}

export function preloadDisplayModules(options: {
  designStyle?: DesignStyle;
  slides?: SlideConfig[] | null;
}): void {
  const { designStyle, slides } = options;

  switch (designStyle) {
    case 'modern-timeline':
      void loadTimelineScheduleSlide();
      break;
    case 'compact-tiles':
      void loadChronologicalListSlide();
      break;
    case 'modern-wellness':
    default:
      void loadScheduleGridSlide();
      break;
  }

  if (
    isModernDisplayDesignStyle(designStyle) &&
    slides?.some((slide) => slide.type === 'sauna-detail')
  ) {
    void loadSaunaDetailDashboard();
  }
}
