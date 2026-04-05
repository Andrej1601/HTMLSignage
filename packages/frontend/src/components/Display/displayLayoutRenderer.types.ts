import type { ReactElement } from 'react';
import type { Media } from '@/types/media.types';
import type { Schedule } from '@/types/schedule.types';
import type { Settings, ThemeColors } from '@/types/settings.types';
import type { LayoutType, SlideConfig, Zone } from '@/types/slideshow.types';

export type TransitionType = NonNullable<SlideConfig['transition']>;

export interface DisplayZoneInfo {
  zone: Zone;
  currentSlide: SlideConfig | null;
  currentSlideIndex: number;
  totalSlides: number;
  shouldRotate: boolean;
}

export interface TripleZoneState {
  zone?: Zone;
  slide: SlideConfig | null;
  info: DisplayZoneInfo | null;
}

export interface TripleZoneStateMap {
  left: TripleZoneState;
  topRight: TripleZoneState;
  bottomRight: TripleZoneState;
}

export interface SlidePaddingOptions {
  outerClassName?: string;
  innerClassName?: string;
}

export interface DisplayLayoutContext {
  currentTime: Date;
  displayAppearance: string;
  designStyle: string;
  displayDeviceId?: string;
  effectiveSettings: Settings;
  enableTransitions: boolean;
  getZoneInfo: (zoneId: string) => DisplayZoneInfo | null;
  getZoneSlide: (zoneId: string) => SlideConfig | null;
  isModernDesign: boolean;
  localSchedule: Schedule;
  mediaItems: Media[];
  onVideoEnded: (zoneId?: string) => void;
  renderContentPanel: () => ReactElement;
  renderSlideWithPadding: (
    slide: SlideConfig | null | undefined,
    rendered: ReactElement,
    options?: SlidePaddingOptions,
  ) => ReactElement;
  renderZoneSlide: (slide: SlideConfig | null, zone?: Zone) => ReactElement;
  resolveTransition: (slide: SlideConfig | null | undefined) => TransitionType;
  showZoneBorders: boolean;
  themeColors: ThemeColors;
  zones: Zone[];
}

export interface DisplayLayoutRendererProps {
  currentTime: Date;
  displayAppearance: string;
  designStyle: string;
  displayDeviceId?: string;
  effectiveSettings: Settings;
  enableTransitions: boolean;
  getZoneInfo: (zoneId: string) => DisplayZoneInfo | null;
  getZoneSlide: (zoneId: string) => SlideConfig | null;
  isModernDesign: boolean;
  localSchedule: Schedule;
  mediaItems: Media[];
  onVideoEnded: (zoneId?: string) => void;
  resolveTransition: (slide: SlideConfig | null | undefined) => TransitionType;
  showZoneBorders: boolean;
  themeColors: ThemeColors;
  zones: Zone[];
  currentSlide: SlideConfig | null;
  currentSlideIndex: number;
  safeLayout: LayoutType;
}
