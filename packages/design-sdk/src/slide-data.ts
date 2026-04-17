/**
 * Headless slide data shapes.
 *
 * Each slide type produces a well-defined data object, independent of how a
 * design renders it. Phase 1 wires real data through `useSlideData()` hooks;
 * Phase 0 only pins the SHAPES so design authors can write against stable
 * contracts.
 *
 * Fields are intentionally minimal. Additions are non-breaking as long as
 * existing fields keep their meaning.
 */

/** Slide type identifiers. Mirrors `SlideType` in the frontend, by design. */
export type SlideTypeId =
  | 'sauna-detail'
  | 'content-panel'
  | 'infos'
  | 'events'
  | 'media-image'
  | 'media-video';

// ─── Per-slide data shapes ───────────────────────────────────────────────────

export interface SaunaDetailData {
  saunaId: string;
  name: string;
  subtitle?: string;
  /** Upcoming aufguss entries (sorted ascending by start time). */
  upcoming: Array<{
    id: string;
    title: string;
    startsAt: string; // ISO-8601
    endsAt: string; // ISO-8601
    host?: string;
    aromas?: Array<{ id: string; name: string; emoji?: string; color?: string }>;
    isLive: boolean;
    isNext: boolean;
  }>;
  /** Optional background media. */
  backgroundMediaUrl?: string;
}

export interface SchedulePanelData {
  /** Rows = saunas, columns = time slots. */
  saunas: Array<{ id: string; name: string }>;
  timeSlots: string[]; // e.g. ['10:00','11:00',...]
  /** Cell content indexed as [saunaIndex][timeSlotIndex]. `null` = empty. */
  cells: Array<Array<SchedulePanelCell | null>>;
  generatedAt: string; // ISO-8601
}

export interface SchedulePanelCell {
  title: string;
  host?: string;
  aromas?: Array<{ id: string; name: string; emoji?: string; color?: string }>;
  isLive: boolean;
  isNext: boolean;
}

export interface InfoPanelData {
  id: string;
  title: string;
  bodyMarkdown?: string;
  iconUrl?: string;
  accentColor?: string;
}

export interface EventsPanelData {
  events: Array<{
    id: string;
    title: string;
    startsAt: string; // ISO-8601
    endsAt?: string;
    location?: string;
    description?: string;
  }>;
  generatedAt: string;
}

export interface MediaImageData {
  mediaId: string;
  url: string;
  altText?: string;
  fit: 'cover' | 'contain';
}

export interface MediaVideoData {
  mediaId: string;
  url: string;
  fit: 'cover' | 'contain';
  playback: 'duration' | 'complete' | 'loop-duration';
  mutedByDefault: boolean;
}

/** Discriminated map from slide type id → data shape. */
export interface SlideDataMap {
  'sauna-detail': SaunaDetailData;
  'content-panel': SchedulePanelData;
  infos: InfoPanelData;
  events: EventsPanelData;
  'media-image': MediaImageData;
  'media-video': MediaVideoData;
}

export type SlideDataFor<T extends SlideTypeId> = SlideDataMap[T];
