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

export interface SaunaAroma {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
}

export interface SaunaInfusionEntry {
  id: string;
  /** Raw start time "HH:mm" from the schedule row. */
  time: string;
  /** Duration in minutes. */
  durationMin: number;
  title: string;
  description?: string;
  /** Intensity 1–4 (a.k.a. flames). */
  intensity?: number;
  aromas?: SaunaAroma[];
  /** True if the entry is currently running. */
  isLive: boolean;
  /** True if the entry is the next to start. */
  isNext: boolean;
  /** True if the entry is in the "pre-start" window but not yet live. */
  isPrestart: boolean;
  /** True if the entry already ended. */
  isFinished: boolean;
}

export interface SaunaDetailInfo {
  temperatureC?: number;
  humidityPct?: number;
  capacity?: number;
  features?: string[];
}

export interface SaunaDetailData {
  saunaId: string;
  name: string;
  /** Optional short subtitle (from sauna metadata). */
  subtitle?: string;
  /** Free-text description (first lines used as badges in modern designs). */
  description?: string;
  /** Up to a handful of short label badges derived from description. */
  infoBadges: string[];
  /** Per-sauna accent color, if configured. */
  accentColor?: string;
  /** Resolved image URL, or null if no image set / unresolvable. */
  imageUrl: string | null;
  /** Static info (temperature, humidity, capacity, feature chips). */
  info: SaunaDetailInfo;
  /** Upcoming + live aufguss entries, sorted ascending by start time. */
  upcoming: SaunaInfusionEntry[];
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
  aromas?: SaunaAroma[];
  isLive: boolean;
  isNext: boolean;
}

export type InfoImageMode = 'background' | 'side' | 'none';

export interface InfoPanelData {
  id: string;
  title: string;
  /** Plain-text body. Renderers may treat lines as paragraphs. */
  text: string;
  /** Resolved image URL (from media library), or null if none. */
  imageUrl: string | null;
  /** Determines how the image relates to the body. */
  imageMode: InfoImageMode;
  accentColor?: string;
}

export type EventStatusRank = 'live' | 'soon' | 'near' | 'far';

export interface EventSlideEntry {
  id: string;
  title: string;
  /** ISO-8601 start timestamp. */
  startsAt: string;
  /** ISO-8601 end timestamp. */
  endsAt: string;
  location?: string;
  description?: string;
  /** Resolved image URL, or null. */
  imageUrl: string | null;
  /** Rank for status-based styling without leaking colors into data. */
  statusRank: EventStatusRank;
  isLive: boolean;
  /** True if the event starts within the "soon" window (default 180 min). */
  startsSoon: boolean;
  /** Pre-formatted, localized date label (e.g. "Mo. 17. Apr."). */
  dateLabel: string;
  /** Pre-formatted, localized time range label (e.g. "18:00 – 20:00"). */
  timeLabel: string;
  /** Pre-formatted relative label (e.g. "In 42 Min.", "Jetzt live"). */
  relativeLabel: string;
}

export interface EventsPanelData {
  events: EventSlideEntry[];
  /** ISO-8601 timestamp of when the data was computed. */
  generatedAt: string;
}

export interface MediaImageData {
  mediaId: string;
  url: string;
  altText?: string;
  fit: 'cover' | 'contain';
  /** Optional overlay title (from slide config). */
  title?: string;
  /** Whether the overlay title should be rendered. */
  showTitle?: boolean;
}

export interface MediaVideoData {
  mediaId: string;
  url: string;
  fit: 'cover' | 'contain';
  playback: 'duration' | 'complete' | 'loop-duration';
  mutedByDefault: boolean;
  /** Optional overlay title (from slide config). */
  title?: string;
  /** Whether the overlay title should be rendered. */
  showTitle?: boolean;
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
